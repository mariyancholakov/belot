import { useEffect, useMemo, useRef, useState } from "react";
import { strength, type Card, type Contract, type GameAction, type GameEvent, type GameView, type Play } from "@belot/engine";
import type { RoomState } from "@belot/protocol";
import { announcementName, bg, contractLabel, contractName, contractRed, contractSymbol, isRed, rankLabel, suitName, suitSymbol } from "../i18n/bg";
import { playSound } from "../sound";
import { AnimatedNumber } from "./AnimatedNumber";
import { SuitText } from "./SuitText";
import { Avatar } from "./Avatar";
import { Bidding, bidText } from "./Bidding";
import { CardBack, CardFace } from "./Card";
import { AnnouncePrompt, BelotPrompt } from "./Declare";
import { Controls } from "./Controls";
import { CutPicker, DEAL_FLY, DEAL_GAP, DealPrompt, DeckStage, ShufflePrompt, dealPackets, type Stage } from "./Dealing";
import { Icon } from "./Icon";
import { ScoreSheet } from "./ScoreSheet";

const SUIT_ORDER = ["clubs", "diamonds", "spades", "hearts"] as const;
/** How long a finished trick stays on the table, and how long the sweep to the winner takes. */
const HOLD_MS = 1500;
const SWEEP_MS = 380;
/** The riffle shuffle, and the cut animation, before cards are dealt. */
const SHUFFLE_MS = 2100;
const CUT_MS = 1250;

/** The hand as a player arranges it: suits in alternating colours, trumps last, and inside each suit from the weakest card on the left to the strongest on the right. */
function sortHand(hand: Card[], contract: Contract | null): Card[] {
  // trumps sit on the right; working back from them each suit is the other colour where the hand allows it
  const present = SUIT_ORDER.filter((suit) => hand.some((c) => c.suit === suit));
  const suits: Card["suit"][] = present.includes(contract as Card["suit"]) ? [contract as Card["suit"]] : [];
  while (suits.length < present.length) {
    const left = present.filter((suit) => !suits.includes(suit));
    const first = suits[0];
    suits.unshift(left.find((suit) => first === undefined || isRed(suit) !== isRed(first)) ?? left[0]!);
  }
  const by = contract ?? "no-trumps";
  return [...hand].sort((a, b) => suits.indexOf(a.suit) - suits.indexOf(b.suit) || strength(a, by) - strength(b, by));
}

type Pos = "bottom" | "right" | "top" | "left";
const POSITIONS: Pos[] = ["bottom", "right", "top", "left"];

interface Props {
  view: GameView;
  room: RoomState;
  events: GameEvent[];
  updateId: number;
  /** Time the player to move has left; null when no clock runs. */
  turnLeftMs: number | null;
  send: (action: GameAction) => void;
  onNewGame: () => void;
  onLeave: () => void;
}

