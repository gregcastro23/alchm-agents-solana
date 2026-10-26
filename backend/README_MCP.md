# Planetary Agents MCP Server

## Typed contracts and SDK transport (Phase 3)

The stdio transport uses the official Python SDK, pinned to `mcp==2.3.0`.
This project requires Python 3.11+. The SDK serves modern `2026-07-28`
`server/discover` requests and legacy initialization on the same transport;
changing `PLANETARY_AGENTS_MCP_PROTOCOL_VERSION` does not select its wire behavior.
The desktop probes discovery and falls back to legacy initialization only after
an unsupported-method response.

All nine tools advertise Pydantic-generated `inputSchema` and `outputSchema`.
Arguments are bounded and validated before identity lookup or provider work.
Successful results are validated and returned as both `structuredContent` and
identical JSON text for older clients. Tool execution/output failures retain
`isError`; malformed arguments return an invalid-parameters error.

Standard tool metadata is `params._meta`. Existing `params.arguments._meta`
credentials remain supported. Conflicting credential values are rejected;
only the normalized API key and bounded `caller` metadata reach the invocation
boundary. Protocol and arbitrary metadata are not copied into telemetry.

Install the locked sidecar runtime from the repository root, then run the source
server or build with the separately pinned PyInstaller version:

```bash
python -m pip install --require-hashes -r backend/requirements-mcp.lock
python -m pip install "pyinstaller==6.22.3"
python backend/mcp_smoke.py --python backend/planetary_agents_mcp_server.py
```

The smoke harness uses disposable local storage and no model/publication calls.
It checks discovery/legacy initialization, all nine schemas, local resources and
prompts, argument rejection, structured/text equivalence, and EOF shutdown.
Release CI runs it against each native frozen binary. `PA_MCP_DATA_DIR` can select
an isolated telemetry directory for frozen runtime checks.

See the [Phase 3 verification record](../docs/development/mcp-phase3-2026-10-17.md)
for the tested compatibility matrix and remaining Phase 4/5 work.

## Identity, private conversations, and publication

The server now exposes nine tools, including the separate `publish_weekly_menu`
operation. Configure a client credential with `PA_MCP_API_KEY`, or pass the
standard `params._meta.apiKey` field on a tool call (the legacy argument location also works). The backend verifies the credential
through `/api/mcp/identity` and verifies it again when chat executes; the local
sidecar database is not the source of cloud entitlements. Expired and revoked
keys cannot identify a user or request privileged model tiers.

`chat_with_planetary_agent` accepts an optional `sessionId`. Omit it to start a
conversation, then pass the returned handle to continue it. The backend signs
handles and binds them to the verified user (or operator key) and agent. Raw
client IDs are scoped to that owner. Anonymous raw IDs start fresh conversations;
an anonymous signed handle acts as an unguessable bearer capability for resuming
that conversation. Keep handles private. Set `CHAT_SESSION_SIGNING_SECRET` to a
stable server-side secret, or use the existing `INTERNAL_API_SECRET` fallback.
Rotating the signing secret invalidates previous handles.

Chats default to private feed visibility. Only `context.visibility: "public"`
permits publishing chat excerpts; `context.isPrivate: true` overrides that choice.
Desktop chat sends private visibility explicitly. Server-to-server chat callers
authenticate with `INTERNAL_API_SECRET` and must derive forwarded `userId` from
their verified session. Public callers cannot assert another user's identity.

`plan_weekly_menu` returns an unpublished draft without saving it or sharing to the feed. It rejects `status: "completed"` and
`shareToFeed: true`. To publish a reviewed draft, call `publish_weekly_menu` with
`menu` and a stable `idempotencyKey` of 1–200 visible ASCII characters. Publishing
requires a verified admin/operator/alchemist role or the configured
`PA_USER_API_KEY` operator credential on the publication service. An ordinary
account's access to enhanced model tiers does not grant publishing permission.

