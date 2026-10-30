"""
Financial ratios, calculated from the standardized statements (not pulled pre-made).

Every ratio is written as   numerator ÷ denominator (× multiplier)
so the app can show the exact inputs behind each number, e.g. "180,683 ÷ 391,035".

Conventions (these are choices; other sources may differ slightly):
  - Return and turnover ratios (ROE, ROA, ROIC, asset/inventory turnover, DSO) use the
    AVERAGE of the opening and closing balance, because the income-statement figure is
    earned over the whole year. The first year therefore shows N/A (no opening balance).
  - If a denominator is zero or negative the ratio is "not meaningful" and shows N/A
    (e.g. P/E with negative earnings, ROE with negative equity).
  - Historical valuation ratios use the closing share price on the fiscal year-end date.
    The final "TTM" column uses today's price and trailing-twelve-month figures with the
    latest balance sheet. For US companies TTM comes from SEC 10-Q/10-K filings
    (last fiscal year + year-to-date − prior year-to-date); otherwise it's the sum of the
    last 4 quarters from Yahoo.
  - If the company reports in a different currency than its shares trade in (Shopify:
    reports USD, trades CAD on the TSX), the share price is converted to the reporting
    currency at that date's exchange rate before computing valuation ratios.
"""

from datetime import date, timedelta

from data import yahoo
from data.cache import MINUTE, cached
from finance import statements

MILLION = 1e6
DEFAULT_TAX_RATE = 0.21  # US federal statutory rate, used when the effective rate can't be computed


class Period:
    """Values for one column. Missing attributes read as None instead of raising."""

    def __init__(self, values: dict, market: dict | None = None):
        self.__dict__.update(values)
        self.__dict__.update(market or {})

    def __getattr__(self, _name):
        return None


def avg(a, b):
    return (a + b) / 2 if a is not None and b is not None else None


def add(*xs):
    return sum(xs) if all(x is not None for x in xs) else None


def sub(a, b):
    return a - b if a is not None and b is not None else None


def tax_rate(c):
    """Effective tax rate = Income tax ÷ Pre-tax income, kept within 0-50%."""
    if c.income_tax is not None and c.pretax_income and c.pretax_income > 0:
        return min(max(c.income_tax / c.pretax_income, 0.0), 0.5)
    return DEFAULT_TAX_RATE


def nopat(c):
    return c.operating_income * (1 - tax_rate(c)) if c.operating_income is not None else None


def invested_capital(c):
    if c.total_equity is None or c.total_debt is None:
        return None
    return c.total_debt + c.total_equity - (c.cash or 0)


def enterprise_value(c):
    if c.market_cap is None:
        return None
    return c.market_cap + (c.total_debt or 0) - (c.cash or 0) - (c.short_term_investments or 0)


