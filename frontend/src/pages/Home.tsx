import { useEffect } from "react";
import { Link } from "react-router-dom";
import Explore from "../components/Explore";
import SearchBar from "../components/SearchBar";

const EXAMPLES = ["AAPL", "MSFT", "NVDA", "SHOP.TO", "RY.TO", "CNR.TO"];

export default function Home() {
  useEffect(() => {
    document.title = "Equity Research · Reuben Jackaman";
  }, []);

  return (
    <>
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-14 text-center sm:pt-20">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600 dark:text-blue-400">
          A project by Reuben Jackaman
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Research any public company</h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">
          US and TSX listings: financial statements, ratios, DCF and comparable-company valuation.
        </p>
        <div className="mt-8 w-full">
          <SearchBar large />
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((t) => (
            <Link
              key={t}
              to={`/company/${t}`}
              className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm text-slate-600 hover:border-blue-400 hover:text-blue-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
            >
              {t}
            </Link>
          ))}
        </div>
      </div>
      <div className="mx-auto mt-10 max-w-2xl px-4">
        <Link
          to="/game"
          className="flex items-center justify-between gap-4 rounded-xl bg-linear-to-r from-pink-600 to-orange-500 p-5 text-white shadow-lg transition hover:brightness-110"
        >
          <span>
            <span className="block text-lg font-bold">Mystery Company</span>
            <span className="block text-sm text-white/90">Today's hidden company. Six guesses. Can you read the numbers?</span>
          </span>
          <span className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-sm font-bold text-pink-600">Play →</span>
        </Link>
      </div>
      <Explore />
    </>
  );
}
