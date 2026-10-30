import * as fmt from "../format";
import type { ValuationRow } from "../valuation";

/**
 * "Football field" valuation chart: one horizontal bar per method showing the range of
 * values it suggests, with a tick for the base case and a vertical line at today's price.
 */
export default function FootballField({
  rows,
  price,
  currency,
  compact = false,
}: {
  rows: ValuationRow[];
  price: number | null;
  currency: string | null;
  compact?: boolean; // tighter layout for the one-page tear sheet
}) {
  const values = rows.flatMap((r) => [r.low, r.high, r.mid]).filter((v): v is number => v !== null);
  if (price) values.push(price);
  if (!values.length) return <p className="text-sm text-slate-500">Not enough data for a valuation summary.</p>;

  // Axis with room on both sides for the value labels printed beside each bar.
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || max || 1;
  const lo = Math.max(0, min - span * 0.25);
  const hi = max + span * 0.28; // extra room: labels like "CA$111.62" are wide
  const pos = (v: number) => ((v - lo) / (hi - lo)) * 100;
  const ticks = niceTicks(lo, hi);
  const money = (v: number | null) => fmt.price(v, currency);

  return (
    <div className="football-field">
      <div className={compact ? "space-y-1" : "space-y-3"}>
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-1 gap-1 sm:grid-cols-[13rem_1fr] sm:items-center sm:gap-4">
            <div className="min-w-0">
              <div className={compact ? "text-[11px] font-semibold" : "text-sm font-medium"}>{r.label}</div>
              <div className={`text-slate-500 dark:text-slate-400 ${compact ? "text-[9px] leading-tight" : "text-xs"}`}>{r.detail}</div>
            </div>
            <div className={`relative rounded bg-slate-100 dark:bg-slate-800/70 ${compact ? "h-6" : "h-8"}`}>
              {price !== null && (
                <div className="absolute inset-y-[-6px] z-10 w-0.5 bg-slate-900 dark:bg-white" style={{ left: `${pos(price)}%` }} />
              )}
              {r.low !== null && r.high !== null ? (
                <div
                  className={`absolute ${compact ? "inset-y-1" : "inset-y-1.5"} rounded ${r.group === "market" ? "bg-slate-400 dark:bg-slate-500" : "bg-blue-600 dark:bg-blue-500"}`}
                  style={{ left: `${pos(r.low)}%`, width: `${Math.max(pos(r.high) - pos(r.low), 0.6)}%` }}
                  title={`${r.label}: ${money(r.low)} – ${money(r.high)}${r.mid !== null ? ` (base ${money(r.mid)})` : ""}`}
                >
                  {r.mid !== null && (
                    <div
                      className="absolute inset-y-[-3px] w-1 -translate-x-1/2 rounded-sm bg-amber-400 ring-2 ring-white dark:ring-slate-900"
                      style={{ left: `${((r.mid - r.low) / (r.high - r.low || 1)) * 100}%` }}
                    />
                  )}
                  <span className="absolute right-full top-1/2 mr-1.5 z-20 -translate-y-1/2 whitespace-nowrap rounded bg-slate-100 px-1 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {money(r.low)}
                  </span>
                  <span className="absolute left-full top-1/2 ml-1.5 z-20 -translate-y-1/2 whitespace-nowrap rounded bg-slate-100 px-1 text-[11px] tabular-nums text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    {money(r.high)}
                  </span>
                </div>
              ) : (
                <div className="absolute inset-0 flex items-center px-3 text-xs text-slate-500 dark:text-slate-400">{r.note}</div>
              )}
            </div>
          </div>
        ))}
        {/* Axis */}
        <div className="grid grid-cols-1 sm:grid-cols-[13rem_1fr] sm:gap-4">
          <div className="hidden sm:block" />
          <div className="relative h-5 text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
            {ticks.map((t) => (
              <span key={t} className="absolute -translate-x-1/2" style={{ left: `${pos(t)}%` }}>
                {money(t).replace(/\.00$/, "")}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className={`flex flex-wrap gap-x-5 gap-y-1 text-slate-600 dark:text-slate-300 ${compact ? "mt-1 text-[10px]" : "mt-3 text-xs"}`}>
        <Legend swatch="h-2.5 w-5 rounded-sm bg-slate-400 dark:bg-slate-500">Market reference</Legend>
        <Legend swatch="h-2.5 w-5 rounded-sm bg-blue-600 dark:bg-blue-500">Valuation method</Legend>
        <Legend swatch="h-3.5 w-1 rounded-sm bg-amber-400">Base case / median</Legend>
        <Legend swatch="h-3.5 w-0.5 bg-slate-900 dark:bg-white">Today's price {money(price)}</Legend>
      </div>
    </div>
  );
}

function Legend({ swatch, children }: { swatch: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-block ${swatch}`} />
      {children}
    </span>
  );
}

/** About 5 round-numbered axis ticks between lo and hi. */
function niceTicks(lo: number, hi: number) {
  const raw = (hi - lo) / 5;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const out = [];
  for (let t = Math.ceil(lo / step) * step; t <= hi; t += step) out.push(+t.toFixed(6));
  return out;
}
