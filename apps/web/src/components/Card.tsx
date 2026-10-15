import type { Card as CardData } from "@belot/engine";
import { isRed, rankLabel, suitSymbol } from "../i18n/bg";

interface Props {
  card: CardData;
  onClick?: () => void;
  disabled?: boolean;
  small?: boolean;
  highlight?: boolean;
}

export function CardFace({ card, onClick, disabled, small, highlight }: Props) {
  const cls = ["card", isRed(card.suit) ? "red" : "black", small ? "small" : "", disabled ? "dim" : "", highlight ? "winner" : ""]
    .filter(Boolean)
    .join(" ");
  const label = `${rankLabel[card.rank]} ${suitSymbol[card.suit]}`;
  const inner = (
    <>
      <span className="corner">
        <b>{rankLabel[card.rank]}</b>
        <i>{suitSymbol[card.suit]}</i>
      </span>
      <span className="pip">{suitSymbol[card.suit]}</span>
    </>
  );
  if (onClick) {
    return (
      <button className={cls} onClick={onClick} disabled={disabled} aria-label={label}>
        {inner}
      </button>
    );
  }
  return (
    <div className={cls} role="img" aria-label={label}>
      {inner}
    </div>
  );
}

export function CardBack({ small }: { small?: boolean }) {
  return <div className={`card back ${small ? "small" : ""}`} aria-hidden="true" />;
}
