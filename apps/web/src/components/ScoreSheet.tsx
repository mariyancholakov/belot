import type { GameView, RoundSummary } from "@belot/engine";
import { bg, contractLabel, isRed } from "../i18n/bg";
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

export function ScoreSheet({ view, mine }: { view: GameView; mine: 0 | 1 }) {
  const them = mine === 0 ? 1 : 0;
  return (
    <section className="score" aria-label={bg.scoreTitle}>
      <div className="score-row head">
        <span />
        <b>{bg.teamUs}</b>
        <b>{bg.teamThem}</b>
      </div>
      <div className="score-rows">
        {view.history.length === 0 && <p className="muted empty">{bg.noRoundsYet}</p>}
        {view.history.map((r) => (
          <div className="score-row" key={r.round}>
            <span className="what">
              <span className={isRed(r.contract as never) ? "red" : ""}>{contractLabel(r.contract)}</span>
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
          <AnimatedNumber value={view.scores[mine]} />
        </b>
        <b>
          <AnimatedNumber value={view.scores[them]} />
        </b>
      </div>
      {view.hanging > 0 && (
        <p className="muted hanging">
          {bg.hanging}: {view.hanging}
        </p>
      )}
    </section>
  );
}

