"""Phase 4 unit tests: Shared execution context, evidence snapshots,
bridge concurrency, child env sanitization, and telemetry drain.
"""

import asyncio
import json
import sys
import time
from unittest.mock import AsyncMock, MagicMock

import pytest

# Mock heavy optional ML / LLM dependencies if not present in the test environment
for _heavy_mod in [
    "rag",
    "providers",
    "ingest",
    "recipe_generation",
    "recipe_metrics",
    "tilt_skillet_generation",
    "pii_scrubber",
    "feed_emitter",
    "chromadb",
    "langchain",
    "llama_index",
    "torch",
    "sentence_transformers",
    "fastapi",
    "fastapi.responses",
    "fastapi.middleware.cors",
    "starlette.middleware.base",
]:
    if _heavy_mod not in sys.modules:
        sys.modules[_heavy_mod] = MagicMock()

import alchm_mcp
import main
import mcp_contracts
import mcp_invocation_log
from mcp_context import EvidenceSnapshot, ExecutionContext
import schemas


# ============================================================================
# 1. EvidenceSnapshot & ExecutionContext
# ============================================================================

def test_evidence_snapshot_creation_and_dict():
    sky = {"dominantElement": "Fire", "planets": {"Sun": {"sign": "Aries"}}}
    scan = {"dominantElement": "Water", "elements": {"Water": 0.8}}
    recipes = {"recipes": [{"name": "Cosmic Broth"}]}

    snapshot = EvidenceSnapshot.create(
        sky_transits=sky,
        alchemical_scan=scan,
        recipe_candidates=recipes,
        custom_tag="culinary-test",
    )

    assert snapshot.snapshot_id.startswith("ev_")
    assert snapshot.sky_transits == sky
    assert snapshot.alchemical_scan == scan
    assert snapshot.recipe_candidates == recipes
    assert snapshot.metadata == {"custom_tag": "culinary-test"}

    data = snapshot.to_dict()
    assert data["snapshotId"] == snapshot.snapshot_id
    assert data["skyTransits"] == sky
    assert data["alchemicalScan"] == scan
    assert data["recipeCandidates"] == recipes
    assert data["metadata"]["custom_tag"] == "culinary-test"


def test_execution_context_budget_and_headers():
    snapshot = EvidenceSnapshot.create(sky_transits={"dominantElement": "Air"})
    ctx = ExecutionContext(
        request_id="req_test_123",
        deadline_seconds=10.0,
        caller="test-suite",
        evidence_snapshot=snapshot,
    )

    assert ctx.request_id == "req_test_123"
    assert ctx.remaining_budget <= 10.0
    assert ctx.remaining_budget > 9.0
    assert not ctx.is_expired

    headers = ctx.correlation_headers()
    assert headers["X-Request-ID"] == "req_test_123"
    assert headers["X-Invocation-Caller"] == "test-suite"
    assert headers["X-Evidence-Snapshot-ID"] == snapshot.snapshot_id
    assert headers["X-Trace-ID"] == ctx.trace_id

    # Test expired budget
    expired_ctx = ExecutionContext(
        request_id="req_expired",
        deadline_seconds=0.01,
    )
    time.sleep(0.02)
    assert expired_ctx.is_expired
    assert expired_ctx.remaining_budget == 0.0


# ============================================================================
# 2. Child Process Environment Sanitization
# ============================================================================

