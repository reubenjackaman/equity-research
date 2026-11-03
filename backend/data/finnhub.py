"""
Finnhub (free key, FINNHUB_API_KEY in .env): company profile, key metrics and peers.

Used as a fallback when Yahoo's company-profile endpoint refuses requests, which it does
for many cloud servers (including Render). Free tier: 60 calls/minute; results are cached.

Each function raises if Finnhub can't answer, so a temporary failure is never cached.
"""

import os

import requests

from .cache import DAY, cached

BASE = "https://finnhub.io/api/v1"


class FinnhubUnavailable(Exception):
    pass


def _get(path: str, **params):
    key = os.getenv("FINNHUB_API_KEY")
    if not key:
        raise FinnhubUnavailable("FINNHUB_API_KEY is not set")
    res = requests.get(f"{BASE}/{path}", params={**params, "token": key}, timeout=15)
    if not res.ok:
        raise FinnhubUnavailable(f"HTTP {res.status_code}")  # never echo the URL: it contains the key
    return res.json()


def _symbol(ticker: str) -> str:
    return ticker.replace("-", ".")  # Finnhub writes share classes as BRK.B, Yahoo as BRK-B


@cached("fh-profile", DAY)
def profile(ticker: str) -> dict:
    """Name, home-listing currency, industry, website, market cap (millions) and shares (millions)."""
    data = _get("stock/profile2", symbol=_symbol(ticker))
    if not data:
        raise FinnhubUnavailable(f"no profile for {ticker}")
    return data


@cached("fh-metrics", DAY)
def metrics(ticker: str) -> dict:
    """Key figures such as beta, dividend yield and average volume (volume in millions)."""
    return _get("stock/metric", symbol=_symbol(ticker), metric="all").get("metric") or {}


@cached("fh-peers", DAY)
def peers(ticker: str) -> list:
    """Companies Finnhub groups with this one (same country and industry)."""
    return [p for p in _get("stock/peers", symbol=_symbol(ticker)) if p != _symbol(ticker)]


@cached("fh-recommendations", DAY)
def recommendations(ticker: str) -> list:
    """Monthly counts of analyst ratings (strong buy ... strong sell), newest first. US listings on the free plan."""
    return _get("stock/recommendation", symbol=_symbol(ticker))


@cached("fh-insiders", DAY)
def insider_transactions(ticker: str) -> list:
    """Insider trades filed with the SEC (Form 4), newest first. US listings only on the free plan."""
    return _get("stock/insider-transactions", symbol=_symbol(ticker)).get("data") or []


@cached("fh-earnings", DAY)
def earnings_surprises(ticker: str) -> list:
    """Reported vs. expected EPS for the last four quarters, newest first."""
    return _get("stock/earnings", symbol=_symbol(ticker))


@cached("fh-next-earnings", DAY)
def next_earnings(ticker: str, start: str, end: str) -> list:
    """Scheduled earnings reports for one company between two dates."""
    return _get("calendar/earnings", symbol=_symbol(ticker), **{"from": start, "to": end}).get("earningsCalendar") or []
