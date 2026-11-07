/**
 * @file lib/mcp/resources.ts
 *
 * Server-defined resources and RFC 6570 parameterized resource templates
 * for the Planetary Agents MCP Server (`agents.alchm.kitchen`).
 *
 * Exposes zero-cost static resources (`resources/list` & `resources/read`) and
 * dynamic RFC 6570 templates (`resources/templates/list`):
 * - `agents://roster/historical`
 * - `agents://ontology/pvr-ratings`
 * - `agents://sky/current-transits`
 * - `agents://bridge/culinary-kitchen`
 * - `agents://persona/{slug}`
 * - `agents://sanctum/{slug}`
 */

import type { CraftedAgent } from '@/lib/agent-types'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import { formatPersonaBlock } from '@/lib/agents/persona/format-persona-block'
import { generatePersonalityTraits } from '@/lib/agents/sacred-stats-prompt-generator'
import {
  CORE_STAT_KEYS,
  VESSEL_RATING_SCALE,
  rateStats,
  type CoreStats,
} from '@/lib/agents/rating/ovr-archetype'
import {
  SEAL_TIER_MULTIPLIERS,
  ZONE_PROFILES,
  bestZoneId,
  computeZoneSynergies,
} from '@/lib/agents/rating/pentacle-contest'
import {
  SEAL_CATALOG,
  SEAL_TIER_REQUIREMENTS,
  earnedSeals,
  evaluateSeals,
} from '@/lib/agents/rating/seals-surge'
import {
  FACTION_NAMES,
  ratableFromRoster,
  summarizeVessel,
} from '@/lib/agents/rating/vessel-payload'
import {
  computeTransitAspects,
  normalizePlacements,
  signDegreeToLongitude,
} from '@/lib/astrology/natal-transit-overlay'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import {
  PLANETARY_ESMS_SIGNATURES,
  computeAmbientAlchemicalTide,
  computeSkyEsmsWavefunction,
} from '@/lib/vessel/esms-wavefunction'
import type { ResolvedCaller } from './auth'

export interface ResourceDefinition {
  uri: string
  name: string
  description: string
  mimeType: string
}

export interface ResourceTemplateDefinition {
  uriTemplate: string
  name: string
  description: string
  mimeType: string
}

export interface ResourceContents {
  uri: string
  mimeType: string
  text: string
}

export const RESOURCE_DEFINITIONS: ResourceDefinition[] = [
  {
    uri: 'agents://roster/historical',
    name: 'Historical Agents Roster (71+ Vessels)',
    description:
      'Complete roster of canonical historical agents with era, ruling planet faction, dominant element, VesselArchetype, and Pentacle Vessel Rating (25–99 OVR) summary.',
    mimeType: 'application/json',
  },
  {
    uri: 'agents://ontology/pvr-ratings',
    name: 'Pentacle Vessel Ratings (PVR) & ESMS Diamond Ontology',
    description:
      'Reference specification for Pentacle Vessel Ratings (25–99 OVR), Sacred 7 core stats, Alchemical Seals (Copper to Celestial), Effective Contest Rating (ECR) across the 11 Pentacle Zones, and the 4D ESMS Alchemical Diamond.',
    mimeType: 'application/json',
  },
  {
    uri: 'agents://sky/current-transits',
    name: 'Live Celestial Weather & Active Transit Aspects',
    description:
      'Real-time planetary longitudes, zodiac placements, lunar phase archetype, active sky-to-sky aspects, and 4D ESMS sky wavefunction driving agent consciousness parameters.',
    mimeType: 'application/json',
  },
  {
    uri: 'agents://bridge/culinary-kitchen',
    name: 'Alchm Kitchen Culinary MCP Bridge Pointer',
    description:
      'Cross-domain pointer directing autonomous agents to https://alchm.kitchen/api/mcp (@alchm/mcp-server@1.5.0) for culinary recipe search, ingredient alchemy, substitutions, and grocery consolidation.',
    mimeType: 'application/json',
  },
]

