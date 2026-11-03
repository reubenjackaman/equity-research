"""
Checks the terminal screens' data: world markets, movers, rates, the economy, the earnings
calendar, candlestick bars, analyst estimates and insider trades. Runs with Yahoo's company
profile blocked, as it is on Render, and with a fresh cache.

Run from the backend folder:  .venv/bin/python -m tests.check_terminal
"""
import tempfile
from pathlib import Path

import yfinance as yf
from dotenv import load_dotenv

load_dotenv(".env")
from data import cache  # noqa: E402

cache.DB_PATH = Path(tempfile.mkdtemp()) / "cache.sqlite"


def blocked(*_args, **_kwargs):
    raise RuntimeError("HTTP Error 401 (simulated: Yahoo refuses cloud servers)")


yf.Ticker.info = property(blocked)

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

client = TestClient(main.app)
problems = []


def check(label, ok, detail=""):
    print("OK  " if ok else "FAIL", f"{label:40} {detail}")
    if not ok:
        problems.append(label)


board = client.get("/api/markets/board").json()
quotes = [q for g in board for q in g["items"]]
priced = [q for q in quotes if q["value"] is not None]
check("board: most markets priced", len(priced) >= len(quotes) - 3, f"{len(priced)}/{len(quotes)}")
spx = next(q for q in quotes if q["symbol"] == "^GSPC")
check("board: S&P 500 has a sparkline", len(spx["spark"]) >= 15 and spx["changePercent"] is not None,
      f"{spx['value']:.0f} {spx['changePercent']:+.2f}%")
tnx = next(q for q in quotes if q["symbol"] == "^TNX")
check("board: 10Y move in basis points", "changeBp" in tnx, f"{tnx['value']:.2f}% {tnx.get('changeBp', 0):+.1f}bp")

movers = client.get("/api/markets/movers").json()
for c in ("us", "ca"):
    m = movers[c]
    g = [x["changePercent"] for x in m["gainers"]]
    check(f"movers {c}: gainers sorted, losers below", g == sorted(g, reverse=True) and m["losers"][0]["changePercent"] <= g[-1],
          f"top {m['gainers'][0]['symbol']} {g[0]:+.1f}% | {m['advancing']} up {m['declining']} down of {m['universe']}")

rates = client.get("/api/markets/rates").json()
for c, n in (("us", 10), ("ca", 6)):
    pts = rates[c]["points"]
    check(f"rates {c}: curve", len(pts) >= n and all(0 < p["now"] < 20 for p in pts),
          " ".join(f"{p['tenor']}={p['now']}" for p in pts))
check("rates: policy rates", all(p["value"] is not None for p in rates["policy"]), str([p["value"] for p in rates["policy"]]))

eco = client.get("/api/markets/economy").json()
for c in eco:
    check(f"economy {c['country']}", len(c["items"]) >= 4 and all(len(i["spark"]) >= 6 for i in c["items"]),
          ", ".join(f"{i['label'][:14]}={i['value']:.1f}" for i in c["items"]))

cal = client.get("/api/markets/earnings").json()
check("earnings calendar", len(cal) >= 5 and [e["date"] for e in cal] == sorted(e["date"] for e in cal),
      f"{len(cal)} reports, first {cal[0]['symbol'] if cal else None} on {cal[0]['date'] if cal else None}")

for t, r in (("AAPL", "1D"), ("RY.TO", "1Y"), ("MSFT", "MAX")):
    b = client.get(f"/api/company/{t}/bars?range={r}").json()
    ok = len(b["bars"]) > 10 and all(x["low"] <= min(x["open"], x["close"]) + 1e-6 and x["high"] >= max(x["open"], x["close"]) - 1e-6
                                     for x in b["bars"])
    check(f"bars {t} {r}", ok and b["intraday"] == (r == "1D"), f"{len(b['bars'])} bars")
check("bars: bad range refused", client.get("/api/company/AAPL/bars?range=2Y").status_code == 400)

for t in ("AAPL", "RY.TO"):
    e = client.get(f"/api/company/{t}/estimates").json()
    check(f"estimates {t}", e["ratings"] and e["surprises"], f"{len(e['ratings'])} months, {len(e['surprises'])} quarters, next {e['next'] and e['next']['date']}")
i = client.get("/api/company/AAPL/insiders").json()
check("insiders AAPL", i["transactions"] and i["note"] is None, f"{i['summary']['sells']} sales, {i['summary']['buys']} buys")
i = client.get("/api/company/CNR.TO/insiders").json()
check("insiders CNR.TO uses US listing + note", i["source"] == "CNI" and i["note"], i["source"])

# Ask Finch on a market screen: no ticker needed, and bad input is still refused before counting.
r = client.post("/api/ask", json={"symbol": "", "tab": "Rates", "question": "x" * 600})
check("market Ask Finch: long question refused", r.status_code == 422)

print("\nproblems:", ", ".join(problems) or "none")
if problems:
    raise SystemExit(1)
