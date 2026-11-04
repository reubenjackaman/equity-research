import type { Comps, Dcf, Overview } from "../api";
import * as fmt from "../format";
import { Pitch, upside } from "../pitch";

export type KeyRow = { label: string; value: string; note?: string; tone?: "gain" | "loss" };

/** The numbers every pitch should mention: price, target, DCF, comps, analysts and what's priced in. */
export function keyNumbers(o: Overview, dcf: Dcf | null, comps: Comps | null, pitch: Pitch): KeyRow[] {
  const ccy = o.currency;
  const vs = (v: number | null | undefined) => {
    if (v === null || v === undefined || !o.price) return undefined;
    const u = (v / o.price - 1) * 100;
    return `${fmt.signed(u, 0)}% vs price`;
  };
  const rows: KeyRow[] = [{ label: "Price", value: fmt.price(o.price, ccy) }];
  const up = upside(pitch, o.price);
  if (up !== null) {
    rows.push({ label: "Your target", value: fmt.price(parseFloat(pitch.target.replace(/[^0-9.]/g, "")), ccy), note: `${fmt.signed(up, 1)}% upside`, tone: up >= 0 ? "gain" : "loss" });
  }
  const base = dcf?.valuation?.perShareTrading ?? null;
  rows.push({ label: "DCF value (your assumptions)", value: base === null ? "N/A" : fmt.price(base, ccy), note: vs(base) });
  const pe = comps?.implied.find((i) => i.key === "pe");
  const ev = comps?.implied.find((i) => i.key === "ev_ebitda");
  if (pe) rows.push({ label: `Peer median P/E (${pe.medianMultiple ? `${pe.medianMultiple.toFixed(1)}x` : "N/A"})`, value: pe.value === null ? "N/A" : fmt.price(pe.value, ccy), note: vs(pe.value) });
  if (ev) rows.push({ label: `Peer median EV/EBITDA (${ev.medianMultiple ? `${ev.medianMultiple.toFixed(1)}x` : "N/A"})`, value: ev.value === null ? "N/A" : fmt.price(ev.value, ccy), note: vs(ev.value) });
  if (o.targetMean) rows.push({ label: `Analyst average target${o.analystCount ? ` (${o.analystCount})` : ""}`, value: fmt.price(o.targetMean, ccy), note: vs(o.targetMean) });
  const g = dcf?.reverse.growth;
  const past = dcf?.reverse.cagr.y5 ?? dcf?.reverse.cagr.y3;
  if (g !== null && g !== undefined) {
    rows.push({ label: "Growth priced in (reverse DCF)", value: `${(g * 100).toFixed(1)}% a year`, note: past ? `actual ${(past.value * 100).toFixed(1)}% (${past.span})` : undefined });
  }
  const t = comps?.target;
  const peerPe = comps?.stats.median.pe;
  if (t && typeof t.pe === "number") rows.push({ label: "P/E vs peer median", value: `${t.pe.toFixed(1)}x`, note: peerPe ? `peers ${peerPe.toFixed(1)}x` : undefined });
  return rows;
}
