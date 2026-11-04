import { describe, expect, it } from 'vitest'
import {
  WTEN_SANCTUM_CATALOG,
  computeSkyToPlateResonance,
  filterAndSortSanctumDishes,
} from '@/lib/culinary/sanctum-catalog'

describe('Wave 20B — WTEN Culinary Alchemy Sanctum & Live Sky Menu Lab', () => {
  it('populates WTEN_SANCTUM_CATALOG with valid 25–99 PVR, Sky-to-Plate Resonance scores, ESMS ratios summing to 100, and alchm.kitchen bridge links', () => {
    expect(WTEN_SANCTUM_CATALOG.length).toBeGreaterThanOrEqual(6)

    const elementsCovered = new Set<string>()
    for (const dish of WTEN_SANCTUM_CATALOG) {
      expect(dish.vesselPvr).toBeGreaterThanOrEqual(25)
      expect(dish.vesselPvr).toBeLessThanOrEqual(99)
      expect(dish.skyToPlateScore).toBeGreaterThanOrEqual(25)
      expect(dish.skyToPlateScore).toBeLessThanOrEqual(99)

      const esmsSum =
        dish.esmsRatio.spirit +
        dish.esmsRatio.essence +
        dish.esmsRatio.matter +
        dish.esmsRatio.substance
      expect(esmsSum).toBe(100)

      expect(dish.alchmKitchenUrl).toContain('https://alchm.kitchen/recipes/')
      expect(dish.alchmKitchenUrl).toContain(`agent=${encodeURIComponent(dish.agentId)}`)
      expect(dish.substitutions.length).toBeGreaterThanOrEqual(1)
      elementsCovered.add(dish.dominantEsms)
    }

    expect(elementsCovered).toEqual(new Set(['spirit', 'essence', 'matter', 'substance']))
  })

  it('classifies Inferno, Tempest, and Equilibrium surge modes deterministically', () => {
    const inferno = computeSkyToPlateResonance({
      vesselPvr: 90,
      dishElement: 'Fire',
      esmsRatio: { spirit: 42, essence: 22, matter: 18, substance: 18 },
      rulingPlanet: 'Mars',
    })
    expect(inferno.surgeMode).toBe('Inferno')
    expect(inferno.skyToPlateScore).toBeGreaterThanOrEqual(85)

    const tempest = computeSkyToPlateResonance({
      vesselPvr: 88,
      dishElement: 'Water',
      esmsRatio: { spirit: 20, essence: 40, matter: 20, substance: 20 },
      rulingPlanet: 'Moon',
    })
    expect(tempest.surgeMode).toBe('Tempest')

    const equilibrium = computeSkyToPlateResonance({
      vesselPvr: 86,
      dishElement: 'Earth',
      esmsRatio: { spirit: 20, essence: 20, matter: 40, substance: 20 },
      rulingPlanet: 'Saturn',
    })
    expect(equilibrium.surgeMode).toBe('Equilibrium')
  })

  it('filters by dominant ESMS, Surge mode, agent ID, and sorts by Sky-to-Plate Resonance and PVR', () => {
    const spiritOnly = filterAndSortSanctumDishes({ esmsFilter: 'spirit' })
    expect(spiritOnly.length).toBeGreaterThan(0)
    expect(spiritOnly.every(d => d.dominantEsms === 'spirit')).toBe(true)

    const keplerOnly = filterAndSortSanctumDishes({ agentFilter: 'johannes-kepler' })
    expect(keplerOnly).toHaveLength(1)
    expect(keplerOnly[0].agentId).toBe('johannes-kepler')

    const byPvr = filterAndSortSanctumDishes({ sortBy: 'vessel-pvr' })
    for (let i = 1; i < byPvr.length; i++) {
      expect(byPvr[i - 1].vesselPvr).toBeGreaterThanOrEqual(byPvr[i].vesselPvr)
    }
  })
})