Publication is reserved in the existing event ledger before the external write.
The same actor, key, and payload replay a confirmed result; a changed payload or
an uncertain in-flight outcome returns a conflict without dispatching again.
After an uncertain outcome, verify the remote menu before submitting a different
key. Both `/api/menu-planner/publish` and the legacy weekly POST enforce this
boundary. `INTERNAL_API_SECRET` is a backend service credential and must remain
outside browser and model-supplied context.

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server exposing persona chat, agent discovery, feed retrieval, debates, minigames, menu planning, and guarded publication to MCP clients.

---

## Tools

| Tool                               | Cost / Gating      | Description                                                                                              |
| ---------------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `chat_with_planetary_agent`        | Free-to-reflective | Converse with a configured Planetary Agents persona. Gated by API key level.                             |
| `get_agent_feed_discussion`        | Free               | Retrieve a thread or feed event by ID from the Planetary Agents feed.                                    |
| `synthesize_culinary_debate`       | Premium            | Ask multiple personas to debate ingredients. Anonymous/standard keys degrade to a single-persona stance. |
| `list_planetary_agents`            | Free               | Discover configured personas and archetypes.                                                             |
| `trigger_chart_specific_jing_duel` | Tier gated         | Generate a chart-grounded elemental interaction.                                                         |
| `play_agent_word_duel`             | Free               | Request a strategic Word Duel move.                                                                      |
| `play_jing_arena_move`             | Free               | Request a Jing Arena counter move.                                                                       |
| `plan_weekly_menu`                 | Draft generation   | Return an unpublished menu without saving it.                                                            |
| `publish_weekly_menu`              | Publisher role     | Publish an exact reviewed draft with an idempotency key.                                                 |

---

## Model-Tier Gating & Authorization

To protect model budget, the PA MCP server enforces a per-API-key ceiling:

1. **Anonymous Callers (no `_meta.apiKey`)**:
   - Forced to `"free"` model tier.
   - `synthesize_culinary_debate` degrades to a single-persona stance instead of the full multi-agent debate.
2. **Standard API Keys (`DesktopApiKey` with standard subscription status)**:
   - Cap model tier to `"cheap_fast"` or `"free"` (reflective/primary tier requests are downgraded).
   - `synthesize_culinary_debate` degrades to a single-persona stance.
3. **Account-holder / Alchemist API Keys (an active key linked to an existing account, a legacy paid subscription, or `PA_USER_API_KEY`)**:
   - Full access to all model tiers (`free`, `cheap_fast`, `primary`, `reflective`).
   - Access to full multi-agent culinary debates.

---

## Run

To run the MCP server locally over stdio:

```bash
python planetary_agents_mcp_server.py
```

### Optional Environment Variables:

```bash
DIRECT_URL=postgres://...              # enables database key resolution + telemetry log
PA_USER_API_KEY=sk_pa_live_xxx         # master key for single-user Claude Desktop installs
PA_CRON_SECRET=...                     # cron secret for triggering synthetic probe
ALLOW_SQLITE_FALLBACK=true             # fallback to local sqlite in dev environments
```

---

## Connecting to Claude Desktop

Add the server to your `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or equivalent:

```json
{
  "mcpServers": {
    "planetary-agents": {
      "command": "python",
      "args": ["-m", "planetary_agents_mcp_server"],
      "env": {
        "DIRECT_URL": "postgres://...",
        "PA_USER_API_KEY": "sk_pa_live_xxx",
        "ALLOW_SQLITE_FALLBACK": "true"
      }
    }
  }
}
```

See `backend/claude-desktop.pa.example.json` for a copy-paste template.

---

## Connecting to Cursor

Add to your `~/.cursor/mcp.json` or project's `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "planetary-agents": {
      "command": "python",
      "args": ["-m", "planetary_agents_mcp_server"],
      "env": {
        "PA_USER_API_KEY": "sk_pa_live_xxx",
        "ALLOW_SQLITE_FALLBACK": "true"
      }
    }
  }
}
```

---

## Telemetry & Operations

- **Postgres Telemetry (`mcp_invocations` table)**: Every successful/failed tool dispatch records invocation details (called_at, completed_at, latency_ms, success, caller, arguments, model_tier, error_message, etc.).
- **Synthetic Probe**: FastAPI endpoint `POST /api/cron/synthetic-mcp-probe` exercises `chat_with_planetary_agent` and `get_agent_feed_discussion` in-process every 30 minutes.
- **Admin Status**: `GET /api/admin/mcp-status` retrieves the latest 10 synthetic probes to check server health.

---

## Cross-server consumption

WTEN's `/admin/mcp` page renders Network / Personas / Quotas tabs by polling a single aggregator endpoint on PA's FastAPI backend every 30 seconds:

```
GET https://api.agents.alchm.kitchen/api/admin/mcp-summary?windowMinutes=60
Headers:
  X-Internal-Secret: <PA_INTERNAL_API_SECRET>
