-- Record-only migration, matching schema.prisma. This project deploys schema
-- with `prisma db push`; its older migration history does not reproduce the
-- deployed schema. Apply/verify this additive table BEFORE keyed forge code.
-- Do not use `migrate deploy` to reconstruct an environment from this history.
--
-- No legacy backfill: previous forge rows carry no clientRequestId, so inferring
-- a retry key from an agent name or blueprint would join independent requests.
-- No creator FK: bridge sessions can identify an authenticated creator before
-- its local users row exists. The server supplies creatorId from that session.
CREATE TABLE "agent_creation_requests" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "clientRequestId" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "agentId" TEXT,
    "response" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_creation_requests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_creation_requests_creator_request_key"
    ON "agent_creation_requests"("creatorId", "clientRequestId");
