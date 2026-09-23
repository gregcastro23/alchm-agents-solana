"""In-process latency window for /api/generate-recipe.

Every generation outcome the recipe waterfall logs (`recipe_waterfall hit=...`)
is also kept here, so /api/admin/recipe-latency can report p50 / p95 and the
error rate without a log pipeline. It is per process and resets on deploy or
restart — the summary says since when it has been counting, and the admin page
shows that instead of pretending to a longer history.
"""

from __future__ import annotations

import math
import threading
import time
from collections import deque
from typing import Deque, Dict, List, Optional, Tuple

MAX_SAMPLES = 5000
PROCESS_STARTED_AT = time.time()

# (unix_ts, total_ms, outcome, tier, provider)
_samples: Deque[Tuple[float, float, str, str, Optional[str]]] = deque(maxlen=MAX_SAMPLES)
_lock = threading.Lock()

OUTCOMES = ("generated", "cache", "error")


def record(total_ms: float, outcome: str, tier: str, provider: Optional[str] = None) -> None:
    """Record one outcome. Never raises."""
    try:
        with _lock:
            _samples.append((time.time(), float(total_ms), outcome, tier, provider))
    except Exception:  # noqa: BLE001 - metrics must never break a request
        pass


def _percentile(values: List[float], p: float) -> Optional[float]:
    """Nearest-rank percentile; None for an empty sample."""
    if not values:
        return None
    ordered = sorted(values)
    rank = max(1, math.ceil(p / 100 * len(ordered)))
    return round(ordered[min(rank, len(ordered)) - 1], 1)


def summary(window_seconds: int, now: Optional[float] = None) -> Dict[str, object]:
    now = time.time() if now is None else now
    since = now - window_seconds
    with _lock:
        rows = [s for s in _samples if s[0] >= since]

    generated = [ms for (_, ms, outcome, _, _) in rows if outcome == "generated"]
    errors = [ms for (_, ms, outcome, _, _) in rows if outcome == "error"]
    cache_hits = sum(1 for r in rows if r[2] == "cache")
    attempts = len(generated) + len(errors)

    by_provider: Dict[str, Dict[str, object]] = {}
    for (_, ms, outcome, _, provider) in rows:
        if outcome != "generated":
            continue
        entry = by_provider.setdefault(provider or "unknown", {"count": 0, "_ms": []})
        entry["count"] = int(entry["count"]) + 1
        entry["_ms"].append(ms)  # type: ignore[union-attr]
    providers = {
        name: {"count": e["count"], "p50Ms": _percentile(e["_ms"], 50), "p95Ms": _percentile(e["_ms"], 95)}  # type: ignore[arg-type]
        for name, e in by_provider.items()
    }

    return {
        "windowSeconds": window_seconds,
        # Counting started at the later of the window start and the process start.
        "countingSince": max(since, PROCESS_STARTED_AT),
        "processStartedAt": PROCESS_STARTED_AT,
        "requests": len(rows),
        "generated": len(generated),
        "cacheHits": cache_hits,
        "errors": len(errors),
        # Share of generation attempts (cache hits excluded) that failed.
        "errorRate": (len(errors) / attempts) if attempts else None,
        "p50Ms": _percentile(generated, 50),
        "p95Ms": _percentile(generated, 95),
        "maxMs": round(max(generated), 1) if generated else None,
        "byProvider": providers,
    }


def reset_for_tests() -> None:
    with _lock:
        _samples.clear()
