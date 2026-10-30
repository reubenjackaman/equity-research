import { useEffect, useRef, useState } from"react";
import { useNavigate } from"react-router-dom";
import { api, SearchResult } from"../api";

/**
 * Ticker / company-name search with autocomplete.
 * Arrow keys move through suggestions, Enter opens one. Pressing Enter with no
 * suggestion highlighted opens whatever was typed as a ticker.
 */
export default function SearchBar({ large = false }: { large?: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Wait 250 ms after the user stops typing before searching, so we don't fire a request per keystroke.
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      api
        .search(q, controller.signal)
        .then((r) => {
          setResults(r);
          setActive(-1);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  // Close the dropdown when clicking elsewhere on the page.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(symbol: string) {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setQuery("");
    setOpen(false);
    navigate(`/company/${encodeURIComponent(s)}`);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter") {
      go(active >= 0 ? results[active].symbol : query);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  const showDropdown = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative w-full">
      <svg
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-muted ${large ? "left-4 h-5 w-5" : "left-3 h-4 w-4"}`}
        viewBox="0 0 20 20"
        fill="currentColor"
        aria-hidden
      >
        <path
          fillRule="evenodd"
          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.45 4.39l3.08 3.08a.75.75 0 1 1-1.06 1.06l-3.08-3.08A7 7 0 0 1 2 9Z"
          clipRule="evenodd"
        />
      </svg>
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search ticker or company (e.g. AAPL, SHOP.TO)"
        aria-label="Search ticker or company"
        autoComplete="off"
        spellCheck={false}
        className={`w-full rounded border border-line-strong bg-surface text-ink outline-none transition-colors placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20    ${
          large ? "py-3.5 pl-12 pr-4 text-base" : "py-2 pl-9 pr-3 text-sm"
        }`}
      />
      {showDropdown && (
        <ul className="absolute z-20 mt-1 max-h-80 w-full overflow-auto rounded border border-line bg-surface py-1 shadow-sm">
          {results.map((r, i) => (
            <li key={r.symbol}>
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => go(r.symbol)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${
                  i === active ? "bg-subtle" : ""
                }`}
              >
                <span className="w-20 shrink-0 font-semibold">{r.symbol}</span>
                <span className="min-w-0 flex-1 truncate text-muted">{r.name}</span>
                <span className="shrink-0 text-xs text-muted">{r.exchange}</span>
              </button>
            </li>
          ))}
          {!loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">
              No matches. Press Enter to try"{query.trim().toUpperCase()}" as a ticker.
            </li>
          )}
          {loading && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-muted">Searching…</li>
          )}
        </ul>
      )}
    </div>
  );
}
