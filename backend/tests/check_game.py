"""
Checks the Mystery Company game logic.
Run from the backend folder:  .venv/bin/python -m tests.check_game
"""
from data import game

pool = game._answer_pool()
print("companies to guess:", len(game._companies()), "| possible answers:", len(pool))
assert len(pool) >= 20

n = game.today_number()
first = game._answer(n)
assert first == game._answer(n), "same puzzle must give the same answer"
answers = [game._answer(i)["symbol"] for i in range(2, 2 + len(pool))]
assert len(set(answers)) == len(pool), "every company gets a turn before any repeats"
assert all((game._cap_usd(r) or 0) >= game.MIN_ANSWER_CAP_USD for r in pool)
assert game._answer(1)["symbol"] == "INTC"
print("answers cycle every", len(pool), "days | next few:", answers[:5])

r = game.guess(n, 1, first["symbol"])
assert r["correct"] and r["answer"]["symbol"] == first["symbol"]
assert all(v == "match" for k, v in r["clues"].items()), r["clues"]

wrong = next(c for c in game._companies().values() if c["name"] != first["name"])
r = game.guess(n, 1, wrong["symbol"])
assert not r["correct"] and r["answer"] is None, "the answer must stay hidden during the game"
r = game.guess(n, 6, wrong["symbol"])
assert not r["correct"] and r["answer"] is not None, "the answer is revealed after the last guess"

# Direction: a clue says where the answer sits relative to the guess.
assert game._compare(10, 50, game._within_percent(10)) == "higher"
assert game._compare(50, 10, game._within_percent(10)) == "lower"
assert game._compare(100, 105, game._within_percent(10)) == "match"
assert game._compare(None, 5, game._within_percent(10)) == "unknown"
for bad in [(n + 1, 1, first["symbol"]), (n, 1, "NOT-A-TICKER")]:
    try:
        game.guess(*bad)
        raise SystemExit(f"should have been refused: {bad}")
    except ValueError:
        pass
print("all game checks passed")
