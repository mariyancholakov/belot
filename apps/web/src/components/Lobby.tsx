import { useState } from "react";
import type { RoomState } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { Controls } from "./Controls";
import { Icon } from "./Icon";

interface Props {
  room: RoomState;
  onSit: (seat: number) => void;
  onAddBots: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ room, onSit, onAddBots, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/${room.code}`;
  const full = room.seats.every((s) => s !== null);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt(bg.copyLink, link);
    }
  };

  // Seats 0+2 are one team, 1+3 the other. Whoever is seated sees their own team first.
  const mineParity = room.you === null ? 0 : room.you % 2;
  const teams = [mineParity, 1 - mineParity].map((parity) => ({
    parity,
    label: room.you === null ? (parity === 0 ? bg.teamOneUnseated : bg.teamTwoUnseated) : parity === mineParity ? bg.teamUs : bg.teamThem,
    seats: [parity, parity + 2],
  }));

  return (
    <main className="lobby">
      <div className="page-bar">
        <button className="icon-btn" onClick={onLeave} aria-label={bg.leave} title={bg.leave}>
          <Icon name="back" />
        </button>
        <Controls />
      </div>

      <div className="lobby-panel">
        <div className="lobby-code">
          <span className="eyebrow">{bg.roomCode}</span>
          <div className="code-row">
            <h1 className="room-code" aria-label={`${bg.roomCode} ${room.code}`}>
              {room.code}
            </h1>
            <button className="icon-btn" onClick={copy} aria-label={copied ? bg.copied : bg.copyLink} title={copied ? bg.copied : bg.copyLink}>
              <Icon name={copied ? "check" : "copy"} size={20} />
            </button>
          </div>
          <p className="muted">{bg.shareHint}</p>
        </div>

        <div className="stitch" aria-hidden="true" />

        <div className="teams" role="group" aria-label={bg.lobbyTableLabel}>
          {teams.map((t) => (
            <section key={t.parity} className={`team ${t.parity === mineParity ? "ours" : "theirs"}`}>
              <h2>{t.label}</h2>
              {t.seats.map((seat) => {
                const s = room.seats[seat];
                const mine = room.you === seat;
                const partner = room.you !== null && !mine && (seat + 2) % 4 === room.you;
                const note = s
                  ? [mine ? bg.you : partner ? bg.partnerOf : "", s.bot ? bg.bot : "", !s.connected && !s.bot ? bg.offline : "", room.host === s.nickname ? bg.host : ""].filter(Boolean).join(" · ")
                  : "";
                return (
                  <button key={seat} className={`slot ${s ? "taken" : ""} ${mine ? "mine" : ""}`} disabled={!!s && !mine} onClick={() => onSit(seat)}>
                    <span className="slot-avatar" aria-hidden="true">
                      {s ? [...s.nickname][0]?.toUpperCase() : "+"}
                    </span>
                    <span className="slot-text">
                      <b>{s ? s.nickname : bg.takeSeat}</b>
                      {note && <small>{note}</small>}
                    </span>
                  </button>
                );
              })}
            </section>
          ))}
        </div>

        {room.watchers.length > 0 && (
          <p className="muted">
            {bg.watching}: {room.watchers.join(", ")}
          </p>
        )}

        <div className="lobby-actions">
          {room.youAreHost && !full && (
            <button className="secondary" onClick={onAddBots}>
              {bg.addBots}
            </button>
          )}
          {room.youAreHost ? (
            <button className="primary" disabled={!full} onClick={onStart}>
              {full ? bg.start : bg.needFour}
            </button>
          ) : (
            <p className="muted">{bg.waitHost}</p>
          )}
        </div>
      </div>
    </main>
  );
}
