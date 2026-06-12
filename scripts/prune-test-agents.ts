/**
 * Prune test/junk rows from historical_agents.
 *
 * Targets the throwaway rows created during sync/craft testing:
 *   custom-historical-agent-<uuid>, sync-test-agent-<uuid>
 * (NOT canonical figures and NOT planetary agents — see the population note).
 *
 * Dry-run by default. Pass --apply to delete. FK-safe: each row is deleted in
 * its own transaction; any row still referenced by child tables (conversations,
 * etc.) is SKIPPED and reported rather than cascade-deleted.
 *
 *     bun run scripts/prune-test-agents.ts                      # dry run
 *     bun run scripts/prune-test-agents.ts --apply              # delete orphans only
 *     bun run scripts/prune-test-agents.ts --apply --cascade    # also delete test children
 */
import pg from 'pg'
import { config } from 'dotenv'

config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })

const APPLY = process.argv.includes('--apply')
const CASCADE = process.argv.includes('--cascade')
const TARGET_RE = '^(custom-historical-agent|sync-test-agent)-'

interface Fk {
  table: string
  column: string
  refColumn: string
}

/** Discover every FK that references historical_agents (on agentId or id). */
async function discoverFks(): Promise<Fk[]> {
  const { rows } = await pool.query<Fk>(
    `SELECT tc.table_name AS table, kcu.column_name AS column, ccu.column_name AS "refColumn"
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
     JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
     WHERE tc.constraint_type = 'FOREIGN KEY' AND ccu.table_name = 'historical_agents'`
  )
  return rows
}

async function main() {
  const { rows: targets } = await pool.query<{
    agentId: string
    id: string
    name: string
    level: number
  }>(
    `SELECT "agentId","id","name","level" FROM "historical_agents" WHERE "agentId" ~ $1 ORDER BY "agentId"`,
    [TARGET_RE]
  )

  console.log(
    `\n--- Prune test agents (${APPLY ? 'APPLY' : 'DRY RUN'}${CASCADE ? ' +CASCADE' : ''}) ---`
  )
  console.log(`Matched ${targets.length} junk rows:\n`)
  for (const t of targets) console.log(`  • ${t.agentId.padEnd(40)} "${t.name}" (Lv.${t.level})`)

  // Safety guard: these patterns should never match a canonical or planetary agent.
  const suspicious = targets.filter(
    t => !/^(custom-historical-agent|sync-test-agent)-/.test(t.agentId)
  )
  if (suspicious.length) {
    throw new Error(`Refusing: ${suspicious.length} matched rows do not fit the junk pattern`)
  }

  if (!APPLY) {
    console.log(
      `\nDry run — no rows deleted. Re-run with --apply to delete these ${targets.length} rows.\n`
    )
    return
  }

  const fks = CASCADE ? await discoverFks() : []
  if (CASCADE) {
    console.log(
      `\nCascade: will clear ${fks.length} child FK(s): ${fks.map(f => `${f.table}.${f.column}`).join(', ')}`
    )
  }

  let deleted = 0
  let childrenDeleted = 0
  const skipped: { agentId: string; reason: string }[] = []

  for (const t of targets) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      if (CASCADE) {
        for (const fk of fks) {
          const ref = fk.refColumn === 'id' ? t.id : t.agentId
          const res = await client.query(`DELETE FROM "${fk.table}" WHERE "${fk.column}" = $1`, [
            ref,
          ])
          childrenDeleted += res.rowCount ?? 0
        }
      }
      await client.query(`DELETE FROM "historical_agents" WHERE "agentId" = $1`, [t.agentId])
      await client.query('COMMIT')
      deleted++
    } catch (err) {
      await client.query('ROLLBACK')
      const msg = err instanceof Error ? err.message : String(err)
      // Foreign-key violation => still referenced by a child table; leave it.
      skipped.push({ agentId: t.agentId, reason: msg.split('\n')[0] })
    } finally {
      client.release()
    }
  }

  console.log(
    `\n🧹 Deleted ${deleted} / ${targets.length} junk rows${CASCADE ? ` (+${childrenDeleted} child rows)` : ''}.`
  )
  if (skipped.length) {
    console.log(
      `\n⚠️  Skipped ${skipped.length} (still referenced by child rows — re-run with --cascade):`
    )
    for (const s of skipped) console.log(`  • ${s.agentId} — ${s.reason}`)
  }
  console.log()
}

main()
  .catch(err => {
    console.error('❌ Prune failed:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
