import { applyAction, chooseBotAction, newGame, viewFor, type GameAction, type GameEvent, type GameState } from "@belot/engine";
import { BOT_LEVEL_IDS, CARD_BACKS, type BotLevel, type CardBack, type ErrorCode, type RoomState, type ServerMessage } from "@belot/protocol";
import { tokenHash, type GameRecord } from "./store";

export interface Member {
  token: string;
  nickname: string;
  seat: number | null;
  connected: boolean;
  bot?: boolean;
}

/** What is written to disk so a table survives a server restart. */
export interface SavedRoom {
  code: string;
  host: string;
  cardBack: CardBack;
  /** Missing in tables saved before bot levels. */
  botLevel?: BotLevel;
  seq: number;
  members: Member[];
  seats: (string | null)[];
  game: GameState | null;
  /** Missing in tables saved before games were recorded. */
  actions?: { seat: number; action: GameAction }[];
  startedAt?: number | null;
  recorded?: boolean;
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
  cardBack: CardBack = "classic";
  botLevel: BotLevel = "normal";
  private seq = 0;
  lastActivity = Date.now();
  /** When the player to move runs out of time, as a timestamp; null while no clock runs. */
  turnEndsAt: number | null = null;
  /** Every action of the running game, so the finished game can be recorded and replayed. */
  private actions: { seat: number; action: GameAction }[] = [];
  private startedAt: number | null = null;
  /** The finished game has been handed out for recording. */
  private recorded = false;

  constructor(
    readonly code: string,
    hostToken: string,
    hostNickname: string,
    private readonly makeSeed: () => number,
  ) {
    this.host = hostToken;
    this.join(hostToken, hostNickname);
    this.takeSeat(hostToken, 0);
  }

  toJSON(): SavedRoom {
    return {
      code: this.code,
      host: this.host,
      cardBack: this.cardBack,
      botLevel: this.botLevel,
      seq: this.seq,
      members: [...this.members.values()],
      seats: [...this.seats],
      game: this.game,
      actions: this.actions,
      startedAt: this.startedAt,
      recorded: this.recorded,
    };
  }

  /** A table read back from disk: nobody is connected yet, bots stay. */
  static restore(saved: SavedRoom, makeSeed: () => number): Room {
    const room = new Room(saved.code, saved.host, "", makeSeed);
    room.members.clear();
    for (const m of saved.members) room.members.set(m.token, { ...m, connected: m.bot === true });
    saved.seats.forEach((t, i) => (room.seats[i] = t));
    // a table saved before a back was retired falls back to the default one
    room.cardBack = (CARD_BACKS as readonly string[]).includes(saved.cardBack) ? saved.cardBack : "classic";
    room.botLevel = saved.botLevel && (BOT_LEVEL_IDS as readonly string[]).includes(saved.botLevel) ? saved.botLevel : "normal";
    room.seq = saved.seq;
    room.game = saved.game;
    room.host = saved.host;
    room.actions = saved.actions ?? [];
    room.startedAt = saved.startedAt ?? null;
    room.recorded = saved.recorded ?? false;
    return room;
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

  /** Host fills every empty seat with computer players, or just `seat`. */
  addBots(token: string, seat?: number): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host can add bots");
    if (this.game) throw new RoomError("game_running", "game already started");
    if (seat !== undefined) {
      if (this.seats[seat]) throw new RoomError("seat_taken", "seat is taken");
      this.seatBot(seat);
      this.touch();
      return;
    }
    const host = this.must(token);
    // Never leave the host without a seat: take the first free one before filling the rest.
    if (host.seat === null) {
      const free = this.seats.findIndex((s) => s === null);
      if (free >= 0) {
        this.seats[free] = token;
        host.seat = free;
      }
    }
    for (let seat = 0; seat < 4; seat++) if (!this.seats[seat]) this.seatBot(seat);
    this.touch();
  }

  /** A computer player sits in an empty seat, named with the lowest number no other bot has. */
  private seatBot(seat: number): void {
    const taken = new Set([...this.members.values()].filter((m) => m.bot).map((m) => m.nickname));
    let n = 1;
    while (taken.has(`Бот ${n}`)) n++;
    const botToken = `bot-${this.code}-${seat}`;
    this.members.set(botToken, { token: botToken, nickname: `Бот ${n}`, seat, connected: true, bot: true });
    this.seats[seat] = botToken;
  }

