import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clue, GameCompany, GameGuess, GameToday, gameApi } from "../api";
import * as fmt from "../format";
import { keys, load, save, useStored } from "../storage";

type Stats = { played: number; won: number; streak: number; best: number };
const NO_STATS: Stats = { played: 0, won: 0, streak: 0, best: 0 };

const TILES: { key: keyof GameGuess["clues"]; label: string; value: (c: GameCompany) => string }[] = [
  { key: "sector", label: "Sector", value: (c) => c.sector },
  { key: "country", label: "Listed in", value: (c) => c.country },
  { key: "marketCap", label: "Market cap", value: (c) => `$${fmt.big(c.marketCapUsd)}` },
  { key: "pe", label: "P/E", value: (c) => (c.pe === null ? "N/A" : `${c.pe.toFixed(1)}x`) },
  { key: "dividend", label: "Div. yield", value: (c) => fmt.pct(c.dividendYield) },
  { key: "yearReturn", label: "1-yr return", value: (c) => (c.yearChangePercent === null ? "N/A" : `${fmt.signed(c.yearChangePercent, 0)}%`) },
];

const EMOJI: Record<Clue, string> = { match: "🟩", miss: "⬜", unknown: "⬜", higher: "⬆️", lower: "⬇️" };

export default function Game() {
  const [today, setToday] = useState<GameToday | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    document.title = "Mystery Company · Reuben Jackaman";
    gameApi.today().then(setToday).catch((e) => setError(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Mystery Company</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        A new hidden company every day. Guess any company and use its numbers as clues: arrows show whether the mystery
        company is higher or lower.
      </p>
      {error && <p className="card mt-6 text-sm text-slate-500">The game couldn't load: {error}</p>}
      {!error && !today && <div className="mt-6 h-64 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />}
      {today && <Board key={today.puzzle} today={today} />}
    </div>
  );
}

function Board({ today }: { today: GameToday }) {
  const [guesses, setGuesses] = useStored<GameGuess[]>(keys.game(today.puzzle), []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = guesses[guesses.length - 1];
  const won = !!last?.correct;
  const over = won || guesses.length >= today.maxGuesses;
  const answer = last?.answer ?? null;

  const guessed = new Set(guesses.map((g) => g.guess.symbol));
  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    const hits = today.companies.filter(
      (c) => !guessed.has(c.symbol) && (c.symbol.toLowerCase().startsWith(q) || c.name.toLowerCase().includes(q)),
    );
    // Exact ticker first, then ticker matches, then name matches.
    const rank = (c: { symbol: string }) => (c.symbol.toLowerCase() === q ? 0 : c.symbol.toLowerCase().startsWith(q) ? 1 : 2);
    return hits.sort((a, b) => rank(a) - rank(b)).slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, guesses.length, today.companies]);

  async function submit(symbol: string) {
    if (busy || over) return;
    setBusy(true);
    setError(null);
    try {
      const result = await gameApi.guess(today.puzzle, guesses.length + 1, symbol);
      const next = [...guesses, result];
      setGuesses(next);
      setText("");
      if (result.correct || next.length >= today.maxGuesses) recordResult(today.puzzle, result.correct);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Puzzle #{today.puzzle}</span>
        <span>
          Guess {Math.min(guesses.length + (over ? 0 : 1), today.maxGuesses)} of {today.maxGuesses}
        </span>
      </div>

      {!over && (
        <div className="relative">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && matches[0]) submit(matches[0].symbol);
            }}
            disabled={busy}
            placeholder="Type a company or ticker"
            aria-label="Guess a company"
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-900"
          />
          {matches.length > 0 && (
            <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900">
              {matches.map((c) => (
                <li key={c.symbol}>
                  <button
                    onClick={() => submit(c.symbol)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <span className="w-20 shrink-0 font-semibold">{c.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-600 dark:text-slate-300">{c.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {text.trim() && matches.length === 0 && (
            <p className="mt-1 text-xs text-slate-500">No match. The game covers US and TSX companies over $300M.</p>
          )}
        </div>
      )}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {over && <Result today={today} guesses={guesses} won={won} answer={answer} />}

      <div className="space-y-3">
        {[...guesses].reverse().map((g) => (
          <GuessRow key={g.guess.symbol} g={g} />
        ))}
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ▲ means the mystery company's number is higher than your guess, ▼ lower. Green means a match: same sector or listing,
        market cap or P/E within 10%, dividend yield within 0.25 points, 1-year return within 5 points. Market caps are in US
        dollars. Figures are from a market snapshot dated {today.snapshotDate}. A new puzzle starts at midnight Toronto time.
      </p>
    </div>
  );
}

function GuessRow({ g }: { g: GameGuess }) {
  return (
    <div className="card p-3 sm:p-3">
      <div className="mb-2 flex items-baseline gap-2">
        <span className="font-semibold">{g.guess.symbol}</span>
        <span className="truncate text-sm text-slate-500 dark:text-slate-400">{g.guess.name}</span>
      </div>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
        {TILES.map((t) => {
          const clue = g.clues[t.key];
          const arrow = clue === "higher" ? "▲" : clue === "lower" ? "▼" : "";
          return (
            <div
              key={t.key}
              className={`rounded-lg px-2 py-1.5 text-center ${
                clue === "match"
                  ? "bg-emerald-600 text-white"
                  : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100"
              }`}
            >
              <div className={`text-[10px] uppercase tracking-wide ${clue === "match" ? "text-emerald-100" : "text-slate-500 dark:text-slate-400"}`}>{t.label}</div>
              <div className="truncate text-sm font-semibold" title={t.value(g.guess)}>
                {t.value(g.guess)} {arrow && <span aria-label={clue === "higher" ? "answer is higher" : "answer is lower"}>{arrow}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function recordResult(puzzle: number, won: boolean) {
  const lastKey = "game-last-puzzle";
  if (load<number>(lastKey, 0) >= puzzle) return; // already counted
  const previous = load<number>(lastKey, 0);
  const s = load<Stats>(keys.gameStats, NO_STATS);
  const streak = won ? (previous === puzzle - 1 ? s.streak + 1 : 1) : 0;
  save(keys.gameStats, { played: s.played + 1, won: s.won + (won ? 1 : 0), streak, best: Math.max(s.best, streak) });
  save(lastKey, puzzle);
}

function Result({ today, guesses, won, answer }: { today: GameToday; guesses: GameGuess[]; won: boolean; answer: GameCompany | null }) {
  const [stats] = useStored<Stats>(keys.gameStats, NO_STATS);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  async function share() {
    const grid = guesses.map((g) => (Object.keys(g.clues) as (keyof GameGuess["clues"])[]).map((k) => EMOJI[g.clues[k]]).join("")).join("\n");
    const score = won ? `${guesses.length}/${today.maxGuesses}` : `X/${today.maxGuesses}`;
    const text = `Mystery Company #${today.puzzle} ${score}\n${grid}\n${window.location.origin}/game`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setFallback(text); // clipboard blocked: show the result so it can be copied by hand
    }
  }

  return (
    <div className="card">
      <div className="text-lg font-semibold">{won ? `Solved in ${guesses.length}!` : "Out of guesses"}</div>
      {answer && (
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          The mystery company was{" "}
          <Link to={`/company/${encodeURIComponent(answer.symbol)}`} className="font-semibold text-blue-600 hover:underline dark:text-blue-400">
            {answer.name} ({answer.symbol})
          </Link>
          .
        </p>
      )}
      <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
        {[
          ["Played", stats.played],
          ["Won", stats.played ? `${Math.round((stats.won / stats.played) * 100)}%` : "0%"],
          ["Streak", stats.streak],
          ["Best", stats.best],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
            <dd className="text-lg font-semibold">{value}</dd>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
          </div>
        ))}
      </dl>
      <button onClick={share} className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        {copied ? "Copied!" : "Share result"}
      </button>
      {fallback && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{fallback}</pre>}
    </div>
  );
}
