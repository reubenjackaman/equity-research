import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Clue, GameCompany, GameGuess, GameHint, GameHintKind, GameToday, gameApi } from "../api";
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

const HINTS: { kind: GameHintKind; label: string }[] = [
  { kind: "news", label: "Recent headline" },
  { kind: "product", label: "What they sell" },
  { kind: "industry", label: "Industry" },
  { kind: "letter", label: "First letter" },
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
  const [hints, setHints] = useStored<GameHint[]>(keys.gameHints(today.puzzle), []);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const last = guesses[guesses.length - 1];
  const won = !!last?.correct;
  const used = guesses.length + hints.length; // a hint uses up a guess
  const over = won || used >= today.maxGuesses;
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
      const result = await gameApi.guess(today.puzzle, used + 1, symbol);
      const next = [...guesses, result];
      setGuesses(next);
      setText("");
      if (result.correct || used + 1 >= today.maxGuesses) recordResult(today.puzzle, result.correct);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function takeHint(kind: GameHintKind) {
    if (busy || over) return;
    setBusy(true);
    setError(null);
    try {
      const hint = await gameApi.hint(today.puzzle, kind);
      setHints([...hints, { ...hint, attempt: used + 1 }]);
    } catch (e) {
      setError((e as Error).message); // nothing is used up if the hint can't be found
    } finally {
      setBusy(false);
    }
  }

  // Guesses and hints in the order they were played, newest first.
  const unused = [...guesses];
  const played = Array.from({ length: used }, (_, i) => hints.find((h) => h.attempt === i + 1) ?? unused.shift()!).reverse();

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
        <span>Puzzle #{today.puzzle}</span>
        <span>
          Guess {Math.min(used + (over ? 0 : 1), today.maxGuesses)} of {today.maxGuesses}
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
      {!over && <HintPicker hints={hints} lastTurn={used >= today.maxGuesses - 1} busy={busy} onPick={takeHint} />}
      {error && <p className="text-sm text-rose-600 dark:text-rose-400">{error}</p>}

      {over && <Result today={today} guesses={guesses} hints={hints} won={won} answer={answer} />}

      <div className="space-y-3">
        {played.map((p) => ("kind" in p ? <HintRow key={p.kind} h={p} /> : <GuessRow key={p.guess.symbol} g={p} />))}
      </div>

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        ▲ means the mystery company's number is higher than your guess, ▼ lower. Green means a match: same sector or listing,
        market cap or P/E within 10%, dividend yield within 0.25 points, 1-year return within 5 points. Market caps are in US
        dollars. Figures are from a market snapshot dated {today.snapshotDate}. A new puzzle starts at midnight Toronto time.
      </p>
    </div>
  );
}

function HintPicker({ hints, lastTurn, busy, onPick }: { hints: GameHint[]; lastTurn: boolean; busy: boolean; onPick: (k: GameHintKind) => void }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-slate-700">
      <div className="text-sm font-semibold">💡 Need a hint? Each one uses up a guess.</div>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {HINTS.map((h) => (
          <button
            key={h.kind}
            onClick={() => onPick(h.kind)}
            disabled={busy || lastTurn || hints.some((x) => x.kind === h.kind)}
            className="rounded-lg border border-slate-300 px-2 py-2 text-sm font-medium transition hover:border-pink-500 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-inherit dark:border-slate-700"
          >
            {h.label}
          </button>
        ))}
      </div>
      {lastTurn && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Your last turn has to be a guess.</p>}
    </div>
  );
}

function HintRow({ h }: { h: GameHint }) {
  const parts = h.text.split("█████");
  return (
    <div className="card border-l-4 border-l-pink-500 p-3 sm:p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-pink-600 dark:text-pink-400">💡 {h.label}</div>
      <p className="mt-1 text-sm leading-relaxed">
        {parts.map((part, i) => (
          <span key={i}>
            {part}
            {i < parts.length - 1 && (
              <span aria-label="hidden word" className="mx-0.5 inline-block select-none rounded-sm bg-slate-300 px-1 align-middle text-slate-500 blur-[3px] dark:bg-slate-600">
                hidden
              </span>
            )}
          </span>
        ))}
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

function Result({ today, guesses, hints, won, answer }: { today: GameToday; guesses: GameGuess[]; hints: GameHint[]; won: boolean; answer: GameCompany | null }) {
  const [stats] = useStored<Stats>(keys.gameStats, NO_STATS);
  const [copied, setCopied] = useState(false);
  const [fallback, setFallback] = useState<string | null>(null);

  const used = guesses.length + hints.length;

  async function share() {
    const rows = guesses.map((g) => (Object.keys(g.clues) as (keyof GameGuess["clues"])[]).map((k) => EMOJI[g.clues[k]]).join(""));
    for (const h of hints) rows.splice(h.attempt - 1, 0, "💡");
    const grid = rows.join("\n");
    const score = won ? `${used}/${today.maxGuesses}` : `X/${today.maxGuesses}`;
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
    <div className="result-pop overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
      <div className={`px-5 py-7 text-center text-white ${won ? "bg-linear-to-r from-pink-600 to-orange-500" : "bg-slate-700"}`}>
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white text-3xl font-bold shadow-md">
          <span className={won ? "text-pink-600" : "text-slate-700"}>{won ? "✓" : "✕"}</span>
        </div>
        <div className="mt-3 text-3xl font-bold tracking-tight">{won ? "You got it!" : "So close!"}</div>
        <div className="mt-1 text-white/90">
          {won ? `Solved in ${used} of ${today.maxGuesses} guesses${hints.length ? `, with ${hints.length} hint${hints.length > 1 ? "s" : ""}` : ""}` : `Out of guesses. Better luck tomorrow.`}
        </div>
        <div className="mt-3 flex justify-center gap-1.5" aria-hidden>
          {Array.from({ length: today.maxGuesses }).map((_, i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < used ? "bg-white" : "bg-white/30"}`} />
          ))}
        </div>
      </div>

      <div className="p-5">
        {answer && (
          <div className="text-center">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">The mystery company was</div>
            <div className="mt-1 text-xl font-bold">{answer.name}</div>
            <Link
              to={`/company/${encodeURIComponent(answer.symbol)}`}
              className="mt-1 inline-block text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
            >
              Research {answer.symbol} →
            </Link>
          </div>
        )}

        <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
          {[
            ["Played", stats.played],
            ["Win rate", stats.played ? `${Math.round((stats.won / stats.played) * 100)}%` : "0%"],
            ["Streak", stats.streak],
            ["Best", stats.best],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 py-2 dark:bg-slate-800/50">
              <dd className="text-xl font-bold">{value}</dd>
              <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            </div>
          ))}
        </dl>

        <button
          onClick={share}
          className="mt-4 w-full rounded-lg bg-linear-to-r from-pink-600 to-orange-500 px-4 py-3 text-base font-bold text-white shadow-md transition hover:brightness-110"
        >
          {copied ? "Copied! Paste it to your friends" : "Share with friends"}
        </button>
        {fallback && <pre className="mt-3 whitespace-pre-wrap rounded-lg bg-slate-100 p-3 text-sm dark:bg-slate-800">{fallback}</pre>}
        <p className="mt-3 text-center text-xs text-slate-500 dark:text-slate-400">Next puzzle in {untilNextPuzzle()}</p>
      </div>
    </div>
  );
}

/** Time left until midnight in Toronto, when the next puzzle starts. */
function untilNextPuzzle() {
  const toronto = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Toronto" }));
  const minutes = 24 * 60 - (toronto.getHours() * 60 + toronto.getMinutes());
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}
