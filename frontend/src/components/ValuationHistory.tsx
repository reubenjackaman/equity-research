import { useEffect, useState } from "react";
import { MultipleHistory, valuationHistoryApi } from "../api";

/** Each multiple against its own history: fiscal-year values, the average, and a ±1 standard deviation band. */
export default function ValuationHistory({ ticker }: { ticker: string }) {
  const [data, setData] = useState<MultipleHistory[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    valuationHistoryApi
      .get(ticker)
      .then((d) => !cancelled && setData(d.multiples))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  return (
    <section className="card">
      <h2 className="text-lg">Valuation history</h2>
      <p className="prose-width mt-1 text-sm text-muted">
        Today's multiples against the company's own past. The shaded band is the average ±1 standard deviation of the fiscal-year
        values.
      </p>
      {error && <p className="mt-4 text-sm text-muted">Valuation history unavailable: {error}</p>}
      {!data && !error && <div className="mt-4 h-48 animate-pulse rounded bg-subtle" />}
      {data && (
        <div className="mt-5 grid gap-8 md:grid-cols-3">
          {data.map((m) => (
            <Multiple key={m.key} m={m} />
          ))}
        </div>
      )}
      <p className="mt-5 text-xs text-muted">
        Fiscal-year values use the share price on each year-end date, the same as the Ratios tab; the last point is today's TTM value.
        Years where a multiple isn't meaningful (for example, P/E with a loss) are left out.
      </p>
    </section>
  );
}

function summary(m: MultipleHistory) {
  if (m.z === null || m.mean === null) return m.reason ?? "Not enough history to compare.";
  const years = m.points.length;
  const avg = `its ${years}-year average of ${m.mean.toFixed(1)}x`;
  if (Math.abs(m.z) < 0.25) return `Close to ${avg}.`;
  return `${Math.abs(m.z).toFixed(1)} standard deviations ${m.z > 0 ? "above" : "below"} ${avg}.`;
}

const W = 300;
const H = 150;
const PAD = { l: 34, r: 30, t: 10, b: 22 };

function Multiple({ m }: { m: MultipleHistory }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-sans text-sm font-semibold tracking-normal">{m.label}</h3>
        <span className="text-lg font-semibold">{m.current === null ? "N/A" : `${m.current.toFixed(1)}x`}</span>
      </div>
      <p className="mt-1 min-h-10 text-sm text-muted">{summary(m)}</p>
      {m.points.length >= 2 && <Chart m={m} />}
      {m.caution && <p className="mt-2 text-xs text-warn">{m.caution}</p>}
    </div>
  );
}

function Chart({ m }: { m: MultipleHistory }) {
  const series = [...m.points, ...(m.current !== null ? [{ label: "Now", value: m.current }] : [])];
  const band = m.mean !== null && m.sd !== null ? [m.mean - m.sd, m.mean + m.sd] : null;
  const all = [...series.map((p) => p.value), ...(band ?? [])];
  const lo = Math.min(0, ...all);
  const hi = Math.max(...all) * 1.08 || 1;
  const x = (i: number) => PAD.l + (i / Math.max(series.length - 1, 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const line = m.points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = series.length - 1;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 max-h-48 w-full" role="img" aria-label={`${m.label} by fiscal year. ${summary(m)}`}>
      {band && (
        <rect
          x={PAD.l}
          width={W - PAD.l - PAD.r}
          y={y(Math.min(band[1], hi))}
          height={Math.max(y(Math.max(band[0], lo)) - y(Math.min(band[1], hi)), 0)}
          fill="var(--subtle)"
        />
      )}
      {m.mean !== null && (
        <>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(m.mean)} y2={y(m.mean)} stroke="var(--line-strong)" strokeDasharray="3 3" />
          <text x={W - PAD.r + 3} y={y(m.mean) + 3} fontSize="9" fill="var(--muted)">
            avg
          </text>
        </>
      )}
      <line x1={PAD.l} x2={W - PAD.r} y1={H - PAD.b} y2={H - PAD.b} stroke="var(--line)" />
      {[lo, hi].map((v) => (
        <text key={v} x={PAD.l - 4} y={y(v) + 3} fontSize="9" textAnchor="end" fill="var(--muted)">
          {v.toFixed(0)}x
        </text>
      ))}
      <path d={line} fill="none" stroke="var(--ink)" strokeWidth="1.5" />
      {m.points.map((p, i) => (
        <circle key={p.label} cx={x(i)} cy={y(p.value)} r="2.5" fill="var(--ink)">
          <title>{`${p.label}: ${p.value.toFixed(1)}x`}</title>
        </circle>
      ))}
      {m.current !== null && (
        <>
          <line x1={x(last - 1)} x2={x(last)} y1={y(series[last - 1].value)} y2={y(m.current)} stroke="var(--accent)" strokeDasharray="2 2" />
          <circle cx={x(last)} cy={y(m.current)} r="4" fill="var(--accent)">
            <title>{`Today (TTM): ${m.current.toFixed(1)}x`}</title>
          </circle>
        </>
      )}
      <text x={x(0)} y={H - 6} fontSize="9" textAnchor="start" fill="var(--muted)">
        {series[0].label}
      </text>
      <text x={x(last)} y={H - 6} fontSize="9" textAnchor="end" fill="var(--muted)">
        {series[last].label}
      </text>
    </svg>
  );
}
