// The panels on the market screens. Each loads its own data, so a slow source never holds up the rest.
import { useState } from "react";
import { Link } from "react-router-dom";
import { BoardGroup, CurvePoint, EarningsEvent, Mover, MoversSet, Overview, api, marketsApi } from "../api";
import * as fmt from "../format";
import { companyPath } from "../functions";
import { useSaved } from "../storage";
import { useApi } from "../useApi";
import { Change, MiniSpark, Panel, PanelState, Segmented, level } from "./Terminal";

const FIVE_MIN = 5 * 60 * 1000;

// ---------- World markets ----------

export function BoardPanel({ groups, title, code = "WEI", wide = false }: { groups: string[]; title: string; code?: string; wide?: boolean }) {
  const { data, error } = useApi(marketsApi.board, "board", FIVE_MIN);
  const shown = data?.filter((g) => groups.includes(g.group));
  return (
    <Panel title={title} code={code} to="/wei" bodyClass="">
      {!shown ? <div className="p-3"><PanelState error={error} /></div> : <BoardTable groups={shown} wide={wide} />}
    </Panel>
  );
}

function BoardTable({ groups, wide }: { groups: BoardGroup[]; wide: boolean }) {
  return (
    <table className="w-full text-xs">
      <thead className="sr-only">
        <tr>
          <th>Market</th>
          <th>Last</th>
          {wide && <th>Change</th>}
          <th>Day</th>
          {wide && <th>One month</th>}
          <th>Trend, one month</th>
        </tr>
      </thead>
      {groups.map((g) => (
        <tbody key={g.group}>
          {groups.length > 1 && (
            <tr>
              <th colSpan={wide ? 6 : 4} className="bg-bg px-3 pt-2 pb-1 text-left text-xs font-semibold text-muted">
                {g.group}
              </th>
            </tr>
          )}
          {g.items.map((q) => (
            <tr key={q.symbol} className="border-t border-line/60 hover:bg-subtle">
              <td className="px-3 py-1 font-sans font-medium whitespace-nowrap">{q.label}</td>
              <td className="px-2 py-1 text-right">{level(q)}</td>
              {wide && (
                <td className="px-2 py-1 text-right">
                  <span className={(q.change ?? 0) >= 0 ? "text-gain" : "text-loss"}>
                    {q.changeBp !== undefined ? "" : q.change === null ? "N/A" : fmt.signed(q.change, Math.abs(q.change) < 1 ? 4 : 2)}
                  </span>
                </td>
              )}
              <td className="px-2 py-1 text-right">
                <Change value={q.changePercent} bp={q.changeBp} />
              </td>
              {wide && (
                <td className="px-2 py-1 text-right">
                  <Change value={q.monthChangePercent} />
                </td>
              )}
              <td className="py-1 pr-3 pl-2 text-right">
                <MiniSpark values={q.spark} width={wide ? 110 : 64} />
              </td>
            </tr>
          ))}
        </tbody>
      ))}
    </table>
  );
}

// ---------- Movers ----------

type MoverView = "gainers" | "losers" | "active";
const VIEWS: { value: MoverView; label: string }[] = [
  { value: "gainers", label: "Gainers" },
  { value: "losers", label: "Losers" },
  { value: "active", label: "Most traded" },
];

export function MoversPanel({ rows = 8 }: { rows?: number }) {
  const { data, error } = useApi(marketsApi.movers, "movers", 10 * 60 * 1000);
  const [country, setCountry] = useState<"us" | "ca">("us");
  const [view, setView] = useState<MoverView>("gainers");
  return (
    <Panel
      title="Movers"
      code="MOST"
      to="/most"
      bodyClass=""
      actions={
        <>
          <Segmented label="Country" options={[{ value: "us", label: "US" }, { value: "ca", label: "TSX" }]} value={country} onChange={setCountry} />
        </>
      }
    >
      <div className="border-b border-line px-3 py-1.5">
        <Segmented label="List" options={VIEWS} value={view} onChange={setView} />
      </div>
      {!data ? <div className="p-3"><PanelState error={error} /></div> : <MoverTable set={data[country]} view={view} rows={rows} />}
    </Panel>
  );
}

