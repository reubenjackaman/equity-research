"""
Everything we read from Yahoo Finance (through the yfinance library).

yfinance needs no API key and covers both US and TSX listings
(TSX tickers end in ".TO", TSX Venture in ".V").

Yahoo's company-profile endpoint (what yfinance calls `.info`) refuses requests from many
cloud servers, including Render. Prices, history, search and statements still work there,
so when the profile is unavailable `overview()` rebuilds it from the price-chart data plus
Finnhub (industry, market cap, beta...) and Wikipedia (description).
"""

import math
import re
import warnings
from typing import Optional

import yfinance as yf

# yfinance triggers harmless pandas deprecation warnings; hide them to keep the server log readable.
warnings.filterwarnings("ignore", module="yfinance")

from . import finnhub, snapshot, wiki
from .cache import DAY, MINUTE, cached


class TickerNotFound(Exception):
    pass


def clean(value):
    """Turn NaN / infinity / missing into None, which the frontend shows as "N/A"."""
    if value is None:
        return None
    if isinstance(value, float) and (math.isnan(value) or math.isinf(value)):
        return None
    return value


# Exchanges we accept in search results: the main US venues plus TSX / TSX Venture / Cboe Canada.
US_EXCHANGES = {"NMS", "NGM", "NCM", "NYQ", "ASE", "PCX", "BTS", "NAS", "NYS"}
CA_EXCHANGES = {"TOR", "VAN", "NEO", "CNQ"}


@cached("search", DAY)
def search(query: str) -> list:
    quotes = yf.Search(query, max_results=10, news_count=0).quotes
    results = []
    for q in quotes:
        if q.get("quoteType") != "EQUITY":
            continue
        if q.get("exchange") not in US_EXCHANGES | CA_EXCHANGES:
            continue
        results.append(
            {
                "symbol": q.get("symbol"),
                "name": q.get("longname") or q.get("shortname") or q.get("symbol"),
                "exchange": q.get("exchDisp") or q.get("exchange"),
            }
        )
    return results


def info(ticker: str) -> dict:
    """Yahoo's company profile, or {} if Yahoo refuses (common on cloud servers)."""
    try:
        return yf.Ticker(ticker).info or {}
    except Exception:
        return {}


@cached("overview", 15 * MINUTE)
def overview(ticker: str) -> dict:
    data = info(ticker)
    price = data.get("currentPrice") or data.get("regularMarketPrice")
    name = data.get("longName") or data.get("shortName")
    # An unknown symbol (or a refused request) gives an almost-empty dict: try the fallback.
    if not name or price is None:
        return _overview_fallback(ticker)

    prev_close = data.get("previousClose") or data.get("regularMarketPreviousClose")
    change = price - prev_close if prev_close else None

    return {
        "symbol": data.get("symbol", ticker),
        "name": name,
        "exchange": data.get("fullExchangeName") or data.get("exchange"),
        "currency": data.get("currency"),
        "sector": data.get("sector"),
        "industry": data.get("industry"),
        "description": data.get("longBusinessSummary"),
        "website": data.get("website"),
        "price": clean(price),
        "change": clean(change),
        "changePercent": clean(change / prev_close * 100) if change is not None else None,
        "marketCap": clean(data.get("marketCap")),
        "sharesOutstanding": clean(data.get("sharesOutstanding")),
        "fiftyTwoWeekLow": clean(data.get("fiftyTwoWeekLow")),
        "fiftyTwoWeekHigh": clean(data.get("fiftyTwoWeekHigh")),
        "volume": clean(data.get("volume") or data.get("regularMarketVolume")),
        "averageVolume": clean(data.get("averageVolume")),
        "dividendYield": clean(data.get("dividendYield")),
        "beta": clean(data.get("beta")),
        # Wall Street analysts' 12-month price targets (where Yahoo has them).
        "targetLow": clean(data.get("targetLowPrice")),
        "targetMean": clean(data.get("targetMeanPrice")),
        "targetHigh": clean(data.get("targetHighPrice")),
        "analystCount": clean(data.get("numberOfAnalystOpinions")),
        "reportingCurrency": data.get("financialCurrency"),
        "profileSource": "Yahoo Finance",
    }


