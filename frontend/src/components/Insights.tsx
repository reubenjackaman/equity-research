import { Link } from "react-router-dom";
import { insightsApi } from "../api";
import { useApi } from "../useApi";
import { Trend } from "./Icons";
import { Panel, PanelState } from "./Terminal";

const TONE = {
  good: { dir: "up", cls: "text-gain", label: "Strength" },
  bad: { dir: "down", cls: "text-loss", label: "Concern" },
  neutral: { dir: "flat", cls: "text-muted", label: "Context" },
} as const;

/** "What the numbers say": plain-English findings written by rules from the site's own figures (not AI). */
export default function InsightsPanel({ ticker, title = "What the numbers say" }: { ticker: string; title?: string }) {
  const { data, error } = useApi(() => insightsApi.get(ticker), ticker);
  return (
    <Panel title={title} code="LEARN" bodyClass="">
      {!data ? (
        <div className="p-3">
          <PanelState error={error} rows={5} />
        </div>
      ) : (
        <>
          <ul className="divide-y divide-line/60">
            {data.insights.map((i, n) => (
              <li key={n} className="flex gap-2.5 px-3 py-2 text-sm">
                <span className={`mt-1 shrink-0 ${TONE[i.tone].cls}`} role="img" aria-label={TONE[i.tone].label} title={TONE[i.tone].label}>
                  <Trend dir={TONE[i.tone].dir} />
                </span>
                <div className="min-w-0">
                  <span className="mr-1.5 font-bold">{i.topic.charAt(0) + i.topic.slice(1).toLowerCase()}:</span>
                  {i.text}{" "}
                  <Link to={`/learn#${i.learn}`} className="text-xs font-semibold whitespace-nowrap text-accent underline">
                    What's this?
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
            <span className="text-gain"><Trend dir="up" /></span> strength · <span className="text-loss"><Trend dir="down" /></span> concern ·{" "}
            <Trend dir="flat" /> context. Written by fixed rules
            from the figures on this site, not by AI, and using default DCF assumptions and peers.
          </p>
        </>
      )}
    </Panel>
  );
}
