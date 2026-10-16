"""Probe verdicts must distinguish tool failures from successful RPC delivery.

These tests deliberately import no app or database modules, so they can run
without loading deployment credentials or initializing a backend database.
"""

import pytest

from mcp_probe import tool_response_succeeded


@pytest.mark.parametrize(
    "result",
    [
        {"content": []},
        {"content": [{"type": "text", "text": "probe response"}]},
        {"content": [{"type": "text", "text": "probe response"}], "isError": False},
    ],
)
def test_successful_tool_result_with_optional_error_flag(result):
    assert tool_response_succeeded({"jsonrpc": "2.0", "id": "probe", "result": result})


@pytest.mark.parametrize(
    "response",
    [
        None,
        {},
        [],
        "invalid response",
        {"error": {"code": -32603, "message": "Backend unavailable"}},
        {"result": None},
        {"result": []},
        {"result": {}},
        {"result": {"content": None}},
        {"result": {"content": "invalid content"}},
        {"result": {"content": [], "isError": True}},
        {"result": {"content": [], "isError": None}},
        {"result": {"content": [], "isError": 0}},
        {"result": {"content": [], "isError": 1}},
        {"result": {"content": [], "isError": "false"}},
        {"result": {"content": [], "isError": ""}},
        {"result": {"content": [], "isError": []}},
        {"error": None, "result": {"content": []}},
        {"error": {"code": -32603}, "result": {"content": []}},
    ],
)
def test_failed_rpc_or_invalid_tool_result_fails_probe(response):
    assert tool_response_succeeded(response) is False
