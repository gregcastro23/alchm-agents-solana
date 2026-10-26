import { describe, it, expect } from 'vitest'
import {
  clampStat,
  computeOvr,
  computeRelativeAdvantage,
  resolveArchetype,
  evaluateSealTier,
  evaluateSurgeState,
  determineMonicaState,
  computeMeanAlignedRating,
  buildCanonicalSeal,
  ROSTER_BASELINE_RATINGS,
  GLOBAL_ROSTER_MEAN,
  FIXTURE_AGENTS,
  SACRED_STAT_KEYS,
  SEAL_STAT_GATES,
  SEAL_ESMS_GATES,
  CANONICAL_SEAL_CATALOG,
  RATING_BOUNDS,
} from '@/lib/agents/rating-contract'

describe('Vessel Rating & Resonance Surge Contract', () => {
  describe('Sacred 7 Stats & Clamping', () => {
    it('has exactly 7 canonical sacred stat keys', () => {
      expect(SACRED_STAT_KEYS).toEqual([
        'power',
        'resonance',
        'wisdom',
        'charisma',
        'intuition',
        'adaptability',
        'vitality',
      ])
    })

    it('clamps values strictly onto [25, 99]', () => {
      expect(clampStat(10)).toBe(25)
      expect(clampStat(-50)).toBe(25)
      expect(clampStat(25)).toBe(25)
      expect(clampStat(88)).toBe(88)
      expect(clampStat(99)).toBe(99)
      expect(clampStat(120)).toBe(99)
      expect(clampStat(NaN)).toBe(25)
    })

    it('exports canonical RATING_BOUNDS with ±15 transitDelta and ±18/±24 stat delta caps', () => {
      expect(RATING_BOUNDS).toEqual({
        MIN_OVERALL: 25,
        MAX_OVERALL: 99,
        MAX_LEVEL_BOOST: 12,
        MIN_TRANSIT_DELTA: -15,
        MAX_TRANSIT_DELTA: 15,
        MAX_SACRED_STAT_DELTA: 18,
        MAX_PLANETARY_STAT_DELTA: 24,
      })
    })
  })

  describe('OWA OVR Calculation', () => {
    it('calculates OVR with 1.6 top stat, 1.3 second stat, 1.0 rest', () => {
      const flat50 = {
        power: 50,
        resonance: 50,
        wisdom: 50,
        charisma: 50,
        intuition: 50,
        adaptability: 50,
        vitality: 50,
      }
      expect(computeOvr(flat50)).toBe(50)

      // Top stat 99, second 90, rest 50
      // weightedSum = 99*1.6 (158.4) + 90*1.3 (117) + 50*1.0 (50) = 325.4
      // 325.4 / 3.9 = 83.435 -> rounds to 83
      const skewed = {
        power: 99,
        resonance: 90,
        wisdom: 50,
        charisma: 50,
        intuition: 50,
        adaptability: 50,
        vitality: 50,
      }
      expect(computeOvr(skewed)).toBe(83)
    })

    it('supports custom divisor if provided', () => {
      const flat50 = {
        power: 50,
        resonance: 50,
        wisdom: 50,
        charisma: 50,
        intuition: 50,
        adaptability: 50,
        vitality: 50,
      }
      // with divisor 3.9, should be 50
      expect(computeOvr(flat50, { divisor: 3.9 })).toBe(50)
    })
  })

  describe('Relative Advantage & Archetype Title Resolution', () => {
    it('computes relative advantage deltas against roster baseline', () => {
      const stats = {
        power: 73,
        resonance: 62,
        wisdom: 84,
        charisma: 61,
        intuition: 72,
        adaptability: 63,
        vitality: 72,
      }
      const relAdv = computeRelativeAdvantage(stats)
      expect(relAdv.power).toBe(10.0)
      expect(relAdv.resonance).toBe(0.0)
      expect(relAdv.wisdom).toBe(20.0)
      expect(relAdv.charisma).toBe(0.0)
    })

    it('resolves primary and secondary signature archetype from relative advantage', () => {
      const relAdv = {
        power: 5.0,
        resonance: 25.0, // secondary
        wisdom: 10.0,
        charisma: 8.0,
        intuition: 32.0, // primary
        adaptability: 12.0,
        vitality: 4.0,
      }
      const archetype = resolveArchetype(relAdv)
      expect(archetype.primary).toBe('intuition')
      expect(archetype.secondary).toBe('resonance')
      expect(archetype.title).toBe('Reclusive Visionary')
    })
  })

  describe('Alchemical Seal Evaluation', () => {
    it('evaluates seal tiers according to stat gates and ESMS holding gates', () => {
      // Celestial requires aligned stat >= 96 and ESMS >= 250.0
      expect(evaluateSealTier('wisdom', 98, 300.0, false)).toBe('Celestial')

      // Placeholders strictly barred from Celestial
      expect(evaluateSealTier('wisdom', 98, 300.0, true)).toBe('Astral')

      // Copper gate: aligned stat >= 74 and ESMS >= 0.5
      expect(evaluateSealTier('resonance', 75, 1.0, false)).toBe('Copper')
      expect(evaluateSealTier('power', 85, 1.0, false)).toBe('Copper')

      // Insufficient ESMS fails to unlock tier
      expect(evaluateSealTier('power', 99, 0.1, false)).toBe(null)
    })

    it('builds canonical seal from catalog with tier multiplier', () => {
      const seal = buildCanonicalSeal('power', 'Gold')
      expect(seal.name).toBe('Crucible Finisher')
      expect(seal.category).toBe('substance')
      expect(seal.tier).toBe('Gold')
      expect(seal.multiplier).toBe(1.18)
    })
  })

  describe('Resonance Surge Ignition & Multi-Harmonic State', () => {
    it('ignites surge when meter >= 70', () => {
      const surgeActive = evaluateSurgeState(75, 0.8, 0.5, 'wisdom', 'intuition')
      expect(surgeActive.active).toBe(true)
      expect(surgeActive.surgeType).toBe('inferno') // heat >= reactivity
      expect(surgeActive.statBoosts.wisdom).toBe(12)
      expect(surgeActive.statBoosts.intuition).toBe(8)
      expect(surgeActive.statBoosts.power).toBe(4)

      const surgeDormant = evaluateSurgeState(65, 0.8, 0.5, 'wisdom', 'intuition')
      expect(surgeDormant.active).toBe(false)
      expect(Object.keys(surgeDormant.statBoosts).length).toBe(0)
    })

    it('activates equilibrium dual-harmonic surge on monica constant 1.618', () => {
      const eqSurge = evaluateSurgeState(92, 0.7, 0.7, 'intuition', 'resonance', 1.618)
      expect(eqSurge.active).toBe(true)
      expect(eqSurge.surgeType).toBe('equilibrium')
      expect(eqSurge.monicaState).toBe('equilibrium')
      // Dual harmonic boosts: +16 primary, +12 secondary, +8 others
      expect(eqSurge.statBoosts.intuition).toBe(16)
      expect(eqSurge.statBoosts.resonance).toBe(12)
      expect(eqSurge.statBoosts.wisdom).toBe(8)
    })
  })

  describe('Fixture Pilots Rating Verification', () => {
    it('verifies Isaac Newton fixture rating payload', () => {
      const newton = FIXTURE_AGENTS.find(a => a.key === 'isaac-newton')!
      expect(newton).toBeDefined()
      expect(newton.ovr).toBe(90)
      expect(newton.archetype.title).toBe('Celestial Mechanist')
      expect(newton.surge.active).toBe(true)
      expect(newton.surge.surgeType).toBe('inferno')
      expect(newton.appearance).toBeDefined()
      expect(newton.appearance!.signatureRelic).toBe('prism-octahedron')
    })

    it('verifies Emily Dickinson fixture rating payload', () => {
      const emily = FIXTURE_AGENTS.find(a => a.key === 'emily-dickinson')!
      expect(emily).toBeDefined()
      expect(emily.ovr).toBe(90)
      expect(emily.archetype.title).toBe('Reclusive Visionary')
      expect(emily.surge.active).toBe(true)
      expect(emily.surge.surgeType).toBe('equilibrium')
      expect(emily.appearance).toBeDefined()
      expect(emily.appearance!.signatureRelic).toBe('herbarium-quill-lantern')
    })

    it('verifies User Avatar Neo fixture rating payload', () => {
      const neo = FIXTURE_AGENTS.find(a => a.key === 'user-avatar-neo')!
      expect(neo).toBeDefined()
      expect(neo.ovr).toBe(84)
      expect(neo.archetype.title).toBe('Apex Sovereign')
      expect(neo.surge.active).toBe(true)
      expect(neo.appearance).toBeDefined()
      expect(neo.appearance!.signatureRelic).toBe('solar-astrolabe')
    })
  })
})
