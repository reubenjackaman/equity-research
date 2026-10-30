"""
Mystery Company: a daily guess-the-company game built on the saved market snapshot.

Everyone gets the same company each day. The answer comes from a fixed shuffled list, by puzzle number,
so no database is needed and a server restart can't change it. It stays on the server: the
page only receives the clues for each guess, and the answer once the game is over.

Clues say where the ANSWER sits compared with the guess ("higher" = the answer is higher).
All figures come from the snapshot, so they're as of the snapshot date.
"""

import hashlib
import re
from datetime import date, datetime
from functools import lru_cache
from zoneinfo import ZoneInfo

from . import snapshot, yahoo

LAUNCH = date(2026, 10, 30)  # puzzle #1
MAX_GUESSES = 6
MIN_ANSWER_CAP_USD = 30e9  # answers are companies people have a fair chance of knowing
FALLBACK_CAD_USD = 0.72


def _plain_name(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", (name or "").lower())


@lru_cache(maxsize=1)
def _cad_usd() -> float:
    try:
        return yahoo.fx_rate("CAD", "USD") or FALLBACK_CAD_USD
    except Exception:
        return FALLBACK_CAD_USD


def _cap_usd(row: dict):
    cap = row.get("marketCap")
    if cap is None:
        return None
    return cap * _cad_usd() if row.get("currency") == "CAD" else cap


@lru_cache(maxsize=1)
def _companies() -> dict:
    """One row per company, by symbol. Share classes and dual listings count once; a company
    listed in both countries appears under its TSX listing."""
    by_name = {}
    for row in snapshot.load()["rows"]:
        key = _plain_name(row["name"])
        current = by_name.get(key)
        if current is None or (row["country"] == "ca" and current["country"] != "ca"):
            by_name[key] = row
    return {r["symbol"]: r for r in by_name.values()}


@lru_cache(maxsize=1)
def _answer_pool() -> list:
    rows = [
        r for r in _companies().values()
        if (_cap_usd(r) or 0) >= MIN_ANSWER_CAP_USD and r.get("pe") is not None and r.get("yearChangePercent") is not None
    ]
    # A fixed shuffle: every company gets a turn before any repeats.
    return sorted(rows, key=lambda r: hashlib.sha256(f"mystery-company-{r['symbol']}".encode()).hexdigest())


def today_number() -> int:
    today = datetime.now(ZoneInfo("America/Toronto")).date()
    return (today - LAUNCH).days + 1


def _answer(puzzle: int) -> dict:
    pool = _answer_pool()
    return pool[(puzzle - 1) % len(pool)]


def _compare(guess, answer, close) -> str:
    """Where the answer sits relative to the guess; "match" when they're within `close`."""
    if guess is None or answer is None:
        return "match" if guess is None and answer is None else "unknown"
    if close(guess, answer):
        return "match"
    return "higher" if answer > guess else "lower"


def _within_percent(pct: float):
    return lambda a, b: abs(a - b) <= pct / 100 * max(abs(a), abs(b))


def _public(row: dict) -> dict:
    return {
        "symbol": row["symbol"],
        "name": row["name"],
        "sector": row["sector"],
        "country": "Canada" if row["country"] == "ca" else "US",
        "marketCapUsd": _cap_usd(row),
        "pe": row.get("pe"),
        "dividendYield": row.get("dividendYield") or 0,
        "yearChangePercent": row.get("yearChangePercent"),
    }


def today() -> dict:
    return {
        "puzzle": today_number(),
        "maxGuesses": MAX_GUESSES,
        "snapshotDate": snapshot.load()["date"],
        # Largest first, so typing "apple" suggests Apple Inc. before Apple Hospitality REIT.
        "companies": [
            {"symbol": r["symbol"], "name": r["name"]}
            for r in sorted(_companies().values(), key=lambda r: _cap_usd(r) or 0, reverse=True)
        ],
    }


def guess(puzzle: int, attempt: int, symbol: str) -> dict:
    if not 1 <= puzzle <= today_number():
        raise ValueError("That puzzle isn't available.")
    row = _companies().get(symbol)
    if row is None:
        raise ValueError("Pick a company from the list.")
    answer = _answer(puzzle)
    g, a = _public(row), _public(answer)
    correct = row["symbol"] == answer["symbol"]
    clues = {
        "sector": "match" if g["sector"] == a["sector"] else "miss",
        "country": "match" if g["country"] == a["country"] else "miss",
        "marketCap": _compare(g["marketCapUsd"], a["marketCapUsd"], _within_percent(10)),
        "pe": _compare(g["pe"], a["pe"], _within_percent(10)),
        "dividend": _compare(g["dividendYield"], a["dividendYield"], lambda x, y: abs(x - y) <= 0.25),
        "yearReturn": _compare(g["yearChangePercent"], a["yearChangePercent"], lambda x, y: abs(x - y) <= 5),
    }
    finished = correct or attempt >= MAX_GUESSES
    return {"guess": g, "clues": clues, "correct": correct, "answer": a if finished else None}

