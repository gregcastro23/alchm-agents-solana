import 'server-only'

import { execFile } from 'node:child_process'
import path from 'node:path'
import { promisify } from 'node:util'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import {
  recentAdminActions,
  recordAdminAction,
  type AdminAuditActor,
  type AuditEntry,
  type AuditOutcome,
} from '@/lib/admin/audit'
import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'
import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  isAscendantCalculationsEligible,
  type AscendantEstimate,
  type AscendantProvenance,
  type NatalChart,
} from '@/lib/agent-types'
import { backend } from '@/lib/backend'

const execFileAsync = promisify(execFile)

export type DossierClassification =
  | 'archival_clue'
  | 'date_known_milestones'
  | 'approximate_or_symbolic_date'

export interface DossierTimeClue {
  source: string
  recordedMinuteLmt?: number | null
  startMinute?: number | null
  endMinute?: number | null
  marginMinutes?: number | null
  rodden?: string | null
  expectedSign?: string | null
}

export interface RectificationScoreResult {
  distribution: Record<string, number>
  top_sign: string
  top_sign_probability: number
  working_longitude: number
  working_sign: string
  working_time: string
  window_80_minutes: number
  credible_window_80: {
    startLocal: string
    endLocal: string
  }
  certainty: number
  is_calculations_eligible: boolean
  evidence_breakdown: Array<{
    evidence?: string
    type?: string
    max_log_shift?: number
    min_log_shift?: number
    null_discount_applied?: boolean
  }>
}

export interface RectificationProposalItem {
  agentId: string
  fileSlug: string
  name: string
  classification: DossierClassification
  rectifiable: boolean
  roddenRating: string
  dateConfidence: string
  dateUncertaintyReason: string | null
  birth: {
    year: number
    month: number
    day: number
    lat: number
    lon: number
    calendar: string
    locationName: string
  }
  timeClue: DossierTimeClue | null
  events: Array<Record<string, unknown>>
  notes: string | null
  score?: RectificationScoreResult | null
  recommendedProvenance?: string
  calculationsEligible?: boolean
}

export interface DbRectificationRow {
  agentId: string
  presentInDb: boolean
  codeAscendantProvenance: AscendantProvenance
  codeAscendantDeg: number | null
  dbAscendantProvenance: AscendantProvenance | null
  dbAscendantDeg: number | null
  dbCalculationsEligible: boolean
  dbEstimate: AscendantEstimate | null
  reviewStatus: 'pending' | 'approved' | 'rejected' | 'non-rectifiable'
  lastAudit: {
    action: string
    actorEmail: string | null
    at: string
    note: string | null
  } | null
}

export interface AuditEntrySummary {
  id: string
  action: string
  actorEmail: string | null
  actorSource: string
  targetId: string | null
  note: string | null
  createdAt: string
}

export interface RectificationAdminReport {
  generatedAt: string
  dossiersSource: 'fastapi' | 'python-cli' | 'unavailable'
  dossiers: Section<RectificationProposalItem[]>
  dbStates: Section<DbRectificationRow[]>
  auditTrail: Section<AuditEntrySummary[]>
  counts: {
    total: number | null
    archivalClue: number | null
    dateKnownMilestones: number | null
    nonRectifiable: number | null
    approvedInDb: number | null
    rejectedInAudit: number | null
    calculationsEligibleInDb: number | null
  }
  alerts: AdminAlert[]
}

export const RectifyEvidenceInputSchema = z.object({
  type: z.enum([
    'life_event',
    'time_clue',
    'recorded_time',
    'moon_sign',
    'angular_transits',
    'secondary_progressions',
    'annual_profections',
    'primary_directions',
    'physical_temperament',
  ]),
  description: z.string().trim().min(1).max(300),
  date: z.string().trim().max(40).optional(),
  category: z.string().trim().max(60).optional(),
  start_minute: z.number().int().min(0).max(1439).optional(),
  end_minute: z.number().int().min(0).max(1439).optional(),
  margin_minutes: z.number().int().min(1).max(240).optional(),
  reported_minute: z.number().int().min(0).max(1439).optional(),
  rodden_rating: z.string().trim().max(10).optional(),
  citation: z.string().trim().max(400).optional(),
  moon_sign: z.string().trim().max(20).optional(),
})