export function Table({ view, room, events, updateId, turnLeftMs, send, onNewGame, onLeave }: Props) {
  const me = view.seat;
  const myTeam = (me % 2) as 0 | 1;
  const otherTeam = myTeam === 0 ? 1 : 0;
  const names = room.seats.map((s) => s?.nickname ?? "—");
  const rel = (seat: number) => (seat - me + 4) % 4;

  // A finished trick stays on screen briefly, then sweeps to whoever took it.
  const [held, setHeld] = useState<{ plays: Play[]; winner: number } | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [callout, setCallout] = useState<{ seat: number; text: string } | null>(null);
  /** A card waiting for the player to say whether they call belot with it ("claim": while laying the cards down). */
  const [askBelot, setAskBelot] = useState<Card | "claim" | null>(null);
  /** The hand a player just laid down, shown face up for a moment. */
  const [laid, setLaid] = useState<{ seat: number; hands: Card[][] } | null>(null);
  const laidAt = useRef(0);
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
  /** Bumped whenever a new animation starts, so a superseded one stops touching the state. */
  const animGen = useRef(0);
  const later = (gen: number, ms: number, fn: () => void) => {
    animTimers.current.push(
      setTimeout(() => {
        if (gen === animGen.current) fn();
      }, ms),
    );
  };
  useEffect(() => () => animTimers.current.forEach(clearTimeout), []);

  // The lucky card ("късметче") stays face up beside its owner until it is played.
  const [luckyHidden, setLuckyHidden] = useState(false);
  const [luckyGone, setLuckyGone] = useState(false);
  /** Cards that arrived by the deal animation settle in; cards on a reloaded page deal in themselves. */
  const [dealtByAnimation, setDealtByAnimation] = useState(false);

  const startDeal = (rest: boolean, dealer: number, hasLucky: boolean) => {
    const gen = ++animGen.current;
    const sizes = dealPackets(rest);
    const seats = [1, 2, 3, 4].map((i) => (dealer + i) % 4);
    const counts = rest ? [5, 5, 5, 5] : [0, 0, 0, 0];
    setShown([...counts]);
    setStage({ kind: "deal", rest, order: seats.map((seat) => POSITIONS[rel(seat)]!) });
    setDealtByAnimation(true);
    if (!rest) {
      setLuckyGone(false);
      setLuckyHidden(hasLucky);
    }
    sizes.forEach((size, p) => {
      playSound("dealPacket", p * DEAL_GAP);
      later(gen, p * DEAL_GAP + DEAL_FLY, () => {
        counts[seats[p % 4]!]! += size;
        setShown([...counts]);
        if (p === 0 && hasLucky) {
          setLuckyHidden(false);
          playSound("belot");
        }
      });
    });
    later(gen, sizes.length * DEAL_GAP + DEAL_FLY + 120, () => {
      setStage(null);
      setShown(null);
      const v = viewRef.current;
      if ((v.phase === "bidding" || v.phase === "playing") && v.turn === v.seat) playSound("turn");
    });
  };

  const startCut = (position: number) => {
    const gen = ++animGen.current;
    setShown(null);
    setStage({ kind: "cut", position });
    playSound("cut");
    later(gen, CUT_MS, () => setStage({ kind: "wait" }));
  };

  // What sits on the felt while a deal is being prepared: the shuffle, or just the deck.
  useEffect(() => {
    if (view.phase === "cutting") setDealtByAnimation(false);
    if (view.phase === "cutting" && view.fresh) {
      ++animGen.current;
      setShown(null);
      setStage({ kind: "shuffle" });
      playSound("shuffle");
      const t = setTimeout(() => setStage((s) => (s?.kind === "shuffle" ? { kind: "wait" } : s)), SHUFFLE_MS);
      return () => clearTimeout(t);
    }
    if (view.phase === "shuffling" || view.phase === "cutting" || view.phase === "dealing") {
      setStage((s) => s ?? { kind: "wait" });
    }
  }, [view.phase, view.dealer, view.round, view.fresh]);

  useEffect(() => {
    if (updateId === lastUpdate.current) return;
    lastUpdate.current = updateId;
    const timers: ReturnType<typeof setTimeout>[] = [];

    let animating = stageRef.current !== null;
    const cutEvent = events.find((e) => e.type === "cut");
    const dealtEvent = events.find((e) => e.type === "dealt");
    if (cutEvent && cutEvent.type === "cut") {
      startCut(cutEvent.position);
      animating = true;
    }
    if (dealtEvent && dealtEvent.type === "dealt") {
      startDeal(false, view.dealer, dealtEvent.lucky !== null);
      animating = true;
    } else if ((view.phase === "bidding" || view.phase === "playing") && (stageRef.current?.kind === "shuffle" || stageRef.current?.kind === "wait")) {
      // The deal update was missed (it arrived together with a later one): show the cards anyway.
      setStage(null);
    }

    for (const e of events) {
      switch (e.type) {
        case "played":
          playSound("play");
          if (viewRef.current.lucky && e.card.suit === viewRef.current.lucky.card.suit && e.card.rank === viewRef.current.lucky.card.rank) {
            setLuckyGone(true);
          }
          break;
        case "contract":
          startDeal(true, view.dealer, false);
          animating = true;
          break;
        case "bid":
          playSound(e.bid.type === "pass" ? "pass" : e.bid.type === "bid" ? "bid" : "contra");
          break;
        case "belot":
          setCallout({ seat: e.seat, text: `${bg.belot} ${suitSymbol[e.suit]} +20` });
          timers.push(setTimeout(() => setCallout(null), 2400));
          timers.push(setTimeout(() => playSound("belot"), 120));
          break;
        case "announced":
          setCallout({ seat: e.seat, text: e.kinds.map((k) => announcementName[k]).join(", ") });
          timers.push(setTimeout(() => setCallout(null), 2600));
          playSound("belot");
          break;
        case "claimed":
          laidAt.current = Date.now();
          setLaid({ seat: e.seat, hands: e.hands.map((h) => sortHand(h, view.contract?.contract ?? null)) });
          setCallout({ seat: e.seat, text: bg.claimSay });
          timers.push(setTimeout(() => setCallout(null), 2600));
          timers.push(setTimeout(() => setLaid(null), 4200));
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
    const t = setTimeout(() => setSummaryReady(true), Date.now() - laidAt.current < 1000 ? 3500 : HOLD_MS + 200);
    return () => clearTimeout(t);
  }, [finished]);

  const [sheetOpen, setSheetOpen] = useState(false);

  // The card you play leaves your hand and lands on the table at once; the server's update then confirms it.
  const [pending, setPending] = useState<Card | null>(null);
  const isPending = (c: Card) => pending !== null && c.suit === pending.suit && c.rank === pending.rank;
  useEffect(() => {
    if (pending && !view.hand.some(isPending)) setPending(null);
    // a refused play (or a lost message) puts the card back in the hand
    const t = pending ? setTimeout(() => setPending(null), 2500) : undefined;
    return () => clearTimeout(t);
  }, [view, pending]);
  const playCard = (card: Card, belot?: boolean) => {
    setPending(card);
    send(belot === undefined ? { type: "play", card } : { type: "play", card, belot });
  };

  const shownTrick: Play[] = view.trick.length > 0 ? view.trick : held?.plays ?? [];
  const trick: Play[] =
    pending && !shownTrick.some((p) => p.seat === me) ? [...(view.trick.length > 0 ? view.trick : []), { seat: me, card: pending }] : shownTrick;
  const winnerSeat = view.trick.length === 0 ? held?.winner : undefined;
  const sweepTo = winnerSeat !== undefined && sweeping ? POSITIONS[rel(winnerSeat)] : null;

  const playable = useMemo(() => {
    const set = new Set<string>();
    for (const a of view.legalActions) if (a.type === "play") set.add(a.card.suit + a.card.rank);
    return set;
  }, [view.legalActions]);
  const busy = stage !== null;
  /** An animation is moving cards; "wait" is just the deck lying on the felt. */
  const animating = stage !== null && stage.kind !== "wait";
  const dealtSoFar = shown ?? (busy ? [0, 0, 0, 0] : null);
  const myTurn = view.phase === "playing" && view.turn === me && !busy && !pending;
  const hand = sortHand(dealtSoFar ? view.hand.slice(0, dealtSoFar[me]) : view.hand, view.contract?.contract ?? null).filter((c) => !isPending(c));
  // The hand is pointed at as a whole: whichever card's strip the pointer is over comes up. Done on the DOM
  // directly so moving the pointer never re-renders the table.
  const handEl = useRef<HTMLDivElement>(null);
  const chooseRef = useRef<((() => void) | undefined)[]>([]);
  const hotSlot = useRef<Element | null>(null);
  const touchAt = useRef(0);
  const cardAt = (x: number, y: number): number | null => {
    const root = handEl.current;
    if (!root) return null;
    const box = root.getBoundingClientRect();
    if (y < box.top - 40 || y > box.bottom) return null;
    const slots = [...root.querySelectorAll(".hand-slot")];
    if (slots.length === 0) return null;
    const first = slots[0]!.getBoundingClientRect();
    const last = slots[slots.length - 1]!.getBoundingClientRect();
    if (x < first.left - 12 || x > last.right + 12) return null;
    const i = slots.findIndex((el) => x < el.getBoundingClientRect().right);
    return i === -1 ? slots.length - 1 : i;
  };
  const hoverCard = (x: number | null, y: number | null) => {
    const i = x === null || y === null ? null : cardAt(x, y);
    const el = i === null ? null : handEl.current?.querySelectorAll(".hand-slot")[i] ?? null;
    if (el === hotSlot.current) return;
    hotSlot.current?.removeAttribute("data-hot");
    el?.setAttribute("data-hot", "");
    hotSlot.current = el;
  };
  const myBidTurn = view.phase === "bidding" && !busy && view.legalActions.some((a) => a.type === "bid");
  const cutting = view.phase === "cutting" && stage?.kind === "wait" && view.turn === me;
  /** The shuffle and deal choices are popups; the status line would repeat them. */
  const deciding = stage?.kind === "wait" && view.turn === me && (view.phase === "shuffling" || view.phase === "dealing");
  const dealerName = names[view.dealer] ?? "";
  const lucky = view.lucky && !luckyGone && !luckyHidden && (view.phase === "bidding" || view.phase === "playing") ? view.lucky : null;
  const counts = (seat: number) => (dealtSoFar ? dealtSoFar[seat]! : view.handCounts[seat] ?? 0);
  const last = view.history[view.history.length - 1];
  return (
    <div className="table">
      <header className="topbar">
        <div className="chips">
        </div>
        <button className="score-btn" onClick={() => setSheetOpen(true)} aria-label={`${bg.scoreTitle}: ${bg.teamUs} ${view.scores[myTeam]}, ${bg.teamThem} ${view.scores[otherTeam]}`}>
          <ScoreTeam label={bg.teamUs} value={view.scores[myTeam]} cls="us" />
          <ScoreTeam label={bg.teamThem} value={view.scores[otherTeam]} cls="them" />
        </button>
        <span className="topbar-controls">
          <Controls />
          <button className="leave-btn" onClick={onLeave} aria-label={bg.leaveGame} title={bg.leaveGame}>
            <Icon name="exit" size={18} /> <span>{bg.leave}</span>
          </button>
        </span>
      </header>

      <div className="felt">
        {view.contract && (
          <div className="trump" key={view.contract.contract + view.round} aria-live="polite">
            <small>{bg.trumpLabel}</small>
            <span className="trump-main">
              <i className={contractRed(view.contract.contract) ? "red" : ""} aria-hidden="true">
                {contractSymbol(view.contract.contract)}
              </i>
              <b>
                {contractName(view.contract.contract)}
                {view.contract.multiplier > 1 && ` ×${view.contract.multiplier}`}
              </b>
            </span>
          </div>
        )}
        {POSITIONS.slice(1).map((pos, i) => {
          const seat = (me + i + 1) % 4;
          return <Seat key={pos} pos={pos} seat={seat} view={view} count={counts(seat)} busy={animating} lucky={lucky?.seat === seat ? lucky.card : null} callout={callout?.seat === seat ? callout.text : null} clock={turnLeftMs} clockKey={updateId} name={names[seat]!} connected={room.seats[seat]?.connected ?? false} ours={seat % 2 === myTeam} />;
        })}

        <div className={`center ${sweepTo ? `sweep-${sweepTo}` : ""}`} aria-live="polite">
          {trick.map((play) => (
            <div key={play.seat} className={`played ${POSITIONS[rel(play.seat)]}`}>
              <CardFace card={play.card} small highlight={winnerSeat === play.seat && !sweeping} />
            </div>
          ))}
        </div>

        {stage && !cutting && <DeckStage stage={stage} />}
        {!stage && view.phase === "bidding" && <DeckStage stage={{ kind: "talon" }} />}
        {cutting && <CutPicker onCut={(position) => send({ type: "cut", position })} />}

        {myTurn && view.pendingAnnouncements && !askBelot && (
          <AnnouncePrompt options={view.pendingAnnouncements} onChoose={(declare) => send({ type: "announce", declare })} />
        )}
        {myTurn && askBelot && (
          <BelotPrompt
            cards={askBelot === "claim" ? view.hand.filter((c) => c.rank === "K" || c.rank === "Q").filter((c) => view.claimBelots.includes(c.suit)) : view.hand.filter((c) => (c.rank === "K" || c.rank === "Q") && c.suit === askBelot.suit)}
            onChoose={(call) => {
              if (askBelot === "claim") send({ type: "claim", belot: call });
              else playCard(askBelot, call);
              setAskBelot(null);
            }}
          />
        )}
        {myTurn && !view.pendingAnnouncements && !askBelot && view.legalActions.some((a) => a.type === "claim") && (
          <button className="claim-btn" onClick={() => (view.claimBelots.length > 0 ? setAskBelot("claim") : send({ type: "claim" }))}>
            {bg.claim}
          </button>
        )}
        {laid &&
          laid.hands.map((cards, seat) =>
            cards.length === 0 ? null : (
              <div key={seat} className={`laid ${POSITIONS[(seat - me + 4) % 4]} ${seat === laid.seat ? "claimer" : ""}`} aria-label={seat === laid.seat ? bg.claimSay : names[seat]}>
                {cards.map((c) => (
                  <CardFace key={c.suit + c.rank} card={c} small />
                ))}
              </div>
            ),
          )}

        {myBidTurn && <Bidding view={view} names={names} onBid={(bid) => send({ type: "bid", bid })} />}
        {view.phase === "shuffling" && stage?.kind === "wait" && view.turn === me && (
          <ShufflePrompt onChoose={(shuffle) => send({ type: shuffle ? "shuffle" : "skipShuffle" })} />
        )}
        {view.phase === "dealing" && stage?.kind === "wait" && view.turn === me && (
          <DealPrompt onDeal={(luckyCard) => send({ type: "deal", lucky: luckyCard })} />
        )}
      </div>

      <Seat pos="bottom" seat={me} view={view} count={counts(me)} busy={animating} lucky={null} callout={callout?.seat === me ? callout.text : null} clock={turnLeftMs} clockKey={updateId} name={names[me]!} connected ours />
      <div
        className={`hand ${myTurn ? "active" : ""}`}
        ref={handEl}
        onPointerMove={(e) => e.pointerType === "mouse" && hoverCard(e.clientX, e.clientY)}
        onPointerLeave={() => hoverCard(null, null)}
        // A finger plays the card it touches, at once: one tap, no holding, sliding or waiting for a click.
        onPointerDown={(e) => {
          if (e.pointerType === "mouse") return;
          touchAt.current = Date.now();
          const i = cardAt(e.clientX, e.clientY);
          if (i !== null) chooseRef.current[i]?.();
        }}
        onClick={(e) => {
          if (Date.now() - touchAt.current < 800) return;
          const i = cardAt(e.clientX, e.clientY);
          if (i !== null) chooseRef.current[i]?.();
        }}
      >
        {hand.map((card, i) => {
          const ok = view.phase !== "playing" || !myTurn || playable.has(card.suit + card.rank);
          const mid = (hand.length - 1) / 2;
          const choose = myTurn && ok ? () => (view.belotCards.some((b) => b.suit === card.suit && b.rank === card.rank) ? setAskBelot(card) : playCard(card)) : undefined;
          chooseRef.current[i] = choose;
          return (
            <div key={card.suit + card.rank} className={`hand-slot ${ok ? "" : "off"}`}>
              <CardFace card={card} fan={i - mid} lucky={view.lucky?.seat === me && view.lucky.card.suit === card.suit && view.lucky.card.rank === card.rank && !luckyGone} land={dealtByAnimation} deal={!dealtByAnimation} delay={dealtByAnimation ? 0 : i * 45} disabled={!ok} onClick={choose} />
            </div>
          );
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
        <ScoreSheet rounds={view.history} scores={view.scores} hanging={view.hanging} mine={myTeam} />
      </aside>

      {finished && summaryReady && last && (
        <div className="overlay" role="dialog" aria-modal="true">
          <div className="modal">
            {view.phase === "gameOver" ? (
              <h2 className={view.winner === myTeam ? "win" : "lose"}>{view.winner === myTeam ? bg.weWin : bg.theyWin}</h2>
            ) : (
              <h2>{bg.roundTitle(last.bidder % 2 === myTeam, last.result.outcome)}</h2>
            )}
            <p className="modal-sub">
              {bg.roundShort} {last.round} · <b>{names[last.bidder]}</b> · <SuitText text={contractLabel(last.contract)} />
              {last.multiplier > 1 && ` ×${last.multiplier}`}
            </p>
            <RoundDetails summary={last} myTeam={myTeam} />
            <div className="totals" aria-label={bg.total}>
              <ScoreTeam label={bg.teamUs} value={view.scores[myTeam]} cls="us" big />
              <ScoreTeam label={bg.teamThem} value={view.scores[otherTeam]} cls="them" big />
            </div>
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

/** One team's running total, with a thin track showing how far it is from 151. */
function ScoreTeam({ label, value, cls, big }: { label: string; value: number; cls: "us" | "them"; big?: boolean }) {
  // the tile turns over like a card whenever the team's points change
  const [flip, setFlip] = useState(false);
  const shown = useRef(value);
  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    setFlip(true);
    const t = setTimeout(() => setFlip(false), 520);
    return () => clearTimeout(t);
  }, [value]);
  return (
    <span className={`score-team ${cls} ${big ? "big" : ""} ${flip ? "flip" : ""}`}>
      <small>{label}</small>
      <b>
        <AnimatedNumber value={value} />
      </b>
      <i className="to-win" style={{ ["--p" as string]: `${Math.min(100, (value / 151) * 100)}%` }} />
    </span>
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
      <dt className="recorded">{bg.recorded}</dt>
      <dd className="recorded">
        {summary.result.recorded[myTeam]} : {summary.result.recorded[other]}
      </dd>
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
  /** The face-up lucky card this player holds, if any. */
  lucky: Card | null;
  /** A one-off line this player just said, such as the belot call. */
  callout: string | null;
  /** Time the player to move has left, and a key that restarts the bar on every update. */
  clock: number | null;
  clockKey: number;
}

function Seat({ pos, seat, view, name, connected, ours, count, busy, lucky, callout, clock, clockKey }: SeatProps) {
  const turn = !busy && view.turn === seat && view.phase !== "roundEnd" && view.phase !== "gameOver";
  /** A person to move has a clock: it runs down as a ring round their avatar. */
  const timed = turn && clock !== null && (view.phase === "bidding" || view.phase === "playing");
  const lastBid = [...view.bidLog].reverse().find((b) => b.seat === seat);
  const declared = view.announcements
    ?.filter((a) => a.seat === seat)
    .flatMap((a) => a.announcements.map((x) => `${announcementName[x.kind]}${x.suit ? ` ${suitSymbol[x.suit]}` : ""} · ${x.points}`))
    .join(", ");
  const say = callout ?? (view.phase === "bidding" && !busy && lastBid ? bidText(lastBid.bid) : null) ?? (declared || null);
  return (
    <div className={`seat ${pos} ${turn ? "turn" : ""} ${ours ? "ours" : "theirs"} ${connected ? "" : "offline"}`}>
      <div className="name">
        <i className={`avatar-slot ${timed ? "timed" : ""}`} aria-hidden="true">
          <i className="avatar">
            <Avatar name={name} size={44} />
          </i>
          {timed && <i className="clock" key={clockKey} style={{ ["--dur" as string]: `${clock}ms` }} />}
        </i>
        <span>{name}</span>
        {!connected && <small className="off">{bg.offline}</small>}
        {say && (
          <span className="balloon" key={say}>
            <SuitText text={say} />
          </span>
        )}
      </div>
      {pos !== "bottom" && (
        <div className="backs" aria-label={`${count}`}>
          {Array.from({ length: Math.min(count, 8) }, (_, i) => {
            const off = i - (Math.min(count, 8) - 1) / 2;
            return i === 0 && lucky ? <CardFace key="lucky" card={lucky} small lucky fan={off} /> : <CardBack key={i} small fan={off} />;
          })}
        </div>
      )}
    </div>
  );
}
