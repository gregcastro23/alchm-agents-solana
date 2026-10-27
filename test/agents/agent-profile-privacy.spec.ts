// @vitest-environment node
//
// Render-level privacy spec for the public profile page, app/(app)/agent/[id]/page.tsx.
//
// The page is a server component: whatever it passes to a client component is serialised into the
// HTML and the RSC payload. So this spec runs the real page in-process, once per kind of viewer
// (anonymous, a signed-in stranger, the vessel's creator, an admin), and checks four surfaces:
//   - the HTML,
//   - the props of every component element the page returns, serialised the way React would
//     (JSON, functions dropped),
//   - generateMetadata,
//   - which queries ran (the conversation table must never be read).
//
// Real: the page, the profile loader, resolveAnyAgent, dbAgentToCraftedAgent, activity-surfaces,
// requireAdmin, the progression engine. Faked: Prisma (an in-memory table per model the page
// touches), the session (`@/lib/auth`), the agentic-user sync.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { notFound } from 'next/navigation'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getHistoricalAgent } from '@/lib/agents/historical'

const H = vi.hoisted(() => ({
  rows: new Map<string, any>(),
  users: new Map<string, any>(),
  ledger: [] as any[],
  events: [] as any[],
  conversations: [] as any[],
  session: null as any,
  authThrows: false,
  ledgerThrows: false,
  eventsThrow: false,
  authCalls: 0,
  conversationQueries: 0,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    historical_agents: {
      findUnique: async ({ where, select }: any) => {
        const row = H.rows.get(where.agentId) ?? null
        if (!row) return null
        return select ? Object.fromEntries(Object.keys(select).map(key => [key, row[key]])) : row
      },
    },
    created_agents: {
      findMany: async ({ where }: any) => {
        if (H.ledgerThrows) throw new Error('ledger down')
        return H.ledger.filter(r => r.creatorId === where.creatorId)
      },
    },
    users: {
      findFirst: async ({ where }: any) => {
        // requireAdmin looks a user up by id/email; getAgentBalances by agentic email.
        if (where?.OR) {
          const ids: string[] = where.OR.map((c: any) => c.id).filter(Boolean)
          return ids.map(id => H.users.get(id)).find(Boolean) ?? null
        }
        return null
      },
    },
    tokenBalance: { findUnique: async () => null },
    agent_action_events: {
      findMany: async ({ where }: any) => {
        if (H.eventsThrow) throw new Error('events down')
        return H.events.filter(
          e =>
            where.agentId.in.includes(e.agentId) &&
            (!where.eventType || where.eventType.in.includes(e.eventType))
        )
      },
    },
    agentConversation: {
      findMany: async () => {
        H.conversationQueries += 1
        return H.conversations
      },
    },
  },
}))
vi.mock('@/lib/auth', () => ({
  auth: async () => {
    H.authCalls += 1
    if (H.authThrows) throw new Error('session store down')
    return H.session
  },
}))
vi.mock('@/lib/agents/agentic-user-sync', () => ({
  ensureAgenticUserAndSync: async () => undefined,
}))

// ── The fictional owner's private data, used as grep probes ─────────────────

const OWNER = {
  birthDate: '1991-03-14',
  birthTime: '04:07',
  lat: 64.1466,
  lon: -21.9426,
  place: 'Reykjavik',
}

const PLANETS = {
  Sun: { sign: 'Pisces', degree: 22.04, house: 11, retrograde: false },
  Moon: { sign: 'Cancer', degree: 11.27, house: 2, retrograde: false },
  Mercury: { sign: 'Pisces', degree: 8.51, house: 11, retrograde: true },
  Venus: { sign: 'Aquarius', degree: 29.93, house: 10, retrograde: false },
  Mars: { sign: 'Sagittarius', degree: 4.66, house: 8, retrograde: false },
  Jupiter: { sign: 'Leo', degree: 17.38, house: 4, retrograde: false },
  Saturn: { sign: 'Capricorn', degree: 25.12, house: 9, retrograde: false },
  Uranus: { sign: 'Capricorn', degree: 4.8, house: 9, retrograde: false },
  Neptune: { sign: 'Capricorn', degree: 12.31, house: 9, retrograde: false },
  Pluto: { sign: 'Scorpio', degree: 18.75, house: 7, retrograde: true },
}
// Ascendant 36.5 degrees is 6.5 of Taurus: "Rising sign: Taurus" can only come from this chart.
const PLANETS_CHART = {
  planets: PLANETS,
  ascendant: 36.5,
  houses: { ASC: 36.5, MC: 297.2 },
  aspects: [{ planet1: 'Sun', planet2: 'Moon', type: 'Square', orb: 0.9 }],
}

