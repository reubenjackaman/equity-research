"""
Market-wide data for the terminal screens: world markets, movers, rates, the economy and the
earnings calendar. All free, no extra keys:

- Yahoo Finance price history (one batched download) for indices, currencies, commodities,
  crypto and the most-traded US and TSX stocks. Works on Render (only Yahoo's profile is blocked).
- FRED (St. Louis Fed) CSV downloads for US Treasury yields and US economic data.
- Bank of Canada "Valet" API for Government of Canada bond yields and Canadian data.
- Finnhub (free key) for the earnings calendar.

Each function raises if its source fails, so a failure is never cached.
"""

import csv
import io
import math
import warnings
from concurrent.futures import ThreadPoolExecutor
from datetime import date, timedelta

import requests
import yfinance as yf

warnings.filterwarnings("ignore", module="yfinance")

from . import finnhub, snapshot
from .cache import HOUR, MINUTE, cached

TIMEOUT = 20

# ---------- World markets ----------

BOARD = [
    ("Americas", [("^GSPC", "S&P 500"), ("^DJI", "Dow Jones"), ("^IXIC", "Nasdaq"), ("^RUT", "Russell 2000"),
                  ("^GSPTSE", "S&P/TSX"), ("^BVSP", "Bovespa"), ("^VIX", "VIX")]),
    ("Europe", [("^FTSE", "FTSE 100"), ("^GDAXI", "DAX"), ("^FCHI", "CAC 40"), ("^STOXX50E", "Euro Stoxx 50")]),
    ("Asia-Pacific", [("^N225", "Nikkei 225"), ("^HSI", "Hang Seng"), ("000001.SS", "Shanghai"), ("^AXJO", "ASX 200"),
                      ("^NSEI", "Nifty 50")]),
    ("Currencies", [("CAD=X", "USD/CAD"), ("EURUSD=X", "EUR/USD"), ("GBPUSD=X", "GBP/USD"), ("JPY=X", "USD/JPY"),
                    ("CNY=X", "USD/CNY"), ("DX-Y.NYB", "US Dollar Index")]),
    ("Commodities", [("CL=F", "WTI Crude"), ("BZ=F", "Brent Crude"), ("NG=F", "Natural Gas"), ("GC=F", "Gold"),
                     ("SI=F", "Silver"), ("HG=F", "Copper")]),
    ("Crypto", [("BTC-USD", "Bitcoin"), ("ETH-USD", "Ether")]),
    ("Yields", [("^IRX", "US 3M"), ("^FVX", "US 5Y"), ("^TNX", "US 10Y"), ("^TYX", "US 30Y")]),
]
YIELDS = {s for s, _ in BOARD[-1][1]}  # quoted in percent: their daily move is in basis points
SPARK_DAYS = 22  # about one month of trading days


def _closes(symbols: list, period: str) -> dict:
    """{symbol: [(date, close), ...]} from one batched Yahoo download, oldest first."""
    df = yf.download(symbols, period=period, interval="1d", progress=False, auto_adjust=True, threads=True)
    if df.empty:
        raise RuntimeError("no market data")
    close = df["Close"]
    out = {}
    for s in symbols:
        if s not in close:
            continue
        col = close[s].dropna()
        out[s] = [(idx.strftime("%Y-%m-%d"), float(v)) for idx, v in col.items() if math.isfinite(float(v))]
    return out


def _quote(symbol: str, label: str, series: list) -> dict:
    if len(series) < 2:
        return {"symbol": symbol, "label": label, "value": None, "change": None, "changePercent": None, "spark": []}
    last, prev = series[-1][1], series[-2][1]
    item = {
        "symbol": symbol, "label": label, "value": last, "change": last - prev, "changePercent": (last / prev - 1) * 100,
        "date": series[-1][0], "spark": [round(v, 4) for _, v in series[-SPARK_DAYS:]],
        "monthChangePercent": (last / series[-SPARK_DAYS][1] - 1) * 100 if len(series) >= SPARK_DAYS else None,
    }
    if symbol in YIELDS:
        item["changeBp"] = (last - prev) * 100
    return item


