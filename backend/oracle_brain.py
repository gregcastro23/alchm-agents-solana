"""
Oracle brain — the game-aware answer engine behind POST /api/agents/oracle.

The Pentacles feeder (feeder/oracle-service.ts) POSTs ``{question, context}``
here first and only falls back to the Vercel brain, then to its own direct
Anthropic call, when this does not answer. Everything in this module therefore
follows one rule: **when we cannot give a real answer we say so with a non-2xx
status** (the route turns ``None`` into a 503). A 200 with placeholder text
would be written to SpacetimeDB and shown to the player as the Oracle's reply.

Layout of the model call (kept identical to the Vercel fallback route so a
player cannot tell which brain answered):

  system  ORACLE_SYSTEM_PROMPT — byte-stable, the prompt-caching prefix
  user    "Context:\\n{context}\\n\\nQuestion:\\n{question}\\n\\nReply in at most 120 words."
          (the "Context" block is omitted when the feeder sent none)

The concision instruction lives in the USER turn on purpose: the system prompt
must never change, and the feeder's own direct path asks for "concise" answers
through the persona's closing rules.
"""
from __future__ import annotations

import asyncio
import os
import re
import time
from typing import Any, List, Optional

import providers
from oracle_persona import ORACLE_SYSTEM_PROMPT

# The Pentacles reducer rejects questions over 500 BYTES, not characters.
MAX_QUESTION_BYTES = 500
# Live-sky (<=600 chars) + a short game-context block; anything beyond this is noise.
MAX_CONTEXT_CHARS = 2000
# ~120 words is ~170 tokens; headroom so no provider truncates mid-sentence.
MAX_OUTPUT_TOKENS = 280
REPLY_LIMIT_INSTRUCTION = "Reply in at most 120 words."


def _env_seconds(name: str, default: float) -> float:
    try:
        value = float(os.getenv(name, ""))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


class OracleInputError(ValueError):
    """The request body is not a valid oracle question (answered with HTTP 400)."""


def parse_request(question: Any, context: Any) -> "tuple[str, str]":
    """Validate and normalise the body. Returns (question, context); context may be ''."""
    if not isinstance(question, str):
        raise OracleInputError("Invalid or missing question. Must be a string.")
    question = question.strip()
    if not question:
        raise OracleInputError("Invalid or missing question. Must not be empty.")
    try:
        question_bytes = len(question.encode("utf-8"))
    except UnicodeEncodeError:  # a lone surrogate, e.g. the JSON escape ud800: not text any provider can take
        raise OracleInputError("Invalid question. Must be valid Unicode text.") from None
    if question_bytes > MAX_QUESTION_BYTES:
        raise OracleInputError(
            f"Invalid question. Must be at most {MAX_QUESTION_BYTES} bytes."
        )
    if context is not None and not isinstance(context, str):
        raise OracleInputError("Invalid context. Must be a string.")
    context = (context or "").strip()[:MAX_CONTEXT_CHARS]
    try:
        context.encode("utf-8")
    except UnicodeEncodeError:
        raise OracleInputError("Invalid context. Must be valid Unicode text.") from None
    return question, context


def build_user_message(question: str, context: str) -> str:
    """The user turn: optional context block, the question, the length instruction."""
    parts: List[str] = []
    if context:
        parts.append(f"Context:\n{context}")
    parts.append(f"Question:\n{question}")
    parts.append(REPLY_LIMIT_INSTRUCTION)
    return "\n\n".join(parts)


def clean_answer(text: Optional[str]) -> str:
    """Collapse whitespace to single spaces — the Oracle UI shows one paragraph."""
    return re.sub(r"\s+", " ", text or "").strip()


async def answer(
    question: str,
    context: str,
    *,
    tier: str,
    anthropic_model: Optional[str],
) -> Optional[providers.CallResult]:
    """
    Ask the provider chain. Returns a CallResult whose ``text`` is the cleaned,
    non-empty answer, or None when no provider produced one in time (no keys,
    every provider failed, or the overall deadline passed).

    Latency budget: each provider call is bounded (ORACLE_PROVIDER_TIMEOUT_SECONDS,
    default 6) so a hung link advances the chain, and the whole walk is bounded
    (ORACLE_TIMEOUT_SECONDS, default 12). The player's client stops waiting after 25 s
    and the feeder asks this brain and then the Vercel brain in turn, so two full
    budgets (12 s + 12 s) fit inside it. An empty completion counts as a failure and
    advances the walk, as it does on the Vercel route.
    """
    chain = providers.build_chain(tier, anthropic_model)
    if not any(cfg.api_key for cfg in chain):
        print("oracle_unavailable reason=no_provider_keys", flush=True)
        return None

    total_timeout = _env_seconds("ORACLE_TIMEOUT_SECONDS", 12.0)
    per_call_timeout = _env_seconds("ORACLE_PROVIDER_TIMEOUT_SECONDS", 6.0)
    started = time.monotonic()
    try:
        result = await asyncio.wait_for(
            providers.run_chain(
                chain=chain,
                persona_block=ORACLE_SYSTEM_PROMPT,
                rag_block="",
                user_message=build_user_message(question, context),
                agent_id="pentacles-oracle",
                tier=tier,
                max_tokens=MAX_OUTPUT_TOKENS,
                per_call_timeout_s=per_call_timeout,
                require_text=True,
            ),
            timeout=total_timeout,
        )
    except asyncio.TimeoutError:
        print(f"oracle_unavailable reason=deadline seconds={total_timeout}", flush=True)
        return None

    text = clean_answer(result.text if result is not None else None)
    if result is None or not text:
        print("oracle_unavailable reason=no_answer", flush=True)
        return None
    print(
        f"oracle_answered provider={result.provider} model={result.model} "
        f"latency_ms={int((time.monotonic() - started) * 1000)} chars={len(text)}",
        flush=True,
    )
    result.text = text
    return result
