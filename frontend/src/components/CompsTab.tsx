import { useEffect, useState } from"react";
import { CompRow, Comps, compsApi } from"../api";
import * as fmt from"../format";
import { keys, useStored } from"../storage";

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

  if (error && !data) return <p className="card mt-6 text-sm text-muted">Comparable companies unavailable: {error}</p>;
  if (!data)
    return (
      <div className="mt-6 space-y-2">
        <div className="h-96 animate-pulse rounded bg-subtle" />
        <p className="text-xs text-muted">Loading peers. The first time a company is opened, this fetches every peer's filings and can take up to a minute; after that it's quick.</p>
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
          <span className="text-xs text-muted">{data.basis}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {shown.map((sym) => (
            <span key={sym} className="inline-flex items-center gap-1 rounded bg-subtle py-1 pl-3 pr-1 text-xs font-medium">
              {sym}
              <button onClick={() => remove(sym)} aria-label={`Remove ${sym}`} className="rounded px-1.5 text-muted hover:bg-subtle hover:text-ink">
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
              className="w-24 rounded border border-line-strong bg-surface px-3 py-1 text-xs outline-none focus:border-accent"
            />
            <button type="submit" className="btn">
              Add
            </button>
          </form>
          {peers && (
            <button onClick={() => setPeers(null)} className="text-xs text-accent hover:underline">
              Reset to suggested
            </button>
          )}
        </div>
        {(data.failed.length > 0 || data.excluded.length > 0) && (
          <p className="text-xs text-warn">
            {data.failed.length > 0 && `No data for: ${data.failed.join(", ")}. `}
            {data.excluded.length > 0 &&
              `Left out ${data.excluded.join(", ")}: they report in a foreign currency (usually an ADR), so per-share multiples can be distorted. Add one manually if you want it anyway.`}
          </p>
        )}
      </div>

      <CompsTable data={data} />
      <Implied data={data} price={price} currency={currency} />

      <p className="text-xs leading-relaxed text-muted">
        Every multiple is calculated with the same formulas as the Ratios tab, using trailing-twelve-month figures (SEC 10-Q
        filings for US companies) and today's price. Revenue growth is the last full fiscal year. Median and mean exclude the
        target company and any peer with a currency warning (†). Market caps are in USD for comparison.
      </p>
    </div>
  );
}

function CompsTable({ data }: { data: Comps }) {
  const cell = (v: number | string | null | undefined, format: "x" | "pct") =>
    typeof v === "number" ? fmt.ratio(v, format) : "N/A";

  const rowClass = "border-b border-line";
  const stickyCell = "sticky left-0 z-10 bg-surface px-4 py-2";

  function companyRow(r: CompRow, highlight = false) {
    return (
      <tr key={r.symbol} className={`${rowClass} ${highlight ? "bg-accent-soft font-semibold" : ""} ${r.warning ? "text-muted" : ""}`}>
        <td className={`${stickyCell} ${highlight ? "bg-accent-soft" : ""}`}>
          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <span>{r.symbol}</span>
            {r.warning && (
              <span title={r.warning} className="cursor-help text-warn">
                †
              </span>
            )}
          </div>
          <div className="max-w-[10rem] truncate text-xs font-normal text-muted">{r.name}</div>
        </td>
        <td className="whitespace-nowrap px-3 py-2 text-right">{r.marketCapUsd === null ? "N/A" : `$${fmt.big(r.marketCapUsd)}`}</td>
        {data.metrics.map((m) => (
          <td key={m.key} className={`whitespace-nowrap px-3 py-2 text-right ${r[m.key] === null ? "text-muted" : ""}`}>
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
            <tr className="border-b border-line text-xs text-muted">
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
              <tr key={stat} className={`${rowClass} bg-subtle font-semibold `}>
                <td className={`${stickyCell} bg-subtle capitalize `}>Peer {stat}</td>
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
      <p className="mt-1 text-xs text-muted">
        What {data.symbol} would be worth if it traded at the peer median. The vertical line is today's price (
        {fmt.price(price, currency)}).
      </p>
      <div className="mt-4 space-y-3">
        {data.implied.map((i) => (
          <div key={i.key} className="grid grid-cols-[5.5rem_1fr] items-center gap-3 sm:grid-cols-[6rem_1fr_11rem]">
            <div className="text-sm font-medium">
              {i.label}
              <div className="text-xs font-normal text-muted">
                median {i.medianMultiple === null ? "N/A" : `${i.medianMultiple.toFixed(1)}x`}
              </div>
            </div>
            <div className="relative h-6 rounded bg-subtle" title={i.formula}>
              {price && <div className="absolute inset-y-0 w-0.5 bg-line-strong" style={{ left: `${x(price)}%`}} />}
              {i.value !== null && (
                <div
                  className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
                  style={{ left: `${x(i.value)}%`}}
                />
              )}
            </div>
            <div className="col-start-2 text-xs sm:col-start-auto sm:text-right sm:text-sm">
              {i.value === null ? (
                <span className="text-muted">N/A (metric negative or missing)</span>
              ) : (
                <>
                  <span className="font-semibold">{fmt.price(i.value, currency)}</span>{" "}
                  <span className={(i.upside ?? 0) >= 0 ? "text-gain" : "text-loss"}>
                    ({(i.upside ?? 0) >= 0 ? "+" : ""}
                    {((i.upside ?? 0) * 100).toFixed(0)}%)
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        Hover a bar for its formula. P/B is mostly useful for banks and insurers; for companies that buy back a lot of stock
        (like Apple) book equity is tiny and P/B says little.
      </p>
    </div>
  );
}
