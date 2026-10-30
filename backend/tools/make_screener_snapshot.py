"""
Saves a snapshot of Yahoo's stock screener to data/screener_snapshot.json.

The Explore page uses it when Yahoo's live screener refuses requests (it blocks many cloud
servers, e.g. Render). Run this on your own computer now and then to refresh it:

    cd backend
    .venv/bin/python -m tools.make_screener_snapshot

It stores the ~250 largest companies (over $300M) in each sector, for the US and the TSX.
"""
import json
import time
from datetime import date
from pathlib import Path

import yfinance as yf
from yfinance import EquityQuery

from data.screener import SECTORS, _is_real_tsx_company, _row

OUT = Path(__file__).resolve().parent.parent / "data" / "screener_snapshot.json"


def main():
    rows = []
    for country in ("us", "ca"):
        for sector in SECTORS:
            parts = [EquityQuery("eq", ["region", country]), EquityQuery("eq", ["sector", sector]),
                     EquityQuery("gte", ["intradaymarketcap", 300e6])]
            parts.append(EquityQuery("eq", ["exchange", "TOR"]) if country == "ca"
                         else EquityQuery("is-in", ["exchange", "NMS", "NYQ", "NGM", "NCM", "ASE"]))
            result = yf.screen(EquityQuery("and", parts), sortField="intradaymarketcap", sortAsc=False, size=250)
            quotes = [q for q in result.get("quotes", []) if q.get("quoteType") == "EQUITY"]
            if country == "ca":
                quotes = [q for q in quotes if _is_real_tsx_company(q)]
            rows += [_row(q) | {"country": country, "sector": sector} for q in quotes]
            print(f"{country} {sector}: {len(quotes)}")
            time.sleep(1)  # be gentle with Yahoo
    OUT.write_text(json.dumps({"date": date.today().isoformat(), "rows": rows}, separators=(",", ":")))
    print(f"saved {len(rows)} companies to {OUT}")


if __name__ == "__main__":
    main()