export const RectifyMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('score'),
    agentId: z.string().trim().min(1).max(120),
    evidence: z.array(RectifyEvidenceInputSchema).max(40).optional(),
    stepMinutes: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    action: z.literal('score_batch'),
    classification: z
      .enum(['archival_clue', 'date_known_milestones', 'approximate_or_symbolic_date'])
      .optional(),
    stepMinutes: z.number().int().min(1).max(10).optional(),
  }),
  z.object({
    action: z.literal('approve'),
    agentId: z.string().trim().min(1).max(120),
    evidence: z.array(RectifyEvidenceInputSchema).max(40).optional(),
    stepMinutes: z.number().int().min(1).max(10).optional(),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({
    action: z.literal('reject'),
    agentId: z.string().trim().min(1).max(120),
    note: z.string().trim().max(500).optional(),
  }),
])

export type RectifyMutationInput = z.infer<typeof RectifyMutationSchema>

export interface RectificationDeps {
  listDossiers: () => Promise<{
    source: 'fastapi' | 'python-cli'
    dossiers: RectificationProposalItem[]
  }>
  scoreDossier: (
    agentId: string,
    evidence?: Array<Record<string, unknown>>,
    stepMinutes?: number
  ) => Promise<RectificationProposalItem>
  scoreAllDossiers: (
    classification?: DossierClassification,
    stepMinutes?: number
  ) => Promise<RectificationProposalItem[]>
  findManyHistoricalAgents: (agentIds: string[]) => Promise<
    Array<{
      agentId: string
      natalChart: unknown
    }>
  >
  findUniqueHistoricalAgent: (agentId: string) => Promise<{
    id: string
    agentId: string
    name: string
    natalChart: unknown
  } | null>
  updateHistoricalAgentChart: (agentId: string, natalChart: Prisma.InputJsonValue) => Promise<void>
  readRecentAudits: (limit: number) => Promise<
    | {
        available: true
        entries: Array<{
          id: string
          actorEmail: string | null
          actorSource: string
          action: string
          targetType: string
          targetId: string
          before: unknown
          after: unknown
          note: string | null
          createdAt: string
        }>
      }
    | {
        available: false
        entries: Array<never>
        error: string
      }
  >
  recordAudit: (actor: AdminAuditActor, entry: AuditEntry) => Promise<AuditOutcome>
}

async function runPythonDossierCli(args: string[]): Promise<unknown> {
  const scriptPath = path.join(process.cwd(), 'backend/rectification_dossiers.py')
  const { stdout } = await execFileAsync('python3', [scriptPath, ...args], {
    cwd: process.cwd(),
    maxBuffer: 16 * 1024 * 1024,
    timeout: 120_000,
  })
  return JSON.parse(stdout)
}

function defaultDeps(): RectificationDeps {
  return {
    async listDossiers() {
      try {
        const res = await backend.rectify.proposals()
        if (res && Array.isArray(res.proposals)) {
          return {
            source: 'fastapi',
            dossiers: res.proposals as RectificationProposalItem[],
          }
        }
      } catch {
        // FastAPI server is optional in standalone Next.js or test runs; fall back to Python CLI.
      }
      const cli = (await runPythonDossierCli(['list'])) as {
        dossiers?: RectificationProposalItem[]
      }
      if (!cli || !Array.isArray(cli.dossiers)) {
        throw new Error('Dossier CLI returned an invalid payload')
      }
      return {
        source: 'python-cli',
        dossiers: cli.dossiers,
      }
    },

    async scoreDossier(agentId, evidence, stepMinutes = 5) {
      try {
        const res = await backend.rectify.scoreProposal(agentId, {
          evidence,
          step_minutes: stepMinutes,
        })
        if (res && res.agentId) {
          return res as RectificationProposalItem
        }
      } catch {
        // Fall back to direct Python Swiss Ephemeris execution when FastAPI is offline.
      }
      const cliArgs = ['score', agentId, '--step', String(stepMinutes)]
      if (evidence && evidence.length > 0) {
        cliArgs.push('--evidence-json', JSON.stringify(evidence))
      }
      const cli = (await runPythonDossierCli(cliArgs)) as RectificationProposalItem
      if (!cli || !cli.agentId) {
        throw new Error(`Could not score dossier for ${agentId}`)
      }
      return cli
    },

    async scoreAllDossiers(classification, stepMinutes = 5) {
      try {
        const res = await backend.rectify.scoreAllProposals({
          classification,
          step_minutes: stepMinutes,
        })
        if (res && Array.isArray(res.proposals)) {
          return res.proposals as RectificationProposalItem[]
        }
      } catch {
        // Fall back to local Python Swiss Ephemeris batch sweep.
      }
      const cliArgs = ['score-all', '--step', String(stepMinutes)]
      if (classification) {
        cliArgs.push('--classification', classification)
      }
      const cli = (await runPythonDossierCli(cliArgs)) as {
        proposals?: RectificationProposalItem[]
      }
      if (!cli || !Array.isArray(cli.proposals)) {
        throw new Error('Batch dossier scoring returned an invalid payload')
      }
      return cli.proposals
    },

    findManyHistoricalAgents(agentIds) {
      return prisma.historical_agents.findMany({
        where: { agentId: { in: agentIds } },
        select: { agentId: true, natalChart: true },
      })
    },

    findUniqueHistoricalAgent(agentId) {
      return prisma.historical_agents.findUnique({
        where: { agentId },
        select: { id: true, agentId: true, name: true, natalChart: true },
      })
    },

    async updateHistoricalAgentChart(agentId, natalChart) {
      await prisma.historical_agents.update({
        where: { agentId },
        data: { natalChart },
      })
    },

    readRecentAudits(limit) {
      return recentAdminActions(limit)
    },

    recordAudit(actor, entry) {
      return recordAdminAction(actor, entry)
    },
  }
}

