import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { api, ApiError, Overview } from "../api";
import * as fmt from "../format";
import CompsTab from "../components/CompsTab";
import DcfTab from "../components/DcfTab";
import FinancialsTab from "../components/FinancialsTab";
import NewsTab from "../components/NewsTab";
import PriceChart from "../components/PriceChart";
import RatiosTab from "../components/RatiosTab";
import SearchBar from "../components/SearchBar";
import SummaryTab from "../components/SummaryTab";
import { StarIcon } from "../components/TopBar";
import { addRecent, useSaved } from "../storage";
import type { Theme } from "../theme";

const TABS = ["Overview", "Financials", "Ratios", "News", "DCF", "Comps", "Summary"] as const;

export default function Company({ theme }: { theme: Theme }) {
  const ticker = (useParams().ticker ?? "").toUpperCase();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  // The open tab lives in the URL (?tab=Ratios) so a reload or shared link keeps it.
  const [params, setParams] = useSearchParams();
  const tab = TABS.find((t) => t === params.get("tab")) ?? "Overview";
  const setTab = (t: (typeof TABS)[number]) => setParams(t === "Overview" ? {} : { tab: t }, { replace: true });

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
    document.title = data ? `${data.symbol} · ${data.name}` : "Value Finch";
    if (data) addRecent(data.symbol);
  }, [data]);
  const { isSaved, toggle } = useSaved();

  if (error) return <NotFound ticker={ticker} error={error} />;
  if (!data) return <Skeleton />;

  const up = (data.change ?? 0) >= 0;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      {/* Header: name, price, day change */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-slate-700 dark:text-slate-200">{data.symbol}</span>
            <span>·</span>
            <span>{data.exchange ?? "N/A"}</span>
            <span>·</span>
            <span>{data.currency ?? "N/A"}</span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-3xl">{data.name}</h1>
            <button
              onClick={() => toggle(data.symbol)}
              aria-pressed={isSaved(data.symbol)}
              aria-label={isSaved(data.symbol) ? `Remove ${data.symbol} from saved` : `Save ${data.symbol}`}
              title={isSaved(data.symbol) ? "Saved: click to remove" : "Save to your list"}
              className={`shrink-0 rounded-lg p-1.5 transition hover:bg-slate-100 dark:hover:bg-slate-800 ${
                isSaved(data.symbol) ? "text-amber-500" : "text-slate-400 hover:text-amber-500"
              }`}
            >
              <StarIcon filled={isSaved(data.symbol)} className="h-6 w-6" />
            </button>
          </div>
        </div>
        <div className="sm:text-right">
          <div className="text-2xl font-semibold sm:text-3xl">{fmt.price(data.price, data.currency)}</div>
          <div className={`text-sm font-medium ${up ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {fmt.signed(data.change)} ({fmt.signed(data.changePercent)}%) today
          </div>
        </div>
      </div>

      <nav className="mt-6 flex gap-1 overflow-x-auto border-b [scrollbar-width:none] border-slate-200 dark:border-slate-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium ${
              t === tab
                ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
                : "border-transparent text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"
            }`}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === "Overview" && <OverviewTab data={data} theme={theme} />}
      {tab === "Financials" && <FinancialsTab ticker={data.symbol} tradingCurrency={data.currency} />}
      {tab === "Ratios" && <RatiosTab ticker={data.symbol} />}
      {tab === "News" && <NewsTab ticker={data.symbol} />}
      {tab === "DCF" && <DcfTab ticker={data.symbol} />}
      {tab === "Comps" && <CompsTab ticker={data.symbol} price={data.price} currency={data.currency} />}
      {tab === "Summary" && <SummaryTab data={data} />}
    </div>
  );
}

function OverviewTab({ data, theme }: { data: Overview; theme: Theme }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <PriceChart ticker={data.symbol} theme={theme} />
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-semibold">Key statistics</h2>
        <dl className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
          <Stat label="Market cap" value={fmt.big(data.marketCap)} />
          <Stat label="Shares outstanding" value={fmt.big(data.sharesOutstanding)} />
          <Stat label="Volume" value={fmt.big(data.volume)} />
          <Stat label="Avg. volume (3M)" value={fmt.big(data.averageVolume)} />
          <Stat label="Dividend yield" value={fmt.pct(data.dividendYield)} />
          <Stat label="Beta (5Y monthly)" value={fmt.num(data.beta)} />
        </dl>
        <div className="mt-4">
          <div className="mb-1.5 text-xs text-slate-500 dark:text-slate-400">52-week range</div>
          <RangeBar low={data.fiftyTwoWeekLow} high={data.fiftyTwoWeekHigh} current={data.price} currency={data.currency} />
        </div>
      </div>

      <div className="card lg:col-span-3">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-2 text-sm font-semibold">About</h2>
          {data.sector && <Tag>{data.sector}</Tag>}
          {data.industry && <Tag>{data.industry}</Tag>}
          {data.website && (
            <a href={data.website} target="_blank" rel="noreferrer" className="ml-auto text-sm text-blue-600 hover:underline dark:text-blue-400">
              {data.website.replace(/^https?:\/\/(www\.)?/, "")}
            </a>
          )}
        </div>
        <p className={`text-sm leading-relaxed text-slate-600 dark:text-slate-300 ${expanded ? "" : "line-clamp-4"}`}>
          {data.description ?? "No description available (N/A)."}
        </p>
        {data.profileSource !== "Yahoo Finance" && (
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            Company profile from {data.profileSource} (Yahoo's profile is unavailable right now), so a few figures may be N/A.
          </p>
        )}
        {data.description && data.description.length > 400 && (
          <button onClick={() => setExpanded(!expanded)} className="mt-2 text-sm text-blue-600 hover:underline dark:text-blue-400">
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
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
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
      <div className="relative h-1.5 rounded-full bg-slate-200 dark:bg-slate-700">
        {position !== null && (
          <div
            className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-blue-600 dark:border-slate-900"
            style={{ left: `${position}%` }}
          />
        )}
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-slate-500 dark:text-slate-400">
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
      <h1 className="text-xl font-semibold">{notFound ? `We couldn't find "${ticker}"` : "Something went wrong"}</h1>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
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
  const block = "animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800";
  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className={`${block} h-5 w-40`} />
      <div className={`${block} mt-2 h-8 w-72`} />
      <div className="mt-10 grid gap-4 lg:grid-cols-3">
        <div className={`${block} h-80 lg:col-span-2`} />
        <div className={`${block} h-80`} />
      </div>
    </div>
  );
}
