// A stock pitch: the student's rating, target and four written sections, saved in this browser per company.
// Share links carry the whole pitch (plus the DCF assumptions and peers behind it) inside the link itself,
// after the "#", so it is never sent to or stored on the server.
import { DcfAssumptions } from "./api";
import { keys, load, save } from "./storage";

export type Rating = "Buy" | "Hold" | "Sell";
export type Pitch = {
  rating: Rating | "";
  target: string; // kept as typed, e.g. "400"
  horizon: string; // e.g. "12 months"
  author: string;
  thesis: string;
  catalysts: string;
  valuation: string;
  risks: string;
  updated: string | null; // ISO date
};
export type PitchSection = "thesis" | "catalysts" | "valuation" | "risks";

export const EMPTY_PITCH: Pitch = {
  rating: "", target: "", horizon: "12 months", author: "", thesis: "", catalysts: "", valuation: "", risks: "", updated: null,
};

export const SECTIONS: { key: PitchSection; title: string; hint: string; placeholder: string }[] = [
  {
    key: "thesis",
    title: "Thesis",
    hint: "The 2–4 reasons the market has this stock wrong (or right). Each should be backed by a number.",
    placeholder: "- The market underestimates…\n- Margins are expanding because…",
  },
  {
    key: "catalysts",
    title: "Catalysts",
    hint: "Specific events that could move the price toward your target, and roughly when.",
    placeholder: "- Next earnings report (date) could show…\n- Product launch / rate cut / buyback…",
  },
  {
    key: "valuation",
    title: "Valuation",
    hint: "How you got your target price: DCF, peer multiples, history. Show the arithmetic.",
    placeholder: "- At 25x next year's EPS of $X, the stock is worth…\n- The DCF with 8% growth gives…",
  },
  {
    key: "risks",
    title: "Risks",
    hint: "What would make you wrong, what number would tell you, and how you'd watch for it.",
    placeholder: "- If revenue growth falls below X%…\n- Regulation could…",
  },
];

export const loadPitch = (symbol: string): Pitch => ({ ...EMPTY_PITCH, ...load<Partial<Pitch>>(keys.pitch(symbol), {}) });
export const savePitch = (symbol: string, p: Pitch) => save(keys.pitch(symbol), p);

/** Upside from the price to the pitch's target, in percent. */
export function upside(p: Pick<Pitch, "target">, price: number | null) {
  const t = parseFloat(p.target.replace(/[^0-9.]/g, ""));
  return price && t > 0 ? (t / price - 1) * 100 : null;
}

// ---------- Share links ----------

type Shared = { v: 1; symbol: string; pitch: Pitch; assumptions: Partial<DcfAssumptions>; peers: string[] | null };

const toBase64Url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s: string) =>
  Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

async function squeeze(direction: "compress" | "decompress", input: Uint8Array) {
  const Stream = direction === "compress" ? CompressionStream : DecompressionStream;
  const stream = new Blob([input as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new Stream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** A link to the printable pitch page that carries the pitch, compressed, after "#p=". */
export async function shareLink(symbol: string, pitch: Pitch) {
  const payload: Shared = {
    v: 1, symbol, pitch,
    assumptions: load<Partial<DcfAssumptions>>(keys.dcf(symbol), {}),
    peers: load<string[] | null>(keys.peers(symbol), null),
  };
  const json = new TextEncoder().encode(JSON.stringify(payload));
  const packed = typeof CompressionStream === "function" ? "z" + toBase64Url(await squeeze("compress", json)) : "j" + toBase64Url(json);
  return `${location.origin}/company/${encodeURIComponent(symbol)}/pitch#p=${packed}`;
}

/** Reads a shared pitch from the page address, or null if there isn't one (or it's damaged). */
export async function readShared(hash: string): Promise<Shared | null> {
  const m = hash.match(/[#&]p=([zj])([A-Za-z0-9_-]+)/);
  if (!m) return null;
  try {
    const bytes = fromBase64Url(m[2]);
    const json = m[1] === "z" ? await squeeze("decompress", bytes) : bytes;
    const data = JSON.parse(new TextDecoder().decode(json)) as Shared;
    if (data.v !== 1 || typeof data.symbol !== "string" || typeof data.pitch !== "object") return null;
    // Only known text fields, as plain strings: the page renders them as text, never as HTML.
    const pitch = { ...EMPTY_PITCH };
    for (const k of Object.keys(EMPTY_PITCH) as (keyof Pitch)[]) {
      const v = (data.pitch as Record<string, unknown>)[k];
      if (typeof v === "string") (pitch as Record<string, unknown>)[k] = v.slice(0, 5000);
    }
    if (!["Buy", "Hold", "Sell", ""].includes(pitch.rating)) pitch.rating = "";
    return { ...data, pitch };
  } catch {
    return null;
  }
}

/** Saves a shared pitch, and the DCF assumptions and peers behind it, as your own copy. */
export function adoptShared(s: Shared) {
  savePitch(s.symbol, { ...s.pitch, updated: new Date().toISOString() });
  if (s.assumptions && typeof s.assumptions === "object") save(keys.dcf(s.symbol), s.assumptions);
  if (Array.isArray(s.peers)) save(keys.peers(s.symbol), s.peers.filter((p) => typeof p === "string").slice(0, 10));
}
