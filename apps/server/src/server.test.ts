import { afterEach, beforeEach, describe, expect, it } from "vitest";
import WebSocket from "ws";
import type { GameAction, GameView } from "@belot/engine";
import type { ClientMessage, RoomState, ServerMessage } from "@belot/protocol";
import { startServer, type GameServer } from "./server";

class TestClient {
  readonly messages: ServerMessage[] = [];
  readonly raw: string[] = [];
  room: RoomState | null = null;
  view: GameView | null = null;
  private ws!: WebSocket;
  private waiters: (() => void)[] = [];

  constructor(
    private readonly port: number,
    readonly token: string,
    readonly nickname: string,
  ) {}

  async connect(): Promise<void> {
    this.ws = new WebSocket(`ws://127.0.0.1:${this.port}`);
    this.ws.on("message", (data) => {
      const text = data.toString();
      this.raw.push(text);
      const msg = JSON.parse(text) as ServerMessage;
      this.messages.push(msg);
      if (msg.type === "roomState") this.room = msg.room;
      if (msg.type === "update") this.view = msg.view;
      this.waiters.splice(0).forEach((w) => w());
    });
    await new Promise<void>((resolve, reject) => {
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
    });
    this.send({ type: "hello", token: this.token, nickname: this.nickname });
    await this.until(() => this.room !== undefined && this.messages.length > 0);
  }

  send(msg: ClientMessage | Record<string, unknown>): void {
    this.ws.send(JSON.stringify(msg));
  }

  close(): void {
    this.ws.close();
  }

  until(predicate: () => boolean, ms = 4000): Promise<void> {
    return new Promise((resolve, reject) => {
      if (predicate()) return resolve();
      const timer = setTimeout(() => reject(new Error("timed out waiting")), ms);
      const check = () => {
        if (predicate()) {
          clearTimeout(timer);
          resolve();
        } else this.waiters.push(check);
      };
      this.waiters.push(check);
    });
  }

  lastError() {
    return [...this.messages].reverse().find((m) => m.type === "error");
  }
}

let server: GameServer;
const clients: TestClient[] = [];

let tokenCounter = 0;
async function client(name: string): Promise<TestClient> {
  const c = new TestClient(server.port, `test-token-${++tokenCounter}-0123456789abcdef`, name);
  clients.push(c);
  await c.connect();
  return c;
}

async function table(): Promise<TestClient[]> {
  const [a, b, c, d] = [await client("Ани"), await client("Борис"), await client("Вили"), await client("Гого")];
  a!.send({ type: "createRoom" });
  await a!.until(() => a!.room !== null);
  const code = a!.room!.code;
  for (const x of [b!, c!, d!]) {
    x.send({ type: "joinRoom", code });
    await x.until(() => x.room !== null);
  }
  for (const [i, x] of [a!, b!, c!, d!].entries()) {
    x.send({ type: "takeSeat", seat: i });
    await x.until(() => x.room?.you === i);
  }
  return [a!, b!, c!, d!];
}

beforeEach(async () => {
  server = await startServer({ port: 0, maxMessagesPerSecond: 10_000 });
});

afterEach(async () => {
  clients.splice(0).forEach((c) => c.close());
  await server.close();
});

