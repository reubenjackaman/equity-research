"""
Discounted cash flow (DCF) model: unlevered free cash flow to the firm, discounted at WACC.

    Revenue_t        = Revenue_(t-1) × (1 + growth_t)
    EBIT_t           = Revenue_t × EBIT margin_t
    NOPAT_t          = EBIT_t × (1 − tax rate)
    Unlevered FCF_t  = NOPAT_t + D&A_t − Capex_t − ΔNWC_t
    PV_t             = FCF_t ÷ (1 + WACC)^t                    (end-of-year discounting)
    Terminal value   = FCF_N × (1 + g) ÷ (WACC − g)            (Gordon growth)
    Enterprise value = Σ PV_t + Terminal value ÷ (1 + WACC)^N
    Equity value     = Enterprise value − Total debt + Cash + Short-term investments
    Value per share  = Equity value ÷ Diluted shares

Revenue growth fades in a straight line from the Year-1 rate to the final-year rate.
EBIT margin moves in a straight line from the last actual margin to the target margin.

WACC (CAPM):
    Cost of equity = Risk-free rate + Beta × Equity risk premium
    Beta default   = 0.67 × raw beta + 0.33 × 1.0   (Blume adjustment: betas drift toward 1 over time)
    WACC           = E/(D+E) × Cost of equity + D/(D+E) × Cost of debt × (1 − tax rate)
    E = market cap, D = total debt (book value)

All rates are decimals (0.05 = 5%). Money is in the company's reporting currency.
The Excel export (exports/dcf_excel.py) writes these same formulas into cells.
"""

from statistics import mean

import yfinance as yf

from data import yahoo
from data.cache import MINUTE, cached
from finance import ratios, statements

HISTORY_YEARS = 3
DEFAULT_ERP = 0.05            # equity risk premium; long-run US estimates are roughly 4-6%
DEFAULT_TERMINAL_GROWTH = 0.025
DEFAULT_RISK_FREE = 0.045     # used only if the 10-year Treasury yield can't be fetched

ASSUMPTION_KEYS = [
    "years", "growth_start", "growth_end", "margin_target", "tax_rate", "da_pct", "capex_pct",
    "nwc_pct", "terminal_growth", "risk_free", "beta", "erp", "cost_of_debt", "wacc_override",
]


class DcfNotSupported(ValueError):
    pass


def _clamp(x, lo, hi):
    return max(lo, min(hi, x))


def _nwc(v: dict):
    """Operating working capital = Receivables + Inventory − Accounts payable."""
    parts = [v.get("receivables"), v.get("inventory"), v.get("accounts_payable")]
    if all(p is None for p in parts):
        return None
    return (parts[0] or 0) + (parts[1] or 0) - (parts[2] or 0)


