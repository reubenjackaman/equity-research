"""
"What the numbers say": plain-English findings about a company, written by rules (no AI), so they
are instant, free and always match the figures on the site.

Each finding compares a number with something that gives it meaning: the peer median, the
company's own history, its past growth, a government bond yield, or a published threshold.
Each carries a tone ("good", "bad" or "neutral") and a glossary key for the Learn page.
"""

from data.cache import HOUR, cached
from finance import comps, dcf, health, ratios, valuation_history

GAP = 0.15  # a multiple 15% or more away from the peer median is worth pointing out


def _pct(v):
    return f"{v:.1f}%"


def _x(v):
    return f"{v:.1f}x"


def _peers(ticker: str, out: list):
    c = comps.build(ticker, "")
    t, med = c["target"], c["stats"].get("median") or {}
    names = ", ".join(p["symbol"] for p in c["peers"][:4])
    for key, label in (("pe", "earnings (P/E)"), ("ev_ebitda", "EBITDA (EV/EBITDA)"), ("ps", "sales (P/S)")):
        mine, peer = t.get(key), med.get(key)
        if not mine or not peer or mine <= 0 or peer <= 0:
            continue
        gap = mine / peer - 1
        if abs(gap) < GAP:
            out.append({"topic": "Valuation vs peers", "tone": "neutral", "learn": key,
                        "text": f"Valued at {_x(mine)} {label}, close to the peer median of {_x(peer)} ({names})."})
        else:
            word = "premium" if gap > 0 else "discount"
            why = ("Investors usually pay a premium for faster growth, higher margins or lower risk. Check that the company has them."
                   if gap > 0 else
                   "A discount can mean the market expects slower growth or more risk, or that the stock is overlooked.")
            out.append({"topic": "Valuation vs peers", "tone": "neutral", "learn": key,
                        "text": f"Valued at {_x(mine)} {label}, a {abs(gap) * 100:.0f}% {word} to the peer median of {_x(peer)} ({names}). {why}"})
        break  # one multiple is enough here; the Comps tab has the rest
    for key, label in (("operating_margin", "operating margin"), ("revenue_growth", "revenue growth")):
        mine, peer = t.get(key), med.get(key)
        if mine is None or peer is None:
            continue
        better = mine > peer
        out.append({"topic": "Quality vs peers", "tone": "good" if better else "bad", "learn": key,
                    "text": f"Its {label} of {_pct(mine)} is {'above' if better else 'below'} the peer median of {_pct(peer)}."})


def _history(ticker: str, out: list):
    for m in valuation_history.build(ticker)["multiples"]:
        if m["key"] != "pe" or m.get("z") is None or m.get("current") is None or m.get("caution"):
            continue  # a caution means the average is distorted (e.g. years of tiny earnings)
        z, cur, mean = m["z"], m["current"], m["mean"]
        if z > 1:
            tone, word = "bad", "expensive"
        elif z < -1:
            tone, word = "good", "cheap"
        else:
            tone, word = "neutral", "about normal"
        out.append({"topic": "Valuation vs its own history", "tone": tone, "learn": "z_score",
                    "text": f"P/E of {_x(cur)} is {abs(z):.1f} standard deviations {'above' if z >= 0 else 'below'} its "
                            f"{len(m['points'])}-year average of {_x(mean)}: {word} compared with its own past."})


def _dcf(ticker: str, out: list):
    m = dcf.model(ticker, {})
    rev = m["reverse"]
    implied, cagr = rev.get("growth"), (rev.get("cagr") or {})
    span = 5 if cagr.get("y5") else 3
    past = (cagr.get("y5") or cagr.get("y3") or {}).get("value")
    if implied is not None and past is not None:
        gap = implied - past
        tone = "bad" if gap > 0.05 else "good" if gap < -0.02 else "neutral"
        verdict = ("The price needs much faster growth than the company has delivered." if tone == "bad" else
                   "The price asks for less growth than the company has delivered, a possible margin of safety." if tone == "good" else
                   "The price assumes growth close to what the company has delivered.")
        out.append({"topic": "What's priced in", "tone": tone, "learn": "reverse_dcf",
                    "text": f"Today's price implies about {_pct(implied * 100)} revenue growth a year for {rev.get('years') or 5} years; "
                            f"it grew {_pct(past * 100)} a year over the last {span} years. {verdict}"})
    v = m.get("valuation") or {}
    if v.get("upside") is not None and v.get("perShareTrading"):
        up = v["upside"]
        out.append({"topic": "DCF", "tone": "good" if up > 0.15 else "bad" if up < -0.15 else "neutral", "learn": "dcf",
                    "text": f"The base-case DCF (default assumptions) values a share at {v['perShareTrading']:.2f} {m['tradingCurrency']}, "
                            f"{abs(up) * 100:.0f}% {'above' if up >= 0 else 'below'} the price. DCFs are very sensitive to growth "
                            f"and the discount rate, so test your own assumptions."})
    fcf_yield, rf = None, m["assumptions"].get("risk_free")
    try:
        fcf_yield = next(r for r in ratios.build(ticker)["ratios"] if r["key"] == "fcf_yield")["values"][-1]
    except StopIteration:
        pass
    if fcf_yield is not None and rf:
        if fcf_yield < rf * 100:
            out.append({"topic": "Cash return", "tone": "neutral", "learn": "fcf_yield",
                        "text": f"Its free cash flow yield ({_pct(fcf_yield)}) is below the 10-year Treasury yield ({_pct(rf * 100)}). "
                                f"Buyers are accepting less cash today in exchange for expected growth."})
        else:
            out.append({"topic": "Cash return", "tone": "good", "learn": "fcf_yield",
                        "text": f"Its free cash flow yield ({_pct(fcf_yield)}) is above the 10-year Treasury yield ({_pct(rf * 100)}), "
                                f"so the business generates more cash per dollar of price than a government bond pays."})