describe("rooms", () => {
  it("creates a room, lets others join by code and take seats", async () => {
    const [a, b] = await table();
    expect(a!.room!.code).toMatch(/^[A-Z]{4}$/);
    expect(a!.room!.youAreHost).toBe(true);
    expect(b!.room!.youAreHost).toBe(false);
    await a!.until(() => a!.room!.seats.every((s) => s !== null));
    expect(a!.room!.seats.map((s) => s?.nickname)).toEqual(["Ани", "Борис", "Вили", "Гого"]);
  });

  it("rejects unknown rooms, taken seats and a start by a non-host", async () => {
    const [a, b] = await table();
    const outsider = await client("Дончо");
    outsider.send({ type: "joinRoom", code: "ZZZZ" });
    await outsider.until(() => outsider.lastError() !== undefined);
    expect(outsider.lastError()).toMatchObject({ code: "room_not_found" });

    outsider.send({ type: "joinRoom", code: a!.room!.code });
    await outsider.until(() => outsider.room !== null);
    outsider.send({ type: "takeSeat", seat: 0 });
    await outsider.until(() => outsider.lastError()?.type === "error" && (outsider.lastError() as { code: string }).code === "seat_taken");

    b!.send({ type: "startGame" });
    await b!.until(() => (b!.lastError() as { code?: string } | undefined)?.code === "not_host");
  });

  it("needs four seated players to start", async () => {
    const a = await client("Ани");
    a.send({ type: "createRoom" });
    await a.until(() => a.room !== null);
    a.send({ type: "takeSeat", seat: 0 });
    await a.until(() => a.room?.you === 0);
    a.send({ type: "startGame" });
    await a.until(() => (a.lastError() as { code?: string } | undefined)?.code === "need_four_players");
  });

  it("answers garbage with an error instead of crashing", async () => {
    const a = await client("Ани");
    a.send({ type: "nope" });
    await a.until(() => a.lastError() !== undefined);
    expect(a.lastError()).toMatchObject({ code: "bad_message" });
  });

  it("rate limits a client that floods the server", async () => {
    await server.close();
    server = await startServer({ port: 0, maxMessagesPerSecond: 5 });
    const a = await client("Ани");
    for (let i = 0; i < 30; i++) a.send({ type: "leaveSeat" });
    await a.until(() => (a.lastError() as { code?: string } | undefined)?.code === "rate_limited");
  });

  it("exposes a health endpoint", async () => {
    const res = await fetch(`http://127.0.0.1:${server.port}/health`);
    expect(await res.json()).toMatchObject({ ok: true });
  });
});

describe("a running game", () => {
  it("never sends a client anyone else's cards", async () => {
    const players = await table();
    players[0]!.send({ type: "startGame" });
    await Promise.all(players.map((p) => p.until(() => p.view !== null)));
    // The deck is shuffled but nobody holds cards until the player right of the dealer cuts.
    expect(players.every((p) => p.view!.phase === "cutting" && p.view!.hand.length === 0)).toBe(true);
    expect(players.every((p) => !p.raw.some((r) => r.includes('"deck"')))).toBe(true);
    players[3]!.send({ type: "action", action: { type: "cut", position: 9 } });
    await Promise.all(players.map((p) => p.until(() => p.view!.phase === "dealing")));
    players[0]!.send({ type: "action", action: { type: "deal", lucky: true } });
    await Promise.all(players.map((p) => p.until(() => p.view!.phase === "bidding")));
    // The lucky card is public: everybody sees the same one.
    expect(new Set(players.map((p) => JSON.stringify(p.view!.lucky))).size).toBe(1);
    expect(players[0]!.view!.lucky).not.toBeNull();

    const key = (c: { suit: string; rank: string }) => c.suit + c.rank;
    const hands = players.map((p) => new Set(p.view!.hand.map(key)));
    for (let i = 0; i < 4; i++) {
      expect(hands[i]!.size).toBe(5);
      for (let j = i + 1; j < 4; j++) {
        for (const card of hands[i]!) expect(hands[j]!.has(card)).toBe(false);
      }
    }
    // Before any card is played nothing is public, so another player's card must not
    // appear anywhere in a client's raw wire data.
    for (const [i, p] of players.entries()) {
      expect(p.raw.some((r) => r.includes('"hands"'))).toBe(false);
      for (const [j, other] of players.entries()) {
        if (i === j) continue;
        for (const card of other.view!.hand) {
          if (JSON.stringify(card) === JSON.stringify(players[0]!.view!.lucky?.card)) continue; // public by design
          expect(p.raw.some((r) => r.includes(JSON.stringify(card)))).toBe(false);
        }
      }
    }
  });

  it("plays a full game to 151 through the sockets", async () => {
    const players = await table();
    let pending = 0;

    players[0]!.send({ type: "startGame" });
    await Promise.all(players.map((p) => p.until(() => p.view !== null)));

    let steps = 0;
    while (!players.some((p) => p.view?.winner !== null && p.view?.winner !== undefined)) {
      const seat = players.findIndex((p) => p.view!.legalActions.length > 0 && (p.view!.phase !== "roundEnd" || p.view!.seat === 0));
      expect(seat).toBeGreaterThanOrEqual(0);
      const p = players[seat]!;
      const options = p.view!.legalActions;
      // Prefer passing during bidding so rounds get played.
      const pass = options.find((o) => o.type === "bid" && o.bid.type === "pass");
      const action: GameAction = pass && steps % 3 !== 0 ? pass : options[steps % options.length]!;
      const before = players.map((x) => x.view);
      p.send({ type: "action", action });
      pending++;
      // Wait until every seat has received the resulting update.
      await Promise.all(players.map((x, i) => x.until(() => x.view !== before[i]))).catch((e) => {
        throw new Error(`step ${steps} seat ${seat} phase ${before[seat]!.phase} action ${JSON.stringify(action)} err ${JSON.stringify(p.lastError())}: ${e.message}`);
      });
      if (++steps > 5000) throw new Error("game did not end");
    }
    const final = players[0]!.view!;
    expect(final.phase).toBe("gameOver");
    expect(Math.max(...final.scores)).toBeGreaterThanOrEqual(151);
    expect(pending).toBeGreaterThan(30);
  });

  it("rejects an action from the wrong seat", async () => {
    const players = await table();
    players[0]!.send({ type: "startGame" });
    await Promise.all(players.map((p) => p.until(() => p.view !== null)));
    const turn = players[0]!.view!.turn;
    const wrong = players[(turn + 1) % 4]!;
    wrong.send({ type: "action", action: { type: "bid", bid: { type: "pass" } } });
    await wrong.until(() => wrong.lastError() !== undefined);
    expect(wrong.lastError()).toMatchObject({ code: "illegal_action" });
  });

  it("restores the seat, hand and game after a reconnect", async () => {
    const players = await table();
    players[0]!.send({ type: "startGame" });
    await Promise.all(players.map((p) => p.until(() => p.view !== null)));

    const victim = players[2]!;
    const handBefore = victim.view!.hand;
    victim.close();
    await players[0]!.until(() => players[0]!.room!.seats[2]?.connected === false);

    const back = new TestClient(server.port, victim.token, victim.nickname);
    clients.push(back);
    await back.connect();
    await back.until(() => back.view !== null);
    expect(back.room!.you).toBe(2);
    expect(back.view!.hand).toEqual(handBefore);
    await players[0]!.until(() => players[0]!.room!.seats[2]?.connected === true);
  });
});

