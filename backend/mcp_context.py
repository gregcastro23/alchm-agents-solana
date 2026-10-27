"""Execution context and evidence snapshot management for MCP requests.

Provides immutable evidence snapshots (sky transits, elemental balances,
ingredient kinetics, recipe candidates) that can be shared across multiple
agent turns or debate stances within an execution lifecycle.

Enforces execution budgets, cancellation tokens, and request correlation.
"""
from __future__ import annotations

import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class EvidenceSnapshot:
    """An immutable, server-created observation snapshot shared across tools/agents."""

    snapshot_id: str
    created_at: str
    sky_transits: Optional[Dict[str, Any]] = None
    alchemical_scan: Optional[Dict[str, Any]] = None
    recipe_candidates: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @classmethod
    def create(
        cls,
        sky_transits: Optional[Dict[str, Any]] = None,
        alchemical_scan: Optional[Dict[str, Any]] = None,
        recipe_candidates: Optional[Dict[str, Any]] = None,
        **metadata: Any,
    ) -> EvidenceSnapshot:
        return cls(
            snapshot_id=f"ev_{uuid.uuid4().hex[:12]}",
            created_at=datetime.now(timezone.utc).isoformat(),
            sky_transits=sky_transits,
            alchemical_scan=alchemical_scan,
            recipe_candidates=recipe_candidates,
            metadata=dict(metadata),
        )

    def to_dict(self) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "snapshotId": self.snapshot_id,
            "createdAt": self.created_at,
        }
        if self.sky_transits is not None:
            data["skyTransits"] = self.sky_transits
        if self.alchemical_scan is not None:
            data["alchemicalScan"] = self.alchemical_scan
        if self.recipe_candidates is not None:
            data["recipeCandidates"] = self.recipe_candidates
        if self.metadata:
            data["metadata"] = self.metadata
        return data


@dataclass
class ExecutionContext:
    """Context spanning a single MCP tool execution or multi-agent interaction."""

    request_id: str
    started_at: float = field(default_factory=time.monotonic)
    deadline_seconds: float = 45.0
    caller: Optional[str] = None
    api_key_id: Optional[str] = None
    user_id: Optional[str] = None
    auth_tier: str = "anonymous"
    evidence_snapshot: Optional[EvidenceSnapshot] = None
    trace_id: str = field(default_factory=lambda: f"trace_{uuid.uuid4().hex[:16]}")

    @property
    def remaining_budget(self) -> float:
        elapsed = time.monotonic() - self.started_at
        return max(0.0, self.deadline_seconds - elapsed)

    @property
    def is_expired(self) -> bool:
        return self.remaining_budget <= 0.0

    def correlation_headers(self) -> Dict[str, str]:
        headers: Dict[str, str] = {
            "X-Request-ID": self.request_id,
            "X-Trace-ID": self.trace_id,
        }
        if self.caller:
            headers["X-Invocation-Caller"] = self.caller
        if self.evidence_snapshot:
            headers["X-Evidence-Snapshot-ID"] = self.evidence_snapshot.snapshot_id
        return headers
