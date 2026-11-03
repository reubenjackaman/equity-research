import { ReactNode, useEffect, useState } from "react";
import { Health, healthApi } from "../api";

/** Four published scoring models, each with its formula and the inputs behind every number. */
export default function HealthTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    healthApi
      .get(ticker)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (error) return <p className="card mt-6 text-sm text-muted">Health scores unavailable: {error}</p>;
  if (!data) return <div className="mt-6 h-96 animate-pulse rounded bg-subtle" />;

  return (
    <div className="mt-6 space-y-2">
      <p className="prose-width text-sm text-muted">
        Four published models applied to {data.year} against {data.priorYear}, calculated here from the annual reports. Source:{" "}
        {data.source}. Money amounts are in {data.currency} millions. Each score reports what the model says; none is a recommendation.
      </p>
      {data.financial && (
        <p className="rounded border border-warn bg-warn-soft px-3 py-2 text-xs text-warn">
          This looks like a bank or insurer. These models were built for industrial companies, so several inputs are missing or mean
          something different here. Treat the results with caution.
        </p>
      )}
      <Piotroski data={data} />
      <Altman data={data} />
      <Beneish data={data} />
      <Accruals data={data} />
    </div>
  );
}

function Section({ title, result, plain, children }: { title: string; result: ReactNode; plain: string; children: ReactNode }) {
  return (
    <section className="card">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 className="text-lg">{title}</h2>
        <div className="text-right">{result}</div>
      </div>
      <p className="prose-width mt-1 text-sm text-muted">{plain}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Caution({ text }: { text: string | null }) {
  return text ? <p className="mt-3 text-xs text-warn">{text}</p> : null;
}

function Piotroski({ data }: { data: Health }) {
  const p = data.piotroski;
  const groups = ["Profitability", "Funding", "Efficiency"];
  return (
    <Section
      title="Piotroski F-Score"
      plain="Nine yes-or-no tests of profitability, funding and efficiency. Higher means the fundamentals improved over the year; 8 or 9 is considered strong, 0 to 2 weak."
      result={
        <span className="font-serif text-2xl font-semibold">
          {p.score}
          <span className="text-base text-muted"> / {p.available}</span>
          {p.available < 9 && <span className="block text-xs font-normal text-muted">{9 - p.available} of 9 tests couldn't be run</span>}
        </span>
      }
    >
      <div className="grid gap-x-8 gap-y-4 md:grid-cols-3">
        {groups.map((g) => (
          <div key={g}>
            <h3 className="font-sans text-sm font-semibold tracking-normal">{g}</h3>
            <ul className="mt-1 divide-y divide-line text-sm">
              {p.tests
                .filter((t) => t.group === g)
                .map((t) => (
                  <li key={t.key} className="py-2">
                    <div className="flex items-baseline gap-2">
                      <span
                        className={`w-10 shrink-0 text-xs font-semibold ${t.pass === null ? "text-muted" : t.pass ? "text-gain" : "text-loss"}`}
                      >
                        {t.pass === null ? "N/A" : t.pass ? "Pass" : "Fail"}
                      </span>
                      <span>{t.label}</span>
                    </div>
                    <div className="ml-12 text-xs text-muted">{t.detail}</div>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </div>
      <Caution text={p.caution} />
      <p className="mt-3 text-xs text-muted">Source: Piotroski (2000). ROA and asset turnover use start-of-year total assets.</p>
    </Section>
  );
}

function Components({
  rows,
}: {
  rows: { key: string; label?: string; formula: string; factor: number; value: number | null; calc: string | null }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-muted">
            <th className="py-2 pr-3 font-medium">Input</th>
            <th className="py-2 pr-3 font-medium">Calculation</th>
            <th className="py-2 pr-3 text-right font-medium">Value</th>
            <th className="py-2 text-right font-medium">Weight</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r) => (
            <tr key={r.key}>
              <td className="py-2 pr-3 align-top">
                <span className="font-medium">{r.key}</span> <span className="text-muted">{r.label ?? ""}</span>
                <div className="text-xs text-muted">{r.formula}</div>
              </td>
              <td className="py-2 pr-3 align-top text-xs text-muted">{r.calc ?? "Not reported"}</td>
              <td className="py-2 pr-3 text-right align-top font-medium">{r.value === null ? "N/A" : r.value.toFixed(3)}</td>
              <td className="py-2 text-right align-top text-muted">
                {r.factor > 0 ? "+" : "−"}
                {Math.abs(r.factor).toFixed(3)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const ZONE_TEXT = { safe: "Safe zone (above 2.99)", grey: "Grey zone (1.81 to 2.99)", distress: "Distress zone (below 1.81)" };

function Altman({ data }: { data: Health }) {
  const a = data.altman;
  return (
    <Section
      title="Altman Z-Score"
      plain="Combines five balance-sheet and earnings ratios into one number that has historically signalled bankruptcy risk. Low scores mean more risk; very high scores are common for richly valued companies because market value is one of the inputs."
      result={
        a.value === null ? (
          <span className="text-sm text-muted">N/A</span>
        ) : (
          <span>
            <span className="font-serif text-2xl font-semibold">{a.value.toFixed(2)}</span>
            <span className={`block text-xs font-medium ${a.zone === "safe" ? "text-gain" : a.zone === "distress" ? "text-loss" : "text-warn"}`}>
              {a.zone && ZONE_TEXT[a.zone]}
            </span>
          </span>
        )
      }
    >
      {a.reason && <p className="mb-3 text-sm text-muted">{a.reason}</p>}
      <Components rows={a.components.map((c) => ({ ...c, factor: c.weight }))} />
      <Caution text={a.caution} />
      <p className="mt-3 text-xs text-muted">
        Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5. Original 1968 model for public manufacturers; market value of equity at the
        fiscal year-end share price.
      </p>
    </Section>
  );
}

function Beneish({ data }: { data: Health }) {
  const b = data.beneish;
  return (
    <Section
      title="Beneish M-Score"
      plain="Looks for accounting patterns that were common among companies later caught manipulating earnings. A score above −1.78 is a flag to look closer, not proof of anything."
      result={
        b.value === null ? (
          <span className="text-sm text-muted">N/A</span>
        ) : (
          <span>
            <span className="font-serif text-2xl font-semibold">{b.value.toFixed(2)}</span>
            <span className={`block text-xs font-medium ${b.flag ? "text-loss" : "text-gain"}`}>
              {b.flag ? "Above −1.78: worth a closer look" : "Below −1.78: no flag"}
            </span>
          </span>
        )
      }
    >
      {b.reason && <p className="mb-3 text-sm text-muted">{b.reason}</p>}
      <Components rows={b.components.map((c) => ({ ...c, factor: c.coef }))} />
      <Caution text={b.caution} />
      <p className="mt-3 text-xs text-muted">
        M = −4.84 + the weighted inputs above. 8-variable model (Beneish 1999). Depreciation uses reported D&A, which also includes
        amortization, so DEPI is an approximation.
      </p>
    </Section>
  );
}

function Accruals({ data }: { data: Health }) {
  const a = data.accruals;
  return (
    <Section
      title="Accruals ratio"
      plain="How much of the year's profit wasn't backed by operating cash. Values near zero or negative mean earnings are mostly cash; large positive values mean more of the profit is accounting estimates."
      result={<span className="font-serif text-2xl font-semibold">{a.value === null ? "N/A" : `${(a.value * 100).toFixed(1)}%`}</span>}
    >
      <p className="text-sm text-muted">
        (Net income − Operating cash flow) ÷ Average total assets{a.calc ? ` = ${a.calc}` : ". Inputs not reported."}
      </p>
    </Section>
  );
}
