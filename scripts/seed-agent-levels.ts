/**
 * Seed Cosmic levels for historical agents.
 * ------------------------------------------
 * Assigns each historical agent a level (1–100) reflecting the richness of
 * their training data / historical documentation, derives their IV snapshot
 * from the Sacred Stats already on the row, and back-fills XP + evolutionStage.
 *
 * Uses raw `pg` (matching scripts/seed-historical-agents.ts) rather than the
 * Prisma client: `@/lib/db` is `server-only`, and a standalone Prisma client in
 * a `bun run` script trips engine-resolution. Run with:
 *
 *     bun run scripts/seed-agent-levels.ts
 */
import pg from 'pg'
import { config } from 'dotenv'
import { deriveIVs, xpForLevel } from '../lib/consciousness-engine.js'
import { HISTORICAL_AGENTS } from '../lib/agents/historical/index.js'

config()

const { Pool } = pg
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL,
})

// The `historical_agents` table is shared by three populations:
//   1. ~71 canonical historical figures (the HISTORICAL_AGENTS array)  → tiered level
//   2. ~3637 planetary agents (Moon-degree, planet-in-sign, etc.)      → Level 100
//   3. crafted / test agents (custom-historical-agent-*, sync-test-*)  → Level 1 (untrained)
const PLANETARY_LEVEL = 100
const CRAFTED_LEVEL = 1
const HISTORICAL_IDS = new Set(HISTORICAL_AGENTS.map((a: { id: string }) => a.id))
// Crafted/test rows that are neither canonical historical nor planetary.
const CRAFTED_OR_TEST_RE = /^(custom-historical-agent|sync-test-agent)-/i

/**
 * Real agent IDs (the historical_agents.agentId values, i.e. the CraftedAgent
 * `.id` slugs — NOT zero-padded). Levels reflect documentation richness.
 * Any agent not listed defaults to DEFAULT_LEVEL.
 */
const DEFAULT_LEVEL = 85

const LEVEL_ASSIGNMENTS: Record<string, number> = {
  // — Apex documentation (the canonical greats) —
  socrates: 98,
  aristotle: 97,
  plato: 97,
  'leonardo-da-vinci': 96,
  'albert-einstein': 95,
  'william-shakespeare': 95,
  'isaac-newton': 94,
  'marie-curie-1867': 93,
  'galileo-galilei': 93,
  'charles-darwin-1809': 93,
  'nikola-tesla-1856': 92,
  'julius-caesar': 92,
  michelangelo: 92,
  confucius: 92,
  // — Deeply documented —
  'siddhartha-gautama-buddha': 91,
  'immanuel-kant-1724': 91,
  'rene-descartes-1596': 91,
  'mahatma-gandhi': 91,
  'carl-jung': 90,
  'sigmund-freud-1856': 90,
  'voltaire-1694': 90,
  rumi: 90,
  'marcus-aurelius': 90,
  'benjamin-franklin': 90,
  archimedes: 90,
  'alexander-the-great': 90,
  'wolfgang-mozart': 90,
  // — Well documented —
  cleopatra: 89,
  'david-hume-1711': 89,
  'john-locke-1632': 89,
  'adam-smith-1723': 89,
  'johannes-kepler-1571': 89,
  cicero: 89,
  homer: 89,
  'dante-alighieri': 89,
  machiavelli: 89,
  'vincent-van-gogh-1853': 89,
  'fyodor-dostoevsky': 89,
  'lao-tzu': 89,
  // — Solidly documented —
  'thomas-aquinas': 88,
  'jean-jacques-rousseau-1712': 88,
  'charles-dickens-1812': 88,
  'mark-twain-1835': 88,
  'jane-austen': 88,
  'carl-sagan': 88,
  'isaac-asimov': 88,
  // — Documented —
  'claude-monet-1840': 87,
  'oscar-wilde': 87,
  'edgar-allan-poe-1809': 87,
  herodotus: 87,
  'ibn-sina-avicenna': 87,
  'eleanor-roosevelt': 87,
  raphael: 87,
  // — Substantial record —
  'emily-dickinson': 86,
  'maya-angelou': 86,
  'frida-kahlo': 86,
  'geoffrey-chaucer': 86,
  // — Moderate record —
  'lewis-carroll': 85,
  'rachel-carson': 85,
  'joan-of-arc': 85,
  'murasaki-shikibu': 85,
  'mary-wollstonecraft-1759': 85,
  petrarch: 85,
  donatello: 85,
  'sojourner-truth': 84,
  'hildegard-of-bingen': 84,
  'sitting-bull': 83,
  'paulo-freire': 83,
  tecumseh: 82,
  'wangari-maathai': 82,
  // — Freshly crafted, needs training —
  'greg-castro-1991': 1,
}

