// The terminal's market screens: the dashboard (MKTS) and WEI, MOST, GC, ECO, EVTS, MON, EQS and HELP.
import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { marketsApi, type BoardQuote, type Mover } from "../api";
import AskFinch from "../components/AskFinch";
import Explore from "../components/Explore";
import CommandBar, { OPEN_ASK } from "../components/CommandBar";
import { FinchLogo } from "../components/Finch";
import DeedCard from "../components/DeedCard";
import { ArrowRight, Trend } from "../components/Icons";
import {
  BoardPanel, CurveChart, EarningsPanel, EconomyPanel, MoverTable, MoversPanel, RatesPanel, WatchPanel, useQuotes,
} from "../components/MarketPanels";
import { Change, Panel, PanelState, level } from "../components/Terminal";
import * as fmt from "../format";
import { COMPANY_FUNCTIONS, MARKET_FUNCTIONS, companyPath } from "../functions";
import { useSaved, useStored, keys } from "../storage";
import { useApi } from "../useApi";

function Screen({ title, code, intro, screen, children }: { title: string; code: string; intro?: ReactNode; screen: string; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · Value Finch`;
  }, [code, title]);
  return (
    <div className="mx-auto max-w-screen-2xl px-4 pt-6 pb-24">
      <div className="mb-4">
        <h1 className="deed-title text-3xl">{title}</h1>
        {intro && <p className="prose-width mt-1 text-muted">{intro}</p>}
      </div>
      {children}
      <AskFinch tab={screen} />
    </div>
  );
}

const STEPS: { title: string; text: string; link: [string, string] }[] = [
  {
    title: "Look up a company",
    text: "Its statements, ratios and health scores, each with a plain-English note on what the number says.",
    link: ["Try Apple", companyPath("AAPL")],
  },
  {
    title: "Work out what it's worth",
    text: "Build a valuation with your own guesses, compare it with similar companies, and see what today's price expects.",
    link: ["Value Royal Bank", companyPath("RY.TO", "DCF")],
  },
  {
    title: "Write a stock pitch",
    text: "Finch, the AI analyst, drafts sections and questions your reasoning like a judge would. Export a PDF when you're done.",
    link: ["Start a pitch", companyPath("AAPL", "Pitch")],
  },
  {
    title: "Learn the basics",
    text: "Short lessons on what a share is, how to read a balance sheet, and how valuation works.",
    link: ["Start learning", "/learn"],
  },
];

const EXAMPLES: [string, string][] = [
  ["Apple", "AAPL"],
  ["Shopify", "SHOP.TO"],
  ["Royal Bank", "RY.TO"],
  ["Tesla", "TSLA"],
];

/** Three well-known, heavily traded companies from today's movers, dealt as a fanned hand of deed cards. */
function Hand() {
  const { data } = useApi(marketsApi.movers, "movers", 10 * 60 * 1000);
  // One card per sector, so the hand shows three different colour bands.
  const cards: Mover[] = [];
  for (const m of data?.us.active ?? []) {
    if (m.marketCap && m.sector && !cards.some((c) => c.sector === m.sector)) cards.push(m);
    if (cards.length === 3) break;
  }
  if (!cards.length) {
    return <div className="mx-auto aspect-[5/7] w-56 animate-pulse rounded-lg border-[1.5px] border-line-strong/30 bg-surface/60" aria-label="Loading today's companies" />;
  }
  const fan = [
    "xl:-rotate-[5deg] xl:translate-y-5",
    "xl:z-10 xl:-translate-y-1",
    "xl:rotate-[5deg] xl:translate-y-5",
  ];
  return (
    <div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:justify-center xl:mx-0 xl:gap-0 xl:overflow-visible xl:px-0">
        {cards.map((c, i) => (
          <li key={c.symbol} className={`w-[68vw] max-w-60 shrink-0 snap-center xl:mx-1 xl:w-56 ${fan[i] ?? ""}`}>
            <DeedCard c={c} className="shadow-sm" />
          </li>
        ))}
      </ul>
      <p className="mt-2 text-center text-xs font-semibold md:hidden">Swipe for more cards</p>
      <p className="mt-2 text-center text-sm text-muted xl:mt-10">Today's most traded US companies (prices delayed a few minutes). Turn a card over to see what its numbers mean.</p>
    </div>
  );
}

const INDEXES: [string, string, string, string][] = [
  ["S&P 500", "500", "United States", "The 500 biggest US companies, weighted by size. The usual meaning of \u201cthe market\u201d."],
  ["Nasdaq", "3,000+", "United States", "Over 3,000 companies listed on the Nasdaq exchange, heavy in technology."],
  ["Dow Jones", "30", "United States", "30 large, well-known US companies, weighted by share price. The oldest index."],
  ["S&P/TSX", "About 220", "Canada", "About 220 of the biggest companies on the Toronto Stock Exchange, heavy in banks and energy."],
];

/** The headline indices as deed cards; the back says what each index is. */
function IndexRow() {
  const { data, error } = useApi(marketsApi.board, "board", 5 * 60 * 1000);
  const quotes = data?.flatMap((g) => g.items) ?? [];
  if (!data) return <PanelState error={error} rows={4} />;
  return (
    <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {INDEXES.map(([label, count, country, what]) => {
        const q = quotes.find((x) => x.label === label);
        return q ? (
          <li key={label} className="min-w-0">
            <IndexCard q={q} what={what} count={count} country={country} />
          </li>
        ) : null;
      })}
    </ul>
  );
}

function IndexCard({ q, what, count, country }: { q: BoardQuote; what: string; count: string; country: string }) {
  const [back, setBack] = useState(false);
  const up = (q.changePercent ?? 0) >= 0;
  return (
    <div className={`deed-flip ${back ? "is-back" : ""}`}>
      <div className="deed-flip-inner">
        <button type="button" onClick={() => setBack(true)} aria-hidden={back} tabIndex={back ? -1 : 0} aria-label={`${q.label}: turn over for what this index is`} className="deed deed-face flex flex-col text-left">
          <div className="deed-band justify-center text-center text-base">{q.label}</div>
          <div className="mx-4 mt-3 text-2xl font-extrabold tracking-tight sm:text-3xl">{level(q)}</div>
          <div className={`mx-4 text-sm font-bold ${up ? "text-gain" : "text-loss"}`}>
            <Trend dir={up ? "up" : "down"} /> {fmt.signed(q.changePercent)}% today
          </div>
          <dl className="mx-4 mt-2 divide-y divide-line border-y border-line text-xs sm:text-sm">
            {([["Companies", count], ["Country", country], ["Past month", q.monthChangePercent == null ? "N/A" : `${fmt.signed(q.monthChangePercent)}%`]] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 py-1">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
          <span className="mx-4 mt-auto mb-3 pt-2 text-xs text-muted">Tap to turn over</span>
        </button>
        <button
          type="button"
          onClick={() => setBack(false)}
          tabIndex={back ? 0 : -1}
          aria-hidden={!back}
          aria-label={`${q.label}: turn the card back over`}
          className="deed deed-face deed-back flex flex-col text-left"
        >
          <div className="deed-band w-[calc(100%-16px)] justify-center text-center text-base">What is the {q.label}?</div>
          <p className="mx-4 mt-2 min-h-0 flex-1 overflow-auto text-sm">{what}</p>
          <span className="mx-4 mb-3 text-xs text-muted">Tap to turn back</span>
        </button>
      </div>
    </div>
  );
}

/** The home page: what the site is, a working search, a hand of live company cards, then today's markets. */
export function MarketsHome() {
  useEffect(() => {
    document.title = "Value Finch · Company research for beginners";
  }, []);

  return (
    <div className="pb-24">
      <section className="mx-auto grid max-w-screen-2xl gap-10 px-4 [&>*]:min-w-0 pt-10 pb-12 xl:grid-cols-[minmax(0,1fr)_minmax(0,46rem)] xl:items-center xl:gap-8 xl:pt-16 xl:pb-20">
        <div>
          <FinchLogo className="h-14 w-14 text-ink" />
          <h1 className="mt-4 max-w-[17ch] text-4xl font-extrabold sm:text-[4.25rem] sm:leading-[0.95]" style={{ fontStretch: "80%" }}>
            Understand a company before you buy its shares.
          </h1>
          <p className="prose-width mt-5 text-lg">
            Look up any of about 2,750 US and Canadian companies. Every number comes with a plain-English note on what it means, so you can
            understand a business before you put money near it. Free, and no account needed.
          </p>
          <div className="mt-7 max-w-xl">
            <CommandBar large />
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">Or try</span>
              {EXAMPLES.map(([label, t]) => (
                <Link key={t} to={companyPath(t)} className="tap rounded-md border-[1.5px] border-line-strong bg-surface px-3 py-1 font-semibold hover:bg-ink hover:text-surface">
                  {label}
                </Link>
              ))}
            </p>
            <p className="mt-5 text-sm text-muted">
              Then you can{" "}
              {STEPS.slice(1).map((st, i, all) => (
                <span key={st.title}>
                  <Link to={st.link[1]} className="font-bold text-ink underline">{st.title.toLowerCase()}</Link>
                  {i < all.length - 2 ? ", " : i === all.length - 2 ? " or " : "."}
                </span>
              ))}
            </p>
          </div>
        </div>
        <Hand />
      </section>

      <section aria-labelledby="today" className="mx-auto max-w-screen-2xl px-4 pt-6">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <h2 id="today" className="deed-title text-3xl">How the markets did today</h2>
            <p className="prose-width mt-1 text-muted">
              An index tracks a basket of big companies, so it shows how the market did as a whole. Turn a card over to see what's inside it.
            </p>
          </div>
          <Link to="/markets" className="btn">
            See the full markets board <ArrowRight />
          </Link>
        </div>
        <IndexRow />
        <p className="mt-6 text-sm text-muted">
          Stuck on a word or a number?{" "}
          <button onClick={() => window.dispatchEvent(new Event(OPEN_ASK))} className="font-bold text-accent underline hover:text-accent-hover">
            Ask Finch
          </button>
          , or play today's{" "}
          <Link to="/game" className="font-bold text-accent underline hover:text-accent-hover">Mystery Company puzzle</Link> and guess a company from its numbers.
        </p>
      </section>
      <AskFinch tab="Markets" />
    </div>
  );
}

/** The full markets board: indices, movers, currencies, rates, earnings and the economy, for people who want the detail. */
export function MarketsBoardScreen() {
  return (
    <Screen title="Markets board" code="MKTS" screen="Markets" intro="Every market we follow on one page. Prices are delayed a few minutes; click a card's title for its full page.">
        <div className="grid gap-4 lg:grid-cols-12">
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <BoardPanel title="Equity indices" groups={["Americas", "Europe", "Asia-Pacific"]} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <MoversPanel rows={8} />
          <BoardPanel title="Currencies, commodities, crypto" code="WEI" groups={["Currencies", "Commodities", "Crypto"]} />
        </div>
        <div className="min-w-0 space-y-4 lg:col-span-4">
          <RatesPanel />
          <EarningsPanel limit={10} />
          <WatchPanel />
        </div>
        <div className="min-w-0 lg:col-span-12">
          <EconomyPanel wide />
        </div>
      </div>
    </Screen>
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
