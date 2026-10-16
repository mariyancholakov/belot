import type { BidAction, Contract, GameView } from "@belot/engine";
import { bg, contractLabel, suitName, suitSymbol } from "../i18n/bg";
import { playSound } from "../sound";

const SUITS: Contract[] = ["clubs", "diamonds", "hearts", "spades"];

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
  const act = (bid: BidAction) => {
    playSound("tap");
    onBid(bid);
  };

  return (
    <section className="felt-pop bidding" aria-label={bg.bidTitle}>
      <div className="bidding-head">
        <h2>{bg.bidTitle}</h2>
        <ol className="bid-log">
          {view.bidLog.length === 0 && <li className="muted">{bg.noBidsYet}</li>}
          {view.bidLog.map((entry, i) => (
            <li key={i}>
              <span>{names[entry.seat]}</span> <b>{bidText(entry.bid)}</b>
            </li>
          ))}
        </ol>
      </div>
      {myTurn ? (
        <div className="bid-grid">
          <div className="bid-col">
            {SUITS.map((c) => (
              <button key={c} className={`bid suit ${c === "hearts" || c === "diamonds" ? "red" : ""}`} disabled={!canBid(c)} onClick={() => act({ type: "bid", contract: c })} aria-label={contractLabel(c)}>
                <span className="sym" aria-hidden="true">{suitSymbol[c as keyof typeof suitSymbol]}</span>
                <span className="lbl" aria-hidden="true">{suitName[c as keyof typeof suitName]}</span>
              </button>
            ))}
          </div>
          <div className="bid-col">
            <button className="bid wide" disabled={!canBid("no-trumps")} onClick={() => act({ type: "bid", contract: "no-trumps" })}>
              {contractLabel("no-trumps")}
            </button>
            <button className="bid wide" disabled={!canBid("all-trumps")} onClick={() => act({ type: "bid", contract: "all-trumps" })}>
              {contractLabel("all-trumps")}
            </button>
            <button className="bid alert wide" disabled={!has("contra")} onClick={() => act({ type: "contra" })}>
              {bg.contra}
            </button>
            <button className="bid alert wide" disabled={!has("recontra")} onClick={() => act({ type: "recontra" })}>
              {bg.recontra}
            </button>
          </div>
          <button className="bid pass" disabled={!has("pass")} onClick={() => act({ type: "pass" })}>
            {bg.pass}
          </button>
        </div>
      ) : (
        <p className="muted waiting">{bg.waitingFor(names[view.turn] ?? "")}</p>
      )}
    </section>
  );
}
