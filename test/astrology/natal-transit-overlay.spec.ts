import { describe, expect, it } from 'vitest'
import {
  ASPECT_DEFINITIONS,
  DEFAULT_USER_NATAL,
  angularSeparation,
  computeNatalTransitOverlay,
  computeTransitAspects,
  findDailyHistoricalMentors,
  longitudeToSignDegree,
  normalizePlacements,
  signDegreeToLongitude,
} from '@/lib/astrology/natal-transit-overlay'

describe('Wave 20C — Natal × Live Transit Aspect & Mentor Engine', () => {
  it('computes angular separation across 0° Aries boundary and circular wrap', () => {
    expect(angularSeparation(10, 350)).toBe(20)
    expect(angularSeparation(350, 10)).toBe(20)
    expect(angularSeparation(0, 180)).toBe(180)
    expect(angularSeparation(90, 270)).toBe(180)
    expect(angularSeparation(45, 165)).toBe(120)
  })

  it('translates between sign + degree and absolute ecliptic longitude reversibly', () => {
    const aries15 = signDegreeToLongitude('Aries', 15)
    expect(aries15).toBe(15)
    expect(longitudeToSignDegree(15)).toEqual({ sign: 'Aries', degree: 15 })

    const scorpio12 = signDegreeToLongitude('Scorpio', 12.5)
    expect(scorpio12).toBe(222.5)
    expect(longitudeToSignDegree(222.5)).toEqual({ sign: 'Scorpio', degree: 12.5 })
  })

  it('detects exact Conjunction, Sextile, Square, Trine, and Opposition within allowed orbs', () => {
    const natal = normalizePlacements({
      Sun: { sign: 'Aries', degree: 10.0 }, // 10°
      Moon: { sign: 'Gemini', degree: 10.0 }, // 70° (Sextile 60°)
      Mars: { sign: 'Cancer', degree: 10.0 }, // 100° (Square 90°)
      Jupiter: { sign: 'Leo', degree: 10.0 }, // 130° (Trine 120°)
      Saturn: { sign: 'Libra', degree: 10.0 }, // 190° (Opposition 180°)
    })

    const transits = normalizePlacements({
      SunTransit: { sign: 'Aries', degree: 10.0 }, // 10° (Conjunction 0°)
    })

    const aspects = computeTransitAspects(natal, transits, 6.0)
    expect(aspects).toHaveLength(5)

    const aspectNames = aspects.map(a => a.aspect)
    expect(aspectNames).toContain('Conjunction')
    expect(aspectNames).toContain('Sextile')
    expect(aspectNames).toContain('Square')
    expect(aspectNames).toContain('Trine')
    expect(aspectNames).toContain('Opposition')

    for (const a of aspects) {
      expect(a.resonanceGain).toBeGreaterThanOrEqual(1.0)
      expect(a.resonanceGain).toBeLessThanOrEqual(1.35)
      expect(a.orb).toBeCloseTo(0, 1)
    }
  })

  it('ranks top 3 Daily Historical Mentors with 25–99 PVR, valid Seals, and deep links', () => {
    const mentors = findDailyHistoricalMentors({
      userNatal: DEFAULT_USER_NATAL,
      liveTransits: normalizePlacements({
        Jupiter: { sign: 'Taurus', degree: 12.0 },
        Saturn: { sign: 'Pisces', degree: 18.0 },
        Sun: { sign: 'Scorpio', degree: 15.0 },
      }),
      userAspects: [],
    })

    expect(mentors).toHaveLength(3)
    expect(mentors[0].rank).toBe(1)
    expect(mentors[1].rank).toBe(2)
    expect(mentors[2].rank).toBe(3)

    for (const mentor of mentors) {
      expect(mentor.pvr).toBeGreaterThanOrEqual(25)
      expect(mentor.pvr).toBeLessThanOrEqual(99)
      expect(mentor.mentorResonanceScore).toBeGreaterThanOrEqual(70)
      expect(mentor.mentorResonanceScore).toBeLessThanOrEqual(99)
      expect(mentor.dominantAspect).toBeDefined()
      expect(mentor.resonanceRationale.length).toBeGreaterThan(10)
      expect(mentor.links.agentProfile).toContain('/agent/')
      expect(mentor.links.synastry).toContain('/synastry/')
      expect(mentor.links.culinary).toContain('/culinary?agent=')
    }
  })

  it('builds complete NatalTransitOverlay payload with MCP wire compatibility', () => {
    const overlay = computeNatalTransitOverlay(DEFAULT_USER_NATAL, {
      Mars: { sign: 'Aries', degree: 15.0 },
      Jupiter: { sign: 'Leo', degree: 15.0 },
    })

    expect(overlay.overallResonanceScore).toBeGreaterThanOrEqual(25)
    expect(overlay.overallResonanceScore).toBeLessThanOrEqual(99)
    expect(overlay.topMentors).toHaveLength(3)
    expect(overlay.aspects.length).toBeGreaterThan(0)
    expect(overlay.surgeState.active).toBe(true)

    const wire = overlay.mcpWirePayload
    expect(wire.tool).toBe('get_transit_natal_overlay')
    expect(wire.baselinePvr).toBeGreaterThanOrEqual(25)
    expect(wire.surgedPvr).toBeGreaterThanOrEqual(wire.baselinePvr)
    expect(wire.resonanceSurge.deltaOvr).toBeGreaterThan(0)
  })
})
