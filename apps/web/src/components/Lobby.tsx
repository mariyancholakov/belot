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

  const text = `${bg.shareText} ${link}`;
  const channels = [
    { name: "WhatsApp", href: `https://wa.me/?text=${encodeURIComponent(text)}` },
    { name: "Viber", href: `viber://forward?text=${encodeURIComponent(text)}` },
    { name: "Telegram", href: `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(bg.shareText)}` },
    { name: "Messenger", href: `fb-messenger://share?link=${encodeURIComponent(link)}` },
  ];
  const canShare = typeof navigator.share === "function";
  const nativeShare = () => navigator.share({ title: bg.appName, text: bg.shareText, url: link }).catch(() => {});

  // Partners sit across from each other, so a team is a diagonal: seats 0+2 and 1+3.
  // The grid reads clockwise round the table: 0 and 1 on top, 3 and 2 below.
  const mineParity = room.you === null ? 0 : room.you % 2;
  const teamLabel = (seat: number) =>
    room.you === null ? (seat % 2 === 0 ? bg.teamOneUnseated : bg.teamTwoUnseated) : seat % 2 === mineParity ? bg.teamUs : bg.teamThem;
  const order = [0, 1, 3, 2];

  return (
    <main className="lobby">
      <div className="page-bar">
        <span className="home-logo" aria-hidden="true">
          <span className="home-logo-mark">♠</span>
          {bg.appName}
        </span>
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
          <div className="share-apps">
            {channels.map((c) => (
              <a key={c.name} className="chip" href={c.href} target="_blank" rel="noreferrer">
                {c.name}
              </a>
            ))}
          </div>
        </div>

        <div className="stitch" aria-hidden="true" />

        <div className="seats" role="group" aria-label={bg.lobbyTableLabel}>
          <svg className="seats-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <line className={mineParity === 0 ? "ours" : "theirs"} x1="25" y1="25" x2="75" y2="75" />
            <line className={mineParity === 1 ? "ours" : "theirs"} x1="75" y1="25" x2="25" y2="75" />
          </svg>
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
                  {s ? [...s.nickname][0]?.toUpperCase() : "+"}
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
