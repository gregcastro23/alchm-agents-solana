"""Hermetic stdlib-only smoke checks for a source or frozen MCP subprocess.

Examples::

    python backend/mcp_smoke.py backend/dist/pa-mcp
    python backend/mcp_smoke.py --python backend/planetary_agents_mcp_server.py

Requests are interactive: stdin stays open until every response arrives. This
matters because the SDK cancels outstanding work when its input stream closes.
"""

from __future__ import annotations

import argparse
import json
import os
import queue
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any


EXPECTED_TOOLS = frozenset({
    "chat_with_planetary_agent", "list_planetary_agents", "get_agent_feed_discussion",
    "synthesize_culinary_debate", "trigger_chart_specific_jing_duel",
    "play_agent_word_duel", "play_jing_arena_move", "plan_weekly_menu", "publish_weekly_menu",
})
MODERN_VERSION = "2026-07-28"
LEGACY_VERSION = "2025-06-18"
SERVER_NAME = "planetary-agents-mcp-server"
_CLOSED = object()
_MAX_MESSAGE_BYTES = 2 * 1024 * 1024


class SmokeFailure(RuntimeError):
    """A bounded smoke failure suitable for CI diagnostics."""


def _require(condition: Any, message: str) -> None:
    if not condition:
        raise SmokeFailure(message)


def smoke_environment(storage_dir: str) -> dict[str, str]:
    """Use local disposable storage and disable credentials and network bridges."""
    env = dict(os.environ)
    for name in ("DATABASE_URL", "DIRECT_URL", "RAILWAY_ENVIRONMENT", "RAILWAY_PROJECT_ID"):
        env.pop(name, None)
    env.update({
        "PYTHON_DOTENV_DISABLED": "1",
        "PA_MCP_DATA_DIR": storage_dir,
        "ALLOW_SQLITE_FALLBACK": "true",
        "ALCHM_MCP_ENABLED": "false",
        "A2A_ENABLED": "false",
        "PA_MCP_API_KEY": "",
        "PA_USER_API_KEY": "",
        "PLANETARY_AGENTS_BACKEND_URL": "http://127.0.0.1:1",
        "PLANETARY_AGENTS_FRONTEND_URL": "http://127.0.0.1:1",
        "PLANETARY_AGENTS_MCP_MODEL_TIER": "free",
    })
    return env


