# PA — Ship `/api/admin/mcp-summary` for the WTEN Cross-Server Admin Panel

**Where to run this:** `/Users/cookingwithcastro/Desktop/planetary_agents-main`
**Why this exists:** WTEN Phase 3 (PR [gregcastro23/WhatToEatNext#462](https://github.com/gregcastro23/WhatToEatNext/pull/462), merged 2026-05-27) is blocked on this endpoint for **Item 4 — cross-server admin panel**. Until PA ships `/api/admin/mcp-summary`, WTEN's `/admin/mcp` page can't render the Network / Personas / Quotas tabs.

**Prior PA work (do NOT redo):**

- ✅ `feat/mcp-instrumentation` already merged into `main` (commit `e620d571`). PA has:
  - `mcp_invocations` table (Prisma)
  - `backend/mcp_invocation_log.py` (fire-and-forget recorder)
  - `POST /api/cron/synthetic-mcp-probe` (FastAPI cron)
  - `GET /api/admin/mcp-status` (latest probe verdict)
  - `backend/README_MCP.md` + connector configs
- ✅ WTEN-side `NEXT_SESSION_PROMPT_PA_MCP_INSTRUMENTATION.md` (the original 6-item mirror pass) is fully delivered.

This session is the _next_ PA-side piece: a fatter aggregator endpoint that WTEN's admin dashboard pulls every 30s.

---

## What WTEN expects to consume

WTEN ships a `src/services/mcpNetworkService.ts` (sibling to `agentTelemetryService.ts`) whose `getMcpNetworkSummary()` will hit:

```
GET https://api.agents.alchm.kitchen/api/admin/mcp-summary?windowMinutes=60
Headers:
  X-Internal-Secret: <PA_INTERNAL_API_SECRET>          ← same shape as existing admin-sync proxy
```

The contract WTEN needs (define it here, on the PA side, so the proxy is just a passthrough):

```jsonc
{
  "live": true,
  "generatedAt": "2026-05-27T16:00:00.000Z",
  "windowMinutes": 60,
  "verdict": "OK" | "DEGRADED" | "INCIDENT" | "UNKNOWN",
  "totals": {
    "calls": 142,
    "success": 138,
    "failures": 4,
    "errorRate": 0.028,                 // failures / calls, 0 when calls==0
    "p50LatencyMs": 87,
    "p95LatencyMs": 412,
    "p99LatencyMs": 1180
  },
  "byTool": [
    { "tool": "chat_with_planetary_agent", "calls": 110, "failures": 2, "p95LatencyMs": 380 },
    { "tool": "synthesize_culinary_debate", "calls": 12, "failures": 1, "p95LatencyMs": 1180 },
    { "tool": "get_agent_feed_discussion", "calls": 20, "failures": 1, "p95LatencyMs": 95 }
  ],
  "byAgent": [                           // top 10 by call volume, agentId-keyed
    { "agentId": "socrates", "calls": 42, "modelTierMix": { "free": 30, "primary": 10, "reflective": 2 } },
    { "agentId": "thales",   "calls": 28, "modelTierMix": { "free": 18, "primary": 10 } }
  ],
  "byCaller": [                          // top 10 callers (free-form tag from _meta.caller)
    { "caller": "claude-desktop", "calls": 65 },
    { "caller": "cursor", "calls": 50 },
    { "caller": "pa-mcp", "calls": 17 },
    { "caller": "synthetic-probe", "calls": 10 }
  ],
  "syntheticProbe": {                    // mirror the existing /api/admin/mcp-status verdict
    "verdict": "OK" | "DEGRADED" | "INCIDENT" | "UNKNOWN",
    "lastCalledAt": "2026-05-27T15:55:00.000Z",
    "lastSuccess": true,
    "consecutiveFailures": 0
  }
}
```

**Verdict rules** (mirror WTEN's `systemStatusService` taxonomy):

- `OK`: errorRate < 1% AND synthetic probe healthy
- `DEGRADED`: errorRate 1–5% OR p95 > 2000ms OR synthetic probe DEGRADED
- `INCIDENT`: errorRate ≥ 5% OR synthetic probe INCIDENT (latest 2 of 4 probes failed)
- `UNKNOWN`: `calls == 0` AND no synthetic probe in the last 2 hours

**Window**: default 60min, accept `windowMinutes` query in [5, 1440]. Cap query scope so a misconfigured caller can't ask for "last 30 days".

---

## What to build

### 1. Endpoint scaffold

- **File**: extend `backend/main.py` with `GET /api/admin/mcp-summary`
- **Auth**: read `X-Internal-Secret` header, compare against `PA_INTERNAL_API_SECRET` env var via `secrets.compare_digest`. 401 on mismatch / missing. Match the pattern WTEN uses for cross-project calls (it sets `X-Internal-Secret` on its admin-sync proxy).
- **Query param**: `windowMinutes: int = Query(default=60, ge=5, le=1440)`
- **Response model**: define a Pydantic `McpSummaryResponse` so OpenAPI documents the contract. Reuse the `MCPInvocation` ORM model from `models.py`.

### 2. Aggregation SQL

One query is fine if PA's `mcp_invocations` is well-indexed; otherwise three small queries with `Promise.allSettled`-style isolation (each component degrades independently to `null` rather than failing the whole endpoint).

- `totals`: single SELECT with `COUNT(*) FILTER`, `PERCENTILE_DISC` (or `PERCENTILE_CONT`) for p50/p95/p99
- `byTool`: `GROUP BY tool_name` with the same percentile aggregate per group
- `byAgent`: `GROUP BY agent_id` with `jsonb_object_agg(model_tier, count)` for the tier mix; `WHERE agent_id IS NOT NULL`; `LIMIT 10`
- `byCaller`: `GROUP BY caller`, `LIMIT 10`

Cap the window's row scan by adding `WHERE called_at >= now() - (interval '1 minute' * :window_minutes)`. With the `(tool_name, called_at DESC)` index from the original PR, this stays sub-100ms even at 10k rows/hour.

### 3. Synthetic-probe verdict

Read the latest 4 rows where `caller = 'synthetic-probe'` ordered by `called_at DESC`. Verdict:

- `OK`: latest row success=true AND called_at within last 60min
- `DEGRADED`: latest row stale (>60min) — cron may be broken
- `INCIDENT`: 2+ of last 4 failed
- `UNKNOWN`: no probe rows ever

Extract this into a `_compute_synthetic_verdict(db)` helper so `/api/admin/mcp-status` and `/api/admin/mcp-summary` share the logic.

### 4. Caching (10s, in-process)

WTEN polls every 30s; multiple admin operators could amplify that. Cache the response body in-process for 10s keyed by `windowMinutes`. Use the same `functools.lru_cache` + TTL pattern PA already uses in `backend/main.py` (search for existing cache decorators). If no pattern exists, write a tiny `_summary_cache: dict[int, tuple[float, dict]] = {}` and a `_get_or_compute(window_minutes)` helper.

### 5. Tests

- `backend/tests/test_admin_mcp_summary.py`:
  - Empty DB → verdict UNKNOWN, totals.calls==0
  - 100 rows all success → verdict OK, errorRate==0
  - 10 failures of 100 → verdict INCIDENT (10% > 5% threshold)
  - 2 of 100 failures → verdict OK (still under 1% threshold... actually 2% ≥ 1%, so DEGRADED — verify the boundary)
  - Wrong/missing `X-Internal-Secret` → 401
  - `windowMinutes` out of range → 422
  - `byAgent` excludes rows with NULL `agent_id`
- Stub `MCPInvocation` rows via SQLAlchemy session fixture; do NOT spin up real Postgres in pytest (use the existing in-memory SQLite fallback if PA's test config supports it; otherwise mock the DB session).

### 6. Documentation

- Append a "Cross-server consumption" section to `backend/README_MCP.md` documenting the endpoint, the contract, and the `X-Internal-Secret` requirement.
- Add the endpoint to whichever OpenAPI doc PA publishes (FastAPI auto-generates `/docs`; ensure the new endpoint is tagged `admin`).

---

## How to start

```bash
cd /Users/cookingwithcastro/Desktop/planetary_agents-main
git fetch origin
git checkout -b feat/admin-mcp-summary origin/main
# Inspect the existing /api/admin/mcp-status (backend/main.py:1661) as the model.
grep -n "mcp-status\|MCPInvocation\|PA_INTERNAL_API_SECRET\|secrets.compare_digest" backend/main.py
```

Likely PA already has an admin-secret helper somewhere — reuse it instead of rolling a new one. If `PA_INTERNAL_API_SECRET` doesn't exist as an env var yet, add it to PA's Railway service variables and to the `.env.example` so the next deploy provisions it.

---

## Verification before opening the PR

- `pytest backend/tests/test_admin_mcp_summary.py` — green
- Hit the endpoint manually with the secret, confirm the JSON matches the contract above (use `curl -H 'X-Internal-Secret: $PA_INTERNAL_API_SECRET' https://api.agents.alchm.kitchen/api/admin/mcp-summary?windowMinutes=60 | jq`)
- Hit with wrong secret → 401
- Hit with `windowMinutes=99999` → 422
- Run for 30+ minutes on prod traffic and confirm `p95LatencyMs` looks sane (not exploding into the seconds)
- `cd backend && ruff check .` — clean

---

## PR shape

Single PR, title pattern: `feat(admin): /api/admin/mcp-summary aggregator for WTEN cross-server panel`

Body sections:

- **Summary** — what landed + which WTEN PR consumes it
- **Contract** — paste the JSON shape (verbatim)
- **Verdict rules** — reference `systemStatusService` taxonomy for parity
- **Test plan** — pytest cases + manual curl steps
- **Operational notes** — caching strategy, query cost estimate, dependency on `PA_INTERNAL_API_SECRET` env

Link the PR back to [gregcastro23/WhatToEatNext#462](https://github.com/gregcastro23/WhatToEatNext/pull/462) so the WTEN-side reviewer can verify the contract round-trips.

---

## After this merges — WTEN side handoff

The WTEN session should then ship Item 4 of `NEXT_SESSION_PROMPT_MCP_PHASE_3_INFRA.md`:

- `src/services/mcpNetworkService.ts` — fetcher that calls this endpoint via the existing admin-sync proxy (`POST /api/admin/agent-sync` pattern) + degrades to `live: false` on PA-side outage
- `src/app/admin/mcp/page.tsx` — three tabs: Network / Personas / Quotas
- `src/services/systemStatusService.ts` `probeMcp()` — extend with a new dependency row for "PA MCP" using this endpoint's `verdict` field

Do NOT pre-build the WTEN side from PA — keep the two repos' work in lockstep but separate PRs.

---

## Out of scope for this session

- **`mcp_invocations` schema changes** — the v1 contract above is satisfiable by the existing schema. If you discover a missing column mid-implementation, ship the migration in a tiny separate PR before this one.
- **Cross-DB reconciliation** — the `caller='pa-mcp'` rows in WTEN's `mcp_invocations` are not mirrored into PA's table. That's still parked as a follow-up per `NEXT_SESSION_PROMPT_PA_MCP_INSTRUMENTATION.md`.
- **PA-side PgBouncer / connection pooling** — WTEN just deployed PgBouncer for the alchm.kitchen Railway project (Phase 3 Item 2A); PA's Railway project is independent and not affected. If PA shows similar slow-query symptoms, file a separate session prompt mirroring the WTEN approach.
- **Auth unification between PA `ApiKey` and WTEN `api_keys`** — orthogonal. The admin-summary endpoint uses the internal-secret pattern, not user API keys.
- **The Desktop MCP work** in `NEXT_SESSION_PROMPT_DESKTOP_MCP.md` — separate scope.

---

## Cold-start context

- **Project URLs** (per WTEN's `CLAUDE.md` "Endpoint registry"):
  - `agents.alchm.kitchen` — PA Next.js UI
  - **`api.agents.alchm.kitchen`** — PA Python/FastAPI backend (this is where `/api/admin/mcp-summary` lives)
  - `whattoeatnext-production.up.railway.app` — WTEN backend
  - `alchm.kitchen` — WTEN Next.js frontend (consumes this endpoint via its admin-sync proxy)
- **Why two MCP servers?** See `backend/README_MCP.md` and the WTEN side's `mcp-server/ARCHITECTURE.md`. WTEN's MCP exposes alchemical tools; PA's MCP exposes persona dialogue + culinary debate. They cross-call each other via `backend/alchm_mcp.py` on the PA side.
- **Why this endpoint instead of just exposing the table?** WTEN can't query PA's Postgres directly — different Railway project, different network. The HTTP boundary + internal-secret pattern is the existing cross-project sync convention.

---

_Drafted 2026-05-27 by the WTEN Phase 3 closing session. WTEN PR #462 merged; WTEN-side Item 4 will land once this PA PR ships._
