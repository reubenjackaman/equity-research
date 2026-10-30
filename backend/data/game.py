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

from . import news, snapshot, wiki, yahoo
from .cache import DAY, cached

LAUNCH = date(2026, 10, 30)  # puzzle #1
MAX_GUESSES = 6
MIN_ANSWER_CAP_USD = 400e9  # answers are companies almost everyone has heard of
OVERRIDES = {1: "INTC"}  # hand-picked answers, by puzzle number
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
    if puzzle in OVERRIDES:
        return _companies()[OVERRIDES[puzzle]]
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


# ---------- Hints: each one uses up a guess (the page counts it) ----------

HINTS = {
    "news": "Recent headline",
    "product": "What they sell",
    "industry": "Industry",
    "letter": "First letter",
}
BLOCK = "█████"
# Headlines where a bank or analyst is rating some other company.
ABOUT_OTHERS = re.compile(r"\b(target|upgrade|downgrade|rating|picks?|says|praises|recommends|lifts|raises .* to)\b", re.IGNORECASE)

# Capitalized words that don't give a company away, so they stay readable.
SAFE_WORDS = set("""
    A After All Amid An Analyst Analysts And Are As At Before But By CEO CFO COO Can Could Earnings EPS ETF For From Fund GDP
    Has Have How IPO If In Inc Investors Is It Its Market Markets New No Not Of On Or Revenue Sales Shares Should Stock
    Stocks That The These This To Top U.S. US USA UK Wall Street What When Where Why Will With Would AI American Canadian
    Chinese European January February March April May June July August September October November December Monday Tuesday
    Wednesday Thursday Friday Saturday Sunday Dow Nasdaq NYSE Fed S&P
""".split())
GENERIC_NAME_WORDS = {"inc", "incorporated", "corp", "corporation", "company", "co", "ltd", "limited", "plc", "group", "holdings", "the", "of", "and"}


def _name_words(row: dict) -> list:
    words = re.findall(r"[A-Za-z0-9&'-]+", row["name"])
    return [w for w in words if len(w) > 1 and w.lower() not in GENERIC_NAME_WORDS]


def _ticker(row: dict) -> str:
    return row["symbol"].split(".")[0].split("-")[0]


def _redact(text: str, row: dict) -> str:
    """Blacks out the company's name, ticker and anything else capitalized (products, people, places)."""
    for word in sorted(_name_words(row), key=len, reverse=True):
        text = re.sub(rf"\b{re.escape(word)}(?:'s|’s)?\b", BLOCK, text, flags=re.IGNORECASE)
    # Exact case only: the ticker COST shouldn't hide the word "cost".
    text = re.sub(rf"\b{re.escape(_ticker(row))}(?:'s|’s)?\b", BLOCK, text)

    def mask(match):
        word = match.group(0).rstrip(".,")
        tail = match.group(0)[len(word):]
        bare = re.sub(r"(?:'s|’s)$", "", word)
        keep = bare in SAFE_WORDS or match.group(0) in SAFE_WORDS or re.fullmatch(r"Q[1-4]|\d.*", bare)
        return (word if keep else BLOCK) + tail

    # Any word with a capital in it, so "iPhone" and "McDonald" are caught as well as "Azure".
    text = re.sub(r"[A-Za-z0-9&'’.-]*[A-Z][A-Za-z0-9&'’.-]*", mask, text)
    text = re.sub(rf"{BLOCK}(?:[\s,&]+{BLOCK})+", BLOCK, text)
    return re.sub(rf"{BLOCK},? Inc\b\.?", BLOCK, text)


def _hidden_share(text: str) -> float:
    return text.count(BLOCK) / max(len(text.split()), 1)


def _names_company(headline: str, row: dict) -> bool:
    """Only headlines that actually name the answer: others are often about a different company."""
    if re.search(rf"\b{re.escape(_ticker(row))}\b", headline):
        return True
    return any(re.search(rf"\b{re.escape(w)}\b", headline, re.IGNORECASE) for w in _name_words(row)[:2])


def _news_hint(row: dict) -> str:
    articles = news.company_news(row["symbol"], row["name"])["articles"]
    options = [
        _redact(a["headline"], row) for a in articles[:80]
        if 40 <= len(a["headline"]) <= 130 and _names_company(a["headline"], row) and not ABOUT_OTHERS.search(a["headline"])
    ]
    # Fewest blanks first: one blank means the only thing hidden is the company itself.
    readable = [o for o in options if o.count(BLOCK) <= 2 and _hidden_share(o) <= 0.3]
    if not readable:
        raise ValueError("No usable headline right now. Try a different hint.")
    return min(readable, key=lambda o: (o.count(BLOCK), _hidden_share(o)))


def _product_hint(row: dict) -> str:
    company = yahoo.overview(row["symbol"])
    text = company.get("description") or wiki.company_summary(row["name"])
    if not text:
        raise ValueError("No description available right now. Try a different hint.")
    # A period after "Inc" doesn't end a sentence.
    sentences = [_redact(t, row) for t in re.split(r"(?<!\bInc\.)(?<!\bCo\.)(?<!\bCorp\.)(?<!\bLtd\.)(?<=[.!?])\s+", text)]
    kept = sentences[0]
    if len(kept) > 260:
        return kept[:260].rsplit(" ", 1)[0].rstrip(",;") + "…"
    for sentence in sentences[1:4]:
        if len(kept) + len(sentence) < 260 and _hidden_share(sentence) <= 0.2:
            kept += " " + sentence
    return kept


@cached("game-hint", DAY)
def hint(puzzle: int, kind: str) -> dict:
    if not 1 <= puzzle <= today_number():
        raise ValueError("That puzzle isn't available.")
    if kind not in HINTS:
        raise ValueError("Unknown hint.")
    row = _answer(puzzle)
    if kind == "news":
        text = _news_hint(row)
    elif kind == "product":
        text = _product_hint(row)
    elif kind == "industry":
        text = yahoo.overview(row["symbol"]).get("industry")
        if not text:
            raise ValueError("No industry available right now. Try a different hint.")
    else:
        text = f"The company's name starts with {row['name'][0].upper()}"
    return {"kind": kind, "label": HINTS[kind], "text": text}