# Each ratio: key, label, category, display format, formula text, one-line explanation,
#   numerator (fn of current c, previous p, input kind), denominator (same), multiplier.
# Input kinds control how inputs are printed: "m" = money in millions, "ps" = per-share, "x" = plain.
RATIOS = [
    # Profitability
    ("gross_margin", "Gross margin", "Profitability", "pct", "Gross profit ÷ Revenue",
     "Share of each sales dollar left after the direct cost of the goods or services sold.",
     (lambda c, p: c.gross_profit, "m"), (lambda c, p: c.revenue, "m"), 100),
    ("operating_margin", "Operating margin", "Profitability", "pct", "Operating income ÷ Revenue",
     "Profit from core operations per sales dollar, before interest and taxes.",
     (lambda c, p: c.operating_income, "m"), (lambda c, p: c.revenue, "m"), 100),
    ("net_margin", "Net margin", "Profitability", "pct", "Net income ÷ Revenue",
     "Bottom-line profit kept from each sales dollar after all expenses, interest and taxes.",
     (lambda c, p: c.net_income, "m"), (lambda c, p: c.revenue, "m"), 100),
    ("roe", "Return on equity (ROE)", "Profitability", "pct", "Net income ÷ Average shareholders' equity",
     "Profit generated on the shareholders' book investment. Buybacks shrink equity and can inflate it.",
     (lambda c, p: c.net_income, "m"), (lambda c, p: avg(c.total_equity, p.total_equity), "m"), 100),
    ("roa", "Return on assets (ROA)", "Profitability", "pct", "Net income ÷ Average total assets",
     "How much profit the company squeezes out of everything it owns.",
     (lambda c, p: c.net_income, "m"), (lambda c, p: avg(c.total_assets, p.total_assets), "m"), 100),
    ("roic", "Return on invested capital (ROIC)", "Profitability", "pct",
     "Operating income × (1 − tax rate) ÷ Average (Total debt + Equity − Cash)",
     "After-tax operating return on the capital lenders and shareholders put in. Compare it with WACC.",
     (lambda c, p: nopat(c), "m"), (lambda c, p: avg(invested_capital(c), invested_capital(p)), "m"), 100),
    # Liquidity
    ("current_ratio", "Current ratio", "Liquidity", "x", "Current assets ÷ Current liabilities",
     "Ability to cover bills due within a year with assets that turn into cash within a year.",
     (lambda c, p: c.current_assets, "m"), (lambda c, p: c.current_liabilities, "m"), 1),
    ("quick_ratio", "Quick ratio", "Liquidity", "x",
     "(Cash + Short-term investments + Receivables) ÷ Current liabilities",
     "Stricter current ratio that leaves out inventory, which may be slow to sell.",
     (lambda c, p: add(c.cash, c.short_term_investments or 0, c.receivables or 0), "m"),
     (lambda c, p: c.current_liabilities, "m"), 1),
    # Leverage
    ("debt_to_equity", "Debt-to-equity", "Leverage", "x", "Total debt ÷ Shareholders' equity",
     "How much the company relies on borrowing versus shareholder money.",
     (lambda c, p: c.total_debt, "m"), (lambda c, p: c.total_equity, "m"), 1),
    ("interest_coverage", "Interest coverage", "Leverage", "x", "Operating income (EBIT) ÷ Interest expense",
     "How many times operating profit covers the interest bill. Below ~2x is a warning sign.",
     (lambda c, p: c.operating_income, "m"), (lambda c, p: c.interest_expense, "m"), 1),
    # Efficiency
    ("asset_turnover", "Asset turnover", "Efficiency", "x", "Revenue ÷ Average total assets",
     "Sales generated per dollar of assets. Higher means the asset base works harder.",
     (lambda c, p: c.revenue, "m"), (lambda c, p: avg(c.total_assets, p.total_assets), "m"), 1),
    ("inventory_turnover", "Inventory turnover", "Efficiency", "x", "Cost of revenue ÷ Average inventory",
     "How many times a year inventory is sold and replaced.",
     (lambda c, p: c.cost_of_revenue, "m"), (lambda c, p: avg(c.inventory, p.inventory), "m"), 1),
    ("dso", "Days sales outstanding (DSO)", "Efficiency", "days", "Average receivables ÷ Revenue × 365",
     "Average number of days customers take to pay.",
     (lambda c, p: avg(c.receivables, p.receivables), "m"), (lambda c, p: c.revenue, "m"), 365),
    # Valuation
    ("pe", "P/E", "Valuation", "x", "Share price ÷ Diluted EPS",
     "Dollars investors pay for each dollar of annual earnings.",
     (lambda c, p: c.price, "ps"), (lambda c, p: c.eps_diluted, "ps"), 1),
    ("pb", "P/B", "Valuation", "x", "Market cap ÷ Shareholders' equity",
     "Price relative to the accounting value of equity.",
     (lambda c, p: c.market_cap, "m"), (lambda c, p: c.total_equity, "m"), 1),
    ("ps", "P/S", "Valuation", "x", "Market cap ÷ Revenue",
     "Price relative to sales. Useful when earnings are negative.",
     (lambda c, p: c.market_cap, "m"), (lambda c, p: c.revenue, "m"), 1),
    ("ev_ebitda", "EV/EBITDA", "Valuation", "x",
     "(Market cap + Total debt − Cash − Short-term investments) ÷ EBITDA",
     "Whole-business value relative to cash operating profit. Neutral to how the company is financed.",
     (lambda c, p: enterprise_value(c), "m"), (lambda c, p: c.ebitda, "m"), 1),
    ("fcf_yield", "FCF yield", "Valuation", "pct", "Free cash flow ÷ Market cap",
     "Cash the business generates per dollar of market value, like an earnings yield in cash.",
     (lambda c, p: c.fcf, "m"), (lambda c, p: c.market_cap, "m"), 100),
    # Growth (year over year)
    ("revenue_growth", "Revenue growth", "Growth", "pct", "(Revenue − Prior-year revenue) ÷ Prior-year revenue",
     "How fast sales grew versus the previous year.",
     (lambda c, p: sub(c.revenue, p.revenue), "m"), (lambda c, p: p.revenue, "m"), 100),
    ("eps_growth", "EPS growth", "Growth", "pct", "(Diluted EPS − Prior-year EPS) ÷ Prior-year EPS",
     "Growth in earnings per share, which includes the effect of buybacks.",
     (lambda c, p: sub(c.eps_diluted, p.eps_diluted), "ps"), (lambda c, p: p.eps_diluted, "ps"), 100),
    ("fcf_growth", "FCF growth", "Growth", "pct", "(FCF − Prior-year FCF) ÷ Prior-year FCF",
     "Growth in free cash flow. Lumpy because capex timing varies.",
     (lambda c, p: sub(c.fcf, p.fcf), "m"), (lambda c, p: p.fcf, "m"), 100),
]

