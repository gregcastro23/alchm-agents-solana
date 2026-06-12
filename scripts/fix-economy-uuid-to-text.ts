/**
 * Economy UUID → TEXT reconciliation (production drift fix)
 * =========================================================
 *
 * The economy tables key on `user_id`, but `users.id` (and every caller) is a
 * CUID string. Migration `20260513000000_fix_economy_uuid_to_text` already
 * converts these columns from UUID to TEXT — but the current prod Prisma
 * Postgres DB drifted and never had it applied (same pattern as the leveling
 * migration). The symptom: `EconomyService.getBalances` catches the resulting
 * P2023 ("invalid input syntax for type uuid") and silently returns ZERO
 * balances, so agentic users can never hold or earn tokens and daily-yield is
 * a no-op.
 *
 * This script re-expresses that migration as a guarded, idempotent, re-runnable
 * operation so it can be applied to a drifted DB safely:
 *   - UUID → TEXT is lossless (Postgres casts every uuid to its canonical text).
 *   - Columns already TEXT are detected and skipped (no rewrite).
 *   - Missing columns/tables are reported and skipped, never fatal.
 *
 * Usage:
 *   DIRECT_URL=postgres://...  bun run scripts/fix-economy-uuid-to-text.ts --check   # read-only: report current column types
 *   DIRECT_URL=postgres://...  bun run scripts/fix-economy-uuid-to-text.ts           # convert any UUID columns to TEXT
 *
 * Requires a DIRECT (non-Accelerate) postgres:// URL — DDL cannot run through
 * the `prisma+postgres://` Accelerate proxy. Reads DIRECT_URL, then DATABASE_URL.
 * This is a PRODUCTION WRITE (unless --check); run it yourself.
 */
import pg from 'pg'
import { config } from 'dotenv'

config()

const { Client } = pg

// The exact columns from migration 20260513000000_fix_economy_uuid_to_text.
const TARGETS: Array<{ table: string; column: string }> = [
  { table: 'token_balances', column: 'user_id' },
  { table: 'token_transactions', column: 'user_id' },
  { table: 'token_transactions', column: 'transaction_group_id' },
  { table: 'user_subscriptions', column: 'id' },
  { table: 'user_subscriptions', column: 'user_id' },
]

async function main() {
  const checkOnly = process.argv.includes('--check')
  const url = process.env.DIRECT_URL || process.env.DATABASE_URL

  if (!url) {
    console.error('✗ Set DIRECT_URL (preferred) or DATABASE_URL to a direct postgres:// URL.')
    process.exit(1)
  }
  if (url.startsWith('prisma+') || url.includes('accelerate.prisma-data.net')) {
    console.error(
      '✗ The URL is the Prisma Accelerate proxy (prisma+postgres://). DDL must run\n' +
        '  against a DIRECT postgres:// connection. Set DIRECT_URL to the underlying DB URL.'
    )
    process.exit(1)
  }

  console.log('═══════════════════════════════════════════════════')
  console.log(`  Economy UUID → TEXT  ${checkOnly ? '(check only — no writes)' : '(APPLY)'}`)
  console.log('═══════════════════════════════════════════════════\n')

  const client = new Client({ connectionString: url })
  await client.connect()

  let converted = 0
  let alreadyOk = 0
  let missing = 0
  let needsConversion = 0

  try {
    for (const { table, column } of TARGETS) {
      const { rows } = await client.query(
        `SELECT data_type FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [table, column]
      )

      if (rows.length === 0) {
        console.log(`  ?  ${table}.${column} — not found, skipping`)
        missing++
        continue
      }

      const type = String(rows[0].data_type)
      if (type === 'text' || type === 'character varying') {
        console.log(`  ✓  ${table}.${column} — already ${type}`)
        alreadyOk++
        continue
      }

      if (checkOnly) {
        console.log(`  !  ${table}.${column} — ${type} → needs conversion to TEXT`)
        needsConversion++
        continue
      }

      // DROP DEFAULT first: a uuid default (e.g. gen_random_uuid()) would be
      // invalid on a text column. No-op when there is no default.
      await client.query(`ALTER TABLE "${table}" ALTER COLUMN "${column}" DROP DEFAULT`)
      await client.query(
        `ALTER TABLE "${table}" ALTER COLUMN "${column}" TYPE TEXT USING "${column}"::text`
      )
      console.log(`  ↻  ${table}.${column} — ${type} → TEXT (converted)`)
      converted++
    }
  } finally {
    await client.end()
  }

  console.log('\n═══════════════════════════════════════════════════')
  if (checkOnly) {
    console.log(`  already TEXT:      ${alreadyOk}`)
    console.log(`  needs conversion:  ${needsConversion}`)
    console.log(`  missing:           ${missing}`)
    console.log(
      needsConversion > 0
        ? '\n  → Re-run WITHOUT --check to apply the conversion.'
        : '\n  → Nothing to do; economy columns already accept CUIDs.'
    )
  } else {
    console.log(`  converted:    ${converted}`)
    console.log(`  already TEXT: ${alreadyOk}`)
    console.log(`  missing:      ${missing}`)
    console.log('\n  → token_balances now accepts CUID user ids; getBalances will')
    console.log('    stop returning zeros. Next: provision-agentic-users.ts.')
  }
  console.log('═══════════════════════════════════════════════════')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})
