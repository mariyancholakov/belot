import { z } from "zod";
import type { GameEvent, GameView, RoundSummary } from "@belot/engine";

const suit = z.enum(["clubs", "diamonds", "hearts", "spades"]);
const rank = z.enum(["7", "8", "9", "10", "J", "Q", "K", "A"]);
const card = z.object({ suit, rank });
const contract = z.enum(["clubs", "diamonds", "hearts", "spades", "no-trumps", "all-trumps"]);

const bidAction = z.discriminatedUnion("type", [
  z.object({ type: z.literal("pass") }),
  z.object({ type: z.literal("bid"), contract }),
  z.object({ type: z.literal("contra") }),
  z.object({ type: z.literal("recontra") }),
]);

export const gameActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("bid"), bid: bidAction }),
  z.object({ type: z.literal("play"), card, belot: z.boolean().optional() }),
  z.object({ type: z.literal("announce"), declare: z.boolean() }),
  z.object({ type: z.literal("claim"), belot: z.boolean().optional() }),
  z.object({ type: z.literal("nextRound") }),
  z.object({ type: z.literal("cut"), position: z.number().int().min(1).max(31) }),
  z.object({ type: z.literal("shuffle") }),
  z.object({ type: z.literal("skipShuffle") }),
  z.object({ type: z.literal("deal"), lucky: z.boolean() }),
]);

/** The designs on the back of the cards; the host picks one before the game starts. */
export const CARD_BACKS = ["classic", "noir", "ivory", "graphite"] as const;
export type CardBack = (typeof CARD_BACKS)[number];

/** How strong the computer players are; the host picks it before the game starts. */
export const BOT_LEVEL_IDS = ["easy", "normal", "hard"] as const;
export type BotLevel = (typeof BOT_LEVEL_IDS)[number];

export const TOKEN_RE = /^[A-Za-z0-9_-]{16,64}$/;

/** Messages a client may send. */
export const clientMessageSchema = z.discriminatedUnion("type", [
  /** First message on every connection: who am I. */
  z.object({
    type: z.literal("hello"),
    token: z.string().regex(TOKEN_RE),
    nickname: z.string().trim().min(1).max(20),
  }),
  z.object({ type: z.literal("createRoom") }),
  z.object({ type: z.literal("joinRoom"), code: z.string().trim().toUpperCase().length(4) }),
  z.object({ type: z.literal("leaveRoom") }),
  z.object({ type: z.literal("takeSeat"), seat: z.number().int().min(0).max(3) }),
  z.object({ type: z.literal("leaveSeat") }),
  z.object({ type: z.literal("addBots") }),
  z.object({ type: z.literal("removeBots") }),
  z.object({ type: z.literal("setCardBack"), back: z.enum(CARD_BACKS) }),
  z.object({ type: z.literal("setBotLevel"), level: z.enum(BOT_LEVEL_IDS) }),
  z.object({ type: z.literal("startGame") }),
  z.object({ type: z.literal("action"), action: gameActionSchema }),
  /** The finished games this player sat in, newest first. */
  z.object({ type: z.literal("getHistory") }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface SeatInfo {
  nickname: string;
  connected: boolean;
  /** A computer player. */
  bot: boolean;
}

export interface RoomState {
  code: string;
  /** Seat info by seat number, null when empty. */
  seats: (SeatInfo | null)[];
  /** Nicknames of connected people not sitting at the table. */
  watchers: string[];
  host: string;
  started: boolean;
  /** The receiving client's own seat, or null when watching. */
  you: number | null;
  youAreHost: boolean;
  /** Design on the back of the cards. */
  cardBack: CardBack;
  botLevel: BotLevel;
}

export type ErrorCode =
  | "bad_message"
  | "no_hello"
  | "room_not_found"
  | "not_in_room"
  | "seat_taken"
  | "not_seated"
  | "not_host"
  | "need_four_players"
  | "game_running"
  | "illegal_action"
  | "rate_limited"
  | "unavailable";

/** A finished game as one of its players sees it in the history. */
export interface HistoryGame {
  id: string;
  /** ISO time. */
  finishedAt: string;
  /** By seat; partners sit opposite (0 and 2, 1 and 3). */
  players: { nickname: string; bot: boolean }[];
  /** The seat this player had. */
  seat: number;
  scores: [number, number];
  winner: 0 | 1;
  rounds: RoundSummary[];
}

/** Messages the server sends. */
export type ServerMessage =
  | { type: "roomState"; room: RoomState | null }
  /** `turnLeftMs`: time the player to move has left before the server plays for them, null when no clock runs. */
  | { type: "update"; seq: number; view: GameView; events: GameEvent[]; turnLeftMs: number | null }
  | { type: "history"; games: HistoryGame[] }
  | { type: "error"; code: ErrorCode; message: string };