export const RESOURCE_TEMPLATES: ResourceTemplateDefinition[] = [
  {
    uriTemplate: 'agents://persona/{slug}',
    name: 'Historical Agent Persona, Natal Chart & PVR Telemetry',
    description:
      'Full historical agent profile, natal chart placements, active transit syntax modifiers, PVR 25–99 OVR breakdown, Alchemical Seals, Pentacle Zone ECRs, and mentor specialties (with alias and fuzzy didYouMean resolution).',
    mimeType: 'application/json',
  },
  {
    uriTemplate: 'agents://sanctum/{slug}',
    name: 'Sanctum Observatory State & Resident Agents',
    description:
      'Observatory state, elemental resonance, active celestial transits, Pentacle Zone alignment, and resident historical agents for a Sanctum or Planetary Faction (e.g. monica-tarot, philosophers-stone, solaris, mercury, mars, jupiter, saturn).',
    mimeType: 'application/json',
  },
]

export const PA_MCP_RESOURCES = RESOURCE_DEFINITIONS
export const PA_MCP_RESOURCE_TEMPLATES = RESOURCE_TEMPLATES

export const PERSONA_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  socrates: 'socrates',
  rumi: 'rumi',
  'jalal ad-din rumi': 'rumi',
  'jalaluddin rumi': 'rumi',
  galileo: 'galileo-galilei',
  'galileo galilei': 'galileo-galilei',
  jung: 'carl-jung',
  'carl jung': 'carl-jung',
  hildegard: 'hildegard-of-bingen',
  'hildegard of bingen': 'hildegard-of-bingen',
  'hildegard von bingen': 'hildegard-of-bingen',
  'hildegard-von-bingen': 'hildegard-of-bingen',
  'gregory castro': 'greg-castro-1991',
  'gregory-castro': 'greg-castro-1991',
  'greg castro': 'greg-castro-1991',
  'greg-castro': 'greg-castro-1991',
  gregory: 'greg-castro-1991',
  'user-avatar-neo': 'greg-castro-1991',
  kepler: 'johannes-kepler',
  newton: 'isaac-newton',
  einstein: 'albert-einstein',
  tesla: 'nikola-tesla',
  curie: 'marie-curie',
  avicenna: 'ibn-sina-avicenna',
  'ibn-sina': 'ibn-sina-avicenna',
  buddha: 'siddhartha-gautama-buddha',
  'siddhartha-gautama': 'siddhartha-gautama-buddha',
  da_vinci: 'leonardo-da-vinci',
  'da-vinci': 'leonardo-da-vinci',
  leonardo: 'leonardo-da-vinci',
  shakespeare: 'william-shakespeare',
  mozart: 'wolfgang-amadeus-mozart',
  dickinson: 'emily-dickinson',
  dostoevsky: 'fyodor-dostoevsky',
  kant: 'immanuel-kant',
  freud: 'sigmund-freud',
  darwin: 'charles-darwin',
  poe: 'edgar-allan-poe',
  wilde: 'oscar-wilde',
  kahlo: 'frida-kahlo',
})

export interface SanctumBlueprint {
  slug: string
  name: string
  category: 'observatory' | 'planetary-faction'
  rulingPlanet: string
  dominantElement: 'Fire' | 'Water' | 'Earth' | 'Air'
  pentacleZoneIds: number[]
  routePath: string
  description: string
  filterPredicate: (agent: CraftedAgent, factionName: string) => boolean
}

