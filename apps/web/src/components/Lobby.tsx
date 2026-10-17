import { useState } from "react";
import { BOT_LEVEL_IDS, CARD_BACKS, type BotLevel, type CardBack, type RoomState } from "@belot/protocol";
import { bg } from "../i18n/bg";
import { Avatar } from "./Avatar";
import { Controls } from "./Controls";
import { Icon } from "./Icon";
import { LogoMark } from "./Logo";

interface Props {
  room: RoomState;
  onSit: (seat: number) => void;
  /** Fills every empty seat with bots, or only `seat`. */
  onAddBots: (seat?: number) => void;
  /** Sends every bot away, or only the one in `seat`. */
  onRemoveBots: (seat?: number) => void;
  onCardBack: (back: CardBack) => void;
  onBotLevel: (level: BotLevel) => void;
  onStart: () => void;
  onLeave: () => void;
}

export function Lobby({ room, onSit, onAddBots, onRemoveBots, onCardBack, onBotLevel, onStart, onLeave }: Props) {
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
          <LogoMark />
          {bg.appName}
        </button>
        <Controls />
      </div>

      <div className="lobby-panel">
        <button className="icon-btn panel-back" onClick={onLeave} aria-label={bg.leave} title={bg.leave}>
          <Icon name="back" />
        </button>
        <div className="lobby-code">
          <div className="code-box">
            <h1 className="room-code" aria-label={`${bg.roomCode} ${room.code}`}>
              {room.code}
            </h1>
            <button className="icon-btn" onClick={copy} aria-label={copied ? bg.copied : bg.copyLink} title={copied ? bg.copied : bg.copyLink}>
              <Icon name={copied ? "check" : "copy"} />
            </button>
            {canShare && (
              <button className="icon-btn" onClick={nativeShare} aria-label={bg.share} title={bg.share}>
                <Icon name="share" />
              </button>
            )}
          </div>
          <p className="muted">{bg.shareHint}</p>
        </div>


        <div className="seats" role="group" aria-label={bg.lobbyTableLabel}>
          {order.map((seat) => {
            const s = room.seats[seat];
            const mine = room.you === seat;
            const partner = room.you !== null && !mine && (seat + 2) % 4 === room.you;
            const ours = seat % 2 === mineParity;
            // one short word under the name, so every box keeps the same height
            const note = s ? (mine ? bg.you : !s.connected && !s.bot ? bg.offline : partner ? bg.partnerOf : s.bot ? bg.bot : teamLabel(seat)) : "";
            return (
              <div key={seat} className="slot-cell">
                <button className={`slot ${ours ? "ours" : "theirs"} ${s ? "taken" : ""} ${mine ? "mine" : ""}`} disabled={!!s && !mine} aria-label={s ? undefined : `${teamLabel(seat)}: ${bg.takeSeat}`} onClick={() => onSit(seat)}>
                  <span className="slot-avatar" aria-hidden="true">
                    {s ? <Avatar name={s.nickname} size={52} /> : "+"}
                  </span>
                  <span className="slot-text">
                    {s ? <b>{s.nickname}</b> : <b className="slot-empty">{teamLabel(seat)}</b>}
                    {s && <small>{note}</small>}
                  </span>
                </button>
                {/* the host can put a bot in any empty seat, and send a single bot away */}
                {room.youAreHost && !s && (
                  <button type="button" className="slot-bot" onClick={() => onAddBots(seat)} aria-label={bg.addBotTo(teamLabel(seat))}>
                    + {bg.addBot}
                  </button>
                )}
                {room.youAreHost && s?.bot && (
                  <button type="button" className="slot-bot remove" onClick={() => onRemoveBots(seat)} aria-label={bg.removeBot(s.nickname)} title={bg.removeBot(s.nickname)}>
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {hasBots && (
          <div className="level-pick" role="radiogroup" aria-label={bg.botLevelTitle}>
            {BOT_LEVEL_IDS.map((l) => (
              <button key={l} type="button" role="radio" aria-checked={room.botLevel === l} disabled={!room.youAreHost} onClick={() => onBotLevel(l)}>
                {bg.botLevelNames[l]}
              </button>
            ))}
          </div>
        )}

        <div className="back-pick" role="radiogroup" aria-label={bg.cardBackTitle}>
          {CARD_BACKS.map((b) => (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={room.cardBack === b}
              aria-label={bg.cardBackNames[b]}
              title={bg.cardBackNames[b]}
              data-back={b}
              className="back-swatch"
              disabled={!room.youAreHost}
              onClick={() => onCardBack(b)}
            />
          ))}
        </div>

        {room.watchers.length > 0 && !room.youAreHost && (
          <p className="muted">
            {bg.watching}: {room.watchers.join(", ")}
          </p>
        )}

        <div className="lobby-actions">
          {room.youAreHost && !full && (
            <button className="secondary" onClick={() => onAddBots()}>
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