export function MoverTable({ set, view, rows = 10 }: { set: MoversSet; view: MoverView; rows?: number }) {
  return (
    <>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-muted">
            <th className="px-3 py-1 text-left font-medium">Ticker</th>
            <th className="hidden px-2 py-1 text-left font-medium sm:table-cell lg:hidden 2xl:table-cell">Name</th>
            <th className="px-2 py-1 text-right font-medium">Last</th>
            <th className="px-2 py-1 text-right font-medium">Day</th>
            <th className="py-1 pr-3 pl-2 text-right font-medium">{view === "active" ? "Traded" : "Mkt cap"}</th>
          </tr>
        </thead>
        <tbody>
          {set[view].slice(0, rows).map((m: Mover) => (
            <tr key={m.symbol} className="border-t border-line/60 hover:bg-subtle">
              <td className="px-3 py-1 font-semibold whitespace-nowrap">
                <Link to={companyPath(m.symbol)} className="text-accent hover:underline">
                  {m.symbol}
                </Link>
              </td>
              <td className="hidden max-w-48 truncate px-2 py-1 font-sans text-muted sm:table-cell lg:hidden 2xl:table-cell">{m.name}</td>
              <td className="px-2 py-1 text-right">{m.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
              <td className="px-2 py-1 text-right">
                <Change value={m.changePercent} />
              </td>
              <td className="py-1 pr-3 pl-2 text-right text-muted">{fmt.big(view === "active" ? m.dollarVolume : m.marketCap)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
        Among the {set.universe} largest companies: <span className="text-gain">{set.advancing} up</span>,{" "}
        <span className="text-loss">{set.declining} down</span>. Traded is the day's dollar volume.
      </p>
    </>
  );
}

// ---------- Rates ----------

const CURVE_SERIES: { key: keyof Omit<CurvePoint, "tenor">; label: string; color: string; dash?: string }[] = [
  { key: "now", label: "Now", color: "var(--accent)" },
  { key: "monthAgo", label: "1 month ago", color: "var(--info)", dash: "4 3" },
  { key: "yearAgo", label: "1 year ago", color: "var(--muted)", dash: "2 3" },
];

/** A yield curve: yield (%) by maturity, now against one month and one year ago. Hover a maturity for its values. */
export function CurveChart({ points, height = 190 }: { points: CurvePoint[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const width = 520;
  const pad = { l: 34, r: 10, t: 10, b: 22 };
  const values = points.flatMap((p) => [p.now, p.monthAgo, p.yearAgo]).filter((v): v is number => v !== null);
  const min = Math.floor(Math.min(...values) * 2) / 2;
  const max = Math.ceil(Math.max(...values) * 2) / 2;
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / Math.max(points.length - 1, 1);
  const y = (v: number) => pad.t + ((max - v) / (max - min || 1)) * (height - pad.t - pad.b);
  const ticks = [];
  for (let v = min; v <= max + 1e-9; v += max - min > 2 ? 1 : 0.5) ticks.push(v);
  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${width} ${height}`} className="block w-full" role="img" aria-label="Yield curve now, one month ago and one year ago">
          {ticks.map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
                {v.toFixed(1)}
              </text>
            </g>
          ))}
          {points.map((p, i) => (
            <text key={p.tenor} x={x(i)} y={height - 6} textAnchor="middle" fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">
              {p.tenor}
            </text>
          ))}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--line-strong)" />}
          {[...CURVE_SERIES].reverse().map((s) => {
            const pts = points.map((p, i) => [i, p[s.key]] as const).filter((t): t is readonly [number, number] => t[1] !== null);
            const d = pts.map(([i, v], k) => `${k ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join("");
            return (
              <g key={s.key}>
                <path d={d} fill="none" stroke={s.color} strokeWidth={2} strokeDasharray={s.dash} strokeLinejoin="round" />
                {s.key === "now" &&
                  pts.map(([i, v]) => <circle key={i} cx={x(i)} cy={y(v)} r={hover === i ? 4.5 : 3} fill={s.color} stroke="var(--surface)" strokeWidth={2} />)}
              </g>
            );
          })}
          {points.map((p, i) => (
            <rect
              key={p.tenor}
              x={x(i) - (width - pad.l - pad.r) / Math.max(points.length - 1, 1) / 2}
              y={0}
              width={(width - pad.l - pad.r) / Math.max(points.length - 1, 1)}
              height={height}
              fill="transparent"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 rounded-sm border border-line-strong bg-surface px-2 py-1 font-mono text-xs shadow-sm"
            style={{ left: `${(x(hover) / width) * 100}%`, transform: hover > points.length / 2 ? "translateX(calc(-100% - 8px))" : "translateX(8px)" }}
          >
            <div className="font-semibold">{points[hover].tenor}</div>
            {CURVE_SERIES.map((s) => (
              <div key={s.key} className="flex justify-between gap-3">
                <span className="text-muted">{s.label}</span>
                <span>{points[hover][s.key] === null ? "N/A" : `${(points[hover][s.key] as number).toFixed(2)}%`}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {CURVE_SERIES.map((s) => (
          <li key={s.key} className="flex items-center gap-1.5">
            <svg width="18" height="6" aria-hidden>
              <line x1="0" x2="18" y1="3" y2="3" stroke={s.color} strokeWidth="2" strokeDasharray={s.dash} />
            </svg>
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function RatesPanel() {
  const { data, error } = useApi(marketsApi.rates, "rates");
  const [country, setCountry] = useState<"us" | "ca">("us");
  const curve = data?.[country];
  const spread = (pts: CurvePoint[], long: string, short: string) => {
    const l = pts.find((p) => p.tenor === long)?.now;
    const s = pts.find((p) => p.tenor === short)?.now;
    return l !== undefined && s !== undefined ? (l - s) * 100 : null;
  };
  return (
    <Panel
      title={country === "us" ? "US Treasury curve" : "Government of Canada curve"}
      code="GC"
      to="/rates"
      actions={<Segmented label="Country" options={[{ value: "us", label: "US" }, { value: "ca", label: "CA" }]} value={country} onChange={setCountry} />}
    >
      {!curve ? (
        <PanelState error={error} />
      ) : (
        <>
          <CurveChart points={curve.points} height={170} />
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-2 font-mono text-xs">
            <dt className="font-sans text-muted">10Y minus 2Y</dt>
            <dd className="text-right">{fmt.signed(spread(curve.points, "10Y", "2Y"), 0)}bp</dd>
            {data.policy.map((p) => (
              <FragmentRow key={p.label} label={p.label.replace(" (upper)", "")} value={p.value === null ? "N/A" : `${p.value.toFixed(2)}%`} />
            ))}
          </dl>
          <p className="mt-1 text-xs text-muted">As of {curve.date}. Source: {country === "us" ? "FRED (US Treasury)" : "Bank of Canada"}.</p>
        </>
      )}
    </Panel>
  );
}

function FragmentRow({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="font-sans text-muted">{label}</dt>
      <dd className="text-right">{value}</dd>
    </>
  );
}

// ---------- The economy ----------

export function EconomyPanel({ wide = false }: { wide?: boolean }) {
  const { data, error } = useApi(marketsApi.economy, "economy");
  return (
    <Panel title="Economy" code="ECO" to="/eco" bodyClass="">
      {!data ? (
        <div className="p-3"><PanelState error={error} /></div>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="px-3 py-1 text-left font-medium">Indicator</th>
              <th className="px-2 py-1 text-right font-medium">Latest</th>
              <th className="px-2 py-1 text-right font-medium">Prior</th>
              {wide && <th className="px-2 py-1 text-right font-medium">Period</th>}
              <th className="py-1 pr-3 pl-2 text-right font-medium">{wide ? "Last 2 years" : "Trend"}</th>
            </tr>
          </thead>
          {data.map((c) => (
            <tbody key={c.country}>
              <tr>
                <th colSpan={wide ? 5 : 4} className="bg-bg px-3 pt-2 pb-1 text-left text-xs font-semibold text-muted">
                  {c.country}
                </th>
              </tr>
              {c.items.map((i) => {
                const show = (v: number | null) => (v === null ? "N/A" : i.unit === "k" ? `${v.toFixed(0)}k` : `${v.toFixed(i.unit === "%" ? 1 : 2)}${i.unit}`);
                return (
                  <tr key={i.label} className="border-t border-line/60">
                    <td className="px-3 py-1 font-sans">{i.label}</td>
                    <td className="px-2 py-1 text-right font-semibold">{show(i.value)}</td>
                    <td className="px-2 py-1 text-right text-muted">{show(i.previous)}</td>
                    {wide && <td className="px-2 py-1 text-right text-muted">{i.date.slice(0, 7)}</td>}
                    <td className="py-1 pr-3 pl-2 text-right">
                      <MiniSpark values={i.spark} width={wide ? 140 : 60} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
      )}
      {data && <p className="border-t border-line px-3 py-1.5 text-xs text-muted">Sources: FRED (St. Louis Fed) and the Bank of Canada. Spark lines are colour-coded by direction, not by good or bad.</p>}
    </Panel>
  );
}

// ---------- Earnings calendar ----------

export function EarningsPanel({ limit = 12, full = false }: { limit?: number; full?: boolean }) {
  const { data, error } = useApi(marketsApi.earnings, "earnings");
  const rows = data ? (full ? data : data.slice(0, limit)) : null;
  const days = new Map<string, EarningsEvent[]>();
  rows?.forEach((e) => days.set(e.date, [...(days.get(e.date) ?? []), e]));
  return (
    <Panel title={full ? "Earnings calendar, next two weeks" : "Upcoming earnings"} code="EVTS" to="/earnings" bodyClass="">
      {!rows ? (
        <div className="p-3"><PanelState error={error} /></div>
      ) : rows.length === 0 ? (
        <p className="p-3 text-sm text-muted">No reports from companies over $10B in the next two weeks.</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-muted">
              <th className="px-3 py-1 text-left font-medium">Ticker</th>
              <th className="px-2 py-1 text-left font-medium">{full ? "Company" : "Time"}</th>
              {full && <th className="hidden px-2 py-1 text-left font-medium md:table-cell">Sector</th>}
              {full && <th className="px-2 py-1 text-left font-medium">Time</th>}
              <th className="px-2 py-1 text-right font-medium">EPS est.</th>
              {full && <th className="hidden px-2 py-1 text-right font-medium sm:table-cell">Revenue est.</th>}
              <th className="py-1 pr-3 pl-2 text-right font-medium">Mkt cap</th>
            </tr>
          </thead>
          {[...days.entries()].map(([day, events]) => (
            <tbody key={day}>
              <tr>
                <th colSpan={full ? 7 : 4} className="bg-bg px-3 pt-2 pb-1 text-left text-xs font-semibold text-muted">
                  {new Date(day + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                </th>
              </tr>
              {events.map((e) => (
                <tr key={e.symbol} className="border-t border-line/60 hover:bg-subtle">
                  <td className="px-3 py-1 font-semibold">
                    <Link to={companyPath(e.symbol, "Analysts")} className="text-accent hover:underline">
                      {e.symbol}
                    </Link>
                  </td>
                  {full && <td className="max-w-56 truncate px-2 py-1 font-sans">{e.name}</td>}
                  {full && <td className="hidden px-2 py-1 font-sans text-muted md:table-cell">{e.sector}</td>}
                  <td className="px-2 py-1 font-sans text-muted">{e.hour || "N/A"}</td>
                  <td className="px-2 py-1 text-right">{e.epsEstimate === null ? "N/A" : e.epsEstimate.toFixed(2)}</td>
                  {full && <td className="hidden px-2 py-1 text-right sm:table-cell">{fmt.big(e.revenueEstimate)}</td>}
                  <td className="py-1 pr-3 pl-2 text-right text-muted">{fmt.big(e.marketCap)}</td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      )}
      {rows && <p className="border-t border-line px-3 py-1.5 text-xs text-muted">Companies over $10B. Estimates are analysts' consensus, from Finnhub.</p>}
    </Panel>
  );
}

// ---------- Watchlist ----------

/** Live quotes for saved companies. Prices come from each company's overview, which the server caches for 15 minutes. */
export function useQuotes(symbols: string[]) {
  const key = symbols.join(",");
  return useApi(
    async () => {
      const out: Record<string, Overview | null> = {};
      await Promise.all(symbols.map((s) => api.overview(s).then((o) => (out[s] = o)).catch(() => (out[s] = null))));
      return out;
    },
    key,
    FIVE_MIN,
  );
}

export function WatchPanel() {
  const { saved } = useSaved();
  const { data } = useQuotes(saved.slice(0, 8));
  return (
    <Panel title="Your watchlist" code="MON" to="/monitor" bodyClass="">
      {saved.length === 0 ? (
        <p className="p-3 text-sm text-muted">
          Tap the star next to any company's name to follow it here, or <Link to="/monitor" className="text-accent underline hover:text-accent-hover">add companies to your watchlist</Link>.
        </p>
      ) : (
        <table className="w-full text-xs">
          <tbody>
            {saved.slice(0, 8).map((s) => {
              const q = data?.[s];
              return (
                <tr key={s} className="border-t border-line/60 first:border-t-0 hover:bg-subtle">
                  <td className="px-3 py-1 font-semibold">
                    <Link to={companyPath(s)} className="text-accent hover:underline">{s}</Link>
                  </td>
                  <td className="max-w-40 truncate px-2 py-1 font-sans text-muted">{q?.name ?? (data ? "N/A" : "…")}</td>
                  <td className="px-2 py-1 text-right">{q ? fmt.num(q.price) : ""}</td>
                  <td className="py-1 pr-3 pl-2 text-right">{q && <Change value={q.changePercent} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
