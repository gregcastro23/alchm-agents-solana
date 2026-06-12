-- mcp_invocations: telemetry for every MCP tool dispatch (Planetary Agents
-- MCP server). Aggregated by GET /api/admin/mcp-summary (WTEN cross-server
-- admin panel) and read by GET /api/admin/mcp-status (synthetic-probe
-- health). The Prisma model was added in commit 449503bf but the matching
-- migration was never generated, so this is the first migration to create
-- the table in prod.

CREATE TABLE IF NOT EXISTS "mcp_invocations" (
    "id"             BIGSERIAL          NOT NULL,
    "tool_name"      TEXT               NOT NULL,
    "called_at"      TIMESTAMPTZ        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at"   TIMESTAMPTZ,
    "latency_ms"     INTEGER,
    "success"        BOOLEAN            NOT NULL,
    "user_id"        TEXT,
    "api_key_id"     TEXT,
    "caller"         TEXT,
    "arguments"      JSONB              DEFAULT '{}'::jsonb,
    "result_summary" JSONB              DEFAULT '{}'::jsonb,
    "error_message"  TEXT,
    "agent_id"       TEXT,
    "model_tier"     TEXT,

    CONSTRAINT "mcp_invocations_pkey" PRIMARY KEY ("id")
);

-- Read patterns: the windowed aggregator scans by called_at; per-tool /
-- per-agent / per-user breakdowns benefit from composite descending indexes
-- on called_at so the most recent rows are surfaced first.
CREATE INDEX IF NOT EXISTS "mcp_invocations_tool_name_called_at_idx"
    ON "mcp_invocations"("tool_name", "called_at" DESC);
CREATE INDEX IF NOT EXISTS "mcp_invocations_agent_id_called_at_idx"
    ON "mcp_invocations"("agent_id", "called_at" DESC);
CREATE INDEX IF NOT EXISTS "mcp_invocations_user_id_called_at_idx"
    ON "mcp_invocations"("user_id", "called_at" DESC);
CREATE INDEX IF NOT EXISTS "mcp_invocations_called_at_idx"
    ON "mcp_invocations"("called_at" DESC);

-- Soft FKs: invocations outlive the user / api key / agent rows they
-- originated from, so cascade to SET NULL on delete rather than blocking.
ALTER TABLE "mcp_invocations"
    ADD CONSTRAINT "mcp_invocations_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_invocations"
    ADD CONSTRAINT "mcp_invocations_api_key_id_fkey"
    FOREIGN KEY ("api_key_id") REFERENCES "desktop_api_keys"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "mcp_invocations"
    ADD CONSTRAINT "mcp_invocations_agent_id_fkey"
    FOREIGN KEY ("agent_id") REFERENCES "historical_agents"("agentId")
    ON DELETE SET NULL ON UPDATE CASCADE;