@cached("dcf-base", 15 * MINUTE)
def base_data(ticker: str) -> dict:
    """Everything the model needs from history and the market, gathered once."""
    annual = statements.build(ticker, "annual")
    overview = yahoo.overview(ticker)
    cols = annual["columns"]
    vals = {row["key"]: row["values"] for rows in annual["statements"].values() for row in rows}

    # Last few fiscal years that have revenue and operating income.
    idx = [i for i in range(len(cols)) if vals["revenue"][i] and vals["operating_income"][i] is not None]
    idx = idx[-(HISTORY_YEARS + 1):]  # one extra year so growth can be computed for the first shown year
    if len(idx) < 2:
        raise DcfNotSupported(
            "A free-cash-flow DCF needs revenue and operating income, which this company doesn't report "
            "(typical of banks and insurers). Those are usually valued with P/B, P/E or a dividend discount model."
        )

    history = []
    for i in idx:
        v = {k: vals[k][i] for k in vals}
        history.append({
            "label": cols[i]["label"],
            "revenue": v["revenue"],
            "ebit": v["operating_income"],
            "tax": v["income_tax"],
            "pretax": v["pretax_income"],
            "da": v["dna"],
            "capex": -v["capex"] if v["capex"] is not None else None,  # shown as a positive outflow
            "nwc": _nwc(v),
            "interest": v["interest_expense"],
            "debt": v["total_debt"],
        })

    # Balance sheet and share count: use the latest quarter (more current than the last 10-K).
    # US companies: SEC 10-Q. Others: Yahoo's latest quarter. Fallback: last annual report.
    latest = {k: vals[k][-1] for k in vals}
    balance_label = cols[-1]["label"]
    try:
        sec = statements.sec_ttm(ticker)
    except Exception:
        sec = None
    if sec and sec["current"].get("total_assets") is not None:
        latest, balance_label = sec["current"], sec["end"]
    else:
        try:
            q = statements.build(ticker, "quarterly")
            qv = {row["key"]: row["values"][-1] for rows in q["statements"].values() for row in rows}
            if qv.get("total_assets") is not None:
                latest, balance_label = qv, q["columns"][-1]["label"]
        except Exception:
            pass

    reporting_ccy = annual["currency"]
    trading_ccy = overview.get("currency") or reporting_ccy
    fx = 1.0  # units of trading currency per 1 unit of reporting currency
    if trading_ccy != reporting_ccy:
        closes = yahoo.daily_closes(f"{reporting_ccy}{trading_ccy}=X")
        fx = closes[max(closes)]

    try:
        risk_free = yf.Ticker("^TNX").history(period="5d")["Close"].iloc[-1] / 100
    except Exception:
        risk_free = DEFAULT_RISK_FREE

    shares = latest.get("shares_outstanding") or latest.get("shares_diluted") or vals["shares_diluted"][-1]
    normalize, share_note = ratios.share_normalizer(overview)  # ADRs, Berkshire A vs B
    shares = normalize({"shares_diluted": shares})["shares_diluted"]
    share_note = share_note()
    price_reporting = overview["price"] / fx if overview.get("price") else None
    return {
        "symbol": ticker,
        "name": overview["name"],
        "currency": reporting_ccy,
        "tradingCurrency": trading_ccy,
        "fx": fx,
        "price": price_reporting,           # in reporting currency
        "priceTrading": overview.get("price"),
        "beta": overview.get("beta"),
        "riskFree": float(risk_free),
        "history": history,
        "balance": {
            "label": balance_label,
            "debt": latest.get("total_debt") or 0,
            "cash": (latest.get("cash") or 0) + (latest.get("short_term_investments") or 0),
            "shares": shares,
        },
        "marketCap": price_reporting * shares if price_reporting and shares else None,
        "shareNote": share_note,
        "source": annual["source"],
    }


def defaults(base: dict) -> dict:
    """Starting assumptions, based on the last 3 fiscal years and today's market data."""
    h = base["history"][-HISTORY_YEARS:]
    full = base["history"]

    def avg(items):
        items = [x for x in items if x is not None]
        return mean(items) if items else None

    first, last = full[0], full[-1]
    years_span = len(full) - 1
    cagr = (last["revenue"] / first["revenue"]) ** (1 / years_span) - 1 if first["revenue"] > 0 and last["revenue"] > 0 else 0.05
    growth_start = _clamp(cagr, -0.05, 0.25)
    terminal = DEFAULT_TERMINAL_GROWTH

    tax = avg([x["tax"] / x["pretax"] for x in h if x["tax"] is not None and x["pretax"] and x["pretax"] > 0])
    tax = _clamp(tax, 0.05, 0.35) if tax is not None else 0.21

    avg_debt = avg([x["debt"] for x in full[-2:]])
    kd = last["interest"] / avg_debt if last["interest"] and avg_debt else None
    kd = _clamp(kd, 0.02, 0.12) if kd else base["riskFree"] + 0.015

    return {
        "years": 5,
        "growth_start": round(growth_start, 4),
        "growth_end": round(min(growth_start, terminal + 0.01) if growth_start > terminal else growth_start, 4),
        "margin_target": round(last["ebit"] / last["revenue"], 4),  # hold the latest margin; edit to model change
        "tax_rate": round(tax, 4),
        "da_pct": round(avg([x["da"] / x["revenue"] for x in h if x["da"] is not None]) or 0.0, 4),
        "capex_pct": round(avg([x["capex"] / x["revenue"] for x in h if x["capex"] is not None]) or 0.0, 4),
        "nwc_pct": round(last["nwc"] / last["revenue"], 4) if last["nwc"] is not None else 0.0,
        "terminal_growth": terminal,
        "risk_free": round(base["riskFree"], 4),
        "beta": round(0.67 * base["beta"] + 0.33, 2) if base.get("beta") else 1.0,  # Blume-adjusted
        "erp": DEFAULT_ERP,
        "cost_of_debt": round(kd, 4),
        "wacc_override": None,
    }


