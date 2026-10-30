"""
The API server. The React frontend calls these routes; each route asks a
data module for the numbers (which are cached) and returns JSON.

Run with:  uvicorn main:app --reload
Then visit http://localhost:8000/docs to try every route in the browser.

Production (one server for everything): build the website once with `npm run build` in
frontend/, then this app also serves it, so the whole site lives at one address.
"""

from pathlib import Path

from dotenv import load_dotenv
from fastapi import Body, FastAPI, HTTPException, Query, Response
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from data import game, news, screener, yahoo
from exports import dcf_excel, excel
from finance import comps, dcf, ratios, statements

load_dotenv()

app = FastAPI(title="Equity Research API")


def fetch(fn, *args):
    """Call a data function and turn failures into clean HTTP errors."""
    try:
        return fn(*args)
    except yahoo.TickerNotFound:
        raise HTTPException(404, f"No data found for ticker '{args[0]}'.")
    except ValueError as exc:  # the request is valid but the analysis doesn't apply (e.g. DCF for a bank)
        raise HTTPException(422, str(exc))
    except Exception as exc:  # network problems, Yahoo throttling, etc.
        raise HTTPException(502, f"Data provider error: {exc}")


@app.get("/api/search")
def search(q: str = Query(..., min_length=1)):
    return fetch(yahoo.search, q.strip())


@app.get("/api/company/{ticker}/overview")
def overview(ticker: str):
    return fetch(yahoo.overview, yahoo.normalize(ticker))


@app.get("/api/company/{ticker}/history")
def history(ticker: str, range: str = "1Y"):
    if range not in yahoo.RANGES:
        raise HTTPException(400, f"range must be one of {list(yahoo.RANGES)}")
    return fetch(yahoo.history, yahoo.normalize(ticker), range)


@app.get("/api/company/{ticker}/statements")
def statements_route(ticker: str, period: str = "annual"):
    if period not in ("annual", "quarterly"):
        raise HTTPException(400, "period must be 'annual' or 'quarterly'")
    return fetch(statements.build, yahoo.normalize(ticker), period)


@app.get("/api/company/{ticker}/statements.xlsx")
def statements_excel(ticker: str, period: str = "annual"):
    data = statements_route(ticker, period)
    filename = f"{data['symbol']}_financials_{period}.xlsx"
    return Response(
        excel.statements_workbook(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/api/company/{ticker}/ratios")
def ratios_route(ticker: str):
    return fetch(ratios.build, yahoo.normalize(ticker))


@app.get("/api/company/{ticker}/news")
def news_route(ticker: str):
    symbol = yahoo.normalize(ticker)
    company = fetch(yahoo.overview, symbol)
    return fetch(news.company_news, symbol, company["name"])


@app.post("/api/company/{ticker}/dcf")
def dcf_route(ticker: str, assumptions: dict = Body(default={}, embed=True)):
    """Runs the DCF. Send {"assumptions": {...}} to override any default; omit to use defaults."""
    return fetch(dcf.model, yahoo.normalize(ticker), assumptions)


@app.post("/api/company/{ticker}/dcf.xlsx")
def dcf_excel_route(ticker: str, assumptions: dict = Body(default={}, embed=True)):
    result = dcf_route(ticker, assumptions)
    return Response(
        dcf_excel.workbook(result),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{result["symbol"]}_DCF.xlsx"'},
    )


@app.get("/api/company/{ticker}/comps")
def comps_route(ticker: str, peers: str = ""):
    """Comparable companies. Pass ?peers=MSFT,GOOGL to choose peers; omit for suggestions."""
    return fetch(comps.build, yahoo.normalize(ticker), peers.upper().replace(" ", ""))


@app.get("/api/screener/options")
def screener_options():
    return fetch(screener.options)


@app.get("/api/screener")
def screener_route(
    country: str = "us", sector: str = "", industry: str = "", cap: str = "",
    pe: str = "", dividend: str = "", growth: str = "", sort: str = "marketcap",
):
    """Explore stocks by country, sector, industry, market cap, P/E, dividend and growth."""
    return fetch(screener.screen, country, sector, industry, cap, pe, dividend, growth, sort)



@app.get("/api/health")
def health():
    """Used by the hosting service to check the server is up (no external calls)."""
    return {"ok": True}


@app.get("/api/market")
def market_route():
    """Headline markets for the top bar: S&P 500, Nasdaq, TSX, USD/CAD, US 10-year yield."""
    return fetch(yahoo.market)


@app.get("/api/game/today")
def game_today():
    """Today's Mystery Company puzzle number and the list of companies you can guess."""
    return fetch(game.today)


@app.get("/api/game/guess")
def game_guess(puzzle: int, attempt: int, symbol: str):
    """Clues for one guess. The answer is only included once the game is over."""
    return fetch(game.guess, puzzle, attempt, symbol)


# ---------- The website itself (production) ----------
# If the frontend has been built (frontend/dist), serve it from here too. Any path that isn't
# an API route or a real file gets index.html, so React can show the right page
# (e.g. /company/AAPL). In development the Vite dev server does this instead.
WEBSITE = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if WEBSITE.is_dir():
    app.mount("/assets", StaticFiles(directory=WEBSITE / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def website(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Unknown API route")
        file = (WEBSITE / path).resolve()
        if path and file.is_file() and WEBSITE in file.parents:
            return FileResponse(file)
        return FileResponse(WEBSITE / "index.html")