describe("static files", () => {
  it("serves files, falls back to index.html and blocks path traversal", async () => {
    const { mkdtempSync, writeFileSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { staticHandler } = await import("./static");
    const dir = mkdtempSync(join(tmpdir(), "belot-web-"));
    writeFileSync(join(dir, "index.html"), "<h1>hi</h1>");
    await server.close();
    server = await startServer({ port: 0, onRequest: staticHandler(dir) });
    const base = `http://127.0.0.1:${server.port}`;
    expect(await (await fetch(`${base}/`)).text()).toContain("hi");
    expect(await (await fetch(`${base}/ABCD`)).text()).toContain("hi"); // SPA room link
    const raw = await fetch(`${base}/..%2f..%2fetc/passwd`);
    expect(await raw.text()).not.toContain("root:");
  });
});

describe("bots", () => {
  it("lets the host send the bots away again", async () => {
    const a = await client("Ани");
    a.send({ type: "createRoom" });
    await a.until(() => a.room !== null);
    a.send({ type: "addBots" });
    await a.until(() => a.room!.seats.every((s) => s !== null));
    a.send({ type: "removeBots" });
    await a.until(() => a.room!.seats.filter((s) => s !== null).length === 1);
    expect(a.room!.seats[0]?.nickname).toBe("Ани");
    expect(a.lastError()).toBeUndefined();
  });


  it("fills empty seats and plays their turns until the human has to act", async () => {
    await server.close();
    server = await startServer({ port: 0, maxMessagesPerSecond: 10_000, botDelayMs: 1, botCutDelayMs: 1, botDealDelayMs: 1 });
    const a = await client("Ани");
    a.send({ type: "createRoom" });
    await a.until(() => a.room !== null);
    a.send({ type: "addBots" });
    await a.until(() => a.room?.you === 0);
    await a.until(() => a.room!.seats.every((s) => s !== null));
    expect(a.room!.seats[0]?.nickname).toBe("Ани");
    expect(a.room!.watchers).toEqual([]);
    a.send({ type: "startGame" });
    // The bot to the dealer's left cuts; then the human dealer deals.
    await a.until(() => a.view?.phase === "dealing");
    expect(a.view!.turn).toBe(0);
    a.send({ type: "action", action: { type: "deal", lucky: false } });
    // Bots bid until it is the human's turn; the human passes and the bots keep going.
    await a.until(() => a.view?.phase === "bidding" && a.view.turn === 0);
    a.send({ type: "action", action: { type: "bid", bid: { type: "pass" } } });
    await a.until(() => a.view?.phase !== "bidding" || a.view.bidLog.length > 4);
    expect(a.lastError()).toBeUndefined();
  });
});
