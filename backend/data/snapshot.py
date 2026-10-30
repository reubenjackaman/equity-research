"""
The saved market snapshot (screener_snapshot.json): ~2,750 US and TSX companies over $300M
with their sector, market cap and price as of the snapshot date.

Besides powering Explore when Yahoo's screener is unavailable, it fills gaps on servers
where Yahoo's company profile is blocked: a company's sector, a market-cap estimate, and
similar-size companies in the same sector for comps.
"""

import json
import math
from functools import lru_cache
from pathlib import Path

PATH = Path(__file__).resolve().parent / "screener_snapshot.json"


@lru_cache(maxsize=1)
def load() -> dict:
    if not PATH.exists():
        return {"date": None, "rows": []}
    return json.loads(PATH.read_text())


@lru_cache(maxsize=1)
def _by_symbol() -> dict:
    return {r["symbol"]: r for r in load()["rows"]}


def lookup(*symbols):
    """The snapshot row for the first symbol found (e.g. try SHOP.TO, then SHOP), or None."""
    for s in symbols:
        if s and s in _by_symbol():
            return _by_symbol()[s]
    return None


def similar(sector: str, market_cap: float, exclude: set, country: str | None = None, n: int = 5) -> list:
    """Companies in the same sector whose market cap is closest to `market_cap` (on a log scale)."""
    rows = [r for r in load()["rows"] if r["sector"] == sector and r["symbol"] not in exclude and r["marketCap"]]
    if country:
        rows = [r for r in rows if r["country"] == country] or rows
    rows.sort(key=lambda r: abs(math.log(r["marketCap"] / market_cap)) if market_cap else -r["marketCap"])
    return [r["symbol"] for r in rows[:n]]
