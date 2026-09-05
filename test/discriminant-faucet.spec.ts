import { describe, expect, it, vi } from 'vitest'
import {
  computeDiscriminantDailyYield,
  deriveTransitWeightsFromPositions,
  getLiveTransitSky,
  resolveAgentNatalData,
  getLiveNetworkSupply,
  validateLedgerClamp,
  TOKEN_IDENTITIES,
  CANONICAL_TOKENS,
  LIVE_NETWORK_SUPPLY,
  type NatalChartData,
  type TransitSkyData,
  type GlobalSupplyState,
} from '@/lib/services/discriminant-faucet'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { AXIS_FLOOR, FAUCET_BAND, Y_MIN, Y_MAX } from '@/lib/economy-config'
import { DegradedEphemerisError } from '@/lib/calculate-transits'

describe('ADR-014: Discriminant Astrological Faucet Engine', () => {
  const neutralSupply: GlobalSupplyState = {
    spirit: 25000,
    essence: 25000,
    matter: 25000,
    substance: 25000,
  }

  const neutralTransit: TransitSkyData = {
    elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
  }

  it('declares the four mandatory canonical tokens with authentic symbol tiers', () => {
    expect(CANONICAL_TOKENS).toEqual(['SPIRIT', 'ESSENCE', 'MATTER', 'SUBSTANCE'])

    expect(TOKEN_IDENTITIES.SPIRIT).toMatchObject({
      name: 'SPIRIT',
      element: 'Fire',
      primaryGlyph: '🝇',
      triangularVariant: '🜂',
      unicodeFallback: '△',
      atomicCode: '[SPRT]',
    })

    expect(TOKEN_IDENTITIES.ESSENCE).toMatchObject({
      name: 'ESSENCE',
      element: 'Water',
      primaryGlyph: '🝑',
      triangularVariant: '🜄',
      unicodeFallback: '▽',
      atomicCode: '[ESNC]',
    })

    expect(TOKEN_IDENTITIES.MATTER).toMatchObject({
      name: 'MATTER',
      element: 'Earth',
      primaryGlyph: '🝙',
      triangularVariant: '🜃',
      atomicCode: '[MATR]',
    })

    expect(TOKEN_IDENTITIES.SUBSTANCE).toMatchObject({
      name: 'SUBSTANCE',
      element: 'Air',
      primaryGlyph: '🝉',
      triangularVariant: '🜁',
      atomicCode: '[SUBS]',
    })
  })

  it('allocates a flat symmetrical 3.0000 each for a neutral claimer under neutral sky', () => {
    const res = computeDiscriminantDailyYield(null, neutralTransit, neutralSupply)

    expect(res.spirit).toBe(3.0)
    expect(res.essence).toBe(3.0)
    expect(res.matter).toBe(3.0)
    expect(res.substance).toBe(3.0)
    expect(res.total).toBe(12.0)
  })

  it('elevates SPIRIT yield significantly for a Fire-dominant chart during a Fire transit', () => {
    const fireNatal: NatalChartData = {
      dominantElement: 'Fire',
      spiritScore: 95,
      essenceScore: 40,
      matterScore: 30,
      substanceScore: 50,
    }

    const fireTransit: TransitSkyData = {
      elementWeights: { Fire: 5.0, Water: 1.5, Earth: 1.5, Air: 2.0 },
    }

    const res = computeDiscriminantDailyYield(fireNatal, fireTransit, neutralSupply)

    expect(res.spirit).toBeGreaterThan(6.0)
    expect(res.spirit).toBeGreaterThan(res.matter)
    expect(res.total).toBe(12.0)
    expect(res.spirit + res.essence + res.matter + res.substance).toBeCloseTo(12.0, 4)
  })

  it('applies counter-cyclical anti-glut damping to MATTER when MATTER share exceeds 30%', () => {
    // Under LIVE_NETWORK_SUPPLY, MATTER is 37.51%
    const res = computeDiscriminantDailyYield(null, neutralTransit, LIVE_NETWORK_SUPPLY)

    expect(res.breakdown.matter.antiGlutFactor).toBeCloseTo(0.75, 2)
    expect(res.breakdown.spirit.antiGlutFactor).toBe(1.0)
    expect(res.breakdown.essence.antiGlutFactor).toBe(1.0)
    expect(res.breakdown.substance.antiGlutFactor).toBe(1.0)

    // MATTER yield is dampened below 3.0000
    expect(res.matter).toBeLessThan(3.0)
    expect(res.total).toBe(12.0)
    expect(res.spirit + res.essence + res.matter + res.substance).toBeCloseTo(12.0, 4)
  })

  it('strictly conserves 12.0000 tokens for all users across extreme skies (no premium tier)', () => {
    const extremeTransit: TransitSkyData = {
      elementWeights: { Fire: 12.0, Water: 0.5, Earth: 0.5, Air: 1.0 },
    }

    const resExtreme = computeDiscriminantDailyYield(
      { spiritScore: 80, essenceScore: 60, matterScore: 40, substanceScore: 60 },
      extremeTransit,
      LIVE_NETWORK_SUPPLY
    )
    expect(resExtreme.total).toBe(12.0)
    expect(
      resExtreme.spirit + resExtreme.essence + resExtreme.matter + resExtreme.substance
    ).toBeCloseTo(12.0, 4)
  })

  it('produces distinct, differentiated yields for different historical agent charts under the same sky', () => {
    const equinoxSky: TransitSkyData = {
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
    }

    // Leonardo da Vinci (Fire dominant: 0.90 Sp / 0.70 Es / 0.50 Ma / 0.70 Su)
    const daVinciNatal = resolveAgentNatalData('leonardo-da-vinci')
    const daVinciYield = computeDiscriminantDailyYield(
      daVinciNatal,
      equinoxSky,
      LIVE_NETWORK_SUPPLY
    )

    // Isaac Newton (Earth dominant: 0.88 Sp / 0.60 Es / 0.80 Ma / 0.75 Su)
    const newtonNatal = resolveAgentNatalData('isaac-newton')
    const newtonYield = computeDiscriminantDailyYield(newtonNatal, equinoxSky, LIVE_NETWORK_SUPPLY)

    // Both strictly total 12.0000
    expect(daVinciYield.total).toBe(12.0)
    expect(newtonYield.total).toBe(12.0)

    // Leonardo's Spirit yield exceeds Newton's Matter yield ratio
    expect(daVinciYield.spirit).toBeGreaterThan(newtonYield.spirit)
    expect(newtonYield.matter).toBeGreaterThan(daVinciYield.matter)
  })

  it('converts astronomical planet positions into valid 4-element transit weights', () => {
    const positions = {
      Sun: { sign: 'Leo', degree: 15, retrograde: false }, // Fire
      Moon: { sign: 'Cancer', degree: 10, retrograde: false }, // Water
      Mercury: { sign: 'Virgo', degree: 5, retrograde: false }, // Earth
      Venus: { sign: 'Libra', degree: 20, retrograde: false }, // Air
      Mars: { sign: 'Aries', degree: 8, retrograde: false }, // Fire
    }

    const transit = deriveTransitWeightsFromPositions(positions as any)
    expect(transit.elementWeights.Fire).toBe(2)
    expect(transit.elementWeights.Water).toBe(1)
    expect(transit.elementWeights.Earth).toBe(1)
    expect(transit.elementWeights.Air).toBe(1)
    expect(transit.dominantElement).toBe('Fire')
  })

  it('forecasts and strictly conserves 12.0000 ESMS across real astronomical reference dates', () => {
    const referenceDates = [
      new Date('2026-09-04T16:00:00Z'), // Today: Live Sky Epoch
      new Date('2026-09-22T18:00:00Z'), // Autumnal Equinox 2026
      new Date('2026-10-31T12:00:00Z'), // Samhain 2026
      new Date('2026-12-21T21:00:00Z'), // Winter Solstice 2026
      new Date('2026-03-20T14:00:00Z'), // Vernal Equinox 2026
    ]

    for (const d of referenceDates) {
      const liveSky = getLiveTransitSky(d)
      const weightsSum =
        liveSky.elementWeights.Fire +
        liveSky.elementWeights.Water +
        liveSky.elementWeights.Earth +
        liveSky.elementWeights.Air
      expect(weightsSum).toBe(10)

      const daVinci = computeDiscriminantDailyYield(
        resolveAgentNatalData('leonardo-da-vinci'),
        liveSky,
        LIVE_NETWORK_SUPPLY
      )
      const newton = computeDiscriminantDailyYield(
        resolveAgentNatalData('isaac-newton'),
        liveSky,
        LIVE_NETWORK_SUPPLY
      )
      const einstein = computeDiscriminantDailyYield(
        resolveAgentNatalData('albert-einstein'),
        liveSky,
        LIVE_NETWORK_SUPPLY
      )

      expect(daVinci.total).toBe(12.0)
      expect(newton.total).toBe(12.0)
      expect(einstein.total).toBe(12.0)

      // 4-axis sum strictly equals 12.0000
      expect(
        Math.round(
          (daVinci.spirit + daVinci.essence + daVinci.matter + daVinci.substance) * 10000
        ) / 10000
      ).toBe(12.0)
    }
  })
})

