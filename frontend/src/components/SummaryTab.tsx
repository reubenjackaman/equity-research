import { Link } from "react-router-dom";
import type { Overview } from "../api";
import { buildValuationRows, useValuationData } from "../valuation";
import FootballField from "./FootballField";

/** Brings the analysis together: valuation summary chart and the printable tear sheet. */
export default function SummaryTab({ data }: { data: Overview }) {
  const { dcf, dcfError, comps, loading } = useValuationData(data.symbol);
  const rows = loading ? [] : buildValuationRows(data, dcf, dcfError, comps);

  return (
    <div className="mt-6 space-y-4">
      <div className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold">Valuation summary ("football field")</h2>
            <p className="mt-1 max-w-2xl text-xs text-slate-500 dark:text-slate-400">
              Each bar is the range of share prices one method suggests. Where most bars sit relative to today's price is
              the quick read on whether the stock looks cheap or expensive. It uses your saved DCF assumptions and peer list
              from the DCF and Comps tabs.
            </p>
          </div>
          <Link to={`/company/${encodeURIComponent(data.symbol)}/tearsheet`} target="_blank" className="btn">
            Tear sheet (PDF)
          </Link>
        </div>
        <div className="mt-5">
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
              ))}
              <p className="text-xs text-slate-500">Running the DCF and comps…</p>
            </div>
          ) : (
            <FootballField rows={rows} price={data.price} currency={data.currency} />
          )}
        </div>
      </div>
    </div>
  );
}