  /** Host sends every computer player away again (or only the one in `seat`), freeing their seats. */
  removeBots(token: string, only?: number): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host can remove bots");
    if (this.game) throw new RoomError("game_running", "game already started");
    for (let seat = 0; seat < 4; seat++) {
      if (only !== undefined && seat !== only) continue;
      const t = this.seats[seat];
      if (t && this.members.get(t)?.bot) {
        this.members.delete(t);
        this.seats[seat] = null;
      }
    }
    this.touch();
  }

  setCardBack(token: string, back: CardBack): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host picks the card back");
    if (this.game && this.game.phase !== "gameOver") throw new RoomError("game_running", "game already started");
    this.cardBack = back;
    this.touch();
  }

  setBotLevel(token: string, level: BotLevel): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host picks the bot level");
    if (this.game && this.game.phase !== "gameOver") throw new RoomError("game_running", "game already started");
    this.botLevel = level;
    this.touch();
  }

  /** The computer player whose turn it is, with the move it wants to make. */
  nextBotMove(): { token: string; action: GameAction } | null {
    const game = this.game;
    if (!game || game.phase === "gameOver" || game.phase === "roundEnd") return null;
    const token = this.seats[game.turn];
    const member = token ? this.members.get(token) : undefined;
    if (!member?.bot) return null;
    const action = chooseBotAction(game, game.turn, this.botLevel);
    return action ? { token: member.token, action } : null;
  }

  /** The move the server plays for a human whose clock ran out. */
  autoMove(): { token: string; action: GameAction } | null {
    const game = this.game;
    if (!game || (game.phase !== "bidding" && game.phase !== "playing")) return null;
    const token = this.seats[game.turn];
    if (!token) return null;
    const action = chooseBotAction(game, game.turn);
    return action ? { token, action } : null;
  }

  /** Whether the clock should run: a human is to move in bidding or playing. */
  clockApplies(): boolean {
    const game = this.game;
    if (!game || (game.phase !== "bidding" && game.phase !== "playing")) return false;
    const token = this.seats[game.turn];
    const member = token ? this.members.get(token) : undefined;
    return !!member && !member.bot;
  }

  private turnLeft(): number | null {
    return this.turnEndsAt === null ? null : Math.max(0, this.turnEndsAt - Date.now());
  }

  start(token: string): void {
    this.must(token);
    if (token !== this.host) throw new RoomError("not_host", "only the host can start");
    if (this.game && this.game.phase !== "gameOver") throw new RoomError("game_running", "game already running");
    if (this.seats.some((s) => s === null)) throw new RoomError("need_four_players", "need four players");
    this.game = newGame(this.makeSeed(), 0);
    this.seq = 0;
    this.actions = [];
    this.startedAt = Date.now();
    this.recorded = false;
    this.touch();
  }

  act(token: string, action: GameAction): GameEvent[] {
    const member = this.must(token);
    if (!this.game) throw new RoomError("illegal_action", "no game running");
    if (member.seat === null) throw new RoomError("not_seated", "you are not seated");
    const result = applyAction(this.game, member.seat, action);
    if (!result.ok) throw new RoomError("illegal_action", result.error);
    this.game = result.state;
    this.actions.push({ seat: member.seat, action });
    this.seq += 1;
    this.touch();
    return result.events;
  }

  /** The game just finished, once: who sat where, the result and every action. Null otherwise. */
  takeFinishedGame(version: string | null): GameRecord | null {
    const game = this.game;
    if (!game || game.phase !== "gameOver" || game.winner === null || this.recorded) return null;
    this.recorded = true;
    const players = this.seats.map((t, seat) => {
      const m = t ? this.members.get(t) : undefined;
      const bot = m?.bot === true;
      return { seat, nickname: m?.nickname ?? "", bot, token: t && !bot ? tokenHash(t) : null };
    });
    return {
      roomCode: this.code,
      startedAt: new Date(this.startedAt ?? Date.now()),
      seed: game.seed,
      players,
      botLevel: players.some((p) => p.bot) ? this.botLevel : null,
      scores: game.scores,
      winner: game.winner,
      rounds: game.history,
      actions: this.actions,
      version,
    };
  }

  roomStateFor(token: string): RoomState {
    const member = this.members.get(token);
    return {
      code: this.code,
      seats: this.seats.map((t) => {
        const m = t ? this.members.get(t) : undefined;
        return m ? { nickname: m.nickname, connected: m.connected, bot: m.bot === true } : null;
      }),
      watchers: [...this.members.values()].filter((m) => m.seat === null && m.connected).map((m) => m.nickname),
      host: this.members.get(this.host)?.nickname ?? "",
      started: this.game !== null,
      you: member?.seat ?? null,
      youAreHost: token === this.host,
      cardBack: this.cardBack,
      botLevel: this.botLevel,
    };
  }

  /** Everything a client needs to be fully in sync (used on join and reconnect). */
  snapshotFor(token: string): ServerMessage[] {
    const messages: ServerMessage[] = [{ type: "roomState", room: this.roomStateFor(token) }];
    const member = this.members.get(token);
    if (this.game && member?.seat != null) {
      messages.push({ type: "update", seq: this.seq, view: viewFor(this.game, member.seat), events: [], turnLeftMs: this.turnLeft() });
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
          message: { type: "update", seq: this.seq, view: viewFor(this.game, member.seat), events, turnLeftMs: this.turnLeft() },
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