function asChartRecord(value: unknown): Partial<NatalChart> & Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Partial<NatalChart> & Record<string, unknown>
  }
  return {}
}

function normalizeAscendantProvenance(value: unknown): AscendantProvenance {
  const valid: ReadonlySet<string> = new Set([
    'measured',
    'rectified',
    'sign-resolution',
    'unmeasured',
    'placeholder',
    'undated',
    'unattributed',
  ])
  return typeof value === 'string' && valid.has(value)
    ? (value as AscendantProvenance)
    : 'unattributed'
}

export async function buildRectificationReport(
  options?: {
    scoreAll?: boolean
    scoreAgentId?: string | null
    stepMinutes?: number
  },
  deps: RectificationDeps = defaultDeps()
): Promise<RectificationAdminReport> {
  const now = new Date()
  let dossiersSource: 'fastapi' | 'python-cli' | 'unavailable' = 'unavailable'

  const dossiersSection = await readSection(async () => {
    const listed = await deps.listDossiers()
    dossiersSource = listed.source

    if (options?.scoreAll) {
      const scored = await deps.scoreAllDossiers(undefined, options.stepMinutes ?? 5)
      const byId = new Map(scored.map(item => [item.agentId, item]))
      return listed.dossiers.map(d => byId.get(d.agentId) ?? d)
    }

    if (options?.scoreAgentId) {
      const scored = await deps.scoreDossier(
        options.scoreAgentId,
        undefined,
        options.stepMinutes ?? 5
      )
      return listed.dossiers.map(d => (d.agentId === scored.agentId ? scored : d))
    }

    return listed.dossiers
  })

  const auditRes = await deps.readRecentAudits(200)
  const rectificationAudits: AuditEntrySummary[] = auditRes.available
    ? auditRes.entries
        .filter(e => e.action === 'rectification.approve' || e.action === 'rectification.reject')
        .map(e => ({
          id: e.id,
          action: e.action,
          actorEmail: e.actorEmail,
          actorSource: e.actorSource,
          targetId: e.targetId,
          note: e.note,
          createdAt: e.createdAt,
        }))
    : []

  const auditTrailSection: Section<AuditEntrySummary[]> = auditRes.available
    ? { ok: true, value: rectificationAudits }
    : { ok: false, reason: auditRes.error }

  const latestAuditByAgent = new Map<string, AuditEntrySummary>()
  for (const entry of rectificationAudits) {
    if (entry.targetId && !latestAuditByAgent.has(entry.targetId)) {
      latestAuditByAgent.set(entry.targetId, entry)
    }
  }

  const dbStatesSection = await readSection(async () => {
    const dossierList = dossiersSection.ok ? dossiersSection.value : []
    const agentIds = dossierList.map(d => d.agentId)
    const dbRows = agentIds.length > 0 ? await deps.findManyHistoricalAgents(agentIds) : []
    const dbById = new Map(dbRows.map(row => [row.agentId, row]))

    return dossierList.map((dossier): DbRectificationRow => {
      const codeAgent = getHistoricalAgent(dossier.agentId)
      const codeChart = codeAgent?.consciousness.natalChart
      const codeProv = normalizeAscendantProvenance(codeChart?.ascendantProvenance)
      const codeDeg = typeof codeChart?.ascendant === 'number' ? codeChart.ascendant : null

      const dbRow = dbById.get(dossier.agentId)
      const dbChart = dbRow ? asChartRecord(dbRow.natalChart) : null
      const dbProv = dbChart ? normalizeAscendantProvenance(dbChart.ascendantProvenance) : null
      const dbDeg = dbChart && typeof dbChart.ascendant === 'number' ? dbChart.ascendant : null
      const dbEstimate =
        dbChart && dbChart.ascendantEstimate && typeof dbChart.ascendantEstimate === 'object'
          ? (dbChart.ascendantEstimate as AscendantEstimate)
          : null

      const dbEligible = dbChart
        ? isAscendantCalculationsEligible({
            ascendantProvenance: dbProv ?? 'unattributed',
            ascendant: dbDeg,
            ascendantEstimate: dbEstimate ?? undefined,
          })
        : false

      const auditEntry = latestAuditByAgent.get(dossier.agentId) ?? null
      let reviewStatus: DbRectificationRow['reviewStatus'] = 'pending'
      if (!dossier.rectifiable) {
        reviewStatus = 'non-rectifiable'
      } else if (dbProv === 'rectified') {
        reviewStatus = 'approved'
      } else if (auditEntry?.action === 'rectification.reject') {
        reviewStatus = 'rejected'
      }

      return {
        agentId: dossier.agentId,
        presentInDb: Boolean(dbRow),
        codeAscendantProvenance: codeProv,
        codeAscendantDeg: codeDeg,
        dbAscendantProvenance: dbProv,
        dbAscendantDeg: dbDeg,
        dbCalculationsEligible: dbEligible,
        dbEstimate,
        reviewStatus,
        lastAudit: auditEntry
          ? {
              action: auditEntry.action,
              actorEmail: auditEntry.actorEmail,
              at: auditEntry.createdAt,
              note: auditEntry.note,
            }
          : null,
      }
    })
  })

  const alerts: AdminAlert[] = []
  if (!dossiersSection.ok) {
    alerts.push({
      id: 'rectification:dossiers-unreadable',
      severity: 'critical',
      source: 'agents',
      title: 'Historical rectification dossier service unreachable',
      detail: dossiersSection.reason,
      href: '/admin/rectification',
      remediation: 'Verify FastAPI backend (:8000) or Python 3 + pyswisseph runtime availability.',
    })
  }
  if (!dbStatesSection.ok) {
    alerts.push({
      id: 'rectification:db-unreadable',
      severity: 'warning',
      source: 'agents',
      title: 'Could not read historical_agents natalChart status from Postgres',
      detail: dbStatesSection.reason,
      href: '/admin/rectification',
    })
  }
  if (!auditTrailSection.ok) {
    alerts.push({
      id: 'rectification:audit-unreadable',
      severity: 'warning',
      source: 'infrastructure',
      title: 'Admin audit log is unavailable',
      detail: auditTrailSection.reason,
      href: '/admin/rectification',
      remediation: 'Approval and rejection writes are blocked until admin_audit_log is writable.',
    })
  }

  const dossiersList = dossiersSection.ok ? dossiersSection.value : null
  const dbList = dbStatesSection.ok ? dbStatesSection.value : null

  return {
    generatedAt: now.toISOString(),
    dossiersSource,
    dossiers: dossiersSection,
    dbStates: dbStatesSection,
    auditTrail: auditTrailSection,
    counts: {
      total: dossiersList ? dossiersList.length : null,
      archivalClue: dossiersList
        ? dossiersList.filter(d => d.classification === 'archival_clue').length
        : null,
      dateKnownMilestones: dossiersList
        ? dossiersList.filter(d => d.classification === 'date_known_milestones').length
        : null,
      nonRectifiable: dossiersList ? dossiersList.filter(d => !d.rectifiable).length : null,
      approvedInDb: dbList
        ? dbList.filter(r => r.dbAscendantProvenance === 'rectified').length
        : null,
      rejectedInAudit: dbList ? dbList.filter(r => r.reviewStatus === 'rejected').length : null,
      calculationsEligibleInDb: dbList
        ? dbList.filter(r => r.dbAscendantProvenance === 'rectified' && r.dbCalculationsEligible)
            .length
        : null,
    },
    alerts,
  }
}

