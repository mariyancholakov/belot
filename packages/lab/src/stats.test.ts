import { describe, expect, it } from "vitest";
import { meanEstimate, rateEstimate } from "./stats";

describe("stats", () => {
  it("estimates a mean and its 95% interval", () => {
    const e = meanEstimate([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(e.mean).toBe(5);
    expect(e.half).toBeCloseTo(1.96 * Math.sqrt(32 / 7 / 8), 10);
    expect(meanEstimate([]).n).toBe(0);
  });

  it("estimates a rate", () => {
    const e = rateEstimate(30, 100);
    expect(e.mean).toBeCloseTo(0.3);
    expect(e.half).toBeCloseTo(1.96 * Math.sqrt(0.21 / 100), 10);
  });
});
