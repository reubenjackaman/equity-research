"""
Recent news about a company, from Yahoo Finance (no key) and Finnhub (free key, optional).

Yahoo's news search works best with the ticker for US stocks and with the company name
for TSX stocks, so we search both and merge. Finnhub is added when FINNHUB_API_KEY is set
in .env (free tier: 60 calls/minute, the latest ~250 articles). Finnhub's free plan only
covers US symbols, so TSX companies use their US listing when they have one (CNR.TO -> CNI).

Each article is flagged "about" when the headline names the company (or its ticker), as
opposed to articles that only mention it in passing. The app shows "about" articles by
default, with a toggle for everything.
"""

import os
import re
from datetime import date, datetime, timedelta, timezone

import requests
import yfinance as yf

from . import yahoo
from .cache import MINUTE, cached

FINNHUB_URL = "https://finnhub.io/api/v1/company-news"
NAME_SUFFIXES = r"\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|holdings?|group|sa|ag|nv|the)\b\.?|\.com\b"
# First words too common to identify a company on their own ("Royal" Bank, "Canadian" National).
GENERIC_WORDS = {
    "american", "first", "general", "united", "national", "canadian", "royal", "bank", "international",
    "global", "new", "southern", "northern", "eastern", "western", "digital", "capital", "energy",
    "financial", "pacific", "atlantic", "great", "the", "advanced", "applied", "core", "public",
}


def short_name(name: str) -> str:
    """'Apple Inc.' -> 'Apple', 'Royal Bank of Canada' -> 'Royal Bank', 'Amazon.com, Inc.' -> 'Amazon'."""
    cleaned = re.sub(NAME_SUFFIXES, "", name or "", flags=re.IGNORECASE)
    words = [w for w in re.split(r"[\s,]+", cleaned) if w]
    return " ".join(words[:2]) if len(words) > 1 else (words[0] if words else "")


def name_patterns(name: str) -> list:
    """Ways a headline might name the company: 'Costco Wholesale' and also just 'Costco'."""
    short = short_name(name)
    patterns = [short] if short else []
    first = short.split(" ")[0] if short else ""
    if " " in short and len(first) >= 4 and first.lower() not in GENERIC_WORDS:
        patterns.append(first)
    return patterns


def initials(name: str):
    """'Royal Bank of Canada' -> 'RBC' (only used when 3+ letters, matched in capitals)."""
    words = re.sub(NAME_SUFFIXES, "", name or "", flags=re.IGNORECASE).split()
    letters = "".join(w[0] for w in words if w[:1].isupper())
    return letters if len(letters) >= 3 else None


def _yahoo(query: str) -> list:
    results = yf.Search(query, news_count=30, max_results=1).news or []
    return [
        {
            "headline": n.get("title"),
            "source": n.get("publisher"),
            "url": n.get("link"),
            "published": datetime.fromtimestamp(n["providerPublishTime"], tz=timezone.utc).isoformat(),
        }
        for n in results
        if n.get("title") and n.get("link") and n.get("providerPublishTime")
    ]


def _finnhub(ticker: str) -> list:
    key = os.getenv("FINNHUB_API_KEY")
    if not key:
        return []
    today = date.today()
    res = requests.get(
        FINNHUB_URL,
        # Finnhub writes share classes as BRK.B, Yahoo as BRK-B.
        params={"symbol": ticker.replace("-", "."), "from": (today - timedelta(days=30)).isoformat(), "to": today.isoformat(), "token": key},
        timeout=15,
    )
    if not res.ok:
        # Never echo the URL: it contains the API key.
        raise RuntimeError(f"HTTP {res.status_code}")
    return [
        {
            "headline": n.get("headline"),
            "source": n.get("source"),
            "url": n.get("url"),
            "published": datetime.fromtimestamp(n["datetime"], tz=timezone.utc).isoformat(),
            "summary": n.get("summary") or None,
        }
        for n in res.json()
        if n.get("headline") and n.get("url") and n.get("datetime")
    ]


@cached("news", 30 * MINUTE)
def company_news(ticker: str, company_name: str) -> dict:
    base = ticker.split(".")[0]
    name = short_name(company_name)
    try:
        finnhub_symbol = yahoo.us_listing(ticker)
    except Exception:
        finnhub_symbol = None

    articles, sources_used, errors = [], [], []
    for label, fetch in (
        ("Finnhub", lambda: _finnhub(finnhub_symbol) if finnhub_symbol else []),
        ("Yahoo Finance", lambda: _yahoo(ticker) + (_yahoo(company_name) if company_name else [])),
    ):
        try:
            found = fetch()
        except Exception as exc:  # one source failing shouldn't hide the other
            errors.append(f"{label}: {type(exc).__name__} {exc}"[:200])
            continue
        if found:
            sources_used.append(label)
            articles += found

    # De-duplicate: the same story often appears in several searches/sources.
    seen, unique = set(), []
    for a in articles:
        key = re.sub(r"\W+", "", a["headline"].lower())[:60]  # same story, slightly different wording
        if key in seen or a["url"] in seen:
            continue
        seen.update({key, a["url"]})
        unique.append(a)

    # "About" = the headline names the company (any case) or its ticker (capitals only, so "KO" but not "ko").
    names = name_patterns(company_name)
    tickers = {t for t in (base, finnhub_symbol, initials(company_name)) if t}
    name_re = re.compile("|".join(rf"\b{re.escape(n)}\b" for n in names), re.IGNORECASE) if names else None
    ticker_re = re.compile("|".join(rf"\b{re.escape(t)}\b" for t in tickers))
    for a in unique:
        a["about"] = bool((name_re and name_re.search(a["headline"])) or ticker_re.search(a["headline"]))

    unique.sort(key=lambda a: a["published"], reverse=True)  # newest first
    return {"articles": unique, "sources": sources_used, "matchName": name, "errors": errors}
