"""
Checks the reverse DCF ("what's priced in").
Run from the backend folder:  .venv/bin/python -m tests.check_reverse_dcf
"""
from dotenv import load_dotenv

load_dotenv(".env")

from finance import dcf

# 1. Independent worked example: a made-up company valued by hand, without dcf.run().
#    Revenue 100, 20% EBIT margin, no tax, no capex/D&A/working capital, so FCF = 20% of revenue.
#    3-year forecast, WACC 10%, terminal growth 2%, no debt or cash, 1 share.
true_growth, wacc, g, years = 0.05, 0.10, 0.02, 3
fcf = [100 * (1 + true_growth) ** t * 0.20 for t in range(1, years + 1)]
by_hand = sum(f / (1 + wacc) ** t for t, f in enumerate(fcf, start=1)) + fcf[-1] * (1 + g) / (wacc - g) / (1 + wacc) ** years
base = {
    "priceTrading": by_hand, "fx": 1.0, "marketCap": by_hand,
    "history": [{"revenue": 100.0, "ebit": 20.0, "nwc": 0.0}],
    "balance": {"debt": 0.0, "cash": 0.0, "shares": 1.0},
}
a = {"years": years, "growth_start": 0.0, "growth_end": 0.0, "margin_target": 0.20, "tax_rate": 0.0, "da_pct": 0.0,
     "capex_pct": 0.0, "nwc_pct": 0.0, "terminal_growth": g, "risk_free": 0.04, "beta": 1.0, "erp": 0.05,
     "cost_of_debt": 0.05, "wacc_override": wacc}
solved = dcf.implied_growth(base, a)["growth"]
print(f"worked example: price {by_hand:.4f} by hand, implied growth {solved:.6f} (expected {true_growth})")
assert abs(solved - true_growth) < 1e-5

# 2. No answer: a price no growth rate can reach.
r = dcf.implied_growth({**base, "priceTrading": by_hand * 1000}, a)
assert r["growth"] is None and r["reason"], r
print("unreachable price gives a reason:", r["reason"][:60], "...")

# 3. Apple: putting the implied growth back into the forward model gives today's price.
m = dcf.model("AAPL", {})
implied = m["reverse"]["growth"]
back = dcf.model("AAPL", {"growth_start": implied, "growth_end": implied})["valuation"]["perShareTrading"]
print(f"AAPL: implied {implied:.2%}, value at that growth {back:.2f} vs price {m['price']:.2f}, "
      f"actual 3-yr {m['reverse']['cagr']['y3']['value']:.1%}, 5-yr {m['reverse']['cagr']['y5']['value']:.1%}")
assert abs(back - m["price"]) < 0.01
print("all reverse DCF checks passed")