// The shape generateAccurateHoroscope returns for the live forge (/api/create-agent).
const FORGE_CHART = {
  tropical: {
    CelestialBodies: {
      all: [
        {
          label: 'Sun',
          Sign: { label: 'Leo' },
          ChartPosition: { Ecliptic: { DecimalDegrees: 141.7 } },
        },
        {
          label: 'Moon',
          Sign: { label: 'Gemini' },
          ChartPosition: { Ecliptic: { DecimalDegrees: 71.3 } },
        },
      ],
    },
    Ascendant: {
      Sign: { label: 'Scorpio' },
      ChartPosition: { Ecliptic: { DecimalDegrees: 212.9 } },
    },
  },
  metadata: { birthYear: 1991, latitude: OWNER.lat, longitude: OWNER.lon },
}

const FREE_TEXT = {
  about: 'ABOUT-YOURSELF-MARKER',
  story: 'LIFE-STORY-MARKER',
  poetry: 'POETRY-MARKER',
  values: 'VALUES-MARKER',
}

const baseRow = {
  title: 'The Sealed',
  birthDate: new Date(`${OWNER.birthDate}T${OWNER.birthTime}:00.000Z`),
  birthTime: OWNER.birthTime,
  birthLocation: { name: OWNER.place, lat: OWNER.lat, lon: OWNER.lon },
  consciousnessLevel: 'Illuminated',
  monicaConstant: 1.618,
  dominantElement: 'Water',
  dominantModality: 'Mutable',
  signature: 'Sealed Vessel',
  personalityShadows: [],
  personalityGifts: [],
  personalityChallenges: [],
  currentMood: 'contemplative',
  evolutionStage: 1,
  specialty: 'Wisdom',
  wisdomDomains: ['Philosophy'],
  skills: [],
  teachingStyle: 'Intuitive',
  resonanceType: 'Spirit',
  uniquePower: 'Foresight',
  avatar: '/avatars/user-created/default.png',
  color: '#8B5CF6',
  symbol: 'X',
  conversations: 12,
  wisdomShared: 3,
  resonanceScore: 0.5,
  evolutionPoints: 0,
  lastActive: new Date('2026-10-18T00:00:00.000Z'),
  isActive: true,
}

/** What POST /api/philosophers-stone/create writes: an explicit planets chart, array traits. */
const PSTONE_ID = 'agent-sealed-vessel-1792865588388'
const pstoneRow = {
  ...baseRow,
  agentId: PSTONE_ID,
  name: 'Sealed Vessel',
  historicalEra: 'MONICA_SPECIAL',
  craftedBy: 'philosopher-stone',
  natalChart: PLANETS_CHART,
  traits: ['Wise', 'Intuitive'],
  personalityCore: {
    essence: 'ESSENCE-MARKER',
    expression: FREE_TEXT.about,
    emotion: FREE_TEXT.values,
    lifeStory: FREE_TEXT.story,
    poetry: FREE_TEXT.poetry,
    userProvidedContext: FREE_TEXT,
  },
  aura: { sourceCharts: [{ birthChart: PLANETS_CHART }], note: 'AURA-SOURCECHART-MARKER' },
}

/** What POST /api/create-agent writes: the forge chart, an OBJECT in `traits`. */
const FORGE_ID = 'agent-verdant-wren-1792820459966-z7baanv3b'
const forgeRow = {
  ...baseRow,
  agentId: FORGE_ID,
  name: 'Verdant Wren',
  historicalEra: 'user_created',
  craftedBy: 'philosopher-stone-user',
  natalChart: FORGE_CHART,
  traits: { communicationStyle: 'thoughtful', energyLevel: 'balanced', curiosity: 'high' },
  personalityCore: {
    essence: 'ESSENCE-MARKER',
    expression: FREE_TEXT.about,
    emotion: FREE_TEXT.values,
    lifeStory: FREE_TEXT.story,
    poetry: FREE_TEXT.poetry,
    userProvidedContext: FREE_TEXT,
  },
  aura: { sourceCharts: [{ birthChart: FORGE_CHART }], note: 'AURA-SOURCECHART-MARKER' },
}

