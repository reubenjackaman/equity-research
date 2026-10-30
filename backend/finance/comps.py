"""
Comparable companies ("comps").

Peers: Yahoo Finance's list of the largest companies in the same industry. Peers smaller
than 5% of the target's size are dropped (Apple's industry is otherwise full of tiny
companies), and if fewer than 4 remain, we fill up with the largest companies in the
same sector. You can always edit the list in the app.

Companies that report in a currency other than USD/CAD (usually foreign ADRs such as SK
Hynix "SKHY") are left out of suggestions: an ADR often represents a fraction or multiple
of an ordinary share, so per-share figures from Yahoo don't line up and the multiples are
unreliable. You can still add one manually; it gets a warning.

Every multiple comes from finance/ratios.py (latest TTM column), so each peer is measured
with exactly the same formulas as the target.

Implied value per share = peer median multiple × the target's own metric:
    P/E        -> median P/E × EPS
    P/S        -> median P/S × Revenue ÷ Shares
    P/B        -> median P/B × Equity ÷ Shares
    EV/EBITDA  -> (median EV/EBITDA × EBITDA − Net debt) ÷ Shares,  Net debt = EV − Market cap
"""

from concurrent.futures import ThreadPoolExecutor
from statistics import mean, median, quantiles

import yfinance as yf

from data import yahoo
from data.cache import DAY, MINUTE, cached
from finance import ratios

MAX_PEERS = 5
SAFE_CURRENCIES = {"USD", "CAD"}
MIN_RELATIVE_SIZE = 0.05

METRICS = [
    # key, label, format, ratio key in ratios.py, use latest annual instead of TTM
    ("pe", "P/E", "x", "pe", False),
    ("ev_ebitda", "EV/EBITDA", "x", "ev_ebitda", False),
    ("ps", "P/S", "x", "ps", False),
    ("pb", "P/B", "x", "pb", False),
    ("fcf_yield", "FCF yield", "pct", "fcf_yield", False),
    ("gross_margin", "Gross margin", "pct", "gross_margin", False),
    ("operating_margin", "Operating margin", "pct", "operating_margin", False),
    ("roe", "ROE", "pct", "roe", False),
    ("revenue_growth", "Revenue growth (last FY)", "pct", "revenue_growth", True),
]


def _same_company(a: str, b: str) -> bool:
    return a.split(".")[0].upper() == b.split(".")[0].upper()


@cached("peers", DAY)
def suggest_peers(ticker: str) -> dict:
    info = yf.Ticker(ticker).info or {}
    industry_key, sector_key = info.get("industryKey"), info.get("sectorKey")
    if not industry_key:
        return {"peers": [], "basis": None, "industry": None}

    table = yf.Industry(industry_key).top_companies
    weights = {sym: float(row["market weight"]) for sym, row in table.iterrows()} if table is not None else {}
    own_weight = next((w for sym, w in weights.items() if _same_company(sym, ticker)), None)

    peers = []
    for sym, w in sorted(weights.items(), key=lambda kv: -kv[1]):
        if _same_company(sym, ticker):
            continue
        # Skip companies that are tiny relative to the target (if we know the target's weight).
        if own_weight and w / own_weight < MIN_RELATIVE_SIZE:
            continue
        peers.append(sym)
    peers = peers[:MAX_PEERS]
    basis = f"Largest companies in {info.get('industry')}"

    if len(peers) < 4 and sector_key:
        sector_table = yf.Sector(sector_key).top_companies
        for sym in (sector_table.index if sector_table is not None else []):
            if len(peers) >= MAX_PEERS:
                break
            if not _same_company(sym, ticker) and sym not in peers:
                peers.append(sym)
        basis += f", topped up with the largest companies in the {info.get('sector')} sector"

    return {"peers": peers, "basis": basis, "industry": info.get("industry")}


def _row(ticker: str) -> dict:
    data = ratios.build(ticker)
    overview = yahoo.overview(ticker)
    by_key = {r["key"]: r["values"] for r in data["ratios"]}
    labels = [c["label"] for c in data["columns"]]
    last_fy = max(i for i, label in enumerate(labels) if label != "TTM")

    snap = data["snapshot"]
    cap_usd = None
    if snap["marketCap"] is not None:
        rate = 1.0 if data["currency"] == "USD" else _usd_rate(data["currency"])
        cap_usd = snap["marketCap"] * rate if rate else None

    row = {
        "symbol": ticker,
        "name": overview["name"],
        "reportingCurrency": data["currency"],
        "warning": None if data["currency"] in SAFE_CURRENCIES else (
            f"Reports in {data['currency']}. If this is an ADR, per-share multiples may be distorted."
        ),
        "industry": overview.get("industry"),
        "period": snap["label"],
        "marketCapUsd": cap_usd,
        "snapshot": snap,
    }
    for key, _label, _fmt, ratio_key, annual in METRICS:
        values = by_key[ratio_key]
        row[key] = values[last_fy] if annual else values[-1]
    return row


