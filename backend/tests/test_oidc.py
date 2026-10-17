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

# The limiter's real defaults, read at import: the autouse fixture below opens them for every test.
DEFAULT_LIMITS = (oidc.RATE_PER_CALLER_PER_MIN, oidc.RATE_GLOBAL_PER_MIN)
ISSUER = "https://api.agents.alchm.kitchen"
SESSION_COOKIE = "__Secure-authjs.session-token=abc"  # what Auth.js v5 sets for the kitchen session
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


@pytest.fixture(autouse=True)
def _fresh_rate_state(monkeypatch):
    """The limiter is process-wide; every test starts with an empty one and generous limits."""
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 10_000)
    monkeypatch.setattr(oidc, "RATE_GLOBAL_PER_MIN", 10_000)
    monkeypatch.delenv("OIDC_ALLOWED_ORIGINS", raising=False)
    oidc._rate_callers.clear()
    oidc._rate_global.clear()
    yield
    oidc._rate_callers.clear()
    oidc._rate_global.clear()


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


@pytest.mark.parametrize("which", ["garbage", "ec", "public", "weak-rsa"])
def test_an_unusable_key_is_logged_once_and_answered_503_invalid_not_a_bare_500(
    oidc_client, monkeypatch, capsys, which
):
    from cryptography.hazmat.primitives.asymmetric import ec

    weak = rsa.generate_private_key(public_exponent=65537, key_size=1024)
    ec_key = ec.generate_private_key(ec.SECP256R1())
    private = lambda k: k.private_bytes(  # noqa: E731
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode("ascii")
    pem = {
        "garbage": "-----BEGIN PRIVATE KEY-----\nnope\n-----END PRIVATE KEY-----\n",
        "ec": private(ec_key),
        "public": ec_key.public_key().public_bytes(
            serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo
        ).decode("ascii"),
        "weak-rsa": private(weak),
    }[which]
    monkeypatch.setenv("OIDC_SIGNING_KEY_PEM", pem)
    monkeypatch.setattr(oidc, "_key_cache", None)
    monkeypatch.setattr(oidc, "_key_error", None)

    first = oidc_client.get("/.well-known/jwks.json")
    second = oidc_client.get("/.well-known/jwks.json")
    token = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert first.status_code == second.status_code == token.status_code == 503
    assert first.json()["error"] == "oidc_key_invalid"
    assert oidc.load_signing_key() is None
    out = capsys.readouterr().out
    assert out.count("OIDC_SIGNING_KEY_PEM is set but unusable") == 1  # once, not per request
    assert "BEGIN" not in out and "nope" not in out  # the PEM itself is never logged


def test_a_malformed_env_value_does_not_stop_the_module_importing(monkeypatch):
    monkeypatch.setenv("KITCHEN_SESSION_TIMEOUT_S", "4s")
    monkeypatch.setenv("OIDC_RATE_PER_CALLER_PER_MIN", "lots")

    assert oidc._env_float("KITCHEN_SESSION_TIMEOUT_S", 4.0) == 4.0
    assert oidc._env_float("OIDC_RATE_PER_CALLER_PER_MIN", 60) == 60
    assert oidc._env_float("OIDC_UNSET_ANYWHERE", 1.5) == 1.5
    monkeypatch.setenv("KITCHEN_SESSION_TIMEOUT_S", "-3")
    assert oidc._env_float("KITCHEN_SESSION_TIMEOUT_S", 4.0) == 4.0


# ---------------------------------------------------------------------------
# POST /oidc/token
# ---------------------------------------------------------------------------


def test_token_endpoint_issues_an_rs256_jwt_for_audience_pentacles(
    oidc_client, signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER, "expires": "2099-01-01"})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

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
    token = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE}).json()["token"]
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

    token = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE}).json()["token"]

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
def test_token_endpoint_answers_401_when_the_kitchen_says_the_session_is_anonymous(
    oidc_client, signing_key, monkeypatch, anonymous
):
    _kitchen_returns(monkeypatch, anonymous)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 401
    assert resp.json() == {"error": "not_signed_in"}