export function buildAscendantEstimateFromScore(
  proposal: RectificationProposalItem,
  score: RectificationScoreResult,
  actorEmail: string,
  nowIso: string
): AscendantEstimate {
  const breakdown = Array.isArray(score.evidence_breakdown) ? score.evidence_breakdown : []
  return {
    distribution: score.distribution,
    topSign: score.top_sign,
    topSignProbability: score.top_sign_probability,
    workingLongitude: score.working_longitude,
    workingSign: score.working_sign,
    window80Minutes: score.window_80_minutes,
    credibleWindow80: {
      startLocal: score.credible_window_80.startLocal,
      endLocal: score.credible_window_80.endLocal,
    },
    certainty: score.certainty,
    evidence: (proposal.events ?? []).map((ev, idx) => {
      const b = breakdown[idx]
      const desc =
        typeof ev.description === 'string' && ev.description.trim()
          ? ev.description.trim()
          : typeof ev.date === 'string'
            ? ev.date
            : `Evidence #${idx + 1}`
      return {
        type: typeof ev.type === 'string' ? ev.type : 'life_event',
        description: desc,
        citation:
          typeof ev.citation === 'string' ? ev.citation : (proposal.timeClue?.source ?? undefined),
        approvedBy: actorEmail,
        approvedAt: nowIso,
        likelihoodWeight: b && typeof b.max_log_shift === 'number' ? b.max_log_shift : undefined,
      }
    }),
    method: `Western Bayesian Sweep v1 (pyswisseph, working_time=${score.working_time} LMT, 48y null-baseline)`,
  }
}

