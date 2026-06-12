-- AgentJingDuel: persists every Jing Arena cast for personalized
-- recommendations. Captures both turns + the full relational ledger
-- (synastry between caster/target + each agent's transit overlay at
-- cast time) as Json so the recommendation pipeline can replay context.

CREATE TABLE IF NOT EXISTS "AgentJingDuel" (
    "id"                      TEXT             NOT NULL,
    "sessionId"               TEXT             NOT NULL,
    "userId"                  TEXT,
    "source"                  TEXT             NOT NULL DEFAULT 'desktop',
    "casterId"                TEXT             NOT NULL,
    "targetId"                TEXT             NOT NULL,
    "attackMoveId"            TEXT             NOT NULL,
    "counterMoveId"           TEXT             NOT NULL,
    "stance"                  TEXT             NOT NULL,
    "boostElement"            TEXT,
    "boostMagnitude"          DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cacheHit"                BOOLEAN          NOT NULL DEFAULT false,
    "synastrySnapshot"        JSONB,
    "casterTransitSnapshot"   JSONB,
    "targetTransitSnapshot"   JSONB,
    "casterPrompt"            TEXT,
    "casterResponse"          TEXT,
    "targetPrompt"            TEXT,
    "targetResponse"          TEXT,
    "latencyMs"               INTEGER,
    "modelUsed"               TEXT,
    "createdAt"               TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentJingDuel_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AgentJingDuel_casterId_idx"
    ON "AgentJingDuel"("casterId");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_targetId_idx"
    ON "AgentJingDuel"("targetId");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_userId_idx"
    ON "AgentJingDuel"("userId");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_sessionId_idx"
    ON "AgentJingDuel"("sessionId");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_stance_idx"
    ON "AgentJingDuel"("stance");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_createdAt_idx"
    ON "AgentJingDuel"("createdAt");
CREATE INDEX IF NOT EXISTS "AgentJingDuel_casterId_targetId_idx"
    ON "AgentJingDuel"("casterId", "targetId");

ALTER TABLE "AgentJingDuel"
    ADD CONSTRAINT "AgentJingDuel_casterId_fkey"
    FOREIGN KEY ("casterId") REFERENCES "historical_agents"("agentId")
    ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "AgentJingDuel"
    ADD CONSTRAINT "AgentJingDuel_targetId_fkey"
    FOREIGN KEY ("targetId") REFERENCES "historical_agents"("agentId")
    ON DELETE RESTRICT ON UPDATE CASCADE;
