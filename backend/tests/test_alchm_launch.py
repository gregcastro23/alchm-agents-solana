"""Tests for the Alchm MCP launch resolution, circuit breaker, and the
frozen-sidecar SQLite fallback.

These cover behavior that is now load-bearing for the bundled pa-mcp desktop
sidecar (which has no WTEN source tree and an excluded Postgres dialect):

  * _resolve_launch() picks explicit override → local source → published
    package, in that priority order.
  * The launch circuit breaker opens after a failure so a missing runtime or a
    broken published package can't add launch latency to every chat.
  * database._resolve_dsn() forces local SQLite when frozen, so the sidecar
    never crashes trying to load the excluded postgresql dialect.
"""

import pytest

import alchm_mcp
import database


# --------------------------------------------------------------------------
# _resolve_launch priority order
# --------------------------------------------------------------------------

def test_resolve_launch_explicit_override(monkeypatch):
    monkeypatch.setenv("ALCHM_MCP_ARGS", "run /custom/server.ts --flag")
    monkeypatch.setenv("ALCHM_MCP_COMMAND", "bun")
    launch = alchm_mcp._resolve_launch()
    assert launch["mode"] == "explicit"
    assert launch["command"] == "bun"
    assert launch["args"] == ["run", "/custom/server.ts", "--flag"]


def test_resolve_launch_local_source(monkeypatch, tmp_path):
    # Point at a file that exists → local-source mode wins over the package.
    src = tmp_path / "index.ts"
    src.write_text("// stub")
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", str(src))
    launch = alchm_mcp._resolve_launch()
    assert launch["mode"] == "local-source"
    assert launch["args"] == ["run", str(src)]
    assert launch["cwd"] == str(src.parent.parent)


