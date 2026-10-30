import { useEffect, useState } from"react";
import { News, newsApi } from"../api";

function timeAgo(iso: string) {
  const minutes = (Date.now() - new Date(iso).getTime()) / 60000;
  if (minutes < 60) return `${Math.max(1, Math.round(minutes))}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  if (minutes < 60 * 24 * 7) return `${Math.round(minutes / 1440)}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function NewsTab({ ticker }: { ticker: string }) {
  const [data, setData] = useState<News | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    newsApi
      .get(ticker)
      .then((d) => !cancelled && setData(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  if (error) return <p className="card mt-6 text-sm text-muted">News unavailable: {error}</p>;
  if (!data) return <div className="mt-6 h-96 animate-pulse rounded bg-subtle" />;

  const aboutCount = data.articles.filter((a) => a.about).length;
  // If nothing names the company in the headline, fall back to showing everything.
  const filtering = !showAll && aboutCount > 0;
  const articles = filtering ? data.articles.filter((a) => a.about) : data.articles;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded bg-subtle p-0.5">
          {[
            { all: false, label: `About ${data.matchName || ticker} (${aboutCount})`},
            { all: true, label: `All mentions (${data.articles.length})`},
          ].map((o) => (
            <button
              key={o.label}
              onClick={() => setShowAll(o.all)}
              className={`whitespace-nowrap rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                (filtering ? !o.all : o.all) ? "bg-surface" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">Newest first</span>
      </div>

      <ul className="card divide-y divide-line p-0 sm:p-0">
        {articles.length === 0 && <li className="p-5 text-sm text-muted">No recent news found.</li>}
        {articles.map((a) => (
          <li key={a.url}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group block px-4 py-3 hover:bg-subtle sm:px-5"
            >
              <div className="text-sm font-medium leading-snug group-hover:text-accent">
                {a.headline}
              </div>
              {a.summary && <p className="mt-1 line-clamp-2 text-xs text-muted">{a.summary}</p>}
              <div className="mt-1 text-xs text-muted">
                <span className="font-medium text-muted">{a.source ?? "N/A"}</span>
                <span className="mx-1.5">·</span>
                <time dateTime={a.published} title={new Date(a.published).toLocaleString()}>
                  {timeAgo(a.published)}
                </time>
              </div>
            </a>
          </li>
        ))}
      </ul>

      <p className="text-xs leading-relaxed text-muted">
        Sources: {data.sources.join(" + ") || "none available"}. "About" means the headline names the company or its
        ticker; "All mentions" includes articles that only reference it.
        {!data.sources.includes("Finnhub") &&
          " Yahoo only returns the latest ~30 articles. Add a free Finnhub key to backend/.env for a month of company news."}
      </p>
    </div>
  );
}
