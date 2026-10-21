import { useRef, useState } from "react";
import { bg } from "../i18n/bg";

export type Pos = "bottom" | "right" | "top" | "left";

export type Stage =
  | { kind: "shuffle" }
  | { kind: "wait" }
  /** The 12 cards left over while bidding. */
  | { kind: "talon" }
  | { kind: "cut"; position: number }
  | { kind: "deal"; rest: boolean; order: Pos[] };

/** A pile of card backs drawn as a few offset layers. */
function Pile({ cards, className = "" }: { cards: number; className?: string }) {
  const layers = Math.max(3, Math.round(cards / 2.2));
  return (
    <div className={`pile ${className}`}>
      {Array.from({ length: layers }, (_, i) => {
        // A deck that has been handled: every card sits a little off, deterministically so it does not jump on re-render.
        const dx = (((i * 53 + 7) % 9) - 4) * 0.9;
        const rot = (((i * 37 + 3) % 11) - 5) * 0.9;
        return <i key={i} className="pile-card" style={{ transform: `translate(calc(-50% + ${dx}px), calc(-50% - ${i * 1.4}px)) rotate(${rot}deg)` }} />;
      })}
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
      {stage.kind === "talon" && <Pile cards={12} />}
      {stage.kind === "cut" && (
        <div className="cut-group">
          <Pile cards={32 - stage.position} className="cut-bottom" />
          <Pile cards={stage.position} className="cut-top" />
        </div>
      )}
      {stage.kind === "deal" && (
        <>
          <Pile cards={stage.rest ? 12 : 32} className="deal-pile" />
          {dealPackets(stage.rest).map((size, p) => (
            <div key={p} className={`fly ${stage.order[p % 4]}`} style={{ animationDelay: `${p * DEAL_GAP}ms` }}>
              {Array.from({ length: size }, (_, j) => (
                <i key={j} className="fly-card" style={{ transform: `translate(calc(-50% + ${j * 5}px), calc(-50% - ${j * 3}px))` }} />
              ))}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

/**
 * A deal is made in packets: 3 cards to each player, then 2 each (first deal), or 3 each (the rest).
 * Returns the packet sizes in dealing order; packet p goes to the p % 4-th player after the dealer.
 */
export const dealPackets = (rest: boolean): number[] => (rest ? [3, 3, 3, 3] : [3, 3, 3, 3, 2, 2, 2, 2]);

/** Milliseconds between two packets leaving the deck, and how long one takes to arrive. */
export const DEAL_GAP = 340;
export const DEAL_FLY = 470;

interface PickerProps {
  onCut: (position: number) => void;
}

/** The cutter points along the deck, which opens a gap where it would split; letting go (or a click) cuts there. */
export function CutPicker({ onCut }: PickerProps) {
  // A finger slides along the deck and cuts where it lifts; a mouse shows the split as it hovers and cuts on click.
  const [position, setPosition] = useState<number | null>(null);
  const spread = useRef<HTMLDivElement>(null);
  const pressed = useRef(false);
  const done = useRef(false);
  const at = (clientX: number): number | null => {
    const box = spread.current?.getBoundingClientRect();
    if (!box) return null;
    return Math.min(31, Math.max(1, Math.ceil(((clientX - box.left) / box.width) * 32)));
  };
  const cut = (n: number) => {
    if (done.current) return;
    done.current = true;
    onCut(n);
  };
  const point = (clientX: number) => {
    const next = at(clientX);
    if (next !== null && next !== position) setPosition(next);
  };
  return (
    <div className="cut-table cut-picker">
      <p className="cut-hint">{bg.cutHint}</p>
      <div
        className="spread"
        ref={spread}
        onPointerDown={(e) => {
          pressed.current = true;
          // the deck keeps following the finger even when it slides off the cards
          e.currentTarget.setPointerCapture(e.pointerId);
          point(e.clientX);
        }}
        onPointerMove={(e) => (pressed.current || e.pointerType === "mouse") && point(e.clientX)}
        onPointerUp={(e) => {
          if (!pressed.current) return;
          pressed.current = false;
          const n = at(e.clientX);
          if (n !== null) cut(n);
        }}
        onPointerCancel={() => {
          pressed.current = false;
          setPosition(null);
        }}
        onPointerLeave={() => !pressed.current && setPosition(null)}
      >
        {Array.from({ length: 32 }, (_, i) => (
          <i
            key={i}
            className={`spread-card ${position === null ? "" : i < position ? "left" : "right"} ${i === (position ?? 0) - 1 ? "edge" : ""}`}
            style={{ ["--i" as string]: i, ["--j" as string]: `${(((i * 37 + 3) % 7) - 3) * 0.8}deg`, ["--y" as string]: `${(((i * 53 + 5) % 5) - 2) * 1.2}px` }}
          />
        ))}
        <input
          type="range"
          min={1}
          max={31}
          value={position ?? 16}
          aria-label={bg.cutLabel}
          aria-valuetext={bg.cutSplit(position ?? 16)}
          onChange={(e) => setPosition(Number(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") cut(position ?? 16);
          }}
        />
      </div>
      <p className="cut-count" style={{ visibility: position === null ? "hidden" : "visible" }}>
        {bg.cutSplit(position ?? 16)}
      </p>
    </div>
  );
}

interface ChoiceProps {
  onChoose: (choice: boolean) => void;
}

/** After three all-pass deals in a row the dealer may shuffle. */
export function ShufflePrompt({ onChoose }: ChoiceProps) {
  return (
    <section className="felt-pop prompt" aria-label={bg.shuffleTitle}>
      <h2>{bg.shuffleTitle}</h2>
      <p className="muted">{bg.shuffleHint}</p>
      <div className="prompt-actions">
        <button className="primary" onClick={() => onChoose(true)}>
          {bg.shuffleDo}
        </button>
        <button className="secondary" onClick={() => onChoose(false)}>
          {bg.shuffleSkip}
        </button>
      </div>
    </section>
  );
}

/** The dealer deals normally or with a "късметче" (their partner's first card thrown face up). */
export function DealPrompt({ onDeal }: { onDeal: (lucky: boolean) => void }) {
  return (
    <section className="felt-pop prompt" aria-label={bg.luckyAsk}>
      <h2>{bg.luckyAsk}</h2>
      <div className="prompt-actions">
        <button className="primary" onClick={() => onDeal(true)}>
          {bg.yes}
        </button>
        <button className="secondary" onClick={() => onDeal(false)}>
          {bg.no}
        </button>
      </div>
    </section>
  );
}
