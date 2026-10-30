import { useState } from"react";

/**
 * A tiny trend line. Missing values (null) break the line instead of being drawn as zero.
 * Hovering shows the value for that period.
 */
export default function Sparkline({
  values,
  labels,
  format,
  width = 96,
  height = 32,
}: {
  values: (number | null)[];
  labels: string[];
  format: (v: number) => string;
  width?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) {
    return <span className="text-xs text-muted">–</span>;
  }

  const pad = 4;
  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const x = (i: number) => pad + (i * (width - 2 * pad)) / (values.length - 1);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - 2 * pad);

  // Build separate segments wherever a value is missing.
  const segments: string[] = [];
  let current = "";
  values.forEach((v, i) => {
    if (v === null) {
      if (current) segments.push(current);
      current = "";
    } else {
      current += `${current ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    }
  });
  if (current) segments.push(current);

  const lastIndex = values.map((v, i) => (v === null ? -1 : i)).filter((i) => i >= 0).pop()!;
  const shown = hover ?? lastIndex;

  return (
    <div className="relative inline-block align-middle">
      <svg
        width={width}
        height={height}
        className="block overflow-visible text-accent"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Trend from ${labels[0]} to ${labels[labels.length - 1]}`}
      >
        {segments.map((d, i) => (
          <path key={i} d={d} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
        ))}
        {values[shown] !== null && (
          <circle cx={x(shown)} cy={y(values[shown] as number)} r={3} fill="currentColor" className="stroke-surface" strokeWidth={1.5} />
        )}
        {/* Invisible full-height hit areas, one per period, wider than the line itself. */}
        {values.map((_, i) => (
          <rect
            key={i}
            x={x(i) - (width - 2 * pad) / (values.length - 1) / 2}
            y={0}
            width={(width - 2 * pad) / (values.length - 1)}
            height={height}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1 -translate-x-1/2 whitespace-nowrap rounded bg-ink px-2 py-1 text-xs text-on-accent shadow-sm">
          {labels[hover]}: {values[hover] === null ? "N/A" : format(values[hover] as number)}
        </div>
      )}
    </div>
  );
}
