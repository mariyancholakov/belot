import { useEffect, useMemo, useRef, useState } from "react";
import type { Card, GameAction, GameEvent, GameView, Play } from "@belot/engine";
import type { RoomState } from "@belot/protocol";
import { announcementName, bg, contractLabel, isRed, rankLabel, suitSymbol } from "../i18n/bg";
import { playSound } from "../sound";
import { AnimatedNumber } from "./AnimatedNumber";
import { Bidding, bidText } from "./Bidding";
import { CardBack, CardFace } from "./Card";
import { Controls } from "./Controls";
import { CutPicker, DEAL_FLY, DEAL_GAP, DeckStage, dealTarget, dealTotal, type Stage } from "./Dealing";
import { Icon } from "./Icon";
import { ScoreSheet } from "./ScoreSheet";

const SUIT_ORDER = ["clubs", "diamonds", "spades", "hearts"] as const;
const RANK_ORDER = ["7", "8", "9", "10", "J", "Q", "K", "A"] as const;
/** How long a finished trick stays on the table, and how long the sweep to the winner takes. */
const HOLD_MS = 1500;
const SWEEP_MS = 380;
/** The riffle shuffle, and the cut animation, before cards are dealt. */
const SHUFFLE_MS = 2100;
const CUT_MS = 1250;

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
  const otherTeam = myTeam === 0 ? 1 : 0;
  const names = room.seats.map((s) => s?.nickname ?? "—");
  const rel = (seat: number) => (seat - me + 4) % 4;

  // A finished trick stays on screen briefly, then sweeps to whoever took it.
  const [held, setHeld] = useState<{ plays: Play[]; winner: number } | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [callout, setCallout] = useState<string | null>(null);
  const lastUpdate = useRef(0);
  const prevTurn = useRef(-1);

  // Shuffle -> cut -> deal. `shown` is how many cards each seat has received so far.
  const [stage, setStage] = useState<Stage | null>(() => (view.phase === "cutting" ? { kind: "shuffle" } : null));
  const [shown, setShown] = useState<number[] | null>(null);
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const viewRef = useRef(view);
  viewRef.current = view;
  const animTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const later = (ms: number, fn: () => void) => {
    animTimers.current.push(setTimeout(fn, ms));
  };
  useEffect(() => () => animTimers.current.forEach(clearTimeout), []);

  const startDeal = (rest: boolean, dealer: number) => {
    const order = [1, 2, 3, 4].map((i) => POSITIONS[rel((dealer + i) % 4)]!);
    const seats = [1, 2, 3, 4].map((i) => (dealer + i) % 4);
    const counts = rest ? [5, 5, 5, 5] : [0, 0, 0, 0];
    const total = dealTotal(rest);
    setShown([...counts]);
    setStage({ kind: "deal", rest, order });
    for (let k = 0; k < total; k++) {
      playSound("dealOne", k * DEAL_GAP);
      const seat = seats[dealTarget(k, rest)]!;
      later(k * DEAL_GAP + DEAL_FLY, () => {
        counts[seat]! += 1;
        setShown([...counts]);
      });
    }
    later(total * DEAL_GAP + DEAL_FLY + 120, () => {
      setStage(null);
      setShown(null);
      const v = viewRef.current;
      if ((v.phase === "bidding" || v.phase === "playing") && v.turn === v.seat) playSound("turn");
    });
  };

  const startCut = (position: number, dealer: number) => {
    setShown(null);
    setStage({ kind: "cut", position });
    playSound("cut");
    later(CUT_MS, () => startDeal(false, dealer));
  };

  // A new deal begins with a shuffle that everyone watches.
  useEffect(() => {
    if (view.phase !== "cutting") return;
    setShown(null);
    setStage({ kind: "shuffle" });
    playSound("shuffle");
    const t = setTimeout(() => setStage((s) => (s?.kind === "shuffle" ? { kind: "wait" } : s)), SHUFFLE_MS);
    return () => clearTimeout(t);
  }, [view.phase, view.dealer, view.round]);

  useEffect(() => {
    if (updateId === lastUpdate.current) return;
    lastUpdate.current = updateId;
    const timers: ReturnType<typeof setTimeout>[] = [];

    let animating = stageRef.current !== null;
    const cutEvent = events.find((e) => e.type === "cut");
    if (cutEvent && cutEvent.type === "cut") {
      startCut(cutEvent.position, view.dealer);
      animating = true;
    } else if (view.phase !== "cutting" && (stageRef.current?.kind === "shuffle" || stageRef.current?.kind === "wait")) {
      // The cut update was missed (it arrived together with a later one): animate anyway.
      startCut(16, view.dealer);
      animating = true;
    }

    for (const e of events) {
      switch (e.type) {
        case "played":
          playSound("play");
          break;
        case "contract":
          startDeal(true, view.dealer);
          animating = true;
          break;
        case "bid":
          playSound(e.bid.type === "pass" ? "pass" : e.bid.type === "bid" ? "bid" : "contra");
          break;
        case "belot":
          setCallout(`${bg.belot} · ${names[e.seat]} ${suitSymbol[e.suit]} +20`);
          timers.push(setTimeout(() => setCallout(null), 2400));
          timers.push(setTimeout(() => playSound("belot"), 120));
          break;
        case "trickWon":
          setHeld({ plays: e.plays, winner: e.winner });
          setSweeping(false);
          timers.push(setTimeout(() => setSweeping(true), HOLD_MS - SWEEP_MS));
          timers.push(setTimeout(() => playSound("trick"), HOLD_MS - SWEEP_MS));
          timers.push(
            setTimeout(() => {
              setHeld(null);
              setSweeping(false);
            }, HOLD_MS),
          );
          break;
        case "roundScored": {
          const ours = e.result.recorded[myTeam];
          const theirs = e.result.recorded[otherTeam];
          timers.push(setTimeout(() => playSound(ours >= theirs ? "win" : "lose"), HOLD_MS + 200));
          break;
        }
        default:
          break;
      }
    }

    // Nudge the player when the turn comes round to them.
    const mine = (view.phase === "bidding" || view.phase === "playing") && view.turn === me;
    if (mine && prevTurn.current !== me && !animating) {
      const afterCard = events.some((e) => e.type === "played");
      timers.push(setTimeout(() => playSound("turn"), afterCard ? 220 : 0));
    }
    prevTurn.current = view.turn;

    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateId]);

  // Let the last trick be seen before the round summary covers the table.
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
  const sweepTo = winnerSeat !== undefined && sweeping ? POSITIONS[rel(winnerSeat)] : null;

  const playable = useMemo(() => {
    const set = new Set<string>();
    for (const a of view.legalActions) if (a.type === "play") set.add(a.card.suit + a.card.rank);
    return set;
  }, [view.legalActions]);
  const busy = stage !== null;
  const dealtSoFar = shown ?? (busy ? [0, 0, 0, 0] : null);
  const myTurn = view.phase === "playing" && view.turn === me && !busy;
  const hand = sortHand(dealtSoFar ? view.hand.slice(0, dealtSoFar[me]) : view.hand);
  const dealerName = names[view.dealer] ?? "";
  const counts = (seat: number) => (dealtSoFar ? dealtSoFar[seat]! : view.handCounts[seat] ?? 0);
  const last = view.history[view.history.length - 1];

  return (
    <div className="table">
      <header className="topbar">
        <button className="icon-btn" onClick={onLeave} aria-label={bg.leave} title={bg.leave}>
          <Icon name="back" />
        </button>
        <div className="chips">
          {view.contract ? (
            <span className={`chip contract ${view.contract.contract === "hearts" || view.contract.contract === "diamonds" ? "red" : ""}`} key={view.contract.contract + view.round}>
              {contractLabel(view.contract.contract)}
              {view.contract.multiplier > 1 && <b> ×{view.contract.multiplier}</b>}
            </span>
          ) : (
            <span className="chip">{bg.bidTitle}</span>
          )}
          <span className="chip quiet">
            {bg.roundShort} {view.round}
          </span>
        </div>
        <Controls />
        <button className="score-btn" onClick={() => setSheetOpen(true)} aria-label={bg.scoreTitle}>
          <Icon name="list" size={18} />
          <b>
            <AnimatedNumber value={view.scores[myTeam]} />
          </b>
          <span>:</span>
          <b>
            <AnimatedNumber value={view.scores[otherTeam]} />
          </b>
        </button>
      </header>

      <div className="felt">
        {POSITIONS.slice(1).map((pos, i) => {
          const seat = (me + i + 1) % 4;
          return <Seat key={pos} pos={pos} seat={seat} view={view} count={counts(seat)} busy={busy} name={names[seat]!} connected={room.seats[seat]?.connected ?? false} ours={seat % 2 === myTeam} />;
        })}

        <div className={`center ${sweepTo ? `sweep-${sweepTo}` : ""}`} aria-live="polite">
          {trick.map((play) => (
            <div key={play.seat} className={`played ${POSITIONS[rel(play.seat)]}`}>
              <CardFace card={play.card} small highlight={winnerSeat === play.seat && !sweeping} />
            </div>
          ))}
          {trick.length === 0 && view.phase === "playing" && <p className="hint">{myTurn ? bg.yourTurn : bg.waitingFor(names[view.turn] ?? "")}</p>}
        </div>

        {stage && <DeckStage stage={stage} />}
        {stage && (
          <p className="hint low">
            {stage.kind === "shuffle" && bg.shuffling(dealerName)}
            {stage.kind === "wait" && bg.waitingCut(names[view.turn] ?? "")}
            {stage.kind === "cut" && bg.waitingCut(names[(view.dealer + 3) % 4] ?? "")}
            {stage.kind === "deal" && bg.dealing(dealerName)}
          </p>
        )}

        {callout && <div className="callout">{callout}</div>}

        {view.announcements && view.announcements.length > 0 && (
          <ul className="announced">
            {view.announcements.flatMap(({ seat, announcements }) =>
              announcements.map((a, i) => (
                <li key={`${seat}-${i}`}>
                  <b>{names[seat]}</b> {announcementName[a.kind]}
                  {a.suit ? <span className={isRed(a.suit) ? "red" : ""}> {suitSymbol[a.suit]}</span> : null} {rankLabel[a.high]} · {a.points}
                </li>
              )),
            )}
          </ul>
        )}
      </div>

      {view.phase === "cutting" && stage?.kind === "wait" && view.turn === me && (
        <CutPicker onCut={(position) => send({ type: "cut", position })} />
      )}
      {view.phase === "bidding" && !busy && <Bidding view={view} names={names} onBid={(bid) => send({ type: "bid", bid })} />}

      <Seat pos="bottom" seat={me} view={view} count={counts(me)} busy={busy} name={names[me]!} connected ours />
      <div className={`hand ${myTurn ? "active" : ""}`}>
        {hand.map((card, i) => {
          const ok = view.phase !== "playing" || !myTurn || playable.has(card.suit + card.rank);
          return <CardFace key={card.suit + card.rank} card={card} land={busy} deal={!busy} delay={busy ? 0 : i * 45} disabled={!ok} onClick={myTurn && ok ? () => send({ type: "play", card }) : undefined} />;
        })}
      </div>

      <div className={`scrim ${sheetOpen ? "open" : ""}`} onClick={() => setSheetOpen(false)} />
      <aside className={`drawer ${sheetOpen ? "open" : ""}`} aria-hidden={!sheetOpen}>
        <header>
          <h2>{bg.scoreTitle}</h2>
          <button className="icon-btn" onClick={() => setSheetOpen(false)} aria-label={bg.close}>
            <Icon name="close" />
          </button>
        </header>
        <ScoreSheet view={view} mine={myTeam} />
      </aside>

      {finished && summaryReady && last && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            {view.phase === "gameOver" ? (
              <h2 className={view.winner === myTeam ? "win" : "lose"}>{view.winner === myTeam ? bg.weWin : bg.theyWin}</h2>
            ) : (
              <h2>
                {bg.roundShort} {last.round}
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
                <button className="ghost" onClick={onLeave}>
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
      <dt>{bg.cardPoints}</dt>
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
      {summary.result.outcome === "inside" && <dt className="flag">{bg.inside}</dt>}
      {summary.result.outcome === "tie" && <dt className="flag">{bg.tie}</dt>}
      {summary.capo !== null && <dt className="flag">{bg.capo}</dt>}
    </dl>
  );
}

interface SeatProps {
  pos: Pos;
  seat: number;
  view: GameView;
  name: string;
  connected: boolean;
  ours: boolean;
  /** Cards to show in this seat's hand (it grows while cards are being dealt). */
  count: number;
  /** Shuffle, cut and deal animations are running. */
  busy: boolean;
}

function Seat({ pos, seat, view, name, connected, ours, count, busy }: SeatProps) {
  const turn = !busy && view.turn === seat && (view.phase === "cutting" || view.phase === "bidding" || view.phase === "playing");
  const lastBid = [...view.bidLog].reverse().find((b) => b.seat === seat);
  return (
    <div className={`seat ${pos} ${turn ? "turn" : ""} ${ours ? "ours" : "theirs"} ${connected ? "" : "offline"}`}>
      <div className="name">
        <i className="avatar" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </i>
        <span>{name}</span>
        {pos !== "bottom" && <small className="count">{count}</small>}
        {view.dealer === seat && <em title={bg.dealer}>Р</em>}
        {!connected && <small className="off">{bg.offline}</small>}
      </div>
      {view.phase === "bidding" && !busy && lastBid && (
        <span className="bubble" key={view.bidLog.length}>
          {bidText(lastBid.bid)}
        </span>
      )}
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