class StdioProcess:
    """Correlate JSON-RPC responses without blocking indefinitely on readline."""

    def __init__(self, command: list[str], cwd: str, timeout: float = 30):
        self.timeout = timeout
        self.next_id = 0
        self.messages: queue.Queue[Any] = queue.Queue()
        self.buffered: dict[int | str, dict[str, Any]] = {}
        self.process = subprocess.Popen(
            command, cwd=cwd, env=smoke_environment(cwd), stdin=subprocess.PIPE,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True, encoding="utf-8", bufsize=1,
        )
        threading.Thread(target=self._read_stdout, daemon=True).start()
        threading.Thread(target=self._drain_stderr, daemon=True).start()

    def _read_stdout(self) -> None:
        assert self.process.stdout is not None
        try:
            while True:
                line = self.process.stdout.readline(_MAX_MESSAGE_BYTES + 1)
                if not line:
                    break
                if len(line) > _MAX_MESSAGE_BYTES:
                    self.messages.put(SmokeFailure("MCP stdout message exceeded the size limit"))
                    break
                if line.strip():
                    try:
                        message = json.loads(line)
                    except (ValueError, TypeError):
                        self.messages.put(SmokeFailure("MCP stdout contained a non-JSON message"))
                        break
                    self.messages.put(message)
        except (OSError, ValueError):
            self.messages.put(SmokeFailure("Could not read MCP stdout"))
        finally:
            self.messages.put(_CLOSED)

    def _drain_stderr(self) -> None:
        # Drain so a verbose child cannot block on its stderr pipe. Diagnostics
        # can contain user data; do not echo them into public CI output.
        assert self.process.stderr is not None
        try:
            while self.process.stderr.read(4096):
                pass
        except (OSError, ValueError):
            pass

    def _send(self, message: dict[str, Any]) -> None:
        assert self.process.stdin is not None
        try:
            self.process.stdin.write(json.dumps(message, separators=(",", ":")) + "\n")
            self.process.stdin.flush()
        except (OSError, ValueError) as exc:
            raise SmokeFailure("MCP process closed its input stream") from exc

    def notify(self, method: str, params: dict[str, Any] | None = None) -> None:
        message: dict[str, Any] = {"jsonrpc": "2.0", "method": method}
        if params is not None:
            message["params"] = params
        self._send(message)

    def request(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        self.next_id += 1
        request_id = self.next_id
        message: dict[str, Any] = {"jsonrpc": "2.0", "id": request_id, "method": method}
        if params is not None:
            message["params"] = params
        self._send(message)
        return self.wait_for(request_id)

    def wait_for(self, request_id: int | str) -> dict[str, Any]:
        deadline = time.monotonic() + self.timeout
        while request_id not in self.buffered:
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise SmokeFailure(f"Timed out waiting for MCP response {request_id}")
            try:
                message = self.messages.get(timeout=remaining)
            except queue.Empty as exc:
                raise SmokeFailure(f"Timed out waiting for MCP response {request_id}") from exc
            if message is _CLOSED:
                raise SmokeFailure(f"MCP stdout closed before response {request_id}")
            if isinstance(message, SmokeFailure):
                raise message
            _require(isinstance(message, dict) and message.get("jsonrpc") == "2.0", "Invalid MCP JSON-RPC envelope")
            if "id" not in message:
                _require(isinstance(message.get("method"), str), "Invalid MCP notification")
                continue
            response_id = message["id"]
            _require(type(response_id) in (int, str), "Invalid MCP response ID")
            _require(("result" in message) != ("error" in message), "MCP response must contain exactly one result or error")
            _require(response_id not in self.buffered, "Duplicate MCP response ID")
            _require(len(self.buffered) < 100, "Too many unrelated MCP responses")
            self.buffered[response_id] = message
        return self.buffered.pop(request_id)

    def close(self, *, require_graceful: bool) -> None:
        if self.process.stdin is not None and not self.process.stdin.closed:
            try:
                self.process.stdin.close()
            except OSError:
                pass
        forced = False
        try:
            code = self.process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            forced = True
            self.process.terminate()
            try:
                code = self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
                code = self.process.wait(timeout=2)
        finally:
            for stream in (self.process.stdout, self.process.stderr):
                if stream is not None:
                    stream.close()
        if require_graceful:
            _require(not forced, "MCP process did not exit gracefully after EOF")
            _require(code == 0, f"MCP process exited with code {code}")


def _result(response: dict[str, Any], *, modern: bool) -> dict[str, Any]:
    _require("error" not in response, "MCP request returned a protocol error")
    result = response.get("result")
    _require(isinstance(result, dict), "MCP result must be an object")
    if modern:
        _require(result.get("resultType") == "complete", "Modern MCP result must declare resultType=complete")
    return result


def check_process(command: list[str], cwd: str, *, modern: bool, legacy_version: str = LEGACY_VERSION, timeout: float = 30) -> None:
    """Check one protocol era against a fresh process, without external calls."""
    process = StdioProcess(command, cwd, timeout)
    successful = False

    def request(method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        payload = dict(params or {})
        if modern:
            payload["_meta"] = {
                "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
                "io.modelcontextprotocol/clientInfo": {"name": "pa-mcp-release-smoke", "version": "1"},
                "io.modelcontextprotocol/clientCapabilities": {},
            }
        return _result(process.request(method, payload), modern=modern)

    try:
        if modern:
            discovery = request("server/discover")
            _require(MODERN_VERSION in discovery.get("supportedVersions", []), "MCP discovery lacks the modern revision")
            identity = discovery.get("_meta", {}).get("io.modelcontextprotocol/serverInfo", {})
            capabilities = discovery.get("capabilities", {})
        else:
            initialization = request("initialize", {
                "protocolVersion": legacy_version, "capabilities": {},
                "clientInfo": {"name": "pa-mcp-release-smoke", "version": "1"},
            })
            _require(initialization.get("protocolVersion") == legacy_version, "MCP legacy version negotiation failed")
            identity = initialization.get("serverInfo", {})
            capabilities = initialization.get("capabilities", {})
            process.notify("notifications/initialized")
        _require(identity.get("name") == SERVER_NAME and isinstance(identity.get("version"), str), "MCP server identity is invalid")
        _require(all(name in capabilities for name in ("tools", "resources", "prompts")), "MCP capabilities are incomplete")

        tools = request("tools/list").get("tools")
        _require(isinstance(tools, list), "MCP tools/list lacks tools")
        names = [tool.get("name") for tool in tools if isinstance(tool, dict)]
        _require(len(tools) == len(EXPECTED_TOOLS) and set(names) == EXPECTED_TOOLS, "MCP tool manifest is incorrect")
        _require(all(tool.get("inputSchema", {}).get("type") == "object" and tool.get("outputSchema", {}).get("type") == "object" for tool in tools), "MCP tools lack typed input/output object schemas")

        resources = request("resources/list").get("resources", [])
        _require(any(resource.get("uri") == "resource://game/jing-counters" for resource in resources), "MCP Jing resource is missing")
        contents = request("resources/read", {"uri": "resource://game/jing-counters"}).get("contents", [])
        _require(contents and "Meltdown" in json.loads(contents[0].get("text", "{}" )).get("moves", {}), "MCP Jing resource is invalid")

        prompts = request("prompts/list").get("prompts", [])
        _require(any(prompt.get("name") == "jing-elemental-clash" for prompt in prompts), "MCP Jing prompt is missing")
        prompt = request("prompts/get", {"name": "jing-elemental-clash", "arguments": {"caster": "Mars", "target": "Saturn", "move": "Meltdown"}})
        _require(prompt.get("messages", [{}])[0].get("content", {}).get("type") == "text", "MCP prompt did not return text")

        invalid_params = {"name": "chat_with_planetary_agent", "arguments": {"agentName": "Socrates", "message": []}}
        if modern:
            invalid_params["_meta"] = {
                "io.modelcontextprotocol/protocolVersion": MODERN_VERSION,
                "io.modelcontextprotocol/clientCapabilities": {},
            }
        invalid = process.request("tools/call", invalid_params)
        _require(
            invalid.get("error", {}).get("code") == -32602 or invalid.get("result", {}).get("isError") is True,
            "Malformed tool arguments did not fail validation",
        )

        # No fixture charts exist for these names. This exercises a validated
        # successful tool result without a provider call or publication.
        healthy = request("tools/call", {
            "name": "trigger_chart_specific_jing_duel",
            "arguments": {"casterName": "__mcp_smoke_missing_caster__", "targetName": "__mcp_smoke_missing_target__"},
        })
        _require(healthy.get("isError") is not True, "Local Jing check returned a tool error")
        payload = healthy.get("structuredContent")
        _require(isinstance(payload, dict) and payload.get("triggered") is False and isinstance(payload.get("reason"), str), "Local Jing check lacks its typed result")
        content = healthy.get("content", [])
        _require(content and json.loads(content[0].get("text", "null")) == payload, "Structured and legacy text tool results differ")
        successful = True
    finally:
        process.close(require_graceful=successful)


def smoke(command: list[str], *, timeout: float = 30) -> None:
    """Check both protocol eras using separate temporary working directories."""
    executable = shutil.which(command[0]) or command[0]
    resolved_command = [str(Path(executable).absolute()), *command[1:]]
    with tempfile.TemporaryDirectory(prefix="pa-mcp-smoke-") as directory:
        for modern, version in ((False, "2024-11-05"), (False, LEGACY_VERSION), (True, MODERN_VERSION)):
            era_directory = Path(directory) / version
            era_directory.mkdir()
            check_process(resolved_command, str(era_directory), modern=modern, legacy_version=version, timeout=timeout)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=float, default=30, help="Maximum seconds per response (default: 30)")
    parser.add_argument("--python", metavar="SERVER_SCRIPT", help="Run a source server using this Python interpreter")
    parser.add_argument("command", nargs=argparse.REMAINDER, help="Frozen executable and optional arguments")
    options = parser.parse_args(argv)
    if options.python and options.command:
        parser.error("Use --python or an executable command, not both")
    command = [sys.executable, str(Path(options.python).resolve())] if options.python else options.command
    if not command or options.timeout <= 0:
        parser.error("Provide a command and a positive timeout")
    try:
        smoke(command, timeout=options.timeout)
    except (SmokeFailure, OSError, ValueError, TypeError, KeyError, IndexError) as exc:
        print(f"MCP smoke failed: {exc}", file=sys.stderr)
        return 1
    print("MCP smoke passed: legacy initialization, modern discovery, 9 typed tools, local resource/prompt, validation, structured results, EOF shutdown")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
