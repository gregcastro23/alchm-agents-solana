import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { CANONICAL_AGENT_IDS, isPublicRosterId } from '@/lib/agents/public-roster'
import { prisma } from '@/lib/db'
import { HistoricalAgentsService } from '@/lib/historical-agents-db'
import { hasPrivilegedInternalApiSecret } from '@/lib/security/internal-auth'
import {
  isUserCreatedAgentRow,
  projectNumberRecord,
  projectPublicAura,
  projectPublicBirthData,
  projectPublicNatalChart,
  projectPublicPersonalityCore,
  projectStringList,
} from '@/lib/agents/forged-privacy'

interface GetAgentsResponse {
  success: boolean
  agents?: any[]
  total?: number
  error?: string
}

interface AuthContext {
  isServiceOrAdmin: boolean
  creatorUserId: string | null
  creatorAgentIds: Set<string>
}

async function resolveCreatorAgentIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  try {
    if (!prisma?.created_agents?.findMany) return ids
    const vessels = await prisma.created_agents.findMany({
      where: { creatorId: userId },
      select: { id: true, blueprint: true, momentChart: true },
    })
    for (const v of vessels) {
      if (v.id) ids.add(v.id)
      const bp = v.blueprint as any
      if (bp && typeof bp === 'object' && typeof bp.agentId === 'string' && bp.agentId) {
        ids.add(bp.agentId)
      }
      const mc = v.momentChart as any
      if (mc && typeof mc === 'object' && typeof mc.agentId === 'string' && mc.agentId) {
        ids.add(mc.agentId)
      }
    }
  } catch (err: any) {
    console.warn('[agents] could not resolve creator vessels:', err?.message)
  }
  return ids
}

async function isDatabaseAdmin(user: {
  id?: string | null
  email?: string | null
}): Promise<boolean> {
  try {
    const { requireAdmin } = await import('@/lib/admin-auth')
    return (await requireAdmin(user)).ok
  } catch {
    // Fail closed: if the role cannot be verified, the caller is not an admin.
    return false
  }
}

async function resolveAuthContext(request: NextRequest): Promise<AuthContext> {
  let isServiceOrAdmin = false
  let creatorUserId: string | null = null
  let creatorAgentIds = new Set<string>()

  try {
    if (hasPrivilegedInternalApiSecret(request)) {
      isServiceOrAdmin = true
    }
  } catch {
    // Fail closed
  }

  if (!isServiceOrAdmin) {
    try {
      const { auth } = await import('@/lib/auth')
      const session = await auth()
      if (session?.user) {
        // `role` on the session is a claim (stamped at sign-in, or copied from the
        // alchm.kitchen bridge). Entitlement comes from the database, the same way every
        // /api/admin/* route decides it, so a stale or bridged claim cannot unlock birth data.
        if (session.user.role === 'admin' && (await isDatabaseAdmin(session.user))) {
          isServiceOrAdmin = true
        } else if (session.user.id) {
          creatorUserId = session.user.id
          creatorAgentIds = await resolveCreatorAgentIds(session.user.id)
        }
      }
    } catch {
      // Unauthenticated or auth unavailable -> fail closed (anonymous)
    }
  }

  return { isServiceOrAdmin, creatorUserId, creatorAgentIds }
}

function isAgentAuthorized(agent: any, auth: AuthContext): boolean {
  if (auth.isServiceOrAdmin) return true
  const agentId = agent.agentId || agent.id
  if (agentId && auth.creatorAgentIds.has(agentId)) return true
  if (auth.creatorUserId && agent.creatorId && agent.creatorId === auth.creatorUserId) return true
  return false
}

