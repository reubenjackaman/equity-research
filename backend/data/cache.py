"""
A tiny on-disk cache so repeat lookups don't hit the data providers again.

Every cached function result is stored as JSON in a local SQLite file
(cache.sqlite) together with an expiry time. If you ever want fresh data
immediately, just delete that file.
"""

import functools
import json
import sqlite3
import time
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "cache.sqlite"

# How long each kind of data stays fresh, in seconds.
MINUTE = 60
HOUR = 60 * MINUTE
DAY = 24 * HOUR


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=30)  # comps fetch several companies at once
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT, expires REAL)"
    )
    return conn


def get(key: str):
    with _connect() as conn:
        row = conn.execute(
            "SELECT value, expires FROM cache WHERE key = ?", (key,)
        ).fetchone()
    if row is None or row[1] < time.time():
        return None
    return json.loads(row[0])


def put(key: str, value, ttl: float) -> None:
    with _connect() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO cache (key, value, expires) VALUES (?, ?, ?)",
            (key, json.dumps(value), time.time() + ttl),
        )


def cached(namespace: str, ttl: float):
    """Decorator: cache a function's return value by its arguments.

    Exceptions are never cached, so a failed lookup is retried next time.
    """

    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args):
            key = namespace + ":" + ":".join(str(a) for a in args)
            hit = get(key)
            if hit is not None:
                return hit
            value = fn(*args)
            put(key, value, ttl)
            return value

        return wrapper

    return decorator
