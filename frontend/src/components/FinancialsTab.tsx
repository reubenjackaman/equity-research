import { useEffect, useRef, useState } from"react";
import { Period, StatementKey, Statements, statementsApi } from"../api";
import { statementCell } from"../format";

const STATEMENT_TABS: { key: StatementKey; label: string }[] = [
  { key: "income", label: "Income statement" },
  { key: "balance", label: "Balance sheet" },
  { key: "cashflow", label: "Cash flow" },
];

export default function FinancialsTab({ ticker, tradingCurrency }: { ticker: string; tradingCurrency: string | null }) {
  const [period, setPeriod] = useState<Period>("annual");
  const [statement, setStatement] = useState<StatementKey>("income");
  const [data, setData] = useState<Statements | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    statementsApi
      .get(ticker, period)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker, period]);

  function downloadCsv() {
    if (!data) return;
    const rows = data.statements[statement];
    const header = ["Line item", ...data.columns.map((c) => `${c.label} (${c.end})`)];
    const body = rows.map((r) => [
      r.label,
      ...r.values.map((v) => (v === null ? "N/A" : String(r.format === "perShare" ? v : v / 1e6))),
    ]);
    const csv = [header, ...body]
      .map((line) => line.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${data.symbol}_${statement}_${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented options={STATEMENT_TABS} value={statement} onChange={setStatement} />
        <Segmented
          options={[
            { key: "annual", label: "Annual" },
            { key: "quarterly", label: "Quarterly" },
          ]}
          value={period}
          onChange={setPeriod}
        />
        <div className="ml-auto flex gap-2">
          <button onClick={downloadCsv} disabled={!data} className="btn">
            CSV
          </button>
          <a href={statementsApi.excelUrl(ticker, period)} download className={`btn ${data ? "" : "pointer-events-none opacity-50"}`}>
            Excel
          </a>
        </div>
      </div>

      <div className="card overflow-hidden p-0 sm:p-0">
        {error && <p className="p-5 text-sm text-muted">Financial statements unavailable: {error}</p>}
        {!error && !data && <div className="m-5 h-96 animate-pulse rounded bg-subtle" />}
        {data && <StatementTable data={data} statement={statement} />}
      </div>

      {data && (
        <p className="text-xs leading-relaxed text-muted">
          {data.currency} millions, except per-share data. Negative numbers in (parentheses). Source: {data.source}. Hover a
          number to see where it came from; <span className="font-semibold">ƒ</span> marks calculated rows.
          {tradingCurrency && tradingCurrency !== data.currency && (
            <span className="mt-1 block font-medium text-warn">
              Note: this company reports in {data.currency} but its shares trade in {tradingCurrency}.
            </span>
          )}
          {period === "quarterly" && <span className="mt-1 block">Quarterly data covers roughly the last 5 quarters (Yahoo Finance limit).</span>}
        </p>
      )}
    </div>
  );
}

function StatementTable({ data, statement }: { data: Statements; statement: StatementKey }) {
  // Years run oldest -> newest, so start scrolled all the way right to show the latest year first.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
  }, [data]);

  return (
    <div ref={scrollRef} className="overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 bg-surface px-4 py-2.5 text-left font-semibold">
              {statement === "balance" ? "As of" : "Period ending"}
            </th>
            {data.columns.map((c) => (
              <th key={c.end} className="whitespace-nowrap px-4 py-2.5 text-right font-semibold">
                <div>{c.label}</div>
                <div className="text-xs font-normal text-muted">{c.end}</div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.statements[statement].map((row) => (
            <tr
              key={row.key}
              className={`border-b border-line last:border-0 hover:bg-subtle   ${
                row.bold ? "font-semibold" : ""
              }`}
            >
              <td
                className={`sticky left-0 z-10 whitespace-nowrap bg-surface px-4 py-2  ${row.indent ? "pl-8 text-muted" : ""}`}
                title={row.formula ? `Calculated: ${row.formula}`: undefined}
              >
                {row.label}
                {row.formula && <span className="ml-1.5 font-semibold text-accent">ƒ</span>}
              </td>
              {row.values.map((v, i) => (
                <td
                  key={i}
                  title={row.sources[i] ?? "Not reported by available sources"}
                  className={`whitespace-nowrap px-4 py-2 text-right ${v === null ? "text-muted" : ""} ${
                    v !== null && v < 0 ? "text-loss" : ""
                  }`}
                >
                  {statementCell(v, row.format)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Segmented<K extends string>({
  options,
  value,
  onChange,
}: {
  options: { key: K; label: string }[];
  value: K;
  onChange: (k: K) => void;
}) {
  return (
    <div className="flex rounded bg-subtle p-0.5">
      {options.map((o) => (
        <button
          key={o.key}
          onClick={() => onChange(o.key)}
          className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
            o.key === value ? "bg-surface" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
