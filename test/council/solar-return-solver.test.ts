import { describe, expect, it } from 'vitest'
import {
  angleDelta,
  normalizeDegrees,
  longitudeToSignParts,
  solveSolarReturnTimestamp,
  identifyShiftedRulers,
  calculateElementalSpectrum,
  calculateESMSAndThermodynamics,
  assembleYearOverYearTelemetry,
  buildPlanetPlacements,
} from '@/lib/agents/council/solar-return-sky'
import { COUNCIL_PLANETS } from '@/lib/agents/council/solar-return-types'

describe('Solar Return Solver and Ephemeris Engine', () => {
  describe('Modular Angle Delta & Vernal Equinox Branch Cut', () => {
    it('normalizes degrees to [0, 360)', () => {
      expect(normalizeDegrees(0)).toBe(0)
      expect(normalizeDegrees(360)).toBe(0)
      expect(normalizeDegrees(-10)).toBe(350)
      expect(normalizeDegrees(725)).toBe(5)
    })

    it('computes angular residuals across standard non-boundary degrees', () => {
      expect(angleDelta(120, 100)).toBeCloseTo(20, 6)
      expect(angleDelta(100, 120)).toBeCloseTo(-20, 6)
    })

    it('guarantees continuity across 0° Aries Vernal Equinox (no 360° jump)', () => {
      // 0.2° Aries vs 359.8° Pisces should be +0.4° difference
      const deltaA = angleDelta(0.2, 359.8)
      expect(deltaA).toBeCloseTo(0.4, 5)

      // 359.8° Pisces vs 0.2° Aries should be -0.4° difference
      const deltaB = angleDelta(359.8, 0.2)
      expect(deltaB).toBeCloseTo(-0.4, 5)

      // Exactly at the boundary: 0.0001° vs 359.9999°
      const boundaryDelta = angleDelta(0.0001, 359.9999)
      expect(boundaryDelta).toBeCloseTo(0.0002, 6)
    })

    it('converts longitude to canonical sign, degree, and minute', () => {
      // 0° Aries
      const aries = longitudeToSignParts(0)
      expect(aries.sign).toBe('Aries')
      expect(aries.degree).toBe(0)
      expect(aries.minute).toBe(0)

      // 214.7° = 7 * 30 + 4.7° -> Scorpio 4° 42'
      const scorpio = longitudeToSignParts(214.7)
      expect(scorpio.sign).toBe('Scorpio')
      expect(scorpio.degree).toBe(4)
      expect(scorpio.minute).toBe(42)

      // 359.9° -> Pisces 29° 54'
      const pisces = longitudeToSignParts(359.9)
      expect(pisces.sign).toBe('Pisces')
      expect(pisces.degree).toBe(29)
      expect(pisces.minute).toBe(54)
    })
  })

  describe('Continuous Modular Secant Root-Finding Solver', () => {
    it('converges in <= 8 iterations with residual < 0.005 arcminutes (~0.000083°)', async () => {
      const referenceDate = new Date('2026-10-27T12:00:00.000Z')
      const targetLongitude = 214.5678 // Scorpio ~4.5678°

      // Simulated solar motion with realistic slight speed variation (~0.9856 deg/day)
      const evaluateSunLongitude = async (d: Date) => {
        const elapsedDays = (d.getTime() - referenceDate.getTime()) / 86_400_000
        return normalizeDegrees(
          targetLongitude + elapsedDays * 0.98562 + Math.sin(elapsedDays * 0.01) * 0.02
        )
      }

      const result = await solveSolarReturnTimestamp({
        targetLongitude,
        referenceDate,
        evaluateSunLongitude,
      })

      expect(result.iterations).toBeLessThanOrEqual(8)
      expect(result.finalDeltaArcminutes).toBeLessThan(0.005)

      // The returned timestamp should be approximately 1 year ago (~365.242 days)
      const diffDays = (referenceDate.getTime() - result.returnTimestamp) / 86_400_000
      expect(diffDays).toBeGreaterThan(364)
      expect(diffDays).toBeLessThan(367)
    })

    it('converges seamlessly when the target longitude is on the Vernal Equinox boundary (0° Aries)', async () => {
      const referenceDate = new Date('2026-03-20T09:00:00.000Z')
      const targetLongitude = 0.0002 // Right at 0° Aries

      const evaluateSunLongitude = async (d: Date) => {
        const elapsedDays = (d.getTime() - referenceDate.getTime()) / 86_400_000
        return normalizeDegrees(targetLongitude + elapsedDays * 0.9856)
      }

      const result = await solveSolarReturnTimestamp({
        targetLongitude,
        referenceDate,
        evaluateSunLongitude,
      })

      expect(result.iterations).toBeLessThanOrEqual(8)
      expect(result.finalDeltaArcminutes).toBeLessThan(0.005)
    })
  })

  describe('Year-Over-Year Dual Sky Snapshot Comparison', () => {
    const rawRefPositions = {
      Sun: { sign: 'Scorpio', degree: 4.5, longitude: 214.5 },
      Moon: { sign: 'Taurus', degree: 12.0, longitude: 42.0 },
      Mercury: { sign: 'Scorpio', degree: 18.0, longitude: 228.0 },
      Venus: { sign: 'Sagittarius', degree: 2.0, longitude: 242.0 },
      Mars: { sign: 'Leo', degree: 28.0, longitude: 148.0 },
      Jupiter: { sign: 'Gemini', degree: 20.0, longitude: 80.0 },
      Saturn: { sign: 'Pisces', degree: 13.0, longitude: 343.0 },
      Uranus: { sign: 'Taurus', degree: 26.0, longitude: 56.0 },
      Neptune: { sign: 'Pisces', degree: 27.0, longitude: 357.0 },
      Pluto: { sign: 'Aquarius', degree: 0.8, longitude: 300.8 },
    }

    const rawReturnPositions = {
      Sun: { sign: 'Scorpio', degree: 4.50001, longitude: 214.50001 },
      Moon: { sign: 'Capricorn', degree: 15.0, longitude: 285.0 }, // Moon shifted!
      Mercury: { sign: 'Libra', degree: 29.0, longitude: 209.0 }, // Mercury shifted!
      Venus: { sign: 'Virgo', degree: 19.0, longitude: 169.0 }, // Venus shifted!
      Mars: { sign: 'Scorpio', degree: 11.0, longitude: 221.0 }, // Mars shifted!
      Jupiter: { sign: 'Taurus', degree: 10.0, longitude: 40.0 }, // Jupiter shifted!
      Saturn: { sign: 'Pisces', degree: 0.5, longitude: 330.5 },
      Uranus: { sign: 'Taurus', degree: 21.0, longitude: 51.0 },
      Neptune: { sign: 'Pisces', degree: 25.0, longitude: 355.0 },
      Pluto: { sign: 'Capricorn', degree: 28.0, longitude: 298.0 },
    }

    it('identifies shifted fast rulers and Jupiter correctly', () => {
      const refPlacements = buildPlanetPlacements(rawRefPositions)
      const returnPlacements = buildPlanetPlacements(rawReturnPositions)

      const shifted = identifyShiftedRulers(returnPlacements, refPlacements)
      expect(shifted).toHaveLength(5)

      const moonShift = shifted.find(s => s.planet === 'Moon')
      expect(moonShift?.shifted).toBe(true)
      expect(moonShift?.fromSign).toBe('Capricorn')
      expect(moonShift?.toSign).toBe('Taurus')

      const jupiterShift = shifted.find(s => s.planet === 'Jupiter')
      expect(jupiterShift?.shifted).toBe(true)
      expect(jupiterShift?.fromSign).toBe('Taurus')
      expect(jupiterShift?.toSign).toBe('Gemini')
    })

    it('computes elemental spectrum and percentages across 10 planets', () => {
      const placements = buildPlanetPlacements(rawRefPositions)
      const spectrum = calculateElementalSpectrum(placements)

      const total = spectrum.fire + spectrum.water + spectrum.earth + spectrum.air
      expect(total).toBe(10)
      expect(
        spectrum.percentages.fire +
          spectrum.percentages.water +
          spectrum.percentages.earth +
          spectrum.percentages.air
      ).toBeCloseTo(1, 6)
    })

    it('computes ESMS balance and canonical thermodynamics', () => {
      const placements = buildPlanetPlacements(rawRefPositions)
      const { esms, thermodynamics } = calculateESMSAndThermodynamics(placements)

      expect(esms.spirit).toBeGreaterThan(0)
      expect(esms.essence).toBeGreaterThan(0)
      expect(esms.matter).toBeGreaterThan(0)
      expect(esms.substance).toBeGreaterThan(0)

      expect(thermodynamics.heat).toBeGreaterThan(0)
      expect(thermodynamics.reactivity).toBeGreaterThan(0)
    })

    it('assembles complete YearOverYearTelemetry with deltas', () => {
      const refPlacements = buildPlanetPlacements(rawRefPositions)
      const returnPlacements = buildPlanetPlacements(rawReturnPositions)

      const telemetry = assembleYearOverYearTelemetry({
        referenceDate: new Date('2026-10-27T12:00:00.000Z'),
        returnDate: new Date('2025-10-27T17:45:00.000Z'),
        referencePlacements: refPlacements,
        returnPlacements,
        deltaArcminutes: 0.0006,
        source: 'swiss-ephemeris',
        quality: 'verified',
      })

      expect(telemetry.solarAlignment.exactMatch).toBe(true)
      expect(telemetry.solarAlignment.sign).toBe('Scorpio')
      expect(telemetry.solarAlignment.degree).toBe(4)
      expect(telemetry.solarAlignment.deltaArcminutes).toBeCloseTo(0.0006, 4)

      expect(telemetry.shiftedRulers.length).toBe(5)
      expect(telemetry.elementalDeltas).toBeDefined()
      expect(telemetry.esmsDeltas).toBeDefined()
      expect(telemetry.thermodynamicDeltas).toBeDefined()
      expect(typeof telemetry.thermodynamicDeltas.heat).toBe('number')
      expect(typeof telemetry.thermodynamicDeltas.reactivity).toBe('number')
    })
  })
})