CAGR_ITEMS = [("revenue", "Revenue", "m"), ("eps_diluted", "Diluted EPS", "ps"), ("fcf", "Free cash flow", "m")]


def _fmt_input(v, kind):
    if kind == "m":
        return f"{v / MILLION:,.0f}"
    if kind == "ps":
        return f"{v:,.2f}"
    return f"{v:,.2f}"


def _compute(ratio, c: Period, p: Period):
    _k, _l, _cat, _fmt, _f, _e, (num_fn, num_kind), (den_fn, den_kind), mult = ratio
    num, den = num_fn(c, p), den_fn(c, p)
    if num is None or den is None or den <= 0:
        return None, None
    calc = f"{_fmt_input(num, num_kind)} ÷ {_fmt_input(den, den_kind)}" + (f" × {mult}" if mult == 365 else "")
    return num / den * mult, calc


def _period_values(data: dict, i: int) -> dict:
    return {row["key"]: row["values"][i] for rows in data["statements"].values() for row in rows}


def _price_on(closes: dict, on: str):
    """Closing price on the date, or the last trading day before it (within 10 days)."""
    d = date.fromisoformat(on)
    for back in range(11):
        key = (d - timedelta(days=back)).isoformat()
        if key in closes:
            return closes[key]
    return None


def _ttm(quarterly: dict) -> tuple[dict, dict] | tuple[None, None]:
    """Trailing twelve months: flows summed over the last 4 quarters, balance sheet from the
    latest quarter. Also returns the balance sheet from 4 quarters earlier (for averages)."""
    n = len(quarterly["columns"])
    if n < 4:
        return None, None
    current, prior = {}, {}
    for name, rows in quarterly["statements"].items():
        for row in rows:
            vals = row["values"]
            if name == "balance":
                current[row["key"]] = vals[-1]
                prior[row["key"]] = vals[-5] if n >= 5 else None
            elif row["format"] == "shares":
                current[row["key"]] = vals[-1]
            else:
                last4 = vals[-4:]
                current[row["key"]] = sum(last4) if all(v is not None for v in last4) else None
    # Yahoo sometimes lacks a quarter's EPS; fall back to TTM net income ÷ latest diluted shares.
    if current.get("eps_diluted") is None and current.get("net_income") is not None and current.get("shares_diluted"):
        current["eps_diluted"] = current["net_income"] / current["shares_diluted"]
    return current, prior


