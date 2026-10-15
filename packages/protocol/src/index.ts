import { z } from "zod";
import type { GameEvent, GameView } from "@belot/engine";

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
  z.object({ type: z.literal("play"), card }),
  z.object({ type: z.literal("nextRound") }),
  z.object({ type: z.literal("cut"), position: z.number().int().min(1).max(31) }),
]);

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
  z.object({ type: z.literal("startGame") }),
  z.object({ type: z.literal("action"), action: gameActionSchema }),
]);

export type ClientMessage = z.infer<typeof clientMessageSchema>;

export interface SeatInfo {
  nickname: string;
  connected: boolean;
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
  | "rate_limited";

/** Messages the server sends. */
export type ServerMessage =
  | { type: "roomState"; room: RoomState | null }
  | { type: "update"; seq: number; view: GameView; events: GameEvent[] }
  | { type: "error"; code: ErrorCode; message: string };