def wacc_breakdown(base: dict, a: dict) -> dict:
    cost_of_equity = a["risk_free"] + a["beta"] * a["erp"]
    e = base["marketCap"] or 0
    d = base["balance"]["debt"] or 0
    we = e / (e + d) if e + d > 0 else 1.0
    after_tax_kd = a["cost_of_debt"] * (1 - a["tax_rate"])
    computed = we * cost_of_equity + (1 - we) * after_tax_kd
    return {
        "costOfEquity": cost_of_equity,
        "afterTaxCostOfDebt": after_tax_kd,
        "equityWeight": we,
        "debtWeight": 1 - we,
        "computed": computed,
        "used": a["wacc_override"] if a.get("wacc_override") is not None else computed,
    }


def run(base: dict, a: dict) -> dict:
    years = int(_clamp(int(a["years"]), 3, 10))
    w = wacc_breakdown(base, a)
    wacc, g = w["used"], a["terminal_growth"]

    last = base["history"][-1]
    m0 = last["ebit"] / last["revenue"]
    prev_rev = last["revenue"]
    prev_nwc = last["nwc"] if last["nwc"] is not None else last["revenue"] * a["nwc_pct"]

    forecast = []
    for t in range(1, years + 1):
        growth = a["growth_start"] + (a["growth_end"] - a["growth_start"]) * (t - 1) / (years - 1)
        revenue = prev_rev * (1 + growth)
        margin = m0 + (a["margin_target"] - m0) * t / years
        ebit = revenue * margin
        taxes = ebit * a["tax_rate"]
        nopat = ebit - taxes
        da = revenue * a["da_pct"]
        capex = revenue * a["capex_pct"]
        nwc = revenue * a["nwc_pct"]
        d_nwc = nwc - prev_nwc
        fcf = nopat + da - capex - d_nwc
        discount = 1 / (1 + wacc) ** t
        forecast.append({
            "label": f"Year {t}", "revenue": revenue, "growth": growth, "margin": margin, "ebit": ebit,
            "taxes": taxes, "nopat": nopat, "da": da, "capex": capex, "nwc": nwc, "dNwc": d_nwc,
            "fcf": fcf, "discount": discount, "pv": fcf * discount,
        })
        prev_rev, prev_nwc = revenue, nwc

    valuation = _value(base, forecast, wacc, g)
    sensitivity = _sensitivity(base, forecast, wacc, g)

    history = []
    for i, h in enumerate(base["history"][1:], start=1):
        prev = base["history"][i - 1]
        history.append({
            "label": h["label"], "revenue": h["revenue"], "growth": h["revenue"] / prev["revenue"] - 1 if prev["revenue"] else None,
            "margin": h["ebit"] / h["revenue"], "ebit": h["ebit"], "da": h["da"], "capex": h["capex"], "nwc": h["nwc"],
            "dNwc": h["nwc"] - prev["nwc"] if h["nwc"] is not None and prev["nwc"] is not None else None,
        })

    return {"years": years, "wacc": w, "history": history, "forecast": forecast, "valuation": valuation, "sensitivity": sensitivity}


def _value(base: dict, forecast: list, wacc: float, g: float):
    """Enterprise value -> equity value -> value per share. None if WACC <= terminal growth."""
    if wacc <= g:
        return None
    n = len(forecast)
    pv_sum = sum(f["fcf"] / (1 + wacc) ** (t + 1) for t, f in enumerate(forecast))
    tv = forecast[-1]["fcf"] * (1 + g) / (wacc - g)
    pv_tv = tv / (1 + wacc) ** n
    ev = pv_sum + pv_tv
    b = base["balance"]
    equity = ev - b["debt"] + b["cash"]
    per_share = equity / b["shares"] if b["shares"] else None
    per_share_trading = per_share * base["fx"] if per_share is not None else None
    price = base["priceTrading"]
    return {
        "pvFcf": pv_sum, "terminalValue": tv, "pvTerminal": pv_tv, "enterpriseValue": ev,
        "debt": b["debt"], "cash": b["cash"], "equityValue": equity, "shares": b["shares"],
        "perShare": per_share, "perShareTrading": per_share_trading, "price": price,
        # Upside is meaningless when the model says the shares are worth less than nothing.
        "upside": per_share_trading / price - 1 if per_share_trading is not None and per_share_trading > 0 and price else None,
        "terminalShare": pv_tv / ev if ev else None,
    }


