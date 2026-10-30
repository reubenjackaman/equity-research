// Small helpers for saving things in this browser (localStorage).
// Everything is wrapped in try/catch because storage can be blocked (e.g. private windows);
// the app keeps working, it just won't remember.
import { useEffect, useRef, useState } from "react";

const CHANGED = "local-store-changed"; // tells other parts of the page a saved value changed

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {}
  window.dispatchEvent(new CustomEvent(CHANGED, { detail: key }));
}

/** Like useState, but remembered in this browser under `key`, and kept in sync everywhere it's used. */
export function useStored<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  const [loadedKey, setLoadedKey] = useState(key);
  if (loadedKey !== key) {
    setLoadedKey(key);
    setValue(load(key, fallback));
  }

  // Pick up changes made by another component (e.g. the star button updating the top bar).
  useEffect(() => {
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(load(key, fallback));
    };
    window.addEventListener(CHANGED, onChange);
    return () => window.removeEventListener(CHANGED, onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Accepts a value or an updater function, like React's own setState.
  const latest = useRef(value);
  latest.current = value;
  const update = (next: T | ((prev: T) => T)) => {
    const v = typeof next === "function" ? (next as (prev: T) => T)(latest.current) : next;
    latest.current = v;
    setValue(v);
    save(key, v);
  };
  return [value, update] as const;
}

// Keys used across the app, so the Summary tab and tear sheet see the same saved choices.
export const keys = {
  dcf: (ticker: string) => `dcf:${ticker}`,
  peers: (ticker: string) => `peers:${ticker}`,
  saved: "saved-tickers",
  recent: "recent-tickers",
  game: (puzzle: number) => `game-v2:${puzzle}`, // v2: puzzle #1's answer changed, so old progress is ignored
  gameHints: (puzzle: number) => `game-hints:${puzzle}`,
  gameStats: "game-stats",
};

const MAX_RECENT = 8;

/** Your saved (starred) companies. */
export function useSaved() {
  const [saved, setSaved] = useStored<string[]>(keys.saved, []);
  return {
    saved,
    isSaved: (symbol: string) => saved.includes(symbol),
    toggle: (symbol: string) => setSaved(saved.includes(symbol) ? saved.filter((s) => s !== symbol) : [symbol, ...saved]),
    remove: (symbol: string) => setSaved(saved.filter((s) => s !== symbol)),
  };
}

/** Remember a company as recently viewed (newest first). */
export function addRecent(symbol: string) {
  const recent = load<string[]>(keys.recent, []);
  save(keys.recent, [symbol, ...recent.filter((s) => s !== symbol)].slice(0, MAX_RECENT));
}
