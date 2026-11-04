"""
Anonymous usage counts, so the site's real use can be measured (and quoted honestly).

What is counted: page views by type, companies viewed, and actions such as starting a pitch,
exporting a PDF, sharing a link and asking Finch. Daily unique visitors are estimated the way
privacy-first analytics tools do it: a one-way hash of the visitor's IP address and browser name
with a secret that changes every day and is never stored, so nobody can be followed from one day
to the next and the IP address itself is never saved. No cookies, nothing stored in the browser for
counting, and visitors whose browser sends "Do Not Track" or "Global Privacy Control" aren't counted.

Where counts live: Render's free plan wipes the server's disk on every restart and update, so
counts go to a free Upstash Redis database when UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN
are set. Without them (local development) they go to a small SQLite file next to the cache.

Writes happen on a background thread in small batches, so counting never slows a page down.
"""

import hashlib
import os
import queue
import re
import secrets
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

import requests

EVENTS = {
    # page views (sent by the browser)
    "view_home", "view_company", "view_market", "view_learn", "view_pitch_doc", "view_shared_pitch", "view_other",
    # pitch builder (sent by the browser)
    "pitch_started", "pitch_pdf", "pitch_shared", "pitch_copied",
    # counted by the server itself
    "finch_question", "pitch_draft", "pitch_critique",
}
BROWSER_EVENTS = {e for e in EVENTS if not e.startswith("finch_") and e not in ("pitch_draft", "pitch_critique")}
TICKER = re.compile(r"^[A-Z0-9.\-]{1,15}$")
DAYS_SHOWN = 30
PER_VISITOR_DAILY = 500  # a browser sending more than this in a day is ignored (keeps the numbers honest)
TZ = ZoneInfo("America/Toronto")
SQLITE_PATH = Path(__file__).resolve().parent.parent / "usage.sqlite"


def _today() -> str:
    return datetime.now(TZ).date().isoformat()


# ---------- Visitor hashing (daily-rotating, never stored) ----------

_salt = {"day": None, "value": b""}
_seen = {}  # hash -> events counted today, to cap floods; cleared daily
_lock = threading.Lock()


def visitor_hash(ip: str, user_agent: str) -> str:
    day = _today()
    with _lock:
        if _salt["day"] != day:
            _salt.update(day=day, value=secrets.token_bytes(16))
            _seen.clear()
        salt = _salt["value"]
    return hashlib.sha256(salt + f"{ip}|{user_agent}".encode()).hexdigest()[:24]


def _allow(visitor: str) -> bool:
    with _lock:
        _seen[visitor] = _seen.get(visitor, 0) + 1
        return _seen[visitor] <= PER_VISITOR_DAILY


# ---------- Stores ----------

class _Upstash:
    name = "Upstash Redis"

    def __init__(self, url: str, token: str):
        self.url, self.headers = url.rstrip("/"), {"Authorization": f"Bearer {token}"}

    def run(self, commands: list) -> list:
        res = requests.post(f"{self.url}/pipeline", json=commands, headers=self.headers, timeout=10)
        res.raise_for_status()  # never echo the URL or token
        return [r.get("result") for r in res.json()]


class _SQLite:
    name = "local file (resets when the server's disk does)"

    def __init__(self, path: Path):
        self.path = path
        with self._db() as db:
            db.execute("create table if not exists counters (key text primary key, value integer)")
            db.execute("create table if not exists members (key text, member text, primary key (key, member))")
            db.execute("create table if not exists scores (key text, member text, score integer, primary key (key, member))")

    def _db(self):
        return sqlite3.connect(self.path, timeout=10)

    def run(self, commands: list) -> list:
        """Understands the few Redis commands this module uses."""
        out = []
        with self._db() as db:
            for cmd, key, *args in commands:
                if cmd == "INCR":
                    db.execute("insert into counters values (?, 1) on conflict(key) do update set value = value + 1", (key,))
                    out.append(None)
                elif cmd == "MGET":
                    keys = [key, *args]
                    rows = dict(db.execute(f"select key, value from counters where key in ({','.join('?' * len(keys))})", keys))
                    out.append([rows.get(k) for k in keys])
                elif cmd == "PFADD":
                    db.executemany("insert or ignore into members values (?, ?)", [(key, m) for m in args])
                    out.append(None)
                elif cmd == "PFCOUNT":
                    out.append(db.execute("select count(*) from members where key = ?", (key,)).fetchone()[0])
                elif cmd == "ZINCRBY":
                    db.execute("insert into scores values (?, ?, ?) on conflict(key, member) do update set score = score + excluded.score",
                               (key, args[1], int(args[0])))
                    out.append(None)
                elif cmd == "ZREVRANGE":
                    rows = db.execute("select member, score from scores where key = ? order by score desc limit ?",
                                      (key, int(args[1]) + 1)).fetchall()
                    out.append([x for r in rows for x in r])
                elif cmd == "EXPIRE":
                    out.append(None)  # local file: nothing to expire
        return out