/** A person's vessel the Python API created: neither marker PR #67 looks for. */
const PYTHON_ID = 'agent-python-person-1792865599999'
const pythonRow = {
  ...pstoneRow,
  agentId: PYTHON_ID,
  name: 'Python Person',
  historicalEra: 'Modern',
  craftedBy: 'philosopher-stone',
}

/** A person's vessel whose chart has no Sun we can read. */
const SUNLESS_ID = 'agent-sunless-vessel-1792865577777'
const sunlessRow = {
  ...pstoneRow,
  agentId: SUNLESS_ID,
  name: 'Sunless Vessel',
  natalChart: { planets: { Moon: PLANETS.Moon }, ascendant: 36.5 },
}

const CHAT = {
  user: 'user-uuid-OWNER-0001',
  userMessage: 'USERMSG-MARKER born 1991-03-14 at 64.1466,-21.9426',
  agentResponse: 'AGENTRESP-MARKER',
  session: 'sess-owner-1',
  context: 'CONTEXT-MARKER-lat-64.1466',
}
const EVENT = {
  payload: 'EVENT-PAYLOAD-MARKER',
  session: 'sess-event-1',
  user: 'user-event-payload',
}

// ── Viewers ─────────────────────────────────────────────────────────────────

const ANON = null
const STRANGER = { user: { id: 'stranger-1', email: 's@example.com', role: 'user' } }
const CREATOR = { user: { id: 'owner-1', email: 'o@example.com', role: 'user' } }
const ADMIN = { user: { id: 'admin-1', email: 'a@example.com', role: 'admin' } }
// A session whose role CLAIM says admin although the database does not (lows[5]).
const CLAIMED_ADMIN = { user: { id: 'claimed-1', email: 'c@example.com', role: 'admin' } }

function seedWorld() {
  H.rows.clear()
  for (const row of [pstoneRow, forgeRow, pythonRow, sunlessRow]) H.rows.set(row.agentId, row)
  H.users.clear()
  H.users.set('stranger-1', { id: 'stranger-1', email: 's@example.com', name: 'S', role: 'user' })
  H.users.set('owner-1', { id: 'owner-1', email: 'o@example.com', name: 'O', role: 'user' })
  H.users.set('admin-1', { id: 'admin-1', email: 'a@example.com', name: 'A', role: 'admin' })
  H.users.set('claimed-1', { id: 'claimed-1', email: 'c@example.com', name: 'C', role: 'user' })
  // owner-1 forged the sealed vessel (id in blueprint) and the wren (id in momentChart).
  H.ledger = [
    { id: 'ca-1', creatorId: 'owner-1', blueprint: { agentId: PSTONE_ID }, momentChart: {} },
    { id: 'ca-2', creatorId: 'owner-1', blueprint: {}, momentChart: { agentId: FORGE_ID } },
  ]
  // Conversations exist for every agent; the page must never read them.
  H.conversations = [
    {
      id: 'conv-1',
      agentId: PSTONE_ID,
      sessionId: CHAT.session,
      userId: CHAT.user,
      userMessage: CHAT.userMessage,
      agentResponse: CHAT.agentResponse,
      contextData: { ctxsecret: CHAT.context },
      createdAt: new Date('2026-10-19T00:00:00.000Z'),
    },
  ]
  // One agent-authored recipe event, whose payload carries things that must not be shipped.
  const eventFor = (agentId: string) => ({
    id: `evt-${agentId}`,
    agentId,
    eventType: 'recipe_generation',
    createdAt: new Date('2026-10-20T00:00:00.000Z'),
    metadataPayload: {
      recipeId: 'r-moon-soup',
      recipeName: 'Moon Soup',
      sessionId: EVENT.session,
      userId: EVENT.user,
      zz: EVENT.payload,
    },
  })
  H.events = [PSTONE_ID, FORGE_ID, PYTHON_ID, 'albert-einstein'].map(eventFor)
  H.session = ANON
  H.authThrows = false
  H.ledgerThrows = false
  H.eventsThrow = false
  H.authCalls = 0
  H.conversationQueries = 0
}

