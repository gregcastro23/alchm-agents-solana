"""Exercise the official SDK boundary without a database or remote providers."""

import asyncio
import json

import anyio
import pytest
from mcp import Client, MCPError
from mcp.types import INVALID_PARAMS

from mcp_sdk_adapter import build_server


TOOL_NAMES = (
    "chat_with_planetary_agent", "list_planetary_agents", "get_agent_feed_discussion",
    "synthesize_culinary_debate", "trigger_chart_specific_jing_duel",
    "play_agent_word_duel", "play_jing_arena_move", "plan_weekly_menu",
    "publish_weekly_menu",
)


class FakeDomain:
    SERVER_VERSION = "test"
    TOOLS = [{
        "name": name,
        "description": name,
        "inputSchema": {"type": "object", "properties": {"message": {"type": "string"}}},
        "outputSchema": {"type": "object", "properties": {"text": {"type": "string"}}, "required": ["text"]},
    } for name in TOOL_NAMES]

    def __init__(self):
        self.calls = []
        self.started = asyncio.Event()
        self.cancelled = asyncio.Event()

    async def handle_request(self, message):
        self.calls.append(message)
        method = message["method"]
        params = message["params"]
        if method == "tools/list":
            result = {"tools": self.TOOLS}
        elif method == "tools/call":
            args = params.get("arguments", {})
            if args.get("message") == "slow":
                self.started.set()
                try:
                    await anyio.sleep_forever()
                finally:
                    self.cancelled.set()
            if args.get("message") == "raise":
                raise RuntimeError("secret-token-and-private-prompt")
            if args.get("message") == "protocol-error":
                return {"jsonrpc": "2.0", "id": message["id"], "error": {"code": -32603, "message": "secret-token"}}
            if args.get("message") == "invalid":
                result = {"content": [{"type": "text", "text": '{"error":"Invalid arguments"}'}], "isError": True}
            else:
                payload = {"text": args.get("message", "hello")}
                result = {"content": [{"type": "text", "text": json.dumps(payload)}], "structuredContent": payload}
        elif method == "resources/list":
            result = {"resources": [{"uri": "planetary://catalog", "name": "Catalog", "mimeType": "application/json"}]}
        elif method == "resources/read":
            result = {"contents": [{"uri": params["uri"], "mimeType": "application/json", "text": '{"agents":[]}'}]}
        elif method == "prompts/list":
            result = {"prompts": [{"name": "consult", "arguments": [{"name": "question", "required": True}]}]}
        elif method == "prompts/get":
            result = {"messages": [{"role": "user", "content": {"type": "text", "text": params["arguments"]["question"]}}]}
        else:
            raise AssertionError(method)
        return {"jsonrpc": "2.0", "id": message["id"], "result": result}


@pytest.mark.asyncio
@pytest.mark.parametrize("mode,version", [("auto", "2026-07-28"), ("legacy", "2025-11-25")])
async def test_both_protocol_eras_expose_contracts_and_dual_results(mode, version):
    domain = FakeDomain()
    async with Client(build_server(domain), mode=mode) as client:
        assert client.protocol_version == version
        listing = await client.list_tools()
        assert {tool.name for tool in listing.tools} == set(TOOL_NAMES)
        assert all(tool.input_schema["type"] == "object" and tool.output_schema["type"] == "object" for tool in listing.tools)
        result = await client.call_tool("chat_with_planetary_agent", {"message": "hello"})
        assert result.structured_content == {"text": "hello"}
        assert json.loads(result.content[0].text) == result.structured_content
        assert not result.is_error


@pytest.mark.asyncio
async def test_official_and_legacy_metadata_reach_domain_separately():
    domain = FakeDomain()
    async with Client(build_server(domain)) as client:
        await client.call_tool(
            "chat_with_planetary_agent",
            {"message": "hello", "_meta": {"apiKey": "legacy-key"}},
            meta={"apiKey": "official-key", "caller": "desktop"},
        )
    call = next(call for call in domain.calls if call["method"] == "tools/call")
    assert call["params"]["arguments"]["_meta"] == {"apiKey": "legacy-key"}
    assert call["params"]["_meta"]["apiKey"] == "official-key"
    assert call["params"]["_meta"]["caller"] == "desktop"


@pytest.mark.asyncio
async def test_resources_and_prompts_keep_existing_payloads():
    async with Client(build_server(FakeDomain())) as client:
        assert (await client.list_resources()).resources[0].name == "Catalog"
        resource = await client.read_resource("planetary://catalog")
        assert json.loads(resource.contents[0].text) == {"agents": []}
        assert (await client.list_prompts()).prompts[0].name == "consult"
        prompt = await client.get_prompt("consult", {"question": "What next?"})
        assert prompt.messages[0].content.text == "What next?"


@pytest.mark.asyncio
async def test_unknown_tool_is_protocol_error_without_domain_work():
    domain = FakeDomain()
    async with Client(build_server(domain)) as client:
        with pytest.raises(MCPError) as error:
            await client.call_tool("secret-token-unknown-tool", {})
        assert error.value.code == INVALID_PARAMS
        assert "secret-token" not in str(error.value)
    assert not any(call["method"] == "tools/call" for call in domain.calls)


@pytest.mark.asyncio
@pytest.mark.parametrize("message", ["raise", "protocol-error", "invalid"])
async def test_tool_errors_remain_errors_and_do_not_expose_secrets(message, caplog):
    async with Client(build_server(FakeDomain())) as client:
        result = await client.call_tool("chat_with_planetary_agent", {"message": message})
        assert result.is_error
        assert "error" in json.loads(result.content[0].text)
        assert "secret-token" not in str(result)
        assert "private-prompt" not in caplog.text


@pytest.mark.asyncio
@pytest.mark.parametrize("mode", ["auto", "legacy"])
async def test_cancelling_slow_tool_keeps_unrelated_reads_responsive(mode):
    domain = FakeDomain()
    async with Client(build_server(domain), mode=mode) as client:
        slow = asyncio.create_task(client.call_tool("chat_with_planetary_agent", {"message": "slow"}))
        try:
            with anyio.fail_after(2):
                await domain.started.wait()
                assert len((await client.list_tools()).tools) == 9
            slow.cancel()
            with pytest.raises(asyncio.CancelledError):
                await slow
            with anyio.fail_after(2):
                await domain.cancelled.wait()
                assert len((await client.list_tools()).tools) == 9
        finally:
            slow.cancel()
            await asyncio.gather(slow, return_exceptions=True)
