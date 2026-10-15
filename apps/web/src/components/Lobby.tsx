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

  // Seats 0+2 are one team, 1+3 the other; the grid mirrors the table (partners face each other).
  const layout = [
    { seat: 2, cls: "top" },
    { seat: 3, cls: "left" },
    { seat: 1, cls: "right" },
    { seat: 0, cls: "bottom" },
  ];

  return (
    <main className="lobby">
      <div className="page-bar">
        <button className="icon-btn" onClick={onLeave} aria-label={bg.leave} title={bg.leave}>
          <Icon name="back" />
        </button>
        <Controls />
      </div>
      <h1 className="room-code" aria-label={`${bg.roomCode} ${room.code}`}>
        {room.code}
      </h1>
      <button className="secondary small" onClick={copy}>
        <Icon name={copied ? "check" : "copy"} size={16} /> {copied ? bg.copied : bg.copyLink}
      </button>
      <p className="muted">{bg.shareHint}</p>

      <div className="stitch" aria-hidden="true" />

      <div className="lobby-table" role="group" aria-label={bg.lobbyTableLabel} data-odd={room.you !== null && room.you % 2 === 1}>
        <div className="lobby-felt" aria-hidden="true" />
        {layout.map(({ seat, cls }) => {
          const s = room.seats[seat];
          const mine = room.you === seat;
          const ours = room.you === null ? seat % 2 === 0 : seat % 2 === room.you % 2;
          const team = room.you === null ? (seat % 2 === 0 ? bg.teamOneUnseated : bg.teamTwoUnseated) : seat % 2 === room.you % 2 ? bg.teamUs : bg.teamThem;
          const partner = room.you !== null && !mine && (seat + 2) % 4 === room.you;
          return (
            <button key={seat} className={`lobby-seat ${cls} team${ours ? 0 : 1} ${mine ? "mine" : ""}`} disabled={!!s && !mine} onClick={() => onSit(seat)}>
              {s ? (
                <>
                  <em className="team-tag">{team}</em>
                  <b>{s.nickname}</b>
                  <small>
                    {[mine ? bg.you : partner ? bg.partnerOf : "", s.bot ? bg.bot : "", !s.connected && !s.bot ? bg.offline : "", room.host === s.nickname ? bg.host : ""].filter(Boolean).join(" · ")}
                  </small>
                </>
              ) : (
                <>
                  <em className="team-tag">{team}</em>
                  <span>{bg.takeSeat}</span>
                </>
              )}
            </button>
          );
        })}
      </div>

      {room.watchers.length > 0 && (
        <p className="muted">
          {bg.watching}: {room.watchers.join(", ")}
        </p>
      )}

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
    </main>
  );
}
