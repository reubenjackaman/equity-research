// Each sector has its own band colour, like the colour group on a property deed card.
// Colour only ever appears in the band; everything a visitor reads stays ink on card.

type Band = { band: string; onBand: string };

const INK = "#16181d";
const WHITE = "#ffffff";

const BANDS: Record<string, Band> = {
  Technology: { band: "#1f55b3", onBand: WHITE },
  "Financial Services": { band: "#1d7a46", onBand: WHITE },
  Healthcare: { band: "#c9352a", onBand: WHITE },
  "Consumer Cyclical": { band: "#e8732a", onBand: INK },
  "Consumer Defensive": { band: "#f2b705", onBand: INK },
  Energy: { band: "#7a4424", onBand: WHITE },
  Industrials: { band: "#6c3d9a", onBand: WHITE },
  Utilities: { band: "#5fb3e6", onBand: INK },
  "Real Estate": { band: "#d64a86", onBand: WHITE },
  "Communication Services": { band: "#13857f", onBand: WHITE },
  "Basic Materials": { band: "#8a9a1e", onBand: INK },
};

/** The band for a company's sector, or plain ink for anything without one. */
export function sectorBand(sector: string | null | undefined): Band {
  return (sector && BANDS[sector]) || { band: INK, onBand: WHITE };
}

/** Inline style that sets a deed card's band colours (read by .deed-band in index.css). */
export function bandStyle(sector: string | null | undefined) {
  const { band, onBand } = sectorBand(sector);
  return { "--band": band, "--on-band": onBand } as React.CSSProperties;
}