def _yahoo_quarters_ok(quarterly: dict) -> bool:
    """Reject Yahoo quarterly data that is stale or has a copied quarter (seen for Amazon:
    Dec 2025 was an exact copy of Sep 2025, and the latest two quarters were missing)."""
    cols = quarterly["columns"]
    if not cols or (date.today() - date.fromisoformat(cols[-1]["end"])).days > 200:
        return False
    inc = {r["key"]: r["values"] for r in quarterly["statements"]["income"]}
    pairs = list(zip(inc["revenue"][-4:], inc["net_income"][-4:]))
    return not any(a == b and a[0] is not None for a, b in zip(pairs, pairs[1:]))


def _best_ttm(ticker: str, notes: list):
    """TTM from SEC 10-Q/10-K filings when available (US companies), otherwise Yahoo quarters.

    Some companies don't tag every line item in their 10-Qs (Galaxy Digital has no
    quarterly operating income), so gaps in the SEC figures are filled from Yahoo's
    last 4 quarters when Yahoo covers the same period.
    """
    sec = None
    try:
        sec = statements.sec_ttm(ticker)
    except Exception as exc:
        print(f"[ratios] SEC TTM unavailable for {ticker}: {exc}")
    fresh = sec and (date.today() - date.fromisoformat(sec["end"])).days <= 200
    use_sec = fresh and sec["current"].get("revenue") is not None and sec["current"].get("net_income") is not None

    yahoo_current = yahoo_prior = yahoo_end = None
    try:
        quarterly = statements.build(ticker, "quarterly")
        if _yahoo_quarters_ok(quarterly):
            yahoo_current, yahoo_prior = _ttm(quarterly)
            yahoo_end = quarterly["columns"][-1]["end"]
        elif not use_sec:
            notes.append("Yahoo's quarterly data for this company looks stale or duplicated, so no TTM column is shown.")
    except Exception:
        pass

    if not use_sec:
        if not yahoo_current:
            return None, None, None, None
        return yahoo_current, yahoo_prior, yahoo_end, "the last 4 quarters reported to Yahoo Finance"

    current, prior = dict(sec["current"]), dict(sec["prior"])
    source = "SEC 10-Q/10-K filings (last fiscal year + year-to-date − prior year-to-date)"
    same_period = yahoo_current and abs((date.fromisoformat(yahoo_end) - date.fromisoformat(sec["end"])).days) <= 15
    if same_period:
        filled = [k for k, v in yahoo_current.items() if current.get(k) is None and v is not None]
        for k in filled:
            current[k] = yahoo_current[k]
        for k, v in (yahoo_prior or {}).items():
            if prior.get(k) is None and v is not None:
                prior[k] = v
        if filled:
            # Recalculate the formula rows now that their inputs may be complete.
            for k in ("ebitda", "total_debt", "fcf"):
                current[k] = statements._calculate(k, current)
                prior[k] = statements._calculate(k, prior)
            source += ", with gaps filled from Yahoo's last 4 quarters"
    if current.get("eps_diluted") is None and current.get("net_income") is not None and current.get("shares_diluted"):
        current["eps_diluted"] = current["net_income"] / current["shares_diluted"]
    return current, prior, sec["end"], source


# Gaps of 2-3x are left alone: dual-class companies (e.g. Galaxy Digital) legitimately differ by that much.
CLEAN_RATIOS = [4, 5, 6, 8, 10, 12, 15, 20, 25, 30, 40, 50, 100, 200, 250, 500, 1000, 1500, 2000]


