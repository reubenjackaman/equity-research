import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, Overview } from "../api";
import * as fmt from "../format";
import AskFinch from "../components/AskFinch";
import CompsTab from "../components/CompsTab";
import DcfTab from "../components/DcfTab";
import FinancialsTab from "../components/FinancialsTab";
import NewsTab from "../components/NewsTab";
import PriceChart from "../components/PriceChart";
import HealthTab from "../components/HealthTab";
import RatiosTab from "../components/RatiosTab";
import SearchBar from "../components/SearchBar";
import SummaryTab from "../components/SummaryTab";
import ChartTab from "../components/ChartTab";
import { AnalystsTab, InsidersTab } from "../components/StreetTabs";
import { Change } from "../components/Terminal";
import { StarIcon } from "../components/TopBar";
import { COMPANY_TABS, CompanyTab, tabCode } from "../functions";
import { addRecent, useSaved } from "../storage";
import type { Theme } from "../theme";

const TABS = COMPANY_TABS;

export default function Company({ theme }: { theme: Theme }) {
  const ticker = (useParams().ticker ?? "").toUpperCase();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The open tab lives in the URL (?tab=Ratios) so a reload or shared link keeps it.
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get("tab")) ?? "Overview";
  const setTab = (t: CompanyTab) => setParams(t === "Overview" ? {} : { tab: t }, { replace: true });

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    api
      .overview(ticker)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  useEffect(() => {
    document.title = data ? `${data.symbol} · ${data.name}`: "Value Finch";
    if (data) addRecent(data.symbol);
  }, [data]);
  const { isSaved, toggle } = useSaved();

  if (error) return <NotFound ticker={ticker} error={error} />;
  if (!data) return <Skeleton />;

  const country = data.symbol.endsWith(".TO") || data.symbol.endsWith(".V") ? "CN" : "US";
  const range = data.fiftyTwoWeekLow !== null && data.fiftyTwoWeekHigh !== null ? `${fmt.num(data.fiftyTwoWeekLow)} – ${fmt.num(data.fiftyTwoWeekHigh)}` : "N/A";

  return (
    <div className="mx-auto max-w-screen-2xl px-3 pt-3 pb-24">
      {/* Header: the security line, price and a strip of key figures. Bottom padding keeps the Ask Finch button off the last line. */}
      <div className="border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-3 py-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2 font-mono text-xs">
              <span className="font-semibold text-accent">{data.symbol} {country} EQUITY</span>
              <span className="text-muted">{data.exchange ?? "N/A"} · {data.currency ?? "N/A"}</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5">
              <h1 className="truncate text-xl">{data.name}</h1>
              <button
                onClick={() => toggle(data.symbol)}
                aria-pressed={isSaved(data.symbol)}
                aria-label={isSaved(data.symbol) ? `Remove ${data.symbol} from watchlist`: `Add ${data.symbol} to watchlist`}
                title={isSaved(data.symbol) ? "On your watchlist (MON): click to remove" : "Add to your watchlist (MON)"}
                className={`shrink-0 rounded-sm p-1 transition-colors hover:bg-subtle ${isSaved(data.symbol) ? "text-warn" : "text-muted hover:text-warn"}`}
              >
                <StarIcon filled={isSaved(data.symbol)} className="h-5 w-5" />
              </button>
            </div>
          </div>
          <div className="flex items-baseline gap-3 font-mono">
            <span className="text-2xl font-semibold">{fmt.price(data.price, data.currency)}</span>
            <span className={`text-sm ${(data.change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>{fmt.signed(data.change)}</span>
            <Change value={data.changePercent} className="text-sm" />
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-line font-mono text-xs sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Mkt cap", fmt.big(data.marketCap)],
            ["52-wk range", range],
            ["Volume", fmt.big(data.volume)],
            ["Avg vol (3M)", fmt.big(data.averageVolume)],
            ["Beta", fmt.num(data.beta)],
            ["Div. yield", fmt.pct(data.dividendYield)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2 border-line px-3 py-1.5 lg:border-l lg:first:border-l-0">
              <dt className="font-sans text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-label="Company functions" className="mt-3 flex gap-px overflow-x-auto border-b border-line [scrollbar-width:none]">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={t === tab ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-1.5 text-xs whitespace-nowrap transition-colors ${
              t === tab ? "border-accent bg-surface text-ink" : "border-transparent text-muted hover:bg-surface hover:text-ink"
            }`}
          >
            <span className={`font-mono font-semibold ${t === tab ? "text-accent" : "text-accent/70"}`}>{tabCode(t)}</span>
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && <OverviewTab data={data} theme={theme} />}
      {tab === "Chart" && <ChartTab ticker={data.symbol} currency={data.currency} theme={theme} />}
      {tab === "Analysts" && <AnalystsTab ticker={data.symbol} price={data.price} currency={data.currency} />}
      {tab === "Insiders" && <InsidersTab ticker={data.symbol} currency={data.currency} />}
      {tab === "Financials" && <FinancialsTab ticker={data.symbol} tradingCurrency={data.currency} />}
      {tab === "Ratios" && <RatiosTab ticker={data.symbol} />}
      {tab === "Health" && <HealthTab ticker={data.symbol} />}
      {tab === "News" && <NewsTab ticker={data.symbol} />}
      {tab === "DCF" && <DcfTab ticker={data.symbol} />}
      {tab === "Comps" && <CompsTab ticker={data.symbol} price={data.price} currency={data.currency} />}
      {tab === "Summary" && <SummaryTab data={data} />}
      <AskFinch symbol={data.symbol} name={data.name} tab={tab} />
    </div>
  );
}

