"""
Everything we read from Yahoo Finance (through the yfinance library).

yfinance needs no API key and covers both US and TSX listings
(TSX tickers end in ".TO", TSX Venture in ".V").
"""

import math
import re
import warnings
from typing import Optional

import yfinance as yf

# yfinance triggers harmless pandas deprecation warnings; hide them to keep the server log readable.
warnings.filterwarnings("ignore", module="yfinance")

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


@cached("overview", 15 * MINUTE)
def overview(ticker: str) -> dict:
    info = yf.Ticker(ticker).info or {}

    price = info.get("currentPrice") or info.get("regularMarketPrice")
    name = info.get("longName") or info.get("shortName")
    # yfinance doesn't raise for unknown symbols; it just returns an almost-empty dict.
    if not name or price is None:
        raise TickerNotFound(ticker)

    prev_close = info.get("previousClose") or info.get("regularMarketPreviousClose")
    change = price - prev_close if prev_close else None

    return {
        "symbol": info.get("symbol", ticker),
        "name": name,
        "exchange": info.get("fullExchangeName") or info.get("exchange"),
        "currency": info.get("currency"),
        "sector": info.get("sector"),
        "industry": info.get("industry"),
        "description": info.get("longBusinessSummary"),
        "website": info.get("website"),
        "price": clean(price),
        "change": clean(change),
        "changePercent": clean(change / prev_close * 100) if change is not None else None,
        "marketCap": clean(info.get("marketCap")),
        "sharesOutstanding": clean(info.get("sharesOutstanding")),
        "fiftyTwoWeekLow": clean(info.get("fiftyTwoWeekLow")),
        "fiftyTwoWeekHigh": clean(info.get("fiftyTwoWeekHigh")),
        "volume": clean(info.get("volume") or info.get("regularMarketVolume")),
        "averageVolume": clean(info.get("averageVolume")),
        "dividendYield": clean(info.get("dividendYield")),
        "beta": clean(info.get("beta")),
        # Wall Street analysts' 12-month price targets (where Yahoo has them).
        "targetLow": clean(info.get("targetLowPrice")),
        "targetMean": clean(info.get("targetMeanPrice")),
        "targetHigh": clean(info.get("targetHighPrice")),
        "analystCount": clean(info.get("numberOfAnalystOpinions")),
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
    out["currency"] = (tk.info or {}).get("financialCurrency")
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


@cached("us-listing", DAY)
def us_listing(ticker: str):
    """The same company's US ticker for a TSX listing (SHOP.TO -> SHOP, CNR.TO -> CNI), or None.

    Matched by exact company name, never by symbol: CNR on a US exchange is a different company.
    """
    if "." not in ticker:
        return ticker
    name = overview(ticker)["name"]
    for q in yf.Search(name, max_results=10, news_count=0).quotes:
        if q.get("quoteType") == "EQUITY" and q.get("exchange") in US_EXCHANGES and "." not in q.get("symbol", ""):
            if _plain_name(q.get("longname") or q.get("shortname")) == _plain_name(name):
                return q["symbol"]
    return None


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