// Maps a historical_agents row (Railway response or Prisma row — same table,
// same field names) to the gallery's agent shape.
//
// Every value built from a JSON column (or from the owner's own text) goes through an
// allow-list projection for a caller who is not entitled to the row: see
// lib/agents/forged-privacy.ts. `forcePrivate` marks a row that must be treated as a
// person's even though nothing on it says so (a Railway row, which carries no `craftedBy`).
function formatAgentRow(agent: any, isAuthorized = false, forcePrivate = false) {
  const isUserCreated = isUserCreatedAgentRow(agent)
  const redact = (isUserCreated || forcePrivate) && !isAuthorized

  const birthData = redact
    ? projectPublicBirthData(agent.birthLocation)
    : {
        date: agent.birthDate,
        time: agent.birthTime,
        location: agent.birthLocation,
      }

  const natalChart = redact ? projectPublicNatalChart(agent.natalChart) : agent.natalChart

  return {
    id: agent.agentId,
    name: agent.name,
    title: agent.title,
    birthData,
    consciousness: {
      natalChart,
      monicaConstant: agent.monicaConstant ?? null,
      level: agent.consciousnessLevel || 'Novice',
      dominantElement: agent.dominantElement || 'Earth',
      dominantModality: agent.dominantModality || 'Fixed',
      signature: agent.signature || 'Standard',
    },
    personality: {
      core: redact
        ? projectPublicPersonalityCore(agent.personalityCore)
        : agent.personalityCore || {},
      shadows: redact
        ? projectStringList(agent.personalityShadows)
        : agent.personalityShadows || [],
      gifts: redact ? projectStringList(agent.personalityGifts) : agent.personalityGifts || [],
      challenges: redact
        ? projectStringList(agent.personalityChallenges)
        : agent.personalityChallenges || [],
      currentMood: agent.currentMood || 'Neutral',
      evolutionStage: agent.evolutionStage || 0,
    },
    abilities: {
      specialty: agent.specialty,
      wisdomDomains: redact ? projectStringList(agent.wisdomDomains) : agent.wisdomDomains || [],
      teachingStyle: agent.teachingStyle || 'Standard',
      resonanceType: agent.resonanceType || 'Standard',
      uniquePower: agent.uniquePower || '',
    },
    appearance: {
      avatar: agent.avatar,
      color: agent.color,
      symbol: agent.symbol,
      aura: redact ? projectPublicAura(agent.aura) : agent.aura,
    },
    stats: {
      conversations: agent.conversations,
      wisdomShared: agent.wisdomShared,
      resonanceScore: agent.resonanceScore,
      evolutionPoints: agent.evolutionPoints,
      lastActive: agent.lastActive,
      kineticEvolution: {
        consciousnessVelocity: 0.1,
        interactionMomentum: 0,
        evolutionTrajectory: 'ascending',
        powerLevelUnlocks: [],
        optimalInteractionHours: [],
        aspectSensitivityGrowth: 0,
        memoryPersistence: 0.3,
        lastKineticUpdate: agent.lastActive,
      },
      qualityMetrics: {
        averageResponseDepth: 0.5,
        aspectInfluenceStrength: 0.4,
        temporalAlignment: 0.5,
        personalityEvolution: 0,
        kineticResonance: 0.5,
      },
    },
    // Cosmic EV & Leveling (present once the backend exposes them; the gallery
    // also hydrates these directly from Neon via /api/agents/leveling).
    level: agent.level,
    xp: agent.xp,
    evolutionValues: redact ? projectNumberRecord(agent.evolutionValues) : agent.evolutionValues,
    evTotal: agent.evTotal,
    ivSnapshot: redact ? projectNumberRecord(agent.ivSnapshot) : agent.ivSnapshot,
    isUserCreated,
    craftedBy: agent.craftedBy || 'philosopher-stone',
    historicalEra: agent.historicalEra,
  }
}

// The answer varies by caller (a creator, an admin, or a holder of INTERNAL_API_SECRET gets
// more than a stranger), so a shared cache must never serve one caller's answer to another.
// vercel.json gives every /api/* response `s-maxage=60`: an entitled body must say it is
// private and uncacheable itself. Whether Vercel applies vercel.json's `Cache-Control` over
// the one a function sets could not be checked offline, so `CDN-Cache-Control: no-store` rides
// along: Vercel documents it as taking precedence over `Cache-Control` for its own CDN, and
// it is a different header name, so vercel.json's rule cannot overwrite it. Verify on a
// deployed preview: docs/integrations/FORGED_VESSEL_PRIVACY.md.
const VARY_BY_CALLER = 'Authorization, Cookie, X-Internal-Secret'

/** True when this caller may receive data the public projection withholds. */
function isEntitledCaller(auth: AuthContext): boolean {
  return auth.isServiceOrAdmin || auth.creatorUserId !== null
}

