-- AlterTable: Add agentic user fields to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "isAgentic" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastActivationAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "activationCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable: Add natalPositions to user_profiles
ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "natalPositions" JSONB;

-- CreateIndex: Allow fast queries for agentic users
CREATE INDEX IF NOT EXISTS "users_isAgentic_idx" ON "users"("isAgentic");