@pytest.mark.parametrize(
    "cookie",
    [None, "", "theme=dark; locale=en", "csrf=1; __Host-authjs.csrf-token=abc", "a=b;c", "x" * 20_000],
    ids=["none", "empty", "unrelated", "csrf-only", "malformed", "oversized"],
)
def test_a_request_without_a_session_cookie_is_401_locally_and_never_reaches_the_kitchen(
    oidc_client, signing_key, monkeypatch, cookie
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    headers = {} if cookie is None else {"Cookie": cookie}

    token = oidc_client.post("/oidc/token", headers=headers)
    session = oidc_client.get("/oidc/session", headers=headers)

    assert token.status_code == 401 and token.json() == {"error": "not_signed_in"}
    assert session.status_code == 200 and session.json() == {"user": None}
    assert seen == []  # the issuer is not an anonymous amplifier for alchm.kitchen


@pytest.mark.parametrize(
    "name",
    ["__Secure-authjs.session-token", "authjs.session-token", "__Secure-authjs.session-token.0", "next-auth.session-token"],
)
def test_every_auth_js_session_cookie_spelling_reaches_the_kitchen(oidc_client, signing_key, monkeypatch, name):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": f"theme=dark; {name}=abc"})

    assert resp.status_code == 200 and len(seen) == 1
    assert seen[0].headers["cookie"] == f"theme=dark; {name}=abc"  # forwarded verbatim, as before


def test_kitchen_outage_is_503_never_401(oidc_client, signing_key, monkeypatch):
    """An upstream failure must not look like "logged out" — clients would sign players out."""

    def _boom(request: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("kitchen down", request=request)

    _stub_kitchen(monkeypatch, _boom)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 503
    assert resp.json() == {"error": "kitchen_unreachable"}


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(500, json={"error": "boom"}),
        httpx.Response(302, headers={"location": "https://evil.example/"}),
        httpx.Response(200, text="<html>not json</html>"),
    ],
    ids=["upstream-500", "bare-302", "non-json-200"],
)
def test_indefinite_kitchen_answers_are_503(oidc_client, signing_key, monkeypatch, response):
    _stub_kitchen(monkeypatch, lambda request: response)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 503
    assert resp.json() == {"error": "kitchen_unreachable"}


def test_token_endpoint_answers_503_without_a_key_and_skips_the_kitchen(
    oidc_client, no_signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 503
    assert resp.json()["error"] == "oidc_key_not_configured"
    assert seen == []


# ---------------------------------------------------------------------------
# Gates on the routes that act on a cookie
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "origin",
    [
        "https://pentacles.alchm.kitchen",
        "https://alchm.kitchen",
        "https://agents.alchm.kitchen",
        "https://a.b.alchm.kitchen",
        "https://PENTACLES.ALCHM.KITCHEN",
        "https://pentacles.alchm.kitchen:443",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://[::1]:3000",
    ],
)
def test_first_party_and_local_dev_origins_are_allowed(origin):
    assert oidc.origin_allowed(origin)


@pytest.mark.parametrize(
    "origin",
    [
        "https://evil.example",
        "https://alchm.kitchen.evil.example",
        "https://evilalchm.kitchen",
        "https://alchm-kitchen.example",
        "http://pentacles.alchm.kitchen",  # not https
        "https://pentacles.alchm.kitchen:8443",
        "https://localhost:3000",  # local dev is plain http
        "null",  # sandboxed iframes and file:// pages
        "",
        "ftp://alchm.kitchen",
        "https://alchm.kitchen@evil.example",
        "https://user:pw@alchm.kitchen",
        "https://alchm.kitchen/path",
        "https://alchm.kitchen?x=1",
        "https://pentacles.vercel.app",  # cross-site: the cookie could never be sent from there
    ],
)
def test_any_other_origin_is_refused(origin):
    assert not oidc.origin_allowed(origin)


def test_extra_origins_come_from_the_environment_exactly(monkeypatch):
    monkeypatch.setenv("OIDC_ALLOWED_ORIGINS", "https://pentacles.example, https://staging.example/")

    assert oidc.origin_allowed("https://pentacles.example")
    assert oidc.origin_allowed("https://staging.example")
    assert not oidc.origin_allowed("https://pentacles.example.evil.test")
    assert not oidc.origin_allowed("https://other.example")


@pytest.mark.parametrize("method,path", [("post", "/oidc/token"), ("get", "/oidc/session")])
def test_a_disallowed_origin_is_403_before_the_kitchen_is_asked(oidc_client, signing_key, monkeypatch, method, path):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = getattr(oidc_client, method)(path, headers={"Origin": "https://evil.example", "Cookie": SESSION_COOKIE})

    assert resp.status_code == 403 and resp.json() == {"error": "origin_not_allowed"}
    assert seen == []


