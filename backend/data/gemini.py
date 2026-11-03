"""
Google Gemini (free tier), used by "Ask Finch". Docs: https://ai.google.dev/api/generate-content

The key is read from GEMINI_API_KEY on the server and sent in a request header. It never goes to
the browser or into a URL, and error messages never include it.
"""

import os

import requests

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
MODELS = ["gemini-3.5-flash", "gemini-flash-lite-latest"]  # second one is the fallback when the first is busy
TIMEOUT = 30


class GeminiUnavailable(RuntimeError):
    pass


def configured() -> bool:
    return bool(os.getenv("GEMINI_API_KEY"))


def generate(system: str, messages: list, max_tokens: int = 1200) -> str:
    """messages: [{"role": "user" | "model", "text": str}]. Returns the reply text."""
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        raise GeminiUnavailable("Ask Finch isn't set up on this server.")
    body = {
        "system_instruction": {"parts": [{"text": system}]},
        "contents": [{"role": m["role"], "parts": [{"text": m["text"]}]} for m in messages],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0.2},
    }
    last_problem = "no response"
    for model in MODELS:
        config = dict(body["generationConfig"])
        if model.startswith("gemini-3"):
            config["thinkingConfig"] = {"thinkingLevel": "low"}
        try:
            r = requests.post(URL.format(model=model), json={**body, "generationConfig": config},
                              headers={"x-goog-api-key": key}, timeout=TIMEOUT)
        except requests.RequestException as e:
            last_problem = type(e).__name__
            continue
        if r.status_code in (429, 500, 503, 504):  # busy or over the free quota: try the next model
            last_problem = f"HTTP {r.status_code}"
            continue
        if not r.ok:
            raise GeminiUnavailable(f"The AI service refused the request (HTTP {r.status_code}).")
        data = r.json()
        try:
            parts = data["candidates"][0]["content"]["parts"]
            text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
        except (KeyError, IndexError):
            text = ""
        if text:
            return text
        last_problem = data.get("candidates", [{}])[0].get("finishReason", "empty reply")
    raise GeminiUnavailable(f"The AI service is busy right now ({last_problem}). Please try again in a minute.")
