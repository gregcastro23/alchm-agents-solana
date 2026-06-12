-- CreateTable
CREATE TABLE "public"."agent_action_events" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentEmail" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "triggerSummary" TEXT NOT NULL,
    "metadataPayload" JSONB NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_action_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "agent_action_events_idempotencyKey_key" ON "public"."agent_action_events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "agent_action_events_agentId_idx" ON "public"."agent_action_events"("agentId");

-- CreateIndex
CREATE INDEX "agent_action_events_status_idx" ON "public"."agent_action_events"("status");

-- CreateIndex
CREATE INDEX "agent_action_events_evaluatedAt_idx" ON "public"."agent_action_events"("evaluatedAt");
