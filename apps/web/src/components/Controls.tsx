import { useEffect, useRef, useState } from "react";
import { bg } from "../i18n/bg";
import { useSound } from "../sound";
import { useTheme } from "../theme";
import { Icon } from "./Icon";

/** Theme and sound switches, shared by every screen. */
export function Controls() {
  const { choice, cycle } = useTheme();
  const { on, toggle } = useSound();
  const themeLabel = { light: bg.themeLight, dark: bg.themeDark }[choice];
  const themeIcon = { light: "sun", dark: "moon" }[choice];
  return (
    <div className="controls">
      <button className="icon-btn" onClick={cycle} aria-label={`${bg.theme}: ${themeLabel}`} title={`${bg.theme}: ${themeLabel}`}>
        <Icon name={themeIcon} />
      </button>
      <button className="icon-btn" onClick={toggle} aria-pressed={on} aria-label={on ? bg.soundOn : bg.soundOff} title={on ? bg.soundOn : bg.soundOff}>
        <Icon name={on ? "volume" : "mute"} />
      </button>
    </div>
  );
}

/** In a game the two switches live behind one button, so the header stays about the game. */
export function GameMenu({ onLeave }: { onLeave: () => void }) {
  const { choice, cycle } = useTheme();
  const { on, toggle } = useSound();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const themeLabel = { light: bg.themeLight, dark: bg.themeDark }[choice];
  const themeIcon = { light: "sun", dark: "moon" }[choice];

  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  return (
    <div className="game-menu" ref={root}>
      <button className="icon-btn" onClick={() => setOpen((o) => !o)} aria-label={bg.menu} aria-expanded={open}>
        <Icon name="more" />
      </button>
      {open && (
        <div className="menu-pop" role="menu">
          <button role="menuitem" onClick={toggle}>
            <Icon name={on ? "volume" : "mute"} />
            <span>{on ? bg.soundOn : bg.soundOff}</span>
          </button>
          <button role="menuitem" onClick={cycle}>
            <Icon name={themeIcon} />
            <span>
              {bg.theme}: {themeLabel}
            </span>
          </button>
          <button role="menuitem" onClick={onLeave}>
            <Icon name="exit" />
            <span>{bg.leaveToMenu}</span>
          </button>
        </div>
      )}
    </div>
  );
}
