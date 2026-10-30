import { useEffect, useRef, useState } from "react";
import { AreaSeries, ColorType, createChart } from "lightweight-charts";
import { api, PricePoint, Range } from "../api";
import { pct } from "../format";
import type { Theme } from "../theme";

const RANGES: Range[] = ["1M", "6M", "1Y", "5Y"];

export default function PriceChart({ ticker, theme }: { ticker: string; theme: Theme }) {
  const [range, setRange] = useState<Range>("1Y");
  const [data, setData] = useState<PricePoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .history(ticker, range)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker, range]);

  const first = data?.[0]?.close;
  const last = data?.[data.length - 1]?.close;
  const rangeReturn = first && last ? ((last - first) / first) * 100 : null;
  const up = (rangeReturn ?? 0) >= 0;

  // Draw the chart whenever the data or theme changes.
  useEffect(() => {
    if (!containerRef.current || !data?.length) return;
    const dark = theme === "dark";
    const line = up ? "#10b981" : "#f43f5e";

    const chart = createChart(containerRef.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: dark ? "#94a3b8" : "#64748b",
        attributionLogo: false,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: dark ? "#1e293b" : "#f1f5f9" },
      },
      rightPriceScale: { borderVisible: false },
      timeScale: { borderVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    const series = chart.addSeries(AreaSeries, {
      lineColor: line,
      lineWidth: 2,
      topColor: line + "40",
      bottomColor: line + "00",
      priceLineVisible: false,
    });
    series.setData(data.map((p) => ({ time: p.time, value: p.close })));
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, theme, up]);

  return (
    <div className="card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-semibold">Price</span>
          {rangeReturn !== null && (
            <span className={`ml-2 ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {up ? "+" : ""}
              {pct(rangeReturn)} over {range}
            </span>
          )}
        </div>
        <div className="flex rounded-lg bg-slate-100 p-0.5 dark:bg-slate-800">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                r === range
                  ? "bg-white shadow-sm dark:bg-slate-700"
                  : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <div className="relative h-64 sm:h-80">
        {error && <p className="p-4 text-sm text-slate-500">Price history unavailable: {error}</p>}
        {!error && !data && <div className="h-full animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />}
        <div ref={containerRef} className="absolute inset-0" />
      </div>
    </div>
  );
}
