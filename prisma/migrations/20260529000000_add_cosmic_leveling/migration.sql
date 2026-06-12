-- Cosmic EV & Leveling System
-- Adds level / xp / EV tracking columns to historical_agents.
-- Authored surgically (ADD COLUMN IF NOT EXISTS) because this database carries
-- materialized views (synastry_aspects, synastry_scores) that Prisma does not
-- model, which makes `prisma db push` mis-diff into a destructive table drop.
ALTER TABLE "historical_agents"
  ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "xp" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "evolutionValues" JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS "evTotal" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "ivSnapshot" JSONB,
  ADD COLUMN IF NOT EXISTS "lastTrainingPartner" TEXT,
  ADD COLUMN IF NOT EXISTS "lastXpGain" TIMESTAMP(3);