@pytest.mark.parametrize("method,path", [("post", "/oidc/token"), ("get", "/oidc/session")])
def test_requests_without_an_origin_header_are_not_browser_cross_origin_calls_and_pass(
    oidc_client, signing_key, monkeypatch, method, path
):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = getattr(oidc_client, method)(path, headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 200


def test_the_kitchen_calling_routes_are_rate_limited_per_caller_and_globally(oidc_client, signing_key, monkeypatch):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 2)
    post = lambda ip: oidc_client.post(  # noqa: E731
        "/oidc/token", headers={"Cookie": SESSION_COOKIE, "X-Forwarded-For": ip}
    )

    assert [post("203.0.113.1").status_code for _ in range(3)] == [200, 200, 429]
    limited = post("203.0.113.1")
    assert limited.headers["retry-after"] == "60" and limited.json() == {"error": "rate_limited"}
    assert post("203.0.113.2").status_code == 200  # another caller has its own window
    assert len(seen) == 3  # the refused calls never reached the kitchen

    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 10_000)
    monkeypatch.setattr(oidc, "RATE_GLOBAL_PER_MIN", 4)  # 3 already used above
    assert [post(f"198.51.100.{i}").status_code for i in range(3)] == [200, 429, 429]


def test_cookie_less_requests_do_not_spend_the_rate_budget(oidc_client, signing_key, monkeypatch):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 1)

    for _ in range(5):  # every anonymous page load asks once
        assert oidc_client.post("/oidc/token").status_code == 401

    assert oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE}).status_code == 200
    assert len(seen) == 1


@pytest.mark.parametrize("status,kitchen", [(200, {"user": KITCHEN_USER}), (401, None), (503, "down")])
def test_token_and_session_responses_are_never_cacheable(oidc_client, signing_key, monkeypatch, status, kitchen):
    if kitchen == "down":
        _stub_kitchen(monkeypatch, lambda request: httpx.Response(500))
    else:
        _kitchen_returns(monkeypatch, kitchen)
    headers = {"Cookie": SESSION_COOKIE}

    token = oidc_client.post("/oidc/token", headers=headers)
    session = oidc_client.get("/oidc/session", headers=headers)

    assert token.status_code == status
    for resp in (token, session, oidc_client.post("/oidc/token"), oidc_client.get("/oidc/session")):
        assert resp.headers["cache-control"] == "no-store" and resp.headers["pragma"] == "no-cache"


# ---------------------------------------------------------------------------
# GET /oidc/session
# ---------------------------------------------------------------------------


def test_session_peek_returns_the_public_user_and_never_a_token(
    oidc_client, no_signing_key, monkeypatch
):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = oidc_client.get("/oidc/session", headers={"Cookie": SESSION_COOKIE})

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
    assert oidc_client.get("/oidc/session", headers={"Cookie": SESSION_COOKIE}).json() == {"user": None}

    _stub_kitchen(monkeypatch, lambda request: httpx.Response(502))
    resp = oidc_client.get("/oidc/session", headers={"Cookie": SESSION_COOKIE})
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
    resp = app_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})
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
        headers={"Origin": origin, "Cookie": SESSION_COOKIE, "Accept": "application/json"},
    )

    assert resp.status_code == 200
    assert resp.headers["access-control-allow-origin"] == origin
    assert resp.headers["access-control-allow-credentials"] == "true"
    assert resp.json()["token"]


def test_main_app_refuses_a_foreign_origin_even_though_cors_would_reflect_it(app_client, signing_key, monkeypatch):
    """allow_origins=["*"] with credentials reflects any origin app-wide; /oidc/token must not serve it."""
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})

    resp = app_client.post("/oidc/token", headers={"Origin": "https://evil.example", "Cookie": SESSION_COOKIE})

    assert resp.status_code == 403
    assert "token" not in resp.text
    assert seen == []


# O11: the "oversized" parametrisation has no session-token in it, so it is 401 either way.
def test_oversized_cookie_header_that_does_contain_a_session_token_never_reaches_the_kitchen(
    oidc_client, signing_key, monkeypatch
):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    cookie = "__Secure-authjs.session-token=" + "x" * 20_000

    resp = oidc_client.post("/oidc/token", headers={"Cookie": cookie})

    assert resp.status_code == 401
    assert seen == []


# O29: a 302 must be answered 503 AND must not be followed anywhere (the old test's repeated 302
# ends in TooManyRedirects -> 503 whether or not redirects are followed).
def test_a_kitchen_redirect_is_not_followed_even_once(oidc_client, signing_key, monkeypatch):
    hits = []

    def handler(request: httpx.Request) -> httpx.Response:
        hits.append(str(request.url))
        if request.url.host == "evil.example":
            return httpx.Response(200, json={"user": KITCHEN_USER})
        return httpx.Response(302, headers={"location": "https://evil.example/session"})

    _stub_kitchen(monkeypatch, handler)

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 503
    assert hits == [oidc.KITCHEN_SESSION_URL]


