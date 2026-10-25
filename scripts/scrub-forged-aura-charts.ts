/**
 * Scrub the owner's birth chart out of forged vessels' `aura`.
 * ------------------------------------------------------------
 * Until this change `/api/create-agent` stored the whole chart synthesis in
 * `historical_agents.aura`, and `aura.sourceCharts` held a second, complete
 * copy of the owner's natal chart (every body's sign and degree, the
 * ascendant, the houses). The writer no longer stores it and the readers no
 * longer serve it, but rows written before the fix still carry it. This removes
 * the key from those rows. Nothing reads it back: the chart lives in the
 * `natalChart` column, which is untouched.
 *
 * MUST BE RUN ONCE PER ENVIRONMENT (every database the app or the Railway
 * backend reads: production, preview, staging), after the fix is deployed.
 *
 * Dry-run by default: it only counts. Pass --apply to write.
 *
 *     DATABASE_URL=postgres://... bun run scripts/scrub-forged-aura-charts.ts
 *     DATABASE_URL=postgres://... bun run scripts/scrub-forged-aura-charts.ts --apply
 *
 * Refuses to run without DATABASE_URL, so it can never fall back to whatever
 * database a developer's shell happens to point at. Prints the target as
 * host/database only, never the credentials. Idempotent: a second run finds
 * nothing and changes nothing.
 */
import { PrismaClient } from '@prisma/client'

/** `historical_agents.craftedBy` of every row `/api/create-agent` writes. */
const FORGED_CRAFTED_BY = 'philosopher-stone-user'

export interface ScrubOptions {
  apply: boolean
  help: boolean
  unknown: string[]
}

export function parseArgs(argv: readonly string[]): ScrubOptions {
  const flags = argv.filter(arg => arg.startsWith('-'))
  return {
    apply: flags.includes('--apply'),
    help: flags.includes('--help') || flags.includes('-h'),
    unknown: flags.filter(flag => !['--apply', '--help', '-h'].includes(flag)),
  }
}

/** `host:port/database` of a connection string, with the user, password and query dropped. */
export function describeTarget(connectionString: string): string {
  try {
    const url = new URL(connectionString)
    return `${url.host}${url.pathname}`
  } catch {
    return '(unparseable connection string)'
  }
}

/** Why the script must not run, or null when it may. */
export function refusalReason(env: Record<string, string | undefined>): string | null {
  if (!env.DATABASE_URL || !env.DATABASE_URL.trim()) {
    return 'DATABASE_URL is not set. Refusing to guess which database to scrub.'
  }
  return null
}

const USAGE = `Usage: bun run scripts/scrub-forged-aura-charts.ts [--apply]

  (no flag)  dry-run: count the forged vessels whose aura still holds sourceCharts
  --apply    remove aura.sourceCharts from those rows

Requires DATABASE_URL. Run once per environment.`

/** The slice of PrismaClient the script uses; a test hands in a fake. */
export type ScrubClient = Pick<PrismaClient, '$queryRaw' | '$executeRaw' | '$disconnect'>

export interface RunDeps {
  argv: readonly string[]
  env: Record<string, string | undefined>
  makeClient?: () => ScrubClient
  log?: (line: string) => void
  error?: (line: string) => void
}

/** Returns the process exit code: 0 ok, 1 the scrub did not take, 2 refused to run. */
export async function run(deps: RunDeps): Promise<number> {
  const log = deps.log ?? console.log
  const error = deps.error ?? console.error
  const options = parseArgs(deps.argv)
  if (options.help) {
    log(USAGE)
    return 0
  }
  if (options.unknown.length > 0) {
    error(`Unknown option(s): ${options.unknown.join(' ')}\n\n${USAGE}`)
    return 2
  }

  const refusal = refusalReason(deps.env)
  if (refusal) {
    error(refusal)
    return 2
  }

  log(`Target:  ${describeTarget(deps.env.DATABASE_URL as string)}`)
  log(`Mode:    ${options.apply ? 'APPLY (writes)' : 'dry-run (no writes)'}`)

  const prisma = (deps.makeClient ?? (() => new PrismaClient()))()
  try {
    const count = async () => {
      const rows = await prisma.$queryRaw<Array<{ forged: bigint; with_charts: bigint }>>`
        SELECT
          count(*) AS forged,
          count(*) FILTER (WHERE jsonb_exists("aura", 'sourceCharts')) AS with_charts
        FROM "historical_agents"
        WHERE "craftedBy" = ${FORGED_CRAFTED_BY}`
      return {
        forged: Number(rows[0]?.forged ?? 0),
        withCharts: Number(rows[0]?.with_charts ?? 0),
      }
    }

    const before = await count()
    log(`Forged vessels (craftedBy = '${FORGED_CRAFTED_BY}'): ${before.forged}`)
    log(`  aura.sourceCharts present: ${before.withCharts}`)

    // Not touched, only reported: a chart copy on any other row is not this script's to remove.
    const elsewhere = await prisma.$queryRaw<Array<{ n: bigint }>>`
      SELECT count(*) AS n
      FROM "historical_agents"
      WHERE "craftedBy" IS DISTINCT FROM ${FORGED_CRAFTED_BY}
        AND jsonb_exists("aura", 'sourceCharts')`
    log(
      `  rows OUTSIDE that predicate with aura.sourceCharts (left alone): ${Number(elsewhere[0]?.n ?? 0)}`
    )

    if (!options.apply) {
      log(
        before.withCharts > 0
          ? `\nDry-run: ${before.withCharts} row(s) would be scrubbed. Re-run with --apply.`
          : '\nDry-run: nothing to scrub.'
      )
      return 0
    }

    if (before.withCharts === 0) {
      log('\nNothing to scrub.')
      return 0
    }

    const changed = await prisma.$executeRaw`
      UPDATE "historical_agents"
      SET "aura" = "aura" - 'sourceCharts'::text
      WHERE "craftedBy" = ${FORGED_CRAFTED_BY}
        AND jsonb_exists("aura", 'sourceCharts')`
    log(`\nScrubbed ${changed} row(s).`)

    const after = await count()
    log(`Remaining with aura.sourceCharts: ${after.withCharts}`)
    if (after.withCharts !== 0) {
      error('Rows still carry aura.sourceCharts after the update. Investigate.')
      return 1
    }
    return 0
  } finally {
    await prisma.$disconnect()
  }
}

if (import.meta.main) {
  run({ argv: process.argv.slice(2), env: process.env })
    .then(code => process.exit(code))
    .catch(err => {
      console.error('Scrub failed:', err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
