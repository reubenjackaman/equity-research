import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { DcfAssumptions, Overview, pitchApi } from "../api";
import { EMPTY_PITCH, Pitch, PitchSection, Rating, SECTIONS, loadPitch, savePitch, shareLink } from "../pitch";
import { keys, load } from "../storage";
import { track } from "../usage";
import { useValuationData } from "../valuation";
import { Answer } from "./AskFinch";
import { FinchLogo } from "./Finch";
import InsightsPanel from "./Insights";
import { keyNumbers } from "./KeyNumbers";
import { Panel, PanelState, Segmented } from "./Terminal";

const HORIZONS = ["6 months", "12 months", "2 years", "3+ years"];

/** PITCH: build a stock pitch, let Finch draft sections and challenge it, then export or share it. */
export default function PitchTab({ data }: { data: Overview }) {
  const symbol = data.symbol;
  const [pitch, setPitch] = useState<Pitch>(() => loadPitch(symbol));
  const [drafts, setDrafts] = useState<Partial<Record<PitchSection, string>>>({});
  const [busy, setBusy] = useState<string | null>(null); // which section is drafting, or "critique"
  const [error, setError] = useState<string | null>(null);
  const [critique, setCritique] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const valuation = useValuationData(symbol);

  useEffect(() => {
    setPitch(loadPitch(symbol));
    setDrafts({});
    setCritique(null);
  }, [symbol]);

  function update(patch: Partial<Pitch>) {
    // Counted once per company per pitch: the first edit of an empty pitch.
    if (!pitch.updated) track("pitch_started", symbol);
    setPitch((p) => {
      const next = { ...p, ...patch, updated: new Date().toISOString() };
      savePitch(symbol, next);
      return next;
    });
  }

  const context = () => ({
    symbol,
    pitch,
    assumptions: load<Partial<DcfAssumptions>>(keys.dcf(symbol), {}),
    peers: load<string[] | null>(keys.peers(symbol), null) ?? [],
  });

  async function draft(section: PitchSection) {
    setBusy(section);
    setError(null);
    try {
      const { text } = await pitchApi.draft({ ...context(), section });
      setDrafts((d) => ({ ...d, [section]: text }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function challenge() {
    setBusy("critique");
    setError(null);
    try {
      setCritique((await pitchApi.critique(context())).text);
      setTimeout(() => document.getElementById("critique")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const link = await shareLink(symbol, pitch);
    track("pitch_shared", symbol);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("Copy this link:", link);
    }
  }

  function clear() {
    if (!window.confirm(`Clear your ${symbol} pitch? This can't be undone.`)) return;
    savePitch(symbol, EMPTY_PITCH);
    setPitch(EMPTY_PITCH);
    setDrafts({});
    setCritique(null);
  }

  const rows = keyNumbers(data, valuation.dcf, valuation.comps, pitch);
  const written = SECTIONS.filter((s) => pitch[s.key].trim()).length;

  return (
    <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_24rem]">
      <div className="min-w-0 space-y-3">
        <Panel
          title={`Your ${symbol} pitch`}
          code="PITCH"
          actions={<span className="hidden font-mono text-xs text-muted sm:inline">{written}/4 sections · saved in this browser</span>}
        >
          <p className="mb-3 text-sm text-muted">
            Build the pitch you'd give in class, a stock pitch competition or an interview. Write it yourself or have Finch draft a section from
            the data, then press <span className="font-medium text-ink">Challenge my pitch</span> to hear what a judge would push back on.{" "}
            <Link to="/learn#pitch" className="text-accent hover:underline">How to pitch a stock</Link>
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Recommendation">
              <Segmented<Rating | "">
                label="Recommendation"
                options={[{ value: "Buy", label: "BUY" }, { value: "Hold", label: "HOLD" }, { value: "Sell", label: "SELL" }]}
                value={pitch.rating}
                onChange={(r) => update({ rating: r })}
              />
            </Field>
            <Field label={`Target price (${data.currency ?? ""})`}>
              <input
                value={pitch.target}
                onChange={(e) => update({ target: e.target.value.replace(/[^0-9.]/g, "") })}
                inputMode="decimal"
                aria-label="Target price"
                placeholder={data.price ? data.price.toFixed(0) : "e.g. 400"}
                className="w-full rounded-sm border border-line-strong bg-bg px-2 py-1 font-mono text-sm outline-none focus:border-accent"
              />
            </Field>
            <Field label="Time horizon">
              <select
                value={pitch.horizon}
                onChange={(e) => update({ horizon: e.target.value })}
                aria-label="Time horizon"
                className="w-full rounded-sm border border-line-strong bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
              >
                {HORIZONS.map((h) => <option key={h}>{h}</option>)}
              </select>
            </Field>
            <Field label="Your name (for the PDF)">
              <input
                value={pitch.author}
                onChange={(e) => update({ author: e.target.value.slice(0, 80) })}
                placeholder="Optional"
                aria-label="Your name, shown on the PDF"
                className="w-full rounded-sm border border-line-strong bg-bg px-2 py-1 text-sm outline-none focus:border-accent"
              />
            </Field>
          </div>

          <div className="mt-4 space-y-4">
            {SECTIONS.map((s) => (
              <section key={s.key} aria-labelledby={`pitch-${s.key}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 id={`pitch-${s.key}`} className="text-sm font-semibold">
                    {s.title} <span className="font-normal text-muted">· {s.hint}</span>
                  </h3>
                  <button
                    onClick={() => draft(s.key)}
                    disabled={busy !== null}
                    className="flex items-center gap-1 rounded-sm border border-accent px-2 py-0.5 font-mono text-xs text-accent hover:bg-accent hover:text-on-accent disabled:opacity-50"
                  >
                    <FinchLogo className="h-3.5 w-3.5" />
                    {busy === s.key ? "DRAFTING…" : "DRAFT WITH FINCH"}
                  </button>
                </div>
                <textarea
                  value={pitch[s.key]}
                  onChange={(e) => update({ [s.key]: e.target.value.slice(0, 2500) } as Partial<Pitch>)}
                  rows={5}
                  placeholder={s.placeholder}
                  aria-labelledby={`pitch-${s.key}`}
                  className="mt-1.5 w-full resize-y rounded-sm border border-line-strong bg-bg px-3 py-2 text-sm leading-relaxed outline-none focus:border-accent"
                />
                {drafts[s.key] && (
                  <div className="mt-1.5 border border-accent/50 bg-accent-soft p-3">
                    <div className="mb-1.5 text-xs font-semibold text-accent uppercase">Finch's draft: check every number before you use it</div>
                    <Answer text={drafts[s.key]!} />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button
                        onClick={() => {
                          update({ [s.key]: (pitch[s.key].trim() ? `${pitch[s.key].trim()}\n` : "") + drafts[s.key] } as Partial<Pitch>);
                          setDrafts((d) => ({ ...d, [s.key]: undefined }));
                        }}
                        className="rounded-sm bg-accent px-2.5 py-1 text-xs font-semibold text-on-accent hover:bg-accent-hover"
                      >
                        {pitch[s.key].trim() ? "Add to mine" : "Use this"}
                      </button>
                      {pitch[s.key].trim() && (
                        <button
                          onClick={() => {
                            update({ [s.key]: drafts[s.key] } as Partial<Pitch>);
                            setDrafts((d) => ({ ...d, [s.key]: undefined }));
                          }}
                          className="btn py-1 text-xs"
                        >
                          Replace mine
                        </button>
                      )}
                      <button onClick={() => setDrafts((d) => ({ ...d, [s.key]: undefined }))} className="btn py-1 text-xs">
                        Discard
                      </button>
                    </div>
                  </div>
                )}
              </section>
            ))}
          </div>

          {error && <p className="mt-3 text-sm text-loss">{error}</p>}
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <button
              onClick={challenge}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-sm bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              <FinchLogo className="h-4 w-4" />
              {busy === "critique" ? "Finch is reviewing…" : "Challenge my pitch"}
            </button>
            <Link to={`/company/${encodeURIComponent(symbol)}/pitch`} className="btn">
              Printable PDF
            </Link>
            <button onClick={share} className="btn">
              {copied ? "Link copied" : "Copy share link"}
            </button>
            <button onClick={clear} className="ml-auto text-xs text-muted hover:text-loss">
              Clear pitch
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">
            The share link holds your whole pitch inside the link itself; nothing is stored on our server. Finch's drafts and reviews count toward
            Ask Finch's daily limit.
          </p>
        </Panel>

        {critique && (
          <div id="critique" className="scroll-mt-32">
            <Panel title="Finch's challenge: how a judge might respond" code="AI">
              <Answer text={critique} />
              <p className="mt-3 text-xs text-muted">AI-generated from the site's data. It can make mistakes; check the figures it quotes.</p>
            </Panel>
          </div>
        )}
      </div>

      <div className="min-w-0 space-y-3">
        <Panel title="Key numbers for your pitch" bodyClass="">
          {valuation.loading ? (
            <div className="p-3"><PanelState rows={6} /></div>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line/60 first:border-t-0">
                    <td className="px-3 py-1.5 font-sans text-muted">{r.label}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{r.value}</td>
                    <td className={`py-1.5 pr-3 pl-1 text-right ${r.tone === "gain" ? "text-gain" : r.tone === "loss" ? "text-loss" : "text-muted"}`}>
                      {r.note}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="border-t border-line px-3 py-1.5 text-xs text-muted">
            Uses your saved DCF assumptions and peers. Change them on the <span className="font-mono text-ink">DCF</span> and{" "}
            <span className="font-mono text-ink">RV</span> tabs.
          </p>
        </Panel>
        <InsightsPanel ticker={symbol} title="What the data says" />
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    // A div, not a <label>: clicking a label would press the first Buy/Hold/Sell button.
    <div>
      <span className="mb-1 block text-xs font-medium text-muted">{label}</span>
      {children}
    </div>
  );
}
