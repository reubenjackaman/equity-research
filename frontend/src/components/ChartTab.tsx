import { useEffect, useMemo, useRef, useState } from "react";
import {
  CandlestickSeries, ColorType, CrosshairMode, HistogramSeries, LineSeries, LineStyle, createChart,
  type IChartApi, type Time, type UTCTimestamp,
} from "lightweight-charts";
import { Bar, BarRange, companyApi } from "../api";
import * as fmt from "../format";
import { cssVar, type Theme } from "../theme";
import { useApi } from "../useApi";
import { Panel, PanelState, Segmented } from "./Terminal";

const RANGES: BarRange[] = ["1D", "5D", "1M", "6M", "YTD", "1Y", "5Y", "MAX"];
type Indicator = "sma20" | "sma50" | "sma200" | "bollinger" | "volume" | "rsi" | "compare";
const INDICATORS: { key: Indicator; label: string; title: string }[] = [
  { key: "sma20", label: "MA 20", title: "20-bar simple moving average" },
  { key: "sma50", label: "MA 50", title: "50-bar simple moving average" },
  { key: "sma200", label: "MA 200", title: "200-bar simple moving average" },
  { key: "bollinger", label: "Bollinger", title: "Bollinger bands: 20-bar average ± 2 standard deviations" },
  { key: "volume", label: "Volume", title: "Volume bars under the price" },
  { key: "rsi", label: "RSI 14", title: "Relative strength index (14 bars), in its own pane" },
  { key: "compare", label: "vs index", title: "Percent change against the S&P 500 (or S&P/TSX for TSX listings)" },
];

// Line colours for overlays, in a fixed order so each indicator always keeps its colour.
const OVERLAY = { sma20: "--info", sma50: "--warn", sma200: "--accent", bollinger: "--muted" } as const;

function sma(values: number[], n: number) {
  const out: (number | null)[] = [];
  let sum = 0;
  values.forEach((v, i) => {
    sum += v;
    if (i >= n) sum -= values[i - n];
    out.push(i >= n - 1 ? sum / n : null);
  });
  return out;
}

function stdev(values: number[], n: number, means: (number | null)[]) {
  return values.map((_, i) => {
    const m = means[i];
    if (m === null) return null;
    const window = values.slice(i - n + 1, i + 1);
    return Math.sqrt(window.reduce((s, v) => s + (v - m) ** 2, 0) / n);
  });
}

/** Wilder's RSI: 100 - 100 / (1 + average gain / average loss) over 14 bars. */
function rsi(values: number[], n = 14) {
  const out: (number | null)[] = values.map(() => null);
  let gain = 0;
  let loss = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (i <= n) {
      gain += Math.max(d, 0) / n;
      loss += Math.max(-d, 0) / n;
      if (i === n) out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    } else {
      gain = (gain * (n - 1) + Math.max(d, 0)) / n;
      loss = (loss * (n - 1) + Math.max(-d, 0)) / n;
      out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }
  }
  return out;
}

/** Return, volatility and worst fall over the bars shown. */
function stats(bars: Bar[], intraday: boolean, range: BarRange) {
  const closes = bars.map((b) => b.close);
  const first = closes[0];
  const last = closes[closes.length - 1];
  const rets = closes.slice(1).map((c, i) => Math.log(c / closes[i]));
  const mean = rets.reduce((a, b) => a + b, 0) / (rets.length || 1);
  const sd = Math.sqrt(rets.reduce((s, r) => s + (r - mean) ** 2, 0) / Math.max(rets.length - 1, 1));
  const perYear = range === "5Y" ? 52 : range === "MAX" ? 12 : 252;
  let peak = -Infinity;
  let drawdown = 0;
  for (const c of closes) {
    peak = Math.max(peak, c);
    drawdown = Math.min(drawdown, c / peak - 1);
  }
  return {
    change: (last / first - 1) * 100,
    high: Math.max(...bars.map((b) => b.high)),
    low: Math.min(...bars.map((b) => b.low)),
    avgVolume: bars.reduce((s, b) => s + b.volume, 0) / bars.length,
    volatility: intraday ? null : sd * Math.sqrt(perYear) * 100,
    drawdown: drawdown * 100,
  };
}