STEP = 0.005


def _sensitivity(base: dict, forecast: list, wacc: float, g: float) -> dict:
    """Value per share (trading currency) for WACC ±1% and terminal growth ±1%, in 0.5% steps.

    Changing WACC only changes discounting, so the forecast FCFs are reused as-is.
    """
    waccs = [wacc + STEP * k for k in range(-2, 3)]
    growths = [g + STEP * k for k in range(-2, 3)]
    grid = []
    for w in waccs:
        row = []
        for gg in growths:
            v = _value(base, forecast, w, gg)
            row.append(v["perShareTrading"] if v else None)
        grid.append(row)
    return {"waccs": waccs, "growths": growths, "values": grid}


def _warnings(base: dict, a: dict, result: dict) -> list:
    """Plain-English flags for results that need care."""
    out = []
    last = base["history"][-1]
    margin = last["ebit"] / last["revenue"]
    if margin < 0:
        out.append(f"The company is losing money (operating margin {margin:.0%}). Holding that margin flat keeps cash "
                   f"flow negative, so set the final-year EBIT margin to what you expect it to reach.")
    if all(f["fcf"] < 0 for f in result["forecast"]):
        out.append("Forecast free cash flow is negative in every year (capex and working capital exceed after-tax profit), "
                   "so the DCF gives little or no value. Check the capex and margin assumptions.")
    v = result["valuation"]
    if v and v["equityValue"] < 0 and v["enterpriseValue"] > 0:
        out.append(f"Debt ({v['debt'] / 1e9:,.1f}B) is larger than the value of the business ({v['enterpriseValue'] / 1e9:,.1f}B), "
                   "so equity value is negative. This happens with heavy borrowers and with holding companies that "
                   "consolidate their subsidiaries' debt (e.g. Brookfield), where a whole-group DCF doesn't fit well.")
    if v and v["terminalShare"] is not None and v["terminalShare"] > 0.85:
        out.append(f"{v['terminalShare']:.0%} of the value comes from the terminal value, so the result depends mostly on "
                   "terminal growth and WACC. Check the sensitivity table.")
    if v and v["perShareTrading"] and v["price"] and 0 < v["perShareTrading"] < 0.25 * v["price"]:
        out.append(f"The DCF value is under a quarter of today's price. With these assumptions (capex "
                   f"{a['capex_pct']:.0%} of revenue, growth fading to {a['growth_end']:.1%}) the business keeps little "
                   "free cash flow; the market is pricing in faster growth, higher margins or a lower discount rate.")
    if not base.get("beta"):
        out.append("Yahoo has no beta for this stock (usually too little trading history), so a beta of 1.0 is used.")
    if base.get("shareNote"):
        out.append(base["shareNote"])
    return out


def model(ticker: str, overrides: dict | None) -> dict:
    base = base_data(ticker)
    d = defaults(base)
    a = {k: d[k] for k in ASSUMPTION_KEYS}
    for k, v in (overrides or {}).items():
        if k in ASSUMPTION_KEYS and (v is not None or k == "wacc_override"):
            a[k] = v
    result = run(base, a)
    return {
        "symbol": base["symbol"],
        "name": base["name"],
        "currency": base["currency"],
        "tradingCurrency": base["tradingCurrency"],
        "fx": base["fx"],
        "price": base["priceTrading"],
        "balanceAsOf": base["balance"]["label"],
        "marketCap": base["marketCap"],
        "source": base["source"],
        "assumptions": a,
        "defaults": {k: d[k] for k in ASSUMPTION_KEYS},
        "warnings": _warnings(base, a, result),
        **result,
    }