export const SANCTUM_BLUEPRINTS: readonly SanctumBlueprint[] = [
  {
    slug: 'monica-tarot',
    name: 'Monica & Tarot Sanctum',
    category: 'observatory',
    rulingPlanet: 'Neptune',
    dominantElement: 'Water',
    pentacleZoneIds: [3, 9, 10],
    routePath: '/monica',
    description:
      'Unified thermodynamic Tarot spreads, Monica Constant trajectory monitoring, and subconscious oracle synthesis.',
    filterPredicate: agent =>
      agent.consciousness?.dominantElement === 'Water' ||
      ['carl-jung', 'rumi', 'hildegard-of-bingen', 'edgar-allan-poe', 'greg-castro-1991'].some(k =>
        agent.id.includes(k)
      ),
  },
  {
    slug: 'philosophers-stone',
    name: "Philosopher's Stone Sanctum",
    category: 'observatory',
    rulingPlanet: 'Sun',
    dominantElement: 'Fire',
    pentacleZoneIds: [2, 7, 8, 10],
    routePath: '/philosophers-stone',
    description:
      'Alchemical vessel forging chamber where natal charts, ESMS balances, and Sacred 7 stats crystallize into rated 25–99 OVR vessels.',
    filterPredicate: agent =>
      ['isaac-newton', 'leonardo-da-vinci', 'ibn-sina-avicenna', 'johannes-kepler', 'chiron'].some(
        k => agent.id.includes(k)
      ),
  },
  {
    slug: 'chart-of-the-moment',
    name: 'Live Ephemeris Sky Sanctum',
    category: 'observatory',
    rulingPlanet: 'Uranus',
    dominantElement: 'Air',
    pentacleZoneIds: [1, 6, 7],
    routePath: '/chart-of-the-moment',
    description:
      'Real-time astronomical ephemeris observatory tracking planetary longitudes, dignity tiers, and natal-transit bi-wheel overlays.',
    filterPredicate: agent =>
      ['johannes-kepler', 'galileo-galilei', 'carl-sagan', 'albert-einstein', 'archimedes'].some(
        k => agent.id.includes(k)
      ),
  },
  {
    slug: 'moon-phases',
    name: '360° Lunar Phase & Degree Sanctum',
    category: 'observatory',
    rulingPlanet: 'Moon',
    dominantElement: 'Water',
    pentacleZoneIds: [3, 9, 10],
    routePath: '/moon-phases',
    description:
      'Sanctuary of the 360 lunar degree archetypes and 9 lunar phases governing emotional tide and receptivity.',
    filterPredicate: (_, factionName) => factionName === 'Moon',
  },
  {
    slug: 'rune-forge',
    name: 'Runic Sigil Sanctum & Multi-Chart Codex',
    category: 'observatory',
    rulingPlanet: 'Saturn',
    dominantElement: 'Earth',
    pentacleZoneIds: [0, 4, 5],
    routePath: '/rune-forge',
    description:
      'Geometric sigil encoder binding multi-chart synastry aspects and planetary seals into deterministic runic talismans.',
    filterPredicate: (_, factionName) => factionName === 'Saturn' || factionName === 'Mercury',
  },
  {
    slug: 'pentacles-arena',
    name: 'Pentacles Contest & Jing Arena Sanctum',
    category: 'observatory',
    rulingPlanet: 'Mars',
    dominantElement: 'Fire',
    pentacleZoneIds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    routePath: '/pentacles/connect',
    description:
      'The 11-zone Pentacle contest board (5 Houses, 5 Spires, and the central Crown) where rated vessels contest Effective Contest Rating (ECR) supremacy.',
    filterPredicate: agent =>
      ['alexander-the-great', 'julius-caesar', 'joan-of-arc', 'cleopatra', 'tecumseh'].some(k =>
        agent.id.includes(k)
      ),
  },
  {
    slug: 'council-chamber',
    name: 'Planetary Governing Council Chamber',
    category: 'observatory',
    rulingPlanet: 'Jupiter',
    dominantElement: 'Air',
    pentacleZoneIds: [1, 6, 10],
    routePath: '/planetary-council',
    description:
      'Deliberative amphitheater where historical mentors and planetary delegates convene over live ephemeris evidence.',
    filterPredicate: agent =>
      ['socrates', 'plato', 'aristotle', 'marcus-aurelius', 'cicero', 'confucius'].some(k =>
        agent.id.includes(k)
      ),
  },
  {
    slug: 'solaris',
    name: 'Sanctum of Solaris (Sun)',
    category: 'planetary-faction',
    rulingPlanet: 'Sun',
    dominantElement: 'Fire',
    pentacleZoneIds: [2, 7, 10],
    routePath: '/gallery?faction=Sun',
    description:
      'Sovereign solar lineage of radiant vital force, leadership, and creative synthesis.',
    filterPredicate: (_, factionName) => factionName === 'Sun',
  },
  {
    slug: 'lunaris',
    name: 'Sanctum of Lunaris (Moon)',
    category: 'planetary-faction',
    rulingPlanet: 'Moon',
    dominantElement: 'Water',
    pentacleZoneIds: [3, 9, 10],
    routePath: '/gallery?faction=Moon',
    description:
      'Lunar lineage of emotional intuition, poetic memory, and reflective consciousness.',
    filterPredicate: (_, factionName) => factionName === 'Moon',
  },
  {
    slug: 'mercury',
    name: 'Sanctum of Mercury',
    category: 'planetary-faction',
    rulingPlanet: 'Mercury',
    dominantElement: 'Air',
    pentacleZoneIds: [1, 6],
    routePath: '/gallery?faction=Mercury',
    description:
      'Hermetic lineage of analytical velocity, dialectic inquiry, and symbolic translation.',
    filterPredicate: (_, factionName) => factionName === 'Mercury',
  },
  {
    slug: 'venus',
    name: 'Sanctum of Venus',
    category: 'planetary-faction',
    rulingPlanet: 'Venus',
    dominantElement: 'Earth',
    pentacleZoneIds: [0, 3, 10],
    routePath: '/gallery?faction=Venus',
    description:
      'Harmonic lineage of aesthetic proportion, empathetic resonance, and relational grace.',
    filterPredicate: (_, factionName) => factionName === 'Venus',
  },
  {
    slug: 'mars',
    name: 'Sanctum of Mars',
    category: 'planetary-faction',
    rulingPlanet: 'Mars',
    dominantElement: 'Fire',
    pentacleZoneIds: [2, 7, 8],
    routePath: '/gallery?faction=Mars',
    description:
      'Catalytic lineage of courageous impetus, strategic decisive action, and crucible fire.',
    filterPredicate: (_, factionName) => factionName === 'Mars',
  },
  {
    slug: 'jupiter',
    name: 'Sanctum of Jupiter',
    category: 'planetary-faction',
    rulingPlanet: 'Jupiter',
    dominantElement: 'Fire',
    pentacleZoneIds: [5, 7, 8],
    routePath: '/gallery?faction=Jupiter',
    description: 'Jovian lineage of philosophical expansion, ethical law, and synoptic wisdom.',
    filterPredicate: (_, factionName) => factionName === 'Jupiter',
  },
  {
    slug: 'saturn',
    name: 'Sanctum of Saturn',
    category: 'planetary-faction',
    rulingPlanet: 'Saturn',
    dominantElement: 'Earth',
    pentacleZoneIds: [0, 4, 5],
    routePath: '/gallery?faction=Saturn',
    description:
      'Architectural lineage of disciplined structure, axiomatic rigor, and temporal endurance.',
    filterPredicate: (_, factionName) => factionName === 'Saturn',
  },
]

