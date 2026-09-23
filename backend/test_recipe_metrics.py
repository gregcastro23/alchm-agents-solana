"""A8: recipe-generation latency window and its admin endpoint."""

import json
import os

import pytest
from fastapi.testclient import TestClient

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")

import main  # noqa: E402
import providers  # noqa: E402
import recipe_generation  # noqa: E402
import recipe_metrics  # noqa: E402
from test_main import _sample_cosmic_recipe  # noqa: E402

client = TestClient(main.app)


@pytest.fixture(autouse=True)
def _fresh():
    recipe_metrics.reset_for_tests()
    recipe_generation.clear_recipe_cache()
    main._recipe_anon_caller_limiters.clear()
    yield
    recipe_metrics.reset_for_tests()


def test_summary_percentiles_error_rate_and_window():
    now = 1_000_000.0
    for ms in [12_000, 14_000, 20_000, 25_000, 34_000]:
        recipe_metrics._samples.append((now - 60, ms, "generated", "cheap_fast", "gemini"))
    recipe_metrics._samples.append((now - 60, 44_000, "error", "cheap_fast", None))
    recipe_metrics._samples.append((now - 60, 1.2, "cache", "cheap_fast", None))
    recipe_metrics._samples.append((now - 7200, 99_000, "generated", "cheap_fast", "groq"))  # outside 1h

    s = recipe_metrics.summary(3600, now=now)
    assert s["generated"] == 5
    assert s["errors"] == 1
    assert s["cacheHits"] == 1
    assert s["p50Ms"] == 20_000
    assert s["p95Ms"] == 34_000
    assert s["errorRate"] == pytest.approx(1 / 6)
    assert s["byProvider"] == {"gemini": {"count": 5, "p50Ms": 20_000, "p95Ms": 34_000}}


def test_empty_window_is_unknown_not_zero():
    s = recipe_metrics.summary(3600)
    assert s["generated"] == 0
    assert s["p50Ms"] is None and s["p95Ms"] is None and s["errorRate"] is None


def test_a_real_generation_is_recorded(monkeypatch):
    async def fake_run_chain(**kwargs):
        return providers.CallResult(text=json.dumps(_sample_cosmic_recipe()), provider="groq", model="fake")

    monkeypatch.setattr(providers, "run_chain", fake_run_chain)
    res = client.post("/api/generate-recipe", json={"prompt": "weekday dinner", "dominantElement": "Air"})
    assert res.status_code == 200
    s = recipe_metrics.summary(3600)
    assert s["generated"] == 1
    assert s["byProvider"]["groq"]["count"] == 1


def test_endpoint_requires_the_internal_secret():
    assert client.get("/api/admin/recipe-latency").status_code == 401
    assert client.get("/api/admin/recipe-latency", headers={"X-Internal-Secret": "nope"}).status_code == 401
    ok = client.get(
        "/api/admin/recipe-latency?windowMinutes=60",
        headers={"X-Internal-Secret": main._admin_mcp_secret()},
    )
    assert ok.status_code == 200
    assert ok.json()["windowSeconds"] == 3600
    assert client.get(
        "/api/admin/recipe-latency?windowMinutes=1",
        headers={"X-Internal-Secret": main._admin_mcp_secret()},
    ).status_code == 422
