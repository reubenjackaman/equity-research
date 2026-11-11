import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, Overview } from "../api";
import * as fmt from "../format";
import { bandStyle } from "../sectors";
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
import InsightsPanel from "../components/Insights";
import PitchTab from "../components/PitchTab";
import { AnalystsTab, InsidersTab } from "../components/StreetTabs";
import { Change, Panel } from "../components/Terminal";
import { StarIcon } from "../components/TopBar";
import { COMPANY_TABS, CompanyTab } from "../functions";
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
    <div className="mx-auto max-w-screen-2xl px-4 pt-6 pb-24" style={bandStyle(data.sector)}>
      {/* Header: the company as a deed card in its sector's colour. Bottom padding keeps the Ask Finch button off the last line. */}
      <div className="deed pb-2">
        <div className="deed-band flex-wrap py-1.5 text-xs">
          <span>{data.sector ?? "Company"}{data.industry ? ` · ${data.industry}` : ""}</span>
          <span className="font-semibold normal-case tracking-normal">{data.exchange ?? "N/A"} · {data.currency ?? "N/A"}</span>
        </div>
        <div className="mx-2 flex flex-wrap items-end justify-between gap-x-8 gap-y-3 px-3 pt-4 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="deed-title text-3xl leading-none sm:text-4xl">{data.name}</h1>
              <button
                onClick={() => toggle(data.symbol)}
                aria-pressed={isSaved(data.symbol)}
                aria-label={isSaved(data.symbol) ? `Remove ${data.symbol} from watchlist`: `Add ${data.symbol} to watchlist`}
                title={isSaved(data.symbol) ? "On your watchlist: click to remove" : "Add to your watchlist"}
                className={`shrink-0 rounded-md p-1.5 hover:bg-subtle ${isSaved(data.symbol) ? "text-warn" : "text-muted hover:text-ink"}`}
              >
                <StarIcon filled={isSaved(data.symbol)} className="h-6 w-6" />
              </button>
            </div>
            <div className="mt-1 text-sm text-muted">
              Ticker <span className="font-bold text-ink">{data.symbol}</span>
              {country === "CN" ? " · Canada" : " · United States"}
            </div>
          </div>
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-4xl font-extrabold tracking-tight">{fmt.price(data.price, data.currency)}</span>
            <span className={`text-base font-bold ${(data.change ?? 0) >= 0 ? "text-gain" : "text-loss"}`}>
              {fmt.signed(data.change)} ({fmt.signed(data.changePercent)}%) today
            </span>
          </div>
        </div>
        <dl className="mx-2 grid grid-cols-2 border-t border-line text-sm sm:grid-cols-3 lg:grid-cols-6">
          {[
            ["Company value", fmt.big(data.marketCap)],
            ["Year low – high", range],
            ["Shares traded", fmt.big(data.volume)],
            ["Usually traded", fmt.big(data.averageVolume)],
            ["Beta (swing)", fmt.num(data.beta)],
            ["Dividend yield", fmt.pct(data.dividendYield)],
          ].map(([label, value]) => (
            <div key={label} className="border-line px-3 py-2 lg:border-l lg:first:border-l-0">
              <dt className="text-xs text-muted">{label}</dt>
              <dd className="font-bold">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <nav aria-label="Company sections" className="mt-5 -mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex gap-1.5">
          {TABS.map((t) => (
            <li key={t}>
              <button
                onClick={() => setTab(t)}
                aria-current={t === tab ? "page" : undefined}
                className={`rounded-md border-[1.5px] px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap ${
                  t === tab ? "border-line-strong bg-ink text-surface" : "border-transparent text-ink hover:border-line-strong hover:bg-surface"
                }`}
              >
                {t}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {tab === "Overview" && <OverviewTab data={data} theme={theme} />}
      {tab === "Pitch" && <PitchTab data={data} />}
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
    <div className="mt-4 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PriceChart ticker={data.symbol} theme={theme} />
      </div>

      <Panel title="Key numbers" bodyClass="px-3 pt-1 pb-2">
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
      </Panel>

      <div className="lg:col-span-3">
        <InsightsPanel ticker={data.symbol} />
      </div>

      <Panel title="About the company" className="lg:col-span-3" bodyClass="px-3 pt-3 pb-2">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {data.sector && <Tag>{data.sector}</Tag>}
          {data.industry && <Tag>{data.industry}</Tag>}
          {fmt.safeUrl(data.website) && (
            <a href={fmt.safeUrl(data.website)} target="_blank" rel="noreferrer" className="tap ml-auto text-sm text-accent hover:underline">
              {data.website!.replace(/^https?:\/\/(www\.)?/, "")}
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
      </Panel>
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
