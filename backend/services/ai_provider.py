"""
Single entry point the route calls — picks the actual provider based on the
AI_PROVIDER env var so routes/assistant.py doesn't need to know which
backend is in use, and switching providers is a one-line .env change.

Set in backend/.env:
    AI_PROVIDER=openai      # default — OpenAI via the official openai SDK
    AI_PROVIDER=gemini      # Gemini Flash via the OpenAI-compatible endpoint

Optional automatic fallback: if the primary provider fails (rate limit,
503/overloaded, timeout — anything except a missing API key), try the next
provider in AI_PROVIDER_FALLBACK before giving up to the frontend's local
canned engine.

    AI_PROVIDER_FALLBACK=gemini
"""

import os

from .gemini_service import ask_gemini, GeminiConfigError
from .openai_service import ask_openai, OpenAIConfigError
from .anthropic_service import ask_anthropic, AnthropicConfigError


class AIConfigError(RuntimeError):
    """Raised when every candidate provider's API key is missing/empty."""


_PROVIDERS = {
    "gemini": (ask_gemini, GeminiConfigError),
    "openai": (ask_openai, OpenAIConfigError),
    "anthropic": (ask_anthropic, AnthropicConfigError),
}


def current_provider() -> str:
    return os.getenv("AI_PROVIDER", "openai").strip().lower()


def _fallback_chain() -> list[str]:
    raw = os.getenv("AI_PROVIDER_FALLBACK", "")
    return [p.strip().lower() for p in raw.split(",") if p.strip()]


def ask_ai(messages: list[dict]) -> str:
    candidates = [current_provider()] + _fallback_chain()
    last_config_error = None
    last_upstream_error = None

    for provider in candidates:
        entry = _PROVIDERS.get(provider)
        if entry is None:
            continue  # unknown name in the fallback list — skip, don't crash
        ask_fn, config_error_cls = entry
        try:
            return ask_fn(messages)
        except config_error_cls as e:
            # No key for this provider — try the next candidate rather than
            # failing the whole request.
            last_config_error = e
            continue
        except Exception as e:
            # Reached the provider but it errored (rate limit, overloaded,
            # timeout, etc.) — also worth trying the next candidate.
            last_upstream_error = e
            continue

    if last_upstream_error is not None:
        raise last_upstream_error
    raise AIConfigError(str(last_config_error) if last_config_error else "No AI provider configured.")


def is_configured() -> bool:
    """Cheap check for the /health endpoint — is a key present for the
    currently selected provider? (Doesn't make a network call.)"""
    provider = current_provider()
    key_env = {
        "gemini": "GEMINI_API_KEY",
        "openai": "OPENAI_API_KEY",
    }.get(provider)
    return bool(key_env and os.getenv(key_env, "").strip())