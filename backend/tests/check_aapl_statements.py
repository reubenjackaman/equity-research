"""
Sanity check: compare the app's AAPL FY2024 statements against Apple's 10-K.
Run from the backend folder:  .venv/bin/python -m tests.check_aapl_statements
"""
from dotenv import load_dotenv

load_dotenv(".env")
from finance import statements as s  # noqa: E402

# Apple FY2024 10-K (fiscal year ended Sep 28, 2024), USD millions
TEN_K = dict(
    revenue=391035, cost_of_revenue=210352, gross_profit=180683, rnd=31370, sga=26097,
    operating_expenses=57467, operating_income=123216, pretax_income=123485, income_tax=29749,
    net_income=93736, eps_diluted=6.08, shares_diluted=15408.095, cash=29943,
    short_term_investments=35228, receivables=33410, inventory=7286, current_assets=152987,
    ppe=45680, total_assets=364980, accounts_payable=68960, short_term_debt=9967 + 10912,
    current_liabilities=176392, long_term_debt=85750, total_liabilities=308030, total_equity=56950,
    cfo=118254, dna=11445, sbc=11688, capex=-9447, cfi=2935, dividends=-15234, buybacks=-94949,
    cff=-121983, fcf=118254 - 9447, ebitda=123216 + 11445, total_debt=9967 + 10912 + 85750,
)

d = s.build("AAPL", "annual")
i = [c["label"] for c in d["columns"]].index("FY2024")
bad = 0
for rows in d["statements"].values():
    for r in rows:
        if r["key"] not in TEN_K:
            continue
        v = r["values"][i]
        v = None if v is None else (v if r["format"] == "perShare" else v / 1e6)
        want = TEN_K[r["key"]]
        ok = v is not None and abs(v - want) <= max(0.01, abs(want) * 0.0005)
        bad += not ok
        print("OK  " if ok else "DIFF", f"{r['key']:22} app={v!s:>14}  10-K={want:>12}  [{r['sources'][i]}]")
print("mismatches:", bad)
