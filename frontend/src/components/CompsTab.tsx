import { useEffect, useState } from "react";
import { CompRow, Comps, compsApi } from "../api";
import * as fmt from "../format";
import { keys, useStored } from "../storage";

export default function CompsTab({ ticker, price, currency }: { ticker: string; price: number | null; currency: string | null }) {
  // null = use suggested peers. Your list is remembered per company (also used by the Summary tab).
  const [peers, setPeers] = useStored<string[] | null>(keys.peers(ticker), null);
  const [data, setData] = useState<Comps | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    compsApi
      .get(ticker, peers)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticker, peers]);

  if (error && !data) return <p className="card mt-6 text-sm text-slate-500">Comparable companies unavailable: {error}</p>;
  if (!data)
    return (
      <div className="mt-6 space-y-2">
        <div className="h-96 animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <p className="text-xs text-slate-500">Loading peers. The first time a company is opened, this fetches every peer's filings and can take up to a minute; after that it's quick.</p>
      </div>
    );

  const shown = peers ?? data.peers.map((p) => p.symbol);
  const remove = (sym: string) => setPeers(shown.filter((s) => s !== sym));
  function add() {
    const sym = adding.trim().toUpperCase();
    if (sym && !shown.includes(sym) && sym !== ticker) setPeers([...shown, sym]);
    setAdding("");
  }

  return (
    <div className={`mt-6 space-y-4 transition-opacity ${loading ? "opacity-60" : ""}`}>
      <div className="card space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-sm font-semibold">Peer group</h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">{data.basis}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shown.map((sym) => (
            <span key={sym} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium dark:bg-slate-800">
              {sym}
              <button onClick={() => remove(sym)} aria-label={`Remove ${sym}`} className="rounded-full px-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200">
                ×
              </button>
            </span>
          ))}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              add();
            }}
            className="flex items-center gap-1"
          >
            <input
              value={adding}
              onChange={(e) => setAdding(e.target.value)}
              placeholder="Add ticker"
              aria-label="Add peer ticker"
              className="w-24 rounded-full border border-slate-300 bg-white px-3 py-1 text-xs outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900"
            />
            <button type="submit" className="btn rounded-full">
              Add
            </button>
          </form>
          {peers && (
            <button onClick={() => setPeers(null)} className="text-xs text-blue-600 hover:underline dark:text-blue-400">
              Reset to suggested
            </button>
          )}
        </div>
        {(data.failed.length > 0 || data.excluded.length > 0) && (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            {data.failed.length > 0 && `No data for: ${data.failed.join(", ")}. `}
            {data.excluded.length > 0 &&
              `Left out ${data.excluded.join(", ")}: they report in a foreign currency (usually an ADR), so per-share multiples can be distorted. Add one manually if you want it anyway.`}
          </p>
        )}
      </div>

      <CompsTable data={data} />
      <Implied data={data} price={price} currency={currency} />

      <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        Every multiple is calculated with the same formulas as the Ratios tab, using trailing-twelve-month figures (SEC 10-Q
        filings for US companies) and today's price. Revenue growth is the last full fiscal year. Median and mean exclude the
        target company and any peer with a currency warning (⚠). Market caps are in USD for comparison.
      </p>
    </div>
  );
}