// ── Rendering ───────────────────────────────────────────────────────────────

/** Serialises the props of every component element in a tree, the way they would be shipped. */
function collectComponentProps(node: any, out: { name: string; props: string }[] = []) {
  if (node == null || typeof node !== 'object') return out
  if (Array.isArray(node)) {
    node.forEach(n => collectComponentProps(n, out))
    return out
  }
  if (!React.isValidElement(node)) return out
  const el: any = node
  if (typeof el.type !== 'string') {
    const { children, ...rest } = el.props ?? {}
    out.push({
      name: el.type?.displayName || el.type?.name || String(el.type?.$$typeof ?? 'component'),
      props: JSON.stringify(rest, (_k, v) =>
        typeof v === 'bigint' ? String(v) : typeof v === 'function' ? '[fn]' : v
      ),
    })
  }
  collectComponentProps(el.props?.children, out)
  return out
}

async function renderProfile(id: string) {
  const mod: any = await import('@/app/(app)/agent/[id]/page')
  const tree = await mod.default({ params: Promise.resolve({ id }) })
  const html = renderToStaticMarkup(tree)
  const props = collectComponentProps(tree)
  const meta = await mod.generateMetadata({ params: Promise.resolve({ id }) })
  const propsWire = props.map(p => `${p.name} ${p.props}`).join('\n')
  const metaWire = JSON.stringify(meta)
  return {
    mod,
    tree,
    html,
    props,
    propsWire,
    meta,
    metaWire,
    all: `${html}\n${propsWire}\n${metaWire}`,
  }
}

const signInAs = (session: any) => {
  H.session = session
}

/** Strips React's text-node comment markers so assertions read like the page. */
const text = (html: string) => html.replace(/<!-- -->/g, '')

const DEGREE_TEXTS = [
  '22.0°',
  '11.3°',
  '8.5°',
  '29.9°',
  '4.7°',
  '17.4°',
  '25.1°',
  '4.8°',
  '12.3°',
  '18.8°',
]
const RAW_DEGREES = ['22.04', '11.27', '8.51', '29.93', '4.66', '17.38', '25.12', '12.31', '18.75']

/** Everything of the owner's that no stranger may find in any surface of a planets-chart vessel. */
function expectNoPrivateData(surface: { all: string; html: string; propsWire: string }) {
  const { all, html, propsWire } = surface
  const flat = text(all)

  // Birth data.
  for (const probe of [OWNER.birthDate, OWNER.birthTime, '64.1466', '21.9426', '1991-03-14T']) {
    expect(flat, `birth datum ${probe}`).not.toContain(probe)
  }
  // The chart, as rendered text, as title attributes and as raw numbers.
  for (const probe of [...DEGREE_TEXTS, ...RAW_DEGREES, '36.5', '297.2']) {
    expect(flat, `chart datum ${probe}`).not.toContain(probe)
  }
  expect(flat).not.toContain('Rising sign')
  expect(flat).not.toContain('DEGREE / HOUSE')
  expect(flat).not.toContain('Sun: Pisces')
  expect(flat).not.toContain('Moon: Cancer')
  expect(flat).not.toContain('℞')
  expect(flat).not.toContain('Square')
  // As JSON keys in the serialised props.
  for (const key of [
    'degree',
    'ascendant',
    'houses',
    'aspects',
    'retrograde',
    'midheaven',
    'birthDate',
    'birthTime',
    'lat',
    'lon',
  ]) {
    expect(propsWire, `prop key ${key}`).not.toMatch(new RegExp(`"${key}"\\s*:`))
  }
  // The owner's own words, and the aura the forge keeps its source charts in.
  for (const probe of [
    ...Object.values(FREE_TEXT),
    'ESSENCE-MARKER',
    'AURA-SOURCECHART-MARKER',
    'sourceCharts',
  ]) {
    expect(flat, `free text ${probe}`).not.toContain(probe)
  }
  // The planetary stats are single longitudes in disguise.
  for (const label of [
    'Lunar Receptivity',
    'Solar Agency',
    'Saturnian Structure',
    'Martial Impetus',
  ]) {
    expect(flat, label).not.toContain(label)
  }
  for (const key of [
    'lunarReceptivity',
    'saturnianStructure',
    'solarAgency',
    'statDeltas',
    'esmsAxisAttribution',
  ]) {
    const withValue = new RegExp(`"${key}"\\s*:\\s*(?!null)`)
    expect(propsWire, `prop ${key}`).not.toMatch(withValue)
  }
  // Nothing printed finer than a whole number: a float in a style attribute is a longitude.
  for (const [, width] of html.matchAll(/width:\s*([\d.]+)%/g)) {
    expect(Number.isInteger(Number(width)), `width ${width}%`).toBe(true)
  }
}

