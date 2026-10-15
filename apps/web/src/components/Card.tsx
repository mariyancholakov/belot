import type { Card as CardData } from "@belot/engine";
import { isRed, rankLabel, suitName, suitSymbol } from "../i18n/bg";

interface Props {
  card: CardData;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  highlight?: boolean;
  /** Stagger for the deal animation, in ms. */
  delay?: number;
  deal?: boolean;
}

export function CardFace({ card, onClick, disabled, small, highlight, delay, deal }: Props) {
  const cls = ["card", isRed(card.suit) ? "red" : "black", small ? "small" : "", disabled ? "dim" : "", highlight ? "winner" : "", deal ? "deal" : ""]
    .filter(Boolean)
    .join(" ");
  const label = `${rankLabel[card.rank]} ${suitName[card.suit]}`;
  const style = delay ? { animationDelay: `${delay}ms` } : undefined;
  const inner = (
    <>
      <span className="index">
        <b>{rankLabel[card.rank]}</b>
        <i>{suitSymbol[card.suit]}</i>
      </span>
      <span className="pip">{suitSymbol[card.suit]}</span>
    </>
  );
  if (onClick) {
    return (
      <button className={cls} style={style} onClick={onClick} disabled={disabled} aria-label={label}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} style={style} role="img" aria-label={label}>
      {inner}
    </div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back ${small ? "small" : ""}`} aria-hidden="true" />;
}
