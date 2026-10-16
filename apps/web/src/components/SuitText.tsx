import { Fragment } from "react";

/** Text with the red suits (♥ ♦) drawn in the cards' red ink, wherever a bid, contract or callout names them. */
export function SuitText({ text }: { text: string }) {
  const parts = text.split(/([♥♦])/);
  return (
    <>
      {parts.map((p, i) => (p === "♥" || p === "♦" ? <span key={i} className="red">{p}</span> : <Fragment key={i}>{p}</Fragment>))}
    </>
  );
}
