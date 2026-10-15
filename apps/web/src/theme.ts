import { useCallback, useEffect, useState } from "react";

export type ThemeChoice = "auto" | "light" | "dark";
const KEY = "belot.theme";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === "light" || v === "dark" || v === "auto") return v;
  } catch {
    /* storage unavailable */
  }
  return "auto";
}

function apply(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === "auto") delete root.dataset.theme;
  else root.dataset.theme = choice;
}

/** Applies the saved choice immediately (call before first render to avoid a flash). */
export function initTheme(): void {
  apply(read());
}

const ORDER: ThemeChoice[] = ["auto", "light", "dark"];

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