@cached("board", 5 * MINUTE)
def board() -> list:
    """World indices, currencies, commodities, crypto and yields: last level, daily move, one-month sparkline."""
    symbols = [s for _, items in BOARD for s, _ in items]
    closes = _closes(symbols, "2mo")
    return [{"group": group, "items": [_quote(s, label, closes.get(s, [])) for s, label in items]} for group, items in BOARD]


# ---------- Movers ----------

MOVER_UNIVERSE = 60  # the largest N companies per country in the snapshot
MOVERS_SHOWN = 10


def _universe(country: str) -> list:
    rows = [r for r in snapshot.load()["rows"] if r["country"] == country and r.get("marketCap")]
    rows.sort(key=lambda r: -r["marketCap"])
    return rows[:MOVER_UNIVERSE]


@cached("movers", 10 * MINUTE)
def movers() -> dict:
    """Biggest gainers, losers and most traded (by dollar volume) among the largest US and TSX companies."""
    out = {}
    for country in ("us", "ca"):
        rows = _universe(country)
        symbols = [r["symbol"] for r in rows]
        df = yf.download(symbols, period="5d", interval="1d", progress=False, auto_adjust=True, threads=True)
        if df.empty:
            raise RuntimeError("no movers data")
        quotes = []
        for r in rows:
            s = r["symbol"]
            try:
                closes = df["Close"][s].dropna()
                volume = float(df["Volume"][s].dropna().iloc[-1])
                last, prev = float(closes.iloc[-1]), float(closes.iloc[-2])
            except (KeyError, IndexError):
                continue
            if not (math.isfinite(last) and math.isfinite(prev) and prev):
                continue
            quotes.append({"symbol": s, "name": r["name"], "sector": r.get("sector"), "currency": r.get("currency"),
                           "price": last, "changePercent": (last / prev - 1) * 100, "volume": volume,
                           "dollarVolume": volume * last, "marketCap": r.get("marketCap")})
        by_change = sorted(quotes, key=lambda q: -q["changePercent"])
        advancing = sum(q["changePercent"] > 0 for q in quotes)
        out[country] = {
            "gainers": by_change[:MOVERS_SHOWN],
            "losers": by_change[::-1][:MOVERS_SHOWN],
            "active": sorted(quotes, key=lambda q: -q["dollarVolume"])[:MOVERS_SHOWN],
            "advancing": advancing,
            "declining": len(quotes) - advancing,
            "universe": len(quotes),
        }
    return out


# ---------- Rates ----------

US_CURVE = [("1M", "DGS1MO"), ("3M", "DGS3MO"), ("6M", "DGS6MO"), ("1Y", "DGS1"), ("2Y", "DGS2"), ("3Y", "DGS3"),
            ("5Y", "DGS5"), ("7Y", "DGS7"), ("10Y", "DGS10"), ("20Y", "DGS20"), ("30Y", "DGS30")]
CA_CURVE = [("3M", "V80691342"), ("2Y", "BD.CDN.2YR.DQ.YLD"), ("3Y", "BD.CDN.3YR.DQ.YLD"), ("5Y", "BD.CDN.5YR.DQ.YLD"),
            ("7Y", "BD.CDN.7YR.DQ.YLD"), ("10Y", "BD.CDN.10YR.DQ.YLD"), ("Long", "BD.CDN.LONG.DQ.YLD")]


def _fred_one(series: str, start: date) -> list:
    res = requests.get("https://fred.stlouisfed.org/graph/fredgraph.csv",
                       params={"id": series, "cosd": start.isoformat()}, timeout=TIMEOUT)
    res.raise_for_status()
    out = []
    for row in list(csv.reader(io.StringIO(res.text)))[1:]:
        try:
            out.append((row[0], float(row[1])))
        except (IndexError, ValueError):
            pass  # "." or blank: no value that day
    return out