def share_normalizer(overview: dict):
    """Returns a function that restates share counts and EPS in *traded* share units.

    Usually nothing changes. It matters when the listed security isn't one ordinary share:
      - Berkshire Hathaway: some figures are per Class A share; one A = 1,500 Class B (BRK-B).
      - Foreign companies trading in the US as ADRs: one TSMC ADR = 5 ordinary shares.
    Sources even mix the two (SEC counts ordinary shares, Yahoo counts ADRs), so every share
    count is checked on its own against today's traded share count (Yahoo market cap ÷
    price). Organic changes (buybacks, issuance) are far smaller than 4×, so a gap that is
    a clean multiple like 5× or 1,500× means a different unit, and we convert it.
    """
    cap, price = overview.get("marketCap"), overview.get("price")
    traded = cap / price if cap and price else None
    seen = set()

    def to_traded(count):
        if not traded or not count:
            return count
        ratio = traded / count
        if 0.27 < ratio < 3.7:
            return count
        observed = ratio if ratio > 1 else 1 / ratio
        clean = min(CLEAN_RATIOS, key=lambda c: abs(observed / c - 1))
        if abs(observed / clean - 1) > 0.07:  # Alibaba: 7.5 vs 8 (6.6%); Galaxy FY2023 growth: 5.4 vs 5 (8%, not a unit)
            return count  # not a clean multiple: more likely a data gap, leave it alone
        seen.add(clean if ratio > 1 else -clean)
        return count * clean if ratio > 1 else count / clean

    def normalize(values: dict) -> dict:
        out = dict(values)
        for key in ("shares_outstanding", "shares_diluted"):
            out[key] = to_traded(out.get(key))
        ni, shares, eps = out.get("net_income"), out.get("shares_diluted"), out.get("eps_diluted")
        if ni is not None and shares:
            implied = ni / shares
            # Reported EPS that disagrees with NI ÷ shares by >10% is in another unit (per ordinary share for an
            # ADR, per Class A share) or pieced together inconsistently, so use NI ÷ shares instead.
            if eps is None or implied == 0 or not 0.9 < eps / implied < 1.1:
                out["eps_diluted"] = implied
        return out

    def note():
        if not seen:
            return None
        c = max(seen, key=abs)
        if c > 0:
            return ("Some share counts were in a different unit from the traded shares (a share class worth "
                    f"{c:,} traded shares, like Berkshire Class A vs B, or a figure reported in thousands). "
                    "They were converted so per-share figures line up with the share price.")
        return (f"Each traded share (ADR) represents {-c} ordinary shares. Share counts and EPS were converted "
                f"to one ADR so they line up with its price.")

    return normalize, note


