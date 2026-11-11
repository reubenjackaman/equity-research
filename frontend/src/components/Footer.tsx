import { Link } from "react-router-dom";
import { FinchLogo } from "./Finch";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Explore", links: [["Markets", "/"], ["Screener", "/screener"], ["Learn", "/learn"], ["Mystery Company", "/game"], ["Help", "/help"]] },
  { title: "About", links: [["How it works", "/how-it-works"], ["About", "/about"], ["Contact", "/contact"]] },
  { title: "Legal", links: [["Terms of use", "/terms"], ["Privacy", "/privacy"], ["Disclaimer", "/terms#disclaimer"]] },
];

export default function Footer() {
  return (
    <footer className="mt-8 border-t-[1.5px] border-line-strong bg-surface px-4 pt-8 pb-6">
      <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-6 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <FinchLogo className="h-7 w-7 text-ink" /> <span className="deed-title text-xl">Value Finch</span>
          </div>
          <p className="mt-2 text-sm text-muted">A project by Reuben Jackaman.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="text-sm font-bold">{c.title}</h2>
            <ul className="mt-2 text-sm sm:space-y-1">
              {c.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="tap text-muted hover:text-ink hover:underline">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <p className="mx-auto mt-8 max-w-screen-2xl border-t border-line pt-4 text-xs text-muted">
        For educational purposes only. Not investment advice. Data from SEC EDGAR, Yahoo Finance, Finnhub, FRED, the Bank of
        Canada and Wikipedia may be delayed or incomplete. © 2026 Reuben Jackaman.
      </p>
    </footer>
  );
}