function OverviewTab({ data, theme }: { data: Overview; theme: Theme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-3 grid gap-3 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PriceChart ticker={data.symbol} theme={theme} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-xs font-semibold tracking-wider text-accent uppercase">Key statistics</h2>
        <dl className="divide-y divide-line text-sm">
          <Stat label="Market cap" value={fmt.big(data.marketCap)} />
          <Stat label="Shares outstanding" value={fmt.big(data.sharesOutstanding)} />
          <Stat label="Volume" value={fmt.big(data.volume)} />
          <Stat label="Avg. volume (3M)" value={fmt.big(data.averageVolume)} />
          <Stat label="Dividend yield" value={fmt.pct(data.dividendYield)} />
          <Stat label="Beta (5Y monthly)" value={fmt.num(data.beta)} />
        </dl>
        <div className="mt-4">
          <div className="mb-1.5 text-xs text-muted">52-week range</div>
          <RangeBar low={data.fiftyTwoWeekLow} high={data.fiftyTwoWeekHigh} current={data.price} currency={data.currency} />
        </div>
      </div>

      <div className="card lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-xs font-semibold tracking-wider text-accent uppercase">About</h2>
          {data.sector && <Tag>{data.sector}</Tag>}
          {data.industry && <Tag>{data.industry}</Tag>}
          {data.website && (
            <a href={data.website} target="_blank" rel="noreferrer" className="tap ml-auto text-sm text-accent hover:underline">
              {data.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>
        <p className={`text-sm leading-relaxed text-muted  ${expanded ? "" : "line-clamp-4"}`}>
          {data.description ?? "No description available (N/A)."}
        </p>
        {data.profileSource !== "Yahoo Finance" && (
          <p className="mt-2 text-xs text-muted">
            Company profile from {data.profileSource} (Yahoo's profile is unavailable right now), so a few figures may be N/A.
          </p>
        )}
        {data.description && data.description.length > 400 && (
          <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-accent hover:underline">
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-subtle px-2 py-0.5 text-xs text-muted">
      {children}
    </span>
  );
}

/** Shows where today's price sits between the 52-week low and high. */
function RangeBar({ low, high, current, currency }: { low: number | null; high: number | null; current: number | null; currency: string | null }) {
  const position =
    low !== null && high !== null && current !== null && high > low
      ? Math.min(100, Math.max(0, ((current - low) / (high - low)) * 100))
      : null;
  return (
    <div>
      <div className="relative h-1.5 rounded-full bg-subtle">
        {position !== null && (
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent"
            style={{ left: `${position}%`}}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted">
        <span>{fmt.price(low, currency)}</span>
        <span>{fmt.price(high, currency)}</span>
      </div>
    </div>
  );
}

function NotFound({ ticker, error }: { ticker: string; error: ApiError }) {
  const notFound = error.status === 404;
  return (
    <div className="mx-auto max-w-xl px-4 pt-16 text-center">
      <h1 className="text-xl font-semibold">{notFound ? `We couldn't find "${ticker}"`: "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-muted">
        {notFound
          ? "Check the symbol. TSX tickers end in .TO (e.g. SHOP.TO) and TSX Venture in .V."
          : `${error.message}. The data provider may be busy, so try again in a minute.`}
      </p>
      <div className="mt-6">
        <SearchBar large />
      </div>
    </div>
  );
}

function Skeleton() {
  const block = "animate-pulse rounded bg-subtle";
  return (
    <div className="mx-auto max-w-screen-2xl px-4 py-6">
      <div className={`${block} h-5 w-40`} />
      <div className={`${block} mt-2 h-8 w-72`} />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className={`${block} h-80 lg:col-span-2`} />
        <div className={`${block} h-80`} />
      </div>
    </div>
  );
}
