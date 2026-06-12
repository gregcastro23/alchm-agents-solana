/**
 * Verify the two Jing-related migrations landed in Neon:
 *   - AgentJingDuel table (planetary_agents Prisma migration)
 *   - agent_natal_positions + synastry_aspects + synastry_scores (WTEN SQL)
 *
 * Uses direct pg connection because the project's Prisma client is
 * built with --no-engine (Accelerate) and refuses postgres:// URLs.
 */
import { Pool } from 'pg'

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) {
  console.error('Set DIRECT_URL or DATABASE_URL in env')
  process.exit(1)
}

const pool = new Pool({
  connectionString: url,
  ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
})

async function main() {
  const { rows } = await pool.query(`
    SELECT 'AgentJingDuel' AS object_name,
           CASE WHEN to_regclass('"AgentJingDuel"') IS NOT NULL THEN 'present' ELSE 'MISSING' END AS status,
           (SELECT count(*) FROM "AgentJingDuel") AS row_count
    UNION ALL
    SELECT 'agent_natal_positions',
           CASE WHEN to_regclass('agent_natal_positions') IS NOT NULL THEN 'present' ELSE 'MISSING' END,
           (SELECT count(*) FROM agent_natal_positions)
    UNION ALL
    SELECT 'synastry_aspects (matview)',
           CASE WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'synastry_aspects') THEN 'present' ELSE 'MISSING' END,
           (SELECT count(*) FROM synastry_aspects)
    UNION ALL
    SELECT 'synastry_scores (matview)',
           CASE WHEN EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'synastry_scores') THEN 'present' ELSE 'MISSING' END,
           (SELECT count(*) FROM synastry_scores)
    UNION ALL
    SELECT 'refresh_synastry_views() fn',
           CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'refresh_synastry_views') THEN 'present' ELSE 'MISSING' END,
           CAST(0 AS BIGINT);
  `)
  console.table(
    rows.map(r => ({ object: r.object_name, status: r.status, rows: Number(r.row_count) }))
  )

  // Index spot-check on AgentJingDuel
  const idx = await pool.query(`
    SELECT indexname FROM pg_indexes
     WHERE tablename = 'AgentJingDuel'
     ORDER BY indexname;
  `)
  console.log(`\nAgentJingDuel indexes (${idx.rows.length}):`)
  for (const r of idx.rows) console.log(`  • ${r.indexname}`)

  await pool.end()
}

main().catch(async e => {
  console.error(e)
  await pool.end()
  process.exit(1)
})
