"""Tests for GET /api/admin/mcp-summary — the cross-server aggregator endpoint
WTEN's admin panel consumes via its admin-sync proxy.

The endpoint is gated by X-Internal-Secret, aggregates rows in mcp_invocations
within a configurable window, and folds the latest synthetic-probe verdict
into the overall health status.

These tests use an isolated in-memory SQLite engine so they don't depend on
(and don't pollute) whatever DATABASE_URL/DIRECT_URL the local environment has
pointed at PA's Postgres. The Postgres-side foreign key from
mcp_invocations.agent_id → historical_agents.agentId is enforced in prod but
absent here, which keeps fixtures small.
"""

import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Ensure backend/ is on sys.path so `import main` resolves whether pytest is
# launched from the repo root or from backend/.
_BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

os.environ.setdefault("ALCHM_MCP_ENABLED", "false")
os.environ["INTERNAL_API_SECRET"] = "test-secret-internal"
os.environ.pop("PA_INTERNAL_API_SECRET", None)

import database  # noqa: E402
import main  # noqa: E402
from models import Base, MCPInvocation  # noqa: E402

# main.py captures INTERNAL_API_SECRET into a module constant at import
# time. When another test module (e.g. backend/test_main.py) imports
# main *before* this file runs its os.environ setup above, that constant
# is frozen to main.py's default and _admin_mcp_secret() returns it —
# making our HEADERS_OK secret mismatch (401) under full-suite
# collection order. Pin the constant explicitly so these tests are
# import-order-independent regardless of which test module loads first.
main.INTERNAL_API_SECRET = "test-secret-internal"


# ---- Isolated test database ------------------------------------------------

_test_engine = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_test_engine)
Base.metadata.create_all(bind=_test_engine)


def _override_get_db():
    db = TestSessionLocal()
    try:
        yield db
    finally:
        db.close()


main.app.dependency_overrides[database.get_db] = _override_get_db

client = TestClient(main.app)
HEADERS_OK = {"X-Internal-Secret": "test-secret-internal"}


@pytest.fixture(autouse=True)
def _reset_state():
    """Wipe mcp_invocations and the in-process summary cache before each test."""
    main._summary_cache.clear()
    db = TestSessionLocal()
    try:
        db.query(MCPInvocation).delete()
        db.commit()
    finally:
        db.close()
    yield
    main._summary_cache.clear()


def _insert(
    n: int,
    *,
    success: bool = True,
    tool_name: str = "chat_with_planetary_agent",
    caller: str = "claude-desktop",
    agent_id: Optional[str] = "socrates",
    model_tier: str = "free",
    latency_ms: int = 100,
    called_at: Optional[datetime] = None,
    arguments: Optional[dict] = None,
):
    """Insert n MCPInvocation rows. Defaults are healthy chat calls.

    `model_tier` is the *resolved* tier; pass `arguments={"modelTier": ...}`
    to simulate the original requested tier so tierDowngrades can be
    exercised (a downgrade = requested rank > resolved rank).
    """
    db = TestSessionLocal()
    try:
        base = called_at or (datetime.utcnow() - timedelta(minutes=5))
        for i in range(n):
            db.add(
                MCPInvocation(
                    toolName=tool_name,
                    calledAt=base + timedelta(seconds=i),
                    completedAt=base + timedelta(seconds=i, milliseconds=latency_ms),
                    latencyMs=latency_ms,
                    success=success,
                    caller=caller,
                    agentId=agent_id,
                    modelTier=model_tier,
                    arguments=arguments if arguments is not None else {},
                    resultSummary={},
                    errorMessage=None if success else "boom",
                )
            )
        db.commit()
    finally:
        db.close()


# --------------------------------------------------------------------------
# Auth
# --------------------------------------------------------------------------


def test_missing_secret_returns_401():
    resp = client.get("/api/admin/mcp-summary")
    assert resp.status_code == 401


def test_wrong_secret_returns_401():
    resp = client.get(
        "/api/admin/mcp-summary",
        headers={"X-Internal-Secret": "wrong-secret"},
    )
    assert resp.status_code == 401


def test_pa_internal_api_secret_env_var_wins(monkeypatch):
    monkeypatch.setenv("PA_INTERNAL_API_SECRET", "pa-specific-secret")
    main._summary_cache.clear()

    resp = client.get(
        "/api/admin/mcp-summary",
        headers={"X-Internal-Secret": "pa-specific-secret"},
    )
    assert resp.status_code == 200

    resp_legacy = client.get(
        "/api/admin/mcp-summary",
        headers={"X-Internal-Secret": "test-secret-internal"},
    )
    assert resp_legacy.status_code == 401


