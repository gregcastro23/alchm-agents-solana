import { NextRequest, NextResponse } from 'next/server'
import { backend } from '@/lib/backend'
import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { prisma } from '@/lib/db'
import { HistoricalAgentsService } from '@/lib/historical-agents-db'
import { hasPrivilegedInternalApiSecret } from '@/lib/security/internal-auth'

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

/** Extracts the location name from whatever shape birthLocation holds. */
function extractLocationName(rawLocation: unknown): string | null {
  if (!rawLocation) return null
  if (typeof rawLocation === 'string') {
    const trimmed = rawLocation.trim()
    return trimmed || null
  }
  if (typeof rawLocation === 'object' && rawLocation !== null) {
    const loc = rawLocation as Record<string, unknown>
    if (typeof loc.name === 'string' && loc.name.trim()) return loc.name.trim()
    if (typeof loc.city === 'string' && loc.city.trim()) return loc.city.trim()
  }
  return null
}

/**
 * Extracts the Sun sign from either the roster/fixture shape
 * (`{ planets: { Sun: { sign } } }`) or the forge shape
 * (`{ tropical: { CelestialBodies: { all: [{ label: "Sun", Sign: { label } }] } } }`).
 */
function extractSunSign(rawChart: unknown): string | null {
  if (!rawChart || typeof rawChart !== 'object') return null
  const chart = rawChart as Record<string, unknown>

  // 1. planets object or array
  if (chart.planets && typeof chart.planets === 'object') {
    const planets = chart.planets as Record<string, unknown>
    const sun = (planets.Sun ?? planets.sun) as Record<string, unknown> | undefined
    if (sun && typeof sun === 'object' && typeof sun.sign === 'string' && sun.sign.trim()) {
      return sun.sign.trim()
    }
    if (Array.isArray(chart.planets)) {
      const entry = chart.planets.find(
        (p: unknown) =>
          p &&
          typeof p === 'object' &&
          ((p as any).name?.toLowerCase?.() === 'sun' ||
            (p as any).label?.toLowerCase?.() === 'sun')
      ) as Record<string, unknown> | undefined
      if (entry && typeof entry.sign === 'string' && entry.sign.trim()) {
        return entry.sign.trim()
      }
    }
  }

  // 2. Direct Sun property
  const directSun = (chart.Sun ?? chart.sun) as Record<string, unknown> | undefined
  if (
    directSun &&
    typeof directSun === 'object' &&
    typeof directSun.sign === 'string' &&
    directSun.sign.trim()
  ) {
    return directSun.sign.trim()
  }

  // 3. Forge output with tropical.CelestialBodies
  if (chart.tropical && typeof chart.tropical === 'object') {
    const tropical = chart.tropical as Record<string, unknown>
    if (tropical.CelestialBodies && typeof tropical.CelestialBodies === 'object') {
      const cb = tropical.CelestialBodies as Record<string, unknown>
      if (Array.isArray(cb.all)) {
        const sun = cb.all.find(
          (entry: unknown) =>
            entry && typeof entry === 'object' && (entry as any).label?.toLowerCase?.() === 'sun'
        ) as Record<string, unknown> | undefined
        const signLabel = (sun?.Sign as Record<string, unknown> | undefined)?.label
        if (typeof signLabel === 'string' && signLabel.trim()) {
          return signLabel.trim()
        }
      }
      const directCbSun = (cb.Sun ?? cb.sun) as Record<string, unknown> | undefined
      const signLabel = (directCbSun?.Sign as Record<string, unknown> | undefined)?.label
      if (typeof signLabel === 'string' && signLabel.trim()) {
        return signLabel.trim()
      }
    }
  }

  return null
}

/**
 * For unauthorized callers, projects user-created natal charts to only what the
 * public gallery consumes (Sun sign for faction filtering). Degrees, ascendant,
 * houses, aspects, and other planetary bodies are strictly redacted.
 */
function projectPublicNatalChart(rawChart: unknown): { planets: { Sun: { sign: string } } } | null {
  const sunSign = extractSunSign(rawChart)
  if (!sunSign) return null
  return {
    planets: {
      Sun: {
        sign: sunSign,
      },
    },
  }
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
        if (session.user.role === 'admin') {
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
function formatAgentRow(agent: any, isAuthorized = false) {
  const isUserCreated =
    agent.historicalEra === 'user_created' ||
    agent.craftedBy === 'philosopher-stone-user' ||
    agent.historicalEra === 'MONICA_SPECIAL' ||
    agent.isUserCreated === true

  const birthData =
    !isUserCreated || isAuthorized
      ? {
          date: agent.birthDate,
          time: agent.birthTime,
          location: agent.birthLocation,
        }
      : {
          location: {
            name: extractLocationName(agent.birthLocation) ?? 'Unknown',
          },
        }

  const natalChart =
    !isUserCreated || isAuthorized ? agent.natalChart : projectPublicNatalChart(agent.natalChart)

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
      core: agent.personalityCore || {},
      shadows: agent.personalityShadows || [],
      gifts: agent.personalityGifts || [],
      challenges: agent.personalityChallenges || [],
      currentMood: agent.currentMood || 'Neutral',
      evolutionStage: agent.evolutionStage || 0,
    },
    abilities: {
      specialty: agent.specialty,
      wisdomDomains: agent.wisdomDomains || [],
      teachingStyle: agent.teachingStyle || 'Standard',
      resonanceType: agent.resonanceType || 'Standard',
      uniquePower: agent.uniquePower || '',
    },
    appearance: {
      avatar: agent.avatar,
      color: agent.color,
      symbol: agent.symbol,
      aura: agent.aura,
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
    evolutionValues: agent.evolutionValues,
    evTotal: agent.evTotal,
    ivSnapshot: agent.ivSnapshot,
    isUserCreated,
    craftedBy: agent.craftedBy || 'philosopher-stone',
    historicalEra: agent.historicalEra,
  }
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
      return NextResponse.json({ success: true, agents, total: agents.length })
    } catch (error: any) {
      return NextResponse.json({
        success: false,
        agents: [],
        total: 0,
        error: `Failed to fetch planetary agents: ${error.message}`,
      })
    }
  }

  // Legacy escape hatch: proxy a raw window of the Railway table.
  if (searchParams.get('source') === 'backend') {
    try {
      const limit = parseInt(searchParams.get('limit') || '100')
      const offset = parseInt(searchParams.get('offset') || '0')
      const dbAgents = await backend.agents.list({ skip: offset, limit })
      const agents = dbAgents.map(a => formatAgentRow(a, isAgentAuthorized(a, authContext)))
      return NextResponse.json({ success: true, agents, total: agents.length })
    } catch (error: any) {
      return NextResponse.json({
        success: true,
        agents: DEMO_AGENTS,
        total: DEMO_AGENTS.length,
        error: `Backend error, falling back to demo data: ${error.message}`,
      })
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

  const canonicalIds = new Set(canonical.map(a => a.id))
  const allAgents = [...canonical, ...userCreated.filter(a => !canonicalIds.has(a.id))]

  return NextResponse.json({
    success: true,
    agents: allAgents,
    total: allAgents.length,
  })
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
