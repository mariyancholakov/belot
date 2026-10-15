import { randomInt } from "node:crypto";
import { createServer, type Server } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { clientMessageSchema, type ErrorCode, type ServerMessage } from "@belot/protocol";
import { Room, RoomError, type Outgoing } from "./room";

// No I, L, O, 0, 1 to avoid confusion when reading codes aloud.
const CODE_LETTERS = "ABCDEFGHJKMNPQRSTUVWXYZ";
const IDLE_ROOM_MS = 30 * 60 * 1000;
const DEFAULT_MAX_MESSAGES_PER_SECOND = 40;

interface Connection {
  ws: WebSocket;
  token: string | null;
  nickname: string;
  roomCode: string | null;
  windowStart: number;
  windowCount: number;
}

export interface GameServer {
  port: number;
  http: Server;
  rooms: Map<string, Room>;
  close(): Promise<void>;
}

export interface ServerOptions {
  port?: number;
  /** Per-connection message rate limit. */
  maxMessagesPerSecond?: number;
  /** Pause before a computer player moves. */
  botDelayMs?: number;
  /** Pause before a computer player cuts: clients play the shuffle animation first. */
  botCutDelayMs?: number;
  /** Extra pause for the first bot move after a deal, while clients animate the cards. */
  botDealDelayMs?: number;
  /** How long a person has to bid or play a card before the server does it for them (0 turns the clock off). */
  turnMs?: number;
  /** Extra time on top of the clock for the first move after a deal and after a trick, while clients animate. */
  turnGraceMs?: number;
  /** Optional handler for non-websocket HTTP requests (static files). */
  onRequest?: Parameters<typeof createServer>[1];
}

