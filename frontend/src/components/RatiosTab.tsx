import { useEffect, useRef, useState } from"react";
import { RatioRow, Ratios, ratiosApi } from"../api";
import * as fmt from"../format";
import InfoTip from"./InfoTip";
import Sparkline from"./Sparkline";

const CATEGORIES = ["Profitability", "Liquidity", "Leverage", "Efficiency", "Valuation", "Growth"];

export default function RatiosTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Ratios | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    ratiosApi
      .get(ticker)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (error) return <p className="card mt-6 text-sm text-muted">Ratios unavailable: {error}</p>;
  if (!data) return <div className="mt-6 h-96 animate-pulse rounded bg-subtle" />;

  return (
    <div className="mt-6 space-y-4">
      {data.notes.map((n) =>
        n.startsWith("TTM =") ? (
          <p key={n} className="text-xs text-muted">{n}</p>
        ) : (
          <p key={n} className="rounded border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
            {n}
          </p>
        ),
      )}

      <CagrCard data={data} />

      {CATEGORIES.map((cat) => (
        <CategoryTable key={cat} title={cat} rows={data.ratios.filter((r) => r.category === cat)} columns={data.columns} />
      ))}

      <p className="text-xs leading-relaxed text-muted">
        All ratios are calculated in this app from the financial statements ({data.source}). Hover a ratio name for its
        formula, or a number for the actual inputs. Return and turnover ratios use average balances, so the first year shows
        N/A. N/A also means a denominator was zero or negative (not meaningful). Valuation ratios use the share price on each
        fiscal year-end. <span className="font-medium">TTM</span> = trailing twelve months at today's price.
      </p>
    </div>
  );
}

function CategoryTable({ title, rows, columns }: { title: string; rows: RatioRow[]; columns: Ratios["columns"] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = scrollRef.current;
    if (el) requestAnimationFrame(() => (el.scrollLeft = el.scrollWidth));
  }, [rows]);
  const labels = columns.map((c) => c.label);

  return (
    <div className="card overflow-hidden p-0 sm:p-0">
      <h2 className="px-4 pt-4 text-sm font-semibold">{title}</h2>
      <div ref={scrollRef} className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-xs text-muted">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left font-medium">Ratio · trend</th>
              {columns.map((c) => (
                <th key={c.label} className={`whitespace-nowrap px-3 py-2 text-right font-medium ${c.label === "TTM" ? "text-ink" : ""}`}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-line last:border-0 hover:bg-subtle">
                <td className="sticky left-0 z-10 bg-surface px-4 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="max-w-[9.5rem] sm:max-w-none sm:whitespace-nowrap">
                      <InfoTip
                        content={
                          <>
                            <div className="font-semibold text-ink">{r.label}</div>
                            <div className="mt-1 rounded bg-subtle px-2 py-1 font-mono text-xs">{r.formula}</div>
                            <div className="mt-1.5">{r.explanation}</div>
                          </>
                        }
                      >
                        {r.label}
                      </InfoTip>
                    </span>
                    <Sparkline values={r.values} labels={labels} format={(v) => fmt.ratio(v, r.format)} width={72} height={28} />
                  </div>
                </td>
                {r.values.map((v, i) => (
                  <td
                    key={i}
                    title={r.calcs[i] ? `${r.calcs[i]} = ${fmt.ratio(v, r.format)}`: "Not available or not meaningful"}
                    className={`whitespace-nowrap px-3 py-2 text-right ${v === null ? "text-muted" : ""} ${
                      columns[i].label === "TTM" ? "font-semibold" : ""
                    }`}
                  >
                    {fmt.ratio(v, r.format)}
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

function CagrCard({ data }: { data: Ratios }) {
  return (
    <div className="card">
      <h2 className="mb-3 text-sm font-semibold">
        <InfoTip
          content={
            <>
              <div className="font-semibold text-ink">Compound annual growth rate</div>
              <div className="mt-1 rounded bg-subtle px-2 py-1 font-mono text-xs">
                (Ending value ÷ Starting value)^(1 ÷ years) − 1
              </div>
              <div className="mt-1.5">
                The steady yearly growth rate that would take the starting value to the ending value. N/A when either end is
                zero or negative.
              </div>
            </>
          }
        >
          Multi-year growth (CAGR)
        </InfoTip>
      </h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {data.cagr.map((c) => (
          <div key={c.key} className="rounded bg-subtle p-3">
            <div className="text-xs text-muted">{c.label}</div>
            <div className="mt-1 flex gap-6">
              {(["cagr3", "cagr5"] as const).map((k) => (
                <div key={k} title={c[k] ? `${c[k]!.span}: ${c[k]!.calc}`: "Not available"}>
                  <div className="text-lg font-semibold">{fmt.ratio(c[k]?.value ?? null, "pct")}</div>
                  <div className="text-xs text-muted">{k === "cagr3" ? "3-year" : "5-year"}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