# O30: the timeout is actually handed to the HTTP client.
def test_the_kitchen_call_is_bounded_by_KITCHEN_TIMEOUT_S(oidc_client, signing_key, monkeypatch):
    seen_kwargs = {}

    def _client(*args, **kwargs):
        seen_kwargs.update(kwargs)
        kwargs["transport"] = httpx.MockTransport(lambda r: httpx.Response(200, json={"user": KITCHEN_USER}))
        return _REAL_ASYNC_CLIENT(*args, **kwargs)

    monkeypatch.setattr(oidc.httpx, "AsyncClient", _client)
    monkeypatch.setattr(oidc, "KITCHEN_TIMEOUT_S", 1.25)

    assert oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE}).status_code == 200
    assert seen_kwargs["timeout"] == 1.25


# O31: a read/connect TIMEOUT is an outage (503), not an unhandled exception (500).
@pytest.mark.parametrize("exc", [httpx.ReadTimeout, httpx.ConnectTimeout, httpx.ReadError, httpx.RemoteProtocolError])
def test_kitchen_timeouts_and_protocol_errors_are_503(oidc_client, signing_key, monkeypatch, exc):
    def _boom(request: httpx.Request) -> httpx.Response:
        raise exc("kitchen slow", request=request)

    _stub_kitchen(monkeypatch, _boom)

    for resp in (
        oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE}),
        oidc_client.get("/oidc/session", headers={"Cookie": SESSION_COOKIE}),
    ):
        assert resp.status_code == 503 and resp.json() == {"error": "kitchen_unreachable"}


# O32: a 4xx from the kitchen (WAF block, rate limit) is an outage, never "not signed in".
@pytest.mark.parametrize("status", [400, 401, 403, 404, 429])
def test_kitchen_4xx_is_503_not_a_logout(oidc_client, signing_key, monkeypatch, status):
    _stub_kitchen(monkeypatch, lambda request: httpx.Response(status, json={"error": "blocked"}))

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 503


# O39/O40: the sliding window actually slides.
def test_rate_limit_window_expires_after_a_minute(oidc_client, signing_key, monkeypatch):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 1)
    clock = [1000.0]
    monkeypatch.setattr(oidc, "_now", lambda: clock[0])
    post = lambda: oidc_client.post(  # noqa: E731
        "/oidc/token", headers={"Cookie": SESSION_COOKIE, "X-Forwarded-For": "203.0.113.9"}
    ).status_code

    assert post() == 200
    assert post() == 429
    clock[0] += 59.0
    assert post() == 429
    clock[0] += 2.0  # 61 s after the first call
    assert post() == 200


# O41: the caller table is bounded.
def test_rate_limiter_caller_table_is_bounded(oidc_client, signing_key, monkeypatch):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "_MAX_RATE_CALLERS", 5)

    for i in range(20):
        oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE, "X-Forwarded-For": f"198.51.100.{i}"})

    assert len(oidc._rate_callers) <= 5


# O42: /oidc/session is a kitchen-calling route too.
def test_session_peek_is_rate_limited_per_caller(oidc_client, no_signing_key, monkeypatch):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 2)
    get = lambda: oidc_client.get(  # noqa: E731
        "/oidc/session", headers={"Cookie": SESSION_COOKIE, "X-Forwarded-For": "203.0.113.5"}
    ).status_code

    assert [get(), get(), get()] == [200, 200, 429]
    assert len(seen) == 2


# O37: the rate-limit identity is X-Real-IP, else the first X-Forwarded-For hop (shared with the brain gates).
def test_rate_limit_identity_prefers_x_real_ip_then_the_first_forwarded_hop(oidc_client, signing_key, monkeypatch):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 1)
    post = lambda **extra: oidc_client.post(  # noqa: E731
        "/oidc/token", headers={"Cookie": SESSION_COOKIE, **extra}
    ).status_code

    assert post(**{"X-Forwarded-For": "203.0.113.1, 10.0.0.1"}) == 200
    assert post(**{"X-Forwarded-For": "203.0.113.1, 10.0.0.2"}) == 429  # same client behind a different proxy hop
    assert post(**{"X-Real-IP": "192.0.2.7", "X-Forwarded-For": "198.51.100.1"}) == 200
    assert post(**{"X-Real-IP": "192.0.2.7", "X-Forwarded-For": "198.51.100.2"}) == 429  # a forged XFF does not help


