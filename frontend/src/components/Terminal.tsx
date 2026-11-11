// Small building blocks shared by the terminal screens.
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { BoardQuote } from "../api";
import * as fmt from "../format";
import { bandStyle } from "../sectors";

/** A deed card: a coloured title band over card stock. `code` is accepted for older callers but no longer shown. */
export function Panel({
  title,
  to,
  actions,
  children,
  className = "",
  bodyClass = "p-3",
  sector,
}: {
  title: string;
  code?: string;
  to?: string; // the panel title links to its full screen
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClass?: string;
  sector?: string | null; // colours the band by sector
}) {
  return (
    <section className={`deed min-w-0 pb-2 ${className}`} style={sector ? bandStyle(sector) : undefined}>
      <header className="deed-band">
        <h2 className="min-w-0 truncate text-sm">
          {to ? (
            <Link to={to} className="underline-offset-4 hover:underline">
              {title}
            </Link>
          ) : (
            title
          )}
        </h2>
        {actions && <div className="flex shrink-0 items-center gap-1 font-normal normal-case tracking-normal">{actions}</div>}
      </header>
      <div className={`mx-2 overflow-x-auto ${bodyClass}`}>{children}</div>
    </section>
  );
}

/** A coloured percentage move: green up, red down, with a sign. */
export function Change({ value, bp, className = "" }: { value: number | null | undefined; bp?: number; className?: string }) {
  const v = bp ?? value;
  if (v === null || v === undefined || Number.isNaN(v)) return <span className={`text-muted ${className}`}>N/A</span>;
  const tone = v > 0 ? "text-gain" : v < 0 ? "text-loss" : "text-muted";
  return (
    <span className={`font-mono tabular-nums ${tone} ${className}`}>
      {bp !== undefined ? `${v > 0 ? "+" : ""}${v.toFixed(1)}bp` : `${fmt.signed(v)}%`}
    </span>
  );
}

/** A tiny trend line for table rows, coloured by its overall direction. Purely visual: the numbers sit beside it. */
export function MiniSpark({ values, width = 80, height = 22 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <span className="inline-block" style={{ width, height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * (width - 2) + 1).toFixed(1)},${(height - 2 - ((v - min) / span) * (height - 4)).toFixed(1)}`)
    .join("");
  const up = values[values.length - 1] >= values[0];
  return (
    <svg width={width} height={height} className={`inline-block align-middle ${up ? "text-gain" : "text-loss"}`} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

/** How a board quote's level is written: yields in %, currencies to 4 places, everything else with commas. */
export function level(q: Pick<BoardQuote, "symbol" | "value">) {
  if (q.value === null) return "N/A";
  if (["^IRX", "^FVX", "^TNX", "^TYX"].includes(q.symbol)) return `${q.value.toFixed(3)}%`;
  if (q.symbol.endsWith("=X")) return q.value.toFixed(q.value > 20 ? 2 : 4);
  return q.value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** A loading placeholder or error line inside a panel. */
export function PanelState({ error, rows = 6 }: { error?: string | null; rows?: number }) {
  if (error) return <p className="text-sm text-muted">Unavailable right now: {error}</p>;
  return (
    <div className="space-y-2" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="h-4 animate-pulse rounded-sm bg-subtle" />
      ))}
    </div>
  );
}

/** Small segmented buttons (chart ranges, US/Canada...). */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly T[] | { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  const items = (options as (T | { value: T; label: string })[]).map((o) => (typeof o === "string" ? { value: o, label: o } : o));
  return (
    <div role="group" aria-label={label} className="flex flex-wrap overflow-hidden rounded-md border-[1.5px] border-line-strong bg-surface">
      {items.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={`px-2.5 py-0.5 text-xs font-semibold ${
            o.value === value ? "bg-ink text-surface" : "text-ink hover:bg-subtle"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