def _store():
    url, token = os.getenv("UPSTASH_REDIS_REST_URL"), os.getenv("UPSTASH_REDIS_REST_TOKEN")
    return _Upstash(url, token) if url and token else _SQLite(SQLITE_PATH)


_backend = None
_queue: "queue.Queue[list]" = queue.Queue(maxsize=5000)
VISITOR_KEY_DAYS = 400  # daily visitor sets are kept a little over a year, then expire


def store():
    global _backend
    if _backend is None:
        _backend = _store()
        threading.Thread(target=_writer, daemon=True, name="usage-writer").start()
    return _backend


def _writer():
    while True:
        batch = [_queue.get()]
        time.sleep(2)  # gather a few events into one request
        while not _queue.empty() and len(batch) < 200:
            batch.append(_queue.get_nowait())
        try:
            store().run([c for cmds in batch for c in cmds])
        except Exception as e:
            print(f"usage: couldn't save {len(batch)} events ({type(e).__name__})", flush=True)


# ---------- Recording ----------

def record(event: str, visitor: str | None = None, ticker: str | None = None):
    """Counts one event. Never raises: counting must not break the page."""
    if event not in EVENTS or (visitor and not _allow(visitor)):
        return
    store()
    day = _today()
    cmds = [["INCR", f"e:{event}:{day}"], ["INCR", f"e:{event}:all"]]
    if visitor:
        cmds += [["PFADD", f"v:{day}", visitor], ["EXPIRE", f"v:{day}", str(VISITOR_KEY_DAYS * 86400)]]
    if event == "view_company" and ticker and TICKER.match(ticker):
        cmds.append(["ZINCRBY", "tickers", "1", ticker])
    try:
        _queue.put_nowait(cmds)
    except queue.Full:
        pass


def summary() -> dict:
    """Totals, the last 30 days of key events and visitors, and the most-viewed companies."""
    s = store()
    today = datetime.now(TZ).date()
    days = [(today - timedelta(days=i)).isoformat() for i in range(DAYS_SHOWN - 1, -1, -1)]
    events = sorted(EVENTS)
    cmds = [["MGET", *[f"e:{e}:all" for e in events]]]
    cmds += [["MGET", *[f"e:{e}:{d}" for d in days]] for e in events]
    cmds += [["PFCOUNT", f"v:{d}"] for d in days]
    cmds.append(["ZREVRANGE", "tickers", "0", "14", "WITHSCORES"])
    res = s.run(cmds)
    n = len(events)
    totals = {e: int(v or 0) for e, v in zip(events, res[0])}
    daily = {e: [int(v or 0) for v in res[1 + i]] for i, e in enumerate(events)}
    visitors = [int(v or 0) for v in res[1 + n: 1 + n + len(days)]]
    flat = res[-1] or []
    top = [{"symbol": flat[i], "views": int(float(flat[i + 1]))} for i in range(0, len(flat), 2)]
    views = sum(v for e, v in totals.items() if e.startswith("view_"))
    return {"store": s.name, "days": days, "totals": totals, "daily": daily, "visitors": visitors,
            "visitorDays": sum(visitors), "pageViews": views, "topCompanies": top}
