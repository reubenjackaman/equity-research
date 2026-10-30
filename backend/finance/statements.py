"""
Standardized financial statements.

Every company labels its line items a little differently, and each data source
names them differently again. This file defines ONE fixed list of line items
(the rows you see in the app) and, for each, where to find it:

  - "sec":   SEC EDGAR US-GAAP tags to try in order. A tuple means "add these together".
  - IFRS_TAGS (below): the same for companies reporting under IFRS (most Canadian
    banks and energy companies, TSMC...).
  - "yahoo": Yahoo Finance row names to try in order (all companies, annual + quarterly).

How sources are combined:
  - Annual, company files with the SEC (US 10-K, Canadian 40-F, foreign 20-F; TSX
    companies are matched to their US listing): SEC figures first (official, 10 years),
    gaps filled from Yahoo for the same fiscal year.
  - Quarterly, or no SEC filings (e.g. TSX-only companies): Yahoo only.
  - A few rows (EBITDA, total debt, free cash flow) are always calculated so you can
    see the formula. They're marked "Calculated".

Values are returned in raw units (dollars, shares); the frontend shows millions.
Per-share figures and share counts are adjusted for stock splits so every year
lines up with today's share count.
Sign convention: cash outflows (capex, dividends, buybacks) are negative.
"""

from datetime import date, timedelta

from data import edgar, yahoo
from data.cache import DAY, cached

MAX_ANNUAL_YEARS = 10

