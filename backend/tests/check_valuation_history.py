"""
Checks valuation history (each multiple against its own average and spread).
Run from the backend folder:  .venv/bin/python -m tests.check_valuation_history
"""
from dotenv import load_dotenv

load_dotenv(".env")

import math

from finance import ratios, valuation_history

h = valuation_history.build("AAPL")
r = {row["key"]: row["values"] for row in ratios.build("AAPL")["ratios"]}
for m in h["multiples"]:
    # The points must be exactly the fiscal-year values on the Ratios tab, and "current" its TTM value.
    annual = [v for v in r[m["key"]][:-1] if v is not None][-valuation_history.MAX_YEARS:]
    assert [p["value"] for p in m["points"]] == annual, m["key"]
    assert m["current"] == r[m["key"]][-1]
    # Average, sample standard deviation and z worked out by hand.
    n = len(annual)
    avg = sum(annual) / n
    sd = math.sqrt(sum((v - avg) ** 2 for v in annual) / (n - 1))
    z = (m["current"] - avg) / sd
    assert abs(m["mean"] - avg) < 1e-9 and abs(m["sd"] - sd) < 1e-9 and abs(m["z"] - z) < 1e-9
    print(f"AAPL {m['label']}: now {m['current']:.1f}x, {n}-year average {avg:.1f}x, sd {sd:.1f}, z {z:+.2f}")

# A bank has no EBITDA: that multiple must say why instead of showing a number.
jpm = {m["key"]: m for m in valuation_history.build("JPM")["multiples"]}
assert jpm["ev_ebitda"]["z"] is None and jpm["ev_ebitda"]["reason"]
print("JPM EV/EBITDA:", jpm["ev_ebitda"]["reason"])
print("all valuation history checks passed")