# --------------------------------------------------------------------------
# Query params
# --------------------------------------------------------------------------


def test_window_minutes_below_min_rejected():
    resp = client.get("/api/admin/mcp-summary?windowMinutes=1", headers=HEADERS_OK)
    assert resp.status_code == 422


def test_window_minutes_above_max_rejected():
    resp = client.get("/api/admin/mcp-summary?windowMinutes=99999", headers=HEADERS_OK)
    assert resp.status_code == 422


def test_default_window_is_60_minutes():
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    assert resp.status_code == 200
    assert resp.json()["windowMinutes"] == 60


def test_window_minutes_caps_data_scope():
    # Row inside the 60-min window
    _insert(1, called_at=datetime.utcnow() - timedelta(minutes=10))
    # Row outside — should be excluded
    _insert(1, called_at=datetime.utcnow() - timedelta(minutes=120))

    resp = client.get("/api/admin/mcp-summary?windowMinutes=60", headers=HEADERS_OK)
    assert resp.json()["totals"]["calls"] == 1

    main._summary_cache.clear()
    resp_wide = client.get("/api/admin/mcp-summary?windowMinutes=240", headers=HEADERS_OK)
    assert resp_wide.json()["totals"]["calls"] == 2


# --------------------------------------------------------------------------
# Verdict — the heart of what WTEN renders
# --------------------------------------------------------------------------


def test_empty_db_verdict_unknown():
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert resp.status_code == 200
    assert body["verdict"] == "UNKNOWN"
    assert body["totals"]["calls"] == 0
    assert body["totals"]["errorRate"] == 0.0
    assert body["syntheticProbe"]["verdict"] == "UNKNOWN"
    # tierDowngrades present even on an empty DB (E4)
    assert body["tierDowngrades"]["total"] == 0
    assert body["tierDowngrades"]["byRequestedTier"] == {}


def test_tier_downgrades_counted_when_resolved_below_requested():
    """E4: a row whose resolved modelTier ranks below the requested
    tier (stored in arguments.modelTier) counts as a downgrade."""
    # 5 anonymous "reflective" asks knocked down to free.
    _insert(5, model_tier="free", arguments={"modelTier": "reflective"})
    # 3 standard "primary" asks knocked to cheap_fast.
    _insert(3, model_tier="cheap_fast", arguments={"modelTier": "primary"})
    # 7 honest free calls — no downgrade.
    _insert(7, model_tier="free", arguments={"modelTier": "free"})
    # 2 calls with no requested tier at all — defaults to free, no downgrade.
    _insert(2, model_tier="free", arguments={})

    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert resp.status_code == 200
    assert body["tierDowngrades"]["total"] == 8
    assert body["tierDowngrades"]["byRequestedTier"]["reflective"] == 5
    assert body["tierDowngrades"]["byRequestedTier"]["primary"] == 3
    # free→free and missing-tier rows must NOT appear
    assert "free" not in body["tierDowngrades"]["byRequestedTier"]


def test_100_success_verdict_ok():
    _insert(100, success=True)
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert body["totals"]["calls"] == 100
    assert body["totals"]["success"] == 100
    assert body["totals"]["failures"] == 0
    assert body["totals"]["errorRate"] == 0.0
    assert body["verdict"] == "OK"


def test_10_of_100_failures_verdict_incident():
    """10% error rate ≥ 5% threshold → INCIDENT."""
    _insert(90, success=True)
    _insert(10, success=False)
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert body["totals"]["calls"] == 100
    assert body["totals"]["failures"] == 10
    assert body["totals"]["errorRate"] == pytest.approx(0.10, abs=1e-6)
    assert body["verdict"] == "INCIDENT"


def test_2_of_100_failures_verdict_degraded():
    """2% error rate is in the [1%, 5%) band → DEGRADED."""
    _insert(98, success=True)
    _insert(2, success=False)
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert body["totals"]["errorRate"] == pytest.approx(0.02, abs=1e-6)
    assert body["verdict"] == "DEGRADED"


def test_high_p95_latency_degrades_verdict():
    """No failures but p95 > 2000ms → DEGRADED. With 10% of calls at 5000ms,
    linear-interpolation p95 lands clearly above the threshold."""
    _insert(90, success=True, latency_ms=100)
    _insert(10, success=True, latency_ms=5000)
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert body["totals"]["failures"] == 0
    assert body["totals"]["p95LatencyMs"] > 2000
    assert body["verdict"] == "DEGRADED"


