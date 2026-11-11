// A company as a deed card: its sector's colour band, its name, and a ruled table of numbers.
// Click or press the card to turn it over; the back explains each number in plain English.
import { useState } from "react";
import { Link } from "react-router-dom";
import * as fmt from "../format";
import { companyPath } from "../functions";
import { bandStyle } from "../sectors";

export type DeedCompany = {
  symbol: string;
  name: string;
  sector: string | null;
  currency: string | null;
  price: number;
  changePercent: number;
  marketCap: number | null;
  dollarVolume?: number | null;
};

export default function DeedCard({ c, className = "", style }: { c: DeedCompany; className?: string; style?: React.CSSProperties }) {
  const [back, setBack] = useState(false);
  const up = c.changePercent >= 0;
  const rows: [string, string, string][] = [
    ["Share price", fmt.price(c.price, c.currency), "What one share costs right now (prices here are delayed a few minutes)."],
    ["Today", `${fmt.signed(c.changePercent)}%`, `How much the price has moved since yesterday's close: ${up ? "up" : "down"} ${Math.abs(c.changePercent).toFixed(2)}%.`],
    ["Company value", fmt.big(c.marketCap), "Market cap: the price of every share added together, roughly what the whole company is worth to the market."],
    ...(c.dollarVolume ? ([["Traded today", fmt.big(c.dollarVolume), "The value of all the shares that changed hands today. Big numbers mean lots of interest."]] as [string, string, string][]) : []),
  ];

  return (
    <div className={`deed-flip ${back ? "is-back" : ""} ${className}`} style={{ ...bandStyle(c.sector), ...style }}>
      <div className="deed-flip-inner">
        {/* Front */}
        <button
          type="button"
          onClick={() => setBack(true)}
          aria-label={`${c.name}: turn the card over for what these numbers mean`}
          aria-hidden={back}
          tabIndex={back ? -1 : 0}
          className="deed deed-face flex flex-col text-left"
        >
          <div className="deed-band min-h-[4.25rem] justify-center py-2.5 text-center">
            <span className="line-clamp-2 text-lg leading-tight">{c.name}</span>
          </div>
          <div className="mx-4 mt-3 flex items-baseline justify-between gap-2">
            <span className="deed-title text-sm">{c.symbol}</span>
            <span className={`text-sm font-bold ${up ? "text-gain" : "text-loss"}`}>
              {fmt.signed(c.changePercent)}% today
            </span>
          </div>
          <div className="mx-4 mt-1 text-3xl font-extrabold tracking-tight">{fmt.price(c.price, c.currency)}</div>
          <dl className="mx-4 mt-3 divide-y divide-line border-y border-line text-sm">
            {[["Sector", c.sector ?? "N/A"] as [string, string], ...rows.slice(2)].map(([label, value]) => (
              <div key={label} className="flex justify-between py-1.5">
                <dt className="text-muted">{label}</dt>
                <dd className="font-semibold">{value}</dd>
              </div>
            ))}
          </dl>
          <span className="mx-4 mt-auto mb-3 pt-3 text-center text-xs text-muted">Tap to turn over</span>
        </button>

        {/* Back */}
        {/* The whole back turns the card over again; only the Research link goes elsewhere. */}
        <div
          role="button"
          tabIndex={back ? 0 : -1}
          aria-hidden={!back}
          aria-label={`${c.name}: turn the card back over`}
          onClick={() => setBack(false)}
          onKeyDown={(e) => {
            if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
              e.preventDefault();
              setBack(false);
            }
          }}
          className="deed deed-face deed-back flex cursor-pointer flex-col"
        >
          <div className="deed-band justify-center py-2 text-center text-sm">What these numbers mean</div>
          <dl className="mx-4 mt-2 min-h-0 flex-1 space-y-2 overflow-auto text-sm">
            {rows.map(([label, value, why]) => (
              <div key={label}>
                <dt className="font-bold">
                  {label} <span className="font-normal text-muted">· {value}</span>
                </dt>
                <dd className="text-muted">{why}</dd>
              </div>
            ))}
          </dl>
          <div className="mx-4 mt-2 mb-3 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">Tap to turn back</span>
            <Link to={companyPath(c.symbol)} tabIndex={back ? 0 : -1} onClick={(e) => e.stopPropagation()} className="btn-primary">
              Research {c.symbol}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
