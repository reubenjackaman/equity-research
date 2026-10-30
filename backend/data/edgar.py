"""
Official annual numbers from SEC EDGAR.

Covers US companies (10-K, US GAAP) and foreign companies that file with the SEC:
Canadian 40-F filers (e.g. Royal Bank, Suncor) and other 20-F filers (e.g. TSMC), which
usually report under IFRS and in their home currency.

The SEC publishes every number tagged in a company's filings ("XBRL company facts")
as free JSON. No API key is needed, but the SEC asks each app to identify itself
with a User-Agent containing a name and email (set SEC_USER_AGENT in .env), and to
stay under 10 requests per second. We make at most two requests per company and
cache the results, so we're far below that.
"""

import os
from datetime import date

import requests

from .cache import DAY, cached

TICKERS_URL = "https://www.sec.gov/files/company_tickers.json"
FACTS_URL = "https://data.sec.gov/api/xbrl/companyfacts/CIK{cik:010d}.json"


def _get(url: str) -> dict:
    agent = os.getenv("SEC_USER_AGENT") or "EquityResearchApp (educational project)"
    res = requests.get(url, headers={"User-Agent": agent}, timeout=20)
    res.raise_for_status()
    return res.json()


@cached("sec-tickers", 7 * DAY)
def _ticker_map() -> dict:
    data = _get(TICKERS_URL)
    return {row["ticker"].upper(): row["cik_str"] for row in data.values()}


def cik_for(ticker: str):
    """The SEC's company ID for a US ticker, or None. (For TSX tickers, look up the
    company's US listing first with data.yahoo.us_listing.)"""
    if "." in ticker:
        return None
    return _ticker_map().get(ticker.upper())


# Forms whose full-year figures we accept. 6-K is included because some Canadian filers
# (e.g. CN) only tag their numbers in 6-K reports; the one-year duration check below
# still makes sure only full fiscal-year figures are used for annual statements.
ANNUAL_FORMS = ("10-K", "10-K/A", "20-F", "20-F/A", "40-F", "40-F/A", "6-K", "6-K/A")
PROFIT_TAGS = ("NetIncomeLoss", "ProfitLoss", "ProfitLossAttributableToOwnersOfParent")


class Facts(dict):
    """{tag: [entries]} for one accounting standard and currency. `.taxonomy` says which."""

    taxonomy = "us-gaap"


def company_facts(cik: int, currency: str = "USD") -> Facts:
    """A company's tagged numbers in `currency`, from US GAAP if it reports that way, else IFRS.

    Not cached on purpose: the file is several MB. We cache the much smaller statements
    built from it instead (see finance/statements.py).
    """
    raw = _get(FACTS_URL.format(cik=cik))["facts"]
    for taxonomy in ("us-gaap", "ifrs-full"):
        facts = Facts()
        facts.taxonomy = taxonomy
        for tag, body in raw.get(taxonomy, {}).items():
            units = body["units"]
            entries = units.get(currency) or units.get(f"{currency}/shares") or units.get("shares")
            if entries:
                facts[tag] = entries
        has_annual_profit = any(e.get("form") in ANNUAL_FORMS for t in PROFIT_TAGS for e in facts.get(t, []))
        if has_annual_profit:
            return facts
    return Facts()


def _days(start: str, end: str) -> int:
    return (date.fromisoformat(end) - date.fromisoformat(start)).days


def annual_series(facts: dict, tag: str, instant: bool) -> dict:
    """{period end date: (value, filed date)} for one XBRL tag, using annual reports only.

    Flow items (revenue, cash flow...) must cover roughly a full year; balance-sheet
    items are a single date ("instant"). If a number was restated in a later filing,
    the most recently filed version wins.
    """
    best = {}
    for e in facts.get(tag, []):
        if e.get("form") not in ANNUAL_FORMS:
            continue
        if instant:
            if "start" in e:
                continue
        else:
            if "start" not in e or not 350 <= _days(e["start"], e["end"]) <= 380:
                continue
        prev = best.get(e["end"])
        if prev is None or e["filed"] > prev["filed"]:
            best[e["end"]] = e
    return {end: (e["val"], e["filed"]) for end, e in best.items()}


# ---------- Trailing twelve months (TTM) from 10-Q / 10-K filings ----------
#
# A 10-Q reports year-to-date (YTD) figures, so the standard way to get TTM is:
#     TTM = Last fiscal year + This year's YTD − Last year's same YTD
# e.g. Amazon at Jun 2026: FY2025 EPS 7.17 + H1 2026 8.53 − H1 2025 3.27 = 12.43.
# Each helper returns a list of (sign, value, filed date) parts so the caller can
# split-adjust each part by its own filing date before adding them up.

PERIODIC_FORMS = ("10-Q", "10-Q/A", *ANNUAL_FORMS)


def _best_by_period(facts: dict, tag: str) -> list:
    """One entry per (start, end) period, keeping the most recently filed version."""
    best = {}
    for e in facts.get(tag, []):
        if e.get("form") not in PERIODIC_FORMS:
            continue
        key = (e.get("start"), e["end"])
        if key not in best or e["filed"] > best[key]["filed"]:
            best[key] = e
    return list(best.values())


def latest_period_end(facts: dict, tag: str):
    ends = [e["end"] for e in _best_by_period(facts, tag) if "start" in e]
    return max(ends) if ends else None


def ttm_at(facts: dict, tag: str, end: str):
    """Trailing-12-month parts for a flow item (revenue, cash flow...) ending on `end`."""
    entries = [e for e in _best_by_period(facts, tag) if "start" in e]
    at_end = [e for e in entries if e["end"] == end]
    if not at_end:
        return None
    full_year = [e for e in at_end if 350 <= _days(e["start"], e["end"]) <= 380]
    if full_year:
        e = max(full_year, key=lambda e: e["filed"])
        return [(1, e["val"], e["filed"])]
    ytd = max(at_end, key=lambda e: _days(e["start"], e["end"]))
    length = _days(ytd["start"], ytd["end"])
    prior = [e for e in entries if abs(_days(e["end"], end) - 365) <= 10 and abs(_days(e["start"], e["end"]) - length) <= 10]
    if not prior:
        return None
    prior = prior[0]
    fiscal_years = [e for e in entries if 350 <= _days(e["start"], e["end"]) <= 380 and prior["end"] < e["end"] < end]
    if not fiscal_years:
        return None
    fy = max(fiscal_years, key=lambda e: e["end"])
    return [(1, fy["val"], fy["filed"]), (1, ytd["val"], ytd["filed"]), (-1, prior["val"], prior["filed"])]


def latest_duration_at(facts: dict, tag: str, end: str):
    """Value for the shortest period ending on `end` (e.g. that quarter's diluted share count)."""
    at_end = [e for e in _best_by_period(facts, tag) if "start" in e and e["end"] == end]
    if not at_end:
        return None
    e = min(at_end, key=lambda e: _days(e["start"], e["end"]))
    return [(1, e["val"], e["filed"])]


def instant_at(facts: dict, tag: str, end: str, tolerance: int = 10):
    """Balance-sheet value on (or within a few days of) a date."""
    near = [e for e in _best_by_period(facts, tag) if "start" not in e and abs(_days(e["end"], end)) <= tolerance]
    if not near:
        return None
    e = min(near, key=lambda e: abs(_days(e["end"], end)))
    return [(1, e["val"], e["filed"])]
