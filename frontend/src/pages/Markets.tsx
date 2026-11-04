// The terminal's market screens: the dashboard (MKTS) and WEI, MOST, GC, ECO, EVTS, MON, EQS and HELP.
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketsApi } from "../api";
import AskFinch from "../components/AskFinch";
import Explore from "../components/Explore";
import CommandBar, { OPEN_ASK } from "../components/CommandBar";
import { FinchLogo } from "../components/Finch";
import {
  BoardPanel, CurveChart, EarningsPanel, EconomyPanel, MoverTable, MoversPanel, RatesPanel, WatchPanel, useQuotes,
} from "../components/MarketPanels";
import { Change, Panel, PanelState } from "../components/Terminal";
import * as fmt from "../format";
import { COMPANY_FUNCTIONS, MARKET_FUNCTIONS, companyPath } from "../functions";
import { useSaved, useStored, keys } from "../storage";
import { useApi } from "../useApi";

function Screen({ title, code, intro, screen, children }: { title: string; code: string; intro?: ReactNode; screen: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${code} · ${title} · Value Finch`;
  }, [code, title]);
  return (
    <div className="mx-auto max-w-screen-2xl px-3 pt-3 pb-24">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="fkey">{code}</span>
        <h1 className="text-lg">{title}</h1>
        {intro && <p className="text-sm text-muted">{intro}</p>}
      </div>
      {children}
      <AskFinch tab={screen} />
    </div>
  );
}

const STEPS: { n: string; title: string; text: string; links: [string, string][] }[] = [
  {
    n: "1",
    title: "Research a company",
    text: "Type any US or TSX ticker for its statements, ratios, health scores and a plain-English read of what the numbers say.",
    links: [["AAPL", companyPath("AAPL")], ["SHOP.TO", companyPath("SHOP.TO")], ["NVDA GP", companyPath("NVDA", "Chart")]],
  },
  {
    n: "2",
    title: "Value it",
    text: "Build a DCF with your own assumptions, compare it with peers, and see what growth today's price implies.",
    links: [["RY.TO DCF", companyPath("RY.TO", "DCF")], ["MSFT RV", companyPath("MSFT", "Comps")], ["AAPL SUM", companyPath("AAPL", "Summary")]],
  },
  {
    n: "3",
    title: "Build your pitch",
    text: "Write a stock pitch for class, a competition or an interview. Finch drafts sections, challenges your thesis like a judge, and you export a PDF or share a link.",
    links: [["AAPL PITCH", companyPath("AAPL", "Pitch")], ["LEARN", "/learn"]],
  },
  {
    n: "4",
    title: "Follow the markets",
    text: "World indices, movers, US and Canadian yield curves, the economy, the earnings calendar and a screener for ideas.",
    links: [["WEI", "/wei"], ["GC", "/rates"], ["EVTS", "/earnings"], ["EQS", "/screener"]],
  },
];

/** MKTS: the home page. What the site is, where to start, then today's markets. */
export function MarketsHome() {
  useEffect(() => {
    document.title = "Value Finch · Free equity research terminal";
  }, []);

  return (
    <div className="pb-24">
      <section className="border-b border-line bg-surface">
        <div className="mx-auto grid max-w-screen-2xl gap-6 px-3 py-8 sm:py-10 lg:grid-cols-[1fr_minmax(0,34rem)] lg:items-center lg:gap-12">
          <div>
            <p className="font-mono text-xs font-semibold tracking-wider text-accent">VALUE FINCH · FREE RESEARCH TERMINAL</p>
            <h1 className="mt-3 text-2xl sm:text-3xl">Equity research for US and Canadian markets.</h1>
            <p className="prose-width mt-3 text-muted">
              Research about 2,750 US and TSX companies, value them, and turn your work into a stock pitch that an AI analyst challenges
              before a judge does. Built for students preparing pitches. Free, no account, and every figure shows how it was calculated.
            </p>
          </div>
          <div>
            <CommandBar large />
            <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span>Try</span>
              {[["AAPL", companyPath("AAPL")], ["SHOP.TO", companyPath("SHOP.TO")], ["RY.TO", companyPath("RY.TO")], ["TSLA", companyPath("TSLA")]].map(([t, to]) => (
                <Link key={t} to={to} className="tap font-mono text-ink underline decoration-line-strong hover:text-accent">
                  {t}
                </Link>
              ))}
            </p>
            <p className="mt-1 text-xs text-muted">
              Add a function code for a specific screen, like <span className="font-mono text-ink">AAPL GP</span> for the chart.{" "}
              <Link to="/help" className="text-accent hover:underline">See all codes</Link>
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="start" className="mx-auto max-w-screen-2xl px-3 pt-6">
        <h2 id="start" className="text-xs font-semibold tracking-wider text-muted uppercase">Where to start</h2>
        <ol className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s) => (
            <li key={s.n} className="flex flex-col border border-line bg-surface p-4">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-sm font-semibold text-accent">{s.n}</span>
                <h3 className="text-base">{s.title}</h3>
              </div>
              <p className="mt-1.5 flex-1 text-sm text-muted">{s.text}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {s.links.map(([label, to]) => (
                  <Link key={label} to={to} className="tap rounded-sm border border-line px-2 py-0.5 font-mono text-xs text-accent transition-colors hover:border-accent">
                    {label}
                  </Link>
                ))}
              </div>
            </li>
          ))}
          <li className="flex flex-col border border-accent/60 bg-accent-soft p-4">
            <div className="flex items-center gap-2">
              <FinchLogo className="h-5 w-5 text-accent" />
              <h3 className="text-base">Ask Finch, the AI analyst</h3>
            </div>
            <p className="mt-1.5 flex-1 text-sm text-muted">
              Ask anything, like "is Royal Bank overvalued?" or "what is the yield curve saying?". It reads the data on your screen.
            </p>
            <button
              onClick={() => window.dispatchEvent(new Event(OPEN_ASK))}
              className="mt-3 self-start rounded-sm bg-accent px-3 py-1 font-mono text-xs font-semibold text-on-accent hover:bg-accent-hover"
            >
              ASK FINCH
            </button>
          </li>
        </ol>
        <p className="mt-3 text-sm text-muted">
          New here? Read <Link to="/how-it-works" className="text-accent hover:underline">how it works</Link>, or try today's{" "}
          <Link to="/game" className="text-accent hover:underline">Mystery Company puzzle</Link>: guess the company from its financials.
        </p>
      </section>

      <section aria-labelledby="today" className="mx-auto max-w-screen-2xl px-3 pt-8">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="fkey">MKTS</span>
          <h2 id="today" className="text-lg">Today's markets</h2>
          <p className="text-sm text-muted">Delayed and end-of-day data, refreshed every few minutes. Click any panel title for its full screen.</p>
        </div>
        <div className="grid gap-3 lg:grid-cols-12">
          <div className="space-y-3 lg:col-span-4">
            <BoardPanel title="Equity indices" groups={["Americas", "Europe", "Asia-Pacific"]} />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <MoversPanel rows={8} />
            <BoardPanel title="Currencies, commodities, crypto" code="WEI" groups={["Currencies", "Commodities", "Crypto"]} />
          </div>
          <div className="space-y-3 lg:col-span-4">
            <RatesPanel />
            <EarningsPanel limit={10} />
            <WatchPanel />
          </div>
          <div className="lg:col-span-12">
            <EconomyPanel wide />
          </div>
        </div>
      </section>
      <AskFinch tab="Markets" />
    </div>
  );
}

/** WEI: every market on the board. */
export function WorldScreen() {
  return (
    <Screen title="World markets" code="WEI" screen="World" intro="Daily closes from Yahoo Finance, refreshed every 5 minutes. Yields move in basis points.">
      <div className="grid gap-3 lg:grid-cols-2">
        <BoardPanel title="Americas" groups={["Americas"]} wide />
        <BoardPanel title="Europe and Asia-Pacific" groups={["Europe", "Asia-Pacific"]} wide />
        <BoardPanel title="Currencies" groups={["Currencies"]} wide />
        <BoardPanel title="Commodities and crypto" groups={["Commodities", "Crypto"]} wide />
        <BoardPanel title="US Treasury yields" groups={["Yields"]} wide />
      </div>
    </Screen>
  );
}

/** MOST: gainers, losers and most traded, US and TSX side by side. */
export function MoversScreen() {
  const { data, error } = useApi(marketsApi.movers, "movers", 10 * 60 * 1000);
  const lists = [
    ["gainers", "Gainers"],
    ["losers", "Losers"],
    ["active", "Most traded"],
  ] as const;
  return (
    <Screen title="Movers" code="MOST" screen="Movers" intro="Among the 60 largest US and 60 largest TSX companies, by the last daily close.">
      {!data ? (
        <PanelState error={error} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {(["us", "ca"] as const).map((c) =>
            lists.map(([view, label]) => (
              <Panel key={`${c}-${view}`} title={`${c === "us" ? "US" : "TSX"} ${label.toLowerCase()}`} bodyClass="">
                <MoverTable set={data[c]} view={view} rows={10} />
              </Panel>
            )),
          )}
        </div>
      )}
    </Screen>
  );
}

/** GC: yield curves, the 10Y-2Y spread and policy rates. */
export function RatesScreen() {
  const { data, error } = useApi(marketsApi.rates, "rates");
  return (
    <Screen title="Rates" code="GC" screen="Rates" intro="Government bond yields from FRED (US Treasury) and the Bank of Canada.">
      {!data ? (
        <PanelState error={error} />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          <Panel title={`US Treasury curve, ${data.us.date}`} code="GC">
            <CurveChart points={data.us.points} />
            <CurveTable points={data.us.points} />
          </Panel>
          <Panel title={`Government of Canada curve, ${data.ca.date}`} code="GC">
            <CurveChart points={data.ca.points} />
            <CurveTable points={data.ca.points} />
          </Panel>
          <Panel title="US 10-year minus 2-year spread, last 2 years">
            <SpreadChart points={data.spread.points} />
            <p className="mt-2 text-xs text-muted">
              Below zero means the curve is inverted (short-term yields above long-term ones), which has often come before US recessions.
            </p>
          </Panel>
          <Panel title="Policy rates">
            <dl className="divide-y divide-line text-sm">
              {data.policy.map((p) => (
                <div key={p.label} className="flex justify-between py-2">
                  <dt className="text-muted">{p.label}</dt>
                  <dd className="font-mono font-semibold">
                    {p.value === null ? "N/A" : `${p.value.toFixed(2)}%`} <span className="text-xs font-normal text-muted">{p.date}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>
      )}
    </Screen>
  );
}

function CurveTable({ points }: { points: { tenor: string; now: number; monthAgo: number | null; yearAgo: number | null }[] }) {
  const bp = (a: number, b: number | null) => (b === null ? null : (a - b) * 100);
  return (
    <table className="mt-3 w-full text-xs">
      <thead>
        <tr className="text-muted">
          <th className="py-1 text-left font-medium">Maturity</th>
          <th className="py-1 text-right font-medium">Yield</th>
          <th className="py-1 text-right font-medium">vs 1M</th>
          <th className="py-1 text-right font-medium">vs 1Y</th>
        </tr>
      </thead>
      <tbody>
        {points.map((p) => (
          <tr key={p.tenor} className="border-t border-line/60">
            <td className="py-1">{p.tenor}</td>
            <td className="py-1 text-right">{p.now.toFixed(2)}%</td>
            <td className="py-1 text-right"><Change value={null} bp={bp(p.now, p.monthAgo) ?? undefined} /></td>
            <td className="py-1 text-right"><Change value={null} bp={bp(p.now, p.yearAgo) ?? undefined} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** A plain line of the spread over time, with a zero line. Hover shows the date and value. */
function SpreadChart({ points }: { points: { time: string; value: number }[] }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return <p className="text-sm text-muted">N/A</p>;
  const width = 520;
  const height = 180;
  const pad = { l: 34, r: 8, t: 8, b: 20 };
  const vals = points.map((p) => p.value);
  const min = Math.min(0, ...vals);
  const max = Math.max(0, ...vals);
  const x = (i: number) => pad.l + (i * (width - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + ((max - v) / (max - min || 1)) * (height - pad.t - pad.b);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const years = points.map((p, i) => [p.time.slice(0, 4), i] as const).filter(([yr], i, a) => i === 0 || yr !== a[i - 1][0]);
  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        role="img"
        aria-label="US 10-year minus 2-year Treasury spread over the last two years"
        onMouseMove={(e) => {
          const box = e.currentTarget.getBoundingClientRect();
          const px = ((e.clientX - box.left) / box.width) * width;
          setHover(Math.max(0, Math.min(points.length - 1, Math.round(((px - pad.l) / (width - pad.l - pad.r)) * (points.length - 1)))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {[max, (max + min) / 2, min].map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
            <text x={pad.l - 6} y={y(v) + 3} textAnchor="end" fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">{v.toFixed(2)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={width - pad.r} y1={y(0)} y2={y(0)} stroke="var(--line-strong)" strokeDasharray="3 3" />
        {years.slice(1).map(([yr, i]) => (
          <text key={yr} x={x(i)} y={height - 5} textAnchor="middle" fontSize={10} fill="var(--muted)" fontFamily="var(--font-mono)">{yr}</text>
        ))}
        <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <>
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={height - pad.b} stroke="var(--line-strong)" />
            <circle cx={x(hover)} cy={y(points[hover].value)} r={4} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          </>
        )}
      </svg>
      {hover !== null && (
        <div className="pointer-events-none absolute top-1 right-2 rounded-sm border border-line-strong bg-surface px-2 py-1 font-mono text-xs">
          {points[hover].time}: {points[hover].value.toFixed(2)} pts
        </div>
      )}
    </div>
  );
}

/** ECO: economic indicators. */
export function EconomyScreen() {
  return (
    <Screen title="Economy" code="ECO" screen="Economy" intro="Latest releases and two years of history for the US and Canada.">
      <EconomyPanel wide />
    </Screen>
  );
}

/** EVTS: the earnings calendar. */
export function EarningsScreen() {
  return (
    <Screen title="Earnings calendar" code="EVTS" screen="Earnings" intro="Reports scheduled by large US and TSX companies. Click a ticker for its estimates and past surprises.">
      <EarningsPanel full />
    </Screen>
  );
}

/** MON: the watchlist monitor, saved in this browser. */
export function MonitorScreen() {
  const { saved, remove } = useSaved();
  const [, setSaved] = useStored<string[]>(keys.saved, []);
  const [text, setText] = useState("");
  const { data } = useQuotes(saved);

  function add(e: FormEvent) {
    e.preventDefault();
    const symbols = text.toUpperCase().split(/[\s,]+/).filter((s) => /^[A-Z0-9.\-]{1,15}$/.test(s));
    if (symbols.length) setSaved((prev) => [...prev, ...symbols.filter((s) => !prev.includes(s))]);
    setText("");
  }

  const position = (low: number | null, high: number | null, p: number | null) =>
    low !== null && high !== null && p !== null && high > low ? Math.min(100, Math.max(0, ((p - low) / (high - low)) * 100)) : null;

  return (
    <Screen title="Monitor" code="MON" screen="Monitor" intro="Your watchlist, kept in this browser. Prices refresh every 5 minutes (delayed up to 15).">
      <Panel
        title={`Watchlist (${saved.length})`}
        code="MON"
        bodyClass=""
        actions={
          <form onSubmit={add} className="flex items-center gap-1">
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add tickers: MSFT, TD.TO"
              aria-label="Tickers to add"
              className="w-44 rounded-sm border border-line-strong bg-bg px-2 py-0.5 font-mono text-xs uppercase outline-none placeholder:normal-case focus:border-accent"
            />
            <button className="rounded-sm bg-accent px-2 py-0.5 font-mono text-xs font-semibold text-on-accent">ADD</button>
          </form>
        }
      >
        {saved.length === 0 ? (
          <p className="p-3 text-sm text-muted">Nothing here yet. Add tickers above, or star a company on its page.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="text-muted">
                  <th className="px-3 py-1.5 text-left font-medium">Ticker</th>
                  <th className="px-2 py-1.5 text-left font-medium">Name</th>
                  <th className="px-2 py-1.5 text-right font-medium">Last</th>
                  <th className="px-2 py-1.5 text-right font-medium">Change</th>
                  <th className="px-2 py-1.5 text-right font-medium">Day</th>
                  <th className="px-2 py-1.5 text-right font-medium">Mkt cap</th>
                  <th className="px-2 py-1.5 text-right font-medium">Volume</th>
                  <th className="px-2 py-1.5 text-left font-medium">52-week range</th>
                  <th className="px-2 py-1.5 text-right font-medium">Div. yield</th>
                  <th className="py-1.5 pr-3 pl-2"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {saved.map((s) => {
                  const q = data?.[s];
                  const pos = q ? position(q.fiftyTwoWeekLow, q.fiftyTwoWeekHigh, q.price) : null;
                  return (
                    <tr key={s} className="border-t border-line/60 hover:bg-subtle">
                      <td className="px-3 py-1.5 font-semibold">
                        <Link to={companyPath(s)} className="text-accent hover:underline">{s}</Link>
                      </td>
                      <td className="max-w-56 truncate px-2 py-1.5 font-sans">{q?.name ?? (data ? "Not found" : "…")}</td>
                      <td className="px-2 py-1.5 text-right">{q ? fmt.price(q.price, q.currency) : ""}</td>
                      <td className={`px-2 py-1.5 text-right ${(q?.change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>{q ? fmt.signed(q.change) : ""}</td>
                      <td className="px-2 py-1.5 text-right">{q && <Change value={q.changePercent} />}</td>
                      <td className="px-2 py-1.5 text-right">{q ? fmt.big(q.marketCap) : ""}</td>
                      <td className="px-2 py-1.5 text-right">{q ? fmt.big(q.volume) : ""}</td>
                      <td className="px-2 py-1.5">
                        {pos !== null && q && (
                          <div className="flex items-center gap-2" title={`Low ${fmt.num(q.fiftyTwoWeekLow)}, high ${fmt.num(q.fiftyTwoWeekHigh)}`}>
                            <span className="text-muted">{fmt.num(q.fiftyTwoWeekLow, 0)}</span>
                            <span className="relative h-1 w-20 rounded-full bg-subtle">
                              <span className="absolute top-1/2 h-2.5 w-1 -translate-y-1/2 rounded-sm bg-accent" style={{ left: `calc(${pos}% - 2px)` }} />
                            </span>
                            <span className="text-muted">{fmt.num(q.fiftyTwoWeekHigh, 0)}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">{q ? fmt.pct(q.dividendYield) : ""}</td>
                      <td className="py-1.5 pr-3 pl-2 text-right">
                        <button onClick={() => remove(s)} aria-label={`Remove ${s}`} className="rounded-sm px-1.5 text-muted hover:bg-subtle hover:text-loss">
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </Screen>
  );
}

/** EQS: the screener (the old Explore section). */
export function ScreenerScreen() {
  return (
    <Screen title="Equity screener" code="EQS" screen="Screener" intro="Filter about 2,750 US and TSX companies by sector, size, valuation and dividends.">
      <Explore />
    </Screen>
  );
}

/** HELP: every function and shortcut. */
export function HelpScreen() {
  return (
    <Screen title="Functions and shortcuts" code="HELP" screen="Markets">
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel title="Market functions" bodyClass="">
          <FunctionTable rows={MARKET_FUNCTIONS.map((f) => [f.code, f.aliases, f.name, f.path])} />
        </Panel>
        <Panel title="Company functions: type a ticker first" bodyClass="">
          <FunctionTable rows={COMPANY_FUNCTIONS.map((f) => [`AAPL ${f.code}`, f.aliases, f.name, companyPath("AAPL", f.tab)])} />
        </Panel>
        <Panel title="Keyboard">
          <dl className="space-y-2 text-sm">
            {[
              ["/  or  Ctrl K", "Jump to the command line"],
              ["Enter", "Run the command (like GO)"],
              ["Up / Down", "Move through suggestions"],
              ["Esc", "Close suggestions or Ask Finch"],
              ["ASK", "Open the Ask Finch AI assistant"],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-4">
                <dt className="w-32 shrink-0 font-mono text-accent">{k}</dt>
                <dd className="text-muted">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Tickers">
          <p className="text-sm text-muted">
            US listings use their usual symbol (AAPL, BRK-B). TSX listings end in <span className="font-mono text-ink">.TO</span> (RY.TO, SHOP.TO) and
            TSX Venture in <span className="font-mono text-ink">.V</span>. You can also type a company name and press Enter.
          </p>
        </Panel>
      </div>
    </Screen>
  );
}

function FunctionTable({ rows }: { rows: [string, string[], string, string][] }) {
  return (
    <table className="w-full text-xs">
      <tbody>
        {rows.map(([code, aliases, name, to]) => (
          <tr key={code} className="border-t border-line/60 first:border-t-0 hover:bg-subtle">
            <td className="px-3 py-1.5 font-semibold whitespace-nowrap">
              <Link to={to} className="text-accent hover:underline">{code}</Link>
            </td>
            <td className="px-2 py-1.5 font-sans">{name}</td>
            <td className="hidden py-1.5 pr-3 pl-2 text-right text-muted sm:table-cell">{aliases.slice(0, 2).join(", ")}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
