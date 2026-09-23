-- Cron heartbeats and the ASOL → WTEN delivery log.
--
-- Written by hand for the record: this repo deploys schema with `prisma db push`
-- and prisma/migrations/ is far behind schema.prisma, so `migrate deploy` will
-- NOT reproduce the live schema. Apply with `bunx prisma db push`. Until then the
-- writers log and carry on, and the admin pages report these sources as
-- "not provisioned" rather than as zero.
--
-- Checked against PostgreSQL (PGlite 2026-09-23, outside the repo) together
-- with the raw SQL in lib/admin/wten-link.ts that reads it.

CREATE TABLE IF NOT EXISTS "cron_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "finished_at" TIMESTAMPTZ NOT NULL,
    "status" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error" TEXT,
    "details" JSONB,

    CONSTRAINT "cron_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "cron_runs_job_started_at_idx" ON "cron_runs"("job", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "cron_runs_started_at_idx" ON "cron_runs"("started_at" DESC);

CREATE TABLE IF NOT EXISTS "wten_deliveries" (
    "id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" INTEGER,
    "result" TEXT NOT NULL,
    "latency_ms" INTEGER NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wten_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "wten_deliveries_endpoint_created_at_idx" ON "wten_deliveries"("endpoint", "created_at" DESC);
CREATE INDEX IF NOT EXISTS "wten_deliveries_created_at_idx" ON "wten_deliveries"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "wten_deliveries_event_id_idx" ON "wten_deliveries"("event_id");