def fred(series: list, start: date) -> dict:
    """{series_id: [(date, value), ...]} from FRED's public CSV download (no key needed), one request per series in parallel."""
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(zip(series, pool.map(lambda s: _fred_one(s, start), series)))
    if not any(results.values()):
        raise RuntimeError("no FRED data")
    return results


def boc(series: list, start: date) -> dict:
    """{series_id: [(date, value), ...]} from the Bank of Canada's Valet API (no key needed)."""
    res = requests.get(f"https://www.bankofcanada.ca/valet/observations/{','.join(series)}/json",
                       params={"start_date": start.isoformat()}, timeout=TIMEOUT)
    res.raise_for_status()
    out = {s: [] for s in series}
    for obs in res.json().get("observations", []):
        for s in series:
            try:
                out[s].append((obs["d"], float(obs[s]["v"])))
            except (KeyError, TypeError, ValueError):
                pass
    return out


def _on_or_before(points: list, day: str):
    """The last value on or before `day` (curves are compared with one month and one year ago)."""
    best = None
    for d, v in points:
        if d <= day:
            best = v
    return best


def _curve(tenors: list, data: dict) -> dict:
    latest = max((pts[-1][0] for pts in data.values() if pts), default=None)
    if not latest:
        raise RuntimeError("no yield data")
    today = date.fromisoformat(latest)
    ago = {"month": (today - timedelta(days=30)).isoformat(), "year": (today - timedelta(days=365)).isoformat()}
    points = []
    for tenor, sid in tenors:
        pts = data.get(sid) or []
        if not pts:
            continue
        points.append({"tenor": tenor, "now": pts[-1][1],
                       "monthAgo": _on_or_before(pts, ago["month"]), "yearAgo": _on_or_before(pts, ago["year"])})
    return {"date": latest, "points": points}


@cached("rates", 3 * HOUR)
def rates() -> dict:
    """US and Canadian government yield curves (now, a month ago, a year ago), the 10Y-2Y spread and policy rates."""
    start = date.today() - timedelta(days=2 * 365 + 10)
    us = fred([sid for _, sid in US_CURVE] + ["T10Y2Y", "DFEDTARU"], start)
    ca = boc([sid for _, sid in CA_CURVE] + ["V39079"], start)
    spread = us.get("T10Y2Y") or []
    weekly = spread[::5] + ([spread[-1]] if spread and spread[-1] not in spread[::5] else [])  # lighter chart
    return {
        "us": _curve(US_CURVE, us),
        "ca": _curve(CA_CURVE, ca),
        "spread": {"label": "US 10Y minus 2Y", "points": [{"time": d, "value": v} for d, v in weekly]},
        "policy": [
            {"label": "Fed funds target (upper)", "value": (us.get("DFEDTARU") or [(None, None)])[-1][1],
             "date": (us.get("DFEDTARU") or [(None, None)])[-1][0]},
            {"label": "Bank of Canada overnight target", "value": (ca.get("V39079") or [(None, None)])[-1][1],
             "date": (ca.get("V39079") or [(None, None)])[-1][0]},
        ],
    }


# ---------- The economy ----------

# (label, source, series, how to show it). "yoy" turns an index into a year-on-year % change.
ECONOMY = {
    "United States": [
        ("CPI inflation (year on year)", "fred", "CPIAUCSL", "yoy", "%"),
        ("Unemployment rate", "fred", "UNRATE", "level", "%"),
        ("Real GDP growth (annualized, quarterly)", "fred", "A191RL1Q225SBEA", "level", "%"),
        ("Payrolls added (thousands, monthly)", "fred", "PAYEMS", "diff", "k"),
        ("Fed funds target (upper)", "fred", "DFEDTARU", "level", "%"),
        ("VIX (stock market volatility)", "fred", "VIXCLS", "level", ""),
    ],
    "Canada": [
        ("CPI inflation (year on year)", "boc", "STATIC_TOTALCPICHANGE", "level", "%"),
        ("Core inflation (CPI-trim)", "boc", "CPI_TRIM", "level", "%"),
        ("Unemployment rate", "fred", "LRUNTTTTCAM156S", "level", "%"),
        ("Bank of Canada overnight target", "boc", "V39079", "level", "%"),
    ],
}
ECON_POINTS = 24  # history shown in each sparkline (months, or quarters for GDP)