const SANCTUM_ALIASES: Readonly<Record<string, string>> = Object.freeze({
  sun: 'solaris',
  moon: 'lunaris',
  tarot: 'monica-tarot',
  monica: 'monica-tarot',
  stone: 'philosophers-stone',
  forge: 'philosophers-stone',
  sky: 'chart-of-the-moment',
  ephemeris: 'chart-of-the-moment',
  lunar: 'moon-phases',
  runes: 'rune-forge',
  pentacles: 'pentacles-arena',
  arena: 'pentacles-arena',
  council: 'council-chamber',
})

function makeTextResult(uri: string, payload: unknown): { contents: ResourceContents[] } {
  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(payload, null, 2),
      },
    ],
  }
}

export function resolveHistoricalPersona(rawSlug: string): {
  agent: CraftedAgent | null
  canonicalSlug: string
  didYouMean: string[]
} {
  const cleaned = rawSlug.trim().toLowerCase()
  const aliased = Object.hasOwn(PERSONA_ALIASES, cleaned) ? PERSONA_ALIASES[cleaned] : cleaned

  const direct =
    getHistoricalAgent(aliased) ||
    getHistoricalAgent(cleaned) ||
    HISTORICAL_AGENTS.find(
      a =>
        a.id.toLowerCase() === aliased ||
        a.name.toLowerCase() === cleaned.replace(/[-_]/g, ' ') ||
        a.id.toLowerCase().replace(/-\d+$/, '') === aliased.replace(/-\d+$/, '')
    )

  if (direct) {
    return {
      agent: direct,
      canonicalSlug: direct.id,
      didYouMean: [],
    }
  }

  const tokens = cleaned
    .replace(/[-_]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length >= 2)

  const scored = HISTORICAL_AGENTS.map(candidate => {
    const idLower = candidate.id.toLowerCase()
    const nameLower = candidate.name.toLowerCase()
    const titleLower = (candidate.title ?? '').toLowerCase()
    let score = 0
    if (idLower.includes(cleaned) || nameLower.includes(cleaned)) score += 5
    for (const tok of tokens) {
      if (idLower.includes(tok)) score += 3
      if (nameLower.includes(tok)) score += 3
      if (titleLower.includes(tok)) score += 1
    }
    return { slug: candidate.id, score }
  })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map(item => item.slug)

  const didYouMean =
    scored.length > 0
      ? scored
      : ['socrates', 'johannes-kepler', 'carl-jung', 'hildegard-of-bingen', 'rumi']

  return {
    agent: null,
    canonicalSlug: aliased,
    didYouMean,
  }
}