/** Conversations: never in any surface, for any viewer. */
function expectNoConversations(surface: { all: string }) {
  const flat = text(surface.all)
  for (const probe of [
    CHAT.user,
    'USERMSG-MARKER',
    CHAT.agentResponse,
    CHAT.session,
    'CONTEXT-MARKER',
    'ctxsecret',
    EVENT.payload,
    EVENT.session,
    EVENT.user,
  ]) {
    expect(flat, `chat datum ${probe}`).not.toContain(probe)
  }
}

beforeEach(() => {
  seedWorld()
  vi.mocked(notFound).mockImplementation((() => {
    throw new Error('NEXT_NOT_FOUND')
  }) as any)
})

// ── The page is not a cached page ───────────────────────────────────────────

describe('route configuration', () => {
  it('is rendered per request: nothing viewer-specific may sit in a shared cache', async () => {
    const mod: any = await import('@/app/(app)/agent/[id]/page')
    expect(mod.dynamic).toBe('force-dynamic')
    expect(mod.revalidate).toBeUndefined()
    expect(mod.generateStaticParams).toBeUndefined()
  })

  it('reads the agent only through the loader, never the unprojected resolver or the chat table', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../app/(app)/agent/[id]/page.tsx', import.meta.url)),
      'utf8'
    )
    expect(src).not.toMatch(/from '@\/lib\/agents\/resolve-any-agent'/)
    expect(src).not.toMatch(/\bgetAgentInteractions\b/)
    expect(src).not.toMatch(/\bdbAgentToCraftedAgent\b/)
    expect(src).toMatch(/loadAgentProfile\(/)
  })
})

// ── A vessel with an explicit planets chart (philosophers-stone/create) ─────

describe.each([
  ['anonymous', ANON],
  ['a signed-in stranger', STRANGER],
  ['a session that only CLAIMS to be admin', CLAIMED_ADMIN],
])('forged vessel with a planets chart, seen by %s', (_name, session) => {
  it('serialises none of the owner’s private data into the HTML, the props or the metadata', async () => {
    signInAs(session)
    const page = await renderProfile(PSTONE_ID)
    expectNoPrivateData(page)
    expectNoConversations(page)
  })

  it('still shows what is public by design: the name, the Sun sign, the persona sheet', async () => {
    signInAs(session)
    const { html } = await renderProfile(PSTONE_ID)
    const flat = text(html)
    expect(flat).toContain('Sealed Vessel')
    expect(flat).toContain('Sun in Pisces')
    expect(flat).toContain('Wise')
    expect(flat).toContain('Intuitive')
    expect(flat).toContain('Alchemical Wisdom')
    // The restricted notice, not an empty-looking chart.
    expect(flat).toContain('Natal placements are shown to this vessel’s creator only')
  })

  it('hands the progression panel the level and nothing computed from the degrees', async () => {
    signInAs(session)
    const { props } = await renderProfile(PSTONE_ID)
    const panel = props.find(p => p.name === 'VesselProgressionDisplay')
    expect(panel).toBeDefined()
    const progression = JSON.parse(panel!.props).progression
    expect(progression.vesselLevel).toBeGreaterThanOrEqual(1)
    for (const key of [
      'stats',
      'statDeltas',
      'esmsAxisAttribution',
      'currentOverall',
      'transitDelta',
      'baseOverall',
    ]) {
      expect(progression[key], key).toBeNull()
    }
    expect(progression.reasons).toEqual([
      'Chart-derived ratings are private to the creator of this vessel.',
    ])
  })

  it('does not mount the live rating card, whose payload carries chart-derived fields', async () => {
    signInAs(session)
    const { props } = await renderProfile(PSTONE_ID)
    expect(props.find(p => p.name === 'AgentRatingCard')).toBeUndefined()
  })

  it('titles the page from public fields only', async () => {
    signInAs(session)
    const { meta } = await renderProfile(PSTONE_ID)
    expect(meta).toEqual({
      title: 'Sealed Vessel — The Sealed',
      description: 'Sealed Vessel: Wisdom',
    })
  })
})

