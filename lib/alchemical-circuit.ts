/**
 * Alchemical circuit — cast power, duel resolution, and room sharing for the
 * Fourteen Pillars.
 *
 * Mirrors alchm-astro-core/src/circuit.rs line for line; both are held to
 * alchm-astro-core/spec/fixtures/cast-power.v1.json (test/alchemical-circuit.test.ts),
 * written by tools/pillar_sim.py. Keep arithmetic in the same order as the Rust.
 *
 *   live ESMSₖ = natalₖ × poolₖ / baseline
 *   Q = Matter + Substance (live)       ΔQ = charge removed by spending q
 *   I = R × ΔQ      V = E / Q      P = I × V
 *   m = clamp(|P| / powerRef, 0.25, 2.0)
 *
 * Not to be confused with computePower in ./alchemical-kinetics, which is the
 * time derivative dE/dt served by /api/alchm-kinetics.
 */

import {
  ASCENDANT_ALCHEMY,
  PILLAR_CONSTANTS as C,
  PLANET_ALCHEMY,
  dignity,
  elementCounts,
  modalityCounts,
  pillarById,
  countedSigns,
  type ChartInput,
  type ElementName,
  type Esms,
  type ModalityName,
  type PillarSpec,
} from '@/lib/alchemy/pillars'

const MATTER = 2
const SUBSTANCE = 3

function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x
}

/** Dignity-weighted natal ESMS: each planet adds its alchemy × (1 + 0.1·|dignity|). */
export function natalEsms(chart: ChartInput): Esms {
  const esms: Esms = [0, 0, 0, 0]
  chart.signs.forEach((sign, planet) => {
    const mult = 1.0 + 0.1 * Math.abs(dignity(planet, sign))
    for (let k = 0; k < 4; k++) esms[k] = esms[k] + PLANET_ALCHEMY[planet][k] * mult
  })
  if (chart.timeKnown) {
    for (let k = 0; k < 4; k++) esms[k] = esms[k] + ASCENDANT_ALCHEMY[k] * 1.0
  }
  return esms
}

export interface Thermo {
  heat: number
  entropy: number
  reactivity: number
  /** Greg's Energy: heat − entropy × reactivity. */
  energy: number
}

/** WhatToEatNext's alchemize formulas over ESMS and element counts. */
export function thermo(esms: Esms, counts: Record<ElementName, number>): Thermo {
  const [s, e, m, b] = esms
  const { Fire: fire, Earth: earth, Air: air, Water: water } = counts
  const heatDen = b + e + m + water + air + earth
  const heat = (s * s + fire * fire) / Math.max(heatDen * heatDen, C.epsilon)
  const entDen = e + m + earth + water
  const entropy = (s * s + b * b + fire * fire + air * air) / Math.max(entDen * entDen, C.epsilon)
  const reaDen = m + earth
  const reactivity =
    (s * s + b * b + e * e + fire * fire + air * air + water * water) /
    Math.max(reaDen * reaDen, C.epsilon)
  return { heat, entropy, reactivity, energy: heat - entropy * reactivity }
}

export interface CircuitState extends Thermo {
  elementCounts: Record<ElementName, number>
  modalityCounts: Record<ModalityName, number>
  bodies: number
  natalEsms: Esms
  liveEsms: Esms
  /** Q: live Matter + Substance. */
  charge: number
  /** ΔQ: live charge removed by spending `q` pool units. */
  chargeSpent: number
  current: number
  voltage: number
  power: number
  /** R × |E| — what duel resolution compares before and after. */
  potency: number
  magnitude: number
  /** MATTER + SUBSTANCE pools cover the cast charge. */
  canCast: boolean
}

export function circuitState(chart: ChartInput, pools: Esms, q = C.castCharge): CircuitState {
  const counts = elementCounts(chart)
  const natal = natalEsms(chart)
  const live: Esms = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) live[k] = (natal[k] * pools[k]) / C.poolBaseline
  const t = thermo(live, counts)
  const charge = live[MATTER] + live[SUBSTANCE]
  const drain = pools[MATTER] + pools[SUBSTANCE]
  const qMatter = drain > 0 ? (q * pools[MATTER]) / drain : 0
  const qSubstance = drain > 0 ? (q * pools[SUBSTANCE]) / drain : 0
  const chargeSpent =
    (natal[MATTER] * qMatter) / C.poolBaseline + (natal[SUBSTANCE] * qSubstance) / C.poolBaseline
  const current = t.reactivity * chargeSpent
  const voltage = charge > C.epsilon ? t.energy / charge : 0
  const power = current * voltage
  return {
    elementCounts: counts,
    modalityCounts: modalityCounts(chart),
    bodies: countedSigns(chart).length,
    natalEsms: natal,
    liveEsms: live,
    ...t,
    charge,
    chargeSpent,
    current,
    voltage,
    power,
    potency: t.reactivity * Math.abs(t.energy),
    magnitude: clamp(Math.abs(power) / C.powerRef, C.magnitudeMin, C.magnitudeMax),
    canCast: drain >= q,
  }
}

