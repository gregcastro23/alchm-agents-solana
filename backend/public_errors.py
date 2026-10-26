"""Fixed vocabulary for failures reported to anonymous callers.

A raw exception string can carry an upstream hostname, a database user, a
filesystem path, or the masked tail of an API key (``Incorrect API key provided:
sk-proj-****abcd``). A public response therefore names the *class* of failure and
nothing else; the detail goes to the server log, where the operator can read it.

The vocabulary is closed on purpose. ``tests/test_agents_privacy.py`` pins it, so a
new code is a deliberate change rather than a side effect of formatting an exception.
"""

from __future__ import annotations

from typing import Optional

AUTH_FAILED = "auth_failed"
RATE_LIMITED = "rate_limited"
TIMEOUT = "timeout"
UNAVAILABLE = "unavailable"

PUBLIC_ERROR_CODES = frozenset({AUTH_FAILED, RATE_LIMITED, TIMEOUT, UNAVAILABLE})


def _status_code(exc: BaseException) -> Optional[int]:
    """The HTTP status an SDK / httpx exception carries, if it carries one."""
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status
    status = getattr(getattr(exc, "response", None), "status_code", None)
    return status if isinstance(status, int) else None


def public_error_code(exc: BaseException) -> str:
    """Map any exception to one of ``PUBLIC_ERROR_CODES``. Never includes its message."""
    status = _status_code(exc)
    if status in (401, 403):
        return AUTH_FAILED
    if status == 429:
        return RATE_LIMITED
    name = type(exc).__name__.lower()
    # TimeoutError, asyncio.TimeoutError, httpx.ReadTimeout, anthropic.APITimeoutError ...
    if "timeout" in name:
        return TIMEOUT
    if "ratelimit" in name:
        return RATE_LIMITED
    if "authentication" in name or "permissiondenied" in name:
        return AUTH_FAILED
    return UNAVAILABLE
