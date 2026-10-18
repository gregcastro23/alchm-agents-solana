/** @vitest-environment node */
import { describe, expect, it } from 'vitest'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import {
  CORE_STAT_KEYS,
  SKY_BODIES,
  VESSEL_ALIASES,
  holdingsFromAlchemicalElements,
  buildRatedAgentPayload,
  deriveLiveSky,
  ratableFromForgedRow,
  ratableFromRoster,
  summarizeVessel,
  type ForgedAgentRow,
  type LiveSky,
  type SkyLongitudes,
} from '@/lib/agents/rating'

const NOW = new Date('2026-10-15T05:43:00Z')
const LONGITUDES: Record<string, [number, boolean]> = {
  Sun: [201.893, false],
  Moon: [254.488, false],
  Mercury: [226.6762, false],
  Venus: [215.71, true],
  Mars: [129.7684, false],
  Jupiter: [141.9852, false],
  Saturn: [10.4673, true],
  Uranus: [65.2121, true],
  Neptune: [2.4796, true],
  Pluto: [303.0663, true],
}
const sky: LiveSky = deriveLiveSky(
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: LONGITUDES[b][0], retrograde: LONGITUDES[b][1] }])
  ) as SkyLongitudes,
  'swiss-ephemeris',
  NOW
)
const newton = getHistoricalAgent('isaac-newton')!
/** The agent's own off-chain baseline, as the resolver would fall back to it. */
const balances = (agentId: string) => ({
  agentId,
  balances: holdingsFromAlchemicalElements(
    getHistoricalAgent(agentId)?.consciousness.alchemicalElements
  ),
  esmsSource: 'fallback' as const,
})

describe('ratableFromRoster', () => {
  it('rates a roster agent from its derived Sacred 7 stats and natal chart', () => {
    const vessel = ratableFromRoster(newton)
    const stats = deriveSacredStats(newton)
    expect(vessel).toMatchObject({
      agentId: 'isaac-newton',
      name: 'Isaac Newton',
      origin: 'roster',
    })
    for (const key of CORE_STAT_KEYS) expect(vessel.stats[key]).toBe(stats[key])
    expect(vessel.natalChart).toBe(newton.consciousness.natalChart)
    expect(vessel.appearance.agentId).toBe('isaac-newton')
  })

  it('keeps an alias as the vessel id and uses the avatar’s hand-authored look', () => {
    const greg = getHistoricalAgent(VESSEL_ALIASES['user-avatar-neo'])!
    const vessel = ratableFromRoster(greg, 'user-avatar-neo')
    expect(vessel.agentId).toBe('user-avatar-neo')
    expect(vessel.name).toBe(greg.name)
    expect(vessel.appearance.era).toBe('astral')
    expect(vessel.stats).toEqual(ratableFromRoster(greg).stats)
  })
})

