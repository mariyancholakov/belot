import type { HandKind } from "./handModel";

/** Fitted by `pnpm --filter @belot/lab fit-hands` on 100000 deals; do not edit by hand. */
export const HAND_WEIGHTS: Record<HandKind, readonly number[]> = {
  suit: [-11.759, 0.225, 4.183, 2.084, 6.712, 1.627, 1.828, 2.685, 0.774, 0.745, 0.672, 1.758, 2.53, -0.366, 0.3, -0.014, 0.907, 1.493, 0.71, 0.001, 0.727],
  nt: [-19.909, 5.14, 0.96, 4.568, 2.761, 2.019, 0.327, 3.129, 6.353, -0.404, 6.389, -0.662],
  at: [-21.647, 6.162, 1.092, 2.52, 2.432, 1.203, 0.32, 2.878, 1.676, 6.514, 0, 6.54],
};
