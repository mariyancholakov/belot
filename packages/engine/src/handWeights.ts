import type { HandKind } from "./handModel";

/** Fitted by `pnpm --filter @belot/lab fit-hands` on 100000 deals; do not edit by hand. */
export const HAND_WEIGHTS: Record<HandKind, readonly number[]> = {
  suit: [-11.728, 0.104, 4.11, 2.146, 6.398, 1.62, 1.848, 2.684, 0.868, 0.766, 0.756, 1.803, 2.54, -0.418, 0.276, -0.052, 0.939, 1.465, 0.676, 0.001, 0.693],
  nt: [-18.601, 5.978, 0.789, 4.642, 2.627, 1.683, -0.1, 0.003, 6.82, -0.412, 6.864, -0.697],
  at: [-21.723, 6.206, 1.067, 2.532, 2.469, 1.187, 0.322, 2.916, 1.614, 6.544, 0, 6.57],
};
