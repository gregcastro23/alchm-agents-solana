-- Planetary 12 stat columns for historical_agents.
--
-- These 12 fields exist in schema.prisma (all `Float? @default(0)`) but never
-- had a migration, so they only ever reached dev DBs via `prisma db push` and
-- were absent on the production Prisma Postgres database. That made the
-- per-agent leveling endpoint (/api/agents/[slug]/leveling) and /api/agents/mentors
-- 500 with `column historical_agents.venusianCoherence does not exist`, because
-- Prisma's full-model findUnique selects every scalar column.
--
-- Idempotent ADD COLUMN IF NOT EXISTS — safe + non-destructive. Authored as raw
-- ALTER (not `prisma db push`) because this database carries materialized views
-- (synastry_aspects, synastry_scores) that db push mis-diffs into table drops.
ALTER TABLE "historical_agents"
  ADD COLUMN IF NOT EXISTS "solarAgency"         DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lunarReceptivity"    DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "mercurialVelocity"   DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "venusianCoherence"   DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "martialImpetus"      DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "jovianExpansion"     DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "saturnianStructure"  DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "chironicAdaptation"  DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "uranianSurprisal"    DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "neptunianResonance"  DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "plutonicIntegration" DOUBLE PRECISION DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "kineticAlignment"    DOUBLE PRECISION DEFAULT 0;
