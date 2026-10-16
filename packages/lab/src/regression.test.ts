import { describe, expect, it } from "vitest";
import { solveRidge } from "./regression";

describe("ridge regression", () => {
  it("recovers the weights of an exact linear relation", () => {
    const x: number[][] = [];
    const y: number[] = [];
    for (let i = 0; i < 50; i++) {
      const row = [1, i % 7, (i * 3) % 11, i % 2];
      x.push(row);
      y.push(2 + 0.5 * row[1]! - 1.5 * row[2]! + 3 * row[3]!);
    }
    solveRidge(x, y, 0).forEach((w, i) => expect(w).toBeCloseTo([2, 0.5, -1.5, 3][i]!, 8));
  });
});
