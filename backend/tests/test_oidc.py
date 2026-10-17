"""Tests for the Pentacles OIDC issuer (backend/oidc.py).

SpacetimeDB validates Pentacles sign-in tokens by fetching
``{issuer}/.well-known/openid-configuration`` and following ``jwks_uri``, so the
issuer string, the published key and the token claims are a wire contract with
two other systems. These tests pin that contract with a throwaway RSA key — the
production ``OIDC_SIGNING_KEY_PEM`` is never read — and a stubbed kitchen
session endpoint, so no network is touched.

A final group goes through the real ``main.app``: the routes vanished from
production once (404 on /oidc/token, discovery and JWKS) when this module was
dropped from the codebase, and only a request against the assembled app proves
the router is actually mounted.
"""

import base64
import hashlib
import json
import os
import sys
from pathlib import Path

import httpx
import jwt
import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi import FastAPI
from fastapi.testclient import TestClient

_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import oidc  # noqa: E402

ISSUER = "https://api.agents.alchm.kitchen"
KITCHEN_USER = {
    "id": "7b1f0c6e-3a52-4c1d-9a7e-5f0d2b8c9e41",
    "email": "seeker@example.test",
    "name": "Test Seeker",
    "image": "https://example.test/avatar.png",
    # Present on the kitchen payload but never meant to reach Pentacles.
    "role": "admin",
    "stripeCustomerId": "cus_should_not_leak",
}


@pytest.fixture(scope="module")
def private_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


@pytest.fixture(scope="module")
def private_pem(private_key) -> str:
    return private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    ).decode("ascii")


@pytest.fixture
def signing_key(monkeypatch, private_pem):
    """Configure the throwaway key and reset the lazy singleton around the test."""
    monkeypatch.setenv("OIDC_SIGNING_KEY_PEM", private_pem)
    monkeypatch.setattr(oidc, "_key_cache", None)
    return private_pem


@pytest.fixture
def no_signing_key(monkeypatch):
    monkeypatch.delenv("OIDC_SIGNING_KEY_PEM", raising=False)
    monkeypatch.setattr(oidc, "_key_cache", None)


@pytest.fixture
def oidc_client() -> TestClient:
    """The OIDC router alone — fast, and independent of the rest of main.py."""
    app = FastAPI()
    app.include_router(oidc.router)
    return TestClient(app)


# Captured at import, before any test patches it: stubbing twice inside one test
# must wrap the real client, not the previous stub (which would win the transport).
_REAL_ASYNC_CLIENT = httpx.AsyncClient


def _stub_kitchen(monkeypatch, handler):
    """Route oidc's outbound kitchen call through an in-process transport."""

    def _client(*args, **kwargs):
        kwargs["transport"] = httpx.MockTransport(handler)
        return _REAL_ASYNC_CLIENT(*args, **kwargs)

    monkeypatch.setattr(oidc.httpx, "AsyncClient", _client)


def _kitchen_returns(monkeypatch, payload, status: int = 200):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        # Auth.js answers an anonymous caller with a bare JSON `null`; httpx's
        # json=None would send no body at all, which is a different answer.
        return httpx.Response(
            status,
            content=json.dumps(payload).encode("utf-8"),
            headers={"content-type": "application/json"},
        )

    _stub_kitchen(monkeypatch, handler)
    return seen


def _b64url_decode_int(value: str) -> int:
    padded = value + "=" * (-len(value) % 4)
    return int.from_bytes(base64.urlsafe_b64decode(padded), "big")


# ---------------------------------------------------------------------------
# Discovery document
# ---------------------------------------------------------------------------


def test_discovery_document_issuer_is_the_agents_origin(oidc_client, no_signing_key):
    """Needs no key material, so it must answer even on a keyless boot."""
    resp = oidc_client.get("/.well-known/openid-configuration")

    assert resp.status_code == 200
    doc = resp.json()
    assert doc["issuer"] == ISSUER
    assert doc["jwks_uri"] == f"{ISSUER}/.well-known/jwks.json"
    assert doc["id_token_signing_alg_values_supported"] == ["RS256"]
    assert doc["subject_types_supported"] == ["public"]
    assert doc["response_types_supported"] == ["id_token"]


