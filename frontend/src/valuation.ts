// Gathers everything the football field needs, using your saved DCF assumptions and peers.
import { useEffect, useState } from "react";
import { Comps, compsApi, Dcf, DcfAssumptions, dcfApi, Overview } from "./api";
import { keys, load } from "./storage";

export type ValuationRow = {
  label: string;
  detail: string; // shown under the label, e.g. "WACC ±1%, growth ±1%"
  group: "market" | "method";
  low: number | null;
  high: number | null;
  mid: number | null; // base case / median / mean, drawn as a tick
  note?: string; // why there's no bar
};

export function useValuationData(ticker: string) {
  const [dcf, setDcf] = useState<Dcf | null>(null);
  const [dcfError, setDcfError] = useState<string | null>(null);
  const [comps, setComps] = useState<Comps | null>(null);
  const [compsError, setCompsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setDcf(null);
    setComps(null);
    setDcfError(null);
    setCompsError(null);
    const assumptions = load<Partial<DcfAssumptions>>(keys.dcf(ticker), {});
    const peers = load<string[] | null>(keys.peers(ticker), null);
    dcfApi
      .run(ticker, assumptions)
      .then((d) => !cancelled && setDcf(d))
      .catch((e) => !cancelled && setDcfError(e.message));
    compsApi
      .get(ticker, peers)
      .then((c) => !cancelled && setComps(c))
      .catch((e) => !cancelled && setCompsError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const loading = (!dcf && !dcfError) || (!comps && !compsError);
  return { dcf, dcfError, comps, compsError, loading };
}

const x = (v: number) => `${v.toFixed(1)}x`;

export function buildValuationRows(o: Overview, dcf: Dcf | null, dcfError: string | null, comps: Comps | null): ValuationRow[] {
  const rows: ValuationRow[] = [];

  rows.push({
    label: "52-week trading range",
    detail: "Lowest to highest price over the past year",
    group: "market",
    low: o.fiftyTwoWeekLow,
    high: o.fiftyTwoWeekHigh,
    mid: null,
  });

  rows.push({
    label: "Analyst price targets",
    detail: o.analystCount ? `${o.analystCount} analysts, tick = average` : "12-month targets",
    group: "market",
    low: o.targetLow,
    high: o.targetHigh,
    mid: o.targetMean,
    note: o.targetLow === null ? "No analyst coverage on Yahoo" : undefined,
  });

  const grid = dcf?.sensitivity.values.flat().filter((v): v is number => v !== null) ?? [];
  const base = dcf?.valuation?.perShareTrading ?? null;
  const customised = Object.keys(load(keys.dcf(o.symbol), {})).length > 0;
  rows.push({
    label: "DCF",
    detail: `${customised ? "Your assumptions" : "Default assumptions"}, WACC ±1% and terminal growth ±1%`,
    group: "method",
    low: grid.length ? Math.min(...grid) : null,
    high: grid.length ? Math.max(...grid) : null,
    mid: base,
    note: dcfError ? "Not available for this company" : grid.length === 0 ? "WACC must exceed terminal growth" : undefined,
  });

  if (comps) {
    const evEbitda = comps.implied.find((i) => i.key === "ev_ebitda");
    for (const i of comps.implied) {
      // P/B mainly matters for banks and insurers, where EV/EBITDA doesn't apply.
      if (i.key === "pb" && evEbitda?.value !== null) continue;
      const range = i.lowMultiple !== null && i.highMultiple !== null ? `${x(i.lowMultiple)}–${x(i.highMultiple)}` : "N/A";
      rows.push({
        label: `Comps: ${i.label}`,
        detail: `Middle half of peers, ${range}`,
        group: "method",
        low: i.low,
        high: i.high,
        mid: i.value,
        note: i.value === null ? "Not meaningful (the company's figure is negative or missing)" : undefined,
      });
    }
  }

  // A bar needs a positive range; anything else is explained instead of drawn.
  return rows.map((r) =>
    r.note || r.low === null || r.high === null
      ? { ...r, low: null, high: null, note: r.note ?? "Not available" }
      : r.high <= 0
        ? { ...r, low: null, high: null, note: "Not meaningful (negative value)" }
        : { ...r, low: Math.max(r.low, 0) },
  );
}
