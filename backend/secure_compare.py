"""Constant-time comparison for shared secrets.

``a != b`` on a secret returns as soon as the first byte differs, so response
time leaks how much of a guess was right. ``hmac.compare_digest`` does not, but
its own docs note it can still reveal the *lengths* of its inputs. Both sides
are therefore hashed to a fixed 32 bytes first.

Same contract as the Next.js app's ``lib/security/secure-compare.ts`` and WTEN's
``src/lib/hooks/secureCompare.ts``: an unset or empty expected secret never
matches anything (fail closed). ``test/security/secret-compare-scan.spec.ts``
fails if a secret is compared with ``==``/``!=`` in this package again.
"""

from __future__ import annotations

import hashlib
import hmac
from typing import Iterable, Optional


def _digest(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def secret_matches(provided: Optional[str], expected: Optional[str]) -> bool:
    """True only when a secret is configured, a value was received, and they match."""
    if not expected or provided is None:
        return False
    return hmac.compare_digest(_digest(provided), _digest(expected))


def secret_matches_any(provided: Optional[str], expected: Iterable[Optional[str]]) -> bool:
    """True when ``provided`` matches any configured secret; every candidate is checked."""
    matched = False
    for secret in expected:
        if secret_matches(provided, secret):
            matched = True
    return matched


def bearer_token(authorization: Optional[str]) -> Optional[str]:
    """The token from ``Authorization: Bearer <token>``, or None when the scheme is absent."""
    if not authorization:
        return None
    parts = authorization.strip().split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()
