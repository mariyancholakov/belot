/** Least squares with a small ridge penalty (the bias, column 0, is not penalised). */
export function solveRidge(x: readonly (readonly number[])[], y: readonly number[], lambda: number): number[] {
  const n = x[0]!.length;
  const a = Array.from({ length: n }, () => new Array<number>(n + 1).fill(0));
  x.forEach((row, i) => {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) a[j]![k]! += row[j]! * row[k]!;
      a[j]![n]! += row[j]! * y[i]!;
    }
  });
  for (let j = 1; j < n; j++) a[j]![j]! += lambda;
  // Gaussian elimination with partial pivoting.
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(a[r]![col]!) > Math.abs(a[pivot]![col]!)) pivot = r;
    [a[col], a[pivot]] = [a[pivot]!, a[col]!];
    const p = a[col]![col]!;
    if (Math.abs(p) < 1e-12) continue;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const f = a[r]![col]! / p;
      if (f === 0) continue;
      for (let k = col; k <= n; k++) a[r]![k]! -= f * a[col]![k]!;
    }
  }
  return a.map((row, i) => (Math.abs(row[i]!) < 1e-12 ? 0 : row[n]! / row[i]!));
}