/** GP: the price chart, with technical overlays, volume, RSI and a comparison against the main index. */
export default function ChartTab({ ticker, currency, theme }: { ticker: string; currency: string | null; theme: Theme }) {
  const [range, setRange] = useState<BarRange>("1Y");
  const [kind, setKind] = useState<"Candles" | "Line">("Candles");
  const [on, setOn] = useState<Set<Indicator>>(new Set(["sma50", "volume"]));
  const index = ticker.endsWith(".TO") || ticker.endsWith(".V") ? "^GSPTSE" : "^GSPC";
  const indexName = index === "^GSPTSE" ? "S&P/TSX" : "S&P 500";
  const { data, error } = useApi(() => companyApi.bars(ticker, range), `${ticker}:${range}`);
  const compare = on.has("compare");
  const bench = useApi(() => (compare ? companyApi.bars(index, range) : Promise.resolve(null)), `${index}:${range}:${compare}`);
  const box = useRef<HTMLDivElement>(null);

  const toggle = (k: Indicator) => setOn((s) => {
    const next = new Set(s);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    return next;
  });

  const summary = useMemo(() => (data && data.bars.length > 1 ? stats(data.bars, data.intraday, range) : null), [data, range]);
  const benchChange = bench.data && bench.data.bars.length > 1
    ? (bench.data.bars[bench.data.bars.length - 1].close / bench.data.bars[0].close - 1) * 100
    : null;

  useEffect(() => {
    if (!box.current || !data?.bars.length) return;
    const color = (v: string) => cssVar(v);
    const bars = data.bars;
    const t = (b: Bar) => (data.intraday ? (b.time as UTCTimestamp) : (b.time as Time));
    const closes = bars.map((b) => b.close);
    const chart: IChartApi = createChart(box.current, {
      autoSize: true,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: color("--muted"),
        fontFamily: "IBM Plex Mono, monospace",
        fontSize: 11,
        attributionLogo: false,
        panes: { separatorColor: color("--line"), separatorHoverColor: color("--line-strong") },
      },
      grid: { vertLines: { color: color("--line") }, horzLines: { color: color("--line") } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: color("--line") },
      timeScale: { borderColor: color("--line"), timeVisible: data.intraday, secondsVisible: false },
      localization: data.intraday
        ? { timeFormatter: (time: number) => new Date(time * 1000).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) }
        : undefined,
    });

    if (compare && bench.data?.bars.length) {
      // Both lines as % change from the first bar, matched by date.
      const pct = (series: Bar[]) => series.map((b) => ({ time: t(b), value: (b.close / series[0].close - 1) * 100 }));
      const stock = chart.addSeries(LineSeries, { color: color("--accent"), lineWidth: 2, title: ticker, priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(1)}%` } });
      stock.setData(pct(bars));
      const idx = chart.addSeries(LineSeries, { color: color("--info"), lineWidth: 2, title: indexName, priceFormat: { type: "custom", formatter: (v: number) => `${v.toFixed(1)}%` } });
      const benchBars = bench.data.bars.filter((b) => typeof b.time === typeof bars[0].time);
      idx.setData(pct(benchBars));
    } else {
      const main =
        kind === "Candles"
          ? chart.addSeries(CandlestickSeries, {
              upColor: color("--gain"), downColor: color("--loss"), borderVisible: false,
              wickUpColor: color("--gain"), wickDownColor: color("--loss"),
            })
          : chart.addSeries(LineSeries, { color: color("--accent"), lineWidth: 2 });
      main.setData(kind === "Candles" ? bars.map((b) => ({ time: t(b), open: b.open, high: b.high, low: b.low, close: b.close })) : bars.map((b) => ({ time: t(b), value: b.close })));

      const line = (values: (number | null)[], cssColor: string, style = LineStyle.Solid) => {
        const s = chart.addSeries(LineSeries, { color: color(cssColor), lineWidth: 1, lineStyle: style, priceLineVisible: false, lastValueVisible: false, crosshairMarkerVisible: false });
        s.setData(values.map((v, i) => (v === null ? { time: t(bars[i]) } : { time: t(bars[i]), value: v })));
      };
      if (on.has("sma20")) line(sma(closes, 20), OVERLAY.sma20);
      if (on.has("sma50")) line(sma(closes, 50), OVERLAY.sma50);
      if (on.has("sma200")) line(sma(closes, 200), OVERLAY.sma200);
      if (on.has("bollinger")) {
        const mid = sma(closes, 20);
        const sd = stdev(closes, 20, mid);
        line(mid.map((m, i) => (m === null ? null : m + 2 * (sd[i] as number))), OVERLAY.bollinger, LineStyle.Dashed);
        line(mid.map((m, i) => (m === null ? null : m - 2 * (sd[i] as number))), OVERLAY.bollinger, LineStyle.Dashed);
      }
      if (on.has("volume")) {
        const vol = chart.addSeries(HistogramSeries, { priceScaleId: "volume", priceFormat: { type: "volume" }, lastValueVisible: false, priceLineVisible: false });
        vol.priceScale().applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });
        const up = color("--gain") + "66";
        const down = color("--loss") + "66";
        vol.setData(bars.map((b, i) => ({ time: t(b), value: b.volume, color: b.close >= (bars[i - 1]?.close ?? b.open) ? up : down })));
      }
      if (on.has("rsi")) {
        const r = chart.addSeries(LineSeries, { color: color("--info"), lineWidth: 1, priceLineVisible: false, title: "RSI" }, 1);
        r.setData(rsi(closes).map((v, i) => (v === null ? { time: t(bars[i]) } : { time: t(bars[i]), value: v })));
        r.createPriceLine({ price: 70, color: color("--line-strong"), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
        r.createPriceLine({ price: 30, color: color("--line-strong"), lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: "" });
        chart.panes()[1]?.setHeight(110);
      }
    }
    chart.timeScale().fitContent();
    return () => chart.remove();
  }, [data, bench.data, kind, on, compare, theme, ticker, indexName]);

  const legend = INDICATORS.filter((i) => on.has(i.key) && i.key in OVERLAY && !compare);

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_17rem]">
      <Panel
        title={`${ticker} price chart`}
        code="GP"
        bodyClass="p-2"
        actions={<Segmented label="Range" options={RANGES} value={range} onChange={setRange} />}
      >
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          <Segmented label="Chart type" options={["Candles", "Line"] as const} value={kind} onChange={setKind} />
          <div role="group" aria-label="Studies" className="flex flex-wrap gap-1">
            {INDICATORS.map((i) => (
              <button
                key={i.key}
                title={i.title}
                aria-pressed={on.has(i.key)}
                onClick={() => toggle(i.key)}
                className={`rounded-sm border px-1.5 py-0.5 font-mono text-xs transition-colors ${
                  on.has(i.key) ? "border-accent text-accent" : "border-line text-muted hover:text-ink"
                }`}
              >
                {i.label}
              </button>
            ))}
          </div>
        </div>
        <div className="relative h-[26rem] sm:h-[32rem]">
          {(error || !data) && (
            <div className="absolute inset-0 p-2">
              <PanelState error={error} rows={10} />
            </div>
          )}
          <div ref={box} className="absolute inset-0" />
        </div>
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 px-1 text-xs text-muted">
          {compare ? (
            <>
              <LegendItem color="--accent" label={ticker} />
              <LegendItem color="--info" label={indexName} />
            </>
          ) : (
            legend.map((i) => <LegendItem key={i.key} color={OVERLAY[i.key as keyof typeof OVERLAY]} label={i.label} dashed={i.key === "bollinger"} />)
          )}
          {data?.intraday && <li>Times are New York time. Intraday bars every {range === "1D" ? "5" : "30"} minutes.</li>}
        </ul>
      </Panel>

      <Panel title={`Statistics, ${range}`} bodyClass="p-3">
        {!summary ? (
          <PanelState error={error} rows={7} />
        ) : (
          <dl className="space-y-1.5 font-mono text-xs">
            <Row label="Change" value={<span className={summary.change >= 0 ? "text-gain" : "text-loss"}>{fmt.signed(summary.change)}%</span>} />
            {compare && benchChange !== null && (
              <>
                <Row label={indexName} value={<span className={benchChange >= 0 ? "text-gain" : "text-loss"}>{fmt.signed(benchChange)}%</span>} />
                <Row label="Relative" value={<span className={summary.change - benchChange >= 0 ? "text-gain" : "text-loss"}>{fmt.signed(summary.change - benchChange)} pts</span>} />
              </>
            )}
            <Row label="High" value={fmt.price(summary.high, currency)} />
            <Row label="Low" value={fmt.price(summary.low, currency)} />
            <Row label="Avg. volume / bar" value={fmt.big(summary.avgVolume)} />
            <Row label="Volatility (annual)" value={summary.volatility === null ? "N/A" : `${summary.volatility.toFixed(1)}%`} />
            <Row label="Max drawdown" value={<span className="text-loss">{summary.drawdown.toFixed(1)}%</span>} />
            {data && on.has("rsi") && (
              <Row label="RSI 14 (last)" value={fmt.num(rsi(data.bars.map((b) => b.close)).slice(-1)[0] ?? null, 1)} />
            )}
          </dl>
        )}
        <div className="mt-3 space-y-1.5 border-t border-line pt-2 text-xs text-muted">
          <p><span className="text-ink">Volatility</span>: the standard deviation of bar-to-bar returns, scaled to a year.</p>
          <p><span className="text-ink">Max drawdown</span>: the biggest fall from a high to a later low in this range.</p>
          <p><span className="text-ink">RSI</span> above 70 is often read as overbought, below 30 as oversold.</p>
        </div>
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="font-sans text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function LegendItem({ color, label, dashed = false }: { color: string; label: string; dashed?: boolean }) {
  return (
    <li className="flex items-center gap-1.5">
      <svg width="16" height="6" aria-hidden>
        <line x1="0" x2="16" y1="3" y2="3" stroke={`var(${color})`} strokeWidth="2" strokeDasharray={dashed ? "3 2" : undefined} />
      </svg>
      {label}
    </li>
  );
}