# ---------------------------------------------------------------------------
# JWKS
# ---------------------------------------------------------------------------


def test_jwks_exposes_the_public_half_of_the_signing_key(
    oidc_client, signing_key, private_key
):
    resp = oidc_client.get("/.well-known/jwks.json")

    assert resp.status_code == 200
    keys = resp.json()["keys"]
    assert len(keys) == 1
    jwk = keys[0]
    public = private_key.public_key().public_numbers()
    assert jwk["kty"] == "RSA"
    assert jwk["alg"] == "RS256"
    assert jwk["use"] == "sig"
    assert _b64url_decode_int(jwk["n"]) == public.n
    assert _b64url_decode_int(jwk["e"]) == public.e
    # No private parameters may ever be published.
    assert not {"d", "p", "q", "dp", "dq", "qi"} & set(jwk)


def test_jwks_kid_is_the_rfc7638_thumbprint_prefix_and_stable(
    oidc_client, signing_key
):
    first = oidc_client.get("/.well-known/jwks.json").json()["keys"][0]
    expected = base64.urlsafe_b64encode(
        hashlib.sha256(
            json.dumps(
                {"e": first["e"], "kty": "RSA", "n": first["n"]},
                separators=(",", ":"),
                sort_keys=True,
            ).encode("ascii")
        ).digest()
    ).rstrip(b"=").decode("ascii")[:16]
    assert first["kid"] == expected

    # Same key => same kid after a process restart (cache cleared, env reloaded).
    oidc._key_cache = None
    second = oidc_client.get("/.well-known/jwks.json").json()["keys"][0]
    assert second["kid"] == first["kid"]


def test_jwks_answers_503_when_no_key_is_configured(oidc_client, no_signing_key):
    resp = oidc_client.get("/.well-known/jwks.json")

    assert resp.status_code == 503
    assert resp.json()["error"] == "oidc_key_not_configured"


def test_escaped_newline_pem_is_accepted(monkeypatch, private_pem):
    """Some env UIs store a multiline secret with literal backslash-n sequences."""
    monkeypatch.setenv("OIDC_SIGNING_KEY_PEM", private_pem.replace("\n", "\\n"))
    monkeypatch.setattr(oidc, "_key_cache", None)

    loaded = oidc.load_signing_key()

    assert loaded is not None
    assert loaded["jwk"]["alg"] == "RS256"


def test_malformed_pem_fails_loudly_instead_of_being_ignored(monkeypatch):
    monkeypatch.setenv("OIDC_SIGNING_KEY_PEM", "-----BEGIN PRIVATE KEY-----\nnope\n")
    monkeypatch.setattr(oidc, "_key_cache", None)

    with pytest.raises(ValueError):
        oidc.load_signing_key()


# ---------------------------------------------------------------------------
# POST /oidc/token
# ---------------------------------------------------------------------------


def test_token_endpoint_issues_an_rs256_jwt_for_audience_pentacles(
    oidc_client, signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER, "expires": "2099-01-01"})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": "session=abc"})

    assert resp.status_code == 200
    body = resp.json()
    token = body["token"]

    # The signature verifies against what /.well-known/jwks.json publishes —
    # exactly what SpacetimeDB does.
    jwk = oidc_client.get("/.well-known/jwks.json").json()["keys"][0]
    header = jwt.get_unverified_header(token)
    assert header["alg"] == "RS256"
    assert header["kid"] == jwk["kid"]
    claims = jwt.decode(
        token,
        key=jwt.PyJWK(jwk).key,
        algorithms=["RS256"],
        audience="pentacles",
        issuer=ISSUER,
    )
    assert claims["sub"] == KITCHEN_USER["id"]
    assert claims["aud"] == "pentacles"
    assert claims["iss"] == ISSUER
    assert claims["exp"] - claims["iat"] == 30 * 24 * 60 * 60
    assert claims["email"] == KITCHEN_USER["email"]
    assert claims["name"] == KITCHEN_USER["name"]
    assert claims["picture"] == KITCHEN_USER["image"]
    # Nothing but identity claims goes into a long-lived token.
    assert set(claims) == {"iss", "sub", "aud", "iat", "exp", "email", "name", "picture"}

    assert body["claims"] == {"iss": ISSUER, "sub": KITCHEN_USER["id"]}
    assert body["user"] == {
        "id": KITCHEN_USER["id"],
        "email": KITCHEN_USER["email"],
        "name": KITCHEN_USER["name"],
        "image": KITCHEN_USER["image"],
    }
    assert "stripeCustomerId" not in json.dumps(body)
    assert len(seen) == 1