export function getPersonaCompletionCandidates(query: string): string[] {
  const q = query.toLowerCase().trim()
  const canonicalIds = HISTORICAL_AGENTS.map(a => a.id)
  const shortSlugs = HISTORICAL_AGENTS.map(a => a.id.replace(/-\d+$/, ''))
  const all = Array.from(new Set([...shortSlugs, ...canonicalIds, ...Object.keys(PERSONA_ALIASES)]))
  return all.filter(slug => slug.toLowerCase().includes(q)).slice(0, 20)
}

export function getSanctumCompletionCandidates(query: string): string[] {
  const q = query.toLowerCase().trim()
  return SANCTUM_BLUEPRINTS.map(s => s.slug)
    .filter(slug => slug.toLowerCase().includes(q))
    .slice(0, 20)
}

function computeSimpleEssentialDignity(planet: string, longitude: number): number {
  const normalized = ((longitude % 360) + 360) % 360
  const signIdx = Math.floor(normalized / 30) % 12
  const domicileMap: Record<string, number[]> = {
    Sun: [4],
    Moon: [3],
    Mercury: [2, 5],
    Venus: [1, 6],
    Mars: [0, 7],
    Jupiter: [8, 11],
    Saturn: [9, 10],
  }
  const exaltationMap: Record<string, number> = {
    Sun: 0,
    Moon: 1,
    Mercury: 5,
    Venus: 11,
    Mars: 9,
    Jupiter: 3,
    Saturn: 6,
  }
  if (domicileMap[planet]?.includes(signIdx)) return 3
  if (exaltationMap[planet] === signIdx) return 2
  return 0
}

