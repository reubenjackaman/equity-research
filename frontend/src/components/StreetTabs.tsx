// ANR (analysts and earnings) and INS (insider trades): what the market says about a company.
import { useState } from "react";
import { RatingMonth, companyApi } from "../api";
import * as fmt from "../format";
import { useApi } from "../useApi";
import { Trend } from "./Icons";
import { Panel, PanelState } from "./Terminal";

// Diverging scale: greens for buy, neutral grey for hold, reds for sell. Each segment is also labelled.
const RATINGS: { key: keyof Omit<RatingMonth, "period">; label: string; color: string; score: number }[] = [
  { key: "strongBuy", label: "Strong buy", color: "color-mix(in srgb, var(--gain) 100%, transparent)", score: 1 },
  { key: "buy", label: "Buy", color: "color-mix(in srgb, var(--gain) 55%, transparent)", score: 2 },
  { key: "hold", label: "Hold", color: "var(--line-strong)", score: 3 },
  { key: "sell", label: "Sell", color: "color-mix(in srgb, var(--loss) 55%, transparent)", score: 4 },
  { key: "strongSell", label: "Strong sell", color: "color-mix(in srgb, var(--loss) 100%, transparent)", score: 5 },
];

const total = (m: RatingMonth) => RATINGS.reduce((s, r) => s + (m[r.key] ?? 0), 0);
const score = (m: RatingMonth) => RATINGS.reduce((s, r) => s + (m[r.key] ?? 0) * r.score, 0) / (total(m) || 1);
const verdict = (s: number) => (s <= 1.5 ? "Strong buy" : s <= 2.5 ? "Buy" : s <= 3.5 ? "Hold" : s <= 4.5 ? "Sell" : "Strong sell");
const monthLabel = (period: string) => new Date(period + "T12:00:00").toLocaleDateString("en-US", { month: "short", year: "numeric" });

