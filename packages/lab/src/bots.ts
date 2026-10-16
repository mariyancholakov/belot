import { BOTS, type BotParams, type BotPolicy } from "@belot/engine";

/** A bot from a spec like `bidder` or `bidder:samples=100,bidMargin=3`. */
export function parseBot(spec: string): BotPolicy {
  const [name, rest] = spec.split(":", 2) as [string, string | undefined];
  const make = BOTS[name];
  if (!make) throw new Error(`unknown bot "${name}"; known: ${Object.keys(BOTS).join(", ")}`);
  const params: BotParams = {};
  for (const pair of rest ? rest.split(",") : []) {
    const [key, value] = pair.split("=");
    if (!key || value === undefined || Number.isNaN(Number(value))) throw new Error(`bad parameter "${pair}" in "${spec}"`);
    params[key] = Number(value);
  }
  return make(params);
}
