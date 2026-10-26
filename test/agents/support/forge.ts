// Test support: forge a vessel through the REAL writer, so privacy specs run against the row
// `/api/create-agent` and `HistoricalAgentsService.createAgent` actually persist, not against a
// hand-built fixture. Hand-built rows (`aura: null`, a toy `personalityCore`) are how the first
// redaction shipped blind to `aura.sourceCharts` and to the owner's free text.
//
// Only the edges are faked: auth, the Prisma client, the WTEN alchemy fetch, the consciousness
// backend, the ESMS debit and the agentic-user sync. The route, the service, the chart maths, the
// synthesizer and the agent generator are all the real thing.
import { NextRequest } from 'next/server'
import { vi } from 'vitest'

export const OWNER_FREE_TEXT = {
  aboutYourself: 'I am Dana Whitfield, a nurse in Seattle who bakes at night.',
  lifeStory: 'Born in a small hospital; my mother left when I was nine.',
  poetry: 'salt on the windowsill',
  values: 'honesty, patience',
} as const

export const FORGE_INPUT = {
  name: 'Verdant Wren',
  purpose: 'Garden alchemy',
  birthInfo: {
    year: 1987,
    month: 6,
    day: 23,
    hour: 5,
    minute: 41,
    latitude: 47.6062,
    longitude: -122.3321,
  },
  stats: {
    power: 50,
    resonance: 50,
    wisdom: 50,
    charisma: 50,
    intuition: 50,
    adaptability: 50,
    vitality: 50,
  },
  personalContext: OWNER_FREE_TEXT,
} as const

export interface ForgedVessel {
  agentId: string
  /** The `historical_agents` row as Prisma hands it back (the `create` data plus DB defaults). */
  row: Record<string, any>
  /** What `created_agents.create` was asked to store, if the forger was signed in. */
  createdAgentsRow: { id: string; creatorId: string; blueprint: any; momentChart: any } | null
  /** The arguments of `HistoricalAgentsService.createAgent`'s Prisma `create` (the DB write). */
  writtenData: Record<string, any>
}

const MOCKED = [
  '@/lib/auth',
  '@/lib/db',
  '@/lib/backend',
  '@/lib/monica/fetch-current-positions',
  '@/lib/api-client/consciousness-client',
  '@/lib/services/economyService',
  '@/lib/agents/agentic-user-sync',
]

export async function forgeVessel(
  options: {
    /** Sign in as this user while forging (so the creator ledger row is written). */
    creatorId?: string
    input?: Record<string, unknown>
  } = {}
): Promise<ForgedVessel> {
  vi.resetModules()
  // Other specs stub the service wholesale (`HistoricalAgentsService: {}`), and a `doMock`
  // outlives `resetModules`: the writer under test must be the real one.
  vi.doUnmock('@/lib/historical-agents-db')
  let written: Record<string, any> | null = null
  let createdAgents: ForgedVessel['createdAgentsRow'] = null

  vi.doMock('@/lib/auth', () => ({
    auth: vi.fn().mockResolvedValue(options.creatorId ? { user: { id: options.creatorId } } : null),
  }))
  vi.doMock('@/lib/db', () => {
    const prisma: Record<string, any> = {
      historical_agents: {
        create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
          written = structuredClone(data)
          return { ...data }
        }),
      },
      created_agents: {
        create: vi.fn(async ({ data }: { data: Record<string, any> }) => {
          createdAgents = {
            id: 'created-ledger-1',
            creatorId: data.creatorId,
            blueprint: data.blueprint,
            momentChart: data.momentChart,
          }
          return {}
        }),
      },
    }
    // The forge commits every local write in one transaction (lib/agents/forge-creation.ts), so the
    // transaction handle is the same fake: what reaches `create` is what reaches the database.
    prisma.$transaction = async (run: (tx: typeof prisma) => unknown) => run(prisma)
    return { prisma }
  })
  vi.doMock('@/lib/backend', () => ({
    backend: {},
    getAlchemicalQuantitiesLegacy: vi.fn().mockResolvedValue({
      'Alchemy Effects': {
        'Total Spirit': 4,
        'Total Essence': 5,
        'Total Matter': 6,
        'Total Substance': 3,
      },
      transits: {},
      activatedHouses: [],
    }),
  }))
  vi.doMock('@/lib/monica/fetch-current-positions', () => ({
    fetchCurrentPlanetaryPositions: vi.fn().mockResolvedValue({}),
  }))
  vi.doMock('@/lib/api-client/consciousness-client', () => ({
    ConsciousnessClient: class {
      async createAgentOfMoment() {
        // The documented prod state: the optional backend 404s and the route derives locally.
        throw new Error('backend unavailable (offline)')
      }
    },
  }))
  vi.doMock('@/lib/services/economyService', () => ({
    EconomyService: {
      debitOperation: vi.fn().mockResolvedValue({
        ok: true,
        balances: { spirit: 1, essence: 1, matter: 1, substance: 1 },
        transactionGroupId: 'forge-test-group',
      }),
    },
  }))
  vi.doMock('@/lib/agents/agentic-user-sync', () => ({
    ensureAgenticUserAndSync: vi.fn().mockResolvedValue(undefined),
    // The forge provisions the agentic user inside its transaction (lib/agents/forge-creation.ts).
    provisionAgenticUser: vi.fn().mockResolvedValue('agentic-user-1'),
  }))

  try {
    const { POST } = await import('@/app/api/create-agent/route')
    const res = await POST(
      new NextRequest('http://localhost:3000/api/create-agent', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.7' },
        body: JSON.stringify({ ...FORGE_INPUT, ...(options.input ?? {}) }),
      })
    )
    const json: any = await res.json()
    if (res.status !== 200 || !json.success || !written) {
      throw new Error(`forge failed: HTTP ${res.status} ${JSON.stringify(json)}`)
    }
    const data: Record<string, any> = written
    // The columns Prisma fills in itself.
    const row = {
      ...data,
      birthDate: new Date(data.birthDate),
      lastActive: new Date(data.lastActive),
      level: 1,
      xp: 0,
      evolutionValues: {},
      evTotal: 0,
      ivSnapshot: null,
      createdAt: new Date('2026-10-24T00:00:00.000Z'),
    }
    return { agentId: data.agentId, row, createdAgentsRow: createdAgents, writtenData: data }
  } finally {
    for (const id of MOCKED) vi.doUnmock(id)
    vi.resetModules()
  }
}

/** Every key path in a JSON value, as `a.b.0.c`. */
export function keyPaths(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') return []
  const paths: string[] = []
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key
    paths.push(path, ...keyPaths(child, path))
  }
  return paths
}

/** Every number anywhere in a JSON value. */
export function numberLeaves(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (value === null || typeof value !== 'object') return []
  return Object.values(value as Record<string, unknown>).flatMap(numberLeaves)
}

/** Key names that only a birth chart carries. No public vessel JSON may hold one anywhere. */
export const CHART_KEY_NAMES = [
  'ascendant',
  'houses',
  'celestialbodies',
  'sourcecharts',
  'degrees',
  'degree',
  'aspects',
  'tropical',
]

export function chartKeyPaths(value: unknown): string[] {
  return keyPaths(value).filter(path => {
    const leaf = path.split('.').pop()!.toLowerCase()
    return CHART_KEY_NAMES.includes(leaf)
  })
}