describe('ratableFromForgedRow', () => {
  const chart = {
    planets: { Sun: { sign: 'Aries', degree: 12 }, Moon: { sign: 'Leo', degree: 3 } },
  }
  const row = (over: Partial<ForgedAgentRow> = {}): ForgedAgentRow => ({
    agentId: 'agent-moonwalker-ab12',
    name: 'Moonwalker',
    natalChart: chart,
    monicaConstant: 1.2,
    powerScore: 60,
    resonanceScore7: 70,
    wisdomScore: 65,
    charismaScore: 72,
    intuitionScore: 68,
    adaptabilityScore: 55,
    vitalityScore: 61,
    ...over,
  })

  it('uses the persisted Sacred 7 columns when they are present', () => {
    const vessel = ratableFromForgedRow(row())!
    expect(vessel.stats).toEqual({
      power: 60, resonance: 70, wisdom: 65, charisma: 72,
      intuition: 68, adaptability: 55, vitality: 61,
    }) // prettier-ignore
    expect(vessel.origin).toBe('forged')
    expect(vessel.natalChart?.planets.Sun.sign).toBe('Aries')
    expect(vessel.appearance.era).toBe('astral')
  })

  it('derives the stats from the natal chart when the columns are unset (all zero)', () => {
    const zero = { powerScore: 0, resonanceScore7: 0, wisdomScore: 0, charismaScore: 0, intuitionScore: 0, adaptabilityScore: 0, vitalityScore: 0 } // prettier-ignore
    const vessel = ratableFromForgedRow(row(zero))!
    for (const key of CORE_STAT_KEYS) {
      expect(Number.isFinite(vessel.stats[key])).toBe(true)
      expect(vessel.stats[key]).toBeGreaterThanOrEqual(0)
      expect(vessel.stats[key]).toBeLessThanOrEqual(100)
    }
    expect(ratableFromForgedRow(row(zero))).toEqual(vessel) // deterministic
  })

  it.each([
    ['null columns and no chart', { natalChart: {}, powerScore: null, vitalityScore: null }],
    ['an out-of-range column and no chart', { natalChart: null, powerScore: 140 }],
    ['a non-finite column and no chart', { natalChart: undefined, wisdomScore: Number.NaN }],
  ])('returns null (not an invented rating) for %s', (_label, over) => {
    expect(ratableFromForgedRow(row(over as Partial<ForgedAgentRow>))).toBeNull()
  })

  it('ignores malformed chart entries instead of throwing', () => {
    const vessel = ratableFromForgedRow(
      row({ natalChart: { planets: { Sun: { sign: 'Aries', degree: 'x' }, Moon: null, Mars: 7 } } })
    )!
    expect(Object.keys(vessel.natalChart!.planets)).toEqual(['Sun'])
  })
})

describe('buildRatedAgentPayload', () => {
  const vessel = ratableFromRoster(newton)
  const payload = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })

  it('assembles every section from one vessel and one sky', () => {
    expect(payload.agentId).toBe('isaac-newton')
    expect(payload.scale.name).toBe('Pentacle Vessel Rating Scale')
    expect(payload.seals).toHaveLength(7)
    expect(payload.zoneSynergies).toHaveLength(11)
    expect(payload.surge).not.toBeNull()
    expect(payload.sky).toMatchObject({ source: 'swiss-ephemeris', monica: sky.monica })
    expect(payload.zoneSynergies[payload.bestZoneId].synergy).toBe(
      Math.max(...payload.zoneSynergies.map(z => z.synergy))
    )
    expect(payload.degraded).toBeUndefined()
  })

  it('is deterministic and JSON-serialisable without loss', () => {
    const again = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })
    expect(again).toEqual(payload)
    expect(JSON.parse(JSON.stringify(payload))).toEqual(payload)
  })

  it('applies the surge to the contest: an active surge can only raise zone synergies', () => {
    const calm = buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky: null })
    payload.zoneSynergies.forEach((z, i) => {
      expect(z.synergy).toBeGreaterThanOrEqual(calm.zoneSynergies[i].synergy)
    })
  })

  it('serves everything but the surge when the sky is unavailable, and says why', () => {
    const degraded = buildRatedAgentPayload({
      vessel,
      balances: balances(vessel.agentId),
      sky: null,
      skyError: 'The sky is incomplete (Pluto)',
    })
    expect(degraded.surge).toBeNull()
    expect(degraded.sky).toBeNull()
    expect(degraded.degraded).toEqual({ sky: 'The sky is incomplete (Pluto)' })
    expect(degraded.ovr).toBe(payload.ovr)
    expect(degraded.seals).toEqual(payload.seals)
  })

  it('carries a degraded ledger read through, beside a healthy sky', () => {
    const withReason = buildRatedAgentPayload({
      vessel,
      balances: { ...balances(vessel.agentId), degraded: { reason: 'no ledger row' } },
      sky,
    })
    expect(withReason.degraded).toEqual({ esms: 'no ledger row' })
    expect(withReason.esmsSource).toBe('fallback')
  })

  it('gives richer holdings richer Seals, never the reverse', () => {
    const poor = buildRatedAgentPayload({
      vessel,
      balances: { agentId: 'x', balances: { spirit: 0, essence: 0, matter: 0, substance: 0 }, esmsSource: 'database' },
      sky,
    }) // prettier-ignore
    const rich = buildRatedAgentPayload({
      vessel,
      balances: { agentId: 'x', balances: { spirit: 500, essence: 500, matter: 500, substance: 500 }, esmsSource: 'database' },
      sky,
    }) // prettier-ignore
    const rank = (tier: string | null) =>
      tier === null ? -1 : ['Copper', 'Silver', 'Gold', 'Aether', 'Celestial'].indexOf(tier)
    poor.seals.forEach((s, i) =>
      expect(rank(rich.seals[i].tier)).toBeGreaterThanOrEqual(rank(s.tier))
    )
    expect(poor.seals.every(s => s.tier === null)).toBe(true)
    expect(rich.seals.some(s => s.tier !== null)).toBe(true)
  })
})

