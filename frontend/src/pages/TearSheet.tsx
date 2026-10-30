import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, Overview, PricePoint, Ratios, ratiosApi, Statements, statementsApi } from "../api";
import FootballField from "../components/FootballField";
import * as fmt from "../format";
import { buildValuationRows, useValuationData } from "../valuation";

/**
 * One-page research summary, laid out for printing. "Save as PDF" uses the browser's
 * print dialog (choose "Save as PDF" as the destination).
 */
export default function TearSheet() {
  const ticker = (useParams().ticker ?? "").toUpperCase();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [history, setHistory] = useState<PricePoint[] | null>(null);
  const [statements, setStatements] = useState<Statements | null>(null);
  const [ratios, setRatios] = useState<Ratios | null>(null);
  const [error, setError] = useState<string | null>(null);
  const valuation = useValuationData(ticker);

  useEffect(() => {
    api.overview(ticker).then(setOverview).catch((e) => setError(e.message));
    api.history(ticker, "1Y").then(setHistory).catch(() => setHistory([]));
    statementsApi.get(ticker, "annual").then(setStatements).catch(() => {});
    ratiosApi.get(ticker).then(setRatios).catch(() => {});
  }, [ticker]);

  useEffect(() => {
    if (overview) document.title = `${overview.symbol} tear sheet`;
  }, [overview]);

  // Always print on one page: if the content is taller than a letter page, scale it down to fit.
  const sheetRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = sheetRef.current;
    if (!el) return;
    const PAGE_HEIGHT = (11 - 0.8) * 96; // letter page minus 0.4in margins, in CSS pixels
    const observer = new ResizeObserver(() => {
      const padding = parseFloat(getComputedStyle(el).paddingTop) * 2;
      const height = el.getBoundingClientRect().height - padding;
      el.style.setProperty("--fit", String(Math.min(1, PAGE_HEIGHT / height)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [overview]);

  if (error) return <p className="p-8 text-sm">Couldn't load {ticker}: {error}</p>;
  const ready = overview && history && statements && ratios && !valuation.loading;

  return (
    // "force-light": paper is white, so this page ignores dark mode (see index.css).
    <div className="tearsheet force-light min-h-screen bg-slate-200 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[8.5in] items-center justify-between px-4 print:hidden">
        <span className="text-sm text-slate-600">{ready ? "Ready to print." : "Gathering data…"} Use "Save as PDF" in the print dialog.</span>
        <button
          onClick={() => window.print()}
          disabled={!ready}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          Save as PDF / Print
        </button>
      </div>

      <div ref={sheetRef} className="tearsheet-page mx-auto max-w-[8.5in] bg-white p-[0.4in] text-[11px] leading-snug text-slate-800 shadow-xl print:max-w-none print:p-0 print:shadow-none">
        {!overview ? (
          <p>Loading…</p>
        ) : (
          <Sheet o={overview} history={history} statements={statements} ratios={ratios} valuation={valuation} />
        )}
      </div>
    </div>
  );
}

function Sheet({
  o,
  history,
  statements,
  ratios,
  valuation,
}: {
  o: Overview;
  history: PricePoint[] | null;
  statements: Statements | null;
  ratios: Ratios | null;
  valuation: ReturnType<typeof useValuationData>;
}) {
  const up = (o.change ?? 0) >= 0;
  const ratio = (key: string) => ratios?.ratios.find((r) => r.key === key);
  const latest = (key: string) => {
    const r = ratio(key);
    return r ? fmt.ratio(r.values[r.values.length - 1], r.format) : "N/A";
  };
  const dcfValue = valuation.dcf?.valuation?.perShareTrading ?? null;
  const rows = valuation.loading ? [] : buildValuationRows(o, valuation.dcf, valuation.dcfError, valuation.comps);
  const comps = valuation.comps?.implied.filter((i) => i.value !== null && i.key !== "pb") ?? [];
  const compsMedian = comps.length ? [...comps].sort((a, b) => a.value! - b.value!)[Math.floor(comps.length / 2)].value : null;
  const vsPrice = (v: number | null) => (v !== null && v > 0 && o.price ? `${v >= o.price ? "+" : ""}${((v / o.price - 1) * 100).toFixed(0)}% vs price` : undefined);

  return (
    <>
      {/* Header */}
      <header className="flex items-end justify-between border-b-2 border-slate-900 pb-2">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-blue-700">Value Finch · tear sheet</div>
          <h1 className="text-2xl font-bold leading-tight text-slate-900">{o.name}</h1>
          <div className="text-slate-600">
            {o.symbol} · {o.exchange ?? "N/A"} · {o.sector ?? "N/A"} / {o.industry ?? "N/A"}
          </div>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-slate-900">{fmt.price(o.price, o.currency)}</div>
          <div className={up ? "text-emerald-700" : "text-rose-700"}>
            {fmt.signed(o.change)} ({fmt.signed(o.changePercent)}%) · {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </div>
        </div>
      </header>

      {/* Verdict strip */}
      <section className="mt-2 grid grid-cols-4 gap-2">
        <Kpi label="52-week range" value={`${fmt.price(o.fiftyTwoWeekLow, o.currency)} – ${fmt.price(o.fiftyTwoWeekHigh, o.currency)}`} small />
        <Kpi
          label="DCF value / share"
          value={dcfValue !== null && dcfValue > 0 ? fmt.price(dcfValue, o.currency) : "N/A"}
          sub={vsPrice(dcfValue)}
        />
        <Kpi label="Comps value / share" value={compsMedian !== null ? fmt.price(compsMedian, o.currency) : "N/A"} sub={vsPrice(compsMedian) ?? "median of peer multiples"} />
        <Kpi
          label="Analyst target (avg)"
          value={o.targetMean ? fmt.price(o.targetMean, o.currency) : "N/A"}
          sub={o.analystCount ? `${o.analystCount} analysts` : undefined}
        />
      </section>

      {/* Business + key stats */}
      <section className="mt-2 grid grid-cols-[1fr_15rem] gap-4">
        <div>
          <H>Business</H>
          <p className="line-clamp-[7] text-slate-700">{o.description ?? "No description available."}</p>
        </div>
        <div>
          <H>Key statistics</H>
          <dl className="divide-y divide-slate-200">
            <Row k="Market cap" v={`${o.currency === "USD" ? "$" : ""}${fmt.big(o.marketCap)}${o.currency !== "USD" ? ` ${o.currency}` : ""}`} />
            <Row k="52-week range" v={`${fmt.price(o.fiftyTwoWeekLow, o.currency)} – ${fmt.price(o.fiftyTwoWeekHigh, o.currency)}`} />
            <Row k="P/E (TTM)" v={latest("pe")} />
            <Row k="EV/EBITDA (TTM)" v={latest("ev_ebitda")} />
            <Row k="P/B" v={latest("pb")} />
            <Row k="FCF yield" v={latest("fcf_yield")} />
            <Row k="Dividend yield" v={fmt.pct(o.dividendYield)} />
            <Row k="Beta" v={fmt.num(o.beta)} />
          </dl>
        </div>
      </section>

      {/* Price + quality */}
      <section className="mt-2 grid grid-cols-[1fr_15rem] gap-4">
        <div>
          <H>Share price, last 12 months</H>
          {history?.length ? <MiniPriceChart points={history} currency={o.currency} /> : <p className="text-slate-500">N/A</p>}
        </div>
        <div>
          <H>Quality & balance sheet (TTM)</H>
          <dl className="divide-y divide-slate-200">
            <Row k="Gross margin" v={latest("gross_margin")} />
            <Row k="Operating margin" v={latest("operating_margin")} />
            <Row k="ROE" v={latest("roe")} />
            <Row k="ROIC" v={latest("roic")} />
            <Row k="Debt / equity" v={latest("debt_to_equity")} />
            <Row k="Interest coverage" v={latest("interest_coverage")} />
          </dl>
        </div>
      </section>

      {/* Financial summary */}
      {statements && <FinancialSummary s={statements} />}

      {/* Football field */}
      <section className="mt-2 break-inside-avoid">
        <H>Valuation summary</H>
        {rows.length ? <FootballField rows={rows} price={o.price} currency={o.currency} compact /> : <p className="text-slate-500">Loading…</p>}
      </section>

      <footer className="mt-4 border-t border-slate-300 pt-2 text-[9px] text-slate-500">
        Sources: SEC EDGAR filings, Yahoo Finance, Finnhub. Ratios and valuation calculated by the app; DCF and comps use the
        assumptions and peers chosen in the app. For educational purposes only. Not investment advice.
      </footer>
    </>
  );
}

function H({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1 border-b border-slate-300 pb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-900">{children}</h2>;
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between py-px">
      <dt className="text-slate-600">{k}</dt>
      <dd className="font-semibold tabular-nums text-slate-900">{v}</dd>
    </div>
  );
}

function Kpi({ label, value, sub, small }: { label: string; value: string; sub?: string; small?: boolean }) {
  return (
    <div className="rounded border border-slate-300 px-2 py-1.5">
      <div className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`font-bold text-slate-900 ${small ? "text-[13px] leading-6" : "text-base"}`}>{value}</div>
      {sub && <div className="text-[10px] text-slate-500">{sub}</div>}
    </div>
  );
}

function FinancialSummary({ s }: { s: Statements }) {
  const n = Math.min(5, s.columns.length);
  const cols = s.columns.slice(-n);
  const all = Object.fromEntries(Object.values(s.statements).flat().map((r) => [r.key, r.values.slice(-n)]));
  const growth = all.revenue.map((v, i) => {
    const prev = i === 0 ? s.statements.income[0].values[s.columns.length - n - 1] : all.revenue[i - 1];
    return v !== null && prev ? `${(((v - prev) / Math.abs(prev)) * 100).toFixed(1)}%` : "N/A";
  });
  const margin = all.revenue.map((v, i) => (v && all.operating_income[i] !== null ? `${((all.operating_income[i]! / v) * 100).toFixed(1)}%` : "N/A"));
  const m = (v: number | null) => fmt.statementCell(v, "money");
  const lines: [string, string[], boolean?][] = [
    ["Revenue", all.revenue.map(m), true],
    ["  Growth", growth],
    ["Operating income", all.operating_income.map(m)],
    ["  Operating margin", margin],
    ["Net income", all.net_income.map(m), true],
    ["Diluted EPS", all.eps_diluted.map((v) => fmt.statementCell(v, "perShare"))],
    ["Free cash flow", all.fcf.map(m), true],
    ["Total debt", all.total_debt.map(m)],
  ];
  return (
    <section className="mt-2 break-inside-avoid">
      <H>Financial summary ({s.currency} millions, except EPS)</H>
      <table className="w-full tabular-nums">
        <thead>
          <tr className="text-slate-500">
            <th className="py-0.5 text-left font-medium" />
            {cols.map((c) => (
              <th key={c.end} className="py-0.5 text-right font-semibold text-slate-900">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map(([label, values, bold]) => (
            <tr key={label} className={`border-t border-slate-200 ${bold ? "font-semibold text-slate-900" : "text-slate-700"}`}>
              <td className="whitespace-pre py-px">{label}</td>
              {values.map((v, i) => (
                <td key={i} className="py-px text-right">
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

/** Simple SVG price chart (SVG prints crisply, unlike canvas charts). */
function MiniPriceChart({ points, currency }: { points: PricePoint[]; currency: string | null }) {
  const W = 480;
  const H = 120;
  const closes = points.map((p) => p.close);
  const lo = Math.min(...closes);
  const hi = Math.max(...closes);
  const x = (i: number) => (i / (points.length - 1)) * W;
  const y = (v: number) => H - 6 - ((v - lo) / (hi - lo || 1)) * (H - 12);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.close).toFixed(1)}`).join("");
  const change = (closes[closes.length - 1] / closes[0] - 1) * 100;
  const color = change >= 0 ? "#047857" : "#be123c";
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[88px] w-full" preserveAspectRatio="none">
        <path d={`${line}L${W},${H}L0,${H}Z`} fill={color} fillOpacity={0.08} />
        <path d={line} fill="none" stroke={color} strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="mt-0.5 flex justify-between text-[10px] text-slate-500">
        <span>{points[0].time}</span>
        <span>
          Low {fmt.price(lo, currency)} · High {fmt.price(hi, currency)} ·{" "}
          <span style={{ color }}>
            {change >= 0 ? "+" : ""}
            {change.toFixed(1)}% over 12 months
          </span>
        </span>
        <span>{points[points.length - 1].time}</span>
      </div>
    </div>
  );
}
