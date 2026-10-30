"""
Sanity check: AAPL FY2024 ratios computed by hand from Apple's 10-K vs the app.
Run from the backend folder:  .venv/bin/python -m tests.check_aapl_ratios

Inputs below are typed in from the FY2024 and FY2023 10-K balance sheets (USD millions),
so this checks the app's formulas independently of its data pipeline.
"""
from dotenv import load_dotenv

load_dotenv(".env")
from data import yahoo  # noqa: E402
from finance import ratios, statements  # noqa: E402

# FY2024 (year ended Sep 28, 2024) and FY2023 (Sep 30, 2023)
rev, cogs, gp, ebit, pretax, tax, ni, eps = 391035, 210352, 180683, 123216, 123485, 29749, 93736, 6.08
eq24, eq23 = 56950, 62146
ta24, ta23 = 364980, 352583
inv24, inv23 = 7286, 6331
ar24, ar23 = 33410, 29508
cash24, cash23, sti24 = 29943, 29965, 35228
debt24 = 9967 + 10912 + 85750           # commercial paper + current term debt + non-current term debt
debt23 = 5985 + 9822 + 95281
ca24, cl24 = 152987, 176392
cfo, capex, dna = 118254, 9447, 11445

d = ratios.build("AAPL")
i = [c["label"] for c in d["columns"]].index("FY2024")
app = {r["key"]: r["values"][i] for r in d["ratios"]}

tax_rate = tax / pretax
ic24, ic23 = debt24 + eq24 - cash24, debt23 + eq23 - cash23
expected = {
    "gross_margin": gp / rev * 100,
    "operating_margin": ebit / rev * 100,
    "net_margin": ni / rev * 100,
    "roe": ni / ((eq24 + eq23) / 2) * 100,
    "roa": ni / ((ta24 + ta23) / 2) * 100,
    "roic": ebit * (1 - tax_rate) / ((ic24 + ic23) / 2) * 100,
    "current_ratio": ca24 / cl24,
    "quick_ratio": (cash24 + sti24 + ar24) / cl24,
    "debt_to_equity": debt24 / eq24,
    "interest_coverage": None,  # Apple stopped disclosing interest expense separately after FY2023
    "asset_turnover": rev / ((ta24 + ta23) / 2),
    "inventory_turnover": cogs / ((inv24 + inv23) / 2),
    "dso": ((ar24 + ar23) / 2) / rev * 365,
}
# Valuation: use the app's own FY-end price (market data), then check the arithmetic.
closes = yahoo.daily_closes("AAPL")
px = ratios._price_on(closes, "2024-09-28")
balance = statements.build("AAPL", "annual")["statements"]["balance"]
shares = next(r for r in balance if r["key"] == "shares_outstanding")["values"][i] / 1e6  # millions
mcap = px * shares
expected |= {
    "pe": px / eps,
    "pb": mcap / eq24,
    "ps": mcap / rev,
    "ev_ebitda": (mcap + debt24 - cash24 - sti24) / (ebit + dna),
    "fcf_yield": (cfo - capex) / mcap * 100,
}

bad = 0
print(f"FY2024 close used: ${px:.2f}, shares outstanding {shares:,.0f}M")
for k, want in expected.items():
    got = app[k]
    ok = (got is None and want is None) or (got is not None and want is not None and abs(got - want) <= abs(want) * 0.001)
    bad += not ok
    print("OK  " if ok else "DIFF", f"{k:20} app={got if got is None else round(got, 3)!s:>10}  hand={want if want is None else round(want, 3)!s:>10}")
print("mismatches:", bad)
