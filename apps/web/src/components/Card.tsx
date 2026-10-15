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
  /** A card that just arrived from the dealer: a short settle instead of the full deal-in. */
  land?: boolean;
  /** The face-up "късметче" card. */
  lucky?: boolean;
  /** Offset from the middle card of a held hand: the card tilts and drops a little, like a fan. */
  fan?: number;
}

export function CardFace({ card, onClick, disabled, small, highlight, delay, deal, land, lucky, fan }: Props) {
  const cls = ["card", isRed(card.suit) ? "red" : "black", small ? "small" : "", disabled ? "dim" : "", highlight ? "winner" : "", deal ? "deal" : "", land ? "land" : "", lucky ? "lucky" : ""]
    .filter(Boolean)
    .join(" ");
  const label = `${rankLabel[card.rank]} ${suitName[card.suit]}`;
  const style: React.CSSProperties | undefined =
    delay || fan !== undefined ? { ...(delay && { animationDelay: `${delay}ms` }), ...(fan !== undefined && { ["--off" as string]: fan }) } : undefined;
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

export function CardBack({ small, fan }: { small?: boolean; fan?: number }) {
  return <div className={`card back ${small ? "small" : ""}`} style={fan === undefined ? undefined : { ["--off" as string]: fan }} aria-hidden="true" />;
}
