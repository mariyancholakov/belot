import { useState } from "react";
import type { HistoryGame } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { Controls } from "./Controls";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";
import { ScoreSheet } from "./ScoreSheet";

interface Props {
  /** Null while the server has not answered yet. */
  games: HistoryGame[] | null;
  onBack: () => void;
}

const when = (iso: string) =>
  new Date(iso).toLocaleString("bg-BG", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

/** The player's finished games, newest first; a tap opens the round sheet of a game. */
export function History({ games, onBack }: Props) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <main className="history">
      <div className="page-bar">
        <button className="home-logo" onClick={onBack}>
          <LogoMark />
          {bg.appName}
        </button>
        <Controls />
      </div>

      <div className="history-panel">
        <div className="history-head">
          <button className="icon-btn" onClick={onBack} aria-label={bg.back} title={bg.back}>
            <Icon name="back" />
          </button>
          <h1>{bg.historyTitle}</h1>
        </div>

        {games === null && <p className="muted">{bg.loading}</p>}
        {games?.length === 0 && <p className="muted">{bg.historyEmpty}</p>}
        {games && games.length > 0 && (
          <ul className="history-list">
            {games.map((g) => {
              const mine = (g.seat % 2) as 0 | 1;
              const them = mine === 0 ? 1 : 0;
              const won = g.winner === mine;
              const partner = g.players[(g.seat + 2) % 4]!;
              const opponents = [g.players[(g.seat + 1) % 4]!, g.players[(g.seat + 3) % 4]!];
              const expanded = open === g.id;
              return (
                <li key={g.id} className={expanded ? "open" : ""}>
                  <button className="history-game" aria-expanded={expanded} onClick={() => setOpen(expanded ? null : g.id)}>
                    <span className={`history-result ${won ? "won" : "lost"}`}>{won ? bg.won : bg.lost}</span>
                    <span className="history-who">
                      <b>
                        {bg.youAnd} {partner.nickname}
                      </b>
                      <small>
                        {bg.against} {opponents.map((p) => p.nickname).join(" и ")}
                      </small>
                    </span>
                    <span className="history-score num">
                      <b>{g.scores[mine]}</b>
                      <small>{g.scores[them]}</small>
                    </span>
                    <time className="history-when muted" dateTime={g.finishedAt}>
                      {when(g.finishedAt)}
                    </time>
                  </button>
                  {expanded && <ScoreSheet rounds={g.rounds} scores={g.scores} hanging={0} mine={mine} />}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
