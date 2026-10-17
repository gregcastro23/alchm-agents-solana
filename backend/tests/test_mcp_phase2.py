"""MCP transport forwards credentials and keeps planning separate from publishing."""

import asyncio
import importlib.util
import json
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest


@pytest.fixture
def server(monkeypatch):
    for name in ("PA_MCP_API_KEY", "PA_USER_API_KEY"):
        monkeypatch.delenv(name, raising=False)
    log = SimpleNamespace(record_invocation=AsyncMock())

    def gate(name, arguments, *, resolved_identity):
        return dict(arguments), *resolved_identity, arguments.get("modelTier", "free")

    log.validate_and_gate_invocation = Mock(side_effect=gate)
    path = Path(__file__).resolve().parents[1] / "planetary_agents_mcp_server.py"
    spec = importlib.util.spec_from_file_location("_phase2_mcp_server", path)
    module = importlib.util.module_from_spec(spec)
    with monkeypatch.context() as imports:
        imports.setitem(sys.modules, "mcp_invocation_log", log)
        spec.loader.exec_module(module)
    return module, log


def response(payload):
    return SimpleNamespace(json=lambda: payload, raise_for_status=lambda: None)


def test_empty_environment_credentials_remain_anonymous(server, monkeypatch):
    module, _ = server
    monkeypatch.setenv("PA_MCP_API_KEY", "")
    monkeypatch.setenv("PA_USER_API_KEY", "")
    assert module._invocation_credential({}) is None


@pytest.fixture
def http(monkeypatch, server):
    module, _ = server
    client = AsyncMock()
    client.__aenter__.return_value = client
    monkeypatch.setattr(module.httpx, "AsyncClient", Mock(return_value=client))
    return client


@pytest.mark.asyncio
async def test_chat_forwards_credential_and_starts_private_distinct_sessions(server, http):
    module, _ = server
    http.post.return_value = response({"text": "reply", "sessionId": "server-handle"})
    token = module._INVOCATION_CREDENTIAL.set("verified-credential")
    try:
        await module._backend_chat("Socrates", "first")
        await module._backend_chat("Socrates", "second")
    finally:
        module._INVOCATION_CREDENTIAL.reset(token)
    first, second = http.post.call_args_list
    assert first.kwargs["json"]["sessionId"] != second.kwargs["json"]["sessionId"]
    assert first.kwargs["json"]["context"]["visibility"] == "private"
    assert first.kwargs["headers"] == {"X-API-Key": "verified-credential"}
    assert "userId" not in first.kwargs["json"]


@pytest.mark.asyncio
async def test_chat_can_forward_a_returned_conversation_handle(server, http):
    module, _ = server
    http.post.return_value = response({"text": "reply", "sessionId": "owned-handle"})
    await module._backend_chat("Socrates", "continue", session_id="owned-handle")
    assert http.post.call_args.kwargs["json"]["sessionId"] == "owned-handle"


@pytest.mark.asyncio
async def test_planning_only_returns_an_unpublished_draft(server, http):
    module, _ = server
    http.post.return_value = response({"success": True, "menu": {"title": "Menu", "status": "completed", "shareToFeed": True}})
    result = await module.plan_weekly_menu({"agentName": "Socrates"})
    data = json.loads(result["content"][0]["text"])
    assert data["menu"]["status"] == "draft"
    assert data["menu"]["shareToFeed"] is False
    assert data["feedShared"] is False
    http.post.assert_awaited_once()
    assert http.post.call_args.args[0].endswith("/api/menu-planner/generate")
    assert http.post.call_args.kwargs["json"]["regenerate"] is False
    assert http.post.call_args.kwargs["json"]["status"] == "draft"


@pytest.mark.asyncio
@pytest.mark.parametrize("flags", [{"status": "completed"}, {"shareToFeed": True}, {"shareToFeed": "false"}])
async def test_planning_cannot_opt_back_into_publication(server, http, flags):
    module, _ = server
    result = await module.plan_weekly_menu({"agentName": "Socrates", **flags})
    assert result["isError"] is True
    http.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_publication_requires_credential(server, http):
    module, _ = server
    result = await module.publish_weekly_menu({"menu": {"title": "Menu"}, "idempotencyKey": "draft-1"})
    assert result["isError"] is True
    http.post.assert_not_awaited()


