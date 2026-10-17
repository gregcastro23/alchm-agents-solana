"""
OIDC issuer for Pentacles SSO.

Turns an alchm.kitchen (Auth.js v5) browser session into a long-lived RS256
identity token that SpacetimeDB can validate as an OpenID Connect client JWT:
SpacetimeDB fetches {iss}/.well-known/openid-configuration, follows jwks_uri,
and verifies the token signature against the published RSA public key. The
subject (`sub`) is the kitchen user's stable DB UUID, so one kitchen account
maps to one SpacetimeDB identity.

Endpoints (router registered in main.py right after the CORS middleware):
    GET  /.well-known/openid-configuration  — OIDC discovery document (static)
    GET  /.well-known/jwks.json             — public key set (from env PEM)
    POST /oidc/token                        — kitchen cookie → 30-day id token
    GET  /oidc/session                      — kitchen cookie → {user} (no mint)

Session validation forwards the caller's raw Cookie header to the kitchen's
Auth.js session endpoint (same pattern as WTEN's agentsBridge.ts): the
`__Secure-authjs.session-token` cookie is scoped to Domain=.alchm.kitchen, so
browsers include it on credentialed CORS calls to api.agents.alchm.kitchen.
GET /api/auth/session returns 200 `null` anonymously or {user:{...}, expires}
when the cookie names a live session. An unreachable kitchen is reported as
503 kitchen_unreachable — NOT 401 — so clients never mistake an upstream
outage for "logged out".

The signing key arrives via OIDC_SIGNING_KEY_PEM (RSA private key PEM, set on
the Railway service). It is loaded lazily on first use so a deployment
without the env var still boots and serves every non-OIDC route; the
key-dependent routes return 503 until the key is configured.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import threading
import time
from typing import Any, Dict, Optional

import httpx
import jwt
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

router = APIRouter()

ISSUER = "https://api.agents.alchm.kitchen"
JWKS_PATH = "/.well-known/jwks.json"
AUDIENCE = "pentacles"
TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60  # 30 days

# Overridable for tests / staging; production default is the live kitchen.
KITCHEN_SESSION_URL = os.getenv(
    "KITCHEN_SESSION_URL", "https://alchm.kitchen/api/auth/session"
)
KITCHEN_TIMEOUT_S = float(os.getenv("KITCHEN_SESSION_TIMEOUT_S", "4.0"))


# ---------------------------------------------------------------------------
# Signing key (lazy singleton — import must never crash on a keyless boot)
# ---------------------------------------------------------------------------

_key_lock = threading.Lock()
_key_cache: Optional[Dict[str, Any]] = None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_uint(value: int) -> str:
    return _b64url(value.to_bytes(max(1, (value.bit_length() + 7) // 8), "big"))


def load_signing_key() -> Optional[Dict[str, Any]]:
    """Parse OIDC_SIGNING_KEY_PEM once and cache {key, kid, jwk}.

    Returns None when the env var is unset/empty (routes answer 503) — never
    raises for a missing key, so the rest of the app keeps serving. A present
    but malformed PEM DOES raise: that is a deployment error worth a loud 500.
    """
    global _key_cache
    if _key_cache is not None:
        return _key_cache
    with _key_lock:
        if _key_cache is not None:
            return _key_cache
        pem = os.getenv("OIDC_SIGNING_KEY_PEM") or ""
        if "\\n" in pem and "\n" not in pem:
            # Some env UIs store multiline secrets with literal backslash-n.
            pem = pem.replace("\\n", "\n")
        if not pem.strip():
            return None

        from cryptography.hazmat.primitives import serialization

        private_key = serialization.load_pem_private_key(
            pem.encode("utf-8"), password=None
        )
        public = private_key.public_key().public_numbers()
        n = _b64url_uint(public.n)
        e = _b64url_uint(public.e)
        # RFC 7638 JWK thumbprint (SHA-256 over the canonical public members),
        # truncated to a short stable kid. Same key → same kid across boots.
        thumbprint = hashlib.sha256(
            json.dumps(
                {"e": e, "kty": "RSA", "n": n}, separators=(",", ":"), sort_keys=True
            ).encode("ascii")
        ).digest()
        kid = _b64url(thumbprint)[:16]
        _key_cache = {
            "key": private_key,
            "kid": kid,
            "jwk": {"kty": "RSA", "use": "sig", "alg": "RS256", "kid": kid, "n": n, "e": e},
        }
        return _key_cache


def _key_missing_response() -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "error": "oidc_key_not_configured",
            "message": "OIDC_SIGNING_KEY_PEM is not set on this deployment.",
        },
    )


def mint_identity_token(user: Dict[str, Any], now: Optional[int] = None) -> str:
    """Mint the 30-day RS256 id token for a kitchen user dict.

    Claims: iss/sub/aud/iat/exp always; email/name/picture only when present
    (omitted rather than null, per OIDC convention). Raises RuntimeError when
    the signing key is not configured — route handlers check first.
    """
    key = load_signing_key()
    if key is None:
        raise RuntimeError("OIDC_SIGNING_KEY_PEM is not configured")
    iat = int(time.time()) if now is None else int(now)
    claims: Dict[str, Any] = {
        "iss": ISSUER,
        "sub": str(user["id"]),
        "aud": AUDIENCE,
        "iat": iat,
        "exp": iat + TOKEN_TTL_SECONDS,
    }
    for claim, field in (("email", "email"), ("name", "name"), ("picture", "image")):
        value = user.get(field)
        if isinstance(value, str) and value:
            claims[claim] = value
    return jwt.encode(
        claims, key["key"], algorithm="RS256", headers={"kid": key["kid"]}
    )


# ---------------------------------------------------------------------------
# Kitchen session check (raw Cookie forwarding, à la WTEN agentsBridge.ts)
# ---------------------------------------------------------------------------


class KitchenUnreachable(Exception):
    """The kitchen session endpoint timed out, errored, or answered non-200."""


async def fetch_kitchen_user(cookie_header: Optional[str]) -> Optional[Dict[str, Any]]:
    """Resolve the kitchen user for a raw Cookie header.

    Returns the user dict (must carry an `id`) or None for a definitive
    "not signed in" (200 `null` / no user). Raises KitchenUnreachable for
    anything that is NOT a definitive answer (timeout, transport error,
    non-200, non-JSON) so callers can 503 instead of lying with a 401.
    """
    headers = {"accept": "application/json"}
    if cookie_header:
        headers["cookie"] = cookie_header
    try:
        async with httpx.AsyncClient(
            timeout=KITCHEN_TIMEOUT_S, follow_redirects=False
        ) as client:
            resp = await client.get(KITCHEN_SESSION_URL, headers=headers)
    except httpx.HTTPError as exc:
        raise KitchenUnreachable(f"transport error: {exc}") from exc
    if resp.status_code != 200:
        raise KitchenUnreachable(f"unexpected status {resp.status_code}")
    try:
        data = resp.json()
    except ValueError as exc:
        raise KitchenUnreachable("non-JSON session response") from exc
    if not isinstance(data, dict):
        return None  # Auth.js answers a bare `null` when anonymous
    user = data.get("user")
    if not isinstance(user, dict) or not user.get("id"):
        return None
    return user


def _public_user(user: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": user.get("id"),
        "email": user.get("email"),
        "name": user.get("name"),
        "image": user.get("image"),
    }


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/.well-known/openid-configuration")
async def openid_configuration() -> Dict[str, Any]:
    """OIDC discovery document (static — no key material needed)."""
    return {
        "issuer": ISSUER,
        "jwks_uri": f"{ISSUER}{JWKS_PATH}",
        "response_types_supported": ["id_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
    }


@router.get(JWKS_PATH)
async def jwks():
    """Public key set derived from OIDC_SIGNING_KEY_PEM."""
    key = load_signing_key()
    if key is None:
        return _key_missing_response()
    return {"keys": [key["jwk"]]}


@router.post("/oidc/token")
async def oidc_token(request: Request):
    """Exchange a live kitchen session cookie for a Pentacles id token."""
    if load_signing_key() is None:
        return _key_missing_response()
    try:
        user = await fetch_kitchen_user(request.headers.get("cookie"))
    except KitchenUnreachable as exc:
        print(f"[oidc] kitchen session check failed: {exc}", flush=True)
        return JSONResponse(status_code=503, content={"error": "kitchen_unreachable"})
    if user is None:
        return JSONResponse(status_code=401, content={"error": "not_signed_in"})
    token = mint_identity_token(user)
    return {
        "token": token,
        "claims": {"iss": ISSUER, "sub": str(user["id"])},
        "user": _public_user(user),
    }


@router.get("/oidc/session")
async def oidc_session(request: Request):
    """Cookie-forwarded session peek for UI state — never mints a token."""
    try:
        user = await fetch_kitchen_user(request.headers.get("cookie"))
    except KitchenUnreachable as exc:
        print(f"[oidc] kitchen session check failed: {exc}", flush=True)
        return JSONResponse(status_code=503, content={"error": "kitchen_unreachable"})
    return {"user": _public_user(user) if user else None}
