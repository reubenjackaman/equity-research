import { useEffect, useRef, useState } from"react";
import { Dcf, DcfAssumptions, DcfYear, dcfApi } from"../api";
import * as fmt from"../format";
import { keys, useStored } from"../storage";
import InfoTip from"./InfoTip";

type Key = keyof DcfAssumptions;

// Each editable assumption: how to show it and what it means.
const FIELDS: { key: Key; label: string; kind: "pct" | "num"; help: string }[] = [
  { key: "growth_start", label: "Revenue growth, year 1", kind: "pct", help: "Default: revenue CAGR over the last 3 years. Growth fades in a straight line to the final-year rate." },
  { key: "growth_end", label: "Revenue growth, final year", kind: "pct", help: "Where growth lands by the last forecast year. Should be heading toward the terminal growth rate." },
  { key: "margin_target", label: "EBIT margin, final year", kind: "pct", help: "Default: the latest year's operating margin. The margin moves in a straight line from today's level to this." },
  { key: "tax_rate", label: "Tax rate", kind: "pct", help: "Default: average effective tax rate (income tax ÷ pre-tax income) over 3 years." },
  { key: "da_pct", label: "D&A, % of revenue", kind: "pct", help: "Depreciation & amortization. Default: 3-year average." },
  { key: "capex_pct", label: "Capex, % of revenue", kind: "pct", help: "Capital expenditures. Default: 3-year average." },
  { key: "nwc_pct", label: "Working capital, % of revenue", kind: "pct", help: "(Receivables + Inventory − Payables) ÷ Revenue. Negative means suppliers fund the business. Default: latest year." },
  { key: "terminal_growth", label: "Terminal growth", kind: "pct", help: "Growth forever after the forecast. Usually 2-3%, near long-run inflation/GDP. Must be below WACC." },
];

const WACC_FIELDS: { key: Key; label: string; kind: "pct" | "num"; help: string }[] = [
  { key: "risk_free", label: "Risk-free rate", kind: "pct", help: "Default: today's 10-year US Treasury yield." },
  { key: "beta", label: "Beta", kind: "num", help: "Default: Blume-adjusted beta = 0.67 × raw beta + 0.33. Raw betas tend to drift toward 1." },
  { key: "erp", label: "Equity risk premium", kind: "pct", help: "Extra return investors demand for owning stocks over Treasuries. 5% is a common assumption." },
  { key: "cost_of_debt", label: "Pre-tax cost of debt", kind: "pct", help: "Default: interest expense ÷ average debt, or risk-free + 1.5% if interest isn't reported." },
];

