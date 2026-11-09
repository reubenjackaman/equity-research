# Value Finch

A project by Reuben Jackaman.

A free research terminal for US and Canadian (TSX) markets, in the style of a professional
market-data terminal: a command line (`AAPL GP`, `RY.TO DCF`, `WEI`), world markets, movers,
yield curves, economic data, an earnings calendar, a watchlist, and for each company an
overview, candlestick chart with technicals, statements, ratios, health scores, analyst
estimates, insider trades, news, DCF and comps, with an AI assistant (Ask Finch) beside every screen.

> For educational purposes only. Not investment advice.

## Status

| Phase | Feature | Status |
|---|---|---|
| 1 | Ticker search + company overview + price chart | ✅ Done |
| 2 | Financial statements (annual/quarterly, CSV/Excel export) | ✅ Done |
| 3 | Ratios with formulas and trend charts | ✅ Done |
| 4 | News | ✅ Done |
| 5 | DCF model + Excel export | ✅ Done |
| 6 | Comparable companies | ✅ Done |
| + | Summary tab (football field) and printable tear sheet | ✅ Done |
| + | Explore by sector on the home page, with filters | ✅ Done |
| + | Top bar: navigation, saved & recent companies, market strip | ✅ Done |
| + | One-server production mode (ready for hosting) | ✅ Done |
| + | Mystery Company daily game | ✅ Done |
| + | Terminal redesign: command line, function codes, market screens, chart, analysts, insiders | ✅ Done |

## Project layout

```
backend/
  main.py              API routes (FastAPI)
  data/                fetching + caching: yahoo.py, edgar.py, news.py, cache.py
  finance/             the finance logic: statements.py, ratios.py, dcf.py, comps.py
  exports/             Excel exports: excel.py (statements), dcf_excel.py (DCF with formulas)
  tests/               sanity checks against Apple's 10-K and the DCF workbook
frontend/src/
  pages/               Home, Company (tabs)
  components/          one file per tab + SearchBar, PriceChart, Sparkline, InfoTip
  api.ts               every call to the backend
```

## How it fits together

```
Browser (React, port 5173)  ──/api/...──▶  FastAPI (Python, port 8000)  ──▶  Yahoo Finance / SEC EDGAR / Finnhub
                                                     │
                                                     └── cache.sqlite (saved responses)
```

