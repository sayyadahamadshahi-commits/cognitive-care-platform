"""
Thin wrapper around the Gemini API — via Google's OpenAI-compatible endpoint.

Why this approach instead of the `google-genai` SDK:
  - Google publishes an OpenAI-compatible endpoint at
    https://generativelanguage.googleapis.com/v1beta/openai/ that accepts
    the exact same request/response shape as OpenAI's chat.completions API.
  - That means we can reuse the `openai` package that's already a dependency
    (see openai_service.py) instead of adding `google-genai` as a second
    SDK — same {"role", "content"} message dicts that routes/assistant.py
    already builds, zero new pip installs.
  - Docs: https://ai.google.dev/gemini-api/docs/openai

Model default is "gemini-3.7-flash" (GA, production-ready Flash-tier model
as of writing). "gemini-flash-latest" also exists but Google documents it as
an experimental alias not recommended for production — use GEMINI_MODEL in
.env if you want to pin a different one (e.g. "gemini-3.5-flash" for lower
cost).
"""

import os
import time
from openai import OpenAI, OpenAIError

GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_MODEL = "gemini-3.5-flash-lite"
REQUEST_TIMEOUT_SECONDS = 30  # fail fast instead of hanging on an overloaded model
MAX_RETRIES_ON_OVERLOAD = 2  # one quick retry for transient 503s, then give up
RETRY_BACKOFF_SECONDS = 1.5


class GeminiConfigError(RuntimeError):
    """Raised when GEMINI_API_KEY is missing or empty."""


def _get_client() -> OpenAI:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        raise GeminiConfigError(
            "GEMINI_API_KEY is not set. Add it to backend/.env "
            "(get a key at https://aistudio.google.com/apikey)."
        )
    return OpenAI(api_key=api_key, base_url=GEMINI_BASE_URL, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=MAX_RETRIES_ON_OVERLOAD)


def ask_gemini(messages: list[dict], model: str | None = None) -> str:
    """
    messages: list of {"role": "system"|"user"|"assistant", "content": str}
    Returns the assistant's reply text.
    """
    client = _get_client()
    chosen_model = model or os.getenv("GEMINI_MODEL", DEFAULT_MODEL)

    last_error = None
    for attempt in range(MAX_RETRIES_ON_OVERLOAD + 1):
        try:
            response = client.chat.completions.create(
                model=chosen_model,
                messages=messages,
                max_tokens=2048,
                temperature=0.6,
            )
            break
        except OpenAIError as e:    
            last_error = e
            # 503/UNAVAILABLE = model temporarily overloaded on Google's side —
            # worth one quick retry. Anything else, fail immediately.
            transient = (
                "503" in str(e) or "UNAVAILABLE" in str(e) or "overloaded" in str(e).lower()
                or "timeout" in str(e).lower() or "timed out" in str(e).lower()
            )
            if transient and attempt < MAX_RETRIES_ON_OVERLOAD:
                time.sleep(RETRY_BACKOFF_SECONDS)
                continue
            raise RuntimeError(f"Gemini API error: {e}") from e
    else:
        raise RuntimeError(f"Gemini API error: {last_error}")

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        return "I didn't get a response back — please try again."
    text = choice.message.content.strip()
    if getattr(choice, 'finish_reason', None) == 'length':
        text += "\n\n[Response reached maximum length limit.]"
    return text