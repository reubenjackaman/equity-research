"""
Keeps the live site quick on Render's free plan. Runs only on Render (it sets RENDER=true).

1. Keep awake: the free plan stops the server after 15 minutes without visitors, and a restart
   empties the cache. Every 10 minutes the server visits its own public address, which counts
   as a visitor. One always-on service uses about 744 of the free plan's 750 hours a month.
2. Preload: in the background, fetch the companies people look at most (and, for the biggest,
   their competitors), so the first visitor to AAPL or RY.TO doesn't wait. Repeats every
   12 hours, inside the one-day cache life of the financial statements.
"""

import logging
import os
import threading
import time

import requests

log = logging.getLogger("warmup")

PING_EVERY = 10 * 60
PRELOAD_EVERY = 12 * 60 * 60
START_DELAY = 60  # let the server finish starting before the background work
PAUSE = 3  # seconds between companies, to stay gentle on the free CPU and the data providers

# Home page examples first, then the largest US and TSX names.
POPULAR = [
    "AAPL", "MSFT", "NVDA", "SHOP.TO", "RY.TO", "CNR.TO",
    "GOOGL", "AMZN", "META", "TSLA", "JPM", "V", "MA", "BRK-B", "WMT", "COST", "LLY", "XOM",
    "NFLX", "AMD", "INTC", "KO", "DIS",
    "TD.TO", "BNS.TO", "BMO.TO", "CM.TO", "ENB.TO", "CP.TO", "SU.TO", "BCE.TO", "ATD.TO",
]
WITH_COMPETITORS = 12  # the first N also get their comps (each competitor's statements) loaded


def _keep_awake(url: str):
    while True:
        time.sleep(PING_EVERY)
        try:
            requests.get(f"{url}/api/health", timeout=30)
        except requests.RequestException as e:
            log.warning("keep-awake ping failed: %s", type(e).__name__)


def _preload():
    from finance import comps, dcf, health, ratios, statements, valuation_history  # after the app has started

    time.sleep(START_DELAY)
    while True:
        started = time.monotonic()
        for i, ticker in enumerate(POPULAR):
            steps = [lambda: statements.build(ticker, "annual"), lambda: ratios.build(ticker),
                     lambda: health.build(ticker), lambda: valuation_history.build(ticker),
                     lambda: dcf.model(ticker, {})]
            if i < WITH_COMPETITORS:
                steps.append(lambda: comps.build(ticker, ""))
            for step in steps:
                try:
                    step()
                except Exception:
                    pass  # some analyses don't apply (e.g. DCF for banks); the page explains that itself
            time.sleep(PAUSE)
        log.info("preloaded %d companies in %.0fs", len(POPULAR), time.monotonic() - started)
        time.sleep(PRELOAD_EVERY)


def start():
    if not os.getenv("RENDER"):
        return  # local development: nothing to keep awake
    url = os.getenv("RENDER_EXTERNAL_URL")
    if url:
        threading.Thread(target=_keep_awake, args=(url,), daemon=True, name="keep-awake").start()
    threading.Thread(target=_preload, daemon=True, name="preload").start()
