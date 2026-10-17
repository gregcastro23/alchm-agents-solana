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

Hardening added after the restore (the original had none of it; see
docs/integrations/PENTACLES_BRAIN.md):
  - a browser `Origin`, when present, must be alchm.kitchen, a subdomain of it, a
    localhost dev origin, or listed in OIDC_ALLOWED_ORIGINS (403 otherwise). The app-wide
    CORS policy reflects any origin with credentials; this is the gate for the two
    routes that act on a cookie.
  - a request carrying no session cookie is answered 401 locally and never reaches the
    kitchen, so the issuer cannot be used to hammer alchm.kitchen anonymously.
  - the two kitchen-calling routes are rate limited per caller and globally.
  - token and session responses are Cache-Control: no-store.
  - an unusable OIDC_SIGNING_KEY_PEM (not RSA, under 2048 bits, malformed) is logged once
    and answered 503 oidc_key_invalid instead of a bare 500 with no CORS headers.

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
from collections import deque
from typing import Any, Deque, Dict, Optional
from urllib.parse import urlsplit

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


def _env_float(name: str, default: float) -> float:
    """A malformed value must not stop the whole API from importing."""
    try:
        value = float(os.getenv(name, ""))
        return value if value > 0 else default
    except (TypeError, ValueError):
        return default


KITCHEN_TIMEOUT_S = _env_float("KITCHEN_SESSION_TIMEOUT_S", 4.0)
# One sign-in is one /oidc/token call; these bound the calls that reach the kitchen.
RATE_PER_CALLER_PER_MIN = int(_env_float("OIDC_RATE_PER_CALLER_PER_MIN", 60))
RATE_GLOBAL_PER_MIN = int(_env_float("OIDC_RATE_GLOBAL_PER_MIN", 1200))
MAX_COOKIE_HEADER_BYTES = 16 * 1024
NO_STORE = {"Cache-Control": "no-store", "Pragma": "no-cache"}


# ---------------------------------------------------------------------------
# Signing key (lazy singleton — import must never crash on a keyless boot)
# ---------------------------------------------------------------------------

_key_lock = threading.Lock()
_key_cache: Optional[Dict[str, Any]] = None
# Set when OIDC_SIGNING_KEY_PEM is present but unusable, so it is logged once, not per request.
_key_error: Optional[str] = None


