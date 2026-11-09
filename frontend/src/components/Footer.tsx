import { Link } from "react-router-dom";
import { FinchLogo } from "./Finch";

const COLUMNS: { title: string; links: [string, string][] }[] = [
  { title: "Terminal", links: [["Markets", "/"], ["Screener", "/screener"], ["Functions", "/help"], ["Mystery Company", "/game"]] },
  { title: "About", links: [["How it works", "/how-it-works"], ["About", "/about"], ["Contact", "/contact"]] },
  { title: "Legal", links: [["Terms of use", "/terms"], ["Privacy", "/privacy"], ["Disclaimer", "/terms#disclaimer"]] },
];

export default function Footer() {
  return (
    <footer className="mt-8 border-t border-line px-4 pt-6 pb-6">
      <div className="mx-auto grid max-w-screen-2xl grid-cols-2 gap-6 sm:grid-cols-[2fr_1fr_1fr_1fr]">
        <div className="col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 font-mono text-sm font-semibold tracking-wider">
            <FinchLogo className="h-5 w-5 text-accent" /> VALUE FINCH
          </div>
          <p className="mt-2 text-sm text-muted">A project by Reuben Jackaman.</p>
        </div>
        {COLUMNS.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="font-sans text-sm font-semibold tracking-normal">{c.title}</h2>
            <ul className="mt-2 text-sm sm:space-y-1">
              {c.links.map(([label, to]) => (
                <li key={label}>
                  <Link to={to} className="tap text-muted transition-colors hover:text-accent">
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
