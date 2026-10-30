import { Link } from "react-router-dom";
import { FinchLogo } from "./Finch";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Explore", links: [["Search companies", "/"], ["Browse by sector", "/#explore"], ["Mystery Company", "/game"]] },
  { title: "About", links: [["How it works", "/how-it-works"], ["About", "/about"], ["Contact", "/contact"]] },
  { title: "Legal", links: [["Terms of use", "/terms"], ["Privacy", "/privacy"], ["Disclaimer", "/terms#disclaimer"]] },
];

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white px-4 py-8 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 sm:grid-cols-4">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 font-semibold">
            <FinchLogo className="h-7 w-7" /> Value Finch
          </div>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A project by Reuben Jackaman.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{c.title}</h2>
            <ul className="mt-2 space-y-1.5 text-sm">
              {c.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="text-slate-600 hover:text-pink-600 dark:text-slate-300 dark:hover:text-pink-400">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-6 max-w-6xl border-t border-slate-200 pt-4 text-xs leading-relaxed text-slate-500 dark:border-slate-800 dark:text-slate-400">
        For educational purposes only. Not investment advice. Data from SEC EDGAR, Yahoo Finance and Finnhub may be delayed or
        incomplete. © 2026 Reuben Jackaman.
      </p>
    </footer>
  );
}