interface AgentRow {
  agentId: string
  name: string
  wisdomScore: number | null
  charismaScore: number | null
  intuitionScore: number | null
  adaptabilityScore: number | null
  vitalityScore: number | null
  venusianCoherence: number | null
  neptunianResonance: number | null
  lunarReceptivity: number | null
  chironicAdaptation: number | null
}

type Kind = 'historical' | 'planetary' | 'crafted'

function classify(agentId: string): Kind {
  if (HISTORICAL_IDS.has(agentId)) return 'historical'
  if (CRAFTED_OR_TEST_RE.test(agentId)) return 'crafted'
  return 'planetary'
}

async function main() {
  console.log('--- Seeding Cosmic Levels (historical • planetary • crafted) ---')

  const { rows } = await pool.query<AgentRow>(
    `SELECT "agentId", "name",
            "wisdomScore", "charismaScore", "intuitionScore", "adaptabilityScore",
            "vitalityScore", "venusianCoherence", "neptunianResonance",
            "lunarReceptivity", "chironicAdaptation"
     FROM "historical_agents"`
  )

  console.log(`Found ${rows.length} total agent rows.\n`)

  const counts: Record<Kind, number> = { historical: 0, planetary: 0, crafted: 0 }
  let defaultedHistorical = 0

  for (const row of rows) {
    const kind = classify(row.agentId)
    counts[kind]++

    let level: number
    if (kind === 'historical') {
      const explicit = LEVEL_ASSIGNMENTS[row.agentId]
      level = explicit ?? DEFAULT_LEVEL
      if (explicit === undefined) defaultedHistorical++
    } else if (kind === 'planetary') {
      level = PLANETARY_LEVEL
    } else {
      level = CRAFTED_LEVEL
    }

    const xp = xpForLevel(level)
    const ivs = deriveIVs(row)

    await pool.query(
      `UPDATE "historical_agents"
       SET "level" = $1, "xp" = $2, "evolutionStage" = $3, "ivSnapshot" = $4::jsonb
       WHERE "agentId" = $5`,
      [level, xp, level, JSON.stringify(ivs), row.agentId]
    )

    // Only print the (interesting) canonical historical figures individually.
    if (kind === 'historical') {
      const flag = LEVEL_ASSIGNMENTS[row.agentId] === undefined ? ' (default)' : ''
      console.log(
        `✅ ${row.name.padEnd(28)} → Lv.${String(level).padStart(3)} (${xp.toLocaleString()} XP)${flag}`
      )
    }
  }

  console.log(
    `\n🌟 Seeded ${rows.length} rows:\n` +
      `   • ${counts.historical} historical figures (tiered; ${defaultedHistorical} fell back to Lv.${DEFAULT_LEVEL})\n` +
      `   • ${counts.planetary} planetary agents  → Lv.${PLANETARY_LEVEL}\n` +
      `   • ${counts.crafted} crafted/test agents → Lv.${CRAFTED_LEVEL} (untrained)`
  )

  // Typo guard: any explicit assignment that never matched a real row.
  const seenIds = new Set(rows.map(r => r.agentId))
  const unmatched = Object.keys(LEVEL_ASSIGNMENTS).filter(id => !seenIds.has(id))
  if (unmatched.length) {
    console.warn(
      `\n⚠️  ${unmatched.length} assigned ID(s) had no matching DB row: ${unmatched.join(', ')}`
    )
  }
}

main()
  .catch(err => {
    console.error('❌ Level seeding failed:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