def test_resolve_launch_published_package_with_bun(monkeypatch):
    # No override, source path does not exist → published package via `bun x`.
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.delenv("ALCHM_MCP_COMMAND", raising=False)
    monkeypatch.delenv("ALCHM_MCP_PACKAGE", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", "/nope/does/not/exist/index.ts")
    launch = alchm_mcp._resolve_launch()
    assert launch["mode"] == "published-package"
    assert launch["command"] == "bun"
    assert launch["args"] == ["x", "@alchm/mcp-server@1.4.0"]
    assert launch["cwd"] is None


def test_resolve_launch_published_package_with_npx_and_pin(monkeypatch):
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", "/nope/index.ts")
    monkeypatch.setenv("ALCHM_MCP_COMMAND", "npx")
    monkeypatch.setenv("ALCHM_MCP_PACKAGE", "@alchm/mcp-server@1.1.1")
    launch = alchm_mcp._resolve_launch()
    assert launch["mode"] == "published-package"
    assert launch["command"] == "npx"
    assert launch["args"] == ["-y", "@alchm/mcp-server@1.1.1"]


def test_config_status_surfaces_launch_mode(monkeypatch):
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", "/nope/index.ts")
    status = alchm_mcp.config_status()
    assert status["launchMode"] == "published-package"
    assert status["serverPathExists"] is False
    assert status["publishedPackage"] == "@alchm/mcp-server@1.4.0"


def test_default_server_path_supports_shallow_container_layout(monkeypatch):
    monkeypatch.delenv("ALCHM_MCP_SERVER_PATH", raising=False)
    monkeypatch.setattr(alchm_mcp, "__file__", "/app/alchm_mcp.py")

    server_path = alchm_mcp._default_server_path()

    assert server_path == alchm_mcp.Path("/WhatToEatNext-master/mcp-server/src/index.ts")


# --------------------------------------------------------------------------
# Launch circuit breaker
# --------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_launch_circuit_breaker_opens_and_suppresses(monkeypatch):
    # Force published-package mode with a runtime that does not exist, so the
    # first attempt fails fast (FileNotFoundError) and trips the breaker.
    # ALCHM_MCP_ENABLED is set explicitly because a sibling test module disables
    # it at import time, which would otherwise short-circuit ensure_started().
    monkeypatch.setenv("ALCHM_MCP_ENABLED", "true")
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", "/nope/index.ts")
    monkeypatch.setenv("ALCHM_MCP_COMMAND", "definitely-not-a-real-binary-xyz")

    client = alchm_mcp.AlchmMCPClient()

    with pytest.raises(alchm_mcp.AlchmMCPError):
        await client.ensure_started()
    assert client._launch_failures == 1
    assert client._launch_cooldown_until > 0

    # Second call must be suppressed by the open breaker — no new spawn, so the
    # failure count does not increment and the message says "suppressed".
    with pytest.raises(alchm_mcp.AlchmMCPError, match="suppressed"):
        await client.ensure_started()
    assert client._launch_failures == 1


@pytest.mark.asyncio
async def test_launch_breaker_backoff_is_capped(monkeypatch):
    monkeypatch.setenv("ALCHM_MCP_ENABLED", "true")
    monkeypatch.delenv("ALCHM_MCP_ARGS", raising=False)
    monkeypatch.setenv("ALCHM_MCP_SERVER_PATH", "/nope/index.ts")
    monkeypatch.setenv("ALCHM_MCP_COMMAND", "definitely-not-a-real-binary-xyz")

    import time

    client = alchm_mcp.AlchmMCPClient()
    # Simulate many prior failures, then force the cooldown to have elapsed so a
    # real attempt runs and recomputes the (capped) backoff.
    client._launch_failures = 20
    client._launch_cooldown_until = 0.0
    with pytest.raises(alchm_mcp.AlchmMCPError):
        await client.ensure_started()
    remaining = client._launch_cooldown_until - time.monotonic()
    assert remaining <= alchm_mcp._LAUNCH_COOLDOWN_MAX + 1


# --------------------------------------------------------------------------
# Frozen-sidecar SQLite fallback (database.py)
# --------------------------------------------------------------------------

def test_frozen_sqlite_dsn_is_sqlite():
    dsn = database._frozen_sqlite_dsn()
    assert dsn.startswith("sqlite:///")
    assert dsn.endswith("pa-mcp-telemetry.db")


def test_resolve_dsn_forces_sqlite_when_frozen(monkeypatch):
    # Even with a Postgres DSN resolvable, a frozen bundle (which excludes the
    # postgresql dialect) must fall back to SQLite rather than crash.
    monkeypatch.setattr(database, "IS_FROZEN_SIDECAR", True)
    monkeypatch.setattr(database, "DIRECT_URL", "postgresql://user:pw@host/db")
    monkeypatch.setattr(database, "DATABASE_URL", "postgresql://user:pw@host/db")
    assert database._resolve_dsn().startswith("sqlite:///")


def test_resolve_dsn_uses_postgres_when_not_frozen(monkeypatch):
    monkeypatch.setattr(database, "IS_FROZEN_SIDECAR", False)
    monkeypatch.setattr(database, "DIRECT_URL", "postgresql://user:pw@host/db")
    monkeypatch.setattr(database, "DATABASE_URL", None)
    assert database._resolve_dsn() == "postgresql+psycopg2://user:pw@host/db"


# --------------------------------------------------------------------------
# MCP v1.4.0 8-tool allowlist, idempotencyKey, billing, and wrappers
# --------------------------------------------------------------------------

def test_alchm_mcp_allowlist_has_all_eight_v140_tools():
    assert alchm_mcp.ALCHM_MCP_TOOL_NAMES == {
        "get_live_sky_transits",
        "alchemize_ingredients",
        "generate_cosmic_recipe",
        "compute_synastry_overlay",
        "get_transit_natal_overlay",
        "compute_triplicate_synastry",
        "create_evidence_snapshot",
        "submit_recipe_reflection",
    }


def test_prepare_arguments_injects_idempotency_key_and_api_key_without_mutating(monkeypatch):
    monkeypatch.setenv("ALCHM_MCP_API_KEY", "alchm_test_key_123")
    original = {"prompt": "saffron broth", "_meta": {"caller": "pa-council"}}
    prepared = alchm_mcp._prepare_arguments(original, idempotency_key="idem-abc-1")

    assert original == {"prompt": "saffron broth", "_meta": {"caller": "pa-council"}}
    assert prepared == {
        "prompt": "saffron broth",
        "_meta": {
            "caller": "pa-council",
            "apiKey": "alchm_test_key_123",
            "idempotencyKey": "idem-abc-1",
        },
    }


def test_parse_tool_json_enriches_v140_billing_metadata():
    amounts = {"spirit": 0.1, "essence": 0.1, "matter": 0.1, "substance": 0.1}
    result = {
        "structuredContent": {
            "reflectionId": "ref-1",
            "published": True,
            "correlationId": "stdio:1",
            "billing": {
                "status": "charged",
                "reason": "settled",
                "amounts": amounts,
                "idempotencyKey": "idem-ref-1",
            },
        }
    }
    parsed = alchm_mcp.parse_tool_json(result)
    assert parsed["reflectionId"] == "ref-1"
    billing = alchm_mcp.extract_billing(parsed)
    assert billing is not None
    assert billing["status"] == "charged"
    assert billing["debited"] is True
    assert billing["replayed"] is False
    assert billing["cost"] == amounts
    assert billing["idempotencyKey"] == "idem-ref-1"


@pytest.mark.asyncio
async def test_v140_convenience_wrappers_forward_arguments_and_idempotency(monkeypatch):
    captured = []

    async def fake_call_tool_json(name, arguments=None, idempotency_key=None):
        captured.append((name, arguments, idempotency_key))
        return {"ok": True}

    monkeypatch.setattr(alchm_mcp._CLIENT, "call_tool_json", fake_call_tool_json)

    await alchm_mcp.compute_triplicate_synastry(
        {"id": "leonardo-da-vinci", "natalChart": {"planets": {"Sun": {"sign": "Taurus", "degree": 3.2}}}},
        {"id": "marsilio-ficino", "natalChart": {"planets": {"Sun": {"sign": "Libra", "degree": 26.1}}}},
        give_token="Spirit",
        give_amount=2.0,
        want_token="Essence",
        want_amount=2.0,
        transit_time="2026-10-24T12:00:00Z",
        idempotency_key="trip-1",
    )
    await alchm_mcp.create_evidence_snapshot(
        latitude=40.75,
        longitude=-73.80,
        ingredients=["saffron", "fennel"],
        cuisine="Italian",
        idempotency_key="snap-1",
    )
    await alchm_mcp.submit_recipe_reflection(
        "recipe-123",
        "Saffron Risotto",
        "Balanced solar warmth and lunar moisture.",
        5.0,
        agent_slug="leonardo-da-vinci",
        idempotency_key="refl-1",
    )

    assert len(captured) == 3
    assert captured[0][0] == "compute_triplicate_synastry"
    assert captured[0][1]["makerId"] == "leonardo-da-vinci"
    assert captured[0][1]["takerId"] == "marsilio-ficino"
    assert captured[0][2] == "trip-1"

    assert captured[1][0] == "create_evidence_snapshot"
    assert captured[1][1] == {
        "latitude": 40.75,
        "longitude": -73.80,
        "ingredients": ["saffron", "fennel"],
        "cuisine": "Italian",
    }
    assert captured[1][2] == "snap-1"

    assert captured[2][0] == "submit_recipe_reflection"
    assert captured[2][1] == {
        "recipeId": "recipe-123",
        "recipeName": "Saffron Risotto",
        "reflection": "Balanced solar warmth and lunar moisture.",
        "agentSlug": "leonardo-da-vinci",
    }
    assert captured[2][2] == "refl-1"


