// Number formatting helpers. Anything missing (null/undefined/NaN) prints as "N/A".

const NA = "N/A";
const missing = (v: number | null | undefined): v is null | undefined =>
  v === null || v === undefined || Number.isNaN(v);

export function price(v: number | null | undefined, currency?: string | null) {
  if (missing(v)) return NA;
  return v.toLocaleString("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** 1234567890 -> "1.23B" */
export function big(v: number | null | undefined) {
  if (missing(v)) return NA;
  const abs = Math.abs(v);
  const units: [number, string][] = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "K"]];
  for (const [size, suffix] of units) {
    if (abs >= size) return (v / size).toFixed(2) + suffix;
  }
  return v.toFixed(0);
}

export function num(v: number | null | undefined, digits = 2) {
  if (missing(v)) return NA;
  return v.toLocaleString("en-US", { maximumFractionDigits: digits });
}

/** Value already in percent units: 1.5 -> "1.50%" */
export function pct(v: number | null | undefined, digits = 2) {
  if (missing(v)) return NA;
  return v.toFixed(digits) + "%";
}

export function signed(v: number | null | undefined, digits = 2) {
  if (missing(v)) return NA;
  return (v >= 0 ? "+" : "") + v.toFixed(digits);
}

/** Statement cell: money and share counts in millions, per-share as-is; negatives in (parentheses). */
export function statementCell(v: number | null | undefined, format: "money" | "perShare" | "shares") {
  if (missing(v)) return NA;
  const scaled = format === "perShare" ? v : v / 1e6;
  const digits = format === "perShare" ? 2 : 0;
  const text = Math.abs(scaled).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return scaled < 0 ? `(${text})` : text;
}

export function ratio(v: number | null | undefined, format: "pct" | "x" | "days") {
  if (missing(v)) return NA;
  if (format === "pct") return v.toFixed(1) + "%";
  if (format === "days") return v.toFixed(1);
  return v.toFixed(2) + "x";
}
