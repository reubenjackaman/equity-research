import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api, Comps, compsApi, Dcf, DcfAssumptions, dcfApi, Overview } from "../api";
import { Answer } from "../components/AskFinch";
import FootballField from "../components/FootballField";
import { keyNumbers } from "../components/KeyNumbers";
import * as fmt from "../format";
import { Pitch, SECTIONS, adoptShared, loadPitch, readShared, upside } from "../pitch";
import { keys, load } from "../storage";
import { track } from "../usage";
import { buildValuationRows } from "../valuation";

type Source = { pitch: Pitch; assumptions: Partial<DcfAssumptions>; peers: string[] | null; shared: Awaited<ReturnType<typeof readShared>> };

/**
 * The pitch as a printable document (Save as PDF from the print dialog). A share link opens this page with the
 * pitch inside the link; the visitor can read it and save a copy to edit.
 */
export default function PitchDoc() {
  const ticker = (useParams().ticker ?? "").toUpperCase();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const [source, setSource] = useState<Source | null>(null);
  const [o, setO] = useState<Overview | null>(null);
  const [dcf, setDcf] = useState<Dcf | null>(null);
  const [dcfError, setDcfError] = useState<string | null>(null);
  const [comps, setComps] = useState<Comps | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readShared(hash).then((shared) => {
      if (shared && shared.symbol.toUpperCase() === ticker) {
        setSource({ pitch: shared.pitch, assumptions: shared.assumptions ?? {}, peers: shared.peers, shared });
      } else {
        setSource({ pitch: loadPitch(ticker), assumptions: load(keys.dcf(ticker), {}), peers: load(keys.peers(ticker), null), shared: null });
      }
    });
  }, [hash, ticker]);

  useEffect(() => {
    if (!source) return;
    api.overview(ticker).then(setO).catch((e) => setError(e.message));
    dcfApi.run(ticker, source.assumptions).then(setDcf).catch((e) => setDcfError(e.message));
    compsApi.get(ticker, source.peers).then(setComps).catch(() => {});
  }, [source, ticker]);

  useEffect(() => {
    if (o) document.title = `${o.symbol} stock pitch`;
  }, [o]);

  if (error) return <p className="p-8 text-sm">Couldn't load {ticker}: {error}</p>;
  const p = source?.pitch;
  const ready = !!(o && p && (dcf || dcfError) && comps !== undefined);
  const empty = p && !SECTIONS.some((s) => p[s.key].trim());

  return (
    <div className="tearsheet force-light min-h-screen bg-subtle py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-[8.5in] flex-wrap items-center justify-between gap-2 px-4 print:hidden">
        {source?.shared ? (
          <span className="text-sm text-muted">
            A pitch shared with you{p?.author ? ` by ${p.author}` : ""}. Figures are live, using the sharer's DCF assumptions and peers.
          </span>
        ) : (
          <Link to={`/company/${encodeURIComponent(ticker)}?tab=Pitch`} className="text-sm text-accent hover:underline">
            ← Back to editing
          </Link>
        )}
        <div className="flex gap-2">
          {source?.shared && (
            <button
              onClick={() => {
                if (Object.values(loadPitch(ticker)).some((v) => typeof v === "string" && v.length > 20) &&
                    !window.confirm(`You already have a ${ticker} pitch. Replace it with this one?`)) return;
                adoptShared(source.shared!);
                track("pitch_copied", ticker);
                navigate(`/company/${encodeURIComponent(ticker)}?tab=Pitch`);
              }}
              className="btn bg-surface"
            >
              Save a copy to edit
            </button>
          )}
          <button
            onClick={() => {
              track("pitch_pdf", ticker);
              window.print();
            }}
            disabled={!ready}
            className="rounded-sm bg-accent px-4 py-2 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
          >
            Save as PDF / Print
          </button>
        </div>
      </div>

      <article className="mx-auto max-w-[8.5in] bg-surface p-[0.5in] text-sm leading-snug text-ink shadow-sm print:max-w-none print:p-0 print:shadow-none">
        {!o || !p ? (
          <p>Loading…</p>
        ) : empty ? (
          <p>
            This pitch is empty. <Link to={`/company/${encodeURIComponent(ticker)}?tab=Pitch`} className="text-accent underline">Write it on the PITCH tab</Link>.
          </p>
        ) : (
          <Document o={o} p={p} dcf={dcf} dcfError={dcfError} comps={comps} />
        )}
      </article>
    </div>
  );
}

