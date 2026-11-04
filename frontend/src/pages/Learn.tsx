// LEARN: how to pitch a stock, and a plain-English glossary of every term on the site.
// Each glossary entry has an id, so "What's this?" links (/learn#pe) land on it.
import { ReactNode, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import AskFinch from "../components/AskFinch";
import { Panel } from "../components/Terminal";
import { companyPath } from "../functions";

type Term = { id: string; term: string; means: ReactNode; rule?: ReactNode; where?: [string, string] };

const GROUPS: { title: string; terms: Term[] }[] = [
  {
    title: "Valuation multiples",
    terms: [
      { id: "pe", term: "P/E (price to earnings)", means: "Share price divided by earnings per share: how many dollars investors pay for one dollar of yearly profit.", rule: "Compare with peers and the company's own history, not a fixed number. A high P/E means the market expects growth; a low one can mean value or trouble.", where: ["AAPL RATIO", companyPath("AAPL", "Ratios")] },
      { id: "ev_ebitda", term: "EV/EBITDA", means: "Enterprise value (market cap plus debt minus cash) divided by earnings before interest, tax, depreciation and amortization. It compares companies regardless of how much debt they carry.", rule: "Useful across companies with different debt levels; meaningless for banks.", where: ["MSFT RV", companyPath("MSFT", "Comps")] },
      { id: "ps", term: "P/S (price to sales)", means: "Market cap divided by revenue. Used for companies without profits yet.", rule: "Only fair between companies with similar margins: a dollar of software sales is worth more than a dollar of grocery sales." },
      { id: "pb", term: "P/B (price to book)", means: "Market cap divided by shareholders' equity on the balance sheet.", rule: "Most useful for banks and insurers, whose assets are mostly financial." },
      { id: "fcf_yield", term: "Free cash flow yield", means: "Free cash flow divided by market cap: the cash the business generates each year per dollar you pay for it.", rule: "Compare it with a government bond yield. Below the bond yield, you're paying for growth." },
      { id: "z_score", term: "Valuation vs its own history (standard deviations)", means: "How far today's multiple is from the company's own average, measured in standard deviations. +1 means unusually expensive versus its past; -1 unusually cheap.", rule: "A business that has genuinely changed (say, much faster growth) deserves a different multiple than its past.", where: ["AAPL SUM", companyPath("AAPL", "Summary")] },
    ],
  },
  {
    title: "Valuation models",
    terms: [
      { id: "dcf", term: "DCF (discounted cash flow)", means: "Values a company as the sum of its future free cash flows, discounted back to today, plus a terminal value for the years after the forecast.", rule: "Small changes in growth or discount rate move the answer a lot. Use it to understand what you must believe, not as a precise price.", where: ["RY.TO DCF", companyPath("RY.TO", "DCF")] },
      { id: "wacc", term: "WACC (discount rate)", means: "Weighted average cost of capital: the return investors and lenders expect, blended by how much of each the company uses. Higher risk means a higher WACC and a lower value." },
      { id: "terminal_value", term: "Terminal value", means: "The value of all cash flows after the forecast years, assuming steady growth forever. It's often more than half of a DCF value, so the long-term growth assumption matters a lot." },
      { id: "reverse_dcf", term: "Reverse DCF (what's priced in)", means: "Runs the DCF backwards: finds the growth rate that makes the DCF value equal today's price. It tells you what the market already expects.", rule: "If the priced-in growth is far above what the company has ever delivered, the stock needs things to go very right.", where: ["AAPL DCF", companyPath("AAPL", "DCF")] },
      { id: "comps", term: "Comparable companies (comps)", means: "Values a company by applying its peers' median multiple (like P/E) to its own earnings.", rule: "Only as good as the peer list: pick companies with similar business models, growth and size.", where: ["MSFT RV", companyPath("MSFT", "Comps")] },
      { id: "football_field", term: "Football field", means: "A chart of each valuation method's range side by side with today's price, so you can see where they agree.", where: ["AAPL SUM", companyPath("AAPL", "Summary")] },
    ],
  },
  {
    title: "Profitability and growth",
    terms: [
      { id: "gross_margin", term: "Gross margin", means: "Revenue minus the direct cost of what was sold, as a share of revenue. It shows pricing power." },
      { id: "operating_margin", term: "Operating margin", means: "Profit from operations (before interest and tax) as a share of revenue. A widening margin means each sale is becoming more profitable." },
      { id: "roe", term: "ROE (return on equity)", means: "Net income divided by shareholders' equity.", rule: "Very high ROE can come from heavy buybacks or debt, not just a great business. Check ROIC too." },
      { id: "roic", term: "ROIC (return on invested capital)", means: "Operating profit after tax divided by all the capital (debt and equity) the business uses.", rule: "Above the WACC means the company creates value as it grows." },
      { id: "revenue_growth", term: "Revenue growth and CAGR", means: "How fast sales are growing. CAGR (compound annual growth rate) is the steady yearly rate that gets from the start value to the end value." },
    ],
  },
  {
    title: "Balance sheet and health",
    terms: [
      { id: "debt_to_equity", term: "Debt-to-equity", means: "Total debt divided by shareholders' equity. Higher means more borrowed money and more risk if profits fall." },
      { id: "interest_coverage", term: "Interest coverage", means: "Operating profit divided by interest expense: how many times over the company can pay its interest.", rule: "Below about 3x is a warning sign." },
      { id: "current_ratio", term: "Current ratio", means: "Short-term assets divided by short-term liabilities: can the company pay its bills due within a year?" },
      { id: "piotroski", term: "Piotroski F-Score", means: "Nine pass/fail tests of profitability, balance-sheet strength and efficiency.", rule: "7–9 is strong, 0–3 is weak.", where: ["AAPL HLTH", companyPath("AAPL", "Health")] },
      { id: "altman", term: "Altman Z-Score", means: "A 1968 formula that combines five ratios to estimate bankruptcy risk.", rule: "Above 2.99 is the safe zone; below 1.81 is the distress zone. Not designed for banks." },
      { id: "beneish", term: "Beneish M-Score", means: "Eight ratios that together flag patterns seen in companies that manipulated earnings.", rule: "Above -1.78 is a prompt to read the accounts closely, not proof of anything." },
    ],
  },
  {
    title: "Markets and trading",
    terms: [
      { id: "yield_curve", term: "Yield curve", means: "Government bond yields plotted from short to long maturities. Normally it slopes up.", rule: "When short yields exceed long ones (inverted), a recession has often followed.", where: ["GC", "/rates"] },
      { id: "basis_points", term: "Basis points (bp)", means: "One hundredth of a percentage point. A yield moving from 4.50% to 4.75% has risen 25bp." },
      { id: "moving_average", term: "Moving average", means: "The average price over the last N days, drawn as a line. Price above its 200-day average is often read as a long-term uptrend.", where: ["NVDA GP", companyPath("NVDA", "Chart")] },
      { id: "rsi", term: "RSI (relative strength index)", means: "A 0–100 gauge of how strongly a stock has risen or fallen recently.", rule: "Above 70 is often called overbought, below 30 oversold." },
      { id: "volatility", term: "Volatility and max drawdown", means: "Volatility is how much the price swings, scaled to a year. Max drawdown is the biggest fall from a high to a later low." },
      { id: "beta", term: "Beta", means: "How much a stock tends to move with the market. 1.5 means it has typically moved 1.5% when the market moved 1%." },
      { id: "earnings_surprise", term: "Earnings surprise", means: "Reported earnings per share compared with what analysts expected. Beats and misses often move the price on the day.", where: ["AAPL ANR", companyPath("AAPL", "Analysts")] },
      { id: "insiders", term: "Insider trading (legal)", means: "Executives and directors buying or selling their own company's shares, which they must report publicly.", rule: "Open-market buying is the stronger signal; selling often has personal reasons.", where: ["AAPL INS", companyPath("AAPL", "Insiders")] },
    ],
  },
];

const STEPS: { title: string; body: ReactNode }[] = [
  { title: "Start with a one-line call", body: <>"Buy Royal Bank, target $320 in 12 months, 12% upside." Judges want your recommendation in the first ten seconds.</> },
  { title: "Give 2–3 thesis points the market is missing", body: <>Each one is a claim plus a number: "Net interest margin is rising: 2.1% to 2.3% in a year." If everyone already agrees, it isn't a thesis. Check <span className="font-mono">DES</span>, <span className="font-mono">RATIO</span> and <span className="font-mono">FA</span>.</> },
  { title: "Show how you got the target", body: <>Use at least two methods (a DCF and peer multiples) and explain why they differ. The reverse DCF tells you what the current price already assumes. See <span className="font-mono">DCF</span>, <span className="font-mono">RV</span> and <span className="font-mono">SUM</span>.</> },
  { title: "Name the catalysts", body: <>What will make the market change its mind, and when? An earnings date, a product launch, a rate cut. Check <span className="font-mono">ANR</span> for the next report date and <span className="font-mono">CN</span> for news.</> },
  { title: "Own the risks", body: <>Say what would prove you wrong and which number you'd watch. Judges trust pitchers who know the bear case. The <span className="font-mono">HLTH</span> tab and "What the numbers say" help here.</> },
  { title: "Stress-test it before anyone else does", body: <>On the <span className="font-mono">PITCH</span> tab, press "Challenge my pitch" and Finch will push back the way a panel would. Fix the weak spots, then export the PDF.</> },
];

export default function Learn() {
  const { hash } = useLocation();
  useEffect(() => {
    document.title = "LEARN · How to pitch a stock · Value Finch";
  }, []);
  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    el?.scrollIntoView({ block: "center" });
    el?.classList.add("ring-2", "ring-accent");
    const t = setTimeout(() => el?.classList.remove("ring-2", "ring-accent"), 2500);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="mx-auto max-w-screen-2xl px-3 pt-3 pb-24">
      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="fkey">LEARN</span>
        <h1 className="text-lg">How to pitch a stock, and what every number means</h1>
      </div>

      <div className="grid gap-3 lg:grid-cols-[22rem_1fr]">
        <div className="lg:sticky lg:top-32 lg:self-start">
          <Panel title="How to pitch a stock" code="PITCH">
            <ol id="pitch" className="space-y-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-2.5 text-sm">
                  <span className="font-mono font-semibold text-accent">{i + 1}</span>
                  <div>
                    <div className="font-semibold">{s.title}</div>
                    <p className="mt-0.5 text-muted">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
            <Link to={companyPath("AAPL", "Pitch")} className="mt-4 inline-block rounded-sm bg-accent px-3 py-1.5 text-sm font-semibold text-on-accent hover:bg-accent-hover">
              Try it: build a pitch on Apple
            </Link>
          </Panel>
        </div>

        <div className="space-y-3">
          {GROUPS.map((g) => (
            <Panel key={g.title} title={g.title} bodyClass="">
              <dl className="divide-y divide-line/60">
                {g.terms.map((t) => (
                  <div key={t.id} id={t.id} className="scroll-mt-40 px-3 py-2.5 transition-shadow">
                    <dt className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{t.term}</span>
                      {t.where && (
                        <Link to={t.where[1]} className="font-mono text-xs text-accent hover:underline">
                          See it: {t.where[0]}
                        </Link>
                      )}
                    </dt>
                    <dd className="mt-0.5 text-sm text-muted">
                      {t.means}
                      {t.rule && (
                        <span className="mt-1 block text-ink">
                          <span className="text-xs font-semibold text-accent uppercase">Rule of thumb</span> {t.rule}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </Panel>
          ))}
        </div>
      </div>
      <AskFinch tab="Markets" />
    </div>
  );
}