export function AnalystsTab({ ticker, price, currency }: { ticker: string; price: number | null; currency: string | null }) {
  const { data, error } = useApi(() => companyApi.estimates(ticker), ticker);
  if (!data) return <div className="card"><PanelState error={error} /></div>;
  const latest = data.ratings[0];

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-2">
      <Panel title="Analyst consensus" code="ANR">
        {!latest ? (
          <p className="text-sm text-muted">No analyst ratings found{ticker.includes(".") ? " (ratings come from the company's US listing, if it has one)" : ""}.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <div className="text-2xl font-semibold">{verdict(score(latest))}</div>
                <div className="text-xs text-muted">
                  {total(latest)} analysts, {monthLabel(latest.period)}. Average score {score(latest).toFixed(2)} on a 1 (strong buy) to 5 (strong sell) scale.
                </div>
              </div>
            </div>
            <RatingBar month={latest} />
            <ul className="mt-2 grid grid-cols-5 gap-1 text-center text-xs">
              {RATINGS.map((r) => (
                <li key={r.key}>
                  <div className="font-mono text-base font-semibold">{latest[r.key]}</div>
                  <div className="text-muted">{r.label}</div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel title="Price targets and next report">
        {data.targets?.mean ? (
          <TargetRange low={data.targets.low} mean={data.targets.mean} high={data.targets.high} price={price} currency={currency} analysts={data.targets.analysts} />
        ) : (
          <p className="text-sm text-muted">Analyst price targets aren't available from our free data sources right now.</p>
        )}
        <div className="mt-4 border-t border-line pt-3">
          <div className="text-xs font-semibold text-muted uppercase">Next earnings report</div>
          {data.next ? (
            <dl className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-sm">
              <dt className="font-sans text-muted">Date</dt>
              <dd className="text-right">
                {new Date(data.next.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                {data.next.hour && <span className="text-muted"> · {data.next.hour}</span>}
              </dd>
              <dt className="font-sans text-muted">Quarter</dt>
              <dd className="text-right">Q{data.next.quarter} {data.next.year}</dd>
              <dt className="font-sans text-muted">EPS estimate</dt>
              <dd className="text-right">{fmt.num(data.next.epsEstimate)}</dd>
              <dt className="font-sans text-muted">Revenue estimate</dt>
              <dd className="text-right">{fmt.big(data.next.revenueEstimate)}</dd>
            </dl>
          ) : (
            <p className="mt-1 text-sm text-muted">No report date announced in the next four months.</p>
          )}
        </div>
      </Panel>

      {data.ratings.length > 1 && (
        <Panel title="Ratings over time">
          <RatingHistory months={[...data.ratings].reverse()} />
        </Panel>
      )}

      <Panel title="Earnings surprises, last four quarters" code="EE" bodyClass="">
        {data.surprises.length === 0 ? (
          <p className="p-3 text-sm text-muted">No earnings history found.</p>
        ) : (
          <>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="px-3 py-1.5 text-left font-medium">Quarter</th>
                  <th className="px-2 py-1.5 text-right font-medium">EPS estimate</th>
                  <th className="px-2 py-1.5 text-right font-medium">EPS actual</th>
                  <th className="px-2 py-1.5 text-right font-medium">Surprise</th>
                  <th className="py-1.5 pr-3 pl-2 text-left font-medium">Result</th>
                </tr>
              </thead>
              <tbody>
                {data.surprises.map((s) => {
                  const beat = (s.surprise ?? 0) > 0;
                  const miss = (s.surprise ?? 0) < 0;
                  return (
                    <tr key={s.period} className="border-t border-line/60">
                      <td className="px-3 py-1.5">Q{s.quarter} {s.year} <span className="text-muted">({s.period})</span></td>
                      <td className="px-2 py-1.5 text-right">{fmt.num(s.estimate, 2)}</td>
                      <td className="px-2 py-1.5 text-right font-semibold">{fmt.num(s.actual, 2)}</td>
                      <td className={`px-2 py-1.5 text-right ${beat ? "text-gain" : miss ? "text-loss" : "text-muted"}`}>
                        {s.surprisePercent === null ? "N/A" : `${fmt.signed(s.surprisePercent, 1)}%`}
                      </td>
                      <td className="py-1.5 pr-3 pl-2 font-sans">{beat ? <><Trend dir="up" /> Beat</> : miss ? <><Trend dir="down" /> Missed</> : "In line"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
              EPS here is the adjusted figure analysts forecast, which can differ from the reported (GAAP) EPS on the Financials tab.
            </p>
          </>
        )}
      </Panel>
    </div>
  );
}

function RatingBar({ month }: { month: RatingMonth }) {
  const n = total(month) || 1;
  return (
    <div className="mt-3 flex h-3 gap-0.5 overflow-hidden rounded-sm" role="img" aria-label={RATINGS.map((r) => `${r.label} ${month[r.key]}`).join(", ")}>
      {RATINGS.filter((r) => month[r.key] > 0).map((r) => (
        <div key={r.key} style={{ width: `${(month[r.key] / n) * 100}%`, background: r.color }} title={`${r.label}: ${month[r.key]}`} />
      ))}
    </div>
  );
}

/** One stacked column per month, so you can see opinion drift. Hover a month for its counts. */
function RatingHistory({ months }: { months: RatingMonth[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...months.map(total), 1);
  const shown = months[hover ?? months.length - 1];
  return (
    <div>
      <div className="flex h-36 items-end gap-1">
        {months.map((m, i) => {
          const n = total(m);
          return (
            <div
              key={m.period}
              className={`flex h-full min-w-0 flex-1 flex-col justify-end ${hover === i ? "opacity-100" : hover === null ? "" : "opacity-60"}`}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="flex flex-col-reverse gap-px overflow-hidden rounded-t-sm" style={{ height: `${(n / max) * 100}%` }}>
                {RATINGS.map((r) => (
                  <div key={r.key} style={{ height: `${(m[r.key] / (n || 1)) * 100}%`, background: r.color }} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-1 font-mono text-[10px] text-muted">
        {months.map((m, i) => (
          <span key={m.period} className="min-w-0 flex-1 truncate text-center">{i % 2 === months.length % 2 ? "" : monthLabel(m.period)}</span>
        ))}
      </div>
      <p className="mt-2 font-mono text-xs">
        <span className="text-ink">{monthLabel(shown.period)}</span>
        {RATINGS.map((r) => (
          <span key={r.key} className="ml-3 text-muted">
            {r.label} <span className="text-ink">{shown[r.key]}</span>
          </span>
        ))}
      </p>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
        {RATINGS.map((r) => (
          <li key={r.key} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />
            {r.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function TargetRange({ low, mean, high, price, currency, analysts }: { low: number | null; mean: number; high: number | null; price: number | null; currency: string | null; analysts: number | null }) {
  const lo = Math.min(low ?? mean, price ?? mean);
  const hi = Math.max(high ?? mean, price ?? mean);
  const pos = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  const upside = price ? (mean / price - 1) * 100 : null;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-xs text-muted">Average 12-month target{analysts ? `, ${analysts} analysts` : ""}</div>
          <div className="font-mono text-xl font-semibold">{fmt.price(mean, currency)}</div>
        </div>
        {upside !== null && (
          <div className={`font-mono text-sm ${upside >= 0 ? "text-gain" : "text-loss"}`}>
            {fmt.signed(upside, 1)}% {upside >= 0 ? "above" : "below"} the price
          </div>
        )}
      </div>
      <div className="relative mt-4 h-1.5 rounded-full bg-subtle">
        <div className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-ink" style={{ left: `${pos(mean)}%` }} title="Average target" />
        {price !== null && <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent" style={{ left: `${pos(price)}%` }} title="Price" />}
      </div>
      <div className="mt-1.5 flex justify-between font-mono text-xs text-muted">
        <span>Low {fmt.num(low)}</span>
        <span>High {fmt.num(high)}</span>
      </div>
      <p className="mt-1 text-xs text-muted">The amber dot is today's price; the line is the average target.</p>
    </div>
  );
}

export function InsidersTab({ ticker, currency }: { ticker: string; currency: string | null }) {
  const { data, error } = useApi(() => companyApi.insiders(ticker), ticker);
  const [all, setAll] = useState(false);
  if (!data) return <div className="card"><PanelState error={error} /></div>;
  const s = data.summary;
  const rows = all ? data.transactions : data.transactions.filter((t) => (t.code === "P" || t.code === "S") && !t.derivative);
  const money = (v: number) => (v ? `$${fmt.big(v)}` : "$0");

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Open-market buys, 12 months" value={`${s.buys}`} detail={`${money(s.buyValue)} by ${s.buyers} insider${s.buyers === 1 ? "" : "s"}`} tone="gain" />
        <Stat label="Open-market sales, 12 months" value={`${s.sells}`} detail={`${money(s.sellValue)} by ${s.sellers} insider${s.sellers === 1 ? "" : "s"}`} tone="loss" />
        <Stat label="Net shares bought (sold)" value={fmt.statementCell(s.netShares * 1e6, "shares")} detail="Open-market trades only" tone={s.netShares > 0 ? "gain" : s.netShares < 0 ? "loss" : undefined} />
        <Stat label="Source" value={data.source === ticker ? "SEC Form 4" : `SEC, as ${data.source}`} detail="Filed within two business days of a trade" />
      </div>
      {data.note && <p className="border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">{data.note}</p>}
      <Panel
        title="Insider transactions"
        code="INS"
        bodyClass=""
        actions={
          <label className="flex items-center gap-1.5 text-xs text-muted">
            <input type="checkbox" checked={all} onChange={(e) => setAll(e.target.checked)} className="accent-[var(--accent)]" />
            Include awards, option exercises and tax withholding
          </label>
        }
      >
        {rows.length === 0 ? (
          <p className="p-3 text-sm text-muted">No {all ? "" : "open-market "}insider trades in the last year.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="px-3 py-1.5 text-left font-medium">Trade date</th>
                  <th className="px-2 py-1.5 text-left font-medium">Insider</th>
                  <th className="px-2 py-1.5 text-left font-medium">Type</th>
                  <th className="px-2 py-1.5 text-right font-medium">Shares</th>
                  <th className="px-2 py-1.5 text-right font-medium">Price</th>
                  <th className="px-2 py-1.5 text-right font-medium">Value</th>
                  <th className="py-1.5 pr-3 pl-2 text-right font-medium">Held after</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((t, i) => (
                  <tr key={i} className="border-t border-line/60 hover:bg-subtle">
                    <td className="px-3 py-1.5">{t.date}</td>
                    <td className="max-w-56 truncate px-2 py-1.5 font-sans">{t.name}</td>
                    <td className={`px-2 py-1.5 font-sans ${t.code === "P" ? "text-gain" : t.code === "S" ? "text-loss" : "text-muted"}`}>{t.type}</td>
                    <td className={`px-2 py-1.5 text-right ${t.shares > 0 ? "text-gain" : "text-loss"}`}>{t.shares > 0 ? "+" : ""}{t.shares.toLocaleString("en-US")}</td>
                    <td className="px-2 py-1.5 text-right">{t.price ? fmt.price(t.price, currency || "USD") : "N/A"}</td>
                    <td className="px-2 py-1.5 text-right">{t.value ? fmt.big(t.value) : "N/A"}</td>
                    <td className="py-1.5 pr-3 pl-2 text-right text-muted">{t.held === null ? "N/A" : t.held.toLocaleString("en-US")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
          Insiders often sell for personal reasons (taxes, diversification, planned 10b5-1 sales); open-market buying is usually read as the stronger signal.
        </p>
      </Panel>
    </div>
  );
}

function Stat({ label, value, detail, tone }: { label: string; value: string; detail: string; tone?: "gain" | "loss" }) {
  return (
    <div className="border border-line bg-surface p-3">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : ""}`}>{value}</div>
      <div className="text-xs text-muted">{detail}</div>
    </div>
  );
}
