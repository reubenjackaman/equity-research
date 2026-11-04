// STATS: anonymous usage counts (see backend/data/usage.py). No personal data is shown or stored.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Panel, PanelState } from "../components/Terminal";
import { companyPath } from "../functions";
import { useApi } from "../useApi";

type Stats = {
  store: string;
  days: string[];
  totals: Record<string, number>;
  daily: Record<string, number[]>;
  visitors: number[];
  visitorDays: number;
  pageViews: number;
  topCompanies: { symbol: string; views: number }[];
};

const TILES: [string, string, string][] = [
  ["pageViews", "Page views", "All pages, all time"],
  ["view_company", "Company pages opened", "Research on a specific company"],
  ["pitch_started", "Pitches started", "First edit of a pitch, per company and browser"],
  ["pitch_pdf", "Pitch PDFs exported", "Save as PDF / Print pressed"],
  ["pitch_shared", "Pitch links shared", "Share links copied"],
  ["view_shared_pitch", "Shared pitches opened", "Someone opened a share link"],
  ["finch_question", "Ask Finch questions", "Answered by the AI analyst"],
  ["pitch_critique", "Pitches challenged", "Finch reviews of a whole pitch"],
];

export default function StatsPage() {
  const { data, error } = useApi(() => fetch("/api/stats").then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`)))) as Promise<Stats>, "stats");
  useEffect(() => {
    document.title = "STATS · Usage · Value Finch";
  }, []);

  return (
    <div className="mx-auto max-w-screen-2xl px-3 pt-3 pb-16">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="fkey">STATS</span>
        <h1 className="text-lg">Usage</h1>
        <p className="text-sm text-muted">Anonymous counts: no cookies, no IP addresses stored, Do Not Track respected.</p>
      </div>
      {!data ? (
        <PanelState error={error} rows={8} />
      ) : (
        <div className="space-y-3">
          {data.store.startsWith("local") && (
            <p className="border border-warn/40 bg-warn-soft px-3 py-2 text-sm text-warn">
              Counts are being kept on the server's own disk, which Render's free plan wipes on every restart and update, so these numbers
              will reset. Connect the free Upstash database to keep them (see the README).
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {TILES.map(([key, label, note]) => (
              <div key={key} className="border border-line bg-surface p-3">
                <div className="text-xs text-muted">{label}</div>
                <div className="mt-1 font-mono text-2xl font-semibold">
                  {(key === "pageViews" ? data.pageViews : data.totals[key] ?? 0).toLocaleString("en-US")}
                </div>
                <div className="text-xs text-muted">{note}</div>
              </div>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-[1fr_22rem]">
            <Panel title="Daily visitors, last 30 days">
              <Bars days={data.days} values={data.visitors} />
              <p className="mt-2 text-xs text-muted">
                Estimated unique visitors each day ({data.visitorDays.toLocaleString("en-US")} {data.visitorDays === 1 ? "visitor-day" : "visitor-days"} in total). A visitor can't be
                recognized from one day to the next, so these can't be added up into a count of different people.
              </p>
            </Panel>
            <Panel title="Most-viewed companies" bodyClass="">
              {data.topCompanies.length === 0 ? (
                <p className="p-3 text-sm text-muted">No company views yet.</p>
              ) : (
                <table className="w-full text-xs">
                  <tbody>
                    {data.topCompanies.map((c, i) => (
                      <tr key={c.symbol} className="border-t border-line/60 first:border-t-0">
                        <td className="px-3 py-1.5 text-muted">{i + 1}</td>
                        <td className="px-2 py-1.5 font-semibold">
                          <Link to={companyPath(c.symbol)} className="text-accent hover:underline">{c.symbol}</Link>
                        </td>
                        <td className="py-1.5 pr-3 pl-2 text-right">{c.views.toLocaleString("en-US")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>
          </div>
          <p className="text-xs text-muted">Stored in: {data.store}.</p>
        </div>
      )}
    </div>
  );
}

/** One bar per day; hover a bar for its date and count. */
function Bars({ days, values }: { days: string[]; values: number[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...values);
  const shown = hover ?? values.length - 1;
  return (
    <div>
      <div className="mb-1 font-mono text-xs">
        {new Date(days[shown] + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}:{" "}
        <span className="font-semibold">{values[shown]}</span> {values[shown] === 1 ? "visitor" : "visitors"}
      </div>
      <div className="flex h-40 items-end gap-0.5" role="img" aria-label="Daily visitors over the last 30 days">
        {values.map((v, i) => (
          <div
            key={days[i]}
            className="flex h-full flex-1 items-end"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
          >
            <div
              className={`w-full rounded-t-sm ${hover === i ? "bg-accent-hover" : "bg-accent"}`}
              style={{ height: `${Math.max((v / max) * 100, v ? 2 : 0)}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-muted">
        <span>{days[0]}</span>
        <span>{days[days.length - 1]}</span>
      </div>
    </div>
  );
}
