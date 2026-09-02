/**
 * Planetary aspects → dynamic ESMS element-pair pools.
 *
 * Each zone hosts a liquidity pool whose pair is set by the current arrangement of the
 * planets: when two planets are in a *favorable* aspect, their current-sign elements form
 * a pair (e.g. Sun in a Fire sign + Mercury in an Earth sign in trine → a Spirit↔Matter
 * pool). A planet transiting a zone boosts the pools it belongs to.
 */

import { ELEMENT_BY_SIGN, ELEMENT_TO_ESMS, ZODIAC_SIGNS, type ZodiacSign } from './elements'
import type { Element, EsmsId, LivePlanet, PlanetName } from './types'
import { calculateAllPlanets } from '@/lib/enhanced-astronomical-calculator'

export type AspectName = 'conjunction' | 'sextile' | 'square' | 'trine' | 'opposition'

interface AspectDef {
  name: AspectName
  angle: number
  orb: number
  favorable: boolean
}

export const ASPECTS: AspectDef[] = [
  { name: 'conjunction', angle: 0, orb: 8, favorable: true },
  { name: 'sextile', angle: 60, orb: 5, favorable: true },
  { name: 'square', angle: 90, orb: 6, favorable: false },
  { name: 'trine', angle: 120, orb: 8, favorable: true },
  { name: 'opposition', angle: 180, orb: 8, favorable: false },
]

export interface PlanetLong {
  planet: PlanetName
  longitude: number // absolute ecliptic longitude 0..360
  element: Element // element of the planet's current sign
  sign: string
}

/**
 * Computes server-side live planetary positions using the trusted Keplerian/VSOP87 ephemeris.
 */
export function livePlanetsFromDate(date: Date | number = new Date()): LivePlanet[] {
  const at = typeof date === 'number' ? new Date(date) : date
  const chart = calculateAllPlanets({
    year: at.getUTCFullYear(),
    month: at.getUTCMonth() + 1,
    day: at.getUTCDate(),
    hour: at.getUTCHours(),
    minute: at.getUTCMinutes(),
    second: at.getUTCSeconds(),
    latitude: 0,
    longitude: 0,
  })

  return Object.entries(chart.planets).map(([name, pos]) => ({
    planet: name as PlanetName,
    sign: pos.sign,
    degree: pos.signDegree,
    retrograde: pos.retrograde,
  }))
}

export function planetLongitudes(input: LivePlanet[] | Date | number = new Date()): PlanetLong[] {
  const planets = Array.isArray(input) ? input : livePlanetsFromDate(input)
  return planets.map(p => {
    const si = ZODIAC_SIGNS.indexOf(p.sign as ZodiacSign)
    const longitude = si >= 0 ? si * 30 + p.degree : 0
    const element = (ELEMENT_BY_SIGN[p.sign as ZodiacSign] ?? 'Fire') as Element
    return { planet: p.planet, longitude, element, sign: p.sign }
  })
}

function angularSeparation(a: number, b: number): number {
  let d = Math.abs(a - b) % 360
  if (d > 180) d = 360 - d
  return d
}

export interface PlanetAspect {
  a: PlanetName
  b: PlanetName
  aspect: AspectName
  favorable: boolean
  orbDelta: number
  elemA: Element
  elemB: Element
}

export function detectAspects(planets: PlanetLong[]): PlanetAspect[] {
  const out: PlanetAspect[] = []
  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const sep = angularSeparation(planets[i].longitude, planets[j].longitude)
      for (const def of ASPECTS) {
        const delta = Math.abs(sep - def.angle)
        if (delta <= def.orb) {
          out.push({
            a: planets[i].planet,
            b: planets[j].planet,
            aspect: def.name,
            favorable: def.favorable,
            orbDelta: delta,
            elemA: planets[i].element,
            elemB: planets[j].element,
          })
          break
        }
      }
    }
  }
  return out
}

export interface ElementPool {
  ids: [EsmsId, EsmsId]
  elements: [Element, Element]
  planets: [PlanetName, PlanetName]
  aspect: AspectName
  /** 0..1 — tighter orb = stronger pool. */
  strength: number
}

const orbFor = (name: AspectName) => ASPECTS.find(a => a.name === name)?.orb ?? 8

/**
 * Favorable aspects between planets in *different* elements open an element-pair pool.
 * A Spirit↔Matter pool needs e.g. Sun (Fire) favorably aspecting Mercury (Earth).
 */
export function aspectPools(input: LivePlanet[] | Date | number = new Date()): ElementPool[] {
  const longs = planetLongitudes(input)
  const aspects = detectAspects(longs).filter(a => a.favorable && a.elemA !== a.elemB)
  return aspects.map(a => ({
    ids: [ELEMENT_TO_ESMS[a.elemA], ELEMENT_TO_ESMS[a.elemB]] as [EsmsId, EsmsId],
    elements: [a.elemA, a.elemB] as [Element, Element],
    planets: [a.a, a.b] as [PlanetName, PlanetName],
    aspect: a.aspect,
    strength: 1 - a.orbDelta / orbFor(a.aspect),
  }))
}
