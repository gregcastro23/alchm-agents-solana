// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

vi.mock('server-only', () => ({}))

vi.mock('@/lib/db', () => ({
  prisma: {
    historical_agents: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    admin_audit_log: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/admin-auth', () => ({
  requireAdmin: vi.fn(),
  adminErrorResponse: (result: { status: number; error: string }) =>
    NextResponse.json({ error: result.error }, { status: result.status }),
}))

vi.mock('@/lib/security/privileged-api-auth', () => ({
  requireAdminRequest: vi.fn(),
}))

import { requireAdmin } from '@/lib/admin-auth'
import { requireAdminRequest } from '@/lib/security/privileged-api-auth'
import { GET, POST } from '@/app/api/admin/rectify/route'
import {
  buildRectificationReport,
  executeRectificationAction,
  type RectificationDeps,
  type RectificationProposalItem,
} from '@/lib/admin/rectification'
import { RectificationReportSchema } from '@/lib/admin/page-schemas'

const requireAdminMock = vi.mocked(requireAdmin)
const requireAdminRequestMock = vi.mocked(requireAdminRequest)

const ADMIN_ACTOR = {
  ok: true as const,
  source: 'session' as const,
  user: { id: 'admin-1', email: 'ops@alchmagents.eth', name: 'Ops', role: 'admin' },
}

function makeDistribution(topSign: string, topProb: number): Record<string, number> {
  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]
  const rest = (1 - topProb) / 11
  return Object.fromEntries(signs.map(s => [s, s === topSign ? topProb : Number(rest.toFixed(6))]))
}

const LEONARDO_PROPOSAL: RectificationProposalItem = {
  agentId: 'leonardo-da-vinci',
  fileSlug: 'leonardo-da-vinci',
  name: 'Leonardo da Vinci',
  classification: 'archival_clue',
  rectifiable: true,
  roddenRating: 'B',
  dateConfidence: 'exact',
  dateUncertaintyReason: null,
  birth: {
    year: 1452,
    month: 4,
    day: 15,
    lat: 43.7833,
    lon: 11.25,
    calendar: 'julian',
    locationName: 'Vinci, Republic of Florence',
  },
  timeClue: {
    source: 'Ser Antonio notarial entry (alle tre ore di notte)',
    startMinute: 1280,
    endMinute: 1380,
    marginMinutes: 35,
    rodden: 'B',
  },
  events: [
    {
      type: 'time_clue',
      start_minute: 1280,
      end_minute: 1380,
      description: 'Alle tre ore di notte (~22:00 LMT)',
    },
    {
      type: 'life_event',
      category: 'career',
      date: '1483-04-25',
      description: 'Contract signed for Virgin of the Rocks',
    },
  ],
  notes: null,
  score: {
    distribution: makeDistribution('Sagittarius', 0.7354),
    top_sign: 'Sagittarius',
    top_sign_probability: 0.7354,
    working_longitude: 259.74,
    working_sign: 'Sagittarius',
    working_time: '22:40',
    window_80_minutes: 80,
    credible_window_80: { startLocal: '21:00', endLocal: '23:55' },
    certainty: 0.6945,
    is_calculations_eligible: true,
    evidence_breakdown: [
      {
        evidence: 'Alle tre ore di notte',
        type: 'time_clue',
        max_log_shift: 0,
        null_discount_applied: false,
      },
      {
        evidence: 'Virgin of the Rocks',
        type: 'life_event',
        max_log_shift: 2.384,
        null_discount_applied: true,
      },
    ],
  },
  recommendedProvenance: 'rectified',
  calculationsEligible: true,
}

const DARWIN_LOW_PROPOSAL: RectificationProposalItem = {
  agentId: 'charles-darwin-1809',
  fileSlug: 'charles-darwin',
  name: 'Charles Darwin',
  classification: 'date_known_milestones',
  rectifiable: true,
  roddenRating: 'X',
  dateConfidence: 'exact',
  dateUncertaintyReason: null,
  birth: {
    year: 1809,
    month: 2,
    day: 12,
    lat: 52.708,
    lon: -2.754,
    calendar: 'gregorian',
    locationName: 'Shrewsbury, England',
  },
  timeClue: null,
  events: [
    {
      type: 'life_event',
      category: 'career',
      date: '1859-11-24',
      description: 'Publication of On the Origin of Species',
    },
  ],
  notes: null,
  score: {
    distribution: makeDistribution('Virgo', 0.172),
    top_sign: 'Virgo',
    top_sign_probability: 0.172,
    working_longitude: 157.41,
    working_sign: 'Virgo',
    working_time: '18:20',
    window_80_minutes: 485,
    credible_window_80: { startLocal: '05:10', endLocal: '21:15' },
    certainty: 0.12,
    is_calculations_eligible: false,
    evidence_breakdown: [
      {
        evidence: 'Origin of Species',
        type: 'life_event',
        max_log_shift: 1.45,
        null_discount_applied: true,
      },
    ],
  },
  recommendedProvenance: 'rectified',
  calculationsEligible: false,
}

