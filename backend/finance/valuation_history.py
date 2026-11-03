"""
Valuation history: where today's multiples sit against the company's own past.

Each multiple comes from finance/ratios.py, so the numbers match the Ratios tab exactly:
one value per fiscal year (share price on the fiscal year-end date) plus today's TTM value.
For each multiple:
    average and standard deviation of the fiscal-year values (sample standard deviation)
    z = (today's value − average) ÷ standard deviation
Years where the multiple isn't meaningful (e.g. P/E with a loss) are left out.
"""

from statistics import mean, stdev

from data.cache import MINUTE, cached
from finance import ratios

MULTIPLES = [("pe", "P/E"), ("ev_ebitda", "EV/EBITDA"), ("ps", "P/S")]
MAX_YEARS = 10
MIN_YEARS = 4  # fewer points than this make the average and spread meaningless


@cached("valuation-history", 15 * MINUTE)
def build(ticker: str) -> dict:
    r = ratios.build(ticker)
    labels = [c["label"] for c in r["columns"]]
    has_ttm = labels and labels[-1] == "TTM"
    by_key = {row["key"]: row for row in r["ratios"]}
    out = []
    for key, label in MULTIPLES:
        values = by_key[key]["values"]
        annual = list(zip(labels[:-1] if has_ttm else labels, values[:-1] if has_ttm else values))[-MAX_YEARS:]
        points = [{"label": l, "value": v} for l, v in annual if v is not None]
        current = values[-1] if has_ttm else None
        item = {"key": key, "label": label, "points": points, "current": current,
                "currentLabel": "TTM" if has_ttm else None, "mean": None, "sd": None, "z": None, "reason": None,
                "caution": None}
        if not points:
            item["reason"] = (f"{label} isn't meaningful for this company in any year shown (for example, earnings were "
                              "negative, or it doesn't report EBITDA, as with banks).")
        elif len(points) < MIN_YEARS:
            item["reason"] = f"Only {len(points)} fiscal years with a meaningful {label}, too few for an average."
        else:
            vals = [p["value"] for p in points]
            item["mean"], item["sd"] = mean(vals), stdev(vals)
            if current is None:
                item["reason"] = f"Today's {label} isn't meaningful (for example, trailing earnings are negative)."
            elif item["sd"] > 0:
                item["z"] = (current - item["mean"]) / item["sd"]
            if item["sd"] > item["mean"] > 0:
                item["caution"] = (f"{label} swung widely (from {min(vals):,.1f}x to {max(vals):,.1f}x), so the average and "
                                   "bands are pulled by a few extreme years and aren't a reliable guide.")
        out.append(item)
    return {"symbol": ticker, "multiples": out, "source": r["source"]}
