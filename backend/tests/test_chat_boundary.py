"""Exercise the HTTP trust boundary with isolated app and SQLite instances."""

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


@pytest.fixture
def boundary(monkeypatch):
    # Set safe configuration before importing any database/application module.
    with monkeypatch.context() as startup:
        for name, value in {
            "DIRECT_URL": "", "DATABASE_URL": "", "PYTHON_DOTENV_DISABLED": "1",
            "A2A_ENABLED": "false", "ALCHM_MCP_ENABLED": "false",
            "INTERNAL_API_SECRET": "boundary-service-secret",
        }.items():
            startup.setenv(name, value)
        import database

        engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False}, poolclass=StaticPool)
        sessions = sessionmaker(bind=engine)
        startup.setattr(database, "engine", engine)
        startup.setattr(database, "SessionLocal", sessions)
        startup.setattr(database, "ensure_postgres_runtime_schema", lambda: None)
        path = Path(__file__).resolve().parents[1] / "main.py"
        spec = importlib.util.spec_from_file_location("_phase2_chat_app", path)
        app = importlib.util.module_from_spec(spec)
        startup.setitem(sys.modules, spec.name, app)
        spec.loader.exec_module(app)

    def get_db():
        with sessions() as session:
            yield session

    app.app.dependency_overrides[database.get_db] = get_db
    import mcp_invocation_log

    identities = {
        "alice-key": ("key-a", "alice", "alchemist"),
        "bob-key": ("key-b", "bob", "alchemist"),
        "standard-key": ("key-s", "standard-user", "standard"),
    }
    monkeypatch.setattr(mcp_invocation_log, "resolve_api_key_sync", lambda db, key: identities.get(key, (None, None, "anonymous")))
    monkeypatch.setattr(app.crud, "get_agent", Mock(return_value=SimpleNamespace(agentId="socrates")))
    recorded = Mock()
    monkeypatch.setattr(app.crud, "create_conversation", recorded)
    monkeypatch.setattr(app.rag.vector_store, "query", Mock(return_value={}))
    monkeypatch.setattr(app, "_build_alchm_mcp_context", AsyncMock(return_value=("", {"enabled": False})))
    provider = AsyncMock(return_value=SimpleNamespace(text="Test reply", provider="test", model="test-model", cache=None))
    monkeypatch.setattr(app.providers, "run_chain", provider)
    emitted = Mock()
    monkeypatch.setattr(app, "emit_feed_event", emitted)
    try:
        yield TestClient(app.app), provider, recorded, emitted
    finally:
        engine.dispose()


def post_chat(client, *, key=None, service=False, **body):
    headers = {}
    if key:
        headers["X-API-Key"] = key
    if service:
        headers["INTERNAL_API_SECRET"] = "boundary-service-secret"
    return client.post("/api/chat", headers=headers, json={
        "agentId": "socrates", "message": "Hello", "systemPromptOverride": "Test persona", **body,
    })


@pytest.mark.parametrize("key", [None, "expired-key", "alice-key"])
def test_unverified_or_mismatched_user_is_rejected_before_generation(boundary, key):
    client, provider, recorded, emitted = boundary
    response = post_chat(client, key=key, userId="someone-else")
    assert response.status_code in {401, 403}
    provider.assert_not_awaited()
    recorded.assert_not_called()
    emitted.assert_not_called()


def test_verified_identity_is_persisted_without_trusting_body_user_id(boundary):
    client, _, recorded, _ = boundary
    response = post_chat(client, key="alice-key")
    assert response.status_code == 200
    assert recorded.call_args.args[1].userId == "alice"
    assert response.json()["sessionId"].startswith("pa1.")


def test_same_client_handle_is_scoped_to_user_and_can_resume(boundary):
    client, provider, _, _ = boundary
    alice = post_chat(client, key="alice-key", sessionId="same-client-handle").json()["sessionId"]
    bob = post_chat(client, key="bob-key", sessionId="same-client-handle").json()["sessionId"]
    assert alice != bob
    assert post_chat(client, key="alice-key", sessionId=alice).json()["sessionId"] == alice
    provider.reset_mock()
    assert post_chat(client, key="bob-key", sessionId=alice).status_code == 403
    provider.assert_not_awaited()


def test_anonymous_legacy_handle_is_not_shared_between_calls(boundary):
    client, _, _, _ = boundary
    first = post_chat(client, sessionId="mcp-socrates").json()["sessionId"]
    second = post_chat(client, sessionId="mcp-socrates").json()["sessionId"]
    assert first != second
    assert post_chat(client, sessionId=first).json()["sessionId"] == first


@pytest.mark.parametrize(("key", "expected"), [(None, "free"), ("standard-key", "cheap_fast"), ("alice-key", "primary")])
def test_direct_http_cannot_bypass_entitlement_tier(boundary, key, expected):
    client, provider, _, _ = boundary
    response = post_chat(client, key=key, modelTier="primary")
    assert response.status_code == 200
    assert provider.call_args.kwargs["tier"] == expected


@pytest.mark.parametrize(("context", "publishes"), [
    (None, False), ({"visibility": "private"}, False), ({"isPrivate": True}, False),
    ({"visibility": "public", "isPrivate": True}, False), ({"visibility": "public"}, True),
])
def test_chat_feed_requires_explicit_public_visibility(boundary, context, publishes):
    client, _, _, emitted = boundary
    assert post_chat(client, context=context).status_code == 200
    assert emitted.called is publishes


def test_trusted_server_can_forward_verified_user(boundary):
    client, _, recorded, _ = boundary
    assert post_chat(client, service=True, userId="browser-user").status_code == 200
    assert recorded.call_args.args[1].userId == "browser-user"


def test_identity_endpoint_uses_the_credential_owner(boundary):
    client, provider, _, _ = boundary
    response = client.get("/api/mcp/identity", headers={"X-API-Key": "alice-key"})
    assert response.json() == {"apiKeyId": "key-a", "userId": "alice", "authTier": "alchemist"}
    assert client.get("/api/mcp/identity", headers={"X-API-Key": "expired-key"}).status_code == 401
    provider.assert_not_awaited()
