import { useEffect, useRef, useState } from"react";
import { Link, useLocation, useSearchParams } from"react-router-dom";
import { ScreenerFilters, ScreenerRow, screenerApi } from"../api";
import * as fmt from"../format";

// What each sector covers, shown on the tiles.
const SECTORS: { name: string; blurb: string }[] = [
  { name: "Technology", blurb: "Software, chips, hardware" },
  { name: "Financial Services", blurb: "Banks, insurers, asset managers" },
  { name: "Healthcare", blurb: "Pharma, biotech, medical devices" },
  { name: "Consumer Cyclical", blurb: "Retail, autos, travel, restaurants" },
  { name: "Communication Services", blurb: "Media, telecom, internet platforms" },
  { name: "Industrials", blurb: "Aerospace, railways, machinery" },
  { name: "Consumer Defensive", blurb: "Groceries, beverages, household goods" },
  { name: "Energy", blurb: "Oil & gas, pipelines" },
  { name: "Basic Materials", blurb: "Mining, chemicals, gold" },
  { name: "Real Estate", blurb: "REITs, developers" },
  { name: "Utilities", blurb: "Electricity, gas, water" },
];

const CAPS = [
  ["", "All sizes (over $300M)"],
  ["mega", "Mega (over $200B)"],
  ["large", "Large ($10B–200B)"],
  ["mid", "Mid ($2B–10B)"],
  ["small", "Small ($300M–2B)"],
  ["micro", "Micro (under $300M)"],
];
const PES = [
  ["", "Any P/E"],
  ["under15", "P/E under 15"],
  ["15to25", "P/E 15–25"],
  ["over25", "P/E over 25"],
];
const DIVIDENDS = [
  ["", "Any dividend"],
  ["any", "Pays a dividend"],
  ["over2", "Yield over 2%"],
  ["over4", "Yield over 4%"],
];
const GROWTH = [
  ["", "Any revenue growth"],
  ["over10", "Revenue growth over 10%"],
  ["over25", "Revenue growth over 25%"],
  ["negative", "Revenue shrinking"],
];
const SORTS = [
  ["marketcap", "Largest first"],
  ["change", "Biggest gainers today"],
  ["pe", "Lowest P/E"],
  ["dividend", "Highest dividend yield"],
  ["growth", "Fastest revenue growth"],
];

const DEFAULTS: ScreenerFilters = { country: "us", sector: "", industry: "", cap: "", pe: "", dividend: "", growth: "", sort: "marketcap" };
const PAGE = 25;

