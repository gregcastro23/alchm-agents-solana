-- Operator-console audit trail.
--
-- Written by hand for the record: this repo deploys schema with `prisma db push`
-- and prisma/migrations/ is far behind schema.prisma, so `migrate deploy` will
-- NOT reproduce the live schema. Apply with `bunx prisma db push`.
CREATE TABLE IF NOT EXISTS "admin_audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "actor_email" TEXT,
    "actor_source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "before" JSONB,
    "after" JSONB,
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_audit_log_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "admin_audit_log_created_at_idx" ON "admin_audit_log"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "admin_audit_log_target_type_target_id_idx" ON "admin_audit_log"("target_type", "target_id");
CREATE INDEX IF NOT EXISTS "admin_audit_log_actor_id_idx" ON "admin_audit_log"("actor_id");