def _b64url(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_uint(value: int) -> str:
    return _b64url(value.to_bytes(max(1, (value.bit_length() + 7) // 8), "big"))


def load_signing_key() -> Optional[Dict[str, Any]]:
    """Parse OIDC_SIGNING_KEY_PEM once and cache {key, kid, jwk}.

    Returns None when the env var is unset/empty (routes answer 503
    oidc_key_not_configured) or present but unusable - not an RSA private key, under
    2048 bits, malformed (routes answer 503 oidc_key_invalid; logged once, without the
    PEM). It never raises, so the rest of the app keeps serving.
    """
    global _key_cache, _key_error
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
            _key_error = None
            return None

        from cryptography.hazmat.primitives import serialization
        from cryptography.hazmat.primitives.asymmetric import rsa

        reason: Optional[str] = None
        try:
            private_key = serialization.load_pem_private_key(pem.encode("utf-8"), password=None)
        except Exception as exc:
            # The library's message can echo PEM header text; log the type only.
            private_key = None
            reason = f"not an unencrypted PEM private key ({type(exc).__name__})"
        else:
            if not isinstance(private_key, rsa.RSAPrivateKey):
                reason = f"expected an RSA private key, got {type(private_key).__name__}"
            elif private_key.key_size < 2048:
                reason = f"RSA key is {private_key.key_size} bits; at least 2048 required"
        if reason is not None:
            if _key_error is None:
                print(f"[oidc] OIDC_SIGNING_KEY_PEM is set but unusable: {reason}", flush=True)
            _key_error = "oidc_key_invalid"
            return None
        _key_error = None
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
    if _key_error:
        return JSONResponse(
            status_code=503,
            content={"error": _key_error, "message": "The OIDC signing key is unusable on this deployment."},
            headers=NO_STORE,
        )
    return JSONResponse(
        status_code=503,
        content={
            "error": "oidc_key_not_configured",
            "message": "The OIDC signing key is not configured on this deployment.",
        },
        headers=NO_STORE,
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
    headers = {"accept": "application/json", "user-agent": "planetary-agents-oidc/1"}
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


# ---------------------------------------------------------------------------
# Gates for the two routes that act on a cookie (token, session)
# ---------------------------------------------------------------------------

_LOCAL_DEV_HOSTS = frozenset({"localhost", "127.0.0.1", "::1"})
_MAX_RATE_CALLERS = 10_000
_rate_lock = threading.Lock()
_rate_callers: Dict[str, Deque[float]] = {}
_rate_global: Deque[float] = deque()


def origin_allowed(origin: str) -> bool:
    """alchm.kitchen and its subdomains (https), localhost for development, or an exact
    entry of OIDC_ALLOWED_ORIGINS. The kitchen session cookie is Domain=.alchm.kitchen and
    SameSite=Lax, so no other site can send it anyway; this is the second lock."""
    origin = origin.strip()
    extra = {o.strip().rstrip("/") for o in os.getenv("OIDC_ALLOWED_ORIGINS", "").split(",") if o.strip()}
    if origin.rstrip("/") in extra:
        return True
    try:
        parts = urlsplit(origin)
        port = parts.port
    except ValueError:
        return False
    if parts.username or parts.password or parts.path not in ("", "/") or parts.query or parts.fragment:
        return False  # a real Origin is scheme://host[:port], nothing else
    host = (parts.hostname or "").lower()
    if parts.scheme == "https" and port in (None, 443):
        return host == "alchm.kitchen" or host.endswith(".alchm.kitchen")
    return parts.scheme == "http" and host in _LOCAL_DEV_HOSTS


def _origin_denied(request: Request) -> Optional[JSONResponse]:
    origin = request.headers.get("origin")
    if origin is not None and not origin_allowed(origin):
        return JSONResponse(status_code=403, content={"error": "origin_not_allowed"}, headers=NO_STORE)
    return None  # no Origin header: not a browser cross-origin call


def has_session_cookie(cookie_header: Optional[str]) -> bool:
    """True when the Cookie header carries something that can be an Auth.js session token
    (authjs.session-token, __Secure-authjs.session-token, chunked .0/.1 variants)."""
    if not cookie_header or len(cookie_header.encode("utf-8")) > MAX_COOKIE_HEADER_BYTES:
        return False
    return any("session-token" in pair.split("=", 1)[0].strip().lower() for pair in cookie_header.split(";"))


def _within(window: Deque[float], limit: int, now: float) -> bool:
    while window and window[0] <= now - 60.0:
        window.popleft()
    if len(window) >= limit:
        return False
    window.append(now)
    return True


def _rate_limited(request: Request) -> bool:
    forwarded = request.headers.get("x-forwarded-for", "")
    caller = forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
    now = time.monotonic()
    with _rate_lock:
        window = _rate_callers.get(caller)
        if window is None:
            if len(_rate_callers) >= _MAX_RATE_CALLERS:
                _rate_callers.clear()
            window = _rate_callers[caller] = deque()
        return not (_within(window, RATE_PER_CALLER_PER_MIN, now) and _within(_rate_global, RATE_GLOBAL_PER_MIN, now))


def _rate_limited_response() -> JSONResponse:
    return JSONResponse(status_code=429, content={"error": "rate_limited"}, headers={**NO_STORE, "Retry-After": "60"})


@router.post("/oidc/token")
async def oidc_token(request: Request):
    """Exchange a live kitchen session cookie for a Pentacles id token."""
    denied = _origin_denied(request)
    if denied is not None:
        return denied
    if load_signing_key() is None:
        return _key_missing_response()
    cookie = request.headers.get("cookie")
    if not has_session_cookie(cookie):
        # Definitively anonymous, and nothing to ask the kitchen about.
        return JSONResponse(status_code=401, content={"error": "not_signed_in"}, headers=NO_STORE)
    if _rate_limited(request):
        return _rate_limited_response()
    try:
        user = await fetch_kitchen_user(cookie)
    except KitchenUnreachable as exc:
        print(f"[oidc] kitchen session check failed: {exc}", flush=True)
        return JSONResponse(status_code=503, content={"error": "kitchen_unreachable"}, headers=NO_STORE)
    if user is None:
        return JSONResponse(status_code=401, content={"error": "not_signed_in"}, headers=NO_STORE)
    token = mint_identity_token(user)
    return JSONResponse(
        content={
            "token": token,
            "claims": {"iss": ISSUER, "sub": str(user["id"])},
            "user": _public_user(user),
        },
        headers=NO_STORE,
    )


@router.get("/oidc/session")
async def oidc_session(request: Request):
    """Cookie-forwarded session peek for UI state — never mints a token."""
    denied = _origin_denied(request)
    if denied is not None:
        return denied
    cookie = request.headers.get("cookie")
    if not has_session_cookie(cookie):
        return JSONResponse(content={"user": None}, headers=NO_STORE)
    if _rate_limited(request):
        return _rate_limited_response()
    try:
        user = await fetch_kitchen_user(cookie)
    except KitchenUnreachable as exc:
        print(f"[oidc] kitchen session check failed: {exc}", flush=True)
        return JSONResponse(status_code=503, content={"error": "kitchen_unreachable"}, headers=NO_STORE)
    return JSONResponse(content={"user": _public_user(user) if user else None}, headers=NO_STORE)
