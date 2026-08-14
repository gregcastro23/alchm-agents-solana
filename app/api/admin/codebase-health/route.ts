import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { alertIf, sortAlerts, type AdminAlert } from '@/lib/admin/alerts'
import { minutesSince, percent } from '@/lib/admin/serialize'
import manifestJson from '@/lib/admin/codebase-health-manifest.json'
import type { CodebaseHealthManifest } from '@/lib/admin/codebase-health-types'

export const dynamic = 'force-dynamic'

/**
 * Codebase weak points and unfinished work.
 *
 * The static half comes from `lib/admin/codebase-health-manifest.json`, written
 * by `bun run generate:codebase-health` at build time. It is imported rather
 * than read from disk on purpose: Vercel ships a bundle, not the repo, so an
 * `fs` scan at request time would silently report a clean codebase in exactly
 * the environment where the answer matters. The manifest's own age is reported
 * so a stale picture is never mistaken for a live one.
 *
 * The live half comes from the database — data-shaped debt (agents with no
 * chart, conversations with no model recorded) that the file scan cannot see.
 */

/** Age at which the committed manifest stops describing the current tree. */
const MANIFEST_STALE_DAYS = 14

// The JSON import is widened to the declared format: TypeScript would otherwise
// infer literal types from whichever scan happens to be committed.
const manifest = manifestJson as unknown as CodebaseHealthManifest

