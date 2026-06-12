# WTEN — Ship Item 4: cross-server MCP admin panel

**Where to run this:** the WTEN project root (the `WhatToEatNext` repo, not `planetary_agents`).
**Why this exists:** PA shipped [`/api/admin/mcp-summary`](https://github.com/gregcastro23/alchm-agents-app/pull/4) — the windowed-telemetry aggregator that this session was blocked on. PR is merged; the migration that adds `mcp_invocations` is applied to prod. The WTEN-side admin panel that consumes it is the last open item of Phase 3.

**Prior WTEN work (do NOT redo):**

- ✅ [gregcastro23/WhatToEatNext#462](https://github.com/gregcastro23/WhatToEatNext/pull/462) is merged. WTEN has its own `mcp_invocations` table and `agentTelemetryService.ts`. Items 1–3 + 5 of Phase 3 already shipped.
- ✅ The internal-secret cross-project convention exists: WTEN's `/api/admin/agent-sync` proxy already calls PA with `X-Internal-Secret` headers. The new fetcher should reuse that pattern (proxy through Next API, not a direct browser call to PA).
- ✅ Phase 3 closing notes are in `NEXT_SESSION_PROMPT_MCP_PHASE_3_INFRA.md` — Item 4 is the only piece left.

## ⚠️ Pre-flight: verify the PA endpoint is actually live

The PA PR is merged but the Railway deploy from the PA session **failed three times** (stuck in "scheduling build" before image build started — root cause not visible from the CLI, needs Railway dashboard inspection at `https://railway.com/project/79c2e926-15f1-49a1-88ee-8c3870adcc8f`). The May 25 PA deploy is still serving traffic, which means **`/api/admin/mcp-summary` may still return 404 in prod** even though the code is on `main`.

Before doing any WTEN work, run:

```bash
# This is the secret WTEN already has — should be in WTEN's env as INTERNAL_API_SECRET
# (the same value as PA's PA_INTERNAL_API_SECRET, set on 2026-05-27)
curl -s -o /dev/null -w "%{http_code}\n" \
  "https://api.agents.alchm.kitchen/api/admin/mcp-summary?windowMinutes=60" \
  -H "X-Internal-Secret: $INTERNAL_API_SECRET"
```

- `200` → endpoint is live, proceed
- `404` → PA deploy still hasn't gone through; **stop and fix the PA Railway deploy first**, then come back. Building the WTEN side against a 404 will mask real bugs.
- `401` → secret mismatch; check that WTEN's `INTERNAL_API_SECRET` env var matches PA's `PA_INTERNAL_API_SECRET` (mirrored on 2026-05-27, sha256 fingerprint `739ce4e79e63`)

---

## What WTEN needs to build

Three files. The first is the data fetcher (proxy + client), the second is the page, the third is a one-row addition to the existing system status probe.

### 1. `src/services/mcpNetworkService.ts` — fetcher

Sibling to the existing `src/services/agentTelemetryService.ts`. Responsibilities:

- A typed client function `getMcpNetworkSummary(windowMinutes?: number): Promise<McpNetworkSummary>`
- Calls **WTEN's** own Next API proxy (not PA directly — the browser can't reach `api.agents.alchm.kitchen` with the internal secret)
- On any failure (timeout, network, 5xx, PA 401, JSON parse error) **must** return `{ live: false, ...stale }` rather than throw. Admin operators viewing the page should see a "PA degraded" banner, not a thrown error
- Caches the last successful response in module scope for ~30s so concurrent component mounts don't hammer the proxy

You'll also need the proxy route. Mirror the existing admin-sync proxy pattern (`src/app/api/admin/agent-sync/route.ts`) — likely create `src/app/api/admin/mcp-summary/route.ts` that:

- Requires WTEN admin auth (the same gate as `/admin/mcp` route)
- Calls `${PA_BACKEND_URL}/api/admin/mcp-summary?windowMinutes=...` with `X-Internal-Secret: ${INTERNAL_API_SECRET}`
- 10s server-side fetch timeout (`AbortSignal.timeout(10_000)`)
- Forwards the JSON body verbatim on 200, returns `{ live: false, error: "pa_unreachable" }` on non-200

### 2. `src/app/admin/mcp/page.tsx` — admin page

Three tabs (use the existing Radix/shadcn Tabs primitive already in `src/components/ui/tabs.tsx`):

| Tab          | Source                                        | Content                                                                                                                                                 |
| ------------ | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Network**  | `summary.totals`, `summary.byTool`            | Top: 4 stat cards (`calls`, `errorRate`, `p95LatencyMs`, `verdict` chip). Below: byTool table with `tool`, `calls`, `failures`, `p95LatencyMs` columns. |
| **Personas** | `summary.byAgent`                             | Top-10 agents table with `agentId`, `calls`, and a stacked-bar visualisation of `modelTierMix` (free / cheap_fast / primary / reflective).              |
| **Quotas**   | `summary.byCaller` + `summary.syntheticProbe` | Top-10 callers table on the left. Right side: synthetic probe card (verdict chip, `lastCalledAt` relative time, `consecutiveFailures`).                 |

Polling: re-fetch every 30s via `setInterval` in a client component, cleared on unmount. Show a header bar with `verdict` chip + "Last refreshed N seconds ago". When `live: false`, dim the page and overlay a "PA telemetry stale" banner.

### 3. `src/services/systemStatusService.ts` — extend `probeMcp()`

The existing `probeMcp()` is what powers WTEN's top-level system status indicator. Currently it probes WTEN's own MCP. Extend it with a second dependency row for PA MCP:

```ts
const paStatus = await getMcpNetworkSummary().catch(() => null)
const paVerdict = paStatus?.live ? paStatus.verdict : 'UNKNOWN'

return [
  // existing WTEN MCP row
  { name: 'WTEN MCP', verdict: wtenVerdict, ... },
  // NEW row
  { name: 'PA MCP', verdict: paVerdict, latencyMs: paStatus?.totals.p95LatencyMs, ... },
]
```

The verdict taxonomy (`OK`/`DEGRADED`/`INCIDENT`/`UNKNOWN`) is identical on both sides — pass it through unchanged so a single status pill in the top nav represents the worst of both servers.

---

## The PA endpoint contract (verbatim — define WTEN types from this)

```jsonc
GET https://api.agents.alchm.kitchen/api/admin/mcp-summary?windowMinutes=60
Headers:
  X-Internal-Secret: <PA_INTERNAL_API_SECRET>     // already mirrors INTERNAL_API_SECRET

200 OK:
{
  "live": true,
  "generatedAt": "2026-05-27T16:00:00.000Z",
  "windowMinutes": 60,
  "verdict": "OK" | "DEGRADED" | "INCIDENT" | "UNKNOWN",
  "totals": {
    "calls": 142,
    "success": 138,
    "failures": 4,
    "errorRate": 0.028,
    "p50LatencyMs": 87,
    "p95LatencyMs": 412,
    "p99LatencyMs": 1180
  },
  "byTool": [
    { "tool": "chat_with_planetary_agent", "calls": 110, "failures": 2, "p95LatencyMs": 380 }
  ],
  "byAgent": [
    { "agentId": "socrates", "calls": 42, "modelTierMix": { "free": 30, "primary": 10, "reflective": 2 } }
  ],
  "byCaller": [
    { "caller": "claude-desktop", "calls": 65 }
  ],
  "syntheticProbe": {
    "verdict": "OK" | "DEGRADED" | "INCIDENT" | "UNKNOWN",
    "lastCalledAt": "2026-05-27T15:55:00.000Z" | null,
    "lastSuccess": true | null,
    "consecutiveFailures": 0
  }
}
```

Type definitions to drop into `src/services/mcpNetworkService.ts`:

```ts
export type McpVerdict = 'OK' | 'DEGRADED' | 'INCIDENT' | 'UNKNOWN'

export interface McpNetworkSummary {
  live: boolean
  generatedAt: string
  windowMinutes: number
  verdict: McpVerdict
  totals: {
    calls: number
    success: number
    failures: number
    errorRate: number
    p50LatencyMs: number | null
    p95LatencyMs: number | null
    p99LatencyMs: number | null
  }
  byTool: Array<{
    tool: string
    calls: number
    failures: number
    p95LatencyMs: number | null
  }>
  byAgent: Array<{
    agentId: string
    calls: number
    modelTierMix: Record<string, number>
  }>
  byCaller: Array<{ caller: string; calls: number }>
  syntheticProbe: {
    verdict: McpVerdict
    lastCalledAt: string | null
    lastSuccess: boolean | null
    consecutiveFailures: number
  }
}
```

### Verdict reference (mirror in WTEN status pill colours)

| Verdict    | Rule                                                                          | Pill colour |
| ---------- | ----------------------------------------------------------------------------- | ----------- |
| `OK`       | `errorRate < 1%` AND synthetic probe healthy                                  | green       |
| `DEGRADED` | `errorRate ∈ [1%, 5%)` OR `p95LatencyMs > 2000` OR synthetic probe `DEGRADED` | yellow      |
| `INCIDENT` | `errorRate ≥ 5%` OR synthetic probe `INCIDENT` (≥2 of last 4 probes failed)   | red         |
| `UNKNOWN`  | `calls == 0` AND no synthetic probe in the last 2 hours                       | grey        |

---

## Empty-state UX (important — likely your reality on day one)

PA's `mcp_invocations` table was JUST created on 2026-05-27 (the migration was missing from the original instrumentation PR). For some window of time after the PA deploy lands, the table will have very few rows — most likely just synthetic-probe entries from the cron at `/api/cron/synthetic-mcp-probe`. Expect:

- `verdict: "UNKNOWN"` initially (because `calls == 0` and no recent probe)
- Empty `byTool`, `byAgent`, `byCaller` arrays
- All `p*LatencyMs` values `null`

Design the page so this state isn't a broken-looking blank. A "No MCP traffic in the last 60 minutes" message + a hint to widen the window via a `?windowMinutes=` URL param (cap at 1440 = 24h) is enough.

---

## Test plan

- [ ] **Pre-flight** — `curl` the PA endpoint and confirm 200 before writing any WTEN code (see Pre-flight section above)
- [ ] Unit-test `getMcpNetworkSummary()` with mocked fetch: 200 → typed object, 5xx → `{ live: false }`, network error → `{ live: false }`, timeout → `{ live: false }`
- [ ] Integration: load `/admin/mcp` as an admin, verify the three tabs render and re-fetch every 30s (DevTools → Network → repeating request to the proxy)
- [ ] Force a `live: false` state by setting `INTERNAL_API_SECRET=wrong` in `.env.local` — page should show the stale banner, not throw
- [ ] Extend system status: verify the top-nav pill turns yellow when PA returns `verdict: DEGRADED` and green when `OK`
- [ ] Cross-browser layout sanity (the tab content is data-heavy)

## PR shape

Single PR. Title: `feat(admin): cross-server MCP admin panel consuming PA's mcp-summary`

Body sections:

- **Summary** — what landed + which PA PR it consumes (link to [alchm-agents-app#4](https://github.com/gregcastro23/alchm-agents-app/pull/4))
- **Screenshots** — Network / Personas / Quotas tabs, and the system-status pill with PA degraded
- **Test plan** — checklist from above
- **Out of scope** — Personas tab persona-level drill-down (link to PA agents); Quotas tab rate-limit drill-down. Those are follow-ups.

---

## Out of scope for this session

- **Modifying PA** — the PA endpoint contract is fixed by [alchm-agents-app#4](https://github.com/gregcastro23/alchm-agents-app/pull/4). If you discover a missing field mid-implementation, file a follow-up issue on `alchm-agents-app` rather than blocking this PR.
- **The PA Railway deploy failure** — if pre-flight returns 404, surface it to the user but don't try to deploy PA from the WTEN session. That's a separate triage.
- **`agent_telemetry` ↔ `mcp_invocations` reconciliation** — WTEN's local `mcp_invocations` table tracks WTEN-side dispatches; PA's tracks PA-side. They don't (yet) cross-fill. Parked per the original Phase 3 prompt.

---

## Cold-start context

- **Endpoint registry** (per WTEN's `CLAUDE.md`):
  - `alchm.kitchen` — WTEN Next.js frontend (this is where `/admin/mcp` will live)
  - `whattoeatnext-production.up.railway.app` — WTEN backend
  - `agents.alchm.kitchen` — PA Next.js UI
  - **`api.agents.alchm.kitchen`** — PA Python/FastAPI backend (the endpoint this session consumes)
- **Why a proxy instead of direct browser → PA?** PA's `X-Internal-Secret` is a server-side credential. Putting it in the browser would leak it to every admin user's network tab. The proxy pattern (server-side fetch with the secret, return JSON to the client) is how `/api/admin/agent-sync` already works — mirror that.
- **Why three tabs and not one wide page?** The byAgent and byCaller arrays each cap at 10 entries on the PA side, but each tab focuses a different operator workflow (Network = "is PA healthy", Personas = "which agents are people using", Quotas = "who's hammering it"). Splitting them keeps each tab scannable.

---

_Drafted 2026-05-27 by the PA session that shipped [alchm-agents-app#4](https://github.com/gregcastro23/alchm-agents-app/pull/4). The PA-side schema is migrated; only the WTEN UI remains for Item 4._