export interface RectificationActionResult {
  status: number
  body: Record<string, unknown>
}

export async function executeRectificationAction(
  input: RectifyMutationInput,
  admin: AdminAuditActor,
  deps: RectificationDeps = defaultDeps()
): Promise<RectificationActionResult> {
  if (input.action === 'score') {
    const proposal = await deps.scoreDossier(
      input.agentId,
      input.evidence as Array<Record<string, unknown>> | undefined,
      input.stepMinutes ?? 5
    )
    return {
      status: 200,
      body: {
        success: true,
        proposal,
      },
    }
  }

  if (input.action === 'score_batch') {
    const proposals = await deps.scoreAllDossiers(input.classification, input.stepMinutes ?? 5)
    return {
      status: 200,
      body: {
        success: true,
        count: proposals.length,
        proposals,
      },
    }
  }

  if (input.action === 'approve') {
    const proposal = await deps.scoreDossier(
      input.agentId,
      input.evidence as Array<Record<string, unknown>> | undefined,
      input.stepMinutes ?? 5
    )

    if (!proposal.rectifiable && (!input.evidence || input.evidence.length === 0)) {
      return {
        status: 400,
        body: {
          success: false,
          error: `${proposal.name} is classified as non-rectifiable (${proposal.dateUncertaintyReason ?? 'undated figure'}). Supply verified dated evidence or keep undated.`,
        },
      }
    }

    if (!proposal.score) {
      return {
        status: 400,
        body: {
          success: false,
          error: `No Swiss Ephemeris posterior score was produced for ${proposal.agentId}.`,
        },
      }
    }

    const dbRow = await deps.findUniqueHistoricalAgent(proposal.agentId)
    if (!dbRow) {
      return {
        status: 404,
        body: {
          success: false,
          error: `No historical_agents row found for ${proposal.agentId}; seed historical_agents before approving rectification.`,
        },
      }
    }

    const nowIso = new Date().toISOString()
    const score = proposal.score
    const actorEmail = admin.user.email ?? admin.source
    const ascendantEstimate = buildAscendantEstimateFromScore(proposal, score, actorEmail, nowIso)
    const calculationsEligible = isAscendantCalculationsEligible({
      ascendantProvenance: 'rectified',
      ascendant: score.working_longitude,
      ascendantEstimate,
    })

    const existingChart = asChartRecord(dbRow.natalChart)
    const existingAscendant =
      typeof existingChart.ascendant === 'number' ? existingChart.ascendant : null
    const before = {
      ascendant: existingAscendant,
      ascendantProvenance: normalizeAscendantProvenance(existingChart.ascendantProvenance),
      calculationsEligible: isAscendantCalculationsEligible({
        ascendantProvenance: normalizeAscendantProvenance(existingChart.ascendantProvenance),
        ascendant: existingAscendant,
        ascendantEstimate:
          existingChart.ascendantEstimate && typeof existingChart.ascendantEstimate === 'object'
            ? (existingChart.ascendantEstimate as AscendantEstimate)
            : undefined,
      }),
    }
    const after = {
      ascendant: score.working_longitude,
      ascendantProvenance: 'rectified' as const,
      workingSign: score.working_sign,
      workingTimeLmt: score.working_time,
      topSign: score.top_sign,
      topSignProbability: score.top_sign_probability,
      window80Minutes: score.window_80_minutes,
      calculationsEligible,
      evidenceCount: ascendantEstimate.evidence.length,
    }

    const audit = await deps.recordAudit(admin, {
      action: 'rectification.approve',
      targetType: 'historical_agent',
      targetId: proposal.agentId,
      before,
      after,
      note: input.note,
    })

    if (!audit.recorded) {
      return {
        status: 503,
        body: {
          success: false,
          error: `Mandatory audit write failed: ${audit.reason}`,
        },
      }
    }

    const updatedChart: Record<string, unknown> = {
      ...existingChart,
      ascendant: score.working_longitude,
      ascendantProvenance: 'rectified',
      ascendantEstimate,
    }

    await deps.updateHistoricalAgentChart(proposal.agentId, updatedChart as Prisma.InputJsonValue)

    return {
      status: 200,
      body: {
        success: true,
        agentId: proposal.agentId,
        calculationsEligible,
        ascendant: score.working_longitude,
        ascendantProvenance: 'rectified',
        ascendantEstimate,
        audit,
      },
    }
  }

  // input.action === 'reject'
  const listed = await deps.listDossiers()
  const matched = listed.dossiers.find(
    d => d.agentId === input.agentId || d.fileSlug === input.agentId
  )
  const canonicalId = matched?.agentId ?? getHistoricalAgent(input.agentId)?.id
  if (!canonicalId) {
    return {
      status: 404,
      body: {
        success: false,
        error: `Unknown historical agent dossier: ${input.agentId}`,
      },
    }
  }

  const dbRow = await deps.findUniqueHistoricalAgent(canonicalId)
  const existingChart = dbRow ? asChartRecord(dbRow.natalChart) : {}
  const prevProvenance = dbRow
    ? normalizeAscendantProvenance(existingChart.ascendantProvenance)
    : null
  const codeAgent = getHistoricalAgent(canonicalId)
  const codeChart = codeAgent?.consciousness.natalChart
  const baselineProvenance: AscendantProvenance =
    codeChart?.ascendantProvenance ?? (matched?.rectifiable ? 'unmeasured' : 'undated')
  const baselineAscendant = codeChart?.ascendant !== undefined ? codeChart.ascendant : null

  const willRevertDb = Boolean(dbRow && prevProvenance === 'rectified')

  const audit = await deps.recordAudit(admin, {
    action: 'rectification.reject',
    targetType: 'historical_agent',
    targetId: canonicalId,
    before: dbRow
      ? {
          ascendant: existingChart.ascendant ?? null,
          ascendantProvenance: prevProvenance,
        }
      : { presentInDb: false },
    after: willRevertDb
      ? {
          ascendant: baselineAscendant,
          ascendantProvenance: baselineProvenance,
          revertedFromRectified: true,
        }
      : {
          status: 'rejected',
          preservedProvenance: prevProvenance ?? baselineProvenance,
        },
    note: input.note,
  })

  if (!audit.recorded) {
    return {
      status: 503,
      body: {
        success: false,
        error: `Mandatory audit write failed: ${audit.reason}`,
      },
    }
  }

  if (willRevertDb) {
    const nextChart: Record<string, unknown> = { ...existingChart }
    nextChart.ascendant = baselineAscendant
    nextChart.ascendantProvenance = baselineProvenance
    delete nextChart.ascendantEstimate
    await deps.updateHistoricalAgentChart(canonicalId, nextChart as Prisma.InputJsonValue)
  }

  return {
    status: 200,
    body: {
      success: true,
      agentId: canonicalId,
      revertedFromRectified: willRevertDb,
      ascendantProvenance: willRevertDb
        ? baselineProvenance
        : (prevProvenance ?? baselineProvenance),
      audit,
    },
  }
}
