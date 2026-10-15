import type { BidAction, Contract, GameView } from "@belot/engine";
import { bg, contractLabel } from "../i18n/bg";

const CONTRACTS: Contract[] = ["clubs", "diamonds", "hearts", "spades", "no-trumps", "all-trumps"];

export function bidText(bid: BidAction): string {
  switch (bid.type) {
    case "pass":
      return bg.pass;
    case "bid":
      return contractLabel(bid.contract);
    case "contra":
      return bg.contra;
    case "recontra":
      return bg.recontra;
  }
}

interface Props {
  view: GameView;
  names: string[];
  onBid: (bid: BidAction) => void;
}

export function Bidding({ view, names, onBid }: Props) {
  const legal = view.legalActions.flatMap((a) => (a.type === "bid" ? [a.bid] : []));
  const canBid = (contract: Contract) => legal.some((b) => b.type === "bid" && b.contract === contract);
  const has = (type: "pass" | "contra" | "recontra") => legal.some((b) => b.type === type);
  const myTurn = legal.length > 0;

  return (
    <section className="bidding" aria-label={bg.bidTitle}>
      <h2>{bg.bidTitle}</h2>
      <ol className="bid-log">
        {view.bidLog.length === 0 && <li className="muted">{bg.noBidsYet}</li>}
        {view.bidLog.map((entry, i) => (
          <li key={i}>
            <span>{names[entry.seat]}</span>
            <b>{bidText(entry.bid)}</b>
          </li>
        ))}
      </ol>
      {myTurn ? (
        <div className="bid-buttons">
          {CONTRACTS.map((c) => (
            <button key={c} className={`bid ${c === "hearts" || c === "diamonds" ? "red" : ""}`} disabled={!canBid(c)} onClick={() => onBid({ type: "bid", contract: c })}>
              {contractLabel(c)}
            </button>
          ))}
          <button className="bid ghost" disabled={!has("pass")} onClick={() => onBid({ type: "pass" })}>
            {bg.pass}
          </button>
          {has("contra") && (
            <button className="bid alert" onClick={() => onBid({ type: "contra" })}>
              {bg.contra}
            </button>
          )}
          {has("recontra") && (
            <button className="bid alert" onClick={() => onBid({ type: "recontra" })}>
              {bg.recontra}
            </button>
          )}
        </div>
      ) : (
        <p className="muted waiting">{bg.waitingFor(names[view.turn] ?? "")}</p>
      )}
    </section>
  );
}