def test_synthetic_incident_overrides_clean_traffic():
    """Even with clean traffic, two-of-four failed probes → INCIDENT."""
    _insert(50, success=True)
    _insert(
        2,
        success=False,
        caller="synthetic-probe",
        called_at=datetime.utcnow() - timedelta(minutes=2),
    )
    _insert(
        2,
        success=True,
        caller="synthetic-probe",
        called_at=datetime.utcnow() - timedelta(minutes=10),
    )
    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    body = resp.json()
    assert body["syntheticProbe"]["verdict"] == "INCIDENT"
    assert body["verdict"] == "INCIDENT"


# --------------------------------------------------------------------------
# Aggregation shape
# --------------------------------------------------------------------------


def test_by_tool_groups_correctly():
    _insert(10, tool_name="chat_with_planetary_agent")
    _insert(5, tool_name="get_agent_feed_discussion", success=False)
    _insert(1, tool_name="synthesize_culinary_debate", latency_ms=3000)

    resp = client.get("/api/admin/mcp-summary", headers=HEADERS_OK)
    by_tool = {b["tool"]: b for b in resp.json()["byTool"]}

    assert by_tool["chat_with_planetary_agent"]["calls"] == 10
    assert by_tool["chat_with_planetary_agent"]["failures"] == 0
    assert by_tool["get_agent_feed_discussion"]["calls"] == 5
    assert by_tool["get_agent_feed_discussion"]["failures"] == 5
    assert by_tool["synthesize_culinary_debate"]["p95LatencyMs"] == 3000


def test_by_agent_excludes_null_agent_id():
    _insert(5, agent_id="socrates")
    _insert(3, agent_id="thales")
    _insert(7, agent_id=None)  # NULL agent_id rows must NOT appear

    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    agent_ids = {b["agentId"] for b in body["byAgent"]}

    assert "socrates" in agent_ids
    assert "thales" in agent_ids
    assert None not in agent_ids
    assert all(b["agentId"] is not None for b in body["byAgent"])


def test_by_agent_caps_at_10_and_orders_by_calls():
    for i in range(15):
        _insert(15 - i, agent_id=f"agent-{i:02d}")

    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    assert len(body["byAgent"]) == 10
    calls = [b["calls"] for b in body["byAgent"]]
    assert calls == sorted(calls, reverse=True)


def test_by_agent_includes_model_tier_mix():
    _insert(3, agent_id="socrates", model_tier="free")
    _insert(2, agent_id="socrates", model_tier="primary")

    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    socrates = next(b for b in body["byAgent"] if b["agentId"] == "socrates")

    assert socrates["modelTierMix"] == {"free": 3, "primary": 2}


def test_by_caller_caps_at_10():
    for i in range(15):
        _insert(15 - i, caller=f"caller-{i:02d}")

    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    assert len(body["byCaller"]) == 10


# --------------------------------------------------------------------------
# Synthetic probe verdict — exercised independently
# --------------------------------------------------------------------------


def test_synthetic_probe_ok_when_recent_success():
    _insert(
        1,
        success=True,
        caller="synthetic-probe",
        called_at=datetime.utcnow() - timedelta(minutes=2),
    )
    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    assert body["syntheticProbe"]["verdict"] == "OK"
    assert body["syntheticProbe"]["lastSuccess"] is True
    assert body["syntheticProbe"]["consecutiveFailures"] == 0


def test_synthetic_probe_consecutive_failures_count():
    # Three failures then a success (older) — consecutive_failures counts back
    # from the most recent row until the first success.
    base = datetime.utcnow()
    _insert(1, success=False, caller="synthetic-probe", called_at=base - timedelta(minutes=1))
    _insert(1, success=False, caller="synthetic-probe", called_at=base - timedelta(minutes=2))
    _insert(1, success=True, caller="synthetic-probe", called_at=base - timedelta(minutes=3))

    body = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()
    assert body["syntheticProbe"]["consecutiveFailures"] == 2
    assert body["syntheticProbe"]["lastSuccess"] is False


# --------------------------------------------------------------------------
# Cache behavior
# --------------------------------------------------------------------------


def test_cache_serves_repeated_requests():
    _insert(5, success=True)
    first = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()

    # Insert more rows; without a cache the count would jump. The cache should
    # return the same payload for the same windowMinutes within the TTL.
    _insert(5, success=True)
    second = client.get("/api/admin/mcp-summary", headers=HEADERS_OK).json()

    assert first["totals"]["calls"] == 5
    assert second["totals"]["calls"] == 5
    assert first["generatedAt"] == second["generatedAt"]

    # Different window key bypasses the cache entry.
    third = client.get("/api/admin/mcp-summary?windowMinutes=120", headers=HEADERS_OK).json()
    assert third["totals"]["calls"] == 10
