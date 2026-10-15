import { useState } from "react";
import type { RoomState } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { Avatar } from "./Avatar";
import { Controls } from "./Controls";
import { Icon } from "./Icon";

interface Props {
  room: RoomState;
  onSit: (seat: number) => void;
  onAddBots: () => void;
  onRemoveBots: () => void;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ room, onSit, onAddBots, onRemoveBots, onStart, onLeave }: Props) {
  const [copied, setCopied] = useState(false);
  const link = `${location.origin}/${room.code}`;
  const hasBots = room.seats.some((s) => s?.bot);
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

  const canShare = typeof navigator.share === "function";
  const nativeShare = () => navigator.share({ title: bg.appName, text: bg.shareText, url: link }).catch(() => {});

  // Partners sit across from each other, so a team is a diagonal: seats 0+2 and 1+3, shown by colour.
  // The grid reads clockwise round the table: 0 and 1 on top, 3 and 2 below.
  const mineParity = room.you === null ? 0 : room.you % 2;
  const teamLabel = (seat: number) =>
    room.you === null ? (seat % 2 === 0 ? bg.teamOneUnseated : bg.teamTwoUnseated) : seat % 2 === mineParity ? bg.teamUs : bg.teamThem;
  const order = [0, 1, 3, 2];

  return (
    <main className="lobby">
      <div className="page-bar">
        <button className="home-logo" onClick={onLeave}>
          <span className="home-logo-mark" aria-hidden="true">♠</span>
          {bg.appName}
        </button>
        <Controls />
      </div>

      <div className="lobby-panel">
        <button className="icon-btn panel-back" onClick={onLeave} aria-label={bg.leave} title={bg.leave}>
          <Icon name="back" />
        </button>
        <div className="lobby-code">
          <span className="eyebrow">{bg.roomCode}</span>
          <h1 className="room-code" aria-label={`${bg.roomCode} ${room.code}`}>
            {room.code}
          </h1>
          <p className="muted">{bg.shareHint}</p>
        </div>

        <div className="share">
          <button className="secondary" onClick={copy}>
            <Icon name={copied ? "check" : "copy"} size={18} /> {copied ? bg.copied : bg.copyLink}
          </button>
          {canShare && (
            <button className="secondary" onClick={nativeShare}>
              {bg.share}
            </button>
          )}
        </div>

        <div className="stitch" aria-hidden="true" />

        <div className="seats" role="group" aria-label={bg.lobbyTableLabel}>
          {order.map((seat) => {
            const s = room.seats[seat];
            const mine = room.you === seat;
            const partner = room.you !== null && !mine && (seat + 2) % 4 === room.you;
            const ours = seat % 2 === mineParity;
            const note = s
              ? [mine ? bg.you : partner ? bg.partnerOf : "", s.bot ? bg.bot : "", !s.connected && !s.bot ? bg.offline : "", room.host === s.nickname ? bg.host : ""].filter(Boolean).join(" · ")
              : "";
            return (
              <button key={seat} className={`slot ${ours ? "ours" : "theirs"} ${s ? "taken" : ""} ${mine ? "mine" : ""}`} disabled={!!s && !mine} onClick={() => onSit(seat)}>
                <span className="slot-avatar" aria-hidden="true">
                  {s ? <Avatar name={s.nickname} size={52} /> : "+"}
                </span>
                <span className="slot-text">
                  <em>{teamLabel(seat)}</em>
                  <b>{s ? s.nickname : bg.takeSeat}</b>
                  {note && <small>{note}</small>}
                </span>
              </button>
            );
          })}
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
          {room.youAreHost && hasBots && (
            <button className="secondary" onClick={onRemoveBots}>
              {bg.removeBots}
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
