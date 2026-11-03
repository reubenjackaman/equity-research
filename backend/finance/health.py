"""
Financial health scorecard: four published models, calculated from the annual statements.

All use the latest fiscal year (t) against the year before (t-1). Money inputs are shown in millions.

Piotroski F-Score (Piotroski 2000, "Value Investing: The Use of Historical Financial Statement
Information to Separate Winners from Losers"). Nine pass/fail tests:
    Profitability  1 ROA > 0           ROA = Net income ÷ Total assets at the start of the year
                   2 CFO > 0
                   3 ROA higher than the year before
                   4 CFO ÷ start-of-year assets > ROA   (cash earnings exceed accounting earnings)
    Funding        5 Long-term debt ÷ Average total assets lower than the year before
                   6 Current ratio higher than the year before
                   7 No new shares issued (shares outstanding not higher than a year earlier)
    Efficiency     8 Gross margin higher than the year before
                   9 Asset turnover (Revenue ÷ start-of-year assets) higher than the year before

Altman Z-Score, original 1968 model for public manufacturers:
    Z = 1.2·X1 + 1.4·X2 + 3.3·X3 + 0.6·X4 + 1.0·X5
    X1 = Working capital ÷ Total assets         X2 = Retained earnings ÷ Total assets
    X3 = EBIT ÷ Total assets                     X4 = Market value of equity ÷ Total liabilities
    X5 = Revenue ÷ Total assets
    Zones: above 2.99 safe, 1.81 to 2.99 grey, below 1.81 distress.
    Market value of equity is taken at the fiscal year-end share price.

Beneish M-Score, 8-variable model (Beneish 1999, "The Detection of Earnings Manipulation"):
    M = −4.84 + 0.920·DSRI + 0.528·GMI + 0.404·AQI + 0.892·SGI + 0.115·DEPI − 0.172·SGAI
        + 4.679·TATA − 0.327·LVGI
    Above −1.78 suggests possible earnings manipulation.
    Depreciation uses the cash-flow statement's D&A, which includes amortization (an approximation).

Accruals ratio = (Net income − Operating cash flow) ÷ Average total assets.
"""

from data import yahoo
from data.cache import DAY, cached
from finance import ratios, statements

M = 1e6
FINANCIAL_SECTORS = {"Financial Services", "Financials"}


def _m(v):
    return f"{v / M:,.0f}"


def _x(v):
    return f"{v:,.3f}"


def _ok(*xs):
    return all(x is not None for x in xs)


def _div(a, b):
    return a / b if _ok(a, b) and b != 0 else None


def _piotroski(c: dict, p: dict, pp: dict) -> dict:
    """c = latest year, p = year before, pp = two years before (for p's start-of-year assets)."""
    roa_c, roa_p = _div(c["net_income"], p["total_assets"]), _div(p["net_income"], pp["total_assets"])
    cfo_ratio = _div(c["cfo"], p["total_assets"])
    lev_c = _div(c["long_term_debt"], ratios.avg(c["total_assets"], p["total_assets"]))
    lev_p = _div(p["long_term_debt"], ratios.avg(p["total_assets"], pp["total_assets"]))
    cr_c, cr_p = _div(c["current_assets"], c["current_liabilities"]), _div(p["current_assets"], p["current_liabilities"])
    sh_c = c["shares_outstanding"] or c["shares_diluted"]
    sh_p = p["shares_outstanding"] or p["shares_diluted"]
    gm_c, gm_p = _div(c["gross_profit"], c["revenue"]), _div(p["gross_profit"], p["revenue"])
    at_c, at_p = _div(c["revenue"], p["total_assets"]), _div(p["revenue"], pp["total_assets"])

    def test(key, label, group, passed, detail, missing):
        return {"key": key, "label": label, "group": group, "pass": passed, "detail": detail if passed is not None else missing}

    def pct(v):
        return f"{v * 100:.1f}%"

    tests = [
        test("roa", "Positive return on assets", "Profitability",
             roa_c > 0 if roa_c is not None else None,
             f"ROA {pct(roa_c)} = {_m(c['net_income'])} ÷ {_m(p['total_assets'])}" if roa_c is not None else "",
             "Needs net income and prior-year total assets."),
        test("cfo", "Positive operating cash flow", "Profitability",
             c["cfo"] > 0 if c["cfo"] is not None else None,
             f"Operating cash flow {_m(c['cfo'])}" if c["cfo"] is not None else "", "Operating cash flow not reported."),
        test("droa", "Return on assets improved", "Profitability",
             roa_c > roa_p if _ok(roa_c, roa_p) else None,
             f"{pct(roa_c)} vs {pct(roa_p)} a year earlier" if _ok(roa_c, roa_p) else "", "Needs three years of assets and net income."),
        test("accrual", "Cash flow exceeds net income", "Profitability",
             cfo_ratio > roa_c if _ok(cfo_ratio, roa_c) else None,
             f"CFO ÷ assets {pct(cfo_ratio)} vs ROA {pct(roa_c)}" if _ok(cfo_ratio, roa_c) else "", "Needs operating cash flow."),
        test("leverage", "Long-term debt fell relative to assets", "Funding",
             lev_c < lev_p if _ok(lev_c, lev_p) else None,
             f"{pct(lev_c)} vs {pct(lev_p)} of average assets" if _ok(lev_c, lev_p) else "", "Long-term debt not reported for both years."),
        test("liquidity", "Current ratio improved", "Funding",
             cr_c > cr_p if _ok(cr_c, cr_p) else None,
             f"{cr_c:.2f}x vs {cr_p:.2f}x" if _ok(cr_c, cr_p) else "", "Current assets/liabilities not reported (typical of banks and insurers)."),
        test("dilution", "No new shares issued", "Funding",
             sh_c <= sh_p if _ok(sh_c, sh_p) else None,
             f"{sh_c / M:,.0f}M vs {sh_p / M:,.0f}M shares" if _ok(sh_c, sh_p) else "", "Share count not reported for both years."),
        test("margin", "Gross margin improved", "Efficiency",
             gm_c > gm_p if _ok(gm_c, gm_p) else None,
             f"{pct(gm_c)} vs {pct(gm_p)}" if _ok(gm_c, gm_p) else "", "Gross profit not reported (common for banks, insurers and some service companies)."),
        test("turnover", "Asset turnover improved", "Efficiency",
             at_c > at_p if _ok(at_c, at_p) else None,
             f"{at_c:.3f}x vs {at_p:.3f}x" if _ok(at_c, at_p) else "", "Needs revenue and three years of assets."),
    ]
    available = [t for t in tests if t["pass"] is not None]
    return {
        "score": sum(1 for t in available if t["pass"]),
        "available": len(available),
        "tests": tests,
    }


