import { useState } from "react";
import type { RoomState } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { Controls } from "./Controls";
import { Icon } from "./Icon";

interface Props {
  room: RoomState;
  onSit: (seat: number) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ room, onSit, onStart, onLeave }: Props) {
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

      <div className="lobby-table">
        {layout.map(({ seat, cls }) => {
          const s = room.seats[seat];
          const mine = room.you === seat;
          return (
            <button key={seat} className={`lobby-seat ${cls} team${seat % 2} ${mine ? "mine" : ""}`} disabled={!!s && !mine} onClick={() => onSit(seat)}>
              {s ? (
                <>
                  <b>{s.nickname}</b>
                  <small>
                    {mine ? bg.you : s.connected ? "" : bg.offline}
                    {room.host === s.nickname && ` · ${bg.host}`}
                  </small>
                </>
              ) : (
                <span>{bg.takeSeat}</span>
              )}
            </button>
          );
        })}
        <div className="lobby-felt" aria-hidden="true" />
      </div>

      {room.watchers.length > 0 && (
        <p className="muted">
          {bg.watching}: {room.watchers.join(", ")}
        </p>
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