export default function DcfTab({ ticker }: { ticker: string }) {
  // Your edits are remembered per company, and the Summary tab / tear sheet use them too.
  const [overrides, setOverrides] = useStored<Partial<DcfAssumptions>>(keys.dcf(ticker), {});
  const [data, setData] = useState<Dcf | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Re-run the model (in Python) shortly after the user stops typing.
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      dcfApi
        .run(ticker, overrides, controller.signal)
        .then((d) => {
          setData(d);
          setError(null);
        })
        .catch((e) => e.name !== "AbortError" && setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [ticker, overrides]);

  async function downloadExcel() {
    const blob = await dcfApi.excel(ticker, overrides);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${ticker}_DCF.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (error && !data) return <p className="card mt-6 text-sm text-muted">DCF unavailable: {error}</p>;
  if (!data) return <div className="mt-6 h-96 animate-pulse rounded bg-subtle" />;

  const set = (key: Key, value: number | null) => setOverrides((o) => ({ ...o, [key]: value }));
  const a = data.assumptions;

  return (
    <div className={`mt-6 grid items-start gap-4 transition-opacity lg:grid-cols-[20rem_minmax(0,1fr)] ${loading ? "opacity-70" : ""}`}>
      <div className="space-y-4">
        <Summary data={data} onExport={downloadExcel} />
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Assumptions</h2>
            <button onClick={() => setOverrides({})} className="text-xs text-accent hover:underline">
              Reset to defaults
            </button>
          </div>
          <label className="flex items-center justify-between gap-3 text-sm">
            <span>Forecast years</span>
            <select
              value={a.years}
              onChange={(e) => set("years", Number(e.target.value))}
              className="rounded border border-line-strong bg-surface px-2 py-1 text-sm"
            >
              {[3, 4, 5, 6, 7, 8, 9, 10].map((y) => (
                <option key={y}>{y}</option>
              ))}
            </select>
          </label>
          {FIELDS.map((f) => (
            <Field key={f.key} field={f} value={a[f.key] as number} fallback={data.defaults[f.key] as number} onChange={(v) => set(f.key, v)} />
          ))}

          <h3 className="border-t border-line pt-3 text-xs font-semibold text-muted">
            Discount rate (WACC)
          </h3>
          {WACC_FIELDS.map((f) => (
            <Field key={f.key} field={f} value={a[f.key] as number} fallback={data.defaults[f.key] as number} onChange={(v) => set(f.key, v)} />
          ))}
          <WaccField data={data} onChange={(v) => set("wacc_override", v)} />
        </div>
      </div>

      <div className="min-w-0 space-y-4">
      <Sensitivity data={data} />
      <ForecastTable data={data} />

      <p className="text-xs leading-relaxed text-muted">
        Unlevered free cash flow = EBIT × (1 − tax) + D&A − Capex − Increase in working capital, discounted at WACC at the end of
        each year. Terminal value uses the Gordon growth formula. Debt, cash and share count are as of {data.balanceAsOf}.{" "}
        {data.currency !== data.tradingCurrency &&
          `Figures are in ${data.currency}; the value per share is converted to ${data.tradingCurrency} at ${data.fx.toFixed(4)} to compare with the share price. `}
        A DCF is only as good as its assumptions. The defaults simply extend recent history.
      </p>
      </div>
    </div>
  );
}

function Summary({ data, onExport }: { data: Dcf; onExport: () => void }) {
  const v = data.valuation;
  const up = v?.upside !== null && (v?.upside ?? 0) >= 0;
  return (
    <div className="card">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">Intrinsic value per share</h2>
        <button onClick={onExport} className="btn">
          Excel
        </button>
      </div>
      {!v ? (
        <p className="mt-3 text-sm text-loss">
          WACC ({fmt.pct(data.wacc.used * 100)}) must be higher than terminal growth ({fmt.pct(data.assumptions.terminal_growth * 100)}),
          otherwise the terminal value is infinite.
        </p>
      ) : (
        <>
          <div className="mt-2 font-serif text-2xl font-semibold">{fmt.price(v.perShareTrading, data.tradingCurrency)}</div>
          <div className="mt-1 text-sm text-muted">
            vs. current price {fmt.price(v.price, data.tradingCurrency)}{" "}
            <span className={`font-semibold ${up ? "text-gain" : "text-loss"}`}>
              {v.upside === null
                ? (v.perShareTrading ?? 0) <= 0
                  ? "(equity value is negative, see notes below)"
                  : "N/A"
                : `${up ? "+" : ""}${(v.upside * 100).toFixed(1)}% ${up ? "upside" : "downside"}`}
            </span>
          </div>
          <dl className="mt-4 divide-y divide-line text-sm">
            <Row label="PV of forecast cash flows" value={fmt.big(v.pvFcf)} />
            <Row label="PV of terminal value" value={fmt.big(v.pvTerminal)} />
            <Row label="Enterprise value" value={fmt.big(v.enterpriseValue)} bold />
            <Row label="− Total debt" value={fmt.big(v.debt)} />
            <Row label="+ Cash & short-term investments" value={fmt.big(v.cash)} />
            <Row label="Equity value" value={fmt.big(v.equityValue)} bold />
            <Row label="÷ Shares" value={fmt.big(v.shares)} />
            <Row label="Terminal value share of EV" value={v.terminalShare === null ? "N/A" : `${(v.terminalShare * 100).toFixed(0)}%`} />
          </dl>
          <p className="mt-2 text-xs text-muted">{data.currency} amounts.</p>
        </>
      )}
      {data.warnings.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.warnings.map((w) => (
            <li key={w} className="rounded border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1.5 ${bold ? "font-semibold" : ""}`}>
      <dt className={bold ? "" : "text-muted"}>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** A number input that shows percentages (5 = 5%) but stores decimals (0.05). */
function Field({
  field,
  value,
  fallback,
  onChange,
}: {
  field: { key: Key; label: string; kind: "pct" | "num"; help: string };
  value: number;
  fallback: number;
  onChange: (v: number) => void;
}) {
  const scale = field.kind === "pct" ? 100 : 1;
  const shown = +(value * scale).toFixed(2);
  const [text, setText] = useState(String(shown));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(String(shown));
  }, [shown]);

  const changed = Math.abs(value - fallback) > 1e-9;
  return (
    <label className="flex items-center justify-between gap-3 text-sm">
      <span className="min-w-0">
        <InfoTip content={<>{field.help}<div className="mt-1 text-muted">Default: {+(fallback * scale).toFixed(2)}{field.kind === "pct" ? "%" : ""}</div></>}>
          {field.label}
        </InfoTip>
      </span>
      <span className="flex shrink-0 items-center gap-1">
        <input
          type="number"
          step={field.kind === "pct" ? 0.1 : 0.05}
          value={text}
          onFocus={() => (editing.current = true)}
          onBlur={() => {
            editing.current = false;
            setText(String(shown));
          }}
          onChange={(e) => {
            setText(e.target.value);
            const n = parseFloat(e.target.value);
            if (!Number.isNaN(n)) onChange(n / scale);
          }}
          className={`w-20 rounded border bg-surface px-2 py-1 text-right text-sm outline-none focus:border-accent  ${
            changed ? "border-accent text-accent" : "border-line-strong"
          }`}
        />
        <span className="w-3 text-xs text-muted">{field.kind === "pct" ? "%" : ""}</span>
      </span>
    </label>
  );
}

function WaccField({ data, onChange }: { data: Dcf; onChange: (v: number | null) => void }) {
  const w = data.wacc;
  const overridden = data.assumptions.wacc_override !== null;
  return (
    <div className="rounded bg-subtle p-3 text-sm">
      <Field
        field={{
          key: "wacc_override",
          label: "WACC",
          kind: "pct",
          help: "Weighted average cost of capital = E/V × Cost of equity + D/V × Cost of debt × (1 − tax). Type a value to override the build-up below.",
        }}
        value={w.used}
        fallback={w.computed}
        onChange={(v) => onChange(v)}
      />
      <div className="mt-2 space-y-0.5 text-xs text-muted">
        <div>
          Cost of equity = {fmt.pct(data.assumptions.risk_free * 100)} + {data.assumptions.beta.toFixed(2)} × {fmt.pct(data.assumptions.erp * 100)} ={" "}
          {fmt.pct(w.costOfEquity * 100)}
        </div>
        <div>After-tax cost of debt = {fmt.pct(w.afterTaxCostOfDebt * 100)}</div>
        <div>
          Weights: equity {(w.equityWeight * 100).toFixed(1)}% / debt {(w.debtWeight * 100).toFixed(1)}%
        </div>
        <div>
          CAPM WACC = <span className="font-medium text-ink">{fmt.pct(w.computed * 100)}</span>
          {overridden && (
            <button onClick={() => onChange(null)} className="ml-2 text-accent hover:underline">
              use this
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Sensitivity({ data }: { data: Dcf }) {
  const s = data.sensitivity;
  const price = data.price;
  // Diverging tint: green above today's price, red below, neutral near it. The numbers stay in normal text colour.
  function tint(v: number | null) {
    if (v === null || !price) return"";
    const diff = v / price - 1;
    const strength = Math.min(Math.abs(diff) / 0.5, 1);
    if (Math.abs(diff) < 0.05) return"bg-subtle";
    const level = strength > 0.66 ? 3 : strength > 0.33 ? 2 : 1;
    const up = ["", "bg-gain-soft", "bg-gain-soft", "bg-gain-soft"];
    const down = ["", "bg-loss-soft", "bg-loss-soft", "bg-loss-soft"];
    return diff > 0 ? up[level] : down[level];
  }
  return (
    <div className="card overflow-hidden">
      <h2 className="text-sm font-semibold">Sensitivity: value per share ({data.tradingCurrency})</h2>
      <p className="mt-1 text-xs text-muted">
        Rows: WACC. Columns: terminal growth. Green is above today's price ({fmt.price(price, data.tradingCurrency)}), red is
        below. The outlined cell is your base case.
      </p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full border-separate border-spacing-0.5 text-center text-sm">
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-xs font-medium text-muted">WACC \ g</th>
              {s.growths.map((g) => (
                <th key={g} className="px-2 py-1.5 text-xs font-semibold">
                  {(g * 100).toFixed(1)}%
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {s.waccs.map((w, i) => (
              <tr key={w}>
                <th className="px-2 py-1.5 text-left text-xs font-semibold">{(w * 100).toFixed(1)}%</th>
                {s.values[i].map((v, j) => (
                  <td
                    key={j}
                    className={`rounded px-2 py-1.5 tabular-nums ${tint(v)} ${i === 2 && j === 2 ? "font-semibold ring-2 ring-accent" : ""}`}
                  >
                    {v === null ? "N/A" : v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}
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

function ForecastTable({ data }: { data: Dcf }) {
  const cols: (DcfYear & { actual: boolean })[] = [
    ...data.history.map((h) => ({ ...h, actual: true })),
    ...data.forecast.map((f) => ({ ...f, actual: false })),
  ];
  const m = (v: number | null | undefined) => fmt.statementCell(v ?? null, "money");
  const p = (v: number | null | undefined) => (v === null || v === undefined ? "N/A" : `${(v * 100).toFixed(1)}%`);
  const rows: { label: string; get: (c: DcfYear) => string; bold?: boolean; forecastOnly?: boolean }[] = [
    { label: "Revenue", get: (c) => m(c.revenue), bold: true },
    { label: "Growth", get: (c) => p(c.growth) },
    { label: "EBIT margin", get: (c) => p(c.margin) },
    { label: "EBIT", get: (c) => m(c.ebit) },
    { label: "− Taxes", get: (c) => m(c.taxes), forecastOnly: true },
    { label: "NOPAT", get: (c) => m(c.nopat), forecastOnly: true },
    { label: "+ D&A", get: (c) => m(c.da) },
    { label: "− Capex", get: (c) => m(c.capex) },
    { label: "− Increase in working capital", get: (c) => m(c.dNwc) },
    { label: "Unlevered free cash flow", get: (c) => m(c.fcf), bold: true, forecastOnly: true },
    { label: "Discount factor", get: (c) => (c.discount === undefined ? "" : c.discount.toFixed(3)), forecastOnly: true },
    { label: "Present value", get: (c) => m(c.pv), forecastOnly: true },
  ];
  return (
    <div className="card overflow-hidden p-0 sm:p-0">
      <h2 className="px-4 pt-4 text-sm font-semibold">Forecast ({data.currency} millions)</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-xs">
              <th className="sticky left-0 z-10 bg-surface px-4 py-2 text-left" />
              {cols.map((c) => (
                <th key={c.label} className={`whitespace-nowrap px-3 py-2 text-right font-semibold ${c.actual ? "text-muted" : ""}`}>
                  {c.label}
                  {c.actual && <div className="font-normal">actual</div>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className={`border-b border-line last:border-0  ${r.bold ? "font-semibold" : ""}`}>
                <td className="sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-1.5">{r.label}</td>
                {cols.map((c) => (
                  <td key={c.label} className={`whitespace-nowrap px-3 py-1.5 text-right ${c.actual ? "text-muted" : ""}`}>
                    {r.forecastOnly && c.actual ? "" : r.get(c)}
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