describe.each([
  ['the vessel’s creator (ledger: blueprint.agentId)', CREATOR, 'creator'],
  ['an admin verified in the database', ADMIN, 'admin'],
])('forged vessel with a planets chart, seen by %s', (_name, session) => {
  it('shows everything the page showed before the fix', async () => {
    signInAs(session)
    const page = await renderProfile(PSTONE_ID)
    const flat = text(page.html)

    expect(flat).toContain('Rising sign: Taurus')
    expect(flat).toContain('Sun in Pisces')
    Object.entries(PLANETS).forEach(([planet, p], index) => {
      // Table row for every body, hover node (title attribute) for the first eight.
      expect(flat).toContain(`${p.degree.toFixed(1)}° (${p.house}H)`)
      if (index < 8) expect(flat).toContain(`title="${planet}: ${p.sign} ${p.degree.toFixed(1)}°"`)
    })
    expect(flat).toContain('℞') // Mercury and Pluto
    expect(flat).toContain('DEGREE / HOUSE')
    expect(flat).toContain('Lunar Receptivity')
    expect(flat).toContain('Saturnian Structure')
    expect(flat).not.toContain('creator only')

    // The unrounded stats and the 19-stat progression ride along, as they always did.
    const panel = page.props.find(p => p.name === 'VesselProgressionDisplay')
    const progression = JSON.parse(panel!.props).progression
    expect(progression.stats).not.toBeNull()
    expect(typeof progression.stats.lunarReceptivity).toBe('number')
  })

  it('still never receives anybody’s conversations', async () => {
    signInAs(session)
    const page = await renderProfile(PSTONE_ID)
    expectNoConversations(page)
    expect(H.conversationQueries).toBe(0)
  })

  it('mounts the live rating card with the agent id and nothing else', async () => {
    signInAs(session)
    const { props } = await renderProfile(PSTONE_ID)
    const card = props.find(p => p.name === 'AgentRatingCard')
    expect(card && JSON.parse(card.props)).toEqual({ agentId: PSTONE_ID })
  })
})

// ── The live forge (create-agent): tropical chart, object traits ────────────

describe('forged vessel written by /api/create-agent', () => {
  it('no longer crashes on object traits, for a stranger or for the creator', async () => {
    for (const session of [ANON, CREATOR]) {
      signInAs(session)
      const { html } = await renderProfile(FORGE_ID)
      expect(text(html)).toContain('Verdant Wren')
      expect(text(html)).toContain('None registered')
    }
  })

  it('shows a stranger the Sun sign from the forge shape and nothing of the chart or the free text', async () => {
    signInAs(STRANGER)
    const page = await renderProfile(FORGE_ID)
    const flat = text(page.all)
    expect(flat).toContain('Sun in Leo')
    for (const probe of [
      '141.7',
      '71.3',
      '212.9',
      'Scorpio',
      'Gemini',
      'Rising sign',
      ...Object.values(FREE_TEXT),
      'sourceCharts',
      '1991',
    ]) {
      expect(flat, probe).not.toContain(probe)
    }
    expectNoConversations(page)
    expect(page.props.find(p => p.name === 'AgentRatingCard')).toBeUndefined()
  })

  it('shows the creator the same page the page always rendered for this chart shape', async () => {
    signInAs(CREATOR)
    const { html } = await renderProfile(FORGE_ID)
    const flat = text(html)
    // The page reads only `natalChart.planets`; the forge shape has none, so no placements.
    expect(flat).not.toContain('creator only')
    expect(flat).toContain('DEGREE / HOUSE')
    expect(flat).toContain('Rising sign: Aries')
  })
})