@cached("usd-rate", DAY)
def _usd_rate(ccy: str):
    closes = yahoo.daily_closes(f"{ccy}USD=X")
    return closes[max(closes)] if closes else None


@cached("comps", 15 * MINUTE)
def build(ticker: str, peers_csv: str) -> dict:
    suggestion = suggest_peers(ticker)
    peers = [p for p in peers_csv.split(",") if p] if peers_csv else suggestion["peers"]
    peers = [p.strip().upper() for p in peers if not _same_company(p, ticker)][:10]

    # Fetch all companies in parallel; one bad ticker shouldn't sink the table.
    with ThreadPoolExecutor(max_workers=6) as pool:
        futures = {sym: pool.submit(_row, sym) for sym in [ticker, *peers]}
    rows, failed = {}, []
    for sym, fut in futures.items():
        try:
            rows[sym] = fut.result()
        except Exception as exc:
            print(f"[comps] skipped {sym}: {type(exc).__name__}: {exc}")
            failed.append(sym)
    if ticker not in rows:
        raise yahoo.TickerNotFound(ticker)

    target = rows[ticker]
    excluded = []
    if not peers_csv:  # auto-suggested: drop foreign-reporting ADRs (see module docstring)
        excluded = [p for p in peers if p in rows and rows[p]["reportingCurrency"] not in SAFE_CURRENCIES]
    peer_rows = [rows[p] for p in peers if p in rows and p not in excluded]

    stats = {"median": {}, "mean": {}}
    # Peers with a currency warning are shown but kept out of the median/mean.
    clean_rows = [r for r in peer_rows if not r["warning"]]
    for key, *_ in METRICS:
        vals = [r[key] for r in clean_rows if r[key] is not None]
        stats["median"][key] = median(vals) if vals else None
        stats["mean"][key] = mean(vals) if vals else None

    # Middle half of the peer group (25th-75th percentile), used for the football field's ranges.
    spread = {}
    for key, *_ in METRICS:
        vals = sorted(r[key] for r in clean_rows if r[key] is not None)
        if len(vals) >= 3:
            q = quantiles(vals, n=4, method="inclusive")
            spread[key] = (q[0], q[2])
        elif vals:
            spread[key] = (vals[0], vals[-1])

    return {
        "symbol": ticker,
        "basis": suggestion["basis"] if not peers_csv else "Your chosen peers",
        "suggested": suggestion["peers"],
        "metrics": [{"key": k, "label": label, "format": fmt} for k, label, fmt, _r, _a in METRICS],
        "target": _public(target),
        "peers": [_public(r) for r in peer_rows],
        "failed": failed,
        "excluded": excluded,
        "stats": stats,
        "implied": _implied(target["snapshot"], stats["median"], spread),
    }


def _public(row: dict) -> dict:
    return {k: v for k, v in row.items() if k != "snapshot"}


def _implied(s: dict, med: dict, spread: dict) -> list:
    """Target's value per share (trading currency) if it traded at peer multiples:
    at the median, and across the middle half of peers (25th-75th percentile)."""
    shares, fx = s["shares"], s["fx"]
    net_debt = s["enterpriseValue"] - s["marketCap"] if s["enterpriseValue"] is not None and s["marketCap"] is not None else None
    price_trading = s["price"] * fx if s["price"] is not None else None

    def per_share(equity_value):
        return equity_value / shares * fx if equity_value is not None and shares else None

    out = []
    for key, label, formula, metric, compute in [
        ("pe", "P/E", "Peer median P/E × EPS", s["eps"],
         lambda m: m * s["eps"] * fx),
        ("ev_ebitda", "EV/EBITDA", "(Peer median EV/EBITDA × EBITDA − Net debt) ÷ Shares", s["ebitda"],
         lambda m: per_share(m * s["ebitda"] - net_debt) if net_debt is not None else None),
        ("ps", "P/S", "Peer median P/S × Revenue ÷ Shares", s["revenue"],
         lambda m: per_share(m * s["revenue"])),
        ("pb", "P/B", "Peer median P/B × Equity ÷ Shares", s["equity"],
         lambda m: per_share(m * s["equity"])),
    ]:
        usable = metric is not None and metric > 0
        m = med.get(key)
        value = compute(m) if m is not None and usable else None
        lo_m, hi_m = spread.get(key, (None, None))
        low = compute(lo_m) if lo_m is not None and usable else None
        high = compute(hi_m) if hi_m is not None and usable else None
        out.append({
            "key": key, "label": label, "formula": formula, "medianMultiple": m, "value": value,
            "lowMultiple": lo_m, "highMultiple": hi_m, "low": low, "high": high,
            "upside": value / price_trading - 1 if value is not None and price_trading else None,
        })
    return out