const LAO_TZU_PROPOSAL: RectificationProposalItem = {
  agentId: 'lao-tzu',
  fileSlug: 'lao-tzu',
  name: 'Lao Tzu',
  classification: 'approximate_or_symbolic_date',
  rectifiable: false,
  roddenRating: 'XX',
  dateConfidence: 'disputed',
  dateUncertaintyReason: 'Legend; no verifiable historical birth date.',
  birth: {
    year: -600,
    month: 4,
    day: 8,
    lat: 34.7578,
    lon: 113.6553,
    calendar: 'julian',
    locationName: 'Chu State, China',
  },
  timeClue: null,
  events: [],
  notes: null,
  score: null,
  recommendedProvenance: 'undated',
  calculationsEligible: false,
}

function makeDeps(overrides?: Partial<RectificationDeps>): RectificationDeps {
  return {
    listDossiers: vi.fn(async () => ({
      source: 'python-cli' as const,
      dossiers: [LEONARDO_PROPOSAL, DARWIN_LOW_PROPOSAL, LAO_TZU_PROPOSAL],
    })),
    scoreDossier: vi.fn(async (id: string) => {
      if (id === 'leonardo-da-vinci') return LEONARDO_PROPOSAL
      if (id === 'charles-darwin-1809' || id === 'charles-darwin') return DARWIN_LOW_PROPOSAL
      if (id === 'lao-tzu') return LAO_TZU_PROPOSAL
      throw new Error(`Unknown dossier ${id}`)
    }),
    scoreAllDossiers: vi.fn(async () => [LEONARDO_PROPOSAL, DARWIN_LOW_PROPOSAL, LAO_TZU_PROPOSAL]),
    findManyHistoricalAgents: vi.fn(async () => [
      {
        agentId: 'leonardo-da-vinci',
        natalChart: {
          planets: { Sun: { sign: 'Taurus', degree: 5 } },
          ascendant: 180,
          ascendantProvenance: 'unmeasured',
        },
      },
      {
        agentId: 'charles-darwin-1809',
        natalChart: {
          planets: { Sun: { sign: 'Aquarius', degree: 23 } },
          ascendant: 180,
          ascendantProvenance: 'unmeasured',
        },
      },
    ]),
    findUniqueHistoricalAgent: vi.fn(async (agentId: string) => {
      if (agentId === 'leonardo-da-vinci' || agentId === 'charles-darwin-1809') {
        return {
          id: `row-${agentId}`,
          agentId,
          name: agentId,
          natalChart: {
            planets: { Sun: { sign: 'Taurus', degree: 5, retrograde: false } },
            houses: { '1': 180 },
            aspects: [],
            ascendant: 180,
            midheaven: 90,
            provenance: 'computed',
            ascendantProvenance: 'unmeasured',
          },
        }
      }
      return null
    }),
    updateHistoricalAgentChart: vi.fn(async () => {}),
    readRecentAudits: vi.fn(async () => ({ available: true as const, entries: [] })),
    recordAudit: vi.fn(async () => ({ recorded: true as const, id: 'audit-1' })),
    ...overrides,
  }
}

