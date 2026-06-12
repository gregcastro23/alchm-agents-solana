/**
 * Sync planetary / moon agents from the Neon production branch into prod's
 * Prisma Postgres DB.
 *
 * Prod's Prisma Postgres database only carries the ~67 canonical agents; the
 * ~3,637 `planetary-*` / `moon-*` agents (Level 100) were only ever seeded to
 * the Neon "production" branch (ep-mute-thunder). This copies them across so
 * they appear in prod's gallery / leveling.
 *
 * Idempotent: upserts on the unique `agentId`. Re-running updates existing rows.
 * Column-safe: only copies the columns present in BOTH tables (so it works
 * whether or not the planetary-12 / other drift columns have been added yet).
 *
 * Usage (run on your machine — writes prod):
 *   SOURCE_DATABASE_URL="<Neon production-branch URL, e.g. ep-mute-thunder…>" \
 *   DATABASE_URL="<prod Prisma Postgres URL, db.prisma.io…>" \
 *   bun run scripts/sync-planetary-agents-to-prod.ts
 */
import pg from 'pg'

const SOURCE = process.env.SOURCE_DATABASE_URL
const DEST = process.env.DATABASE_URL || process.env.DIRECT_URL

if (!SOURCE || !DEST) {
  console.error(
    'Set SOURCE_DATABASE_URL (Neon production branch) and DATABASE_URL (prod Prisma Postgres).'
  )
  process.exit(1)
}

const src = new pg.Pool({ connectionString: SOURCE, ssl: { rejectUnauthorized: false } })
const dst = new pg.Pool({ connectionString: DEST, ssl: { rejectUnauthorized: false } })

async function columnsOf(pool: pg.Pool): Promise<Set<string>> {
  const r = await pool.query(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'historical_agents'`
  )
  return new Set(r.rows.map((x: { column_name: string }) => x.column_name))
}

async function main() {
  const [srcCols, dstCols] = await Promise.all([columnsOf(src), columnsOf(dst)])
  const shared = [...srcCols].filter(c => dstCols.has(c))
  if (!shared.includes('agentId') || !shared.includes('id')) {
    throw new Error('historical_agents is missing id/agentId in one of the databases')
  }
  const quoted = shared.map(c => `"${c}"`).join(', ')
  console.log(`Shared columns: ${shared.length}`)

  const { rows } = await src.query(
    `SELECT ${quoted} FROM historical_agents
       WHERE "agentId" LIKE 'planetary-%' OR "agentId" LIKE 'moon-%'`
  )
  console.log(`Source planetary/moon rows: ${rows.length}`)
  if (rows.length === 0) {
    console.log('Nothing to sync.')
    return
  }

  const updatable = shared.filter(c => c !== 'id' && c !== 'agentId')
  const setClause = updatable.map(c => `"${c}" = EXCLUDED."${c}"`).join(', ')

  const BATCH = 300
  let done = 0
  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH)
    const tuples: string[] = []
    const params: unknown[] = []
    let p = 1
    for (const row of slice) {
      tuples.push(`(${shared.map(() => `$${p++}`).join(',')})`)
      for (const c of shared) {
        const val = row[c]
        params.push(
          val !== null && typeof val === 'object' && !(val instanceof Date)
            ? JSON.stringify(val)
            : val
        )
      }
    }
    await dst.query(
      `INSERT INTO historical_agents (${quoted}) VALUES ${tuples.join(',')}
         ON CONFLICT ("agentId") DO UPDATE SET ${setClause}`,
      params
    )
    done += slice.length
    console.log(`  upserted ${done}/${rows.length}`)
  }
  console.log(`✅ Synced ${done} planetary/moon agents into prod's Prisma Postgres DB.`)
}

main()
  .catch(err => {
    console.error('❌ sync failed:', err instanceof Error ? err.message : err)
    process.exitCode = 1
  })
  .finally(async () => {
    await src.end().catch(() => {})
    await dst.end().catch(() => {})
  })
