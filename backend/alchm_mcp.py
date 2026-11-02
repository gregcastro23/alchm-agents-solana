from __future__ import annotations

import asyncio
import json
import os
import shlex
import time
from collections import deque
from pathlib import Path
from typing import Any, Dict, List, Optional


ALCHM_MCP_TOOL_NAMES = {
    "get_live_sky_transits",
    "alchemize_ingredients",
    "generate_cosmic_recipe",
    "compute_synastry_overlay",
    "get_transit_natal_overlay",
    "compute_triplicate_synastry",
    "create_evidence_snapshot",
    "submit_recipe_reflection",
}

DEFAULT_PROTOCOL_VERSION = "2025-06-18"

# Published npm package for the Alchm data MCP server (io.github.gregcastro23/
# alchm-kitchen → @alchm/mcp-server). Used as the launch fallback when no local
# WhatToEatNext source tree is checked out, so deploys and the bundled pa-mcp
# desktop sidecar can still reach live transits/recipes instead of degrading to
# no Alchm data. Pin a version by setting ALCHM_MCP_PACKAGE=@alchm/mcp-server@1.4.0.
DEFAULT_PACKAGE = "@alchm/mcp-server@1.4.0"

# Child process environment whitelist to prevent leaking host secrets (OpenAI,
# Anthropic, Solana wallets, Stripe secrets) to child subprocesses.
_ALLOWED_ENV_EXACT = {
    "PATH",
    "HOME",
    "USER",
    "LOGNAME",
    "TMPDIR",
    "LANG",
    "LC_ALL",
    "SHELL",
    "TERM",
    "BUN_INSTALL",
    "NODE_ENV",
    "NODE_PATH",
    "DATABASE_URL",
}
_ALLOWED_ENV_PREFIXES = ("ALCHM_MCP_",)


def _sanitized_child_env() -> Dict[str, str]:
    """Build a clean environment dictionary for the Alchm MCP child process."""
    clean: Dict[str, str] = {}
    for key, value in os.environ.items():
        if key in _ALLOWED_ENV_EXACT or any(key.startswith(p) for p in _ALLOWED_ENV_PREFIXES):
            clean[key] = value
    database_url = os.getenv("ALCHM_MCP_DATABASE_URL") or os.getenv("DATABASE_URL")
    if database_url:
        clean["DATABASE_URL"] = database_url
    if "PATH" not in clean:
        clean["PATH"] = os.defpath
    return clean

# Launch circuit-breaker. When a launcher fails to boot (missing `bun`/`node`
# runtime, or a published package that crashes on startup — e.g. an undeclared
# `pg` dependency), we must not re-spawn and re-time-out on every chat. After a
# failure the breaker opens for an exponentially backed-off window so callers
# degrade fast (chat continues on persona + RAG) instead of eating the launch
# cost each request. A single success resets it.
_LAUNCH_COOLDOWN_BASE = float(os.getenv("ALCHM_MCP_LAUNCH_COOLDOWN_BASE", "30"))
_LAUNCH_COOLDOWN_MAX = float(os.getenv("ALCHM_MCP_LAUNCH_COOLDOWN_MAX", "300"))


class AlchmMCPError(RuntimeError):
    pass


# ---------------------------------------------------------------------------
# Failure telemetry (E3)
#
# The chat-hydration call sites in main.py catch Alchm MCP failures and
# degrade gracefully (chat still works on persona + RAG). That's the
# right behavior, but it made outages invisible above the per-request
# level — a chat could succeed while every Alchm tool call silently
# failed. These ring buffers give the admin panel a rolling view so the
# "PA MCP" status row can turn yellow when the failure rate climbs even
# though individual chats keep returning 200.
#
# In-memory + per-process: good enough for a single-container Railway
# deploy. If PA ever scales horizontally, promote this to a shared
# store (Redis) or an OTel counter.
# ---------------------------------------------------------------------------

_ERROR_RING_SIZE = 200
# Each entry: {"ts": epoch_seconds, "tool": str, "error": str}
_ERROR_LOG: "deque[Dict[str, Any]]" = deque(maxlen=_ERROR_RING_SIZE)
# Per-tool success/failure tallies since process start (monotonic).
_CALL_TALLY: Dict[str, Dict[str, int]] = {}


def record_success(tool: str) -> None:
    bucket = _CALL_TALLY.setdefault(tool, {"success": 0, "error": 0})
    bucket["success"] += 1