describe('admin rectification route & workflows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('rejects unauthenticated GET and POST requests', async () => {
    requireAdminMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      error: 'Authentication required',
    } as never)
    const getRes = await GET(new NextRequest('http://localhost/api/admin/rectify'))
    expect(getRes.status).toBe(401)

    requireAdminRequestMock.mockResolvedValueOnce({
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    } as never)
    const postRes = await POST(
      new NextRequest('http://localhost/api/admin/rectify', {
        method: 'POST',
        body: JSON.stringify({ action: 'score', agentId: 'leonardo-da-vinci' }),
      })
    )
    expect(postRes.status).toBe(403)
  })

  it('rejects malformed JSON and invalid mutation payloads with 400', async () => {
    requireAdminRequestMock.mockResolvedValue(ADMIN_ACTOR as never)

    const badJson = await POST(
      new NextRequest('http://localhost/api/admin/rectify', {
        method: 'POST',
        body: '{not-json',
      })
    )
    expect(badJson.status).toBe(400)

    const badStep = await POST(
      new NextRequest('http://localhost/api/admin/rectify', {
        method: 'POST',
        body: JSON.stringify({ action: 'score', agentId: 'leonardo-da-vinci', stepMinutes: 99 }),
      })
    )
    expect(badStep.status).toBe(400)
  })

  it('builds a schema-valid report with accurate counts and degrades cleanly when DB/audit fail', async () => {
    const healthyDeps = makeDeps()
    const report = await buildRectificationReport(undefined, healthyDeps)
    expect(RectificationReportSchema.safeParse(report).success).toBe(true)
    expect(report.counts.total).toBe(3)
    expect(report.counts.archivalClue).toBe(1)
    expect(report.counts.dateKnownMilestones).toBe(1)
    expect(report.counts.nonRectifiable).toBe(1)
    expect(report.counts.approvedInDb).toBe(0)
    expect(report.alerts).toEqual([])

    const degradedDeps = makeDeps({
      findManyHistoricalAgents: vi.fn(async () => {
        throw new Error('DB connection refused')
      }),
      readRecentAudits: vi.fn(async () => ({
        available: false as const,
        entries: [],
        error: 'admin_audit_log missing',
      })),
    })
    const degraded = await buildRectificationReport(undefined, degradedDeps)
    expect(RectificationReportSchema.safeParse(degraded).success).toBe(true)
    expect(degraded.dbStates.ok).toBe(false)
    expect(degraded.counts.approvedInDb).toBeNull()
    expect(degraded.alerts.some(a => a.id === 'rectification:db-unreadable')).toBe(true)
    expect(degraded.alerts.some(a => a.id === 'rectification:audit-unreadable')).toBe(true)
  })

  it('approves an eligible dossier only after writing the mandatory audit log and sets rectified metadata', async () => {
    const deps = makeDeps()
    const res = await executeRectificationAction(
      { action: 'approve', agentId: 'leonardo-da-vinci', note: 'Verified Ser Antonio ledger' },
      ADMIN_ACTOR,
      deps
    )
    expect(res.status).toBe(200)
    expect(res.body.calculationsEligible).toBe(true)
    expect(res.body.ascendantProvenance).toBe('rectified')
    expect(res.body.ascendant).toBe(259.74)

    expect(deps.recordAudit).toHaveBeenCalledTimes(1)
    expect(deps.recordAudit).toHaveBeenCalledWith(
      ADMIN_ACTOR,
      expect.objectContaining({
        action: 'rectification.approve',
        targetType: 'historical_agent',
        targetId: 'leonardo-da-vinci',
        note: 'Verified Ser Antonio ledger',
      })
    )
    expect(deps.updateHistoricalAgentChart).toHaveBeenCalledTimes(1)
    const updatedChart = vi.mocked(deps.updateHistoricalAgentChart).mock.calls[0][1] as Record<
      string,
      any
    >
    expect(updatedChart.ascendantProvenance).toBe('rectified')
    expect(updatedChart.ascendant).toBe(259.74)
    expect(updatedChart.planets.Sun.sign).toBe('Taurus')
    expect(updatedChart.ascendantEstimate.topSign).toBe('Sagittarius')
    expect(updatedChart.ascendantEstimate.evidence[0].approvedBy).toBe('ops@alchmagents.eth')
  })

  it('preserves calculationsEligible=false when approving a below-threshold dossier', async () => {
    const deps = makeDeps()
    const res = await executeRectificationAction(
      { action: 'approve', agentId: 'charles-darwin-1809' },
      ADMIN_ACTOR,
      deps
    )
    expect(res.status).toBe(200)
    expect(res.body.calculationsEligible).toBe(false)
    expect(res.body.ascendantProvenance).toBe('rectified')
    expect(deps.updateHistoricalAgentChart).toHaveBeenCalledTimes(1)
  })

  it('halts approval at 503 and never mutates historical_agents when mandatory audit write fails', async () => {
    const deps = makeDeps({
      recordAudit: vi.fn(async () => ({ recorded: false as const, reason: 'read-only replica' })),
    })
    const res = await executeRectificationAction(
      { action: 'approve', agentId: 'leonardo-da-vinci' },
      ADMIN_ACTOR,
      deps
    )
    expect(res.status).toBe(503)
    expect(String(res.body.error)).toMatch(/audit write failed/i)
    expect(deps.updateHistoricalAgentChart).not.toHaveBeenCalled()
  })

  it('blocks promoting non-rectifiable undated dossiers unless documented evidence is supplied', async () => {
    const deps = makeDeps()
    const res = await executeRectificationAction(
      { action: 'approve', agentId: 'lao-tzu' },
      ADMIN_ACTOR,
      deps
    )
    expect(res.status).toBe(400)
    expect(deps.recordAudit).not.toHaveBeenCalled()
    expect(deps.updateHistoricalAgentChart).not.toHaveBeenCalled()
  })

  it('rejects and reverts a previously rectified DB record back to baseline provenance', async () => {
    const deps = makeDeps({
      findUniqueHistoricalAgent: vi.fn(async () => ({
        id: 'row-leo',
        agentId: 'leonardo-da-vinci',
        name: 'Leonardo da Vinci',
        natalChart: {
          planets: { Sun: { sign: 'Taurus', degree: 5 } },
          ascendant: 259.74,
          ascendantProvenance: 'rectified',
          ascendantEstimate: { topSign: 'Sagittarius' },
        },
      })),
    })

    const res = await executeRectificationAction(
      { action: 'reject', agentId: 'leonardo-da-vinci', note: 'Calendar conversion dispute' },
      ADMIN_ACTOR,
      deps
    )
    expect(res.status).toBe(200)
    expect(res.body.revertedFromRectified).toBe(true)
    expect(res.body.ascendantProvenance).toBe('unmeasured')
    expect(deps.updateHistoricalAgentChart).toHaveBeenCalledTimes(1)
    const reverted = vi.mocked(deps.updateHistoricalAgentChart).mock.calls[0][1] as Record<
      string,
      any
    >
    expect(reverted.ascendantProvenance).toBe('unmeasured')
    expect(reverted.ascendantEstimate).toBeUndefined()
  })
})