def _altman(c: dict, market_cap) -> dict:
    ta = c["total_assets"]
    wc = ratios.sub(c["current_assets"], c["current_liabilities"])
    parts = [
        ("X1", "Working capital ÷ Total assets", 1.2, wc, ta),
        ("X2", "Retained earnings ÷ Total assets", 1.4, c["retained_earnings"], ta),
        ("X3", "EBIT ÷ Total assets", 3.3, c["operating_income"], ta),
        ("X4", "Market value of equity ÷ Total liabilities", 0.6, market_cap, c["total_liabilities"]),
        ("X5", "Revenue ÷ Total assets", 1.0, c["revenue"], ta),
    ]
    components, missing = [], []
    for key, formula, weight, num, den in parts:
        value = _div(num, den) if den and den > 0 else None
        if value is None:
            name = formula.split(" ÷ ")[0]
            missing.append(name if name == "EBIT" else name.lower())
        components.append({"key": key, "formula": formula, "weight": weight, "value": value,
                           "calc": f"{_m(num)} ÷ {_m(den)}" if value is not None else None})
    if missing:
        return {"value": None, "zone": None, "components": components,
                "reason": f"Missing {', '.join(sorted(set(missing)))} for the latest year."}
    z = sum(x["weight"] * x["value"] for x in components)
    zone = "safe" if z > 2.99 else "grey" if z >= 1.81 else "distress"
    return {"value": z, "zone": zone, "components": components, "reason": None}


