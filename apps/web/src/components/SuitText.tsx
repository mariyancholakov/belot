import { Fragment } from "react";

/** Text with the red signs (♥ ♦, and the J of all trumps) drawn in the cards' red ink, wherever a bid, contract or callout names them. */
export function SuitText({ text }: { text: string }) {
  const parts = text.split(/([♥♦]|J(?= Всичко коз))/);
  return (
    <>
      {parts.map((p, i) => (p === "♥" || p === "♦" || p === "J" ? <span key={i} className="red">{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