def test_token_is_rejected_for_the_wrong_audience(oidc_client, signing_key, monkeypatch):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    token = oidc_client.post("/oidc/token", headers={"Cookie": "s=1"}).json()["token"]
    jwk = oidc_client.get("/.well-known/jwks.json").json()["keys"][0]

    with pytest.raises(jwt.InvalidAudienceError):
        jwt.decode(
            token,
            key=jwt.PyJWK(jwk).key,
            algorithms=["RS256"],
            audience="somebody-else",
            issuer=ISSUER,
        )


def test_optional_claims_are_omitted_rather_than_null(
    oidc_client, signing_key, monkeypatch
):
    _kitchen_returns(monkeypatch, {"user": {"id": "only-an-id", "email": None, "name": ""}})

    token = oidc_client.post("/oidc/token", headers={"Cookie": "s=1"}).json()["token"]

    claims = jwt.decode(token, options={"verify_signature": False})
    assert set(claims) == {"iss", "sub", "aud", "iat", "exp"}


def test_token_endpoint_forwards_the_cookie_to_the_kitchen_only(
    oidc_client, signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    oidc_client.post(
        "/oidc/token",
        headers={"Cookie": "__Secure-authjs.session-token=abc123; other=1"},
    )

    assert len(seen) == 1
    forwarded = seen[0]
    assert str(forwarded.url) == oidc.KITCHEN_SESSION_URL
    assert forwarded.method == "GET"
    assert forwarded.headers["cookie"] == "__Secure-authjs.session-token=abc123; other=1"
    assert forwarded.headers["accept"] == "application/json"


@pytest.mark.parametrize("anonymous", [None, {"user": None}, {"user": {}}, {"user": {"email": "x"}}])
def test_token_endpoint_answers_401_for_an_anonymous_session(
    oidc_client, signing_key, monkeypatch, anonymous
):
    _kitchen_returns(monkeypatch, anonymous)

    resp = oidc_client.post("/oidc/token")

    assert resp.status_code == 401
    assert resp.json() == {"error": "not_signed_in"}


def test_token_endpoint_sends_no_cookie_header_when_the_caller_has_none(
    oidc_client, signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, None)

    oidc_client.post("/oidc/token")

    assert "cookie" not in seen[0].headers


def test_kitchen_outage_is_503_never_401(oidc_client, signing_key, monkeypatch):
    """An upstream failure must not look like "logged out" — clients would sign players out."""

    def _boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("kitchen down", request=request)

    _stub_kitchen(monkeypatch, _boom)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": "s=1"})

    assert resp.status_code == 503
    assert resp.json() == {"error": "kitchen_unreachable"}


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, json={"error": "boom"}),
        httpx.Response(302, headers={"location": "https://evil.example/"}),
        httpx.Response(200, text="<html>not json</html>"),
    ],
    ids=["upstream-500", "redirect-not-followed", "non-json-200"],
)
def test_indefinite_kitchen_answers_are_503(oidc_client, signing_key, monkeypatch, response):
    _stub_kitchen(monkeypatch, lambda request: response)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": "s=1"})

    assert resp.status_code == 503
    assert resp.json() == {"error": "kitchen_unreachable"}