TREND_COLUMNS = 4  # the last three fiscal years plus TTM


def _trends(ticker: str, out: list):
    from data import yahoo

    r = ratios.build(ticker)
    rows = {x["key"]: x["values"] for x in r["ratios"]}
    years = [c["label"] for c in r["columns"]]
    om = [(y, v) for y, v in zip(years, rows.get("operating_margin", []))][-TREND_COLUMNS:]
    om = [(y, v) for y, v in om if v is not None]
    if len(om) >= 3:
        change = om[-1][1] - om[0][1]
        if abs(change) >= 2:
            out.append({"topic": "Trend", "tone": "good" if change > 0 else "bad", "learn": "operating_margin",
                        "text": f"Operating margin has {'widened' if change > 0 else 'narrowed'} from {_pct(om[0][1])} to {_pct(om[-1][1])} "
                                f"({om[0][0]} to {om[-1][0]})."})
    if (yahoo.overview(ticker).get("sector") or "") == "Financial Services":
        return  # banks and insurers run on borrowed money (deposits, policies), so these tests don't apply
    de = rows.get("debt_to_equity", [None])[-1]
    ic = rows.get("interest_coverage", [None])[-1]
    if ic is not None and ic < 0:
        out.append({"topic": "Balance sheet", "tone": "bad", "learn": "interest_coverage",
                    "text": "Operating profit is negative, so it doesn't cover interest payments at all right now."})
    elif ic is not None and ic < 3:
        out.append({"topic": "Balance sheet", "tone": "bad", "learn": "interest_coverage",
                    "text": f"Operating profit covers interest only {_x(ic)}. Below about 3x, a bad year could strain its ability to pay lenders."})
    elif de is not None and de > 2:
        out.append({"topic": "Balance sheet", "tone": "neutral", "learn": "debt_to_equity",
                    "text": f"Debt is {_x(de)} equity, which is high. That can be fine for steady businesses, or a result of large buybacks, but it adds risk."})
    cr = rows.get("current_ratio", [None])[-1]
    if cr is not None and cr < 1:
        out.append({"topic": "Balance sheet", "tone": "neutral", "learn": "current_ratio",
                    "text": f"Current ratio of {cr:.2f}: short-term liabilities exceed short-term assets. Common for companies with strong, "
                            f"reliable cash flow; a warning sign for weak ones."})


def _health(ticker: str, out: list):
    h = health.build(ticker)
    p = h["piotroski"]
    if p.get("score") is not None and not h["financial"]:
        s = p["score"]
        out.append({"topic": "Financial health", "tone": "good" if s >= 7 else "bad" if s <= 3 else "neutral", "learn": "piotroski",
                    "text": f"Piotroski F-Score of {s} out of {p['available']}: "
                            f"{'strong and improving fundamentals' if s >= 7 else 'weak fundamentals' if s <= 3 else 'mixed fundamentals'}."})
    a = h["altman"]
    if a.get("value") is not None and a.get("zone") == "distress":
        out.append({"topic": "Financial health", "tone": "bad", "learn": "altman",
                    "text": f"Altman Z-Score of {a['value']:.2f} is in the distress zone (below 1.81), a historical warning sign of bankruptcy risk."})
    b = h["beneish"]
    if b.get("flag"):
        out.append({"topic": "Financial health", "tone": "bad", "learn": "beneish",
                    "text": f"Beneish M-Score of {b['value']:.2f} is above -1.78, a pattern sometimes seen when earnings are being flattered. "
                            f"It's a prompt to read the accounts closely, not proof."})


@cached("insights", 6 * HOUR)
def build(ticker: str) -> dict:
    out, skipped = [], []
    for name, part in (("peers", _peers), ("history", _history), ("dcf", _dcf), ("trends", _trends), ("health", _health)):
        try:
            part(ticker, out)
        except Exception:
            skipped.append(name)  # e.g. no DCF for banks; the rest still shows
    if not out:
        raise ValueError("Not enough data to summarize this company.")
    return {"symbol": ticker, "insights": out, "skipped": skipped}
