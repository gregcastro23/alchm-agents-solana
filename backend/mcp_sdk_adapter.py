"""Official MCP protocol engine around the project's validated domain dispatcher.

The domain module owns authentication, typed tool contracts, and side effects.
This adapter owns only the SDK boundary: stdio framing, discovery, legacy
initialization, concurrent requests, cancellation, and protocol model conversion.
"""

from __future__ import annotations

import logging
from collections.abc import Mapping
from typing import Any

from mcp import MCPError
from mcp.server import Server, ServerRequestContext
from mcp.server.stdio import stdio_server
from mcp.types import (
    INTERNAL_ERROR,
    INVALID_PARAMS,
    METHOD_NOT_FOUND,
    CallToolRequestParams,
    CallToolResult,
    GetPromptRequestParams,
    GetPromptResult,
    ListPromptsResult,
    ListResourcesResult,
    ListToolsResult,
    PaginatedRequestParams,
    ReadResourceRequestParams,
    ReadResourceResult,
    TextContent,
)
from pydantic import BaseModel


logger = logging.getLogger(__name__)


def _wire_params(params: BaseModel | None) -> dict[str, Any]:
    return params.model_dump(by_alias=True, mode="json", exclude_none=True) if params is not None else {}


def _request_meta(ctx: ServerRequestContext[Any]) -> dict[str, Any]:
    """Retain custom request metadata, including credentials, without logging it."""
    if isinstance(ctx.meta, BaseModel):
        return ctx.meta.model_dump(by_alias=True, mode="json", exclude_none=True)
    return dict(ctx.meta) if isinstance(ctx.meta, Mapping) else {}


def _tool_failure() -> CallToolResult:
    return CallToolResult(
        content=[TextContent(type="text", text='{"error":"Tool execution failed"}')],
        is_error=True,
    )


def build_server(domain: Any) -> Server[dict[str, Any]]:
    """Build an SDK server; ``domain.handle_request`` validates every tool call.

    Keeping the already tested dispatcher as the service seam also preserves
    legacy ``arguments._meta`` credentials. Official ``params._meta`` travels
    separately; the domain normalizer rejects conflicting credentials before
    typed argument validation or any remote work.
    """
    tool_names = {tool["name"] for tool in domain.TOOLS}

    async def dispatch(ctx: ServerRequestContext[Any], method: str, params: BaseModel | None) -> Any:
        payload = _wire_params(params)
        meta = _request_meta(ctx)
        if meta:
            payload["_meta"] = meta
        response = await domain.handle_request({
            "jsonrpc": "2.0",
            "id": ctx.request_id if ctx.request_id is not None else 0,
            "method": method,
            "params": payload,
        })
        if not isinstance(response, dict):
            raise MCPError(INTERNAL_ERROR, "Internal server error")
        error = response.get("error")
        if isinstance(error, dict):
            code = error.get("code")
            if code in (INVALID_PARAMS, METHOD_NOT_FOUND):
                raise MCPError(code, str(error.get("message") or "Invalid request"))
            raise MCPError(INTERNAL_ERROR, "Internal server error")
        if "result" not in response:
            raise MCPError(INTERNAL_ERROR, "Internal server error")
        return response["result"]

    async def list_tools(ctx: ServerRequestContext[Any], params: PaginatedRequestParams | None) -> ListToolsResult:
        return ListToolsResult.model_validate(await dispatch(ctx, "tools/list", params))

    async def call_tool(ctx: ServerRequestContext[Any], params: CallToolRequestParams) -> CallToolResult:
        if params.name not in tool_names:
            raise MCPError(INVALID_PARAMS, "Unknown tool")
        try:
            # The low-level SDK deliberately does not apply a Tool.input_schema.
            # Domain.handle_request is the single Pydantic validation boundary.
            return CallToolResult.model_validate(await dispatch(ctx, "tools/call", params))
        except MCPError as exc:
            if exc.code != INTERNAL_ERROR:
                raise
            return _tool_failure()
        except Exception:
            # Never expose provider URLs, tokens, rejected arguments, or private
            # prompts through str(exc), including in the desktop stderr ring.
            logger.error("MCP tool execution failed")
            return _tool_failure()

    async def list_resources(ctx: ServerRequestContext[Any], params: PaginatedRequestParams | None) -> ListResourcesResult:
        return ListResourcesResult.model_validate(await dispatch(ctx, "resources/list", params))

    async def read_resource(ctx: ServerRequestContext[Any], params: ReadResourceRequestParams) -> ReadResourceResult:
        return ReadResourceResult.model_validate(await dispatch(ctx, "resources/read", params))

    async def list_prompts(ctx: ServerRequestContext[Any], params: PaginatedRequestParams | None) -> ListPromptsResult:
        return ListPromptsResult.model_validate(await dispatch(ctx, "prompts/list", params))

    async def get_prompt(ctx: ServerRequestContext[Any], params: GetPromptRequestParams) -> GetPromptResult:
        return GetPromptResult.model_validate(await dispatch(ctx, "prompts/get", params))

    return Server(
        "planetary-agents-mcp-server",
        version=getattr(domain, "SERVER_VERSION", "1.1.0"),
        instructions="Use the typed tools for private consultations and draft menus. Publishing requires an authorized caller and an idempotency key.",
        on_list_tools=list_tools,
        on_call_tool=call_tool,
        on_list_resources=list_resources,
        on_read_resource=read_resource,
        on_list_prompts=list_prompts,
        on_get_prompt=get_prompt,
    )


async def run_stdio(domain: Any) -> None:
    """Serve stdin/stdout with the SDK; diagnostics belong on stderr."""
    server = build_server(domain)
    async with stdio_server() as (read_stream, write_stream):
        await server.run(read_stream, write_stream, server.create_initialization_options())
