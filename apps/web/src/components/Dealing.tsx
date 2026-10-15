import { useState } from "react";
import { bg } from "../i18n/bg";
import { playSound } from "../sound";

export type Pos = "bottom" | "right" | "top" | "left";

export type Stage =
  | { kind: "shuffle" }
  | { kind: "wait" }
  | { kind: "cut"; position: number }
  | { kind: "deal"; rest: boolean; order: Pos[] };

/** A pile of card backs drawn as a few offset layers. */
function Pile({ cards, className = "" }: { cards: number; className?: string }) {
  const layers = Math.max(2, Math.round(cards / 3));
  return (
    <div className={`pile ${className}`}>
      {Array.from({ length: layers }, (_, i) => (
        <i key={i} className="pile-card" style={{ transform: `translate(-50%, calc(-50% - ${i * 1.4}px))` }} />
      ))}
    </div>
  );
}

const RIFFLE_CARDS = 16;

/** The deck on the felt: riffle shuffle, waiting, the cut, and the cards flying to each player. */
export function DeckStage({ stage }: { stage: Stage }) {
  return (
    <div className="deck-stage" aria-hidden="true">
      {stage.kind === "shuffle" && (
        <div className="shuffle">
          <Pile cards={16} className="half left" />
          <Pile cards={16} className="half right" />
          {Array.from({ length: RIFFLE_CARDS }, (_, i) => (
            <i
              key={i}
              className={`riffle-card ${i % 2 === 0 ? "from-left" : "from-right"}`}
              style={{ animationDelay: `${i * 55 + 120}ms`, ["--lift" as string]: `${i * 0.9}px` }}
            />
          ))}
        </div>
      )}
      {stage.kind === "wait" && <Pile cards={32} />}
      {stage.kind === "cut" && (
        <div className="cut-group">
          <Pile cards={32 - stage.position} className="cut-bottom" />
          <Pile cards={stage.position} className="cut-top" />
        </div>
      )}
      {stage.kind === "deal" && (
        <>
          <Pile cards={stage.rest ? 12 : 32} className="deal-pile" />
          {Array.from({ length: dealTotal(stage.rest) }, (_, k) => (
            <i key={k} className={`fly ${stage.order[dealTarget(k, stage.rest)]}`} style={{ animationDelay: `${k * DEAL_GAP}ms` }} />
          ))}
        </>
      )}
    </div>
  );
}

/** Cards dealt in the first deal (3 then 2 each) or the second (3 each). */
export const dealTotal = (rest: boolean) => (rest ? 12 : 20);

/** Index (0-3, in dealing order) of the player who receives the k-th card. */
export const dealTarget = (k: number, rest: boolean) => (rest || k < 12 ? Math.floor(k / 3) : Math.floor((k - 12) / 2));

/** Milliseconds between two cards leaving the deck, and how long one takes to arrive. */
export const DEAL_GAP = 95;
export const DEAL_FLY = 430;

interface PickerProps {
  onCut: (position: number) => void;
}

/** The cutter chooses where to split the deck: a spread of the whole deck with a draggable cut point. */
export function CutPicker({ onCut }: PickerProps) {
  const [position, setPosition] = useState(16);
  const confirm = () => {
    playSound("tap");
    onCut(position);
  };
  return (
    <section className="sheet-panel cut-picker" aria-label={bg.cutTitle}>
      <h2>{bg.cutTitle}</h2>
      <p className="muted">{bg.cutHint}</p>
      <div className="spread" style={{ ["--n" as string]: 32 }}>
        {Array.from({ length: 32 }, (_, i) => (
          <i key={i} className={`spread-card ${i < position ? "lifted" : ""} ${i === position - 1 ? "edge" : ""}`} style={{ ["--i" as string]: i }} />
        ))}
        <input
          type="range"
          min={1}
          max={31}
          value={position}
          aria-label={bg.cutLabel}
          aria-valuetext={bg.cutSplit(position)}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (next !== position) playSound("tap");
            setPosition(next);
          }}
        />
      </div>
      <p className="cut-count">{bg.cutSplit(position)}</p>
      <button className="primary" onClick={confirm}>
        {bg.cutConfirm}
      </button>
    </section>
  );
}
