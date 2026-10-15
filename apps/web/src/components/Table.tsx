import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, GameAction, GameEvent, GameView, Play } from "@belot/engine";
import type { RoomState } from "@belot/protocol";
import { announcementName, bg, contractLabel, rankLabel, suitSymbol } from "../i18n/bg";
import { Bidding, bidText } from "./Bidding";
import { CardBack, CardFace } from "./Card";
import { ScoreSheet } from "./ScoreSheet";

const SUIT_ORDER = ["clubs", "diamonds", "spades", "hearts"] as const;
const RANK_ORDER = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
const HOLD_MS = 1500;

function sortHand(hand: Card[]): Card[] {
  return [...hand].sort(
    (a, b) => SUIT_ORDER.indexOf(a.suit) - SUIT_ORDER.indexOf(b.suit) || RANK_ORDER.indexOf(a.rank) - RANK_ORDER.indexOf(b.rank),
  );
}

type Pos = "bottom" | "right" | "top" | "left";
const POSITIONS: Pos[] = ["bottom", "right", "top", "left"];

interface Props {
  view: GameView;
  room: RoomState;
  events: GameEvent[];
  updateId: number;
  send: (action: GameAction) => void;
  onNewGame: () => void;
  onLeave: () => void;
}

export function Table({ view, room, events, updateId, send, onNewGame, onLeave }: Props) {
  const me = view.seat;
  const myTeam = (me % 2) as 0 | 1;
  const names = room.seats.map((s) => s?.nickname ?? "—");
  const rel = (seat: number) => (seat - me + 4) % 4;

  // Keep a finished trick on screen for a moment so everyone can see how it ended.
  const [held, setHeld] = useState<{ plays: Play[]; winner: number } | null>(null);
  const [callout, setCallout] = useState<string | null>(null);
  const lastUpdate = useRef(0);
  useEffect(() => {
    if (updateId === lastUpdate.current) return;
    lastUpdate.current = updateId;
    const belot = events.find((e): e is Extract<GameEvent, { type: "belot" }> => e.type === "belot");
    if (belot) {
      setCallout(`${bg.belot}! ${names[belot.seat]} ${suitSymbol[belot.suit]} +20`);
      setTimeout(() => setCallout(null), 2200);
    }
    const won = events.find((e): e is Extract<GameEvent, { type: "trickWon" }> => e.type === "trickWon");
    if (!won) return;
    setHeld({ plays: won.plays, winner: won.winner });
    const t = setTimeout(() => setHeld(null), HOLD_MS);
    return () => clearTimeout(t);
  }, [updateId, events]);

  // Give the last trick time to be seen before the round summary covers the table.
  const finished = view.phase === "roundEnd" || view.phase === "gameOver";
  const [summaryReady, setSummaryReady] = useState(false);
  useEffect(() => {
    if (!finished) {
      setSummaryReady(false);
      return;
    }
    const t = setTimeout(() => setSummaryReady(true), HOLD_MS + 200);
    return () => clearTimeout(t);
  }, [finished]);

  const [sheetOpen, setSheetOpen] = useState(false);

  const trick: Play[] = view.trick.length > 0 ? view.trick : held?.plays ?? [];
  const winnerSeat = view.trick.length === 0 ? held?.winner : undefined;

  const playable = useMemo(() => {
    const set = new Set<string>();
    for (const a of view.legalActions) if (a.type === "play") set.add(a.card.suit + a.card.rank);
    return set;
  }, [view.legalActions]);
  const myTurn = view.phase === "playing" && view.turn === me;
  const hand = sortHand(view.hand);

  const last = view.history[view.history.length - 1];

  return (
    <div className="table">
      <header className="topbar">
        <button className="link" onClick={onLeave}>
          ← {bg.leave}
        </button>
        <div className="chips">
          {view.contract ? (
            <span className="chip strong">
              {contractLabel(view.contract.contract)}
              {view.contract.multiplier > 1 && ` ×${view.contract.multiplier}`}
            </span>
          ) : (
            <span className="chip">{bg.bidTitle}</span>
          )}
          <span className="chip muted">
            {bg.round} {view.round}
          </span>
        </div>
        <button className="score-pill" onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen}>
          <b>{view.scores[myTeam]}</b>
          <span>:</span>
          <b>{view.scores[myTeam === 0 ? 1 : 0]}</b>
        </button>
      </header>

      <div className="felt">
        {POSITIONS.slice(1).map((pos, i) => {
          const seat = (me + i + 1) % 4;
          return <Seat key={pos} pos={pos} seat={seat} view={view} name={names[seat]!} connected={room.seats[seat]?.connected ?? false} partner={seat % 2 === myTeam} />;
        })}

        <div className="center" aria-live="polite">
          {trick.map((play) => (
            <div key={play.seat} className={`played ${POSITIONS[rel(play.seat)]}`}>
              <CardFace card={play.card} small highlight={winnerSeat === play.seat} />
            </div>
          ))}
          {trick.length === 0 && view.phase === "playing" && <p className="hint muted">{myTurn ? bg.yourTurn : bg.waitingFor(names[view.turn] ?? "")}</p>}
        </div>

        {callout && <div className="callout">{callout}</div>}

        {view.announcements && view.announcements.length > 0 && (
          <ul className="announced">
            {view.announcements.flatMap(({ seat, announcements }) =>
              announcements.map((a, i) => (
                <li key={`${seat}-${i}`}>
                  <b>{names[seat]}</b> {announcementName[a.kind]}
                  {a.suit ? ` ${suitSymbol[a.suit]}` : ""} {rankLabel[a.high]} · {a.points}
                </li>
              )),
            )}
          </ul>
        )}
      </div>

      {view.phase === "bidding" && <Bidding view={view} names={names} onBid={(bid) => send({ type: "bid", bid })} />}

      <Seat pos="bottom" seat={me} view={view} name={names[me]!} connected partner />
      <div className={`hand ${myTurn ? "active" : ""}`}>
        {hand.map((card) => {
          const ok = view.phase !== "playing" || !myTurn || playable.has(card.suit + card.rank);
          return <CardFace key={card.suit + card.rank} card={card} disabled={!ok} onClick={myTurn && ok ? () => send({ type: "play", card }) : undefined} />;
        })}
      </div>

      <aside className={`drawer ${sheetOpen ? "open" : ""}`}>
        <button className="link close" onClick={() => setSheetOpen(false)}>
          ✕
        </button>
        <ScoreSheet view={view} mine={myTeam} />
      </aside>

      {finished && summaryReady && last && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            {view.phase === "gameOver" ? (
              <h2 className={view.winner === myTeam ? "win" : "lose"}>{view.winner === myTeam ? bg.weWin : bg.theyWin}</h2>
            ) : (
              <h2>
                {bg.round} {last.round}
              </h2>
            )}
            <RoundDetails summary={last} myTeam={myTeam} />
            <ScoreSheet view={view} mine={myTeam} />
            {view.phase === "roundEnd" && (
              <button className="primary" onClick={() => send({ type: "nextRound" })}>
                {bg.nextRound}
              </button>
            )}
            {view.phase === "gameOver" && (
              <div className="modal-actions">
                {room.youAreHost ? (
                  <button className="primary" onClick={onNewGame}>
                    {bg.newGame}
                  </button>
                ) : (
                  <p className="muted">{bg.waitHost}</p>
                )}
                <button className="link" onClick={onLeave}>
                  {bg.leave}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RoundDetails({ summary, myTeam }: { summary: GameView["history"][number]; myTeam: 0 | 1 }) {
  const other = myTeam === 0 ? 1 : 0;
  return (
    <dl className="details">
      <dt>{contractLabel(summary.contract)}</dt>
      <dd>
        {summary.cardPoints[myTeam]} : {summary.cardPoints[other]}
      </dd>
      {(summary.announcements[0] > 0 || summary.announcements[1] > 0) && (
        <>
          <dt>{bg.announcements}</dt>
          <dd>
            {summary.announcements[myTeam]} : {summary.announcements[other]}
          </dd>
        </>
      )}
      {summary.result.outcome === "inside" && <dt className="warn">{bg.inside}</dt>}
      {summary.result.outcome === "tie" && <dt className="warn">{bg.tie}</dt>}
      {summary.capo !== null && <dt className="warn">{bg.capo}</dt>}
    </dl>
  );
}

interface SeatProps {
  pos: Pos;
  seat: number;
  view: GameView;
  name: string;
  connected: boolean;
  partner: boolean;
}

function Seat({ pos, seat, view, name, connected, partner }: SeatProps) {
  const turn = view.turn === seat && (view.phase === "bidding" || view.phase === "playing");
  const count = view.handCounts[seat] ?? 0;
  const lastBid = [...view.bidLog].reverse().find((b) => b.seat === seat);
  return (
    <div className={`seat ${pos} ${turn ? "turn" : ""} ${partner ? "ours" : "theirs"} ${connected ? "" : "offline"}`}>
      <div className="name">
        <span>{name}</span>
        {view.dealer === seat && <em title={bg.dealer}>Р</em>}
        {!connected && <small>{bg.offline}</small>}
      </div>
      {view.phase === "bidding" && lastBid && <span className="bubble">{bidText(lastBid.bid)}</span>}
      {pos !== "bottom" && (
        <div className="backs" aria-label={`${count}`}>
          {Array.from({ length: Math.min(count, 8) }, (_, i) => (
            <CardBack key={i} small />
          ))}
        </div>
      )}
    </div>
  );
}