@pytest.mark.asyncio
@pytest.mark.parametrize("key", [None, "", "bad\nkey", "x" * 201])
async def test_publication_requires_valid_idempotency_key(server, http, key):
    module, _ = server
    token = module._INVOCATION_CREDENTIAL.set("publisher-key")
    try:
        result = await module.publish_weekly_menu({"menu": {"title": "Menu"}, "idempotencyKey": key})
    finally:
        module._INVOCATION_CREDENTIAL.reset(token)
    assert result["isError"] is True
    http.post.assert_not_awaited()


@pytest.mark.asyncio
async def test_publication_forwards_exact_draft_and_stable_key(server, http):
    module, _ = server
    http.post.return_value = response({"success": True, "feedShared": True, "menu": {"id": "saved"}})
    draft = {"title": "Reviewed draft", "agentSlug": "socrates", "status": "draft"}
    token = module._INVOCATION_CREDENTIAL.set("publisher-key")
    try:
        result = await module.publish_weekly_menu({"menu": draft, "idempotencyKey": "draft-1"})
    finally:
        module._INVOCATION_CREDENTIAL.reset(token)
    assert not result.get("isError")
    assert http.post.call_args.args[0].endswith("/api/menu-planner/publish")
    assert http.post.call_args.kwargs["json"] == {"menu": draft}
    assert http.post.call_args.kwargs["headers"] == {"X-API-Key": "publisher-key", "Idempotency-Key": "draft-1"}


@pytest.mark.asyncio
async def test_dispatch_uses_remote_identity_not_claimed_metadata(server, http):
    module, log = server
    http.get.return_value = response({"apiKeyId": "key-a", "userId": "alice", "authTier": "standard"})
    handler = AsyncMock(side_effect=lambda arguments: module._text_result({
        "agentName": "Socrates", "agentId": "socrates", "text": "reply", "sessionId": "owned-handle",
        "credential": module._INVOCATION_CREDENTIAL.get(),
    }))
    monkey_handler = "chat_with_planetary_agent"
    module.TOOL_HANDLERS[monkey_handler] = handler
    arguments = {"agentName": "Socrates", "message": "hello", "_meta": {"apiKey": "credential-a", "userId": "bob", "authTier": "alchemist"}}
    result = await module.handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": monkey_handler, "arguments": arguments}})
    assert result["result"]
    assert http.get.call_args.args[0].endswith("/api/mcp/identity")
    assert log.validate_and_gate_invocation.call_args.kwargs["resolved_identity"] == ("key-a", "alice", "standard")
    assert module._INVOCATION_CREDENTIAL.get() is None


@pytest.mark.asyncio
async def test_credential_context_is_cleared_after_handler_error(server, http):
    module, _ = server
    http.get.return_value = response({"apiKeyId": "key-a", "userId": "alice", "authTier": "alchemist"})
    module.TOOL_HANDLERS["chat_with_planetary_agent"] = AsyncMock(side_effect=RuntimeError("failed"))
    result = await module.handle_request({"jsonrpc": "2.0", "id": 1, "method": "tools/call", "params": {"name": "chat_with_planetary_agent", "arguments": {"agentName": "Socrates", "message": "hello", "_meta": {"apiKey": "credential-a"}}}})
    assert result["result"]["isError"] is True
    assert module._INVOCATION_CREDENTIAL.get() is None


@pytest.mark.asyncio
@pytest.mark.parametrize("arguments", [[], {"agentName": "Socrates", "message": 123}, {"agentName": "Socrates", "message": "x" * 12001}])
async def test_invalid_arguments_fail_before_identity_or_handler(server, http, arguments):
    module, _ = server
    handler = AsyncMock()
    module.TOOL_HANDLERS["chat_with_planetary_agent"] = handler
    result = await module.handle_request({"id": 1, "method": "tools/call", "params": {"name": "chat_with_planetary_agent", "arguments": arguments}})
    assert result["error"]["code"] == -32602
    http.get.assert_not_awaited()
    handler.assert_not_awaited()