def test_sanitized_child_env_strips_secrets(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-secret-key-12345")
    monkeypatch.setenv("SOLANA_PRIVATE_KEY", "[1,2,3,4,5]")
    monkeypatch.setenv("STRIPE_SECRET_KEY", "rk_live_99999")
    monkeypatch.setenv("GROQ_API_KEY", "gsk_secret")
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:pass@localhost:5432/alchm")
    monkeypatch.setenv("ALCHM_MCP_PORT", "8002")
    monkeypatch.setenv("ALCHM_MCP_TIMEOUT_SECONDS", "12")

    clean = alchm_mcp._sanitized_child_env()

    # Secrets must NOT be passed to child
    assert "OPENAI_API_KEY" not in clean
    assert "SOLANA_PRIVATE_KEY" not in clean
    assert "STRIPE_SECRET_KEY" not in clean
    assert "GROQ_API_KEY" not in clean

    # Allowed keys and prefixes must be retained
    assert clean.get("DATABASE_URL") == "postgresql://user:pass@localhost:5432/alchm"
    assert clean.get("ALCHM_MCP_PORT") == "8002"
    assert clean.get("ALCHM_MCP_TIMEOUT_SECONDS") == "12"
    assert "PATH" in clean


# ============================================================================
# 3. AlchmMCPClient Bridge Concurrency & Pipelined Requests
# ============================================================================

class MockPipeStream:
    def __init__(self):
        self._queue: asyncio.Queue[bytes] = asyncio.Queue()

    def feed(self, data: bytes):
        self._queue.put_nowait(data)

    async def readline(self) -> bytes:
        return await self._queue.get()


class MockStdin:
    def __init__(self):
        self.written: list[bytes] = []

    def write(self, data: bytes):
        self.written.append(data)

    async def drain(self):
        pass


@pytest.mark.asyncio
async def test_pipelined_stdout_dispatch_and_concurrency():
    client = alchm_mcp.AlchmMCPClient()
    mock_stdin = MockStdin()
    mock_stdout = MockPipeStream()

    class MockProc:
        def __init__(self):
            self.stdin = mock_stdin
            self.stdout = mock_stdout
            self.stderr = None
            self.returncode = None

    client._proc = MockProc()
    client._stdout_task = asyncio.create_task(client._drain_stdout())

    # Launch two concurrent requests
    task1 = asyncio.create_task(client._request("test_method_1", {"foo": "bar"}))
    task2 = asyncio.create_task(client._request("test_method_2", {"baz": "qux"}))

    # Give event loop a tick to send both requests
    await asyncio.sleep(0.01)

    assert len(mock_stdin.written) == 2
    req1 = json.loads(mock_stdin.written[0].decode("utf-8"))
    req2 = json.loads(mock_stdin.written[1].decode("utf-8"))

    id1, id2 = req1["id"], req2["id"]
    assert id1 != id2
    assert id1 in client._pending_requests
    assert id2 in client._pending_requests

    # Respond in REVERSE order out of sequence to prove pipelining
    mock_stdout.feed(json.dumps({"jsonrpc": "2.0", "id": id2, "result": {"ans": 2}}).encode("utf-8") + b"\n")
    mock_stdout.feed(json.dumps({"jsonrpc": "2.0", "id": id1, "result": {"ans": 1}}).encode("utf-8") + b"\n")

    res2 = await task2
    res1 = await task1

    assert res1 == {"ans": 1}
    assert res2 == {"ans": 2}
    assert len(client._pending_requests) == 0

    await client.close()


@pytest.mark.asyncio
async def test_request_timeout_cleans_pending_map():
    client = alchm_mcp.AlchmMCPClient()
    mock_stdin = MockStdin()
    mock_stdout = MockPipeStream()

    class MockProc:
        def __init__(self):
            self.stdin = mock_stdin
            self.stdout = mock_stdout
            self.stderr = None
            self.returncode = None

    client._proc = MockProc()
    client._stdout_task = asyncio.create_task(client._drain_stdout())

    with pytest.raises(alchm_mcp.AlchmMCPError, match="timed out"):
        await client._request("slow_method", timeout=0.05)

    assert len(client._pending_requests) == 0
    await client.close()


@pytest.mark.asyncio
async def test_client_close_fails_pending_requests():
    client = alchm_mcp.AlchmMCPClient()
    mock_stdin = MockStdin()
    mock_stdout = MockPipeStream()

    class MockProc:
        def __init__(self):
            self.stdin = mock_stdin
            self.stdout = mock_stdout
            self.stderr = None
            self.returncode = None

        def terminate(self):
            pass

        async def wait(self):
            return 0

    client._proc = MockProc()
    client._stdout_task = asyncio.create_task(client._drain_stdout())

    task = asyncio.create_task(client._request("hanging_method", timeout=10.0))
    await asyncio.sleep(0.01)

    await client.close()

    with pytest.raises(alchm_mcp.AlchmMCPError, match="closed|exited"):
        await task


# ============================================================================
# 4. _build_alchm_mcp_context Evidence Reuse
# ============================================================================

@pytest.mark.asyncio
async def test_build_alchm_mcp_context_reuses_preloaded_evidence(monkeypatch):
    # Ensure MCP hydration is enabled
    monkeypatch.setattr(alchm_mcp, "is_enabled", lambda: True)
    monkeypatch.setenv("ALCHM_MCP_HYDRATE_CHAT", "true")

    # Mocks that should NOT be called if evidence is preloaded
    mock_transits = AsyncMock(side_effect=AssertionError("Should not call get_live_sky_transits"))
    mock_alchemize = AsyncMock(side_effect=AssertionError("Should not call alchemize_ingredients"))
    mock_recipes = AsyncMock(side_effect=AssertionError("Should not call generate_cosmic_recipe"))

    monkeypatch.setattr(alchm_mcp, "get_live_sky_transits", mock_transits)
    monkeypatch.setattr(alchm_mcp, "alchemize_ingredients", mock_alchemize)
    monkeypatch.setattr(alchm_mcp, "generate_cosmic_recipe", mock_recipes)

    preloaded_sky = {"dominantElement": "Fire", "planets": {"Sun": {"sign": "Leo"}}}
    preloaded_scan = {"dominantElement": "Fire", "elements": {"Fire": 0.9}}
    preloaded_recipes = {"recipes": [{"name": "Preloaded Dragon Stew"}]}

    snapshot = EvidenceSnapshot.create(
        sky_transits=preloaded_sky,
        alchemical_scan=preloaded_scan,
        recipe_candidates=preloaded_recipes,
    )

    request = schemas.ChatRequest(
        agentId="socrates",
        message="Let's make a recipe with lentils and rosemary",
        context={
            "evidenceSnapshot": snapshot.to_dict(),
            "ingredients": ["lentils", "rosemary"],
        },
    )

    block, metadata = await main._build_alchm_mcp_context(request)

    assert metadata["evidenceSnapshotId"] == snapshot.snapshot_id
    assert "evidenceReused" in metadata
    assert set(metadata["evidenceReused"]) == {
        "get_live_sky_transits",
        "alchemize_ingredients",
        "generate_cosmic_recipe",
    }
    assert "Preloaded Dragon Stew" in block
    assert "Leo" in block

    mock_transits.assert_not_called()
    mock_alchemize.assert_not_called()
    mock_recipes.assert_not_called()


# ============================================================================
# 5. Telemetry Drain on Shutdown
# ============================================================================

@pytest.mark.asyncio
async def test_drain_and_close_awaits_inflight_writes():
    finished = []

    async def mock_write(idx: int):
        await asyncio.sleep(0.05)
        finished.append(idx)

    # Spawn 3 background writes in _INFLIGHT_WRITES
    task1 = asyncio.create_task(mock_write(1))
    task2 = asyncio.create_task(mock_write(2))
    task3 = asyncio.create_task(mock_write(3))

    mcp_invocation_log._INFLIGHT_WRITES.add(task1)
    mcp_invocation_log._INFLIGHT_WRITES.add(task2)
    mcp_invocation_log._INFLIGHT_WRITES.add(task3)

    task1.add_done_callback(mcp_invocation_log._INFLIGHT_WRITES.discard)
    task2.add_done_callback(mcp_invocation_log._INFLIGHT_WRITES.discard)
    task3.add_done_callback(mcp_invocation_log._INFLIGHT_WRITES.discard)

    assert len(mcp_invocation_log._INFLIGHT_WRITES) == 3

    await mcp_invocation_log.drain_and_close(timeout=1.0)

    assert len(finished) == 3
    assert set(finished) == {1, 2, 3}
    assert len(mcp_invocation_log._INFLIGHT_WRITES) == 0


# ============================================================================
# 6. Contract Validation for evidenceSnapshotId
# ============================================================================

def test_contracts_validate_evidence_snapshot_id():
    chat_payload = {
        "agentName": "Socrates",
        "agentId": "socrates",
        "text": "Virtue is knowledge.",
        "sessionId": "pa1.virtue",
        "evidenceSnapshotId": "ev_test_123456",
    }
    validated_chat = mcp_contracts.validate_result("chat_with_planetary_agent", chat_payload)
    assert validated_chat["evidenceSnapshotId"] == "ev_test_123456"

    debate_payload = {
        "ingredients": ["lentils"],
        "agents": ["Socrates"],
        "alchemicalScan": {},
        "recipeCandidates": {},
        "liveSkyState": None,
        "triggeredJing": None,
        "dataErrors": [],
        "dialogue": [chat_payload],
        "evidenceSnapshotId": "ev_debate_999888",
    }
    validated_debate = mcp_contracts.validate_result("synthesize_culinary_debate", debate_payload)
    assert validated_debate["evidenceSnapshotId"] == "ev_debate_999888"