- **frontend/** is the website you see (React + Vite + Tailwind CSS).
- **backend/** fetches the data and does the finance math (Python + FastAPI).
- The backend saves every response in `backend/cache.sqlite` so repeat visits don't use up
  free-tier limits. Prices are kept 15 minutes and search results 1 day. Delete the file to force fresh data.

## Setup (one time)

You need **Python 3.11+** and **Node.js 20+**. Check with `python3 --version` and `node --version`.

### 1. Backend

```bash
cd backend
python3 -m venv .venv                 # creates an isolated Python environment for this project
source .venv/bin/activate             # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env                  # then open .env and fill in your values (see "API keys")
```

### 2. Frontend

```bash
cd frontend
npm install
```

## Running it

Open **two terminal windows**.

**Terminal 1: backend**
```bash
cd backend
source .venv/bin/activate
uvicorn main:app --reload
```

**Terminal 2: frontend**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:5173**. To stop either server, press `Ctrl+C`.

Tip: with `SHOW_DOCS=1` in `backend/.env`, http://localhost:8000/docs lists every backend route and lets you try them in the browser.

## Running it as one server (production mode)

For hosting online (or just to run a single process), the Python backend can serve the
website too, so everything lives at one address:

```bash
cd frontend
npm run build                         # creates frontend/dist (the finished website)
cd ../backend
source .venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8000
```

Then open http://localhost:8000. When `frontend/dist` exists, `main.py` serves it, and any
non-API address (like `/company/AAPL`) returns the website so links work directly. For a
hosting service such as Render, the same two steps become the build command
(`pip install -r backend/requirements.txt && cd frontend && npm ci && npm run build`) and
the start command (`cd backend && uvicorn main:app --host 0.0.0.0 --port $PORT`), with
`SEC_USER_AGENT` and `FINNHUB_API_KEY` set in the host's environment settings.

During development keep using the two-terminal setup above, which reloads as you edit.

**Hosting note: Yahoo blocks some requests from cloud servers.** On hosts like Render,
Yahoo's company-profile and screener endpoints often refuse requests (prices, history,
search and statements still work). The app falls back automatically:
- Company profile is rebuilt from price-chart data plus Finnhub (industry, market cap,
  beta, dividend yield) and Wikipedia (description). Analyst price targets aren't available.
- Comparable-company peers come from Finnhub.
- Explore uses a saved snapshot (`backend/data/screener_snapshot.json`). Refresh it from
  your own computer with `.venv/bin/python -m tools.make_screener_snapshot`.

`.venv/bin/python -m tests.check_server_fallbacks` simulates the blocked endpoints locally
and checks every page still works.

## API keys

Keys go in `backend/.env`, which is in `.gitignore` so it is never committed.

| Source | Used for | Key? | How to get it |
|---|---|---|---|
| Yahoo Finance (via `yfinance`) | Prices, profile, statements, search | No | Nothing to do |
| SEC EDGAR | 10 years of US annual statements | No key, but SEC asks for a name + email | Put your name and email in `SEC_USER_AGENT`. Without it the SEC rejects requests and the app falls back to Yahoo's ~4 years |
| Finnhub | Extra news: a month of company news with summaries (optional) | Yes, free | Sign up at https://finnhub.io/register and copy the key from your dashboard into `FINNHUB_API_KEY` |

Everything works without a Finnhub key. News then comes from Yahoo only (roughly the latest 30 articles). Set `SEC_USER_AGENT` to get 10 years of US history.

## Where the statement numbers come from

| Company | Annual | Quarterly |
|---|---|---|
| US-listed (SEC filer) | Last 10 years from SEC 10-K filings; gaps filled from Yahoo | Last ~5 quarters, Yahoo |
| TSX / other | Last ~4-5 years, Yahoo | Last ~5 quarters, Yahoo |

Hover any number in the app to see its source. The line-item mapping lives in
`backend/finance/statements.py`. To re-check the numbers against Apple's FY2024 10-K:

```bash
cd backend
.venv/bin/python -m tests.check_aapl_statements
```

Per-share figures and share counts are adjusted for stock splits. For example, Apple's FY2017
EPS from its pre-2020-split 10-K ($9.21) is shown as $2.30, so every year lines up with today's price.

## DCF model

`backend/finance/dcf.py` is an unlevered (free cash flow to the firm) DCF:

```
Unlevered FCF   = EBIT × (1 − tax rate) + D&A − Capex − Increase in working capital
Terminal value  = FCF in final year × (1 + g) ÷ (WACC − g)
Enterprise value = PV of forecast FCFs + PV of terminal value   (end-of-year discounting)
Equity value    = Enterprise value − Total debt + Cash & short-term investments
WACC            = E/V × (Rf + Beta × ERP) + D/V × Cost of debt × (1 − tax rate)
```

How the defaults are set (all editable in the app):

| Assumption | Default |
|---|---|
| Revenue growth | Year 1 = 3-year revenue CAGR, fading to terminal growth + 1% |
| EBIT margin | Latest year's margin, held flat |
| Tax, D&A, capex | 3-year averages (as % of revenue or pre-tax income) |
| Working capital | (Receivables + Inventory − Payables) ÷ Revenue, latest year |
| Risk-free rate | Today's 10-year US Treasury yield |
| Beta | Blume-adjusted: 0.67 × Yahoo beta + 0.33 |
| Equity risk premium | 5% |
| Cost of debt | Interest expense ÷ average debt; risk-free + 1.5% if not reported |
| Terminal growth | 2.5% |

**Excel export:** blue cells are inputs and everything else is a live formula, so changing
an input in Excel recalculates the forecast, valuation and sensitivity table. To confirm the
Excel formulas give exactly the same answer as the app:

```bash
cd backend
.venv/bin/pip install formulas
.venv/bin/python -m tests.check_dcf_excel
```

Simplifications to be aware of: end-of-year discounting (no mid-year convention), no stub
period, book value of debt, operating leases not added to debt, and stock-based compensation
not deducted from FCF. That last one flatters companies that pay heavily in stock. Banks and
insurers aren't supported, because "free cash flow to the firm" isn't meaningful for them.

## The terminal (November 2026)

The top bar is a command line. Type a ticker, a company name or a function code and press
Enter; press `/` (or Ctrl/Cmd+K) anywhere to jump to it. The codes live in
`frontend/src/functions.ts` and the full list is on the HELP screen.

| Code | Screen | Data |
|---|---|---|
| MKTS | Markets dashboard (home) | all of the below |
| WEI | World indices, currencies, commodities, crypto, yields | Yahoo, one batched download (`data/markets.py` `board`) |
| MOST | Gainers, losers, most traded among the 60 largest US and 60 largest TSX companies | Yahoo |
| GC | US and Canadian yield curves (now, 1 month and 1 year ago), 10Y-2Y spread, policy rates | FRED and Bank of Canada Valet API, no keys |
| ECO | US and Canadian inflation, unemployment, GDP, payrolls, policy rates, VIX | FRED and Bank of Canada |
| EVTS | Earnings calendar, next two weeks, companies over $10B | Finnhub |
| MON | Watchlist with quotes and 52-week range (saved in the browser) | Yahoo |
| EQS | Screener (the old Explore section) | Yahoo screener or snapshot |

Company functions (`AAPL GP` and so on): DES overview, GP chart (candles, moving averages,
Bollinger bands, volume, RSI, comparison with the S&P 500 or S&P/TSX, volatility and max
drawdown), FA financials, RATIO, HLTH health scores, ANR analyst ratings, price targets,
earnings surprises and next report (`finance/street.py`), INS insider trades from SEC Form 4
(Finnhub; TSX companies use their US listing and are flagged, since Canadian insiders file on
SEDI), CN news, DCF, RV comps, SUM summary. A ticker tape of world markets scrolls under the bar.

Ask Finch works on the market screens too: with no company, it reads the board, movers, curves,
economy and earnings calendar instead. Check everything with `python -m tests.check_terminal`.

## Pitch builder and teaching (November 2026)

Value Finch is aimed at students preparing stock pitches (classes, investment clubs, case competitions, interviews).

- **PITCH tab** (`frontend/src/components/PitchTab.tsx`, `pitch.ts`): recommendation, target, horizon, and four sections
  (thesis, catalysts, valuation, risks), saved in the browser. "Draft with Finch" writes a section from the site's data;
  "Challenge my pitch" reviews it like a judge (`finance/assistant.py` `draft` / `critique`, routes `/api/pitch/draft`
  and `/api/pitch/critique`, same limits as Ask Finch). Key numbers (DCF, comps, analyst target, priced-in growth) sit beside it.
- **Printable pitch and share links** (`pages/PitchDoc.tsx`, at `/company/AAPL/pitch`): a letter-size document with a
  football field including the pitch target. Share links carry the pitch, DCF assumptions and peers compressed after `#p=`,
  so nothing is stored on the server; the reader can save a copy to edit.
- **What the numbers say** (`finance/insights.py`, `/api/company/{t}/insights`): rule-based plain-English findings (no AI),
  each comparing a figure with peers, history, past growth, the 10-year yield or a published threshold.
- **LEARN** (`pages/Learn.tsx`): a six-step guide to pitching a stock and a glossary; findings link to their entry (`/learn#pe`).

Check with `python -m tests.check_pitch`.

## Usage counts

`backend/data/usage.py` counts page views, company pages opened and pitch actions (started, PDF, shared, copied),
plus Ask Finch questions, drafts and critiques. It's anonymous: daily visitors are a one-way hash of IP and browser
with a secret that changes daily and is never stored; no cookies; Do Not Track and Global Privacy Control are
respected. The browser sends events to `POST /api/track`; totals are at `GET /api/stats` (there's no page for them on the site).

Render's free plan wipes the disk on every restart, so on the live site counts go to a free Upstash Redis database.
Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` in Render's environment settings (never in code). Without
them, counts go to `backend/usage.sqlite`, which is fine locally but resets on Render.

## Analysis added in November 2026

- **What's priced in (reverse DCF)** on the DCF tab: `finance/dcf.py` `implied_growth()` scans then bisects for the flat
  revenue growth that makes the DCF value equal today's price. Check: `python -m tests.check_reverse_dcf`.
- **Health tab**: `finance/health.py` computes the Piotroski F-Score, Altman Z (1968), Beneish M (8-variable) and the
  accruals ratio from the annual statements. Check: `python -m tests.check_health`.
- **Valuation history** on the Summary tab: `finance/valuation_history.py` compares P/E, EV/EBITDA and P/S with their own
  fiscal-year average and standard deviation. Check: `python -m tests.check_valuation_history`.
- **Ask Finch**: `finance/assistant.py` gathers everything the site has on the company (ratios, competitors, DCF and
  reverse DCF, health scores, valuation history, Finnhub analyst ratings, news) and asks Google Gemini (`data/gemini.py`),
  which may add general knowledge and give a reasoned valuation view. No live web search: Google's free tier doesn't include it.
  Needs `GEMINI_API_KEY` in `backend/.env` locally and in Render's environment settings; without it the feature turns
  itself off. Limits: 200 questions a day site-wide, 20 a day and 5 a minute per visitor. Check: `python -m tests.check_assistant`.

## Speed on Render's free plan

`backend/data/warmup.py` runs only on Render. A minute after starting, and then every 5 minutes, the server visits its
own public address so the free plan doesn't put it to sleep (which would also empty the cache). Every 12 hours it
preloads the market screens and ~30 popular companies (and the competitors of the biggest), so first visits are fast. One always-on service uses about 744 of the free
plan's 750 monthly hours, so a second free service would run out of hours.

## Mystery Company (daily game)

A new hidden company every day at `/game`, with six guesses. Each guess shows clues comparing
it with the answer: sector, listing country, market cap, P/E, dividend yield and 1-year return.
It runs entirely on the saved snapshot (`backend/data/game.py`), so it works without Yahoo.
Answers are companies over $400B, taken in a fixed shuffled order so none repeats until all
have been used. To hand-pick a day's answer, add it to `OVERRIDES` in `game.py`. Progress and streaks are saved in each player's browser. Check the logic with
`.venv/bin/python -m tests.check_game`.

## Screener (EQS)

Browse US or TSX stocks by sector and industry, then filter by market cap, P/E, dividend
yield and revenue growth, and sort the results. It uses Yahoo Finance's free stock screener
(`backend/data/screener.py`). The filters are saved in the page address, so a filtered view
can be bookmarked. Notes:
- With no size chosen, companies under $300M are left out (pick "Micro" to see them), because
  very small companies often have unreliable data.
- For Canada, CDRs (Canadian receipts for US companies, like "APPLE CDR") and preferred
  shares are removed, so the list shows real Canadian companies.

## Summary tab and tear sheet

- **Football field**: one bar per valuation method, against today's price: 52-week range,
  analyst price targets, the DCF (WACC ±1%, terminal growth ±1%) and comps (middle half of
  the peer group on P/E, EV/EBITDA, P/S; P/B for banks). It uses the DCF assumptions and peer
  list you last chose on those tabs, which the app remembers for each company.
- **Tear sheet**: a one-page research summary. Click "Tear sheet (PDF)", then "Save as PDF /
  Print" and pick "Save as PDF" in the print dialog.

## Comparable companies

`backend/finance/comps.py` picks up to 5 peers from Yahoo's list of the largest companies
in the same industry:
- Peers smaller than 5% of the target are skipped. If fewer than 4 remain, the list is
  topped up with the largest companies in the same sector.
- Foreign companies that report in other currencies (usually US-listed ADRs) are left out
  of suggestions, because their per-share figures often don't line up.

You can add or remove peers in the app. Every multiple uses the same formulas as the Ratios
tab (TTM). The app also shows the target's implied share price at the peer median P/E,
EV/EBITDA, P/S and P/B.

## News

`backend/data/news.py` merges Yahoo Finance news, searched by both ticker and company name,
with Finnhub company news when a key is set. It removes duplicate stories and sorts
newest first. The **About** filter keeps articles whose headline names the company or its
ticker. **All mentions** also shows articles that only reference it.

## How ratios are calculated

All ratios are computed in `backend/finance/ratios.py` from the statements above. Each one
is written as numerator ÷ denominator so the app can show the exact inputs. Conventions:

- **Average balances** for ROE, ROA, ROIC, asset turnover, inventory turnover and DSO:
  (opening + closing) ÷ 2. The first year shows N/A.
- **ROIC** = Operating income × (1 − effective tax rate) ÷ average (Total debt + Equity − Cash).
  The tax rate is Income tax ÷ Pre-tax income, kept within 0-50% (21% if it can't be computed).
- **Enterprise value** = Market cap + Total debt − Cash − Short-term investments.
- **Historical valuation** uses the closing price on each fiscal year-end. **TTM** uses
  today's price. For US companies, TTM figures come from SEC filings as last fiscal year +
  this year-to-date − last year's same year-to-date. Otherwise they're the sum of Yahoo's
  last 4 quarters, which is skipped if Yahoo's data looks stale or has a copied quarter.
- **Not meaningful:** a zero or negative denominator shows N/A (e.g. P/E with a loss,
  CAGR from a negative starting value).
- **Currency mismatch:** if shares trade in a different currency than the company reports
  in, the price is converted at that date's exchange rate.

To re-check the formulas against hand calculations from Apple's FY2024 10-K:

```bash
cd backend
.venv/bin/python -m tests.check_aapl_ratios
```

Known limits:
- **Banks and insurers** (e.g. JPM) don't have gross profit, current assets and so on, so those rows show N/A.
- Some companies use their own custom XBRL tags for a few years (e.g. NVIDIA's capex for FY2017-21). Those cells show N/A.
- Some companies report in a different currency than their shares trade in (e.g. Shopify reports in USD but trades in CAD on the TSX). The app shows a warning when that happens.

## Troubleshooting

- **"Data provider error" / 429 errors:** Yahoo occasionally throttles requests. Wait a minute
  and retry. Cached tickers keep working.
- **A TSX ticker isn't found:** TSX symbols need the `.TO` suffix (`RY.TO`), TSX Venture `.V`.
- **Page loads but shows no data:** make sure the backend terminal is running.
