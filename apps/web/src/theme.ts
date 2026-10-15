import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "light" | "dark";
const KEY = "belot.theme";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark") return v;
  } catch {
    /* storage unavailable */
  }
  // First visit: start from the system preference; after that the switch only toggles light and dark.
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(choice: ThemeChoice): void {
  document.documentElement.dataset.theme = choice;
}

/** Applies the saved choice immediately (call before first render to avoid a flash). */
export function initTheme(): void {
  apply(read());
}

const ORDER: ThemeChoice[] = ["light", "dark"];

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(read);
  useEffect(() => apply(choice), [choice]);
  const cycle = useCallback(() => {
    setChoice((c) => {
      const next = ORDER[(ORDER.indexOf(c) + 1) % ORDER.length]!;
      try {
        localStorage.setItem(KEY, next);
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);
  return { choice, cycle };
}