def fx_rate(from_ccy: str, to_ccy: str):
    """Latest exchange rate: units of `to_ccy` per 1 `from_ccy` (1.0 if the same)."""
    if not from_ccy or not to_ccy or from_ccy == to_ccy:
        return 1.0
    closes = daily_closes(f"{from_ccy}{to_ccy}=X")
    return closes[max(closes)] if closes else None


def _overview_fallback(ticker: str) -> dict:
    """Company overview without Yahoo's profile endpoint (see the module docstring)."""
    tk = yf.Ticker(ticker)
    try:
        hist = tk.history(period="1y", interval="1d", auto_adjust=False)
    except Exception:
        raise TickerNotFound(ticker)  # yfinance can fail outright for symbols that don't exist
    closes = hist["Close"].dropna() if not hist.empty else []
    if len(closes) == 0:
        raise TickerNotFound(ticker)  # no prices at all: genuinely not a ticker
    meta = tk.history_metadata or {}

    price = clean(meta.get("regularMarketPrice")) or float(closes.iloc[-1])
    prev = float(closes.iloc[-2]) if len(closes) > 1 else None
    name = meta.get("longName") or meta.get("shortName") or ticker
    currency = meta.get("currency")

    # Finnhub knows the company by its US symbol (SHOP.TO -> SHOP); its market cap is in the
    # company's home currency, so convert it to the currency this listing trades in.
    profile, metrics = {}, {}
    us_symbol = _us_symbol(ticker, name)
    if us_symbol:
        try:
            profile = finnhub.profile(us_symbol)
            metrics = finnhub.metrics(us_symbol)
        except Exception:
            pass
    market_cap = None
    if profile.get("marketCapitalization") and profile.get("currency"):
        rate = fx_rate(profile["currency"], currency)
        market_cap = profile["marketCapitalization"] * 1e6 * rate if rate else None

    # The saved snapshot knows the sector, and gives a market-cap estimate when Finnhub has none
    # (TSX-only companies): snapshot market cap scaled by the price move since then.
    snap = snapshot.lookup(ticker, us_symbol)
    if market_cap is None and snap and snap["symbol"] == ticker and snap["marketCap"] and snap["price"]:
        market_cap = snap["marketCap"] * price / snap["price"]

    try:
        description = wiki.company_summary(profile.get("name") or name)
    except Exception:
        description = None
    avg_volume = metrics.get("3MonthAverageTradingVolume")

    return {
        "symbol": ticker,
        "name": name,
        "exchange": meta.get("fullExchangeName") or meta.get("exchangeName"),
        "currency": currency,
        "sector": snap["sector"] if snap else None,
        "industry": profile.get("finnhubIndustry"),
        "description": description,
        "website": profile.get("weburl"),
        "price": price,
        "change": price - prev if prev else None,
        "changePercent": (price / prev - 1) * 100 if prev else None,
        "marketCap": clean(market_cap),
        # Shares in this listing's units (also right for ADRs and share classes), from market cap.
        "sharesOutstanding": clean(market_cap / price) if market_cap and price else None,
        "fiftyTwoWeekLow": clean(meta.get("fiftyTwoWeekLow")) or float(closes.min()),
        "fiftyTwoWeekHigh": clean(meta.get("fiftyTwoWeekHigh")) or float(closes.max()),
        "volume": clean(meta.get("regularMarketVolume")),
        "averageVolume": avg_volume * 1e6 if avg_volume else None,
        "dividendYield": clean(metrics.get("dividendYieldIndicatedAnnual")),
        "beta": clean(metrics.get("beta")),
        "targetLow": None,  # analyst targets aren't in Finnhub's free plan
        "targetMean": None,
        "targetHigh": None,
        "analystCount": None,
        "reportingCurrency": profile.get("currency"),
        "profileSource": "price data + Finnhub" + (" + Wikipedia" if description else ""),
    }


# Chart ranges -> (yfinance period, bar interval). Weekly bars keep the 5Y chart light.
RANGES = {
    "1M": ("1mo", "1d"),
    "6M": ("6mo", "1d"),
    "1Y": ("1y", "1d"),
    "5Y": ("5y", "1wk"),
}


