"""
Simulates a cloud server where Yahoo refuses its company-profile, screener and industry
endpoints (what happens on Render), and checks every part of the app still works.

Run from the backend folder:  .venv/bin/python -m tests.check_server_fallbacks
"""
import tempfile
from pathlib import Path

import yfinance as yf
from dotenv import load_dotenv

load_dotenv(".env")
from data import cache  # noqa: E402

cache.DB_PATH = Path(tempfile.mkdtemp()) / "cache.sqlite"  # fresh cache: nothing pre-fetched from Yahoo


def blocked(*_args, **_kwargs):
    raise RuntimeError("HTTP Error 401 (simulated: Yahoo refuses cloud servers)")


yf.Ticker.info = property(blocked)
yf.screen = blocked
yf.Industry = blocked

from data import news, screener, yahoo  # noqa: E402
from finance import comps, dcf, ratios, statements  # noqa: E402

problems = []


def check(label, ok, detail=""):
    print("OK  " if ok else "FAIL", f"{label:42} {detail}")
    if not ok:
        problems.append(label)


for t in ["AAPL", "CNR.TO", "TSM", "BRK-B", "SHOP.TO", "ATD.TO"]:
    o = yahoo.overview(t)
    check(f"overview {t}", o["price"] and o["name"],
          f"{o['name']} | cap {o['marketCap'] and round(o['marketCap'] / 1e9)}B {o['currency']} | beta {o['beta']} | "
          f"desc {'yes' if o['description'] else 'no'} | {o['profileSource']}")
try:
    yahoo.overview("ZZZZQQ")
    check("unknown ticker is 'not found'", False)
except yahoo.TickerNotFound:
    check("unknown ticker is 'not found'", True)

for t in ["CNR.TO", "TSM", "SHOP.TO"]:
    s = statements.build(t, "annual")
    check(f"statements {t}", len(s["columns"]) >= 4, f"{s['currency']} {len(s['columns'])} yrs | {s['source'][:30]}")

for t in ["AAPL", "CNR.TO", "BRK-B", "TSM"]:
    r = ratios.build(t)
    pe = next(x for x in r["ratios"] if x["key"] == "pe")["values"][-1]
    check(f"ratios {t}", pe is not None, f"P/E {pe and round(pe, 1)} ({r['columns'][-1]['label']})")

m = dcf.model("AAPL", None)
check("DCF AAPL", m["valuation"] is not None, f"value {m['valuation']['perShareTrading']:.2f} | beta {m['assumptions']['beta']}")

c = comps.build("AAPL", "")
check("comps AAPL", len(c["peers"]) >= 3, f"{[p['symbol'] for p in c['peers']]} | {c['basis']}")

n = news.company_news("AAPL", yahoo.overview("AAPL")["name"])
check("news AAPL", len(n["articles"]) > 10, f"{len(n['articles'])} articles from {n['sources']}")

for args in [("us", "Technology", "", "", "", "", "", "marketcap"), ("ca", "Energy", "", "", "", "over2", "", "dividend"),
             ("us", "Healthcare", "Biotechnology", "", "", "", "over25", "marketcap")]:
    r = screener.screen.__wrapped__(*args)
    check(f"explore {args[0]} {args[1]}", len(r["results"]) > 0,
          f"{len(r['results'])} results, first {[x['symbol'] for x in r['results'][:3]]} | note: {bool(r['note'])}")

print("\nproblems:", problems or "none")
