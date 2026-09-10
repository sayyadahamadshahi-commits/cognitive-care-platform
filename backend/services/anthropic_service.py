"""
Thin wrapper around the Anthropic SDK.

Unlike Gemini, Anthropic's Messages API is not OpenAI-request-shaped (system
prompt is a separate top-level field, not a "system" role message), so this
uses the real `anthropic` SDK rather than an OpenAI-compatible shim.

Requires: pip install anthropic --break-system-packages   (or add
"anthropic" to backend/requirements.txt)
"""

import os
from anthropic import Anthropic, APIError

DEFAULT_MODEL = "claude-sonnet-5"


class AnthropicConfigError(RuntimeError):
    """Raised when ANTHROPIC_API_KEY is missing or empty."""


def _get_client() -> Anthropic:
    api_key = os.getenv("ANTHROPIC_API_KEY", "").strip()
    if not api_key:
        raise AnthropicConfigError(
            "ANTHROPIC_API_KEY is not set. Add it to backend/.env "
            "(get a key at https://console.anthropic.com/settings/keys)."
        )
    return Anthropic(api_key=api_key)


def ask_anthropic(messages: list[dict], model: str | None = None) -> str:
    """
    messages: list of {"role": "system"|"user"|"assistant", "content": str}
    (same shape routes/assistant.py already builds for the OpenAI/Gemini
    path — the leading "system" message, if present, is pulled out and sent
    as Anthropic's separate `system` parameter.)
    Returns the assistant's reply text.
    """
    client = _get_client()
    chosen_model = model or os.getenv("ANTHROPIC_MODEL", DEFAULT_MODEL)

    system_prompt = ""
    turns = []
    for m in messages:
        if m.get("role") == "system":
            system_prompt = (system_prompt + "\n\n" + m["content"]).strip()
        else:
            turns.append(m)

    try:
        response = client.messages.create(
            model=chosen_model,
            max_tokens=2048,
            system=system_prompt or None,
            messages=turns,
        )
    except APIError as e:
        raise RuntimeError(f"Anthropic API error: {e}") from e

    block = next((b for b in response.content if b.type == "text"), None)
    if not block or not block.text:
        return "I didn't get a response back — please try again."
    text = block.text.strip()
    if getattr(response, 'stop_reason', None) == 'max_tokens':
        text += "\n\n[Response reached maximum length limit.]"
    return text