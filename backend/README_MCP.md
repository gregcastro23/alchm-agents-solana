# Planetary Agents MCP Server

An [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server exposing three cognitive tools — persona chat, feed discussion retrieval, and multi-agent culinary debate — to any LLM client that speaks MCP (Claude Desktop, Cursor, Google Antigravity, etc.).

---

## Tools

| Tool                         | Cost / Gating      | Description                                                                                              |
| ---------------------------- | ------------------ | -------------------------------------------------------------------------------------------------------- |
| `chat_with_planetary_agent`  | Free-to-reflective | Converse with a configured Planetary Agents persona. Gated by API key level.                             |
| `get_agent_feed_discussion`  | Free               | Retrieve a thread or feed event by ID from the Planetary Agents feed.                                    |
| `synthesize_culinary_debate` | Premium            | Ask multiple personas to debate ingredients. Anonymous/standard keys degrade to a single-persona stance. |

---

## Model-Tier Gating & Authorization

To protect model budget, the PA MCP server enforces a per-API-key ceiling:

1. **Anonymous Callers (no `_meta.apiKey`)**:
   - Forced to `"free"` model tier.
   - `synthesize_culinary_debate` degrades to a single-persona stance instead of the full multi-agent debate.
2. **Standard API Keys (`DesktopApiKey` with standard subscription status)**:
   - Cap model tier to `"cheap_fast"` or `"free"` (reflective/primary tier requests are downgraded).
   - `synthesize_culinary_debate` degrades to a single-persona stance.
3. **Alchemist / Premium API Keys (`DesktopApiKey` with paid/alchemist subscription, or `PA_USER_API_KEY` in environment)**:
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
