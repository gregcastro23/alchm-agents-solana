"""Sign chat conversation handles and bind them to an agent and caller."""

import base64
import hashlib
import hmac
import json
import re
import secrets
from typing import Optional


_MAX_HANDLE_LENGTH = 512
_SIGNED_HANDLE = re.compile(r"pa1\.([A-Za-z0-9_-]{43})\.([A-Za-z0-9_-]{43})\Z")


def _encode_digest(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _digest(secret: bytes, *parts: str) -> str:
    payload = json.dumps(parts, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    return _encode_digest(hmac.new(secret, payload, hashlib.sha256).digest())


def scoped_session_id(
    agent_id: str,
    owner: str,
    supplied_session_id: Optional[str],
    signing_secret: str,
) -> str:
    """Return a signed handle scoped to the verified owner and requested agent.

    Authenticated callers can resume a raw client handle deterministically.
    Anonymous callers receive a fresh handle for raw input; a signed anonymous
    handle is a bearer capability that permits its possessor to resume it.
    """
    for name, value in (("agent_id", agent_id), ("owner", owner), ("signing_secret", signing_secret)):
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"{name} must be a nonempty string")

    if supplied_session_id is not None:
        if not isinstance(supplied_session_id, str):
            raise ValueError("Session handle must be a string")
        if len(supplied_session_id) > _MAX_HANDLE_LENGTH:
            raise ValueError("Session handle must be at most 512 characters")

    secret = signing_secret.encode("utf-8")
    if supplied_session_id and (
        supplied_session_id.startswith("pa1.") or supplied_session_id == "pa1"
    ):
        match = _SIGNED_HANDLE.fullmatch(supplied_session_id)
        if match is None:
            raise ValueError("Invalid signed session handle")
        nonce, signature = match.groups()
        expected = _digest(secret, "pa-chat-session-v1", owner, agent_id, nonce)
        if not hmac.compare_digest(signature, expected):
            raise ValueError("Session handle is invalid for this caller or agent")
        return supplied_session_id

    if supplied_session_id and owner != "anonymous":
        nonce = _digest(secret, "pa-chat-client-session-v1", owner, agent_id, supplied_session_id)
    else:
        nonce = _encode_digest(secrets.token_bytes(32))
    signature = _digest(secret, "pa-chat-session-v1", owner, agent_id, nonce)
    return f"pa1.{nonce}.{signature}"
