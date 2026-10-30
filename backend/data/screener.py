"""
Stock screener for the "Explore" section of the home page, using Yahoo Finance's screener.

If Yahoo's live screener refuses the request (it blocks many cloud servers, e.g. Render),
results come from a saved snapshot instead (data/screener_snapshot.json, refreshed with
`python -m tools.make_screener_snapshot`). The snapshot can't filter by industry or revenue
growth, and its prices are as of the snapshot date; the page says so.

Filters map to Yahoo screener fields. Two clean-ups for Canada: Yahoo lists CDRs
(Canadian Depositary Receipts of US companies, e.g. "APPLE CDR (CAD HEDGED)") and
preferred shares on the TSX, so those are removed to leave real Canadian companies.
"""

import json
import re
from pathlib import Path

import yfinance as yf
from yfinance import EquityQuery

from .cache import DAY, MINUTE, cached
from .yahoo import clean

MAX_RESULTS = 250  # Yahoo's limit per request

# Market-cap buckets (in the listing currency), the usual industry definitions.
MARKET_CAPS = {
    "mega": (200e9, None),
    "large": (10e9, 200e9),
    "mid": (2e9, 10e9),
    "small": (300e6, 2e9),
    "micro": (None, 300e6),
}
PE_RANGES = {"under15": (0, 15), "15to25": (15, 25), "over25": (25, None)}
DIVIDENDS = {"any": (0.0001, None), "over2": (2, None), "over4": (4, None)}
GROWTH = {"over10": (10, None), "over25": (25, None), "negative": (None, 0)}
SORTS = {
    "marketcap": ("intradaymarketcap", False),
    "change": ("percentchange", False),
    "pe": ("peratio.lasttwelvemonths", True),
    "dividend": ("forward_dividend_yield", False),
    "growth": ("totalrevenues1yrgrowth.lasttwelvemonths", False),
}


SECTORS = [
    "Basic Materials", "Communication Services", "Consumer Cyclical", "Consumer Defensive", "Energy",
    "Financial Services", "Healthcare", "Industrials", "Real Estate", "Technology", "Utilities",
]
SNAPSHOT = Path(__file__).resolve().parent / "screener_snapshot.json"


@cached("screener-options", 7 * DAY)
def options() -> dict:
    """Sectors and the industries inside each, as Yahoo names them."""
    industries = EquityQuery("eq", ["region", "us"]).valid_values["industry"]
    return {sector: sorted(names) for sector, names in sorted(industries.items())}


def _between(field: str, low, high) -> list:
    out = []
    if low is not None:
        out.append(EquityQuery("gte", [field, low]))
    if high is not None:
        out.append(EquityQuery("lt", [field, high]))
    return out


def _is_real_tsx_company(q: dict) -> bool:
    names = f"{q.get('shortName', '')} {q.get('longName', '')}".upper()
    if "CDR" in names:  # receipt for a US company, not a Canadian company
        return False
    if re.search(r"-P[A-Z]*\.", q.get("symbol", "")) or "PREF" in names:  # preferred shares
        return False
    return True


@cached("screener", 15 * MINUTE)
def screen(country: str, sector: str, industry: str, cap: str, pe: str, dividend: str, growth: str, sort: str) -> dict:
    parts = [EquityQuery("eq", ["region", "ca" if country == "ca" else "us"])]
    if country == "ca":
        parts.append(EquityQuery("eq", ["exchange", "TOR"]))  # TSX only (not the Venture exchange)
    else:
        parts.append(EquityQuery("is-in", ["exchange", "NMS", "NYQ", "NGM", "NCM", "ASE"]))
    if sector:
        parts.append(EquityQuery("eq", ["sector", sector]))
    if industry:
        parts.append(EquityQuery("eq", ["industry", industry]))
    # No size chosen = every company over $300M. Tiny companies often have odd data (e.g. 50%+
    # "dividend yields") that would crowd the top of the list; pick "micro" to see them.
    parts += _between("intradaymarketcap", *MARKET_CAPS.get(cap, (300e6, None)))
    if pe in PE_RANGES:
        parts += _between("peratio.lasttwelvemonths", *PE_RANGES[pe])
    if dividend in DIVIDENDS:
        parts += _between("forward_dividend_yield", *DIVIDENDS[dividend])
    if growth in GROWTH:
        parts += _between("totalrevenues1yrgrowth.lasttwelvemonths", *GROWTH[growth])

    field, ascending = SORTS.get(sort, SORTS["marketcap"])
    try:
        result = yf.screen(EquityQuery("and", parts), sortField=field, sortAsc=ascending, size=MAX_RESULTS)
    except Exception:
        return _from_snapshot(country, sector, industry, cap, pe, dividend, growth, sort)
    quotes = [q for q in result.get("quotes", []) if q.get("quoteType") == "EQUITY"]
    if country == "ca":
        quotes = [q for q in quotes if _is_real_tsx_company(q)]

    rows = [_row(q) for q in quotes]
    return {"total": result.get("total", len(rows)), "results": rows, "note": None}


def _row(q: dict) -> dict:
    return {
        "symbol": q["symbol"],
        "name": q.get("longName") or q.get("shortName") or q["symbol"],
        "exchange": q.get("fullExchangeName") or q.get("exchange"),
        "currency": q.get("currency"),
        "price": clean(q.get("regularMarketPrice")),
        "changePercent": clean(q.get("regularMarketChangePercent")),
        "marketCap": clean(q.get("marketCap")),
        "pe": clean(q.get("trailingPE")),
        "dividendYield": clean(q.get("dividendYield")),  # percent, e.g. 0.46 = 0.46%
        "yearChangePercent": clean(q.get("fiftyTwoWeekChangePercent")),
    }


def _in_range(value, bounds) -> bool:
    low, high = bounds
    return value is not None and (low is None or value >= low) and (high is None or value < high)


def _from_snapshot(country, sector, industry, cap, pe, dividend, growth, sort) -> dict:
    """Same filters, applied to the saved snapshot (used when the live screener is unavailable)."""
    if not SNAPSHOT.exists():
        raise RuntimeError("the live screener is unavailable and no snapshot has been saved")
    snap = json.loads(SNAPSHOT.read_text())
    rows = [r for r in snap["rows"] if r["country"] == country and (not sector or r["sector"] == sector)]
    rows = [r for r in rows if _in_range(r["marketCap"], MARKET_CAPS.get(cap, (300e6, None)))]
    if pe in PE_RANGES:
        rows = [r for r in rows if _in_range(r["pe"], PE_RANGES[pe])]
    if dividend in DIVIDENDS:
        rows = [r for r in rows if _in_range(r["dividendYield"], DIVIDENDS[dividend])]

    key = {"change": "changePercent", "pe": "pe", "dividend": "dividendYield"}.get(sort, "marketCap")
    present = [r for r in rows if r[key] is not None]
    present.sort(key=lambda r: r[key], reverse=sort != "pe")
    rows = present + [r for r in rows if r[key] is None]

    skipped = [name for name, used in (("industry", industry), ("revenue growth", growth), ("revenue-growth sorting", sort == "growth")) if used]
    note = (f"Live screener unavailable, so these results come from a saved snapshot ({snap['date']}); "
            "prices and daily moves are as of that date.")
    if skipped:
        note += f" The {' and '.join(skipped)} filter isn't available in the snapshot and was ignored."
    return {"total": len(rows), "results": rows[:MAX_RESULTS], "note": note}
