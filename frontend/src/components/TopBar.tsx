import { useEffect, useRef, useState } from"react";
import { Link, useLocation, useNavigate } from"react-router-dom";
import { api, Overview } from"../api";
import * as fmt from"../format";
import { keys, useSaved, useStored } from"../storage";
import type { Theme } from"../theme";
import { Birdhouse } from"./Finch";
import SearchBar from"./SearchBar";

/** The bar at the top of every page: navigation, saved companies, search, theme and a market strip. */
export default function TopBar({ theme, onToggleTheme }: { theme: Theme; onToggleTheme: () => void }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const onHome = pathname === "/";

  function goExplore() {
    if (onHome) document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
    else navigate("/#explore");
  }

  const link = (active: boolean) =>
    `rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
      active ? "text-ink" : "text-muted hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-2 sm:flex-nowrap sm:gap-3">
        <Link
          to="/"
          aria-label="Value Finch home"
          className="tap flex shrink-0 items-center gap-2 rounded px-1 py-1 transition-colors hover:text-accent"
        >
          <Birdhouse className="h-7 w-7 text-accent" />
          <span className="hidden whitespace-nowrap font-serif text-lg font-semibold md:inline">Value Finch</span>
        </Link>
        <nav className="flex shrink-0 items-center">
          <button onClick={goExplore} className={`hidden sm:block ${link(false)}`}>
            Explore
          </button>
          <Link
            to="/game"
            className="ml-1 tap rounded bg-accent px-3 py-1.5 text-sm font-medium whitespace-nowrap text-on-accent transition-colors hover:bg-accent-hover"
          >
            Play game
          </Link>
        </nav>
        {/* On phones the search box gets its own full-width row. */}
        <div className="order-last w-full sm:order-none sm:mx-auto sm:max-w-md">{!onHome && <SearchBar />}</div>
        <span className="ml-auto sm:ml-0">
          <SavedMenu />
        </span>
        <button
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="min-w-11 shrink-0 rounded p-2 text-muted sm:min-w-0 hover:bg-subtle"
        >
          {theme === "dark" ? (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 2Zm0 13a.75.75 0 0 1 .75.75v1.5a.75.75 0 0 1-1.5 0v-1.5A.75.75 0 0 1 10 15Zm0-9a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm7.25 3.25a.75.75 0 0 1 0 1.5h-1.5a.75.75 0 0 1 0-1.5h1.5ZM4.25 10a.75.75 0 0 1-.75.75H2a.75.75 0 0 1 0-1.5h1.5a.75.75 0 0 1 .75.75Zm11.06-5.31a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 1 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0ZM6.81 13.19a.75.75 0 0 1 0 1.06l-1.06 1.06a.75.75 0 0 1-1.06-1.06l1.06-1.06a.75.75 0 0 1 1.06 0Zm8.5 2.12a.75.75 0 0 1-1.06 0l-1.06-1.06a.75.75 0 1 1 1.06-1.06l1.06 1.06a.75.75 0 0 1 0 1.06ZM6.81 6.81a.75.75 0 0 1-1.06 0L4.69 5.75a.75.75 0 0 1 1.06-1.06l1.06 1.06a.75.75 0 0 1 0 1.06Z" /></svg>
          ) : (
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M7.455 2.004a.75.75 0 0 1 .26.77 7 7 0 0 0 9.958 7.967.75.75 0 0 1 1.067.853A8.5 8.5 0 1 1 6.647 1.921a.75.75 0 0 1 .808.083Z" clipRule="evenodd" /></svg>
          )}
        </button>
      </div>
      <MarketStrip />
    </header>
  );
}

export function StarIcon({ filled, className = "h-4 w-4" }: { filled: boolean; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinejoin="round" d="M10 2.5l2.35 4.76 5.25.77-3.8 3.7.9 5.23L10 14.5l-4.7 2.46.9-5.23-3.8-3.7 5.25-.77L10 2.5Z" />
    </svg>
  );
}

/** "Saved" button with a dropdown of saved and recently viewed companies, with live prices. */
function SavedMenu() {
  const { saved, remove } = useSaved();
  const [recent] = useStored<string[]>(keys.recent, []);
  const [open, setOpen] = useState(false);
  const [quotes, setQuotes] = useState<Record<string, Overview | null>>({});
  const boxRef = useRef<HTMLDivElement>(null);
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Fetch prices for anything shown that we don't have yet (the backend caches these).
  useEffect(() => {
    if (!open) return;
    for (const symbol of new Set([...saved, ...recent])) {
      if (symbol in quotes) continue;
      setQuotes((q) => ({ ...q, [symbol]: null }));
      api
        .overview(symbol)
        .then((o) => setQuotes((q) => ({ ...q, [symbol]: o })))
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saved.join(), recent.join()]);

  const recentOnly = recent.filter((s) => !saved.includes(s));

  return (
    <div ref={boxRef} className="relative shrink-0">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex items-center gap-1.5 rounded px-2.5 py-1.5 text-sm font-medium transition-colors ${
          open ? "bg-subtle" : "text-muted hover:bg-subtle"
        }`}
      >
        <StarIcon filled={saved.length > 0} className="h-4 w-4 text-warn" />
        <span className="hidden sm:inline">Saved</span>
        {saved.length > 0 && <span className="rounded bg-subtle px-1.5 text-xs">{saved.length}</span>}
      </button>

      {open && (
        <div className="fixed inset-x-3 top-14 z-40 max-h-[70vh] overflow-auto rounded border border-line bg-surface p-2 shadow-sm sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96">
          <Section title="Saved companies">
            {saved.length === 0 ? (
              <p className="px-2 py-3 text-sm text-muted">
                Nothing saved yet. Click the <StarIcon filled={false} className="inline h-3.5 w-3.5" /> next to a company's name to keep it here.
              </p>
            ) : (
              saved.map((s) => <QuoteRow key={s} symbol={s} quote={quotes[s]} onRemove={() => remove(s)} />)
            )}
          </Section>
          {recentOnly.length > 0 && (
            <Section title="Recently viewed">
              {recentOnly.map((s) => (
                <QuoteRow key={s} symbol={s} quote={quotes[s]} />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-1">
      <div className="px-2 pb-1 pt-1.5 text-xs font-semibold text-muted">{title}</div>
      {children}
    </div>
  );
}

function QuoteRow({ symbol, quote, onRemove }: { symbol: string; quote: Overview | null | undefined; onRemove?: () => void }) {
  const change = quote?.changePercent ?? null;
  return (
    <div className="group flex items-center rounded hover:bg-subtle">
      <Link to={`/company/${encodeURIComponent(symbol)}`} className="flex min-w-0 flex-1 items-center gap-3 px-2 py-2">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold">{symbol}</div>
          <div className="truncate text-xs text-muted">{quote?.name ?? (quote === null ? "Loading…" : "")}</div>
        </div>
        <div className="text-right text-sm tabular-nums">
          <div>{quote ? fmt.price(quote.price, quote.currency) : ""}</div>
          {change !== null && (
            <div className={`text-xs ${change >= 0 ? "text-gain" : "text-loss"}`}>
              {fmt.signed(change)}%
            </div>
          )}
        </div>
      </Link>
      {onRemove && (
        <button
          onClick={onRemove}
          aria-label={`Remove ${symbol} from saved`}
          className="mr-1 rounded px-2 py-1 text-muted hover:bg-subtle hover:text-ink"
        >
          ×
        </button>
      )}
    </div>
  );
}

type MarketItem = { symbol: string; label: string; value: number | null; changePercent: number | null; changeBp?: number };

/** Thin strip of headline markets under the top bar, refreshed every 5 minutes. */
function MarketStrip() {
  const [items, setItems] = useState<MarketItem[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/market")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setItems(d))
        .catch(() => {});
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  if (!items) return null;
  return (
    <div className="border-t border-line">
      <div className="mx-auto flex max-w-6xl gap-5 overflow-x-auto px-4 py-1.5 text-xs [scrollbar-width:none]">
        {items.map((m) => {
          const move = m.changeBp ?? m.changePercent;
          const up = (move ?? 0) >= 0;
          const value =
            m.value === null
              ? "N/A"
              : m.symbol === "^TNX"
                ? `${m.value.toFixed(2)}%`: m.symbol === "CAD=X"
                  ? m.value.toFixed(4)
                  : m.value.toLocaleString("en-US", { maximumFractionDigits: 0 });
          return (
            <span key={m.symbol} className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
              <span className="text-muted">{m.label}</span>
              <span className="font-medium tabular-nums">{value}</span>
              {move !== null && (
                <span className={`tabular-nums ${up ? "text-gain" : "text-loss"}`}>
                  {m.changeBp !== undefined ? `${up ? "+" : ""}${m.changeBp.toFixed(1)} bp`: `${fmt.signed(m.changePercent)}%`}
                </span>
              )}
            </span>
          );
        })}
      </div>
    </div>
  );
}
