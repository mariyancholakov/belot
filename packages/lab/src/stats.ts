/** A mean with the half-width of its 95% confidence interval. */
export interface Estimate {
  mean: number;
  half: number;
  n: number;
}

const Z95 = 1.96;

export function meanEstimate(xs: readonly number[]): Estimate {
  const n = xs.length;
  if (n === 0) return { mean: 0, half: 0, n };
  const mean = xs.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, half: Infinity, n };
  const variance = xs.reduce((a, x) => a + (x - mean) ** 2, 0) / (n - 1);
  return { mean, half: Z95 * Math.sqrt(variance / n), n };
}

/** Share of successes out of `n`, with a normal-approximation interval. */
export function rateEstimate(successes: number, n: number): Estimate {
  if (n === 0) return { mean: 0, half: 0, n };
  const p = successes / n;
  return { mean: p, half: Z95 * Math.sqrt((p * (1 - p)) / n), n };
}