@pytest.mark.asyncio
async def test_official_metadata_is_normalized_without_persisting_unknown_fields(server, http):
    module, log = server
    http.get.return_value = response({"apiKeyId": "key-a", "userId": "alice", "authTier": "standard"})
    handler = AsyncMock(return_value=module._text_result({"agentName": "Socrates", "agentId": "socrates", "text": "reply", "sessionId": "owned"}))
    module.TOOL_HANDLERS["chat_with_planetary_agent"] = handler
    result = await module.handle_request({"id": 1, "method": "tools/call", "params": {
        "name": "chat_with_planetary_agent", "arguments": {"agentName": "Socrates", "message": "hello"},
        "_meta": {"api_key": "credential-a", "caller": "desktop", "authorization": "must-not-be-persisted", "nested": {"private": "secret"}},
    }})
    assert not result["result"].get("isError")
    expected = {"apiKey": "credential-a", "caller": "desktop"}
    assert handler.call_args.args[0]["_meta"] == expected
    assert log.record_invocation.call_args.kwargs["arguments"]["_meta"] == expected
    assert result["result"]["structuredContent"] == json.loads(result["result"]["content"][0]["text"])


@pytest.mark.asyncio
async def test_conflicting_credential_locations_fail_before_identity(server, http):
    module, _ = server
    result = await module.handle_request({"id": 1, "method": "tools/call", "params": {
        "name": "chat_with_planetary_agent", "arguments": {"agentName": "Socrates", "message": "hello", "_meta": {"apiKey": "legacy-secret"}},
        "_meta": {"apiKey": "official-secret"},
    }})
    assert result["error"]["code"] == -32602
    assert "legacy-secret" not in json.dumps(result)
    assert "official-secret" not in json.dumps(result)
    http.get.assert_not_awaited()


@pytest.mark.asyncio
async def test_invalid_success_response_is_a_logged_tool_error(server, http):
    module, log = server
    module.TOOL_HANDLERS["chat_with_planetary_agent"] = AsyncMock(return_value=module._text_result({"text": "missing identity"}))
    result = await module.handle_request({"id": 1, "method": "tools/call", "params": {"name": "chat_with_planetary_agent", "arguments": {"agentName": "Socrates", "message": "hello"}}})
    assert result["result"]["isError"] is True
    assert log.record_invocation.call_args.kwargs["success"] is False
    assert "missing identity" not in json.dumps(result)


@pytest.mark.asyncio
async def test_cancelling_chart_duel_cancels_both_provider_calls(server, monkeypatch):
    module, _ = server
    monkeypatch.setattr(module, "_detect_and_trigger_jing_interaction", AsyncMock(return_value={
        "triggered": True, "moveName": "Meltdown", "element": "Fire",
        "aspect": {"planetA": "Mars", "type": "square", "planetB": "Saturn", "orb": 1.0},
    }))
    both_started = asyncio.Event()
    started, cancelled = set(), set()

    async def slow_chat(agent_name, **kwargs):
        started.add(agent_name)
        if len(started) == 2:
            both_started.set()
        try:
            await asyncio.Event().wait()
        finally:
            cancelled.add(agent_name)

    monkeypatch.setattr(module, "_backend_chat", slow_chat)
    task = asyncio.create_task(module.trigger_chart_specific_jing_duel({"casterName": "Socrates", "targetName": "Rumi"}))
    await asyncio.wait_for(both_started.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert cancelled == {"Socrates", "Rumi"}


@pytest.mark.asyncio
async def test_list_agents_accepts_backend_consciousness_labels(server, http):
    module, _ = server
    http.get.return_value = response([
        {"agentId": "socrates", "name": "Socrates", "consciousnessLevel": "Transcendent"},
        {"agentId": "rumi", "name": "Rumi", "consciousnessLevel": "Active"},
    ])
    result = await module.handle_request({"id": 1, "method": "tools/call", "params": {"name": "list_planetary_agents", "arguments": {}}})
    assert not result["result"].get("isError")
    payload = result["result"]["structuredContent"]
    assert payload["count"] == 2
    assert [agent["consciousnessLevel"] for agent in payload["agents"]] == ["Transcendent", "Active"]