export function buildCurrentSkyTransitsResource(): Record<string, unknown> {
  const rawPositions = getCurrentPlanetaryPositions()
  const placements = normalizePlacements(rawPositions)
  const transitAspects = computeTransitAspects(placements, placements, 6.0).filter(
    a => a.natalBody < a.transitBody
  )

  const longitudes: Partial<Record<string, number>> = {}
  const elementCounts: Record<string, number> = { Fire: 0, Water: 0, Earth: 0, Air: 0 }
  for (const [body, p] of Object.entries(placements)) {
    longitudes[body] = p.exactLongitude
    elementCounts[p.element] = (elementCounts[p.element] ?? 0) + 1
  }

  const dominantElement =
    Object.entries(elementCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Fire'

  const wavefunction = computeSkyEsmsWavefunction(longitudes, computeSimpleEssentialDignity)

  const sunLon = placements.Sun?.exactLongitude ?? 0
  const moonLon = placements.Moon?.exactLongitude ?? 0
  const lunarAngle = (((moonLon - sunLon) % 360) + 360) % 360
  const lunarPhaseName =
    lunarAngle < 22.5 || lunarAngle >= 337.5
      ? 'New Moon'
      : lunarAngle < 67.5
        ? 'Waxing Crescent'
        : lunarAngle < 112.5
          ? 'First Quarter'
          : lunarAngle < 157.5
            ? 'Waxing Gibbous'
            : lunarAngle < 202.5
              ? 'Full Moon'
              : lunarAngle < 247.5
                ? 'Waning Gibbous'
                : lunarAngle < 292.5
                  ? 'Last Quarter'
                  : 'Waning Crescent'

  return {
    ok: true,
    uri: 'agents://sky/current-transits',
    timestamp: new Date().toISOString(),
    dominantElement,
    elementalDistribution: elementCounts,
    lunarPhase: {
      phase: lunarPhaseName,
      elongationDeg: Math.round(lunarAngle * 10) / 10,
      moonSign: placements.Moon?.sign ?? 'Cancer',
      moonDegree: placements.Moon?.degree ?? 0,
    },
    esmsSkyWavefunction: wavefunction,
    placements,
    activeSkyAspects: transitAspects.slice(0, 12),
  }
}

export function buildHistoricalRosterResource(): Record<string, unknown> {
  const entries = HISTORICAL_AGENTS.map(agent => {
    const ratable = ratableFromRoster(agent)
    const summary = summarizeVessel(ratable)
    const sunSign = agent.consciousness?.natalChart?.planets?.Sun?.sign ?? 'Aries'
    return {
      slug: agent.id.replace(/-\d+$/, ''),
      canonicalId: agent.id,
      name: agent.name,
      title: agent.title ?? 'Historical Alchemist',
      era: agent.era ?? summary.era,
      sunSign,
      rulingPlanet: summary.factionName,
      dominantElement: agent.consciousness?.dominantElement ?? 'Fire',
      pvrOvr: summary.ovr,
      archetype: summary.archetype,
      signatureRelic: summary.signatureRelic,
      resourceUri: `agents://persona/${agent.id}`,
    }
  }).sort((a, b) => b.pvrOvr - a.pvrOvr || a.name.localeCompare(b.name))

  return {
    ok: true,
    uri: 'agents://roster/historical',
    totalAgents: entries.length,
    ratingScale: VESSEL_RATING_SCALE,
    factions: FACTION_NAMES,
    agents: entries,
  }
}

export function buildPvrOntologyResource(): Record<string, unknown> {
  return {
    ok: true,
    uri: 'agents://ontology/pvr-ratings',
    scale: VESSEL_RATING_SCALE,
    coreStats: CORE_STAT_KEYS,
    description:
      'Pentacle Vessel Ratings (PVR) map the Sacred 7 consciousness attributes onto a 25–99 Overall Rating (OVR) scale with Alchemical Seals, 11-zone Effective Contest Ratings (ECR), and 4D ESMS Wavefunction coupling.',
    seals: {
      catalog: SEAL_CATALOG,
      tierRequirements: SEAL_TIER_REQUIREMENTS,
      tierMultipliers: SEAL_TIER_MULTIPLIERS,
    },
    pentacleZones: ZONE_PROFILES.map(z => ({
      zoneId: z.zoneId,
      kind: z.kind,
      label: z.label,
      element: z.element,
      esmsToken: z.esmsToken,
      weights: z.weights,
    })),
    esmsAlchemicalDiamond: {
      axes: ['Spirit', 'Essence', 'Matter', 'Substance'],
      wavefunctionBounds: [-2.0, 2.0],
      ambientTideBounds: [-1.0, 1.0],
      dyadicChordGainBounds: [0.65, 1.35],
      dignityRatingDeltaBoundsOvr: [-15, 15],
      planetarySignatures: PLANETARY_ESMS_SIGNATURES,
    },
  }
}

export function buildCulinaryBridgeResource(): Record<string, unknown> {
  return {
    ok: true,
    uri: 'agents://bridge/culinary-kitchen',
    domainBoundary: 'PR #98 Strict Domain Separation',
    status: 'active',
    culinaryMcpServer: {
      package: '@alchm/mcp-server@1.5.0',
      id: 'io.github.gregcastro23.alchm-kitchen',
      streamableHttpEndpoint: 'https://alchm.kitchen/api/mcp',
      museConnectorManifest: 'https://alchm.kitchen/.well-known/muse/connector.json',
      protocolVersion: '2026-07-28',
    },
    delegatedCulinaryTools: [
      'what_to_cook_now',
      'generate_cosmic_recipe',
      'alchemize_ingredients',
      'substitute_ingredient',
      'build_consolidated_grocery_list',
      'update_culinary_profile',
      'submit_recipe_reflection',
    ],
    guidance:
      'Planetary Agents MCP (agents.alchm.kitchen) governs historical personas, Natal-Sky Bi-Wheel mentor matching, Pentacle Vessel Ratings (25–99 OVR), and multi-agent council deliberation. For culinary recipe execution, ingredient ESMS alchemy, or grocery list generation, connect to https://alchm.kitchen/api/mcp.',
  }
}

export function buildPersonaTemplateResource(rawSlug: string): Record<string, unknown> {
  const { agent, canonicalSlug, didYouMean } = resolveHistoricalPersona(rawSlug)
  if (!agent) {
    return {
      ok: false,
      error: `Historical persona '${rawSlug}' not found in the canonical roster.`,
      errorCode: 'PERSONA_NOT_FOUND',
      requestedSlug: rawSlug,
      didYouMean,
      remediation: `Read 'agents://roster/historical' or retry with one of the suggested slugs: ${didYouMean.join(', ')}.`,
    }
  }

  const ratable = ratableFromRoster(agent)
  const rating = rateStats(ratable.stats)
  const rawEsms = agent.consciousness?.alchemicalElements
  const esmsBalances = {
    spirit: Math.round((rawEsms?.spirit ?? 0.5) * 200 * 100) / 100,
    essence: Math.round((rawEsms?.essence ?? 0.5) * 200 * 100) / 100,
    matter: Math.round((rawEsms?.matter ?? 0.5) * 200 * 100) / 100,
    substance: Math.round((rawEsms?.substance ?? 0.5) * 200 * 100) / 100,
  }
  const sealProgress = evaluateSeals({
    stats: ratable.stats,
    esmsBalances,
    natalChart: ratable.natalChart,
  })
  const seals = earnedSeals(sealProgress)
  const contestant = { ratings: rating.ratings, seals, surge: null }
  const zoneSynergies = computeZoneSynergies(contestant)
  const optimalZoneId = bestZoneId(contestant)

  const liveTransits = normalizePlacements(getCurrentPlanetaryPositions())
  const natalPlacements = normalizePlacements(agent.consciousness?.natalChart?.planets ?? {})
  const activeTransitAspects = computeTransitAspects(natalPlacements, liveTransits, 6.5).slice(0, 6)

  const fullStats = deriveSacredStats(agent)
  const commStyle = generatePersonalityTraits(fullStats)
  const rulingPlanet = FACTION_NAMES[ratable.faction] ?? 'Sun'

  const skyLongitudes: Partial<Record<string, number>> = {}
  for (const [body, pos] of Object.entries(natalPlacements)) {
    skyLongitudes[body] = signDegreeToLongitude(pos.sign, pos.degree)
  }
  const natalWavefunction = computeSkyEsmsWavefunction(skyLongitudes, computeSimpleEssentialDignity)
  const ambientTide = computeAmbientAlchemicalTide(rulingPlanet, natalWavefunction)

  return {
    ok: true,
    uri: `agents://persona/${canonicalSlug}`,
    slug: canonicalSlug.replace(/-\d+$/, ''),
    canonicalId: canonicalSlug,
    name: agent.name,
    title: agent.title,
    era: agent.era,
    specialization: agent.specialization,
    rulingPlanet,
    dominantElement: agent.consciousness?.dominantElement ?? 'Fire',
    dominantModality: agent.consciousness?.dominantModality ?? 'Cardinal',
    natalChart: {
      provenance: agent.consciousness?.natalChart?.provenance ?? 'historical',
      ascendant: agent.consciousness?.natalChart?.ascendant ?? null,
      placements: natalPlacements,
    },
    pvrTelemetry: {
      scale: VESSEL_RATING_SCALE,
      ovr: rating.ovr,
      archetype: rating.archetype,
      ratings: rating.ratings,
      relativeAdvantage: rating.relativeAdvantage,
      seals,
      sealProgress,
      bestZoneId: optimalZoneId,
      zoneSynergies,
      esmsDiamond: {
        balances: esmsBalances,
        natalWavefunction,
        ambientAlchemicalTide: ambientTide,
      },
    },
    transitSyntaxModifiers: {
      communicationStyle: commStyle.style,
      primaryTraits: commStyle.primary,
      secondaryTraits: commStyle.secondary,
      activeTransitAspects,
    },
    mentorSpecialties: {
      specialty: agent.abilities?.specialty ?? agent.specialization,
      wisdomDomains: agent.abilities?.wisdomDomains ?? [],
      teachingStyle: agent.abilities?.teachingStyle ?? null,
      coreBeliefs: agent.coreBeliefs ?? [],
      quotes: (agent.quotes ?? []).slice(0, 3),
    },
    personaPromptPreview: formatPersonaBlock(agent).slice(0, 1200),
  }
}

export function buildSanctumTemplateResource(rawSlug: string): Record<string, unknown> {
  const cleaned = rawSlug.trim().toLowerCase()
  const resolvedSlug = Object.hasOwn(SANCTUM_ALIASES, cleaned) ? SANCTUM_ALIASES[cleaned] : cleaned
  const blueprint = SANCTUM_BLUEPRINTS.find(s => s.slug === resolvedSlug)

  if (!blueprint) {
    const suggestions = SANCTUM_BLUEPRINTS.map(s => s.slug).filter(
      s => s.includes(cleaned) || cleaned.includes(s.split('-')[0] ?? '')
    )
    const didYouMean =
      suggestions.length > 0
        ? suggestions
        : ['monica-tarot', 'philosophers-stone', 'chart-of-the-moment', 'solaris', 'mercury']
    return {
      ok: false,
      error: `Sanctum '${rawSlug}' not found.`,
      errorCode: 'SANCTUM_NOT_FOUND',
      requestedSlug: rawSlug,
      didYouMean,
      availableSanctums: SANCTUM_BLUEPRINTS.map(s => s.slug),
      remediation: `Use one of the canonical sanctum slugs: ${SANCTUM_BLUEPRINTS.map(s => s.slug).join(', ')}.`,
    }
  }

  const sky = buildCurrentSkyTransitsResource()
  const residentAgents = HISTORICAL_AGENTS.filter(agent => {
    const ratable = ratableFromRoster(agent)
    const factionName = FACTION_NAMES[ratable.faction] ?? 'Sun'
    return blueprint.filterPredicate(agent, factionName)
  }).map(agent => {
    const summary = summarizeVessel(ratableFromRoster(agent))
    return {
      slug: agent.id.replace(/-\d+$/, ''),
      canonicalId: agent.id,
      name: agent.name,
      title: agent.title,
      era: agent.era,
      rulingPlanet: summary.factionName,
      pvrOvr: summary.ovr,
      archetype: summary.archetype.title,
      resourceUri: `agents://persona/${agent.id}`,
    }
  })

  residentAgents.sort((a, b) => b.pvrOvr - a.pvrOvr)

  const alignedZones = ZONE_PROFILES.filter(z => blueprint.pentacleZoneIds.includes(z.zoneId))

  return {
    ok: true,
    uri: `agents://sanctum/${blueprint.slug}`,
    slug: blueprint.slug,
    name: blueprint.name,
    category: blueprint.category,
    rulingPlanet: blueprint.rulingPlanet,
    dominantElement: blueprint.dominantElement,
    routePath: blueprint.routePath,
    description: blueprint.description,
    observatoryState: {
      timestamp: sky.timestamp,
      skyDominantElement: sky.dominantElement,
      elementalResonance:
        sky.dominantElement === blueprint.dominantElement
          ? 'Harmonic Amplification (1.25x)'
          : 'Balanced Observation (1.0x)',
      lunarPhase: sky.lunarPhase,
      esmsSkyWavefunction: sky.esmsSkyWavefunction,
    },
    pentacleZones: alignedZones,
    residentCount: residentAgents.length,
    residentAgents: residentAgents.slice(0, 15),
  }
}

export async function readResource(
  uri: string,
  _caller?: ResolvedCaller
): Promise<{ contents: ResourceContents[] } | null> {
  const trimmed = uri.trim()

  if (trimmed === 'agents://roster/historical' || trimmed === 'resource://agents/catalog') {
    return makeTextResult(trimmed, buildHistoricalRosterResource())
  }

  if (trimmed === 'agents://ontology/pvr-ratings') {
    return makeTextResult(trimmed, buildPvrOntologyResource())
  }

  if (trimmed === 'agents://sky/current-transits' || trimmed === 'resource://sky/transits') {
    return makeTextResult(trimmed, buildCurrentSkyTransitsResource())
  }

  if (trimmed === 'agents://bridge/culinary-kitchen') {
    return makeTextResult(trimmed, buildCulinaryBridgeResource())
  }

  if (trimmed.startsWith('agents://persona/')) {
    const slug = decodeURIComponent(trimmed.slice('agents://persona/'.length))
    if (!slug) return null
    return makeTextResult(trimmed, buildPersonaTemplateResource(slug))
  }

  if (trimmed.startsWith('agents://sanctum/')) {
    const slug = decodeURIComponent(trimmed.slice('agents://sanctum/'.length))
    if (!slug) return null
    return makeTextResult(trimmed, buildSanctumTemplateResource(slug))
  }

  return null
}