# fmt: (key, label, sec tags, yahoo rows, options)
INCOME = [
    ("revenue", "Revenue", ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet", "RevenueFromContractWithCustomerIncludingAssessedTax"], ["Total Revenue", "Operating Revenue"], {"bold": True}),
    ("cost_of_revenue", "Cost of revenue", ["CostOfGoodsAndServicesSold", "CostOfRevenue", "CostOfGoodsSold", "CostOfServices"], ["Cost Of Revenue", "Reconciled Cost Of Revenue"], {}),
    ("gross_profit", "Gross profit", ["GrossProfit"], ["Gross Profit"], {"bold": True}),
    ("rnd", "Research & development", ["ResearchAndDevelopmentExpense", "ResearchAndDevelopmentExpenseExcludingAcquiredInProcessCost"], ["Research And Development"], {"indent": True}),
    ("sga", "Selling, general & admin", ["SellingGeneralAndAdministrativeExpense", ("SellingAndMarketingExpense", "GeneralAndAdministrativeExpense")], ["Selling General And Administration"], {"indent": True}),
    ("operating_expenses", "Total operating expenses", ["OperatingExpenses"], ["Operating Expense"], {}),
    ("operating_income", "Operating income (EBIT)", ["OperatingIncomeLoss"], ["Operating Income"], {"bold": True}),
    ("interest_expense", "Interest expense", ["InterestExpense", "InterestExpenseNonoperating", "InterestExpenseDebt"], ["Interest Expense", "Interest Expense Non Operating"], {}),
    ("pretax_income", "Pre-tax income", ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"], ["Pretax Income"], {}),
    ("income_tax", "Income tax expense", ["IncomeTaxExpenseBenefit"], ["Tax Provision"], {}),
    ("net_income", "Net income", ["NetIncomeLoss", "NetIncomeLossAvailableToCommonStockholdersBasic", "ProfitLoss"], ["Net Income Common Stockholders", "Net Income"], {"bold": True}),
    ("eps_basic", "EPS (basic)", ["EarningsPerShareBasic"], ["Basic EPS"], {"format": "perShare"}),
    ("eps_diluted", "EPS (diluted)", ["EarningsPerShareDiluted"], ["Diluted EPS"], {"format": "perShare"}),
    ("shares_diluted", "Diluted shares outstanding", ["WeightedAverageNumberOfDilutedSharesOutstanding"], ["Diluted Average Shares"], {"format": "shares"}),
    ("ebitda", "EBITDA", [], [], {"calc": "Operating income + Depreciation & amortization"}),
]

BALANCE = [
    ("cash", "Cash & equivalents", ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"], ["Cash And Cash Equivalents"], {"indent": True}),
    ("short_term_investments", "Short-term investments", ["MarketableSecuritiesCurrent", "ShortTermInvestments", "AvailableForSaleSecuritiesDebtSecuritiesCurrent"], ["Other Short Term Investments", "Short Term Investments"], {"indent": True}),
    ("receivables", "Accounts receivable", ["AccountsReceivableNetCurrent", "ReceivablesNetCurrent"], ["Accounts Receivable", "Receivables"], {"indent": True}),
    ("inventory", "Inventory", ["InventoryNet"], ["Inventory"], {"indent": True}),
    ("current_assets", "Total current assets", ["AssetsCurrent"], ["Current Assets"], {"bold": True}),
    ("ppe", "Property, plant & equipment (net)", ["PropertyPlantAndEquipmentNet"], ["Net PPE"], {"indent": True}),
    ("goodwill", "Goodwill", ["Goodwill"], ["Goodwill"], {"indent": True}),
    ("intangibles", "Other intangible assets", ["IntangibleAssetsNetExcludingGoodwill", "FiniteLivedIntangibleAssetsNet"], ["Other Intangible Assets"], {"indent": True}),
    ("total_assets", "Total assets", ["Assets"], ["Total Assets"], {"bold": True}),
    ("accounts_payable", "Accounts payable", ["AccountsPayableCurrent"], ["Accounts Payable"], {"indent": True}),
    ("short_term_debt", "Short-term debt", ["DebtCurrent", ("LongTermDebtCurrent", "CommercialPaper", "ShortTermBorrowings"), "ShortTermBorrowings"], ["Current Debt", "Current Debt And Capital Lease Obligation"], {"indent": True}),
    ("current_liabilities", "Total current liabilities", ["LiabilitiesCurrent"], ["Current Liabilities"], {"bold": True}),
    ("long_term_debt", "Long-term debt", ["LongTermDebtNoncurrent", "LongTermDebtAndCapitalLeaseObligations"], ["Long Term Debt", "Long Term Debt And Capital Lease Obligation"], {"indent": True}),
    ("total_liabilities", "Total liabilities", ["Liabilities"], ["Total Liabilities Net Minority Interest"], {"bold": True}),
    ("total_equity", "Shareholders' equity", ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"], ["Stockholders Equity", "Common Stock Equity"], {"bold": True}),
    ("shares_outstanding", "Shares outstanding", ["CommonStockSharesOutstanding"], ["Ordinary Shares Number", "Share Issued"], {"format": "shares"}),
    ("total_debt", "Total debt", [], [], {"calc": "Short-term debt + Long-term debt"}),
]

CASHFLOW = [
    ("cfo", "Cash from operations", ["NetCashProvidedByUsedInOperatingActivities", "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations"], ["Operating Cash Flow"], {"bold": True}),
    ("dna", "Depreciation & amortization", ["DepreciationDepletionAndAmortization", "DepreciationAmortizationAndAccretionNet", "DepreciationAndAmortization", "Depreciation"], ["Depreciation And Amortization", "Depreciation Amortization Depletion", "Reconciled Depreciation"], {"indent": True}),
    ("sbc", "Stock-based compensation", ["ShareBasedCompensation", "AllocatedShareBasedCompensationExpense"], ["Stock Based Compensation"], {"indent": True}),
    ("capex", "Capital expenditures", ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsToAcquireProductiveAssets", "PaymentsToAcquireOtherPropertyPlantAndEquipment"], ["Capital Expenditure"], {"sec_sign": -1}),
    ("cfi", "Cash from investing", ["NetCashProvidedByUsedInInvestingActivities"], ["Investing Cash Flow"], {"bold": True}),
    ("dividends", "Dividends paid", ["PaymentsOfDividends", "PaymentsOfDividendsCommonStock"], ["Cash Dividends Paid", "Common Stock Dividend Paid"], {"sec_sign": -1, "indent": True}),
    ("buybacks", "Share repurchases", ["PaymentsForRepurchaseOfCommonStock"], ["Repurchase Of Capital Stock", "Common Stock Payments"], {"sec_sign": -1, "indent": True}),
    ("cff", "Cash from financing", ["NetCashProvidedByUsedInFinancingActivities"], ["Financing Cash Flow"], {"bold": True}),
    ("fcf", "Free cash flow", [], [], {"calc": "Cash from operations + Capital expenditures (capex is negative)", "bold": True}),
]

# The same line items under IFRS (international standards), used when a company's SEC
# filings are IFRS rather than US GAAP. Keys missing here simply fall back to Yahoo.
IFRS_TAGS = {
    "revenue": ["Revenue", "RevenueFromContractsWithCustomers"],
    "cost_of_revenue": ["CostOfSales"],
    "gross_profit": ["GrossProfit"],
    "rnd": ["ResearchAndDevelopmentExpense"],
    "sga": ["SellingGeneralAndAdministrativeExpense", ("DistributionCosts", "AdministrativeExpense")],
    "operating_income": ["ProfitLossFromOperatingActivities"],
    "interest_expense": ["FinanceCosts", "InterestExpense"],
    "pretax_income": ["ProfitLossBeforeTax"],
    "income_tax": ["IncomeTaxExpenseContinuingOperations"],
    "net_income": ["ProfitLossAttributableToOwnersOfParent", "ProfitLoss"],
    "eps_basic": ["BasicEarningsLossPerShare"],
    "eps_diluted": ["DilutedEarningsLossPerShare"],
    "shares_diluted": ["AdjustedWeightedAverageShares", "WeightedAverageShares"],
    "cash": ["CashAndCashEquivalents"],
    "short_term_investments": ["CurrentInvestments"],
    "receivables": ["TradeAndOtherCurrentReceivables", "CurrentTradeReceivables"],
    "inventory": ["Inventories"],
    "current_assets": ["CurrentAssets"],
    "ppe": ["PropertyPlantAndEquipment"],
    "goodwill": ["Goodwill"],
    "intangibles": ["IntangibleAssetsOtherThanGoodwill"],
    "total_assets": ["Assets"],
    "accounts_payable": ["TradeAndOtherCurrentPayables", "TradeAndOtherCurrentPayablesToTradeSuppliers"],
    "short_term_debt": ["CurrentBorrowings", "ShorttermBorrowings", "CurrentPortionOfLongtermBorrowings"],
    "current_liabilities": ["CurrentLiabilities"],
    "long_term_debt": ["NoncurrentPortionOfNoncurrentBorrowings", "LongtermBorrowings"],
    "total_liabilities": ["Liabilities"],
    "total_equity": ["EquityAttributableToOwnersOfParent", "Equity"],
    "shares_outstanding": ["NumberOfSharesOutstanding"],
    "cfo": ["CashFlowsFromUsedInOperatingActivities", "CashFlowsFromUsedInOperations"],
    "dna": ["DepreciationAndAmortisationExpense", "AdjustmentsForDepreciationAndAmortisationExpense"],
    "sbc": ["AdjustmentsForSharebasedPayments", "ExpenseFromSharebasedPaymentTransactions"],
    "capex": ["PurchaseOfPropertyPlantAndEquipmentClassifiedAsInvestingActivities", "PurchaseOfPropertyPlantAndEquipment"],
    "cfi": ["CashFlowsFromUsedInInvestingActivities"],
    "dividends": ["DividendsPaidClassifiedAsFinancingActivities", "DividendsPaid"],
    "buybacks": ["PaymentsToAcquireOrRedeemEntitysShares"],
    "cff": ["CashFlowsFromUsedInFinancingActivities"],
}

STATEMENTS = {"income": INCOME, "balance": BALANCE, "cashflow": CASHFLOW}


def _tags(key: str, us_gaap_tags: list, facts) -> list:
    """The tag list for this line item in whichever standard the company reports under."""
    return IFRS_TAGS.get(key, []) if facts.taxonomy == "ifrs-full" else us_gaap_tags


def _load_facts(ticker: str, currency: str):
    """The company's SEC data in its reporting currency, or None if it doesn't file with the SEC."""
    symbol = yahoo.us_listing(ticker)  # SHOP.TO -> SHOP, CNR.TO -> CNI; None for TSX-only companies
    cik = edgar.cik_for(symbol) if symbol else None
    if not cik:
        return None
    facts = edgar.company_facts(cik, currency or "USD")
    # Nothing usable, e.g. a company that just re-registered under a new SEC ID (ExxonMobil, 2026).
    if not any(edgar.annual_series(facts, t, False) for t in edgar.PROFIT_TAGS):
        return None
    return facts
BALANCE_KEYS = {item[0] for item in BALANCE}


def _near(d1: str, d2: str, days: int = 15) -> bool:
    return abs((date.fromisoformat(d1) - date.fromisoformat(d2)).days) <= days


def _sec_value(facts: dict, tags: list, end: str, instant: bool, cache: dict):
    """(value, filed date) from the first tag (in priority order) that has this period end."""
    for tag in tags:
        group = tag if isinstance(tag, tuple) else (tag,)
        series = []
        for t in group:
            if t not in cache:
                cache[t] = edgar.annual_series(facts, t, instant)
            series.append(cache[t])
        if end in series[0]:
            return sum(s[end][0] for s in series if end in s), series[0][end][1]
    return None, None


def _split_factor(splits: list, filed: str) -> float:
    """How many of today's shares one share was worth when a filing came out.

    A 10-K filed before Apple's 2020 4-for-1 split reports EPS on the old share
    count, so we divide that EPS by 4 (and multiply share counts by 4) to make
    every year comparable with today's split-adjusted prices.
    """
    factor = 1.0
    for split_date, ratio in splits:
        if split_date > filed and ratio > 0:
            factor *= ratio
    return factor


def _yahoo_value(table: dict, rows: list):
    for row in rows:
        if table.get(row) is not None:
            return table[row]
    return None


def _calculate(key: str, v: dict):
    """Rows that are always computed from other rows (formula shown in the app)."""
    def get(k):
        return v.get(k)

    if key == "ebitda" and get("operating_income") is not None and get("dna") is not None:
        return get("operating_income") + get("dna")
    if key == "total_debt" and (get("short_term_debt") is not None or get("long_term_debt") is not None):
        return (get("short_term_debt") or 0) + (get("long_term_debt") or 0)
    if key == "fcf" and get("cfo") is not None and get("capex") is not None:
        return get("cfo") + get("capex")
    return None


def _fill_gaps(v: dict, src: dict):
    """Standard accounting identities for items a company didn't tag directly."""
    if v.get("gross_profit") is None and v.get("revenue") is not None and v.get("cost_of_revenue") is not None:
        v["gross_profit"] = v["revenue"] - v["cost_of_revenue"]
        src["gross_profit"] = "Calculated: Revenue − Cost of revenue"
    if v.get("operating_expenses") is None and v.get("gross_profit") is not None and v.get("operating_income") is not None:
        v["operating_expenses"] = v["gross_profit"] - v["operating_income"]
        src["operating_expenses"] = "Calculated: Gross profit − Operating income"
    if v.get("total_liabilities") is None and v.get("total_assets") is not None and v.get("total_equity") is not None:
        v["total_liabilities"] = v["total_assets"] - v["total_equity"]
        src["total_liabilities"] = "Calculated: Total assets − Shareholders' equity"


@cached("sec-ttm", DAY)
def sec_ttm(ticker: str):
    """Trailing-twelve-month figures from SEC filings (10-Q/10-K, or the latest 40-F/20-F), or None.

    Returns {"end": date, "current": {key: value}, "prior": {key: balance a year earlier}}.
    Every item is measured at the same period end so the figures are consistent.
    """
    facts = _load_facts(ticker, yahoo.statements(ticker, "annual").get("currency"))
    if not facts:
        return None
    try:
        splits = yahoo.splits(ticker)
    except Exception:
        splits = []
    # Latest reported period across several tags: companies switch tags over time
    # (Broadcom moved from NetIncomeLoss to ProfitLoss in FY2025).
    anchors = [*edgar.PROFIT_TAGS, "EarningsPerShareDiluted", "DilutedEarningsLossPerShare",
               *[t for t in INCOME[0][2] + IFRS_TAGS["revenue"] if isinstance(t, str)]]
    ends = [e for e in (edgar.latest_period_end(facts, t) for t in anchors) if e]
    end = max(ends) if ends else None
    if not end:
        return None
    year_ago = (date.fromisoformat(end) - timedelta(days=365)).isoformat()

    def combine(parts, fmt):
        total = 0.0
        for sign, value, filed in parts:
            factor = _split_factor(splits, filed) if fmt in ("perShare", "shares") else 1.0
            total += sign * (value / factor if fmt == "perShare" else value * factor)
        return total

    current, prior = {}, {}
    for name, items in STATEMENTS.items():
        for key, _label, sec_tags, _yahoo, opts in items:
            if opts.get("calc"):
                continue
            fmt = opts.get("format")

            def parts(tag, at):
                if name == "balance":
                    return edgar.instant_at(facts, tag, at)
                if fmt == "shares":
                    return edgar.latest_duration_at(facts, tag, at)
                return edgar.ttm_at(facts, tag, at)

            for tag in _tags(key, sec_tags, facts):
                group = tag if isinstance(tag, tuple) else (tag,)
                if parts(group[0], end) is None:
                    continue
                sign = opts.get("sec_sign", 1)
                current[key] = sign * sum(combine(parts(t, end) or [], fmt) for t in group)
                if name == "balance" and parts(group[0], year_ago) is not None:
                    prior[key] = sign * sum(combine(parts(t, year_ago) or [], fmt) for t in group)
                break

    _fill_gaps(current, {})
    _fill_gaps(prior, {})
    for items in STATEMENTS.values():
        for key, _l, _s, _y, opts in items:
            if opts.get("calc"):
                current[key] = _calculate(key, current)
                prior[key] = _calculate(key, prior)
    return {"end": end, "current": current, "prior": prior}


def _column_label(end: str, period: str) -> str:
    d = date.fromisoformat(end)
    return f"FY{d.year}" if period == "annual" else d.strftime("%b %Y")


@cached("statements", DAY)
def build(ticker: str, period: str) -> dict:
    yf_data = yahoo.statements(ticker, period)
    yahoo_dates = sorted({d for name in STATEMENTS for d in yf_data.get(name, {})})

    # Try SEC EDGAR (annual only).
    facts = None
    if period == "annual":
        try:
            facts = _load_facts(ticker, yf_data.get("currency"))
        except Exception as exc:
            # SEC unreachable or rejected us (a 403 usually means SEC_USER_AGENT in .env is missing).
            print(f"[statements] SEC EDGAR unavailable for {ticker}, using Yahoo only: {exc}")
            facts = None

    sec_cache: dict = {}
    if facts:
        try:
            splits = yahoo.splits(ticker)
        except Exception:
            splits = []
        anchor = {}
        for tag in edgar.PROFIT_TAGS:
            anchor.update(edgar.annual_series(facts, tag, instant=False))
        ends = sorted(anchor)[-MAX_ANNUAL_YEARS:]
        # Add any newer Yahoo period the SEC data doesn't have yet.
        ends += [d for d in yahoo_dates if ends and d > ends[-1] and not _near(d, ends[-1])]
        kind = "10-K" if facts.taxonomy == "us-gaap" else "annual report (IFRS)"
        source = f"SEC EDGAR {kind} filings (gaps filled from Yahoo Finance)"
    else:
        ends = yahoo_dates
        source = "Yahoo Finance"

    columns, rows = [], {name: {item[0]: [] for item in items} for name, items in STATEMENTS.items()}
    sources = {name: {item[0]: [] for item in items} for name, items in STATEMENTS.items()}

    for end in ends:
        yahoo_date = next((d for d in yahoo_dates if _near(d, end)), None)
        values, src = {}, {}
        for name, items in STATEMENTS.items():
            yahoo_table = yf_data.get(name, {}).get(yahoo_date, {}) if yahoo_date else {}
            for key, _label, sec_tags, yahoo_rows, opts in items:
                if opts.get("calc"):
                    continue
                value = None
                tags = _tags(key, sec_tags, facts) if facts else []
                if tags:
                    value, filed = _sec_value(facts, tags, end, key in BALANCE_KEYS, sec_cache)
                    if value is not None:
                        value *= opts.get("sec_sign", 1)
                        src[key] = "SEC filing"
                        fmt = opts.get("format")
                        factor = _split_factor(splits, filed) if fmt in ("perShare", "shares") else 1.0
                        if factor != 1.0:
                            value = value / factor if fmt == "perShare" else value * factor
                            src[key] = f"SEC filing (adjusted for {factor:g}-for-1 stock split)"
                if value is None and yahoo_rows:
                    value = _yahoo_value(yahoo_table, yahoo_rows)
                    if value is not None:
                        src[key] = "Yahoo Finance"
                values[key] = value

        _fill_gaps(values, src)
        for name, items in STATEMENTS.items():
            for key, _label, _sec, _yahoo, opts in items:
                if opts.get("calc"):
                    values[key] = _calculate(key, values)
                    src[key] = "Calculated: " + opts["calc"] if values[key] is not None else None

        # Skip periods where the sources have essentially nothing (Yahoo sometimes returns an empty oldest column).
        if sum(v is not None for v in values.values()) < 5:
            continue
        columns.append({"end": end, "label": _column_label(end, period)})
        for name, items in STATEMENTS.items():
            for item in items:
                rows[name][item[0]].append(values.get(item[0]))
                sources[name][item[0]].append(src.get(item[0]))

    if not columns:
        raise yahoo.TickerNotFound(ticker)

    return {
        "symbol": ticker,
        "period": period,
        "currency": yf_data.get("currency") or "USD",
        "source": source,
        "columns": columns,
        "statements": {
            name: [
                {
                    "key": key,
                    "label": label,
                    "values": rows[name][key],
                    "sources": sources[name][key],
                    "format": opts.get("format", "money"),
                    "bold": opts.get("bold", False),
                    "indent": opts.get("indent", False),
                    "formula": opts.get("calc"),
                }
                for key, label, _sec, _yahoo, opts in items
            ]
            for name, items in STATEMENTS.items()
        },
    }
