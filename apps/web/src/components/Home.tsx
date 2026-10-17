import { useEffect, useRef, useState } from "react";
import type { HistoryGame } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { CardFace } from "./Card";
import { Controls } from "./Controls";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

interface Props {
  nickname: string;
  initialCode: string;
  ready: boolean;
  /** The server just said there is no table with the code that was tried. */
  codeError: boolean;
  /** A game this player left while it was still running; their seat is kept for them. */
  resumeCode: string | null;
  /** This player's finished games, newest first; null until the server answers. */
  games: HistoryGame[] | null;
  onCreate: (nickname: string) => void;
  onJoin: (nickname: string, code: string) => void;
  onHistory: () => void;
}

/** The four highest trumps, fanned above the form like a hand just picked up. */
const FAN = [
  { suit: "hearts", rank: "J" },
  { suit: "hearts", rank: "9" },
  { suit: "hearts", rank: "A" },
  { suit: "hearts", rank: "10" },
] as const;

const RECENT = 3;

export function Home({ nickname: saved, initialCode, ready, codeError, resumeCode, games, onCreate, onJoin, onHistory }: Props) {
  const [nickname, setNickname] = useState(saved);
  const [code, setCode] = useState(initialCode);
  const [badCode, setBadCode] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const name = nickname.trim();
  // Someone who opened a shared link is here to join that table, not to open a new one.
  const fromLink = initialCode.length === 4;
  const resume = !fromLink && resumeCode ? resumeCode : null;
  const invalid = badCode !== null && badCode === code;
  const canJoin = !!name && code.length === 4 && ready;

  useEffect(() => {
    if (codeError) setBadCode(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeError]);

  const join = (
    <form
      className="join"
      onSubmit={(e) => {
        e.preventDefault();
        // the button never looks switched off: with the code unfinished it points at the field instead
        if (canJoin) onJoin(name, code);
        else if (code.length !== 4) codeInput.current?.focus();
      }}
    >
      <label className="field">
        <span>{bg.roomCode}</span>
        <span className="join-row">
          <input
            ref={codeInput}
            className="code"
            value={code}
            maxLength={4}
            placeholder={bg.codePlaceholder}
            autoCapitalize="characters"
            autoComplete="off"
            aria-invalid={invalid}
            aria-describedby={invalid ? "code-error" : undefined}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))}
          />
          <button className={canJoin && !invalid ? "primary" : "secondary"} type="submit" disabled={!name || !ready}>
            {bg.join}
          </button>
        </span>
        {invalid && (
          <span className="field-error" id="code-error" role="alert">
            {bg.error.room_not_found}
          </span>
        )}
      </label>
    </form>
  );

  const create = (
    <button className={fromLink ? "ghost" : resume ? "secondary" : "primary"} disabled={!name || !ready} onClick={() => onCreate(name)}>
      {ready ? bg.newRoom : bg.connecting}
    </button>
  );

  const recent = games?.slice(0, RECENT) ?? [];

  return (
    <main className="home">
      <a className="home-logo" href="/">
        <LogoMark />
        {bg.appName}
      </a>
      <div className="page-controls">
        <Controls />
      </div>

      <div className="home-fan" aria-hidden="true">
        {FAN.map((card, i) => (
          <CardFace key={card.rank} card={card} small fan={i - (FAN.length - 1) / 2} />
        ))}
      </div>

      <div className="home-panel">
        {fromLink && <p className="home-invite">{bg.invited}</p>}
        <label className="field">
          <span>{bg.nickname}</span>
          <input value={nickname} maxLength={20} placeholder={bg.nicknamePlaceholder} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" />
        </label>

        {resume && (
          <div className="resume">
            <p>{bg.resumeTitle(resume)}</p>
            <button className="primary" disabled={!name || !ready} onClick={() => onJoin(name, resume)}>
              {bg.resume}
            </button>
          </div>
        )}
        {fromLink ? join : create}
        {fromLink ? create : join}
      </div>

      {!fromLink && recent.length > 0 && (
        <section className="recent" aria-label={bg.recentGames}>
          <h2>{bg.recentGames}</h2>
          <ul>
            {recent.map((g) => {
              const mine = (g.seat % 2) as 0 | 1;
              const won = g.winner === mine;
              const partner = g.players[(g.seat + 2) % 4]!;
              const opponents = [g.players[(g.seat + 1) % 4]!, g.players[(g.seat + 3) % 4]!];
              return (
                <li key={g.id}>
                  <button className="recent-game" onClick={onHistory}>
                    <span className={`history-result ${won ? "won" : "lost"}`}>{won ? bg.won : bg.lost}</span>
                    <span className="recent-who">
                      {bg.youAnd} {partner.nickname} <span className="muted">{bg.against} {opponents.map((p) => p.nickname).join(" и ")}</span>
                    </span>
                    <span className="recent-score num">
                      {g.scores[mine]}:{g.scores[mine === 0 ? 1 : 0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <button className="ghost recent-all" onClick={onHistory}>
            {bg.allGames} <Icon name="back" size={16} />
          </button>
        </section>
      )}
    </main>
  );
}
