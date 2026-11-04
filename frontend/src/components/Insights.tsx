import { Link } from "react-router-dom";
import { insightsApi } from "../api";
import { useApi } from "../useApi";
import { Panel, PanelState } from "./Terminal";

const TONE = {
  good: { mark: "▲", cls: "text-gain", label: "Strength" },
  bad: { mark: "▼", cls: "text-loss", label: "Concern" },
  neutral: { mark: "●", cls: "text-muted", label: "Context" },
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
                <span className={`mt-0.5 shrink-0 text-xs ${TONE[i.tone].cls}`} aria-label={TONE[i.tone].label} title={TONE[i.tone].label}>
                  {TONE[i.tone].mark}
                </span>
                <div className="min-w-0">
                  <span className="mr-1.5 text-xs font-semibold text-muted uppercase">{i.topic}</span>
                  {i.text}{" "}
                  <Link to={`/learn#${i.learn}`} className="text-xs whitespace-nowrap text-accent hover:underline">
                    What's this?
                  </Link>
                </div>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
            <span className="text-gain">▲</span> strength · <span className="text-loss">▼</span> concern · ● context. Written by fixed rules
            from the figures on this site, not by AI, and using default DCF assumptions and peers.
          </p>
        </>
      )}
    </Panel>
  );
}
