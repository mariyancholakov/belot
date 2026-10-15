import { describe, expect, it } from "vitest";
import { clientMessageSchema } from "./index";

const token = "a".repeat(24);

describe("clientMessageSchema", () => {
  it("accepts a valid hello and trims the nickname", () => {
    const r = clientMessageSchema.parse({ type: "hello", token, nickname: "  Иван " });
    expect(r).toMatchObject({ nickname: "Иван" });
  });

  it("normalises room codes to upper case", () => {
    expect(clientMessageSchema.parse({ type: "joinRoom", code: "abcd" })).toEqual({ type: "joinRoom", code: "ABCD" });
  });

  it("rejects bad tokens, seats, cards and unknown types", () => {
    expect(clientMessageSchema.safeParse({ type: "hello", token: "short", nickname: "x" }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "takeSeat", seat: 4 }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "action", action: { type: "play", card: { suit: "x", rank: "A" } } }).success).toBe(false);
    expect(clientMessageSchema.safeParse({ type: "nope" }).success).toBe(false);
  });

  it("accepts game actions", () => {
    expect(clientMessageSchema.safeParse({ type: "action", action: { type: "bid", bid: { type: "bid", contract: "hearts" } } }).success).toBe(true);
    expect(clientMessageSchema.safeParse({ type: "action", action: { type: "play", card: { suit: "hearts", rank: "A" } } }).success).toBe(true);
  });
});