def _monthly(points: list) -> list:
    """Daily series (policy rates, VIX) reduced to their last value each month."""
    by_month = {}
    for d, v in points:
        by_month[d[:7]] = (d, v)
    return list(by_month.values())


def _transform(points: list, how: str) -> list:
    if how == "yoy":
        return [(points[i][0], (points[i][1] / points[i - 12][1] - 1) * 100) for i in range(12, len(points))]
    if how == "diff":
        return [(points[i][0], points[i][1] - points[i - 1][1]) for i in range(1, len(points))]
    return points


@cached("economy", 6 * HOUR)
def economy() -> list:
    """Headline economic indicators for the US and Canada: latest value, previous value and recent history."""
    start = date.today() - timedelta(days=4 * 365)
    fred_ids = [sid for rows in ECONOMY.values() for _, src, sid, _, _ in rows if src == "fred"]
    boc_ids = [sid for rows in ECONOMY.values() for _, src, sid, _, _ in rows if src == "boc"]
    raw = {**fred(fred_ids, start), **boc(boc_ids, start)}
    out = []
    for country, rows in ECONOMY.items():
        items = []
        for label, _src, sid, how, unit in rows:
            pts = raw.get(sid) or []
            if sid in ("DFEDTARU", "VIXCLS", "V39079"):
                pts = _monthly(pts)
            pts = _transform(pts, how)[-ECON_POINTS:]
            if not pts:
                continue
            items.append({"label": label, "unit": unit, "value": pts[-1][1], "date": pts[-1][0],
                          "previous": pts[-2][1] if len(pts) > 1 else None, "spark": [round(v, 3) for _, v in pts]})
        out.append({"country": country, "items": items})
    return out


# ---------- Earnings calendar ----------

CALENDAR_DAYS = 14
CALENDAR_MIN_CAP = 10e9  # only companies over $10B, so the list stays readable


@cached("earnings-calendar", 3 * HOUR)
def earnings_calendar() -> list:
    """Upcoming earnings reports for large US and TSX companies over the next two weeks (from Finnhub)."""
    today = date.today()
    windows = [(today + timedelta(days=d), today + timedelta(days=d + 1)) for d in range(0, CALENDAR_DAYS, 2)]
    # Finnhub returns at most 1,500 rows per request, so ask for two days at a time.
    with ThreadPoolExecutor(max_workers=4) as pool:
        pages = list(pool.map(lambda w: finnhub._get("calendar/earnings", **{"from": w[0].isoformat(), "to": w[1].isoformat()}), windows))
    out = []
    for e in (e for page in pages for e in page.get("earningsCalendar") or []):
        sym = (e.get("symbol") or "").replace(".", "-")
        row = snapshot.lookup(sym, f"{sym}.TO", e.get("symbol"))
        if not row or (row.get("marketCap") or 0) < CALENDAR_MIN_CAP:
            continue
        out.append({"date": e.get("date"), "hour": {"bmo": "Before open", "amc": "After close"}.get(e.get("hour"), ""),
                    "symbol": row["symbol"], "name": row["name"], "sector": row.get("sector"), "marketCap": row["marketCap"],
                    "epsEstimate": e.get("epsEstimate"), "revenueEstimate": e.get("revenueEstimate"),
                    "quarter": e.get("quarter"), "year": e.get("year")})
    out.sort(key=lambda e: (e["date"] or "", -e["marketCap"]))
    return out