/** Browse stocks by sector with filters. Filters live in the URL so a filtered view can be bookmarked or shared. */
export default function Explore() {
  const [params, setParams] = useSearchParams();
  const filters: ScreenerFilters = { ...DEFAULTS };
  for (const k of Object.keys(DEFAULTS) as (keyof ScreenerFilters)[]) {
    const v = params.get(k);
    if (v !== null) (filters as Record<string, string>)[k] = v;
  }
  const set = (patch: Partial<ScreenerFilters>) => {
    const next = { ...filters, ...patch };
    if ("sector" in patch) next.industry = ""; // industries belong to a sector
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(next)) if (v !== DEFAULTS[k as keyof ScreenerFilters]) out[k] = v;
    setParams(out, { replace: true });
  };

  const [industries, setIndustries] = useState<Record<string, string[]>>({});
  const [rows, setRows] = useState<ScreenerRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [note, setNote] = useState<string | null>(null); // set when results come from the saved snapshot
  const [error, setError] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const resultsRef = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(filters);

  useEffect(() => {
    screenerApi.options().then(setIndustries).catch(() => {});
  }, []);

  // Arriving from the top bar's"Explore" link (/#explore): scroll down to this section.
  const { hash } = useLocation();
  useEffect(() => {
    if (hash === "#explore") document.getElementById("explore")?.scrollIntoView({ behavior: "smooth" });
  }, [hash]);

  useEffect(() => {
    const controller = new AbortController();
    setRows(null);
    setError(null);
    setShown(PAGE);
    screenerApi
      .run(filters, controller.signal)
      .then((r) => {
        setRows(r.results);
        setTotal(r.total);
        setNote(r.note);
      })
      .catch((e) => e.name !== "AbortError" && setError(e.message));
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  function pickSector(name: string) {
    set({ sector: filters.sector === name ? "" : name });
    resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const select =
    "min-w-0 rounded border border-line-strong bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-accent";
  const active = JSON.stringify({ ...filters, sort: "", country: "" }) !== JSON.stringify({ ...DEFAULTS, sort: "", country: "" });

  return (
    <section id="explore" className="mx-auto mt-16 max-w-6xl scroll-mt-28 px-4 pb-10">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl">Explore by sector</h2>
          <p className="mt-1 text-sm text-muted">Pick a sector, then narrow it down with the filters.</p>
        </div>
        <div className="flex gap-4 border-b border-line">
          {[
            ["us", "United States"],
            ["ca", "Canada (TSX)"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => set({ country: value as"us" | "ca" })}
              className={`-mb-px border-b-2 py-1.5 text-sm font-medium transition-colors ${
                filters.country === value ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Sector tiles */}
      <div className="mt-6 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
        {SECTORS.map((s) => {
          const on = filters.sector === s.name;
          return (
            <button
              key={s.name}
              onClick={() => pickSector(s.name)}
              aria-pressed={on}
              className={`border-t border-line py-3 text-left transition-colors hover:text-accent ${on ? "text-accent" : ""}`}
            >
              <div className="font-medium">{s.name}</div>
              <div className="text-sm text-muted">{s.blurb}</div>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      <div ref={resultsRef} className="mt-6 grid scroll-mt-20 grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap">
        <select aria-label="Sector" value={filters.sector} onChange={(e) => set({ sector: e.target.value })} className={select}>
          <option value="">All sectors</option>
          {SECTORS.map((s) => (
            <option key={s.name}>{s.name}</option>
          ))}
        </select>
        <select
          aria-label="Industry"
          value={filters.industry}
          onChange={(e) => set({ industry: e.target.value })}
          disabled={!filters.sector}
          className={`${select} disabled:opacity-50`}
        >
          <option value="">{filters.sector ? "All industries" : "Pick a sector for industries"}</option>
          {(industries[filters.sector] ?? []).map((i) => (
            <option key={i}>{i}</option>
          ))}
        </select>
        {(
          [
            ["cap", "Market cap", CAPS],
            ["pe", "P/E", PES],
            ["dividend", "Dividend", DIVIDENDS],
            ["growth", "Revenue growth", GROWTH],
          ] as const
        ).map(([k, label, opts]) => (
          <select key={k} aria-label={label} value={filters[k]} onChange={(e) => set({ [k]: e.target.value })} className={select}>
            {opts.map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        ))}
        <span className="col-span-2 flex items-center gap-2 sm:ml-auto">
          <select aria-label="Sort" value={filters.sort} onChange={(e) => set({ sort: e.target.value })} className={select}>
            {SORTS.map(([v, l]) => (
              <option key={v} value={v}>
                Sort: {l}
              </option>
            ))}
          </select>
          {active && (
            <button onClick={() => setParams(filters.country === "ca" ? { country: "ca" } : {}, { replace: true })} className="text-xs text-accent hover:underline">
              Clear filters
            </button>
          )}
        </span>
      </div>

      {/* Results */}
      {note && (
        <p className="mt-3 rounded border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
          {note}
        </p>
      )}
      <div className="card mt-3 overflow-hidden p-0 sm:p-0">
        {error && <p className="p-5 text-sm text-muted">Couldn't load stocks: {error}. Yahoo may be busy, so try again in a minute.</p>}
        {!error && !rows && (
          <div className="space-y-2 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-9 animate-pulse rounded bg-subtle" />
            ))}
          </div>
        )}
        {rows && rows.length === 0 && <p className="p-5 text-sm text-muted">No companies match these filters. Try loosening one.</p>}
        {rows && rows.length > 0 && <ResultsTable rows={rows.slice(0, shown)} />}
      </div>
      {rows && rows.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
          <span>
            Showing {Math.min(shown, rows.length)} of {rows.length}
            {total > rows.length && filters.country === "us" ? `(top ${rows.length} of ${total.toLocaleString()} matches)`: ""} companies.
            Market caps in the listing currency ({filters.country === "ca" ? "CAD" : "USD"}). Click a row to research it.
          </span>
          {shown < rows.length && (
            <button onClick={() => setShown(shown + PAGE)} className="btn">
              Show {Math.min(PAGE, rows.length - shown)} more
            </button>
          )}
        </div>
      )}
    </section>
  );
}

function ResultsTable({ rows }: { rows: ScreenerRow[] }) {
  const pct = (v: number | null) =>
    v === null ? <span className="text-muted">N/A</span> : <span className={v >= 0 ? "text-gain" : "text-loss"}>{fmt.signed(v, 1)}%</span>;
  const th = "whitespace-nowrap px-3 py-2 text-right font-medium";
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-xs text-muted">
            <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium">Company</th>
            <th className={th}>Price</th>
            <th className={th}>Today</th>
            <th className={th}>1 year</th>
            <th className={th}>Market cap</th>
            <th className={th}>P/E</th>
            <th className={th}>Div. yield</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.symbol} className="group border-b border-line last:border-0 hover:bg-subtle">
              <td className="sticky left-0 z-10 bg-surface px-4 py-2 group-hover:bg-subtle">
                <Link to={`/company/${encodeURIComponent(r.symbol)}`} className="block">
                  <div className="font-semibold text-accent group-hover:underline">{r.symbol}</div>
                  <div className="max-w-[11rem] truncate text-xs text-muted sm:max-w-[18rem]">{r.name}</div>
                </Link>
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{fmt.price(r.price, r.currency)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{pct(r.changePercent)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{pct(r.yearChangePercent)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{fmt.big(r.marketCap)}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{r.pe === null ? <span className="text-muted">N/A</span> : `${r.pe.toFixed(1)}x`}</td>
              <td className="whitespace-nowrap px-3 py-2 text-right">{r.dividendYield ? fmt.pct(r.dividendYield) : <span className="text-muted">–</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