// ── Fail closed ─────────────────────────────────────────────────────────────

describe('fail closed', () => {
  it('treats a database row that neither PR #67 marker catches as a person’s vessel', async () => {
    signInAs(STRANGER)
    const page = await renderProfile(PYTHON_ID)
    expectNoPrivateData(page)
    signInAs(ADMIN)
    expect(text((await renderProfile(PYTHON_ID)).html)).toContain('Rising sign: Taurus')
  })

  it('does not hand the creator of ANOTHER vessel this one', async () => {
    signInAs(CREATOR)
    const page = await renderProfile(PYTHON_ID)
    expectNoPrivateData(page)
  })

  it('gives a stranger the projection, and says why, when the session store is down', async () => {
    H.authThrows = true
    const page = await renderProfile(PSTONE_ID)
    expectNoPrivateData(page)
    expect(text(page.html)).toContain('We could not confirm who is viewing')
  })

  it('gives the creator the projection, and says why, when the creator ledger cannot be read', async () => {
    signInAs(CREATOR)
    H.ledgerThrows = true
    const page = await renderProfile(PSTONE_ID)
    expectNoPrivateData(page)
    expect(text(page.html)).toContain('We could not confirm who is viewing')
  })

  it('does not say "could not confirm" to an ordinary stranger', async () => {
    signInAs(STRANGER)
    const page = await renderProfile(PSTONE_ID)
    expect(text(page.html)).not.toContain('We could not confirm who is viewing')
  })

  it('says the Sun sign is not recorded rather than inventing Aries, for a stranger', async () => {
    signInAs(STRANGER)
    const flat = text((await renderProfile(SUNLESS_ID)).html)
    expect(flat).toContain('Sun sign not recorded')
    expect(flat).not.toContain('Sun in Aries')
    expect(flat).not.toContain('Moon: Cancer')
    // The creator keeps the page as it always was, fallback and all.
    signInAs(CREATOR)
    H.ledger.push({ id: 'ca-3', creatorId: 'owner-1', blueprint: { agentId: SUNLESS_ID } })
    expect(text((await renderProfile(SUNLESS_ID)).html)).toContain('Sun in Aries')
  })

  it('answers 404, not a half page, for an id that is nobody', async () => {
    await expect(renderProfile('agent-nobody-1')).rejects.toThrow('NEXT_NOT_FOUND')
  })
})

// ── Public figures are untouched, and never cost a session read ─────────────

describe('canonical roster agent', () => {
  it('renders its whole chart to an anonymous visitor, without reading the session', async () => {
    const einstein = getHistoricalAgent('albert-einstein')!
    const sun = einstein.consciousness.natalChart.planets.Sun
    const page = await renderProfile('albert-einstein')
    const flat = text(page.html)

    expect(flat).toContain('Natal Chart Placements')
    expect(flat).toContain('DEGREE / HOUSE')
    expect(flat).toContain(`${sun.degree.toFixed(1)}°`)
    expect(flat).toContain('Lunar Receptivity')
    expect(flat).not.toContain('creator only')
    expect(H.authCalls).toBe(0)

    const card = page.props.find(p => p.name === 'AgentRatingCard')
    expect(card && JSON.parse(card.props)).toEqual({ agentId: 'albert-einstein' })
  })

  it('still loses its visitors’ conversations: no viewer is shown another person’s chat', async () => {
    H.conversations = [
      {
        id: 'conv-ein',
        agentId: 'albert-einstein',
        sessionId: CHAT.session,
        userId: CHAT.user,
        userMessage: CHAT.userMessage,
        agentResponse: CHAT.agentResponse,
        contextData: { ctxsecret: CHAT.context },
        createdAt: new Date('2026-10-19T00:00:00.000Z'),
      },
    ]
    for (const session of [ANON, STRANGER, ADMIN]) {
      signInAs(session)
      const page = await renderProfile('albert-einstein')
      expectNoConversations(page)
      expect(text(page.html)).toContain(
        'Conversations with Albert Einstein are private to the people who held them.'
      )
    }
    expect(H.conversationQueries).toBe(0)
  })
})