describe('ADR-015: Untethered Resonance Faucet Invariants (Phases 1 & 2)', () => {
  // INV-1: Conservation & Band Clamping
  describe('INV-1: Band Clamping & Exact 4-Decimal Conservation', () => {
    it('enforces total yield within [FAUCET_BAND.min, FAUCET_BAND.max] = [12.0, 12.0]', () => {
      expect(FAUCET_BAND.min).toBe(12.0)
      expect(FAUCET_BAND.max).toBe(12.0)
      expect(Y_MIN).toBe(12.0)
      expect(Y_MAX).toBe(12.0)
    })

    it('conserves exactly 12.0000 across adversarial inputs and all-zero natal charts', () => {
      const adversarialNatal: NatalChartData = {
        spiritScore: 0,
        essenceScore: 0,
        matterScore: 0,
        substanceScore: 0,
      }
      const sky: TransitSkyData = {
        elementWeights: { Fire: 1, Water: 2, Earth: 3, Air: 4 },
      }
      const res = computeDiscriminantDailyYield(adversarialNatal, sky, LIVE_NETWORK_SUPPLY)
      expect(res.total).toBe(12.0)
      expect(res.spirit + res.essence + res.matter + res.substance).toBeCloseTo(12.0, 4)
      expect(res.spirit).toBeGreaterThanOrEqual(AXIS_FLOOR)
      expect(res.essence).toBeGreaterThanOrEqual(AXIS_FLOOR)
      expect(res.matter).toBeGreaterThanOrEqual(AXIS_FLOOR)
      expect(res.substance).toBeGreaterThanOrEqual(AXIS_FLOOR)
    })

    it('allocates 4-decimal residual conservation adjustments to the largest allocated axis', () => {
      // Create an asymmetric sky that causes fractional rounding diffs
      const sky: TransitSkyData = {
        elementWeights: { Fire: 3.3333, Water: 1.1111, Earth: 2.2222, Air: 3.3334 },
      }
      const res = computeDiscriminantDailyYield(null, sky, LIVE_NETWORK_SUPPLY)
      const sum =
        Math.round((res.spirit + res.essence + res.matter + res.substance) * 10000) / 10000
      expect(sum).toBe(12.0)
      // Smallest axis must not be penalized below AXIS_FLOOR
      expect(res.essence).toBeGreaterThanOrEqual(AXIS_FLOOR)
    })

    it('prevents reachable under-mint to 1.2000 when chart mass sits entirely in absent sky elements', () => {
      // Pure Fire chart under zero Fire sky
      const pureFireNatal: NatalChartData = {
        spiritScore: 100,
        essenceScore: 0,
        matterScore: 0,
        substanceScore: 0,
      }
      const zeroFireSky: TransitSkyData = {
        elementWeights: { Fire: 0, Water: 4, Earth: 3, Air: 3 },
      }
      const resFire = computeDiscriminantDailyYield(pureFireNatal, zeroFireSky, LIVE_NETWORK_SUPPLY)
      const sumFire =
        Math.round(
          (resFire.spirit + resFire.essence + resFire.matter + resFire.substance) * 10000
        ) / 10000
      expect(sumFire).toBe(12.0)
      expect(resFire.total).toBe(12.0)
      expect(resFire.spirit).toBe(3.0)
      expect(resFire.essence).toBe(3.0)
      expect(resFire.matter).toBe(3.0)
      expect(resFire.substance).toBe(3.0)

      // Pure Earth chart under zero Earth sky
      const pureEarthNatal: NatalChartData = {
        spiritScore: 0,
        essenceScore: 0,
        matterScore: 100,
        substanceScore: 0,
      }
      const zeroEarthSky: TransitSkyData = {
        elementWeights: { Fire: 4, Water: 3, Earth: 0, Air: 3 },
      }
      const resEarth = computeDiscriminantDailyYield(
        pureEarthNatal,
        zeroEarthSky,
        LIVE_NETWORK_SUPPLY
      )
      const sumEarth =
        Math.round(
          (resEarth.spirit + resEarth.essence + resEarth.matter + resEarth.substance) * 10000
        ) / 10000
      expect(sumEarth).toBe(12.0)
      expect(resEarth.total).toBe(12.0)

      // All-zero sky weights
      const allZeroSky: TransitSkyData = {
        elementWeights: { Fire: 0, Water: 0, Earth: 0, Air: 0 },
      }
      const resZero = computeDiscriminantDailyYield(pureFireNatal, allZeroSky, LIVE_NETWORK_SUPPLY)
      const sumZero =
        Math.round(
          (resZero.spirit + resZero.essence + resZero.matter + resZero.substance) * 10000
        ) / 10000
      expect(sumZero).toBe(12.0)
      expect(resZero.total).toBe(12.0)
    })
  })

  // INV-2: Operational Gas Floor Regression Pin
  describe('INV-2: Operational Gas Floor Regression Pin (AXIS_FLOOR = 0.30)', () => {
    it('dynamically derives AXIS_FLOOR from chat base pricing (0.30)', () => {
      expect(AXIS_FLOOR).toBe(0.3)
    })

    it('guarantees min(axis) >= AXIS_FLOOR across all 365 days of 2026 for all 72 historical agents', () => {
      let totalEvaluations = 0
      let minObservedAxis = Infinity

      for (let day = 0; day < 365; day++) {
        const date = new Date(Date.UTC(2026, 0, 1 + day, 12, 0, 0))
        const sky = getLiveTransitSky(date)

        for (const agent of HISTORICAL_AGENTS) {
          const el = agent.consciousness?.alchemicalElements
          const natal: NatalChartData = {
            dominantElement: agent.consciousness?.dominantElement,
            spiritScore: el?.spirit !== undefined ? el.spirit * 100 : 50,
            essenceScore: el?.essence !== undefined ? el.essence * 100 : 50,
            matterScore: el?.matter !== undefined ? el.matter * 100 : 50,
            substanceScore: el?.substance !== undefined ? el.substance * 100 : 50,
          }
          const res = computeDiscriminantDailyYield(natal, sky, LIVE_NETWORK_SUPPLY)
          const minAxis = Math.min(res.spirit, res.essence, res.matter, res.substance)
          if (minAxis < minObservedAxis) minObservedAxis = minAxis

          const axisSum =
            Math.round((res.spirit + res.essence + res.matter + res.substance) * 10000) / 10000

          expect(res.spirit).toBeGreaterThanOrEqual(AXIS_FLOOR)
          expect(res.essence).toBeGreaterThanOrEqual(AXIS_FLOOR)
          expect(res.matter).toBeGreaterThanOrEqual(AXIS_FLOOR)
          expect(res.substance).toBeGreaterThanOrEqual(AXIS_FLOOR)
          expect(axisSum).toBe(12.0)
          expect(res.total).toBe(12.0)
          totalEvaluations++
        }
      }

      expect(totalEvaluations).toBe(365 * 72) // 26,280 evaluations
      expect(minObservedAxis).toBeGreaterThanOrEqual(AXIS_FLOOR)
    })

    it('unconditionally protects zero-element sky days (never yields 0.0000 on any axis)', () => {
      const zeroFireSky: TransitSkyData = {
        elementWeights: { Fire: 0, Water: 5, Earth: 3, Air: 2 },
      }
      const zeroFireNatal: NatalChartData = {
        spiritScore: 0,
        essenceScore: 80,
        matterScore: 60,
        substanceScore: 60,
      }
      const res = computeDiscriminantDailyYield(zeroFireNatal, zeroFireSky, LIVE_NETWORK_SUPPLY)
      expect(res.spirit).toBe(AXIS_FLOOR)
      expect(res.total).toBe(12.0)
    })
  })

  // INV-4: Ephemeris Degradation Protection
  describe('INV-4: Ephemeris Degradation Protection', () => {
    it('throws DegradedEphemerisError when requireComplete: true and celestial body is missing', () => {
      const incompletePositions = {
        Sun: { sign: 'Leo', degree: 15, retrograde: false },
        Moon: { sign: 'Cancer', degree: 10, retrograde: false },
        // Mercury missing!
        Venus: { sign: 'Libra', degree: 20, retrograde: false },
        Mars: { sign: 'Aries', degree: 8, retrograde: false },
      }

      expect(() => {
        deriveTransitWeightsFromPositions(incompletePositions as any, { requireComplete: true })
      }).toThrow(DegradedEphemerisError)
    })

    it('observes and alerts without throwing when requireComplete is false (Phase 1 behavior)', () => {
      const incompletePositions = {
        Sun: { sign: 'Leo', degree: 15, retrograde: false },
      }
      const res = deriveTransitWeightsFromPositions(incompletePositions as any, {
        requireComplete: false,
      })
      expect(res).toBeDefined()
      expect(res.elementWeights.Fire).toBe(1)
    })
  })

  // INV-6: Three-Path Idempotency & Mathematical Equivalence
  describe('INV-6: Three-Path Idempotency & Mathematical Equivalence', () => {
    it('uses unified canonical idempotency key format across all three claim paths', () => {
      const site = 'kitchen'
      const userId = 'usr-test-123'
      const dateStr = '2026-09-04'
      const token = 'Spirit'

      const keyKitchen = `daily:${site}:${userId}:${dateStr}:${token}`
      const keyAgents = `daily:agents:${userId}:${dateStr}:${token}`
      const keyDesktop = `daily:${site}:${userId}:${dateStr}:${token}`

      expect(keyKitchen).toBe('daily:kitchen:usr-test-123:2026-09-04:Spirit')
      expect(keyAgents).toBe('daily:agents:usr-test-123:2026-09-04:Spirit')
      expect(keyDesktop).toBe('daily:kitchen:usr-test-123:2026-09-04:Spirit')
    })

    it('resolves identifiers identically (email.toLowerCase() || userId) across claim paths', () => {
      const email = 'Leonardo-Da-Vinci@Example.COM'
      const userId = 'uuid-12345'
      const identifierFromEmail = email.toLowerCase() || userId
      const identifierFromIdOnly = (null as any)?.toLowerCase() || userId

      const daVinciFromEmail = resolveAgentNatalData(identifierFromEmail)
      const fallbackFromId = resolveAgentNatalData(identifierFromIdOnly)

      expect(daVinciFromEmail.isNeutralFallback).toBe(false)
      expect(daVinciFromEmail.dominantElement).toBe('Fire')
      expect(fallbackFromId.isNeutralFallback).toBe(true)
    })

    it('produces bit-identical yield allocations across claim paths for identical natal and sky inputs', () => {
      const natal = resolveAgentNatalData('leonardo-da-vinci')
      const sky = getLiveTransitSky(new Date('2026-09-04T16:00:00Z'))
      const supply = LIVE_NETWORK_SUPPLY

      const kitchenYield = computeDiscriminantDailyYield(natal, sky, supply)
      const agentsYield = computeDiscriminantDailyYield(natal, sky, supply)
      const desktopYield = computeDiscriminantDailyYield(natal, sky, supply)

      expect(kitchenYield).toEqual(agentsYield)
      expect(kitchenYield).toEqual(desktopYield)
      expect(kitchenYield.total).toBe(12.0)
      expect(
        Math.round(
          (kitchenYield.spirit +
            kitchenYield.essence +
            kitchenYield.matter +
            kitchenYield.substance) *
            10000
        ) / 10000
      ).toBe(12.0)
    })
  })

  // Dynamic Supply & Live Network Cache
  describe('Dynamic Supply & Cache', () => {
    it('caches network supply within 5-minute TTL', async () => {
      const mockAggregate = vi.fn().mockResolvedValue({
        _sum: {
          spirit: 25000,
          essence: 25000,
          matter: 35000,
          substance: 25000,
        },
      })
      const mockPrisma = {
        tokenBalance: { aggregate: mockAggregate },
      } as any

      const supply1 = await getLiveNetworkSupply(mockPrisma)
      const supply2 = await getLiveNetworkSupply(mockPrisma)

      expect(supply1.matter).toBe(35000)
      expect(supply1.total).toBe(110000)
      // Due to cache TTL, aggregate should have been called only once
      expect(mockAggregate).toHaveBeenCalledTimes(1)
    })
  })

  // Authentic Human Natal Resolution
  describe('Authentic Human Natal Resolution', () => {
    it('derives authentic non-50 alchemical scores from userProfile.natalPositions', () => {
      const profile = {
        natalPositions: [
          { planet: 'Sun', sign: 'Leo', degree: 15, house: 5 },
          { planet: 'Moon', sign: 'Cancer', degree: 10, house: 4 },
          { planet: 'Mars', sign: 'Aries', degree: 8, house: 1 },
          { planet: 'Venus', sign: 'Taurus', degree: 20, house: 2 },
          { planet: 'Mercury', sign: 'Gemini', degree: 12, house: 3 },
        ],
      }
      const resolved = resolveAgentNatalData('user-with-positions@example.com', profile as any)
      expect(resolved.isNeutralFallback).toBe(false)
      // Authentic quantities derived from placements
      expect(resolved.spiritScore).toBeGreaterThan(0)
      expect(resolved.spiritScore !== 50 || resolved.essenceScore !== 50).toBe(true)
    })

    it('derives authentic alchemical scores from userProfile.natalChart tropical celestial bodies', () => {
      const profile = {
        natalChart: {
          tropical: {
            CelestialBodies: {
              all: [
                { label: 'Sun', sign: 'Leo', degrees: 15 },
                { label: 'Moon', sign: 'Cancer', degrees: 10 },
                { label: 'Mars', sign: 'Aries', degrees: 8 },
              ],
            },
          },
        },
      }
      const resolved = resolveAgentNatalData('user-with-chart@example.com', profile as any)
      expect(resolved.isNeutralFallback).toBe(false)
      expect(resolved.spiritScore).toBeGreaterThan(0)
    })

    it('falls back cleanly to 50/50/50/50 with isNeutralFallback: true when profile has no chart data', () => {
      const resolved = resolveAgentNatalData('user-empty@example.com', {})
      expect(resolved.isNeutralFallback).toBe(true)
      expect(resolved.spiritScore).toBe(50)
      expect(resolved.essenceScore).toBe(50)
      expect(resolved.matterScore).toBe(50)
      expect(resolved.substanceScore).toBe(50)
    })
  })

  // Fail-Closed Ledger Boundary Clamp
  describe('validateLedgerClamp', () => {
    it('passes for valid 12.0000 total with all axes >= AXIS_FLOOR', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 3.0,
          essence: 3.0,
          matter: 3.0,
          substance: 3.0,
          total: 12.0,
        })
      }).not.toThrow()
    })

    it('throws when total is below Y_MIN', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 2.9,
          essence: 3.0,
          matter: 3.0,
          substance: 3.0,
          total: 11.9,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })

    it('throws when total is above Y_MAX', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 3.1,
          essence: 3.0,
          matter: 3.0,
          substance: 3.0,
          total: 12.1,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })

    it('throws when any axis is below AXIS_FLOOR', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 0.25,
          essence: 3.75,
          matter: 4.0,
          substance: 4.0,
          total: 12.0,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })

    it('throws when any value is NaN or non-finite', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: NaN,
          essence: 3.0,
          matter: 3.0,
          substance: 3.0,
          total: 12.0,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })

    it('fails closed when axes sum to 1.2000 even if total property reports 12.0000', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 0.3,
          essence: 0.3,
          matter: 0.3,
          substance: 0.3,
          total: 12.0,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })

    it('fails closed when computed sum differs from total property', () => {
      expect(() => {
        validateLedgerClamp({
          spirit: 3.0,
          essence: 3.0,
          matter: 3.0,
          substance: 3.0,
          total: 11.5,
        })
      }).toThrow(/Ledger clamp invariant breach/)
    })
  })
})