export function potency(chart: ChartInput, pools: Esms): number {
  return circuitState(chart, pools).potency
}

/** Spend `q` from MATTER and SUBSTANCE in proportion to their balances. */
export function pay(pools: Esms, q: number): Esms {
  const drain = pools[MATTER] + pools[SUBSTANCE]
  const out: Esms = [...pools]
  if (drain > 0) {
    out[MATTER] = pools[MATTER] - (q * pools[MATTER]) / drain
    out[SUBSTANCE] = pools[SUBSTANCE] - (q * pools[SUBSTANCE]) / drain
  }
  return out
}

/** The pool-unit delta a pillar delivers, scaled down so Σ|Δ| never exceeds `q`. */
export function castDelta(p: PillarSpec, magnitude: number, q: number): Esms {
  let raw: Esms = [0, 0, 0, 0]
  for (let k = 0; k < 4; k++) raw[k] = p.effects[k] * p.k * magnitude * C.deltaScale
  const total = Math.abs(raw[0]) + Math.abs(raw[1]) + Math.abs(raw[2]) + Math.abs(raw[3])
  if (total > q) {
    const scale = q / total
    raw = raw.map(v => v * scale) as Esms
  }
  return raw
}

export function applyDelta(pools: Esms, delta: Esms): Esms {
  return pools.map((v, k) => Math.max(0, v + delta[k])) as Esms
}

export type DuelWinner = 'a' | 'b' | 'draw'

export interface DuelOutcome {
  magnitudeA: number
  magnitudeB: number
  deltaA: Esms
  deltaB: Esms
  poolsA: Esms
  poolsB: Esms
  /** Potency after the exchange ÷ potency before. */
  ratioA: number
  ratioB: number
  winner: DuelWinner
}

export interface DuelSide {
  chart: ChartInput
  pools: Esms
  pillarId: number
}

/**
 * Both casters pay `q`, both casts land (self-cast on the caster, target on the
 * opponent), and whoever keeps the larger share of their potency wins.
 */
export function resolveDuel(a: DuelSide, b: DuelSide, q = C.castCharge): DuelOutcome {
  const pa = pillarById(a.pillarId)
  const pb = pillarById(b.pillarId)
  if (!pa || !pb) throw new Error(`Unknown pillar ${!pa ? a.pillarId : b.pillarId}`)
  const sa = circuitState(a.chart, a.pools, q)
  const sb = circuitState(b.chart, b.pools, q)
  if (!(sa.canCast && sb.canCast)) {
    throw new Error('Both casters need MATTER + SUBSTANCE of at least the cast charge')
  }

  let aAfter = pay(a.pools, q)
  let bAfter = pay(b.pools, q)
  const deltaA = castDelta(pa, sa.magnitude, q)
  const deltaB = castDelta(pb, sb.magnitude, q)
  if (pa.castMode === 'self') aAfter = applyDelta(aAfter, deltaA)
  else bAfter = applyDelta(bAfter, deltaA)
  if (pb.castMode === 'self') bAfter = applyDelta(bAfter, deltaB)
  else aAfter = applyDelta(aAfter, deltaB)

  const ratioA = potency(a.chart, aAfter) / Math.max(sa.potency, C.epsilon)
  const ratioB = potency(b.chart, bAfter) / Math.max(sb.potency, C.epsilon)
  const diff = ratioA - ratioB
  const winner: DuelWinner = diff > C.tieTolerance ? 'a' : diff < -C.tieTolerance ? 'b' : 'draw'
  return {
    magnitudeA: sa.magnitude,
    magnitudeB: sb.magnitude,
    deltaA,
    deltaB,
    poolsA: aAfter,
    poolsB: bAfter,
    ratioA,
    ratioB,
    winner,
  }
}

export interface RoomShare {
  /** Fraction of the caster's magnitude this receiver draws (admittance-weighted). */
  share: number
  /** Lands as the ESMS delta. */
  real: number
  /** Cardinal kick: a counter-cast bonus for one reply window. */
  kick: number
  /** Fixed tension: accumulates toward a forced reply. */
  tension: number
}

/** Split one cast of `magnitude` across receivers so the total delivered is conserved. */
export function roomShares(magnitude: number, receivers: readonly ChartInput[]): RoomShare[] {
  const parts = receivers.map(chart => {
    const counts = modalityCounts(chart)
    const n = countedSigns(chart).length
    const cardinal = counts.Cardinal / n
    const fixed = counts.Fixed / n
    const mutable = counts.Mutable / n
    const r = C.roomResistanceFloor + mutable
    const x = cardinal - fixed
    const z = Math.sqrt(r * r + x * x)
    return { cardinal, fixed, r, z, y: 1 / z }
  })
  let totalY = 0
  for (const part of parts) totalY = totalY + part.y
  return parts.map(({ cardinal, fixed, r, z, y }) => {
    const share = y / totalY
    return {
      share,
      real: (magnitude * share * r) / z,
      kick: (magnitude * share * cardinal) / z,
      tension: (magnitude * share * fixed) / z,
    }
  })
}
