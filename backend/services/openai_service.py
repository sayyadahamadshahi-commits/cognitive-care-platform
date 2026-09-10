"""
Thin wrapper around the OpenAI SDK.

  - Reads the key lazily (per-call) instead of at import time, and raises a
    clear error if it's missing instead of letting the SDK fail with a
    confusing "Incorrect API key" message.
  - Uses chat.completions (accepts plain {"role", "content"} dicts, which
    routes/assistant.py already builds) — supported by every current model.
  - Model configurable via OPENAI_MODEL so you're not stuck if a model gets
    deprecated.
  - Timeout + retries capped so an overloaded/slow upstream can't turn one
    chat message into a 60s+ hang in the UI (mirrors gemini_service.py).
"""

import os
from openai import OpenAI, OpenAIError

DEFAULT_MODEL = "gpt-4o-mini"
REQUEST_TIMEOUT_SECONDS = 30  # fail fast instead of hanging on an overloaded model
MAX_RETRIES = 1  # one quick retry for transient 503s, then give up
RETRY_BACKOFF_SECONDS = 1.5


class OpenAIConfigError(RuntimeError):
    """Raised when OPENAI_API_KEY is missing or empty."""


def _get_client() -> OpenAI:
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    if not api_key:
        raise OpenAIConfigError(
            "OPENAI_API_KEY is not set. Add it to backend/.env "
            "(get a key at https://platform.openai.com/api-keys). Make sure "
            "the account also has billing/credits enabled — a valid key on "
            "a zero-balance account still fails with a 429 insufficient_quota error."
        )
    return OpenAI(api_key=api_key, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=MAX_RETRIES)


def ask_openai(messages: list[dict], model: str | None = None) -> str:
    """
    messages: list of {"role": "system"|"user"|"assistant", "content": str}
    Returns the assistant's reply text.
    """
    client = _get_client()
    chosen_model = model or os.getenv("OPENAI_MODEL", DEFAULT_MODEL)

    try:
        response = client.chat.completions.create(
            model=chosen_model,
            messages=messages,
            max_tokens=2048,
            temperature=0.6,
        )
    except OpenAIError as e:
        raise RuntimeError(f"OpenAI API error: {e}") from e

    choice = response.choices[0] if response.choices else None
    if not choice or not choice.message or not choice.message.content:
        return "I didn't get a response back — please try again."
    text = choice.message.content.strip()
    if getattr(choice, 'finish_reason', None) == 'length':
        text += "\n\n[Response reached maximum length limit.]"
    return text