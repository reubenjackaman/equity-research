"""
What the market says about a company: analysts' ratings, earnings surprises, the next report date,
and insider buying and selling. From Finnhub's free plan, which covers US listings, so a TSX
company uses its US listing when it has one (RY.TO -> RY); earnings surprises also work for TSX symbols.
"""

from datetime import date, timedelta

from data import finnhub, yahoo
from data.cache import HOUR, cached

# SEC Form 4 transaction codes, in plain words.
CODES = {
    "P": "Buy", "S": "Sale", "A": "Award", "M": "Option exercise", "F": "Tax withholding", "G": "Gift",
    "D": "Returned to company", "C": "Conversion", "X": "Option exercise", "J": "Other", "I": "Discretionary",
    "W": "Inheritance", "V": "Voluntary report",
}
INSIDER_DAYS = 365
INSIDERS_SHOWN = 60


def _us(ticker: str):
    return yahoo.us_listing(ticker)


@cached("insiders", 6 * HOUR)
def insiders(ticker: str) -> dict:
    """Insider transactions over the last year, with totals for open-market buying and selling."""
    us = _us(ticker)
    if not us:
        raise ValueError("Insider filings are only available for companies with a US listing.")
    cutoff = (date.today() - timedelta(days=INSIDER_DAYS)).isoformat()
    rows = []
    for t in finnhub.insider_transactions(us):
        when = t.get("transactionDate") or t.get("filingDate") or ""
        if when < cutoff or not t.get("change"):
            continue
        price = t.get("transactionPrice") or None
        rows.append({
            "date": when, "filed": t.get("filingDate"), "name": t.get("name"), "code": t.get("transactionCode"),
            "type": CODES.get(t.get("transactionCode"), t.get("transactionCode") or "Other"),
            "shares": t["change"], "price": price, "value": abs(t["change"]) * price if price else None,
            "held": t.get("share"), "derivative": bool(t.get("isDerivative")),
        })
    rows.sort(key=lambda r: r["date"], reverse=True)
    market = [r for r in rows if r["code"] in ("P", "S") and not r["derivative"]]  # trades on the open market
    buys = [r for r in market if r["code"] == "P"]
    sells = [r for r in market if r["code"] == "S"]
    note = None
    if not rows and us != ticker:
        note = ("Canadian companies report most insider trades on SEDI (sedi.ca), the Canadian system, rather than to the "
                f"SEC, so trades filed under the US listing ({us}) may be few or none.")
    return {
        "symbol": ticker, "source": us, "days": INSIDER_DAYS, "note": note,
        "summary": {
            "buys": len(buys), "sells": len(sells),
            "buyValue": sum(r["value"] or 0 for r in buys), "sellValue": sum(r["value"] or 0 for r in sells),
            "buyers": len({r["name"] for r in buys}), "sellers": len({r["name"] for r in sells}),
            "netShares": sum(r["shares"] for r in market),
        },
        "transactions": rows[:INSIDERS_SHOWN],
    }


@cached("estimates", 6 * HOUR)
def estimates(ticker: str) -> dict:
    """Analyst ratings by month, earnings surprises, the next report date and price targets (when Yahoo has them)."""
    us = _us(ticker)
    out = {"symbol": ticker, "ratings": [], "surprises": [], "next": None, "targets": None}
    if us:
        try:
            out["ratings"] = [{k: r.get(k) for k in ("period", "strongBuy", "buy", "hold", "sell", "strongSell")}
                              for r in finnhub.recommendations(us)[:12]]
        except finnhub.FinnhubUnavailable:
            pass
    for symbol in dict.fromkeys([ticker, us]):  # TSX symbols often work directly; otherwise try the US listing
        if not symbol:
            continue
        try:
            out["surprises"] = [{k: s.get(k) for k in ("period", "year", "quarter", "estimate", "actual", "surprise", "surprisePercent")}
                                for s in finnhub.earnings_surprises(symbol)]
            today = date.today()
            upcoming = finnhub.next_earnings(symbol, today.isoformat(), (today + timedelta(days=120)).isoformat())
            if upcoming:
                e = sorted(upcoming, key=lambda e: e.get("date") or "")[0]
                out["next"] = {"date": e.get("date"), "hour": {"bmo": "Before open", "amc": "After close"}.get(e.get("hour"), ""),
                               "epsEstimate": e.get("epsEstimate"), "revenueEstimate": e.get("revenueEstimate"),
                               "quarter": e.get("quarter"), "year": e.get("year")}
            if out["surprises"]:
                break
        except finnhub.FinnhubUnavailable:
            continue
    o = yahoo.overview(ticker)
    if o.get("targetMean"):
        out["targets"] = {"low": o.get("targetLow"), "mean": o.get("targetMean"), "high": o.get("targetHigh"),
                          "analysts": o.get("analystCount"), "currency": o.get("currency"), "price": o.get("price")}
    if not (out["ratings"] or out["surprises"] or out["targets"]):
        raise ValueError("No analyst coverage found for this company.")
    return out
