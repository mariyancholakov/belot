import type { GameView, RoundSummary } from "@belot/engine";
import { bg, contractLabel } from "../i18n/bg";

function note(r: RoundSummary): string {
  const parts: string[] = [];
  if (r.result.outcome === "inside") parts.push(bg.inside);
  if (r.result.outcome === "tie") parts.push(bg.tie);
  if (r.capo !== null) parts.push(bg.capo);
  if (r.multiplier === 2) parts.push(bg.contra);
  if (r.multiplier === 4) parts.push(bg.recontra);
  return parts.join(" · ");
}

/** Score as a paper sheet, the way it is kept at a real table. `mine` = my team (0 or 1). */
export function ScoreSheet({ view, mine }: { view: GameView; mine: 0 | 1 }) {
  const them = mine === 0 ? 1 : 0;
  return (
    <section className="sheet" aria-label={bg.scoreSheet}>
      <header>
        <span />
        <b>{bg.teamUs}</b>
        <b>{bg.teamThem}</b>
      </header>
      <div className="rows">
        {view.history.map((r) => (
          <div className="row" key={r.round}>
            <span className="what">
              <i>{contractLabel(r.contract)}</i>
              <small>{note(r)}</small>
            </span>
            <span>{r.result.recorded[mine]}</span>
            <span>{r.result.recorded[them]}</span>
          </div>
        ))}
      </div>
      <footer>
        <span>{bg.score}</span>
        <b>{view.scores[mine]}</b>
        <b>{view.scores[them]}</b>
      </footer>
      {view.hanging > 0 && (
        <p className="muted">
          {bg.hanging}: {view.hanging}
        </p>
      )}
    </section>
  );
}