def record_error(tool: str, error: Any) -> None:
    bucket = _CALL_TALLY.setdefault(tool, {"success": 0, "error": 0})
    bucket["error"] += 1
    _ERROR_LOG.append(
        {
            "ts": time.time(),
            "tool": tool,
            "error": str(error)[:300],
        }
    )


def get_error_stats(window_seconds: int = 300) -> Dict[str, Any]:
    """Rolling error view for the admin panel.

    Returns lifetime per-tool tallies plus a windowed error count and
    rate. `errorRatePerMin` over the window is what the panel thresholds
    on (>1/min → yellow). `recentErrors` is the tail of the ring for
    drill-down.
    """
    now = time.time()
    cutoff = now - max(1, window_seconds)
    windowed = [e for e in _ERROR_LOG if e["ts"] >= cutoff]

    total_success = sum(b["success"] for b in _CALL_TALLY.values())
    total_error = sum(b["error"] for b in _CALL_TALLY.values())
    total_calls = total_success + total_error

    window_minutes = max(window_seconds / 60.0, 1 / 60.0)

    return {
        "windowSeconds": window_seconds,
        "windowedErrorCount": len(windowed),
        "errorRatePerMin": round(len(windowed) / window_minutes, 3),
        "lifetime": {
            "totalCalls": total_calls,
            "totalErrors": total_error,
            "errorRate": round(total_error / total_calls, 4) if total_calls else 0.0,
            "byTool": _CALL_TALLY,
        },
        "recentErrors": list(_ERROR_LOG)[-25:],
    }


def _env_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() not in {"0", "false", "no", "off"}


def is_enabled() -> bool:
    return _env_bool("ALCHM_MCP_ENABLED", True)