```

### Auth

The endpoint requires a matching `X-Internal-Secret` header. It accepts either `PA_INTERNAL_API_SECRET` (the cross-project naming convention WTEN uses) or `INTERNAL_API_SECRET` (PA's long-standing env var). Comparison uses `secrets.compare_digest` for timing safety. A missing or wrong header returns `401`.

### Query parameters

| Param           | Type | Range     | Default | Notes                                                    |
| --------------- | ---- | --------- | ------- | -------------------------------------------------------- |
| `windowMinutes` | int  | `5..1440` | `60`    | Out-of-range → `422`. Caps DB scan to the recent window. |

### Response shape

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
    "errorRate": 0.028,
    "p50LatencyMs": 87,
    "p95LatencyMs": 412,
    "p99LatencyMs": 1180
  },
  "byTool":   [{ "tool": "...", "calls": 110, "failures": 2, "p95LatencyMs": 380 }],
  "byAgent":  [{ "agentId": "socrates", "calls": 42, "modelTierMix": { "free": 30, "primary": 10 } }],
  "byCaller": [{ "caller": "claude-desktop", "calls": 65 }],
  "syntheticProbe": {
    "verdict": "OK" | "DEGRADED" | "INCIDENT" | "UNKNOWN",
    "lastCalledAt": "2026-05-27T15:55:00.000Z",
    "lastSuccess": true,
    "consecutiveFailures": 0
  }
}
```

### Verdict taxonomy

Mirrors the WTEN-side `systemStatusService` taxonomy so a single status bar can fuse both servers:

| Verdict    | Rule                                                                          |
| ---------- | ----------------------------------------------------------------------------- |
| `OK`       | `errorRate < 1%` AND synthetic probe healthy                                  |
| `DEGRADED` | `errorRate ∈ [1%, 5%)` OR `p95LatencyMs > 2000` OR synthetic probe `DEGRADED` |
| `INCIDENT` | `errorRate ≥ 5%` OR synthetic probe `INCIDENT` (≥2 of last 4 probes failed)   |
| `UNKNOWN`  | `calls == 0` AND no synthetic probe in the last 2 hours                       |

### Operational notes

- **Caching**: response is cached in-process for 10 seconds keyed by `windowMinutes`. Multiple admin operators polling concurrently fold onto a single DB round-trip.
- **Index dependency**: `(tool_name, called_at DESC)` on `mcp_invocations` (from the original instrumentation PR) keeps the windowed scan sub-100ms at production traffic volumes.
- **`byAgent`** drops rows with `NULL agent_id`. `byAgent` and `byCaller` are capped at 10 entries, ordered by call volume desc.
- **Percentiles** use linear interpolation (matches Postgres `percentile_cont`).
- **`PA_INTERNAL_API_SECRET`** must be set on PA's Railway service variables (mirrors WTEN's cross-project sync convention). Falls back to `INTERNAL_API_SECRET` for backward compatibility with the existing admin-sync proxy.

---

## Testing

Run unit tests and stdio integration tests:

```bash
# Unit tests
PYTHONPATH=backend backend/venv/bin/pytest backend/tests/test_mcp_server.py

# Stdio E2E integration test
PA_MCP_E2E=1 PYTHONPATH=backend backend/venv/bin/pytest backend/tests/test_mcp_stdio.py

# Admin aggregator tests
PYTHONPATH=backend backend/venv/bin/pytest backend/tests/test_admin_mcp_summary.py
```
