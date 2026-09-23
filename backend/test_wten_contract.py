"""ASOL's side of the WTEN contract, Python half.

- secret checks are constant-time and fail closed (secure_compare);
- /api/generate-recipe step 1: service bearer recognised, anonymous calls still
  served but logged with a hashed IP and rate-limited; RECIPE_AUTH_ENFORCE=true
  (step 2) rejects them before any model runs;
- feed posts carry a stable Idempotency-Key.
"""

import json
import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import feed_emitter  # noqa: E402
import main  # noqa: E402
import providers  # noqa: E402
import recipe_generation  # noqa: E402
from secure_compare import bearer_token, secret_matches, secret_matches_any  # noqa: E402
from test_main import _sample_cosmic_recipe  # noqa: E402

client = TestClient(main.app)


# ---- secure_compare --------------------------------------------------------


def test_secret_matches_only_the_exact_secret():
    assert secret_matches("s3cret-value", "s3cret-value")
    assert not secret_matches("s3cret-valuf", "s3cret-value")
    assert not secret_matches("s3cret", "s3cret-value")
    assert not secret_matches("s3cret-value-and-more", "s3cret-value")


def test_secret_matches_fails_closed():
    assert not secret_matches("", "")
    assert not secret_matches("anything", None)
    assert not secret_matches(None, "s3cret")
    assert not secret_matches("", "s3cret")
    assert secret_matches_any("b", [None, "a", "b"])
    assert not secret_matches_any("", [None, ""])


def test_bearer_token_requires_the_scheme():
    assert bearer_token("Bearer abc") == "abc"
    assert bearer_token("bearer abc") == "abc"
    assert bearer_token("abc") is None
    assert bearer_token(None) is None


def test_agent_sync_rejects_a_near_miss_secret():
    # The accepting path is covered by test_main.py (X-Sync-Secret / X-Internal-Secret).
    wrong = client.post(
        "/api/internal/agent-sync",
        headers={"X-Sync-Secret": main.INTERNAL_API_SECRET + "x"},
        json={"agentId": "nobody", "displayName": "Nobody"},
    )
    assert wrong.status_code == 403


# ---- /api/generate-recipe caller auth ---------------------------------------


@pytest.fixture
def served_recipe(monkeypatch):
    """Stub the provider chain so a request that passes auth returns a recipe."""
    recipe_generation.clear_recipe_cache()
    main._recipe_anon_caller_limiters.clear()
    calls = []

    async def fake_run_chain(**kwargs):
        calls.append(kwargs)
        return providers.CallResult(text=json.dumps(_sample_cosmic_recipe()), provider="groq", model="fake")

    monkeypatch.setattr(providers, "run_chain", fake_run_chain)
    return calls


def _post(headers=None, prompt="weekday dinner"):
    return client.post(
        "/api/generate-recipe",
        headers={"X-Forwarded-For": "203.0.113.9", **(headers or {})},
        json={"prompt": prompt, "dominantElement": "Air"},
    )


def test_anonymous_call_is_served_but_logged_with_a_hashed_ip(served_recipe, monkeypatch, capsys):
    monkeypatch.delenv("RECIPE_AUTH_ENFORCE", raising=False)
    res = _post()
    out = capsys.readouterr().out
    assert res.status_code == 200
    assert "recipe_auth_unauthenticated path=/api/generate-recipe ip_hash=" in out
    assert "enforced=false" in out
    assert "203.0.113.9" not in out


def test_service_bearer_is_recognised(served_recipe, monkeypatch, capsys):
    monkeypatch.setenv("RECIPE_AUTH_ENFORCE", "true")
    res = _post({"Authorization": f"Bearer {main.INTERNAL_API_SECRET}"})
    assert res.status_code == 200
    assert "recipe_auth_unauthenticated" not in capsys.readouterr().out


def test_enforcement_rejects_anonymous_before_any_model_runs(served_recipe, monkeypatch):
    monkeypatch.setenv("RECIPE_AUTH_ENFORCE", "true")
    for headers in (None, {"Authorization": "Bearer wrong"}):
        assert _post(headers).status_code == 401
    assert served_recipe == []


def test_anonymous_callers_are_rate_limited_per_hashed_ip(served_recipe, monkeypatch):
    monkeypatch.delenv("RECIPE_AUTH_ENFORCE", raising=False)
    limit = main.RECIPE_ANON_PER_CALLER_PER_MIN
    for i in range(limit):
        assert _post(prompt=f"dinner {i}").status_code == 200
    limited = _post(prompt="one too many")
    assert limited.status_code == 429
    assert limited.headers.get("retry-after") == "60"
    assert _post({"X-Forwarded-For": "198.51.100.4"}, prompt="another caller").status_code == 200


# ---- feed Idempotency-Key ----------------------------------------------------


def test_feed_event_id_is_stable_and_key_order_independent():
    a = feed_emitter.feed_event_id("g@agentic.alchm.kitchen", "agent_chat", {"b": 1, "a": 2})
    b = feed_emitter.feed_event_id("g@agentic.alchm.kitchen", "agent_chat", {"a": 2, "b": 1})
    assert a == b
    assert a.startswith("feed:agent_chat:g@agentic.alchm.kitchen:")
    assert feed_emitter.feed_event_id("g@x", "agent_chat", {"idempotencyKey": "own-key"}) == "own-key"


@pytest.mark.asyncio
async def test_feed_post_sends_the_event_id(monkeypatch):
    captured = {}

    class FakeResponse:
        status_code = 200
        reason_phrase = "OK"
        text = "{}"

    class FakeClient:
        def __init__(self, *args, **kwargs):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *args):
            return False

        async def post(self, url, json=None, headers=None):
            captured.update(url=url, json=json, headers=headers)
            return FakeResponse()

    monkeypatch.setattr(feed_emitter, "INTERNAL_API_SECRET", "test-secret")
    monkeypatch.setattr(feed_emitter.httpx, "AsyncClient", FakeClient)
    metadata = {"message": "hello", "timestamp": "2026-09-22T00:00:00Z"}
    await feed_emitter._post_feed_event("galileo@agentic.alchm.kitchen", "agent_chat", metadata)

    expected = feed_emitter.feed_event_id("galileo@agentic.alchm.kitchen", "agent_chat", metadata)
    assert captured["headers"]["Idempotency-Key"] == expected
    assert captured["json"]["idempotencyKey"] == expected