export async function GET(_req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const alerts: AdminAlert[] = []
  const now = Date.now()
  const typed = manifest

  const manifestAgeMinutes = minutesSince(typed.generatedAt, now)
  const manifestAgeDays = manifestAgeMinutes === null ? null : manifestAgeMinutes / (60 * 24)

  // ── Live data-shaped debt ────────────────────────────────────────────────
  let live: {
    agentsWithoutNatalChart: number
    agentsNeverConsulted: number
    totalAgents: number
    conversationsMissingModel: number
    conversationsTotal: number
    orphanProfiles: number
  } | null = null
  let liveError: string | null = null

  try {
    const [totalAgents, neverConsulted, conversationsTotal, missingModel, usersTotal, profiles] =
      await Promise.all([
        prisma.historical_agents.count(),
        prisma.historical_agents.count({ where: { conversations: { lte: 0 } } }),
        prisma.agentConversation.count(),
        prisma.agentConversation.count({ where: { modelUsed: null } }),
        prisma.users.count(),
        prisma.user_profiles.count(),
      ])

    live = {
      totalAgents,
      agentsNeverConsulted: neverConsulted,
      // The roster's chart data lives in the TS source, not the DB, so the
      // authoritative placeholder count is the manifest's — this is the
      // complementary DB-side signal only.
      agentsWithoutNatalChart: Math.max(0, usersTotal - profiles),
      conversationsTotal,
      conversationsMissingModel: missingModel,
      orphanProfiles: Math.max(0, profiles - usersTotal),
    }
  } catch (error) {
    liveError = error instanceof Error ? error.message : String(error)
  }

  // ── Rules ────────────────────────────────────────────────────────────────
  alertIf(alerts, manifestAgeDays !== null && manifestAgeDays > MANIFEST_STALE_DAYS, {
    id: 'codebase:manifest-stale',
    severity: 'warning',
    source: 'codebase',
    title: 'Codebase health manifest is stale',
    detail: `Scanned ${Math.round(manifestAgeDays ?? 0)} days ago at commit ${typed.commit ?? 'unknown'}. Everything on this tab describes the tree as it was then, not as it is now.`,
    remediation: 'Run `bun run generate:codebase-health` and commit the manifest.',
  })

  const failingGates = typed.gates.filter(gate => !gate.passing)
  for (const gate of failingGates) {
    alerts.push({
      id: `codebase:gate-failing:${gate.id}`,
      severity: 'critical',
      source: 'codebase',
      title: `Repo gate failing: ${gate.label}`,
      detail: gate.output?.slice(-400) ?? 'The gate exited non-zero.',
      remediation: `Run \`${gate.command}\` locally and fix what it names.`,
    })
  }

  const placeholders = typed.natalProvenance.placeholders.length
  alertIf(alerts, placeholders > 0, {
    id: 'codebase:placeholder-charts',
    severity: 'warning',
    source: 'codebase',
    title: `${placeholders} historical agent(s) still on a placeholder natal chart`,
    detail: `Of ${typed.natalProvenance.total} agents: ${Object.entries(
      typed.natalProvenance.counts
    )
      .map(([k, v]) => `${v} ${k}`)
      .join(
        ', '
      )}. A placeholder chart is a chart nobody derived — every Sacred 7 stat and persona nuance downstream of it is unfounded.`,
    remediation:
      'Compute each chart against a real ephemeris and record tool, version and UT instant in provenanceNote.',
  })

  alertIf(alerts, typed.routeCoverage.coveragePct < 50, {
    id: 'codebase:route-coverage',
    severity: 'warning',
    source: 'codebase',
    title: `${typed.routeCoverage.untestedCount} of ${typed.routeCoverage.totalRoutes} API routes have no test naming them`,
    detail: `${typed.routeCoverage.coveragePct}% of routes are referenced by a test file. Untested routes are where a regression ships unnoticed.`,
  })

  alertIf(alerts, typed.byKind['skipped-test'] > 0, {
    id: 'codebase:skipped-tests',
    severity: 'info',
    source: 'codebase',
    title: `${typed.byKind['skipped-test']} skipped or todo test(s)`,
    detail: 'A skipped test passes CI without asserting anything.',
  })

  const unfinished =
    (typed.byKind.todo ?? 0) + (typed.byKind.fixme ?? 0) + (typed.byKind['not-implemented'] ?? 0)
  alertIf(alerts, unfinished > 0, {
    id: 'codebase:unfinished-markers',
    severity: 'info',
    source: 'codebase',
    title: `${unfinished} unfinished-work marker(s) in source`,
    detail: 'TODO / FIXME / not-implemented markers left in the scanned trees.',
  })

  if (typed.typeErrors.ran) {
    alertIf(alerts, typed.typeErrors.total > 0, {
      id: 'codebase:type-errors',
      severity: 'warning',
      source: 'codebase',
      title: `${typed.typeErrors.total} TypeScript error(s)`,
      detail:
        'next.config.mjs sets typescript.ignoreBuildErrors, so these ship. The build will not catch them for you.',
      remediation: 'Work the list in `typeErrors.byFile` from the top down.',
    })
  } else {
    alerts.push({
      id: 'codebase:type-census-skipped',
      severity: 'info',
      source: 'codebase',
      title: 'TypeScript error census was not run',
      detail:
        'The manifest was generated without --with-typecheck, so the error count here is unknown rather than zero.',
      remediation: 'Run `bun run generate:codebase-health:full` to include it.',
    })
  }

  if (live) {
    alertIf(alerts, live.conversationsTotal > 0 && live.conversationsMissingModel > 0, {
      id: 'codebase:conversations-missing-model',
      severity: 'info',
      source: 'codebase',
      title: `${live.conversationsMissingModel} conversation(s) recorded with no model`,
      detail: `${percent(live.conversationsMissingModel, live.conversationsTotal)}% of ${live.conversationsTotal} logged conversations have modelUsed = null, so provider attribution and cost accounting are incomplete for them.`,
    })
  }

  if (liveError) {
    alerts.push({
      id: 'codebase:live-signals-unreadable',
      severity: 'warning',
      source: 'codebase',
      title: 'Live codebase signals could not be read',
      detail: liveError,
    })
  }

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    manifest: {
      ...typed,
      ageMinutes: manifestAgeMinutes,
      staleAfterDays: MANIFEST_STALE_DAYS,
      stale: manifestAgeDays !== null && manifestAgeDays > MANIFEST_STALE_DAYS,
    },
    live,
    liveError,
    alerts: sortAlerts(alerts),
  })
}
