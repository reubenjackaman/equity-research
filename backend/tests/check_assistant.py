"""
Checks Ask Finch's safety limits and input handling. Makes one real AI call at the end
(skipped when GEMINI_API_KEY isn't set).
Run from the backend folder:  .venv/bin/python -m tests.check_assistant
"""
import os

from dotenv import load_dotenv

load_dotenv(".env")

from fastapi.testclient import TestClient

import main
from data import gemini
from finance import assistant

# 1. Rate limits: 5 a minute and 20 a day per visitor, 200 a day in total.
lim = assistant._Limiter()
for _ in range(assistant.PER_VISITOR_PER_MINUTE):
    lim.take("a")
try:
    lim.take("a")
    raise SystemExit("per-minute limit didn't trigger")
except assistant.LimitReached:
    pass
lim = assistant._Limiter()
lim.recent.default_factory = lambda: __import__("collections").deque(maxlen=0)  # ignore the per-minute window
for i in range(assistant.PER_VISITOR_DAILY):
    lim.take("b")
try:
    lim.take("b")
    raise SystemExit("per-visitor daily limit didn't trigger")
except assistant.LimitReached:
    pass
lim = assistant._Limiter()
lim.recent.default_factory = lambda: __import__("collections").deque(maxlen=0)
for i in range(assistant.DAILY_LIMIT):
    lim.take(f"visitor-{i}")
try:
    lim.take("someone-new")
    raise SystemExit("site-wide daily limit didn't trigger")
except assistant.LimitReached:
    pass
print(f"limits work: {assistant.PER_VISITOR_PER_MINUTE}/minute and {assistant.PER_VISITOR_DAILY}/day per visitor, "
      f"{assistant.DAILY_LIMIT}/day site-wide")

# 2. Bad input is refused before anything is counted or sent to the AI.
client = TestClient(main.app)
checks = [
    ({"symbol": "AAPL", "tab": "Overview", "question": "x" * 600}, 422),
    ({"symbol": "AAPL", "tab": "Overview", "question": "   "}, 422),
    ({"symbol": "<script>", "tab": "Overview", "question": "hi"}, 422),
]
before = assistant.limiter.total
for body, status in checks:
    r = client.post("/api/ask", json=body)
    assert r.status_code == status, (body, r.status_code, r.text)
r = client.post("/api/ask", json={"symbol": "AAPL", "question": "hi", "history": [{"role": "user", "text": "x" * 50_000}]},
                headers={"content-length": "60000"})
assert r.status_code in (413, 422), r.status_code
assert assistant.limiter.total == before, "rejected requests must not use up the daily quota"
print("bad input refused without using quota")

# 3. Without a key the feature switches off cleanly.
saved = os.environ.pop("GEMINI_API_KEY", None)
r = client.post("/api/ask", json={"symbol": "AAPL", "tab": "Overview", "question": "What does Apple sell?"})
assert r.status_code == 503 and "set up" in r.json()["detail"], r.text
print("no key: answers 503 'isn't set up'")

# 4. The key never reaches the browser or the code on GitHub.
if saved:
    os.environ["GEMINI_API_KEY"] = saved
    dist = main.WEBSITE if hasattr(main, "WEBSITE") else None
    for path in __import__("pathlib").Path("..").glob("frontend/src/**/*"):
        if path.is_file():
            assert saved not in path.read_text(errors="ignore"), f"key found in {path}"
    print("key not present in any frontend source file")

    # 5. One real question.
    a = client.post("/api/ask", json={"symbol": "AAPL", "tab": "Ratios", "question": "What was Apple's net margin in FY2025?"})
    assert a.status_code == 200, a.text
    reply = a.json()["answer"]
    assert saved not in reply and "26.9" in reply, reply
    print("live answer:", reply[:160].replace("\n", " "), "...")
print("all Ask Finch checks passed")