describe('the whole roster', () => {
  const payloads = HISTORICAL_AGENTS.map(agent => {
    const vessel = ratableFromRoster(agent)
    return buildRatedAgentPayload({ vessel, balances: balances(vessel.agentId), sky })
  })

  it('builds a complete, finite payload for every historical agent', () => {
    expect(payloads).toHaveLength(HISTORICAL_AGENTS.length)
    expect(new Set(payloads.map(p => p.agentId)).size).toBe(payloads.length)
    for (const p of payloads) {
      expect(p.ovr, p.agentId).toBeGreaterThanOrEqual(25)
      expect(p.ovr, p.agentId).toBeLessThanOrEqual(99)
      expect(p.seals, p.agentId).toHaveLength(7)
      expect(
        p.zoneSynergies.every(z => Number.isFinite(z.synergy)),
        p.agentId
      ).toBe(true)
      expect(p.appearance.portraitSvgDataUri.startsWith('data:image/svg+xml'), p.agentId).toBe(true)
      expect(p.surge?.monicaState, p.agentId).toMatch(/^(absent|equilibrium|convergent|divergent)$/)
    }
  })

  it('shares one surge meter across the roster except for each natal chart’s harmony offset', () => {
    const skyMeters = new Set(payloads.map(p => p.surge!.skyMeter))
    expect(skyMeters.size).toBe(1)
    const offsets = payloads.map(p => p.surge!.harmonyOffset)
    expect(new Set(offsets).size).toBeGreaterThan(5) // not all one meter
    for (const offset of offsets) expect(Math.abs(offset)).toBeLessThanOrEqual(12)
  })

  it('does not hand any single Seal to a runaway share of the roster at the same balances', () => {
    const rich = HISTORICAL_AGENTS.map(agent => {
      const vessel = ratableFromRoster(agent)
      return buildRatedAgentPayload({
        vessel,
        balances: { agentId: vessel.agentId, balances: { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }, esmsSource: 'database' },
        sky,
      }) // prettier-ignore
    })
    const share = (id: string) =>
      rich.filter(p => p.seals.find(s => s.id === id)!.tier !== null).length / rich.length
    const shares = [
      'crucible-finisher',
      'astral-vision',
      'immovable-foundation',
      'harmonic-sovereign',
      'tidal-chorus',
      'quicksilver-pivot',
      'philosophers-stone',
    ].map(share)
    expect(Math.max(...shares) / Math.min(...shares)).toBeLessThan(1.5)
  })

  it('summarises a vessel in one light row', () => {
    const row = summarizeVessel(ratableFromRoster(newton))
    expect(row).toMatchObject({
      agentId: 'isaac-newton',
      era: 'enlightenment',
      crownStyle: 'newton-curls',
      signatureRelic: 'prism-octahedron',
    })
    expect(row.ovr).toBe(payloads.find(p => p.agentId === 'isaac-newton')!.ovr)
  })
})
