import { applyAction, chooseBotAction, newGame, viewFor, type GameAction, type GameEvent, type GameState } from "@belot/engine";
import type { ErrorCode, RoomState, ServerMessage } from "@belot/protocol";

interface Member {
  token: string;
  nickname: string;
  seat: number | null;
  connected: boolean;
  bot?: boolean;
}

export type Outgoing = { token: string; message: ServerMessage };

export class RoomError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
  }
}

/** A table: who sits where and the running game. Knows nothing about sockets. */
export class Room {
  readonly members = new Map<string, Member>();
  readonly seats: (string | null)[] = [null, null, null, null];
  game: GameState | null = null;
  host: string;
  private seq = 0;
  lastActivity = Date.now();

  constructor(
    readonly code: string,
    hostToken: string,
    hostNickname: string,
    private readonly makeSeed: () => number,
  ) {
    this.host = hostToken;
    this.join(hostToken, hostNickname);
  }

  join(token: string, nickname: string): void {
    const existing = this.members.get(token);
    if (existing) {
      existing.nickname = nickname;
      existing.connected = true;
    } else {
      this.members.set(token, { token, nickname, seat: null, connected: true });
    }
    this.touch();
  }

  /** A client left the room for good (not just a dropped connection). */
  leave(token: string): void {
    const member = this.members.get(token);
    if (!member) return;
    if (member.seat !== null && this.game) {
      // Mid-game the seat is kept so the player can come back.
      member.connected = false;
      this.touch();
      return;
    }
    if (member.seat !== null) this.seats[member.seat] = null;
    this.members.delete(token);
    if (this.host === token) {
      this.host = [...this.members.values()].find((m) => !m.bot)?.token ?? token;
    }
    this.touch();
  }

  setConnected(token: string, connected: boolean): void {
    const member = this.members.get(token);
    if (member) member.connected = connected;
    this.touch();
  }

  takeSeat(token: string, seat: number): void {
    const member = this.must(token);
    if (this.game) throw new RoomError("game_running", "game already started");
    if (this.seats[seat] && this.seats[seat] !== token) throw new RoomError("seat_taken", "seat is taken");
    if (member.seat !== null) this.seats[member.seat] = null;
    this.seats[seat] = token;
    member.seat = seat;
    this.touch();
  }

  leaveSeat(token: string): void {
    const member = this.must(token);
    if (this.game) throw new RoomError("game_running", "game already started");
    if (member.seat !== null) this.seats[member.seat] = null;
    member.seat = null;
    this.touch();
  }

  /** Host fills every empty seat with computer players. */
  addBots(token: string): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host can add bots");
    if (this.game) throw new RoomError("game_running", "game already started");
    let n = 0;
    for (let seat = 0; seat < 4; seat++) {
      if (this.seats[seat]) continue;
      const botToken = `bot-${this.code}-${seat}`;
      this.members.set(botToken, { token: botToken, nickname: `Бот ${++n}`, seat, connected: true, bot: true });
      this.seats[seat] = botToken;
    }
    this.touch();
  }

  /** The computer player whose turn it is, with the move it wants to make. */
  nextBotMove(): { token: string; action: GameAction } | null {
    const game = this.game;
    if (!game || game.phase === "gameOver" || game.phase === "roundEnd") return null;
    const token = this.seats[game.turn];
    const member = token ? this.members.get(token) : undefined;
    if (!member?.bot) return null;
    const action = chooseBotAction(game, game.turn);
    return action ? { token: member.token, action } : null;
  }

  start(token: string): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host can start");
    if (this.game && this.game.phase !== "gameOver") throw new RoomError("game_running", "game already running");
    if (this.seats.some((s) => s === null)) throw new RoomError("need_four_players", "need four players");
    this.game = newGame(this.makeSeed(), 0);
    this.seq = 0;
    this.touch();
  }

  act(token: string, action: GameAction): GameEvent[] {
    const member = this.must(token);
    if (!this.game) throw new RoomError("illegal_action", "no game running");
    if (member.seat === null) throw new RoomError("not_seated", "you are not seated");
    const result = applyAction(this.game, member.seat, action);
    if (!result.ok) throw new RoomError("illegal_action", result.error);
    this.game = result.state;
    this.seq += 1;
    this.touch();
    return result.events;
  }

  roomStateFor(token: string): RoomState {
    const member = this.members.get(token);
    return {
      code: this.code,
      seats: this.seats.map((t) => {
        const m = t ? this.members.get(t) : undefined;
        return m ? { nickname: m.nickname, connected: m.connected } : null;
      }),
      watchers: [...this.members.values()].filter((m) => m.seat === null && m.connected).map((m) => m.nickname),
      host: this.members.get(this.host)?.nickname ?? "",
      started: this.game !== null,
      you: member?.seat ?? null,
      youAreHost: token === this.host,
    };
  }

  /** Everything a client needs to be fully in sync (used on join and reconnect). */
  snapshotFor(token: string): ServerMessage[] {
    const messages: ServerMessage[] = [{ type: "roomState", room: this.roomStateFor(token) }];
    const member = this.members.get(token);
    if (this.game && member?.seat != null) {
      messages.push({ type: "update", seq: this.seq, view: viewFor(this.game, member.seat), events: [] });
    }
    return messages;
  }

  /** Messages for every connected member after a change. */
  broadcast(events: GameEvent[], includeUpdate: boolean): Outgoing[] {
    const out: Outgoing[] = [];
    for (const member of this.members.values()) {
      if (!member.connected) continue;
      out.push({ token: member.token, message: { type: "roomState", room: this.roomStateFor(member.token) } });
      if (includeUpdate && this.game && member.seat !== null) {
        out.push({
          token: member.token,
          message: { type: "update", seq: this.seq, view: viewFor(this.game, member.seat), events },
        });
      }
    }
    return out;
  }

  get connectedCount(): number {
    return [...this.members.values()].filter((m) => m.connected && !m.bot).length;
  }

  private must(token: string): Member {
    const member = this.members.get(token);
    if (!member) throw new RoomError("not_in_room", "not in this room");
    return member;
  }

  private touch(): void {
    this.lastActivity = Date.now();
  }
}