@cached("history", 15 * MINUTE)
def history(ticker: str, range_: str) -> list:
    period, interval = RANGES[range_]
    df = yf.Ticker(ticker).history(period=period, interval=interval, auto_adjust=True)
    if df.empty:
        raise TickerNotFound(ticker)
    return [
        {"time": idx.strftime("%Y-%m-%d"), "close": round(float(row["Close"]), 4)}
        for idx, row in df.iterrows()
        if clean(float(row["Close"])) is not None
    ]


def normalize(ticker: Optional[str]) -> str:
    return (ticker or "").strip().upper()


@cached("yahoo-statements", DAY)
def statements(ticker: str, period: str) -> dict:
    """Raw statement tables from Yahoo: {"income": {"2025-09-30": {"Total Revenue": ...}}, ...}.

    Yahoo usually has about 4-5 annual periods and 5-6 quarters.
    """
    tk = yf.Ticker(ticker)
    quarterly = period == "quarterly"
    frames = {
        "income": tk.quarterly_income_stmt if quarterly else tk.income_stmt,
        "balance": tk.quarterly_balance_sheet if quarterly else tk.balance_sheet,
        "cashflow": tk.quarterly_cashflow if quarterly else tk.cashflow,
    }
    out = {}
    for name, df in frames.items():
        out[name] = {
            col.strftime("%Y-%m-%d"): {row: clean(float(v)) for row, v in df[col].items() if clean(float(v)) is not None}
            for col in df.columns
        }
    if not any(out.values()):
        raise TickerNotFound(ticker)
    # The currency the company *reports* in, which can differ from the trading currency
    # (e.g. Shopify trades in CAD on the TSX but reports in USD).
    out["currency"] = info(ticker).get("financialCurrency")  # None if Yahoo's profile is unavailable
    return out


@cached("splits", DAY)
def splits(ticker: str) -> list:
    """[[date, ratio], ...], e.g. Apple's 4-for-1 split: ["2020-08-31", 4.0]."""
    return [[idx.strftime("%Y-%m-%d"), float(r)] for idx, r in yf.Ticker(ticker).splits.items()]


@cached("daily-closes", DAY)
def daily_closes(ticker: str) -> dict:
    """{date: close} for the full history. Split-adjusted but NOT dividend-adjusted,
    which is what you want for historical P/E, P/B, etc."""
    df = yf.Ticker(ticker).history(period="max", interval="1d", auto_adjust=False)
    return {idx.strftime("%Y-%m-%d"): float(c) for idx, c in df["Close"].items() if clean(float(c)) is not None}


def _plain_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", re.sub(r"\b(inc|corp|corporation|ltd|limited|company|co|plc)\b\.?", "", (name or "").lower()))


def _us_symbol(ticker: str, name: str):
    """The same company's US ticker, matched by exact company name (never by symbol:
    CNR on a US exchange is a different company from CNR.TO)."""
    if "." not in ticker:
        return ticker
    for q in yf.Search(name, max_results=10, news_count=0).quotes:
        if q.get("quoteType") == "EQUITY" and q.get("exchange") in US_EXCHANGES and "." not in q.get("symbol", ""):
            if _plain_name(q.get("longname") or q.get("shortname")) == _plain_name(name):
                return q["symbol"]
    return None


@cached("us-listing", DAY)
def us_listing(ticker: str):
    """The same company's US ticker for a TSX listing (SHOP.TO -> SHOP, CNR.TO -> CNI), or None."""
    if "." not in ticker:
        return ticker
    return _us_symbol(ticker, overview(ticker)["name"])


MARKET = [("^GSPC", "S&P 500"), ("^IXIC", "Nasdaq"), ("^GSPTSE", "TSX"), ("CAD=X", "USD/CAD"), ("^TNX", "US 10Y")]


@cached("market", 10 * MINUTE)
def market() -> list:
    """Latest level and daily change for a few headline markets (shown in the top bar)."""
    out = []
    for symbol, label in MARKET:
        try:
            closes = yf.Ticker(symbol).history(period="5d")["Close"].dropna()
            last, prev = float(closes.iloc[-1]), float(closes.iloc[-2])
            item = {"symbol": symbol, "label": label, "value": last, "changePercent": (last / prev - 1) * 100}
            if symbol == "^TNX":  # a yield (in %): its daily move is quoted in basis points
                item["changeBp"] = (last - prev) * 100
            out.append(item)
        except Exception:
            out.append({"symbol": symbol, "label": label, "value": None, "changePercent": None})
    return out