def _default_server_path() -> Path:
    explicit = os.getenv("ALCHM_MCP_SERVER_PATH")
    if explicit:
        return Path(explicit).expanduser()

    here = Path(__file__).resolve()
    module_dir = here.parent
    project_root = module_dir.parent if module_dir.name == "backend" else module_dir
    candidates = [
        project_root / "mcp-server" / "src" / "index.ts",
        project_root.parent / "WhatToEatNext-master" / "mcp-server" / "src" / "index.ts",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[-1]


def _published_package() -> str:
    return os.getenv("ALCHM_MCP_PACKAGE", DEFAULT_PACKAGE)


def _resolve_launch() -> Dict[str, Any]:
    """Decide how to launch the Alchm MCP server, in priority order:

    1. Explicit override — ALCHM_MCP_ARGS (with optional ALCHM_MCP_COMMAND).
       Full manual control, used verbatim.
    2. Local dev source — the WhatToEatNext `mcp-server/src/index.ts` checked
       out as a sibling repo, run via `bun run <path>`. Preferred in dev so
       local edits to the data server are picked up without a publish.
    3. Published package — `bunx @alchm/mcp-server` (npm). The path that lets
       any deploy WITHOUT the sibling source tree — including the bundled
       pa-mcp desktop sidecar — still reach live transits/recipes rather than
       silently degrading to no Alchm data.

    Returns {command, args, cwd, mode, target}. `mode`/`target` are surfaced
    in config_status() so the admin panel can tell which source is live.
    """
    runner = os.getenv("ALCHM_MCP_COMMAND", "bun")

    # 1. Explicit override (highest priority).
    args_env = os.getenv("ALCHM_MCP_ARGS")
    if args_env:
        return {
            "command": runner,
            "args": shlex.split(args_env),
            "cwd": None,
            "mode": "explicit",
            "target": f"{runner} {args_env}",
        }

    # 2. Local dev source, when the sibling WTEN repo is present.
    server_path = _default_server_path()
    if server_path.exists():
        return {
            "command": runner,
            "args": ["run", str(server_path)],
            "cwd": str(server_path.parents[1]),
            "mode": "local-source",
            "target": str(server_path),
        }

    # 3. Published npm package via the runner's ephemeral exec.
    package = _published_package()
    if runner == "bun":
        args = ["x", package]            # `bun x` == bunx
    elif runner in ("npx", "node"):
        args = ["-y", package]           # npx -y <package>
        runner = "npx"
    else:
        args = [package]                 # custom runner: best-effort
    return {
        "command": runner,
        "args": args,
        "cwd": None,
        "mode": "published-package",
        "target": package,
    }


def config_status() -> Dict[str, Any]:
    server_path = _default_server_path()
    launch = _resolve_launch()
    return {
        "enabled": is_enabled(),
        "command": launch["command"],
        "args": launch["args"],
        "launchMode": launch["mode"],
        "launchTarget": launch["target"],
        "serverPath": str(server_path),
        "serverPathExists": server_path.exists(),
        "publishedPackage": _published_package(),
        "databaseUrlConfigured": bool(os.getenv("ALCHM_MCP_DATABASE_URL") or os.getenv("DATABASE_URL")),
        "protocolVersion": os.getenv("ALCHM_MCP_PROTOCOL_VERSION", DEFAULT_PROTOCOL_VERSION),
    }


def _prepare_arguments(
    arguments: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    prepared: Dict[str, Any] = dict(arguments) if arguments else {}
    existing_meta = prepared.get("_meta")
    meta: Dict[str, Any] = dict(existing_meta) if isinstance(existing_meta, dict) else {}

    api_key = os.getenv("ALCHM_MCP_API_KEY")
    if api_key and "apiKey" not in meta and "authKey" not in meta:
        meta["apiKey"] = api_key

    if idempotency_key:
        meta["idempotencyKey"] = idempotency_key

    if meta:
        prepared["_meta"] = meta
    return prepared


def _normalize_billing(raw_billing: Any) -> Optional[Dict[str, Any]]:
    if not isinstance(raw_billing, dict):
        return None
    normalized = dict(raw_billing)
    status = normalized.get("status")
    amounts = normalized.get("amounts")
    if "debited" not in normalized and isinstance(status, str):
        normalized["debited"] = status == "charged"
    if "replayed" not in normalized and isinstance(status, str):
        normalized["replayed"] = status == "replayed"
    if "cost" not in normalized and "amounts" in normalized:
        normalized["cost"] = amounts
    return normalized


def extract_billing(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not isinstance(payload, dict):
        return None
    return _normalize_billing(payload.get("billing"))


def _content_text(result: Dict[str, Any]) -> str:
    content = result.get("content")
    if not isinstance(content, list):
        return ""
    chunks = []
    for item in content:
        if isinstance(item, dict) and item.get("type") == "text":
            text = item.get("text")
            if isinstance(text, str):
                chunks.append(text)
    return "\n".join(chunks).strip()


def parse_tool_json(result: Dict[str, Any]) -> Dict[str, Any]:
    structured = result.get("structuredContent")
    if isinstance(structured, dict):
        parsed_dict: Dict[str, Any] = dict(structured)
    else:
        text = _content_text(result)
        if not text:
            return {}
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return {"text": text}
        if isinstance(parsed, dict):
            parsed_dict = dict(parsed)
        else:
            return {"value": parsed}

    raw_billing = parsed_dict.get("billing") or result.get("billing")
    normalized_billing = _normalize_billing(raw_billing)
    if normalized_billing is not None:
        parsed_dict["billing"] = normalized_billing
    return parsed_dict


class AlchmMCPClient:
    def __init__(self) -> None:
        self._proc: Optional[asyncio.subprocess.Process] = None
        self._request_id = 0
        self._start_lock = asyncio.Lock()
        self._write_lock = asyncio.Lock()
        max_concurrency = int(os.getenv("ALCHM_MCP_MAX_CONCURRENCY", "4"))
        self._semaphore = asyncio.Semaphore(max(1, max_concurrency))
        self._pending_requests: Dict[int, asyncio.Future[Dict[str, Any]]] = {}
        self._stdout_task: Optional[asyncio.Task[None]] = None
        self._stderr_task: Optional[asyncio.Task[None]] = None
        self._stderr_tail: deque[str] = deque(maxlen=20)
        self._stdout_tail: deque[str] = deque(maxlen=20)
        self._tools: Optional[List[Dict[str, Any]]] = None
        self._launch_failures = 0
        self._launch_cooldown_until = 0.0

    @property
    def connected(self) -> bool:
        return self._proc is not None and self._proc.returncode is None

    async def ensure_started(self) -> None:
        if self.connected:
            return

        async with self._start_lock:
            if self.connected:
                return
            if not is_enabled():
                raise AlchmMCPError("Alchm MCP integration is disabled")

            # Circuit-breaker: skip the launch entirely while the cooldown from a
            # recent failure is still open, so a missing runtime or a broken
            # published package can't add launch latency to every chat.
            now = time.monotonic()
            if now < self._launch_cooldown_until:
                raise AlchmMCPError(
                    f"Alchm MCP launch suppressed: {self._launch_failures} consecutive "
                    f"failure(s); retrying in {self._launch_cooldown_until - now:.0f}s"
                )

            # Resolve the launch plan: explicit override → local dev source →
            # published npm package. No longer hard-fails when the sibling WTEN
            # source is absent; it falls back to `bunx @alchm/mcp-server@1.1.2`.
            launch = _resolve_launch()
            command, args = launch["command"], launch["args"]
            env = _sanitized_child_env()

            try:
                try:
                    self._proc = await asyncio.create_subprocess_exec(
                        command,
                        *args,
                        stdin=asyncio.subprocess.PIPE,
                        stdout=asyncio.subprocess.PIPE,
                        stderr=asyncio.subprocess.PIPE,
                        cwd=launch["cwd"],
                        env=env,
                    )
                except FileNotFoundError as exc:
                    raise AlchmMCPError(
                        f"Unable to start Alchm MCP via {launch['mode']} "
                        f"({command} {' '.join(args)}). Install the '{command}' runtime, "
                        f"check out the WTEN sibling repo, or set ALCHM_MCP_COMMAND/ALCHM_MCP_ARGS."
                    ) from exc

                self._stderr_task = asyncio.create_task(self._drain_stderr())
                self._stdout_task = asyncio.create_task(self._drain_stdout())
                await self._initialize()
            except Exception:
                # Open the breaker with exponential backoff, then re-raise so the
                # caller degrades gracefully (the call-site wrappers catch it and
                # record_error() for the admin panel).
                self._launch_failures += 1
                backoff = min(
                    _LAUNCH_COOLDOWN_BASE * (2 ** (self._launch_failures - 1)),
                    _LAUNCH_COOLDOWN_MAX,
                )
                self._launch_cooldown_until = time.monotonic() + backoff
                await self.close()
                raise

            # Success — reset the breaker.
            self._launch_failures = 0
            self._launch_cooldown_until = 0.0

    async def _drain_stderr(self) -> None:
        proc = self._proc
        if not proc or not proc.stderr:
            return
        while True:
            line = await proc.stderr.readline()
            if not line:
                break
            decoded = line.decode("utf-8", errors="replace").strip()
            if decoded:
                self._stderr_tail.append(decoded)

    async def _drain_stdout(self) -> None:
        proc = self._proc
        if not proc or not proc.stdout:
            return
        while True:
            try:
                line = await proc.stdout.readline()
            except (asyncio.CancelledError, Exception):
                break
            if not line:
                break
            try:
                message = json.loads(line.decode("utf-8"))
            except json.JSONDecodeError:
                decoded = line.decode("utf-8", errors="replace").strip()
                if decoded:
                    self._stdout_tail.append(decoded)
                continue

            msg_id = message.get("id")
            if msg_id is not None and msg_id in self._pending_requests:
                fut = self._pending_requests.pop(msg_id)
                if not fut.done():
                    if "error" in message:
                        error = message["error"]
                        detail = error.get("message") if isinstance(error, dict) else str(error)
                        fut.set_exception(AlchmMCPError(f"Alchm MCP request failed: {detail}"))
                    else:
                        result = message.get("result")
                        fut.set_result(result if isinstance(result, dict) else {})

        # Process exited or stdout closed. Reject any lingering futures.
        stderr_tail = "; ".join(self._stderr_tail)
        stdout_tail = "; ".join(self._stdout_tail)
        exit_err = AlchmMCPError(
            f"Alchm MCP process exited while requests were pending: "
            f"stderr={stderr_tail} stdout={stdout_tail}"
        )
        for fut in list(self._pending_requests.values()):
            if not fut.done():
                fut.set_exception(exit_err)
        self._pending_requests.clear()

    async def _initialize(self) -> None:
        protocol_version = os.getenv("ALCHM_MCP_PROTOCOL_VERSION", DEFAULT_PROTOCOL_VERSION)
        await self._request(
            "initialize",
            {
                "protocolVersion": protocol_version,
                "capabilities": {},
                "clientInfo": {"name": "planetary-agents-backend", "version": "1.0.0"},
            },
        )
        await self._notify("notifications/initialized")
        await self.list_tools(refresh=True)

    async def _notify(self, method: str, params: Optional[Dict[str, Any]] = None) -> None:
        async with self._write_lock:
            await self._write({"jsonrpc": "2.0", "method": method, **({"params": params} if params else {})})

    async def _request(
        self,
        method: str,
        params: Optional[Dict[str, Any]] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        if not self._proc or not self._proc.stdout or not self._proc.stdin:
            raise AlchmMCPError("Alchm MCP process is not running")

        if timeout is None:
            timeout = float(os.getenv("ALCHM_MCP_TIMEOUT_SECONDS", "8"))

        async with self._semaphore:
            loop = asyncio.get_running_loop()
            self._request_id += 1
            request_id = self._request_id
            fut: asyncio.Future[Dict[str, Any]] = loop.create_future()
            self._pending_requests[request_id] = fut

            try:
                async with self._write_lock:
                    await self._write(
                        {
                            "jsonrpc": "2.0",
                            "id": request_id,
                            "method": method,
                            **({"params": params} if params is not None else {}),
                        }
                    )
                return await asyncio.wait_for(fut, timeout=timeout)
            except asyncio.TimeoutError as exc:
                self._pending_requests.pop(request_id, None)
                raise AlchmMCPError(f"Alchm MCP request timed out: {method}") from exc
            except asyncio.CancelledError:
                self._pending_requests.pop(request_id, None)
                raise
            except Exception:
                self._pending_requests.pop(request_id, None)
                raise

    async def _write(self, message: Dict[str, Any]) -> None:
        if not self._proc or not self._proc.stdin:
            raise AlchmMCPError("Alchm MCP stdin is not available")
        payload = json.dumps(message, separators=(",", ":")) + "\n"
        self._proc.stdin.write(payload.encode("utf-8"))
        await self._proc.stdin.drain()

    async def list_tools(self, refresh: bool = False) -> List[Dict[str, Any]]:
        if self._tools is not None and not refresh:
            return self._tools
        result = await self._request("tools/list")
        tools = result.get("tools", [])
        if not isinstance(tools, list):
            raise AlchmMCPError("Alchm MCP returned invalid tools/list payload")

        names = {tool.get("name") for tool in tools if isinstance(tool, dict)}
        missing = sorted(ALCHM_MCP_TOOL_NAMES - names)
        if missing:
            raise AlchmMCPError(f"Alchm MCP is missing expected tools: {', '.join(missing)}")

        self._tools = [tool for tool in tools if isinstance(tool, dict)]
        return self._tools

    async def call_tool(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        if name not in ALCHM_MCP_TOOL_NAMES:
            raise AlchmMCPError(f"Unsupported Alchm MCP tool: {name}")
        await self.ensure_started()
        prepared_args = _prepare_arguments(arguments, idempotency_key=idempotency_key)
        result = await self._request(
            "tools/call",
            {"name": name, "arguments": prepared_args},
            timeout=timeout,
        )
        if result.get("isError"):
            raise AlchmMCPError(_content_text(result) or f"Alchm MCP tool failed: {name}")
        return result

    async def call_tool_json(
        self,
        name: str,
        arguments: Optional[Dict[str, Any]] = None,
        idempotency_key: Optional[str] = None,
        timeout: Optional[float] = None,
    ) -> Dict[str, Any]:
        return parse_tool_json(
            await self.call_tool(
                name,
                arguments,
                idempotency_key=idempotency_key,
                timeout=timeout,
            )
        )

    async def close(self) -> None:
        proc = self._proc
        self._proc = None
        self._tools = None

        if self._stdout_task:
            self._stdout_task.cancel()
            try:
                await self._stdout_task
            except asyncio.CancelledError:
                pass
            self._stdout_task = None

        if self._stderr_task:
            self._stderr_task.cancel()
            try:
                await self._stderr_task
            except asyncio.CancelledError:
                pass
            self._stderr_task = None

        # Fail any remaining in-flight requests
        for fut in self._pending_requests.values():
            if not fut.done():
                fut.set_exception(AlchmMCPError("Alchm MCP client closed"))
        self._pending_requests.clear()

        if proc and proc.returncode is None:
            if hasattr(proc, "terminate"):
                proc.terminate()
            try:
                if hasattr(proc, "wait"):
                    await asyncio.wait_for(proc.wait(), timeout=3)
            except asyncio.TimeoutError:
                if hasattr(proc, "kill"):
                    proc.kill()
                if hasattr(proc, "wait"):
                    await proc.wait()


_CLIENT = AlchmMCPClient()


async def warmup() -> None:
    await _CLIENT.ensure_started()


async def list_tools() -> List[Dict[str, Any]]:
    await _CLIENT.ensure_started()
    return await _CLIENT.list_tools()


async def call_tool_json(
    name: str,
    arguments: Optional[Dict[str, Any]] = None,
    idempotency_key: Optional[str] = None,
    timeout: Optional[float] = None,
) -> Dict[str, Any]:
    # Single telemetry chokepoint: every public tool wrapper and both call paths
    # (main.py chat hydration + the PA MCP server's debate/jing tools) route through
    # here, so recording success/error here covers all call sites uniformly.
    try:
        if idempotency_key is not None and timeout is not None:
            result = await _CLIENT.call_tool_json(
                name,
                arguments,
                idempotency_key=idempotency_key,
                timeout=timeout,
            )
        elif idempotency_key is not None:
            result = await _CLIENT.call_tool_json(
                name,
                arguments,
                idempotency_key=idempotency_key,
            )
        elif timeout is not None:
            result = await _CLIENT.call_tool_json(
                name,
                arguments,
                timeout=timeout,
            )
        else:
            result = await _CLIENT.call_tool_json(name, arguments)
    except Exception as exc:
        record_error(name, exc)
        raise
    record_success(name)
    return result


async def get_live_sky_transits(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
) -> Dict[str, Any]:
    args: Dict[str, Any] = {}
    if latitude is not None:
        args["latitude"] = latitude
    if longitude is not None:
        args["longitude"] = longitude
    return await call_tool_json("get_live_sky_transits", args)


async def alchemize_ingredients(
    ingredients: List[str],
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    return await call_tool_json(
        "alchemize_ingredients",
        {"ingredients": ingredients},
        idempotency_key=idempotency_key,
    )


async def generate_cosmic_recipe(
    prompt: Optional[str] = None,
    cuisine: Optional[str] = None,
    dietary: Optional[List[str]] = None,
    dominant_element: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    args: Dict[str, Any] = {}
    if prompt:
        args["prompt"] = prompt
    if cuisine:
        args["cuisine"] = cuisine
    if dietary:
        args["dietary"] = dietary
    if dominant_element:
        args["dominantElement"] = dominant_element
    return await call_tool_json(
        "generate_cosmic_recipe",
        args,
        idempotency_key=idempotency_key,
    )


async def compute_synastry_overlay(
    agent_a: Dict[str, Any],
    agent_b: Dict[str, Any],
    focus_planets: Optional[List[str]] = None,
    cache_strategy: str = "read",
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Inter-aspect ledger + tension/harmony/intensification scores + stance.

    Each agent dict must carry {id, natalChart}, where natalChart.planets
    is {planet: {sign, degree, retrograde?, house?}}.
    """
    args: Dict[str, Any] = {
        "agentA": agent_a,
        "agentB": agent_b,
        "cacheStrategy": cache_strategy,
    }
    if focus_planets:
        args["focusPlanets"] = focus_planets
    return await call_tool_json(
        "compute_synastry_overlay",
        args,
        idempotency_key=idempotency_key,
    )


async def get_transit_natal_overlay(
    agent: Dict[str, Any],
    transit_time: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    focus_planets: Optional[List[str]] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Current sky × one agent's natal chart → boost element + magnitude."""
    args: Dict[str, Any] = {"agent": agent}
    if transit_time:
        args["transitTime"] = transit_time
    if latitude is not None:
        args["latitude"] = latitude
    if longitude is not None:
        args["longitude"] = longitude
    if focus_planets:
        args["focusPlanets"] = focus_planets
    return await call_tool_json(
        "get_transit_natal_overlay",
        args,
        idempotency_key=idempotency_key,
    )


def _extract_natal_placements(agent_dict: Optional[Dict[str, Any]]) -> Any:
    if not isinstance(agent_dict, dict):
        return None
    natal_chart = agent_dict.get("natalChart")
    if isinstance(natal_chart, dict) and "planets" in natal_chart:
        return natal_chart["planets"]
    if "planets" in agent_dict and isinstance(agent_dict["planets"], dict):
        return agent_dict["planets"]
    return agent_dict.get("natal") or natal_chart


async def compute_triplicate_synastry(
    agent_a: Optional[Dict[str, Any]] = None,
    agent_b: Optional[Dict[str, Any]] = None,
    *,
    maker_id: Optional[str] = None,
    taker_id: Optional[str] = None,
    maker_natal: Optional[Any] = None,
    taker_natal: Optional[Any] = None,
    give_token: str = "Spirit",
    give_amount: float = 1.0,
    want_token: str = "Essence",
    want_amount: float = 1.0,
    transit_time: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Evaluate 3-body natal A × natal B × live transit sky resonance and rebate."""
    resolved_maker_id = maker_id or (
        agent_a.get("id") if isinstance(agent_a, dict) else None
    )
    resolved_taker_id = taker_id or (
        agent_b.get("id") if isinstance(agent_b, dict) else None
    )
    resolved_maker_natal = (
        maker_natal
        if maker_natal is not None
        else _extract_natal_placements(agent_a)
    )
    resolved_taker_natal = (
        taker_natal
        if taker_natal is not None
        else _extract_natal_placements(agent_b)
    )

    args: Dict[str, Any] = {
        "makerId": resolved_maker_id,
        "takerId": resolved_taker_id,
        "makerNatal": resolved_maker_natal,
        "takerNatal": resolved_taker_natal,
        "giveToken": give_token,
        "giveAmount": give_amount,
        "wantToken": want_token,
        "wantAmount": want_amount,
    }
    if transit_time:
        args["transitTime"] = transit_time
    return await call_tool_json(
        "compute_triplicate_synastry",
        args,
        idempotency_key=idempotency_key,
    )


async def create_evidence_snapshot(
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    ingredients: Optional[List[str]] = None,
    prompt: Optional[str] = None,
    cuisine: Optional[str] = None,
    dietary: Optional[List[str]] = None,
    dominant_element: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Bundle live sky transits, ingredient alchemization, and cosmic recipes."""
    args: Dict[str, Any] = {}
    if latitude is not None:
        args["latitude"] = latitude
    if longitude is not None:
        args["longitude"] = longitude
    if ingredients:
        args["ingredients"] = ingredients
    if prompt:
        args["prompt"] = prompt
    if cuisine:
        args["cuisine"] = cuisine
    if dietary:
        args["dietary"] = dietary
    if dominant_element:
        args["dominantElement"] = dominant_element
    return await call_tool_json(
        "create_evidence_snapshot",
        args,
        idempotency_key=idempotency_key,
    )


async def submit_recipe_reflection(
    recipe_id: str,
    recipe_name: Optional[str] = None,
    reflection_text: Optional[str] = None,
    rating: Optional[float] = None,
    *,
    reflection: Optional[str] = None,
    agent_slug: Optional[str] = None,
    agent_name: Optional[str] = None,
    dominant_element: Optional[str] = None,
    source: Optional[str] = None,
    idempotency_key: Optional[str] = None,
) -> Dict[str, Any]:
    """Submit an authentic culinary reflection for a recipe via Alchm MCP."""
    _ = rating  # Accepted for caller signature compatibility; MCP schema is unrated.
    resolved_reflection = reflection if reflection is not None else reflection_text
    args: Dict[str, Any] = {
        "recipeId": recipe_id,
        "reflection": resolved_reflection or "",
    }
    if recipe_name:
        args["recipeName"] = recipe_name
    if agent_slug:
        args["agentSlug"] = agent_slug
    if agent_name:
        args["agentName"] = agent_name
    if dominant_element:
        args["dominantElement"] = dominant_element
    if source:
        args["source"] = source
    return await call_tool_json(
        "submit_recipe_reflection",
        args,
        idempotency_key=idempotency_key,
    )


async def status(include_tools: bool = True) -> Dict[str, Any]:
    info = config_status()
    info["connected"] = _CLIENT.connected
    if not info["enabled"]:
        info["status"] = "disabled"
        return info

    try:
        if include_tools:
            info["tools"] = await list_tools()
        info["connected"] = _CLIENT.connected
        info["status"] = "ready"
    except Exception as exc:
        info["status"] = "unavailable"
        info["error"] = str(exc)
    return info


async def close_client() -> None:
    await _CLIENT.close()