@cached("ratios", 15 * MINUTE)
def build(ticker: str) -> dict:
    annual = statements.build(ticker, "annual")
    overview = yahoo.overview(ticker)
    reporting_ccy = annual["currency"]
    trading_ccy = overview.get("currency") or reporting_ccy

    closes = yahoo.daily_closes(ticker)
    fx_closes, notes = None, []
    if trading_ccy != reporting_ccy:
        fx_closes = yahoo.daily_closes(f"{reporting_ccy}{trading_ccy}=X")
        notes.append(
            f"Shares trade in {trading_ccy} but the company reports in {reporting_ccy}. Share prices were "
            f"converted to {reporting_ccy} at each date's exchange rate before computing valuation ratios."
        )

    def market(values: dict, price_trading):
        if price_trading is None:
            return {}
        price = price_trading
        if fx_closes is not None:
            rate = _price_on(fx_closes, values["_date"])  # units of trading currency per 1 reporting currency
            price = price_trading / rate if rate else None
        if price is None:
            return {}
        shares = values.get("shares_outstanding") or values.get("shares_diluted")
        return {"price": price, "market_cap": price * shares if shares else None}

    normalize, share_note = share_normalizer(overview)

    # Build one Period per column: every annual year, then TTM.
    periods, columns = [], []
    for i, col in enumerate(annual["columns"]):
        values = normalize(_period_values(annual, i)) | {"_date": col["end"]}
        periods.append(Period(values, market(values, _price_on(closes, col["end"]))))
        columns.append({"label": col["label"], "end": col["end"]})

    ttm, prior_ttm, ttm_end, ttm_source = _best_ttm(ticker, notes)
    if ttm:
        ttm = normalize(ttm)
        ttm["_date"] = date.today().isoformat()
        periods.append(Period(ttm, market(ttm, overview.get("price"))))
        columns.append({"label": "TTM", "end": ttm_end})
        notes.append(f"TTM = twelve months to {ttm_end}, from {ttm_source}.")

    if share_note():
        notes.append(share_note())

    ratio_rows = []
    for ratio in RATIOS:
        key, label, category, fmt, formula, explanation = ratio[:6]
        values, calcs = [], []
        for i, c in enumerate(periods):
            is_ttm = ttm is not None and i == len(periods) - 1
            if is_ttm:
                p = Period(prior_ttm or {})
                # Year-over-year growth needs the same TTM a year earlier, which Yahoo doesn't provide.
                if category == "Growth":
                    values.append(None)
                    calcs.append(None)
                    continue
            else:
                p = periods[i - 1] if i > 0 else Period({})
            v, calc = _compute(ratio, c, p)
            values.append(v)
            calcs.append(calc)
        ratio_rows.append({
            "key": key, "label": label, "category": category, "format": fmt,
            "formula": formula, "explanation": explanation, "values": values, "calcs": calcs,
        })

    by_key = {r["key"]: r for r in ratio_rows}
    margins = [v for v in by_key["gross_margin"]["values"] if v is not None]
    if margins and abs(sorted(margins)[len(margins) // 2]) < 2:
        notes.append(
            "Gross margin is close to zero, which usually means reported revenue includes the full value of assets "
            "the company buys and sells (e.g. crypto or commodity trading). Revenue-based ratios such as margins, "
            "P/S and asset turnover are then not very meaningful. Focus on ROE, P/B and P/E instead."
        )
    if all(v is None for v in by_key["current_ratio"]["values"]) and any(v is not None for v in by_key["roe"]["values"]):
        notes.append(
            "This company doesn't report current assets/liabilities or gross profit (typical of banks and "
            "insurers), so several industrial-company ratios show N/A. For banks, focus on ROE, ROA, P/E and P/B."
        )
    # Raw inputs behind the latest column (TTM if available), used by the comps page
    # to turn peer multiples into implied share prices.
    last_period = periods[-1]
    fx_now = fx_closes[max(fx_closes)] if fx_closes else 1.0
    snapshot = {
        "label": columns[-1]["label"],
        "price": last_period.price,
        "marketCap": last_period.market_cap,
        "enterpriseValue": enterprise_value(last_period),
        "eps": last_period.eps_diluted,
        "ebitda": last_period.ebitda,
        "revenue": last_period.revenue,
        "equity": last_period.total_equity,
        "shares": last_period.shares_outstanding or last_period.shares_diluted,
        "fx": fx_now,  # trading currency per 1 reporting currency
        "tradingCurrency": trading_ccy,
    }

    return {
        "symbol": ticker,
        "currency": reporting_ccy,
        "snapshot": snapshot,
        "columns": columns,
        "ratios": ratio_rows,
        "cagr": _cagrs(annual),
        "notes": notes,
        "source": annual["source"],
    }


def _cagrs(annual: dict) -> list:
    """Compound annual growth rate over the last 3 and 5 fiscal years."""
    labels = [c["label"] for c in annual["columns"]]
    values = {row["key"]: row["values"] for rows in annual["statements"].values() for row in rows}
    out = []
    for key, label, kind in CAGR_ITEMS:
        series = values[key]
        item = {"key": key, "label": f"{label} CAGR", "formula": "(Ending value ÷ Starting value)^(1 ÷ years) − 1"}
        for years in (3, 5):
            result = None
            if len(series) > years:
                start, end = series[-1 - years], series[-1]
                if start is not None and end is not None and start > 0 and end > 0:
                    result = {
                        "value": ((end / start) ** (1 / years) - 1) * 100,
                        "calc": f"({_fmt_input(end, kind)} ÷ {_fmt_input(start, kind)})^(1/{years}) − 1",
                        "span": f"{labels[-1 - years]}–{labels[-1]}",
                    }
            item[f"cagr{years}"] = result
        out.append(item)
    return out
