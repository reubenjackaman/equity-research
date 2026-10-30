"""
Company description from Wikipedia (free, no key), used when Yahoo's profile is unavailable.

We search Wikipedia for the company name and only accept a page whose summary mentions
the company's main name word, to avoid showing the wrong page (e.g. the fruit for "Apple").
"""

import os
import re

import requests

from .cache import DAY, cached

API = "https://en.wikipedia.org/w/api.php"
SUMMARY = "https://en.wikipedia.org/api/rest_v1/page/summary/{}"


def _headers() -> dict:
    # Wikimedia asks apps to identify themselves with a contact; reuse the one given to the SEC.
    contact = os.getenv("SEC_USER_AGENT") or "EquityResearchApp (educational project)"
    return {"User-Agent": f"{contact} equity-research-app/1.0"}


GENERIC = {"the", "inc", "corp", "corporation", "company", "co", "ltd", "limited", "plc", "group", "holdings"}


@cached("wiki-summary", 7 * DAY)
def company_summary(name: str):
    words = [w for w in re.findall(r"[A-Za-z][A-Za-z&'-]+", name or "") if w.lower() not in GENERIC]
    if not words:
        return None
    key_word = words[0].lower()
    res = requests.get(
        API, params={"action": "query", "list": "search", "srsearch": f"{name} company", "format": "json", "srlimit": 3},
        headers=_headers(), timeout=10,
    )
    res.raise_for_status()  # e.g. 429 "too many requests": raise so the miss isn't cached
    for hit in res.json().get("query", {}).get("search", []):
        res = requests.get(SUMMARY.format(hit["title"].replace(" ", "_")), headers=_headers(), timeout=10)
        if not res.ok:
            continue
        data = res.json()
        text = data.get("extract") or ""
        if data.get("type") == "standard" and key_word in text.lower() and re.search(r"compan|corporation|bank|firm|business", text, re.I):
            return text
    return None