// ── What the client components are given ────────────────────────────────────

describe('activity handed to the client components', () => {
  it('is the agent’s own events reduced to what the components render', async () => {
    signInAs(STRANGER)
    const page = await renderProfile(PSTONE_ID)
    const activity = page.props.find(p => p.name === 'AgentActivity')
    const stitch = page.props.find(p => p.name === 'StitchProfileClient')
    expect(activity && stitch).toBeTruthy()

    const { actions, artifacts, interactions, discoursesWithheld } = JSON.parse(activity!.props)
    expect(interactions).toEqual([])
    expect(discoursesWithheld).toBe(true)
    expect(actions).toEqual([
      {
        id: `evt-${PSTONE_ID}`,
        type: 'recipe_generation',
        createdAt: '2026-10-20T00:00:00.000Z',
        metadata: {},
        links: { recipe: expect.stringContaining('r-moon-soup') },
      },
    ])
    expect(artifacts.map((a: any) => a.title)).toEqual(['Moon Soup'])
    expect(JSON.parse(stitch!.props).actions).toEqual(actions)
    expect(JSON.parse(stitch!.props).interactions).toEqual([])
  })
})

describe('a failed activity read', () => {
  it('says it could not load, instead of reading as "nothing yet"', async () => {
    H.eventsThrow = true
    for (const id of [PSTONE_ID, 'albert-einstein']) {
      const flat = text((await renderProfile(id)).html)
      expect(flat).toContain('Actions could not be loaded right now')
      expect(flat).toContain('Creations could not be loaded right now')
      expect(flat).not.toContain('No actions recorded yet.')
      expect(flat).not.toContain('No recipes or lab entries yet')
    }
  })

  it('says "nothing yet" only when the read worked and found nothing', async () => {
    H.events = []
    const flat = text((await renderProfile(PSTONE_ID)).html)
    expect(flat).toContain('No actions recorded yet.')
    expect(flat).toContain('No recipes or lab entries yet')
    expect(flat).not.toContain('could not be loaded right now')
  })
})

// ── The loader, directly ────────────────────────────────────────────────────

describe('loadAgentProfile', () => {
  it('classifies each viewer', async () => {
    const { loadAgentProfile } = await import('@/lib/agents/agent-profile.server')
    const access = async (id: string, session: any) => {
      signInAs(session)
      return (await loadAgentProfile(id))?.access
    }
    expect(await access(PSTONE_ID, ANON)).toBe('restricted')
    expect(await access(PSTONE_ID, STRANGER)).toBe('restricted')
    expect(await access(PSTONE_ID, CLAIMED_ADMIN)).toBe('restricted')
    expect(await access(PSTONE_ID, CREATOR)).toBe('creator')
    expect(await access(FORGE_ID, CREATOR)).toBe('creator') // ledger: momentChart.agentId
    expect(await access(PYTHON_ID, CREATOR)).toBe('restricted')
    expect(await access(PSTONE_ID, ADMIN)).toBe('admin')
    expect(await access('albert-einstein', ANON)).toBe('public')
    expect(await access('nobody-here', ANON)).toBeUndefined()
  })

  it('keeps the seeded sky sprites public', async () => {
    const { loadAgentProfile } = await import('@/lib/agents/agent-profile.server')
    H.rows.set('planetary-mars-aries-12', {
      ...pstoneRow,
      agentId: 'planetary-mars-aries-12',
      name: 'Mars at 12 Aries',
      historicalEra: 'Planetary',
      craftedBy: 'philosopher-stone',
    })
    signInAs(ANON)
    const view = await loadAgentProfile('planetary-mars-aries-12')
    expect(view?.access).toBe('public')
    expect(H.authCalls).toBe(0)
  })

  it('never lets the full row travel with a restricted view', async () => {
    const { loadAgentProfile } = await import('@/lib/agents/agent-profile.server')
    signInAs(STRANGER)
    const view = await loadAgentProfile(PSTONE_ID)
    const wire = JSON.stringify(view)
    expectNoPrivateData({ all: wire, html: wire, propsWire: wire })
    expect(wire).not.toContain('"Moon"')
  })
})