def _beneish(c: dict, p: dict) -> dict:
    def idx(key, label, formula, coef, value, calc):
        return {"key": key, "label": label, "formula": formula, "coef": coef, "value": value, "calc": calc if value is not None else None}

    gm = lambda v: _div(ratios.sub(v["revenue"], v["cost_of_revenue"]) if v["gross_profit"] is None else v["gross_profit"], v["revenue"])
    hard = lambda v: _div(ratios.add(v["current_assets"], v["ppe"]), v["total_assets"])
    dep = lambda v: _div(v["dna"], ratios.add(v["dna"], v["ppe"]))
    lev = lambda v: _div(ratios.add(v["current_liabilities"], v["long_term_debt"] or 0), v["total_assets"])

    dsri = _div(_div(c["receivables"], c["revenue"]), _div(p["receivables"], p["revenue"]))
    gmi = _div(gm(p), gm(c)) if gm(c) and gm(c) > 0 else None
    aqi = _div(1 - hard(c), 1 - hard(p)) if _ok(hard(c), hard(p)) and hard(p) < 1 else None
    sgi = _div(c["revenue"], p["revenue"])
    depi = _div(dep(p), dep(c))
    sgai = _div(_div(c["sga"], c["revenue"]), _div(p["sga"], p["revenue"]))
    tata = _div(ratios.sub(c["net_income"], c["cfo"]), c["total_assets"])
    lvgi = _div(lev(c), lev(p))

    r = lambda x: _x(x) if x is not None else "N/A"
    components = [
        idx("DSRI", "Days sales in receivables index", "(Receivables ÷ Revenue) vs prior year", 0.920, dsri,
            f"{r(_div(c['receivables'], c['revenue']))} ÷ {r(_div(p['receivables'], p['revenue']))}"),
        idx("GMI", "Gross margin index", "Prior gross margin ÷ Current gross margin", 0.528, gmi, f"{r(gm(p))} ÷ {r(gm(c))}"),
        idx("AQI", "Asset quality index", "[1 − (Current assets + PP&E) ÷ Total assets] vs prior year", 0.404, aqi,
            f"{r(1 - hard(c) if hard(c) is not None else None)} ÷ {r(1 - hard(p) if hard(p) is not None else None)}"),
        idx("SGI", "Sales growth index", "Revenue ÷ Prior-year revenue", 0.892, sgi, f"{_m(c['revenue'] or 0)} ÷ {_m(p['revenue'] or 0)}"),
        idx("DEPI", "Depreciation index", "Prior depreciation rate ÷ Current rate, rate = D&A ÷ (D&A + PP&E)", 0.115, depi,
            f"{r(dep(p))} ÷ {r(dep(c))}"),
        idx("SGAI", "SG&A expense index", "(SG&A ÷ Revenue) vs prior year", -0.172, sgai,
            f"{r(_div(c['sga'], c['revenue']))} ÷ {r(_div(p['sga'], p['revenue']))}"),
        idx("TATA", "Total accruals to total assets", "(Net income − Operating cash flow) ÷ Total assets", 4.679, tata,
            f"({_m(c['net_income'] or 0)} − {_m(c['cfo'] or 0)}) ÷ {_m(c['total_assets'] or 0)}"),
        idx("LVGI", "Leverage index", "[(Current liabilities + Long-term debt) ÷ Total assets] vs prior year", -0.327, lvgi,
            f"{r(lev(c))} ÷ {r(lev(p))}"),
    ]
    missing = [x["key"] for x in components if x["value"] is None]
    if missing:
        return {"value": None, "flag": None, "components": components,
                "reason": f"Can't calculate {', '.join(missing)}: the inputs aren't reported for both years."}
    m = -4.84 + sum(x["coef"] * x["value"] for x in components)
    return {"value": m, "flag": m > -1.78, "components": components, "reason": None}


@cached("health", DAY)  # built from annual reports and year-end prices, which change rarely
def build(ticker: str) -> dict:
    annual = statements.build(ticker, "annual")
    cols = annual["columns"]
    if len(cols) < 3:
        raise ValueError("The health scorecard needs at least three years of annual reports.")
    rows = {row["key"]: row["values"] for rows in annual["statements"].values() for row in rows}
    year = lambda i: {k: v[i] for k, v in rows.items()}
    c, p, pp = year(-1), year(-2), year(-3)

    rat = ratios.build(ticker)
    annual_caps = [cap for col, cap in zip(rat["columns"], rat["marketCaps"]) if col["label"] != "TTM"]
    market_cap = annual_caps[-1] if annual_caps else None

    overview = yahoo.overview(ticker)
    financial = overview.get("sector") in FINANCIAL_SECTORS or (c["current_assets"] is None and c["total_assets"] is not None)
    caution = ("Built for industrial companies. Banks and insurers don't report current assets, gross profit or "
               "revenue in the usual way, so this score is unreliable or unavailable for them.") if financial else None

    altman = _altman(c, market_cap) | {"caution": caution}
    beneish = _beneish(c, p) | {"caution": caution}
    accruals = _div(ratios.sub(c["net_income"], c["cfo"]), ratios.avg(c["total_assets"], p["total_assets"]))

    return {
        "symbol": ticker,
        "currency": annual["currency"],
        "year": cols[-1]["label"],
        "priorYear": cols[-2]["label"],
        "source": annual["source"],
        "financial": financial,
        "piotroski": _piotroski(c, p, pp) | {"caution": caution and "Several tests need current assets and gross profit, which banks and insurers don't report."},
        "altman": altman,
        "beneish": beneish,
        "accruals": {
            "value": accruals,
            "calc": (f"({_m(c['net_income'])} − {_m(c['cfo'])}) ÷ average of {_m(c['total_assets'])} and {_m(p['total_assets'])}"
                     if accruals is not None else None),
        },
    }