# O44/O45/O46: every response these routes can emit is uncacheable, not only 200/401/503-kitchen.
def test_403_429_and_503_key_responses_are_also_no_store(oidc_client, signing_key, monkeypatch):
    _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    denied = oidc_client.post("/oidc/token", headers={"Origin": "https://evil.example", "Cookie": SESSION_COOKIE})
    monkeypatch.setattr(oidc, "RATE_PER_CALLER_PER_MIN", 0)
    limited = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})
    monkeypatch.delenv("OIDC_SIGNING_KEY_PEM", raising=False)
    monkeypatch.setattr(oidc, "_key_cache", None)
    keyless = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert (denied.status_code, limited.status_code, keyless.status_code) == (403, 429, 503)
    for resp in (denied, limited, keyless):
        assert resp.headers["cache-control"] == "no-store", resp.status_code


# O26: a non-RSA key that is >= 2048 bits and has no .key_size-based rejection (DSA).
def test_a_large_dsa_key_is_rejected_as_not_rsa_not_a_500(oidc_client, monkeypatch):
    from cryptography.hazmat.primitives import serialization
    from cryptography.hazmat.primitives.asymmetric import dsa

    key = dsa.generate_private_key(key_size=2048)
    pem = key.private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()
    ).decode("ascii")
    monkeypatch.setenv("OIDC_SIGNING_KEY_PEM", pem)
    monkeypatch.setattr(oidc, "_key_cache", None)
    monkeypatch.setattr(oidc, "_key_error", None)

    resp = oidc_client.get("/.well-known/jwks.json")

    assert resp.status_code == 503 and resp.json()["error"] == "oidc_key_invalid"


# ---------------------------------------------------------------------------
# Review round: cookies, subjects and the global budget
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("cookie", ["__Secure-authjs.session-token=caf\u00e9", "\u00fc=1; authjs.session-token=x", "authjs.session-token=\U0001f36a"])
def test_a_non_ascii_cookie_header_is_401_not_a_500_and_never_reaches_the_kitchen(oidc_client, signing_key, monkeypatch, cookie):
    seen = _kitchen_returns(monkeypatch, {"user": KITCHEN_USER})
    raw = cookie.encode("utf-8")  # what a client sending UTF-8 cookie bytes puts on the wire

    token = oidc_client.post("/oidc/token", headers=[(b"cookie", raw)])
    session = oidc_client.get("/oidc/session", headers=[(b"cookie", raw)])

    assert token.status_code == 401 and session.status_code == 200 and session.json() == {"user": None}
    assert seen == []


@pytest.mark.parametrize(
    "subject,expected",
    [
        ("7b1f0c6e-3a52-4c1d-9a7e-5f0d2b8c9e41", "7b1f0c6e-3a52-4c1d-9a7e-5f0d2b8c9e41"),
        (42, "42"),  # a numeric id is stringified, as before
        ("x" * 128, "x" * 128),
    ],
)
def test_a_well_formed_kitchen_subject_becomes_the_token_subject(oidc_client, signing_key, monkeypatch, subject, expected):
    _kitchen_returns(monkeypatch, {"user": {**KITCHEN_USER, "id": subject}})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 200
    assert resp.json()["claims"]["sub"] == expected
    assert jwt.decode(resp.json()["token"], options={"verify_signature": False})["sub"] == expected


@pytest.mark.parametrize(
    "subject",
    ["x" * 129, "bad\nid", "tab\tid", "\x00", "", "   ", True, False, ["a"], {"a": 1}, 3.5, None],
    ids=lambda s: repr(s)[:24],
)
def test_a_malformed_kitchen_subject_never_mints_a_token(oidc_client, signing_key, monkeypatch, subject):
    """The subject is the player's permanent identity; SpacetimeDB rejects one over 128 bytes."""
    _kitchen_returns(monkeypatch, {"user": {**KITCHEN_USER, "id": subject}})

    resp = oidc_client.post("/oidc/token", headers={"Cookie": SESSION_COOKIE})

    assert resp.status_code == 401 and resp.json() == {"error": "not_signed_in"}
    assert "token" not in resp.text


def test_default_limits_make_the_global_window_a_backstop_not_a_tight_ceiling():
    """Junk cookies with a plausible name reach the kitchen (only it can tell they are junk) and spend the global
    window, so a low ceiling would let a flood lock real sign-ins out. 60/min per caller, 6000/min overall."""
    assert DEFAULT_LIMITS == (60, 6000)
    assert DEFAULT_LIMITS[1] >= 100 * DEFAULT_LIMITS[0]
