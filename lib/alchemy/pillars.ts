/**
 * The Fourteen Alchemical Pillars — the isomorphic TypeScript view of
 * alchm-astro-core/spec/pillars.v1.json.
 *
 * The same JSON drives the Rust crate (alchm-astro-core/src/pillars.rs, vendored
 * into Pentacles) and the reference harness (alchm-astro-core/tools/pillar_sim.py),
 * so edit the spec, never a copy. Dependency-free: safe to import from client
 * components and from the server.
 *
 * ESMS arrays are [Spirit, Essence, Matter, Substance]; signs are 0 = Aries ..
 * 11 = Pisces; planets are 0 = Sun .. 9 = Pluto.
 */

import specJson from '@/alchm-astro-core/spec/pillars.v1.json'

export type Esms = [number, number, number, number]
export type ElementName = 'Fire' | 'Earth' | 'Air' | 'Water'
export type ModalityName = 'Cardinal' | 'Fixed' | 'Mutable'
export type Sect = 'diurnal' | 'nocturnal' | 'both'
/** The sky a caster stands under at cast time. */
export type Sky = Exclude<Sect, 'both'>
export type CastMode = 'self' | 'target'
export type PlanetName =
  | 'Sun'
  | 'Moon'
  | 'Mercury'
  | 'Venus'
  | 'Mars'
  | 'Jupiter'
  | 'Saturn'
  | 'Uranus'
  | 'Neptune'
  | 'Pluto'

export type PillarKey =
  | 'Solution'
  | 'Filtration'
  | 'Evaporation'
  | 'Distillation'
  | 'Separation'
  | 'Rectification'
  | 'Calcination'
  | 'Comixion'
  | 'Purification'
  | 'Inhibition'
  | 'Fermentation'
  | 'Fixation'
  | 'Multiplication'
  | 'Protection'

export interface PillarSpec {
  id: number
  key: PillarKey
  name: string
  effects: Esms
  primary: ElementName
  secondary: ElementName | null
  sect: Sect
  castMode: CastMode
  rulers: PlanetName[]
  /** Balance coefficient, tuned with tools/pillar_sim.py balance. */
  k: number
  /** Protection: unlocks only when the Sun or Moon has positive dignity. */
  requiresLuminaryDignity: boolean
}

export interface PillarConstants {
  poolBaseline: number
  castCharge: number
  powerRef: number
  magnitudeMin: number
  magnitudeMax: number
  deltaScale: number
  minPrimaryPlacements: number
  minHand: number
  roomResistanceFloor: number
  epsilon: number
  tieTolerance: number
}

/** The minimum a chart needs for pillar math. */
export interface ChartInput {
  /** Sign (0..11) of each planet, Sun..Pluto. */
  signs: readonly number[]
  ascendantSign: number
  /** A time-unknown chart's Ascendant is a noon placeholder, so it is not counted. */
  timeKnown: boolean
}

export const PILLAR_SPEC_VERSION: string = specJson.version
export const PILLAR_CONSTANTS: Readonly<PillarConstants> = specJson.constants
export const PILLARS: readonly PillarSpec[] = specJson.pillars as unknown as PillarSpec[]
export const PILLAR_KEYS: readonly PillarKey[] = PILLARS.map(p => p.key)

const SIGN_ORDER: readonly string[] = specJson.conventions.signOrder
const ELEMENTS: readonly ElementName[] = ['Fire', 'Earth', 'Air', 'Water']
const MODALITIES: readonly ModalityName[] = ['Cardinal', 'Fixed', 'Mutable']

/** Each planet's base ESMS contribution, indexed Sun..Pluto. */
export const PLANET_ALCHEMY: readonly Esms[] = specJson.natal.planets.map(p => p.alchemy as Esms)
export const ASCENDANT_ALCHEMY: Esms = specJson.natal.ascendantAlchemy as Esms
/** Dignity of each planet (Sun..Pluto) in each sign (Aries..Pisces). */
export const PLANET_DIGNITY: readonly (readonly number[])[] = specJson.natal.planets.map(p => {
  const table: Partial<Record<string, number>> = p.dignity
  return SIGN_ORDER.map(sign => table[sign] ?? 0)
})

export function isPillarKey(v: unknown): v is PillarKey {
  return typeof v === 'string' && PILLAR_KEYS.includes(v as PillarKey)
}

export function pillarById(id: number): PillarSpec | undefined {
  return PILLARS.find(p => p.id === id)
}

export function pillarByKey(key: PillarKey): PillarSpec {
  const p = PILLARS.find(x => x.key === key)
  if (!p) throw new Error(`Unknown pillar ${key}`)
  return p
}

export function elementOfSign(sign: number): ElementName {
  return ELEMENTS[sign % 4]
}

export function dignity(planet: number, sign: number): number {
  return PLANET_DIGNITY[planet][sign % 12]
}

export function countedSigns(chart: ChartInput): number[] {
  return chart.timeKnown ? [...chart.signs, chart.ascendantSign] : [...chart.signs]
}

export function elementCounts(chart: ChartInput): Record<ElementName, number> {
  const counts: Record<ElementName, number> = { Fire: 0, Earth: 0, Air: 0, Water: 0 }
  for (const sign of countedSigns(chart)) counts[ELEMENTS[sign % 4]] += 1
  return counts
}

export function modalityCounts(chart: ChartInput): Record<ModalityName, number> {
  const counts: Record<ModalityName, number> = { Cardinal: 0, Fixed: 0, Mutable: 0 }
  for (const sign of countedSigns(chart)) counts[MODALITIES[sign % 3]] += 1
  return counts
}

/**
 * Pillar ids (ascending) a chart may cast under `sky`: sect matches, at least
 * `minPrimaryPlacements` placements in the primary element, topped up to
 * `minHand` from the caster's strongest elements.
 */
export function hand(chart: ChartInput, sky: Sky): number[] {
  const counts = elementCounts(chart)
  const luminary = dignity(0, chart.signs[0]) > 0 || dignity(1, chart.signs[1]) > 0
  const eligible = (p: PillarSpec) =>
    (p.sect === sky || p.sect === 'both') && (!p.requiresLuminaryDignity || luminary)

  const ids = PILLARS.filter(
    p => eligible(p) && counts[p.primary] >= PILLAR_CONSTANTS.minPrimaryPlacements
  ).map(p => p.id)

  if (ids.length < PILLAR_CONSTANTS.minHand) {
    const rest = PILLARS.filter(p => eligible(p) && !ids.includes(p.id)).sort(
      (a, b) => counts[b.primary] - counts[a.primary] || a.id - b.id
    )
    for (const p of rest) {
      if (ids.length >= PILLAR_CONSTANTS.minHand) break
      ids.push(p.id)
    }
  }
  return ids.sort((a, b) => a - b)
}
