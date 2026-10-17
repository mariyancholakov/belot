import type { RoundSummary } from "@belot/engine";
import { bg, contractLabel } from "../i18n/bg";
import { SuitText } from "./SuitText";
import { AnimatedNumber } from "./AnimatedNumber";

function badges(r: RoundSummary): string[] {
  const out: string[] = [];
  if (r.result.outcome === "inside") out.push(bg.inside);
  if (r.result.outcome === "tie") out.push(bg.hanging);
  if (r.capo !== null) out.push(bg.capo);
  if (r.multiplier === 2) out.push(bg.contra);
  if (r.multiplier === 4) out.push(bg.recontra);
  return out;
}

interface Props {
  rounds: readonly RoundSummary[];
  scores: readonly [number, number];
  /** Points left hanging for the next round. */
  hanging: number;
  mine: 0 | 1;
}

export function ScoreSheet({ rounds, scores, hanging, mine }: Props) {
  const them = mine === 0 ? 1 : 0;
  return (
    <section className="score" aria-label={bg.scoreTitle}>
      <div className="score-row head">
        <span />
        <b>{bg.teamUs}</b>
        <b>{bg.teamThem}</b>
      </div>
      <div className="score-rows">
        {rounds.length === 0 && <p className="muted empty">{bg.noRoundsYet}</p>}
        {rounds.map((r) => (
          <div className="score-row" key={r.round}>
            <span className="what">
              <span><SuitText text={contractLabel(r.contract)} /></span>
              {badges(r).map((b) => (
                <em key={b}>{b}</em>
              ))}
            </span>
            <span className={r.result.recorded[mine] > 0 ? "num got" : "num"}>{r.result.recorded[mine]}</span>
            <span className={r.result.recorded[them] > 0 ? "num got" : "num"}>{r.result.recorded[them]}</span>
          </div>
        ))}
      </div>
      <div className="score-row total">
        <span>{bg.total}</span>
        <b>
          <AnimatedNumber value={scores[mine]} />
        </b>
        <b>
          <AnimatedNumber value={scores[them]} />
        </b>
      </div>
      {hanging > 0 && (
        <p className="muted hanging">
          {bg.hanging}: {hanging}
        </p>
      )}
    </section>
  );
}

