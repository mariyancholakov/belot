import type { Announcement, Card } from "@belot/engine";
import { announcementName, bg, rankLabel, suitSymbol } from "../i18n/bg";
import { CardFace } from "./Card";

/** Before the first card: the announcements this hand holds, to declare or keep quiet about. */
export function AnnouncePrompt({ options, onChoose }: { options: Announcement[]; onChoose: (declare: boolean) => void }) {
  return (
    <section className="felt-pop prompt" aria-label={bg.announceTitle}>
      <div className="announce-list">
        {options.map((a, i) => (
          <div key={i} className="announce-item">
            <div className="announce-cards">
              {a.cards.map((c) => (
                <CardFace key={c.suit + c.rank} card={c} small />
              ))}
            </div>
            <b>
              {announcementName[a.kind]}
              {a.suit ? ` ${suitSymbol[a.suit]}` : ` ${rankLabel[a.high]}`} · {a.points}
            </b>
          </div>
        ))}
      </div>
      <div className="prompt-actions">
        <button className="primary" onClick={() => onChoose(true)}>
          {bg.announceYes}
        </button>
        <button className="secondary" onClick={() => onChoose(false)}>
          {bg.announceNo}
        </button>
      </div>
    </section>
  );
}

/** Playing the first card of a held K+Q of trump (or laying cards down with one): call the belot or not. */
export function BelotPrompt({ cards, onChoose }: { cards: Card[]; onChoose: (call: boolean) => void }) {
  return (
    <section className="felt-pop prompt" aria-label={bg.belotAsk}>
      <div className="announce-cards center">
        {cards.map((c) => (
          <CardFace key={c.suit + c.rank} card={c} small />
        ))}
      </div>
      <div className="prompt-actions">
        <button className="primary" onClick={() => onChoose(true)}>
          {bg.belotYes}
        </button>
        <button className="secondary" onClick={() => onChoose(false)}>
          {bg.belotNo}
        </button>
      </div>
    </section>
  );
}