export async function startServer(options: ServerOptions = {}): Promise<GameServer> {
  const botDelayMs = options.botDelayMs ?? 900;
  const turnMs = options.turnMs ?? 25_000;
  const turnGraceMs = options.turnGraceMs ?? 5000;
  const botCutDelayMs = options.botCutDelayMs ?? 3200;
  const botDealDelayMs = options.botDealDelayMs ?? 4000;
  const maxPerSecond = options.maxMessagesPerSecond ?? DEFAULT_MAX_MESSAGES_PER_SECOND;
  const rooms = new Map<string, Room>();
  /** token -> room code, so a returning player lands back at their table. */
  const tokenRoom = new Map<string, string>();
  /** token -> its live connection. */
  const live = new Map<string, Connection>();

  const http = createServer((req, res) => {
    if (req.url === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ ok: true, rooms: rooms.size }));
      return;
    }
    if (options.onRequest) {
      (options.onRequest as (req: unknown, res: unknown) => void)(req, res);
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const wss = new WebSocketServer({ server: http, maxPayload: 16 * 1024 });

  const send = (ws: WebSocket, message: ServerMessage) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(message));
  };
  const sendError = (ws: WebSocket, code: ErrorCode, message: string) => send(ws, { type: "error", code, message });
  const deliver = (outgoing: Outgoing[]) => {
    for (const { token, message } of outgoing) {
      const conn = live.get(token);
      if (conn) send(conn.ws, message);
    }
  };

  function newCode(): string {
    for (;;) {
      let code = "";
      for (let i = 0; i < 4; i++) code += CODE_LETTERS[randomInt(CODE_LETTERS.length)];
      if (!rooms.has(code)) return code;
    }
  }

  function roomOf(conn: Connection): Room {
    const room = conn.roomCode ? rooms.get(conn.roomCode) : undefined;
    if (!room) throw new RoomError("not_in_room", "not in a room");
    return room;
  }

  function handle(conn: Connection, raw: unknown): void {
    const parsed = clientMessageSchema.safeParse(raw);
    if (!parsed.success) return sendError(conn.ws, "bad_message", "invalid message");
    const msg = parsed.data;

    if (msg.type === "hello") {
      const previous = live.get(msg.token);
      if (previous && previous !== conn) {
        previous.token = null; // the old socket no longer speaks for this player
        previous.ws.close(4000, "replaced");
      }
      conn.token = msg.token;
      conn.nickname = msg.nickname;
      live.set(msg.token, conn);
      const code = tokenRoom.get(msg.token);
      const room = code ? rooms.get(code) : undefined;
      if (room && room.members.has(msg.token)) {
        conn.roomCode = room.code;
        room.join(msg.token, msg.nickname);
        for (const m of room.snapshotFor(msg.token)) send(conn.ws, m);
        deliver(room.broadcast([], false).filter((o) => o.token !== msg.token));
      } else {
        tokenRoom.delete(msg.token);
        send(conn.ws, { type: "roomState", room: null });
      }
      return;
    }

    const token = conn.token;
    if (!token) return sendError(conn.ws, "no_hello", "say hello first");

    switch (msg.type) {
      case "createRoom": {
        leaveCurrent(conn);
        const room = new Room(newCode(), token, conn.nickname, () => randomInt(2 ** 31));
        rooms.set(room.code, room);
        enter(conn, room);
        break;
      }
      case "joinRoom": {
        const room = rooms.get(msg.code);
        if (!room) return sendError(conn.ws, "room_not_found", "no such room");
        leaveCurrent(conn);
        room.join(token, conn.nickname);
        enter(conn, room);
        break;
      }
      case "leaveRoom":
        leaveCurrent(conn);
        // An explicit leave must stick: a mid-game seat stays reserved, but reloading goes to the menu, not back to the table.
        if (token) tokenRoom.delete(token);
        send(conn.ws, { type: "roomState", room: null });
        break;
      case "takeSeat": {
        const room = roomOf(conn);
        room.takeSeat(token, msg.seat);
        deliver(room.broadcast([], false));
        break;
      }
      case "leaveSeat": {
        const room = roomOf(conn);
        room.leaveSeat(token);
        deliver(room.broadcast([], false));
        break;
      }
      case "addBots": {
        const room = roomOf(conn);
        room.addBots(token);
        deliver(room.broadcast([], false));
        break;
      }
      case "removeBots": {
        const room = roomOf(conn);
        room.removeBots(token);
        deliver(room.broadcast([], false));
        break;
      }
      case "setCardBack": {
        const room = roomOf(conn);
        room.setCardBack(token, msg.back);
        deliver(room.broadcast([], false));
        break;
      }
      case "startGame": {
        const room = roomOf(conn);
        room.start(token);
        armTurnClock(room);
        deliver(room.broadcast([], true));
        scheduleBots(room);
        break;
      }
      case "action": {
        const room = roomOf(conn);
        const events = room.act(token, msg.action);
        armTurnClock(room);
        deliver(room.broadcast(events, true));
        scheduleBots(room);
        break;
      }
    }
  }

  const botTimers = new Set<ReturnType<typeof setTimeout>>();
  const clocks = new Map<string, ReturnType<typeof setTimeout>>();

  /** Starts (or stops) the clock for whoever is to move; when it runs out the server plays for them. */
  function armTurnClock(room: Room): void {
    const old = clocks.get(room.code);
    if (old) clearTimeout(old);
    clocks.delete(room.code);
    room.turnEndsAt = null;
    if (turnMs <= 0 || !room.clockApplies()) return;
    const game = room.game!;
    // Leave room for the deal and for a finished trick to be swept away before the clock starts.
    const grace = (game.phase === "bidding" && game.bidLog.length === 0) || (game.phase === "playing" && game.tricksPlayed === 0 && game.trick.length === 0) ? turnGraceMs : game.phase === "playing" && game.trick.length === 0 ? Math.round(turnGraceMs * 0.4) : 0;
    const wait = turnMs + grace;
    room.turnEndsAt = Date.now() + wait;
    const timer = setTimeout(() => {
      clocks.delete(room.code);
      if (!rooms.has(room.code)) return;
      const move = room.autoMove();
      if (!move) return;
      try {
        const events = room.act(move.token, move.action);
        armTurnClock(room);
        deliver(room.broadcast(events, true));
      } catch (err) {
        console.error("auto move failed", err);
        return;
      }
      scheduleBots(room);
    }, wait);
    clocks.set(room.code, timer);
  }

  /** Let computer players move, paced so humans can follow what happens. */
  function scheduleBots(room: Room): void {
    const move = room.nextBotMove();
    if (!move) return;
    const game = room.game!;
    const botWait = (g: NonNullable<Room["game"]>, trickDone: boolean): number => {
      if (g.phase === "shuffling") return botDelayMs;
      if (g.phase === "cutting") return g.fresh ? botCutDelayMs : botDelayMs + botCutDelayMs / 4; // clients play the shuffle
      if (g.phase === "dealing") return botDelayMs + botCutDelayMs / 2; // clients play the cut
      if (g.phase === "bidding" && g.bidLog.length === 0) return botDelayMs + botDealDelayMs; // the deal
      if (g.phase === "playing" && g.tricksPlayed === 0 && g.trick.length === 0) return botDelayMs + botDealDelayMs / 2;
      return botDelayMs + (trickDone ? 1600 : 0);
    };
    const afterTrick = game.phase === "playing" && game.trick.length === 0 && game.tricksPlayed > 0;
    const timer = setTimeout(() => {
      botTimers.delete(timer);
      if (!rooms.has(room.code)) return;
      const current = room.nextBotMove();
      if (!current) return;
      try {
        const events = room.act(current.token, current.action);
        armTurnClock(room);
        deliver(room.broadcast(events, true));
      } catch (err) {
        console.error("bot move failed", err);
        return;
      }
      scheduleBots(room);
    }, botWait(game, afterTrick));
    botTimers.add(timer);
  }

  function enter(conn: Connection, room: Room): void {
    conn.roomCode = room.code;
    tokenRoom.set(conn.token!, room.code);
    for (const m of room.snapshotFor(conn.token!)) send(conn.ws, m);
    deliver(room.broadcast([], false).filter((o) => o.token !== conn.token));
  }

  function leaveCurrent(conn: Connection): void {
    const token = conn.token;
    const room = conn.roomCode ? rooms.get(conn.roomCode) : undefined;
    conn.roomCode = null;
    if (!token || !room) return;
    room.leave(token);
    if (room.members.has(token)) {
      // Seated mid-game: the seat is kept, but they are treated as offline.
      return;
    }
    tokenRoom.delete(token);
    deliver(room.broadcast([], false));
  }

  wss.on("connection", (ws) => {
    const conn: Connection = { ws, token: null, nickname: "", roomCode: null, windowStart: Date.now(), windowCount: 0 };

    ws.on("message", (data) => {
      const now = Date.now();
      if (now - conn.windowStart > 1000) {
        conn.windowStart = now;
        conn.windowCount = 0;
      }
      if (++conn.windowCount > maxPerSecond) return sendError(ws, "rate_limited", "slow down");

      let raw: unknown;
      try {
        raw = JSON.parse(data.toString());
      } catch {
        return sendError(ws, "bad_message", "invalid JSON");
      }
      try {
        handle(conn, raw);
      } catch (err) {
        if (err instanceof RoomError) sendError(ws, err.code, err.message);
        else {
          console.error("unexpected error", err);
          sendError(ws, "bad_message", "server error");
        }
      }
    });

    ws.on("close", () => {
      const token = conn.token;
      if (!token || live.get(token) !== conn) return;
      live.delete(token);
      const room = conn.roomCode ? rooms.get(conn.roomCode) : undefined;
      if (!room) return;
      room.setConnected(token, false);
      deliver(room.broadcast([], false));
    });
  });

  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [code, room] of rooms) {
      if (room.connectedCount === 0 && now - room.lastActivity > IDLE_ROOM_MS) {
        rooms.delete(code);
        const clock = clocks.get(code);
        if (clock) clearTimeout(clock);
        clocks.delete(code);
        for (const [token, c] of tokenRoom) if (c === code) tokenRoom.delete(token);
      }
    }
  }, 60_000);
  sweep.unref();

  await new Promise<void>((resolve) => http.listen(options.port ?? 0, resolve));
  const address = http.address();
  const port = typeof address === "object" && address ? address.port : 0;

  return {
    port,
    http,
    rooms,
    close: () =>
      new Promise<void>((resolve) => {
        clearInterval(sweep);
        for (const t of botTimers) clearTimeout(t);
        for (const t of clocks.values()) clearTimeout(t);
        for (const client of wss.clients) client.terminate();
        wss.close(() => http.close(() => resolve()));
      }),
  };
}