function Document({ o, p, dcf, dcfError, comps }: { o: Overview; p: Pitch; dcf: Dcf | null; dcfError: string | null; comps: Comps | null }) {
  const up = upside(p, o.price);
  const target = parseFloat(p.target);
  const rows = keyNumbers(o, dcf, comps, p);
  const date = new Date(p.updated ?? Date.now()).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const ratingColour = p.rating === "Buy" ? "bg-gain" : p.rating === "Sell" ? "bg-loss" : "bg-muted";
  const field = buildValuationRows(o, dcf, dcfError, comps);
  if (target > 0) field.push({ label: "Pitch target", detail: p.horizon, group: "method", low: target, high: target, mid: target });

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b-2 border-ink pb-3">
        <div>
          <div className="text-xs font-semibold tracking-wider text-accent uppercase">Stock pitch</div>
          <h1 className="mt-1 text-2xl">{o.name}</h1>
          <div className="text-xs text-muted">
            {o.symbol} · {o.exchange} · {o.sector ?? "N/A"}
            {p.author && <> · Prepared by {p.author}</>} · {date}
          </div>
        </div>
        {p.rating && <div className={`rounded-sm px-4 py-2 text-lg font-bold text-white ${ratingColour}`}>{p.rating.toUpperCase()}</div>}
      </header>

      <dl className="mt-3 grid grid-cols-4 border border-line text-center">
        {[
          ["Price", fmt.price(o.price, o.currency)],
          ["Target", target > 0 ? fmt.price(target, o.currency) : "N/A"],
          ["Upside", up === null ? "N/A" : `${fmt.signed(up, 1)}%`],
          ["Horizon", p.horizon || "N/A"],
        ].map(([k, v]) => (
          <div key={k} className="border-l border-line py-2 first:border-l-0">
            <dt className="text-xs text-muted">{k}</dt>
            <dd className="font-mono text-base font-semibold">{v}</dd>
          </div>
        ))}
      </dl>

      {SECTIONS.filter((s) => p[s.key].trim()).map((s) => (
        <section key={s.key} className="mt-4 break-inside-avoid">
          <h2 className="border-b border-line pb-1 text-base">{s.title}</h2>
          <div className="mt-1.5">
            <Answer text={p[s.key]} />
          </div>
        </section>
      ))}

      <section className="mt-5 break-inside-avoid">
        <h2 className="border-b border-line pb-1 text-base">Valuation summary</h2>
        <div className="mt-2 grid gap-4 sm:grid-cols-[1fr_1.3fr]">
          <table className="w-full text-xs">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line/60">
                  <td className="py-1 font-sans text-muted">{r.label}</td>
                  <td className="py-1 text-right font-semibold">{r.value}</td>
                  <td className="py-1 pl-2 text-right text-muted">{r.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="football-field">
            <FootballField rows={field} price={o.price} currency={o.currency} compact />
          </div>
        </div>
      </section>

      <footer className="mt-6 border-t border-line pt-2 text-[10px] leading-snug text-muted">
        Prepared with Value Finch, a free research terminal for US and Canadian stocks. Market figures are live as of {new Date().toLocaleDateString("en-US")} from
        SEC EDGAR, Yahoo Finance and Finnhub, and may be delayed. The views above are the author's. For educational purposes only; not investment advice.
      </footer>
    </>
  );
}