function CompsTable({ data }: { data: Comps }) {
  const cell = (v: number | string | null | undefined, format: "x" | "pct") =>
    typeof v === "number" ? fmt.ratio(v, format) : "N/A";

  const rowClass = "border-b border-slate-100 dark:border-slate-800/60";
  const stickyCell = "sticky left-0 z-10 bg-white px-4 py-2 dark:bg-slate-900";

  function companyRow(r: CompRow, highlight = false) {
    return (
      <tr key={r.symbol} className={`${rowClass} ${highlight ? "bg-blue-50 font-semibold dark:bg-[#0f1a33]" : ""} ${r.warning ? "text-slate-400" : ""}`}>
        <td className={`${stickyCell} ${highlight ? "bg-blue-50 dark:bg-[#0f1a33]" : ""}`}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>{r.symbol}</span>
            {r.warning && (
              <span title={r.warning} className="cursor-help text-amber-500">
                ⚠
              </span>
            )}
          </div>
          <div className="max-w-[10rem] truncate text-xs font-normal text-slate-500 dark:text-slate-400">{r.name}</div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">{r.marketCapUsd === null ? "N/A" : `$${fmt.big(r.marketCapUsd)}`}</td>
        {data.metrics.map((m) => (
          <td key={m.key} className={`whitespace-nowrap px-3 py-2 text-right ${r[m.key] === null ? "text-slate-400 dark:text-slate-600" : ""}`}>
            {cell(r[m.key], m.format)}
          </td>
        ))}
      </tr>
    );
  }

  return (
    <div className="card overflow-hidden p-0 sm:p-0">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <th className={`${stickyCell} text-left font-medium`}>Company</th>
              <th className="whitespace-nowrap px-3 py-2 text-right font-medium">Mkt cap</th>
              {data.metrics.map((m) => (
                <th key={m.key} className="whitespace-nowrap px-3 py-2 text-right font-medium">
                  {m.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {companyRow(data.target, true)}
            {data.peers.map((r) => companyRow(r))}
            {(["median", "mean"] as const).map((stat) => (
              <tr key={stat} className={`${rowClass} bg-slate-50 font-semibold dark:bg-slate-800/40`}>
                <td className={`${stickyCell} bg-slate-50 capitalize dark:bg-slate-800`}>Peer {stat}</td>
                <td />
                {data.metrics.map((m) => (
                  <td key={m.key} className="whitespace-nowrap px-3 py-2 text-right">
                    {cell(data.stats[stat][m.key], m.format)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Implied share price from each peer-median multiple, plotted against today's price. */
function Implied({ data, price, currency }: { data: Comps; price: number | null; currency: string | null }) {
  const values = data.implied.map((i) => i.value).filter((v): v is number => v !== null);
  const all = price ? [...values, price] : values;
  const lo = Math.min(...all) * 0.9;
  const hi = Math.max(...all) * 1.1;
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;

  return (
    <div className="card">
      <h2 className="text-sm font-semibold">Implied value per share at peer median multiples</h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        What {data.symbol} would be worth if it traded at the peer median. The vertical line is today's price (
        {fmt.price(price, currency)}).
      </p>
      <div className="mt-4 space-y-3">
        {data.implied.map((i) => (
          <div key={i.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr_11rem]">
            <div className="text-sm font-medium">
              {i.label}
              <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
                median {i.medianMultiple === null ? "N/A" : `${i.medianMultiple.toFixed(1)}x`}
              </div>
            </div>
            <div className="relative h-6 rounded bg-slate-100 dark:bg-slate-800" title={i.formula}>
              {price && <div className="absolute inset-y-0 w-0.5 bg-slate-500 dark:bg-slate-300" style={{ left: `${x(price)}%` }} />}
              {i.value !== null && (
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 dark:border-slate-900 dark:bg-blue-400"
                  style={{ left: `${x(i.value)}%` }}
                />
              )}
            </div>
            <div className="col-start-2 text-xs sm:col-start-auto sm:text-right sm:text-sm">
              {i.value === null ? (
                <span className="text-slate-400">N/A (metric negative or missing)</span>
              ) : (
                <>
                  <span className="font-semibold">{fmt.price(i.value, currency)}</span>{" "}
                  <span className={(i.upside ?? 0) >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
                    ({(i.upside ?? 0) >= 0 ? "+" : ""}
                    {((i.upside ?? 0) * 100).toFixed(0)}%)
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Hover a bar for its formula. P/B is mostly useful for banks and insurers; for companies that buy back a lot of stock
        (like Apple) book equity is tiny and P/B says little.
      </p>
    </div>
  );
}
