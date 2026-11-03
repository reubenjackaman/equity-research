"""
Checks the financial health scorecard (Piotroski, Altman Z, Beneish M, accruals).
Run from the backend folder:  .venv/bin/python -m tests.check_health

The worked example uses made-up round numbers and computes each score by hand, separately from
finance/health.py, so a wrong coefficient or ratio there would show up as a mismatch.
"""
from dotenv import load_dotenv

load_dotenv(".env")

from finance import health

KEYS = ["revenue", "cost_of_revenue", "gross_profit", "sga", "operating_income", "net_income", "cfo", "dna",
        "receivables", "current_assets", "ppe", "total_assets", "current_liabilities", "long_term_debt",
        "total_liabilities", "retained_earnings", "shares_outstanding", "shares_diluted"]


def year(**v):
    return {k: v.get(k) for k in KEYS}


p = year(revenue=1000, cost_of_revenue=600, gross_profit=400, sga=150, operating_income=200, net_income=120, cfo=150,
         dna=50, receivables=100, current_assets=400, ppe=500, total_assets=1200, current_liabilities=200,
         long_term_debt=300, total_liabilities=600, retained_earnings=300, shares_outstanding=100)
c = year(revenue=1200, cost_of_revenue=700, gross_profit=500, sga=170, operating_income=260, net_income=160, cfo=140,
         dna=60, receivables=150, current_assets=450, ppe=600, total_assets=1300, current_liabilities=220,
         long_term_debt=280, total_liabilities=620, retained_earnings=400, shares_outstanding=100)
pp = year(total_assets=1100)

# Altman Z by hand, market value of equity 2,000.
z_hand = (1.2 * (450 - 220) / 1300 + 1.4 * 400 / 1300 + 3.3 * 260 / 1300 + 0.6 * 2000 / 620 + 1.0 * 1200 / 1300)
z = health._altman(c, 2000)["value"]
print(f"Altman Z: {z:.6f} (by hand {z_hand:.6f})")
assert abs(z - z_hand) < 1e-9

# Beneish M by hand.
dsri = (150 / 1200) / (100 / 1000)
gmi = (400 / 1000) / (500 / 1200)
aqi = (1 - (450 + 600) / 1300) / (1 - (400 + 500) / 1200)
sgi = 1200 / 1000
depi = (50 / (50 + 500)) / (60 / (60 + 600))
sgai = (170 / 1200) / (150 / 1000)
tata = (160 - 140) / 1300
lvgi = ((220 + 280) / 1300) / ((200 + 300) / 1200)
m_hand = (-4.84 + 0.920 * dsri + 0.528 * gmi + 0.404 * aqi + 0.892 * sgi + 0.115 * depi - 0.172 * sgai
          + 4.679 * tata - 0.327 * lvgi)
m = health._beneish(c, p)["value"]
print(f"Beneish M: {m:.6f} (by hand {m_hand:.6f})")
assert abs(m - m_hand) < 1e-9

# Piotroski by hand: ROA 160/1200 > 0 pass; CFO > 0 pass; ROA 13.3% vs 120/1100 = 10.9% pass;
# CFO/assets 140/1200 = 11.7% < ROA 13.3% fail; leverage 280/1250 = 22.4% vs 300/1150 = 26.1% pass;
# current ratio 2.045 vs 2.0 pass; shares flat pass; gross margin 41.7% vs 40% pass;
# asset turnover 1200/1200 = 1.0 vs 1000/1100 = 0.91 pass.  Score 8 of 9.
f = health._piotroski(c, p, pp)
print(f"Piotroski: {f['score']} of {f['available']} (by hand 8 of 9); failed: {[t['key'] for t in f['tests'] if not t['pass']]}")
assert (f["score"], f["available"]) == (8, 9) and [t["key"] for t in f["tests"] if not t["pass"]] == ["accrual"]

# Missing inputs give N/A with a reason, never a number.
gap = health._altman({**c, "retained_earnings": None}, 2000)
assert gap["value"] is None and "retained earnings" in gap["reason"], gap["reason"]

# Real companies: Apple's FY2025 inputs, and a bank where the models don't fit.
a = health.build("AAPL")
print(f"AAPL {a['year']}: F {a['piotroski']['score']}/{a['piotroski']['available']}, Z {a['altman']['value']:.2f} "
      f"({a['altman']['zone']}), M {a['beneish']['value']:.2f}, accruals {a['accruals']['value']:.2%}")
assert a["altman"]["zone"] == "safe" and not a["financial"]
j = health.build("JPM")
assert j["financial"] and j["altman"]["value"] is None and j["altman"]["caution"]
print("JPM flagged as a bank; Altman Z shows N/A:", j["altman"]["reason"])
print("all health checks passed")
