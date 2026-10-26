"""Health checks for legacy MCP tool-call responses, without backend imports."""

from typing import Any


def tool_response_succeeded(response: Any) -> bool:
    """Require a tool result with content and no RPC or execution error."""
    if not isinstance(response, dict) or "error" in response:
        return False

    result = response.get("result")
    if not isinstance(result, dict):
        return False

    # Successful MCP tools may omit isError; a present flag must be boolean.
    return isinstance(result.get("content"), list) and result.get("isError", False) is False
