import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, SearchResult } from "../api";
import { COMPANY_FUNCTIONS, MARKET_FUNCTIONS, companyFunction, companyPath, parseCommand } from "../functions";

export const OPEN_ASK = "open-ask-finch"; // window event: the command bar asks Ask Finch to open

type Suggestion =
  | { kind: "fn"; code: string; label: string; detail: string; path: string }
  | { kind: "ticker"; symbol: string; name: string; exchange: string };

/** The symbol of the company page being viewed, if any. */
export function useCurrentSymbol() {
  const { pathname } = useLocation();
  const m = pathname.match(/^\/company\/([^/]+)/);
  return m ? decodeURIComponent(m[1]).toUpperCase() : null;
}

/**
 * The terminal's command line. Type a ticker, a company name or a function code and press Enter:
 * "AAPL", "AAPL GP", "RY.TO DCF", "WEI", "GC", or "GP" alone on a company page.
 * Press "/" (or Ctrl/Cmd+K) anywhere to jump here.
 */
export default function CommandBar({ large = false }: { large?: boolean }) {
  const navigate = useNavigate();
  const symbol = useCurrentSymbol();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (large) return; // only the top bar's command line answers the "/" shortcut
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLElement && (e.target.closest("input, textarea, select, [contenteditable]") !== null);
      if ((e.key === "/" && !typing) || (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey))) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [large]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const words = query.trim().toUpperCase().split(/\s+/).filter(Boolean);

  // Company search, 250 ms after typing stops. Skipped when the text is clearly a function.
  useEffect(() => {
    const q = words.length > 1 && COMPANY_FUNCTIONS.some((f) => f.code.startsWith(words[words.length - 1])) ? words[0] : query.trim();
    if (!q || MARKET_FUNCTIONS.some((f) => f.code === q.toUpperCase())) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .search(q, controller.signal)
        .then(setResults)
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const suggestions = useMemo<Suggestion[]>(() => {
    const out: Suggestion[] = [];
    const first = words[0] ?? "";
    const matches = (code: string, aliases: string[], name: string, w: string) =>
      !w || code.startsWith(w) || aliases.some((a) => a.startsWith(w)) || (w.length > 2 && name.toUpperCase().includes(w));
    if (words.length <= 1) {
      for (const f of MARKET_FUNCTIONS) {
        if (matches(f.code, f.aliases, f.name, first)) out.push({ kind: "fn", code: f.code, label: f.code, detail: f.name, path: f.path });
      }
      if (symbol) {
        for (const f of COMPANY_FUNCTIONS) {
          if (matches(f.code, f.aliases, f.name, first))
            out.push({ kind: "fn", code: f.code, label: `${symbol} ${f.code}`, detail: f.name, path: companyPath(symbol, f.tab) });
        }
      }
    } else {
      const last = words[words.length - 1];
      const ticker = words.slice(0, -1).join("");
      for (const f of COMPANY_FUNCTIONS) {
        if (matches(f.code, f.aliases, f.name, last))
          out.push({ kind: "fn", code: f.code, label: `${ticker} ${f.code}`, detail: f.name, path: companyPath(ticker, f.tab) });
      }
    }
    const fns = words.length ? out.slice(0, 6) : out;
    return [...fns, ...results.slice(0, 8).map((r): Suggestion => ({ kind: "ticker", ...r }))];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, results, symbol]);

  useEffect(() => setActive(-1), [query]);

  function finish(path: string) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    navigate(path);
  }

  function choose(s: Suggestion) {
    if (s.kind === "fn") finish(s.path);
    else finish(companyPath(s.symbol));
  }

  function run() {
    if (active >= 0 && suggestions[active]) return choose(suggestions[active]);
    const cmd = parseCommand(query, symbol);
    if (!cmd) return;
    if ("ask" in cmd) {
      setQuery("");
      setOpen(false);
      window.dispatchEvent(new Event(OPEN_ASK));
      return;
    }
    // A name rather than a ticker ("apple", "bank of montreal"): open the best search match.
    if ("search" in cmd) {
      if (results[0]) finish(companyPath(results[0].symbol));
      // Enter pressed before the suggestions arrived: search now and open the best match.
      else api.search(cmd.search).then((r) => r[0] && finish(companyPath(r[0].symbol))).catch(() => {});
      return;
    }
    const looksLikeName =
      words.length === 1 && !companyFunction(words[0]) && cmd.path.startsWith("/company/") && results.length > 0 && !results.some((r) => r.symbol === words[0]);
    finish(looksLikeName ? companyPath(results[0].symbol) : cmd.path);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      run();
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  }

  return (
    <div ref={boxRef} className="relative w-full">
      <div className="flex items-center rounded-sm border border-line-strong bg-bg focus-within:border-accent">
        <span className={`pl-2.5 font-mono font-semibold text-accent ${large ? "pl-4 text-lg" : "text-sm"}`} aria-hidden>
          &gt;
        </span>
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={large ? "Company or ticker, e.g. Apple" : symbol ? `${symbol} GP, WEI, a ticker or a company` : "Ticker, company or function: AAPL GP, RY.TO, WEI"}
          aria-label="Command: a ticker, company name or function code"
          autoComplete="off"
          spellCheck={false}
          className={`min-w-0 flex-1 bg-transparent px-2 font-mono text-ink uppercase outline-none placeholder:normal-case placeholder:text-muted ${large ? "py-3 text-base" : "py-1.5 text-sm"}`}
        />
        {!large && <kbd className="mr-1.5 hidden rounded-sm border border-line px-1.5 font-mono text-xs text-muted sm:inline">/</kbd>}
        <button
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={`tap-exempt rounded-r-sm bg-accent font-mono font-semibold text-on-accent ${large ? "px-5 py-3 text-sm" : "hidden px-2.5 py-1.5 text-xs sm:block"}`}
        >
          GO
        </button>
      </div>

      {open && (
        <ul className="absolute z-40 mt-1 max-h-[70vh] w-full min-w-80 overflow-auto rounded-sm border border-line-strong bg-surface py-1 shadow-sm">
          {suggestions.map((s, i) => (
            <li key={s.kind === "fn" ? `fn-${s.label}` : `t-${s.symbol}`}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(s)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-1.5 text-left text-sm ${i === active ? "bg-subtle" : ""}`}
              >
                {s.kind === "fn" ? (
                  <>
                    <span className="w-28 shrink-0 font-mono font-semibold text-accent">{s.label}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{s.detail}</span>
                  </>
                ) : (
                  <>
                    <span className="w-28 shrink-0 font-mono font-semibold">{s.symbol}</span>
                    <span className="min-w-0 flex-1 truncate text-muted">{s.name}</span>
                    <span className="shrink-0 text-xs text-muted">{s.exchange}</span>
                  </>
                )}
              </button>
            </li>
          ))}
          {loading && !results.length && <li className="px-3 py-1.5 text-sm text-muted">Searching companies…</li>}
          {!query && (
            <li className="border-t border-line px-3 pt-2 pb-1 text-xs text-muted">
              Type a ticker then a function, like <span className="font-mono text-ink">AAPL GP</span>, and press Enter. Type{" "}
              <span className="font-mono text-ink">ASK</span> for the AI assistant.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