def test_token_endpoint_answers_503_without_a_key_and_skips_the_kitchen(
    oidc_client, no_signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": "s=1"})

    assert resp.status_code == 503
    assert resp.json()["error"] == "oidc_key_not_configured"
    assert seen == []


# ---------------------------------------------------------------------------
# GET /oidc/session
# ---------------------------------------------------------------------------


def test_session_peek_returns_the_public_user_and_never_a_token(
    oidc_client, no_signing_key, monkeypatch
):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = oidc_client.get("/oidc/session", headers={"Cookie": "s=1"})

    assert resp.status_code == 200
    assert resp.json() == {
        "user": {
            "id": KITCHEN_USER["id"],
            "email": KITCHEN_USER["email"],
            "name": KITCHEN_USER["name"],
            "image": KITCHEN_USER["image"],
        }
    }


def test_session_peek_is_null_for_anonymous_and_503_on_outage(
    oidc_client, no_signing_key, monkeypatch
):
    _kitchen_returns(monkeypatch, None)
    assert oidc_client.get("/oidc/session").json() == {"user": None}

    _stub_kitchen(monkeypatch, lambda request: httpx.Response(502))
    resp = oidc_client.get("/oidc/session")
    assert resp.status_code == 503
    assert resp.json() == {"error": "kitchen_unreachable"}


# ---------------------------------------------------------------------------
# Mounted on the real app (the production regression: these paths were 404)
# ---------------------------------------------------------------------------


@pytest.fixture(scope="module")
def app_client() -> TestClient:
    import main

    return TestClient(main.app)


def test_main_app_serves_the_oidc_discovery_document(app_client):
    resp = app_client.get("/.well-known/openid-configuration")

    assert resp.status_code == 200
    assert resp.json()["issuer"] == ISSUER


def test_main_app_serves_jwks_and_issues_tokens(app_client, signing_key, monkeypatch):
    jwks = app_client.get("/.well-known/jwks.json")
    assert jwks.status_code == 200
    assert jwks.json()["keys"][0]["alg"] == "RS256"

    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    resp = app_client.post("/oidc/token", headers={"Cookie": "s=1"})
    assert resp.status_code == 200
    assert jwt.decode(resp.json()["token"], options={"verify_signature": False})["aud"] == "pentacles"


def test_main_app_routes_are_not_404_or_405_without_a_key(app_client, no_signing_key):
    """Keyless boot: key-dependent routes say 503, they do not vanish."""
    assert app_client.get("/.well-known/jwks.json").status_code == 503
    assert app_client.post("/oidc/token").status_code == 503
    assert app_client.get("/oidc/session").status_code not in (404, 405)


def test_main_app_allows_credentialed_cors_from_a_browser_origin(app_client):
    """The Pentacles web client calls /oidc/token with the kitchen cookie attached."""
    origin = "https://pentacles.example"

    preflight = app_client.options(
        "/oidc/token",
        headers={
            "Origin": origin,
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type",
        },
    )

    assert preflight.status_code == 200
    assert preflight.headers["access-control-allow-origin"] == origin
    assert preflight.headers["access-control-allow-credentials"] == "true"


def test_main_app_answers_the_pentacles_clients_credentialed_fetch(app_client, signing_key, monkeypatch):
    """src/net/auth.js: fetch(`${ISSUER}/oidc/token`, {method: 'POST', credentials: 'include',
    headers: {accept: 'application/json'}}). Only safelisted headers => a simple request, no preflight,
    so the browser decides from the response alone. It rejects `Access-Control-Allow-Origin: *`
    on a credentialed request — the origin must be mirrored and credentials allowed."""
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    origin = "https://pentacles.alchm.kitchen"

    resp = app_client.post(
        "/oidc/token",
        headers={"Origin": origin, "Cookie": "__Secure-authjs.session-token=abc", "Accept": "application/json"},
    )

    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == origin
    assert resp.headers["access-control-allow-credentials"] == "true"
    assert resp.json()["token"]