function respond(
  body: GetAgentsResponse,
  auth: AuthContext,
  init: { status?: number } = {}
): NextResponse<GetAgentsResponse> {
  const headers: Record<string, string> = { Vary: VARY_BY_CALLER }
  if (isEntitledCaller(auth)) {
    headers['Cache-Control'] = 'private, no-store'
    headers['CDN-Cache-Control'] = 'no-store'
  }
  return NextResponse.json(body, { status: init.status, headers })
}

export async function GET(request: NextRequest): Promise<NextResponse<GetAgentsResponse>> {
  const authContext = await resolveAuthContext(request)
  const { searchParams } = new URL(request.url)
  const category = searchParams.get('category') || 'historical'

  // Dedicated planetary degree agent category query.
  if (category === 'planetary') {
    try {
      const limit = parseInt(searchParams.get('limit') || '100')
      const offset = parseInt(searchParams.get('offset') || '0')
      const dbAgents = await HistoricalAgentsService.getPlanetaryDegreeAgents({ limit, offset })
      const agents = dbAgents.map(a => formatAgentRow(a, isAgentAuthorized(a, authContext)))
      return respond({ success: true, agents, total: agents.length }, authContext)
    } catch (error: any) {
      // The datastore's own message (a query excerpt, a source path, a host) stays in the log.
      console.error('[agents] planetary roster fetch failed:', error?.message)
      return respond(
        {
          success: false,
          agents: [],
          total: 0,
          error: 'Planetary agents are temporarily unavailable',
        },
        authContext,
        { status: 503 }
      )
    }
  }

  // Legacy escape hatch: proxy a raw window of the Railway table.
  if (searchParams.get('source') === 'backend') {
    try {
      const limit = parseInt(searchParams.get('limit') || '100')
      const offset = parseInt(searchParams.get('offset') || '0')
      const dbAgents = await backend.agents.list({ skip: offset, limit })
      // A Railway row carries no `craftedBy`, and the era it is stamped with is whatever the
      // writer chose (a person created through POST /api/agents gets `modern_pre1950`). So here
      // public means "a canonical figure or a sky-generated agent"; everything else is a
      // person's until proven otherwise.
      const agents = dbAgents.map(a =>
        formatAgentRow(a, isAgentAuthorized(a, authContext), !isPublicRosterId(a.agentId))
      )
      return respond({ success: true, agents, total: agents.length }, authContext)
    } catch (error: any) {
      console.error('[agents] backend roster fetch failed, serving demo data:', error?.message)
      return respond(
        {
          success: true,
          agents: DEMO_AGENTS,
          total: DEMO_AGENTS.length,
          error: 'Backend unavailable, falling back to demo data',
        },
        authContext
      )
    }
  }

  // Default roster: canonical historical agents with birthcharts plus user-forged vessels from Neon.
  const canonical = HISTORICAL_AGENTS.map(agent => {
    const { historicalDiet, quotes, coreBeliefs, monicaCreationStory, ...slim } = agent as any
    return {
      ...slim,
      isUserCreated: false,
      historicalEra: (agent as any).historicalEra ?? agent.era,
      category: 'historical',
      hasBirthchart: true,
    }
  })

  let userCreated: any[] = []
  try {
    const rows = await prisma.historical_agents.findMany({
      where: {
        isActive: true,
        craftedBy: 'philosopher-stone-user',
        AND: [
          { agentId: { not: { startsWith: 'planetary-' } } },
          { agentId: { not: { startsWith: 'moon-phase-' } } },
          { agentId: { not: { startsWith: 'moon-agent-' } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
    })
    userCreated = rows.map(a => formatAgentRow(a, isAgentAuthorized(a, authContext)))
  } catch (error: any) {
    console.warn('User-created roster fetch failed (canonical roster only):', error.message)
  }

  const allAgents = [...canonical, ...userCreated.filter(a => !CANONICAL_AGENT_IDS.has(a.id))]

  return respond({ success: true, agents: allAgents, total: allAgents.length }, authContext)
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body = await request.json()
    const result = await backend.agents.create(body)

    return NextResponse.json({
      success: true,
      agent: result,
    })
  } catch (error: any) {
    console.error('Failed to create agent via backend:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create agent' },
      { status: 500 }
    )
  }
}
