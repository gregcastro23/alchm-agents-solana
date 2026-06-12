/**
 * Classical Alchemical Kinetics Module
 * -----------------------------------
 * This module defines derivative-based kinetics on top of the existing alchemizer outputs
 * without modifying the core engine formulas (Heat, Entropy, Reactivity, Energy).
 *
 * Classical Correspondences (documented basis):
 * - Velocity (Celeritas): Mercury principle; rate of transformation in time.
 * - Momentum (Impetus): Mars + Saturn synthesis; sustained force of change informed by inertia.
 * - Power (Potentia): Solar principle; capacity for work via rate of Energy change.
 * - Inertia (Stabilitas): Earth + Matter + Substance foundation; resistance to rapid change.
 *
 * Elemental Principles:
 * - No opposites, no balancing. Each element is computed independently; like reinforces like.
 * - Planetary timing modulates rate constants only; base totals/metrics are preserved.
 */

// Shared narrow types for elements and metrics to ensure strictness
export type ElementKey = 'Fire' | 'Water' | 'Air' | 'Earth'
export type ElementVector = Record<ElementKey, number>
export type ForceVector = Record<ElementKey, number>
export type MetricKey = 'Heat' | 'Entropy' | 'Reactivity' | 'Energy'
export type MetricVector = Record<MetricKey, number>

// Planetary hour label (classical seven + outer + ascendant allowed for extensibility)
export type PlanetaryHour =
  | 'Sun'
  | 'Moon'
  | 'Mars'
  | 'Mercury'
  | 'Jupiter'
  | 'Venus'
  | 'Saturn'
  | string // allow extended systems while preferring the classical seven

// Utility: clamp and safe divide
function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min
  if (value < min) return min
  if (value > max) return max
  return value
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) return 0
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0
  return numerator / denominator
}

function movingAverage(series: number[], window: number): number[] {
  const w = Math.max(1, Math.floor(window))
  const out: number[] = new Array(series.length).fill(0)
  let run = 0
  for (let i = 0; i < series.length; i++) {
    run += series[i]
    if (i >= w) run -= series[i - w]
    const denom = i < w - 1 ? i + 1 : w
    out[i] = run / denom
  }
  return out
}

// Planetary modifiers: classical timing influences on rates (do not alter base values)
// Values are gentle multipliers to encode "more likely/faster" without overwhelming the base data.
// These are intentionally conservative and can be calibrated further.
export function getPlanetaryVelocityModifier(hour: PlanetaryHour, element: ElementKey): number {
  // Mercury enhances velocity globally (Celeritas); element-specific peaks apply
  const base = 1.0
  const mercuryBoost = hour === 'Mercury' ? 1.1 : 1.0
  const elementPeaks: Record<ElementKey, number> = {
    Fire: hour === 'Sun' || hour === 'Mars' ? 1.2 : 1.0,
    Water: hour === 'Moon' || hour === 'Venus' ? 1.15 : 1.0,
    Air: hour === 'Mercury' ? 1.15 : 1.0,
    Earth: hour === 'Saturn' ? 1.1 : 1.0,
  }
  return base * mercuryBoost * elementPeaks[element]
}

export function getPlanetaryMomentumModifier(hour: PlanetaryHour): number {
  // Mars + Saturn synthesis for sustained impetus
  if (hour === 'Mars' || hour === 'Saturn') return 1.15
  return 1.0
}

export function getPlanetaryInertiaModifier(hour: PlanetaryHour): number {
  // Saturnian stabilization
  return hour === 'Saturn' ? 1.1 : 1.0
}

export function getPlanetaryForceModifier(hour: PlanetaryHour): number {
  // Mars + Saturn synthesis for force modulation: Mars amplifies (+20%), Saturn dampens (-10%)
  if (hour === 'Mars') return 1.2
  if (hour === 'Saturn') return 0.9
  return 1.0
}

export function getSolarAmplification(hour?: PlanetaryHour): number {
  return hour === 'Sun' ? 1.3 : 1.0 // +30% typical during Sun hours
}

export function getThermalDirection(heatDvdt: number): 'heating' | 'cooling' | 'stable' {
  if (heatDvdt > 0.001) return 'heating'
  if (heatDvdt < -0.001) return 'cooling'
  return 'stable'
}

// ---- Core Functions ----

/**
 * Compute finite differences using Mercury principle (swift calculation)
 * - Applies optional moving average smoothing (default 3, the Mercury triad)
 */
export function computeFiniteDifference(
  series: Array<{ t: Date; value: number }>,
  smoothingWindow: number = 3
): Array<{ t: Date; dvdt: number }> {
  if (!series || series.length === 0) return []
  const values = series.map(s => s.value)
  const smoothed = smoothingWindow > 1 ? movingAverage(values, smoothingWindow) : values
  const out: Array<{ t: Date; dvdt: number }> = []
  for (let i = 0; i < series.length; i++) {
    if (i === 0) {
      out.push({ t: series[i].t, dvdt: 0 })
      continue
    }
    const dtMs = series[i].t.getTime() - series[i - 1].t.getTime()
    const dt = dtMs / 3600000 // hours
    const dv = smoothed[i] - smoothed[i - 1]
    out.push({ t: series[i].t, dvdt: safeDivide(dv, dt) })
  }
  return out
}

/**
 * Elemental velocity computation (Celeritas per element)
 * Respects independent elements (no cross interference). Includes timing modifiers.
 * Kinetic intensity magnitude uses Euclidean norm of the per-element velocities.
 */
export function computeElementalVelocity(
  samples: Array<{
    t: Date
    totals: ElementVector
    planetaryHour?: PlanetaryHour
  }>
): Array<{
  t: Date
  v: ElementVector
  magnitude: number
  dominantElement: ElementKey
}> {
  if (!samples || samples.length === 0) return []
  const out: Array<{ t: Date; v: ElementVector; magnitude: number; dominantElement: ElementKey }> =
    []
  for (let i = 0; i < samples.length; i++) {
    const current = samples[i]
    const previous = i > 0 ? samples[i - 1] : undefined
    const dt = previous ? (current.t.getTime() - previous.t.getTime()) / 3600000 : 0 // hours

    const rawV: ElementVector = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    ;(Object.keys(rawV) as ElementKey[]).forEach(el => {
      if (!previous || dt === 0) {
        rawV[el] = 0
      } else {
        const dv = current.totals[el] - previous.totals[el]
        const base = safeDivide(dv, dt)
        const modifier = getPlanetaryVelocityModifier(current.planetaryHour ?? '', el)
        rawV[el] = base * modifier
      }
    })

    const magnitude = Math.sqrt(
      rawV.Fire * rawV.Fire +
        rawV.Water * rawV.Water +
        rawV.Air * rawV.Air +
        rawV.Earth * rawV.Earth
    )
    let dominantElement: ElementKey = 'Fire'
    let maxVal = rawV.Fire
    ;(['Water', 'Air', 'Earth'] as ElementKey[]).forEach(el => {
      if (rawV[el] > maxVal) {
        maxVal = rawV[el]
        dominantElement = el
      }
    })

    out.push({ t: current.t, v: rawV, magnitude, dominantElement })
  }
  return out
}

/**
 * Thermodynamic metric velocities (rate of energetic change)
 * Returns dv/dt per metric and a traditional thermal direction from Heat slope.
 */
export function computeMetricVelocity(
  samples: Array<{ t: Date; Heat: number; Entropy: number; Reactivity: number; Energy: number }>
): Array<{
  t: Date
  dvdt: MetricVector
  thermalDirection: 'heating' | 'cooling' | 'stable'
}> {
  if (!samples || samples.length === 0) return []
  const out: Array<{
    t: Date
    dvdt: MetricVector
    thermalDirection: 'heating' | 'cooling' | 'stable'
  }> = []
  for (let i = 0; i < samples.length; i++) {
    const current = samples[i]
    const previous = i > 0 ? samples[i - 1] : undefined
    const dt = previous ? (current.t.getTime() - previous.t.getTime()) / 3600000 : 0 // hours

    const dvdt: MetricVector = { Heat: 0, Entropy: 0, Reactivity: 0, Energy: 0 }
    ;(Object.keys(dvdt) as MetricKey[]).forEach(k => {
      if (!previous || dt === 0) {
        dvdt[k] = 0
      } else {
        const dv = (current as any)[k] - (previous as any)[k]
        dvdt[k] = safeDivide(dv, dt)
      }
    })

    const thermalDirection = getThermalDirection(dvdt.Heat)
    out.push({ t: current.t, dvdt, thermalDirection })
  }
  return out
}

/**
 * Elemental momentum using alchemical inertia (Stabilitas principle)
 * Inertia: m(t) = max(1, 1 + matter + earth + substance/2)
 * Momentum phase:
 * - building: velocity and inertia both increasing
 * - sustained: high momentum with roughly stable velocity
 * - dissipating: decreasing velocity despite inertia
 */
export function computeElementalMomentum(
  samples: Array<{
    t: Date
    v: ElementVector
    inertia: number // caller provides inertia already computed (optionally adjusted for timing)
    substance?: number
  }>
): Array<{
  t: Date
  p: ElementVector
  magnitude: number
  momentumType: 'building' | 'sustained' | 'dissipating'
}> {
  if (!samples || samples.length === 0) return []
  const out: Array<{
    t: Date
    p: ElementVector
    magnitude: number
    momentumType: 'building' | 'sustained' | 'dissipating'
  }> = []
  for (let i = 0; i < samples.length; i++) {
    const current = samples[i]
    const previous = i > 0 ? samples[i - 1] : undefined

    // Momentum vector p = m * v (per-element v, shared inertia)
    const p: ElementVector = {
      Fire: current.inertia * current.v.Fire,
      Water: current.inertia * current.v.Water,
      Air: current.inertia * current.v.Air,
      Earth: current.inertia * current.v.Earth,
    }

    const magnitude = Math.sqrt(
      p.Fire * p.Fire + p.Water * p.Water + p.Air * p.Air + p.Earth * p.Earth
    )

    // Phase assessment using finite differences on magnitude and inertia
    let momentumType: 'building' | 'sustained' | 'dissipating' = 'sustained'
    if (previous) {
      // Correct momentum magnitude calculation: p = m * v for each element
      const prevP: ElementVector = {
        Fire: previous.inertia * previous.v.Fire,
        Water: previous.inertia * previous.v.Water,
        Air: previous.inertia * previous.v.Air,
        Earth: previous.inertia * previous.v.Earth,
      }
      const prevMagnitude = Math.sqrt(
        prevP.Fire * prevP.Fire +
          prevP.Water * prevP.Water +
          prevP.Air * prevP.Air +
          prevP.Earth * prevP.Earth
      )
      const dMag = magnitude - prevMagnitude
      const dInertia = current.inertia - previous.inertia
      if (dMag > 0.001 && dInertia >= 0) {
        momentumType = 'building'
      } else if (Math.abs(dMag) <= 0.001) {
        momentumType = 'sustained'
      } else {
        momentumType = 'dissipating'
      }
    }

    out.push({ t: current.t, p, magnitude, momentumType })
  }
  return out
}

/**
 * Alchemical Power (Potentia) - Solar principle manifesting
 * Power = dEnergy/dt with optional solar amplification for planetary hour = Sun.
 */
export function computePower(
  samples: Array<{ t: Date; Energy: number; planetaryHour?: PlanetaryHour }>,
  options: { window?: number } = {}
): Array<{ t: Date; power: number; solarAmplification?: number }> {
  if (!samples || samples.length === 0) return []
  const raw: Array<{ t: Date; power: number; solarAmplification?: number }> = []
  for (let i = 0; i < samples.length; i++) {
    const current = samples[i]
    const previous = i > 0 ? samples[i - 1] : undefined
    const dt = previous ? (current.t.getTime() - previous.t.getTime()) / 3600000 : 0 // hours
    const dE = previous ? current.Energy - previous.Energy : 0
    const basePower = safeDivide(dE, dt)
    const solarAmplification = getSolarAmplification(current.planetaryHour)
    const power = basePower * solarAmplification
    raw.push({
      t: current.t,
      power,
      solarAmplification: solarAmplification !== 1 ? solarAmplification : undefined,
    })
  }

  // Optional smoothing using simple moving average over window
  const windowSize = Math.max(1, Math.floor(options.window ?? 1))
  if (windowSize <= 1) return raw

  const smoothed: Array<{ t: Date; power: number; solarAmplification?: number }> = []
  for (let i = 0; i < raw.length; i++) {
    const start = Math.max(0, i - windowSize + 1)
    const slice = raw.slice(start, i + 1)
    const avg = slice.reduce((sum, s) => sum + (isFinite(s.power) ? s.power : 0), 0) / slice.length
    smoothed.push({ t: raw[i].t, power: avg, solarAmplification: raw[i].solarAmplification })
  }
  return smoothed
}

/**
 * Elemental force computation (Vis - Classical force principle)
 * Force = dp/dt = inertia × (dv/dt) - Newton's second law applied per element
 * Respects independent elements (no cross interference). Includes planetary timing modifiers.
 * Force magnitude uses Euclidean norm of per-element forces.
 */
export function computeForce(
  momentumSamples: Array<{
    t: Date
    p: ElementVector
    inertia: number // inertia at this time point
    planetaryHour?: PlanetaryHour
  }>,
  velocitySamples: Array<{
    t: Date
    v: ElementVector
    planetaryHour?: PlanetaryHour
  }>
): Array<{
  t: Date
  f: ForceVector
  magnitude: number
  forceType: 'accelerating' | 'decelerating' | 'balanced'
}> {
  if (
    !momentumSamples ||
    !velocitySamples ||
    momentumSamples.length === 0 ||
    velocitySamples.length === 0
  ) {
    return []
  }

  const out: Array<{
    t: Date
    f: ForceVector
    magnitude: number
    forceType: 'accelerating' | 'decelerating' | 'balanced'
  }> = []

  for (let i = 0; i < momentumSamples.length; i++) {
    const momentumSample = momentumSamples[i]
    const velocitySample = velocitySamples[i]
    const previousMomentum = i > 0 ? momentumSamples[i - 1] : undefined
    const previousVelocity = i > 0 ? velocitySamples[i - 1] : undefined

    const dt =
      previousMomentum && previousVelocity
        ? (momentumSample.t.getTime() - previousMomentum.t.getTime()) / 3600000
        : 0 // hours

    const rawF: ForceVector = { Fire: 0, Water: 0, Air: 0, Earth: 0 }
    ;(Object.keys(rawF) as ElementKey[]).forEach(el => {
      if (!previousMomentum || !previousVelocity || dt === 0) {
        rawF[el] = 0
      } else {
        // Use momentum derivative: f = dp/dt
        const dp = momentumSample.p[el] - previousMomentum.p[el]
        const base = safeDivide(dp, dt)

        // Alternative efficient calculation: f = inertia * dv/dt
        // const dv = velocitySample.v[el] - previousVelocity.v[el]
        // const accel = safeDivide(dv, dt)
        // const base = momentumSample.inertia * accel

        const modifier = getPlanetaryForceModifier(momentumSample.planetaryHour ?? '')
        rawF[el] = base * modifier
      }

      // Handle NaN and infinite values
      if (!Number.isFinite(rawF[el])) {
        rawF[el] = 0
      }
    })

    const magnitude = Math.sqrt(
      rawF.Fire * rawF.Fire +
        rawF.Water * rawF.Water +
        rawF.Air * rawF.Air +
        rawF.Earth * rawF.Earth
    )

    // Determine force type based on magnitude and direction
    let forceType: 'accelerating' | 'decelerating' | 'balanced' = 'balanced'
    if (magnitude > 0.1) {
      // High magnitude indicates accelerating forces
      forceType = 'accelerating'
    } else if (magnitude < -0.1) {
      // Negative high magnitude indicates decelerating forces
      forceType = 'decelerating'
    }
    // Near zero magnitude remains balanced

    out.push({ t: momentumSample.t, f: rawF, magnitude, forceType })
  }

  return out
}

// ---- Inertia Helpers (optional for callers to compute provided inertia) ----

/**
 * Compute classical inertia from matter, earth, and substance at a given time.
 * m(t) = max(1, 1 + matter + earth + substance/2)
 * Optionally applies a planetary hour adjustment (Saturnian stabilization).
 */
export function computeInertia(input: {
  matter: number
  earth: number
  substance: number
  planetaryHour?: PlanetaryHour
}): number {
  const base = Math.max(1, 1 + input.matter + input.earth + input.substance / 2)
  const adjusted = base * getPlanetaryInertiaModifier(input.planetaryHour ?? '')
  return adjusted
}

// ---- Calculus Relationship Validation ----

/**
 * Validates that kinetic quantities follow proper calculus relationships:
 * 1. Velocity = dx/dt (position derivative)
 * 2. Momentum = mass × velocity
 * 3. Power = dE/dt (energy derivative)
 * 4. Acceleration = dv/dt (velocity derivative)
 * 5. Force = dp/dt (momentum derivative) = mass × acceleration
 */
export function validateCalculusRelationships(
  samples: Array<{
    t: Date
    elements: ElementVector
    velocity: ElementVector
    momentum: ElementVector
    inertia: number
    energy: number
    power: number
    force?: ForceVector
  }>
): {
  isValid: boolean
  errors: string[]
  warnings: string[]
} {
  const errors: string[] = []
  const warnings: string[] = []

  if (samples.length < 2) {
    warnings.push('Need at least 2 samples for calculus validation')
    return { isValid: true, errors, warnings }
  }

  for (let i = 1; i < samples.length; i++) {
    const current = samples[i]
    const previous = samples[i - 1]
    const dt = (current.t.getTime() - previous.t.getTime()) / 3600000 // hours

    if (dt <= 0) {
      errors.push(`Invalid time interval at index ${i}: dt = ${dt}`)
      continue
    }

    // Validate velocity = dx/dt for each element
    for (const element of ['Fire', 'Water', 'Air', 'Earth'] as ElementKey[]) {
      const expectedVelocity = (current.elements[element] - previous.elements[element]) / dt
      const actualVelocity = current.velocity[element]

      // Allow for planetary modifiers (up to 30% difference)
      const tolerance = Math.abs(expectedVelocity) * 0.35 + 0.001
      if (Math.abs(actualVelocity - expectedVelocity) > tolerance) {
        warnings.push(
          `${element} velocity mismatch at t=${current.t.toISOString()}: ` +
            `expected ${expectedVelocity.toFixed(4)}, got ${actualVelocity.toFixed(4)}`
        )
      }
    }

    // Validate momentum = mass × velocity for each element
    for (const element of ['Fire', 'Water', 'Air', 'Earth'] as ElementKey[]) {
      const expectedMomentum = current.inertia * current.velocity[element]
      const actualMomentum = current.momentum[element]

      const tolerance = Math.abs(expectedMomentum) * 0.01 + 0.001
      if (Math.abs(actualMomentum - expectedMomentum) > tolerance) {
        errors.push(
          `${element} momentum calculation error at t=${current.t.toISOString()}: ` +
            `expected ${expectedMomentum.toFixed(4)}, got ${actualMomentum.toFixed(4)}`
        )
      }
    }

    // Validate power = dE/dt
    const expectedPower = (current.energy - previous.energy) / dt
    const actualPower = current.power

    // Allow for solar amplification (up to 30% boost)
    const powerTolerance = Math.abs(expectedPower) * 0.35 + 0.001
    if (Math.abs(actualPower - expectedPower) > powerTolerance) {
      warnings.push(
        `Power calculation mismatch at t=${current.t.toISOString()}: ` +
          `expected ${expectedPower.toFixed(4)}, got ${actualPower.toFixed(4)}`
      )
    }

    // Validate force = dp/dt for each element
    if (current.force) {
      for (const element of ['Fire', 'Water', 'Air', 'Earth'] as ElementKey[]) {
        const expectedForce = (current.momentum[element] - previous.momentum[element]) / dt
        const actualForce = current.force[element]

        // Allow for planetary modifiers (up to 30% difference) and numerical precision
        const forceTolerance = Math.abs(expectedForce) * 0.35 + 0.001
        if (Math.abs(actualForce - expectedForce) > forceTolerance) {
          warnings.push(
            `${element} force calculation mismatch at t=${current.t.toISOString()}: ` +
              `expected ${expectedForce.toFixed(4)}, got ${actualForce.toFixed(4)}`
          )
        }
      }
    }

    // Validate no NaN or infinite values
    const allValues = [
      ...Object.values(current.elements),
      ...Object.values(current.velocity),
      ...Object.values(current.momentum),
      current.inertia,
      current.energy,
      current.power,
    ]

    for (const value of allValues) {
      if (!Number.isFinite(value)) {
        errors.push(`Non-finite value detected at t=${current.t.toISOString()}: ${value}`)
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

// ---- Traditional Validation ----

export type KineticValidationExpectedRanges = {
  velocityMax: number
  momentumMax: number
  powerMax: number
  forceMax: number
}

export type KineticValidationResult = {
  isValid: boolean
  warnings: string[]
  traditionalAssessment: string
}

/**
 * Traditional validation helper
 * Performs sanity checks and classical expectations:
 * - Fire velocity peaks in Mars/Sun hours
 * - Water momentum builds in Moon/Venus hours
 * - Power shows solar correlation (+~30% typical)
 * - Earth inertia dampens rapid changes (lower velocity variance with high earth)
 */
export function validateKineticResults(
  kinetics: any,
  expectedRanges: KineticValidationExpectedRanges
): KineticValidationResult {
  const warnings: string[] = []

  // Range checks
  const vMax =
    kinetics.elementalVelocity?.reduce((m: number, s: any) => Math.max(m, s.magnitude || 0), 0) ?? 0
  const pMax =
    kinetics.elementalMomentum?.reduce((m: number, s: any) => Math.max(m, s.magnitude || 0), 0) ?? 0
  const powMax = kinetics.power?.reduce((m: number, s: any) => Math.max(m, s.power || 0), 0) ?? 0
  const fMax =
    kinetics.elementalForce?.reduce((m: number, s: any) => Math.max(m, s.magnitude || 0), 0) ?? 0
  if (vMax > expectedRanges.velocityMax)
    warnings.push(
      `Velocity magnitude exceeds expected max (${vMax.toFixed(3)} > ${expectedRanges.velocityMax}).`
    )
  if (pMax > expectedRanges.momentumMax)
    warnings.push(
      `Momentum magnitude exceeds expected max (${pMax.toFixed(3)} > ${expectedRanges.momentumMax}).`
    )
  if (powMax > expectedRanges.powerMax)
    warnings.push(`Power exceeds expected max (${powMax.toFixed(3)} > ${expectedRanges.powerMax}).`)
  if (fMax > expectedRanges.forceMax)
    warnings.push(
      `Force magnitude exceeds expected max (${fMax.toFixed(3)} > ${expectedRanges.forceMax}).`
    )

  // Timing expectations (heuristic counts over series)
  const countByHour: Record<
    string,
    { fireLead: number; total: number; powerSum: number; powerCount: number }
  > = {}
  ;(kinetics.elementalVelocity ?? []).forEach((s: any) => {
    const hour = s.planetaryHour ?? s.hour ?? 'unknown'
    if (!countByHour[hour])
      countByHour[hour] = { fireLead: 0, total: 0, powerSum: 0, powerCount: 0 }
    // Fire leads when v.Fire is the max among elements
    const v = s.v as ElementVector
    const maxEl = (['Fire', 'Water', 'Air', 'Earth'] as ElementKey[]).reduce((a, b) =>
      v[a] >= v[b] ? a : (b as ElementKey)
    )
    if (maxEl === 'Fire') countByHour[hour].fireLead += 1
    countByHour[hour].total += 1
  })
  ;(kinetics.power ?? []).forEach((s: any) => {
    const hour = s.planetaryHour ?? s.hour ?? 'unknown'
    if (!countByHour[hour])
      countByHour[hour] = { fireLead: 0, total: 0, powerSum: 0, powerCount: 0 }
    if (typeof s.power === 'number') {
      countByHour[hour].powerSum += s.power
      countByHour[hour].powerCount += 1
    }
  })

  // Fire lead share in Sun/Mars hours
  const fireLeadShare = (hour: PlanetaryHour) => {
    const c = countByHour[hour]
    if (!c || c.total === 0) return 0
    return c.fireLead / c.total
  }
  const fireShareSun = fireLeadShare('Sun')
  const fireShareMars = fireLeadShare('Mars')
  if (fireShareSun < 0.2 || fireShareMars < 0.2) {
    warnings.push('Fire velocity does not lead sufficiently during Sun/Mars hours.')
  }

  // Solar correlation: Sun hour average power higher than overall average by ~30%
  const overallPowerAvg = (() => {
    const sum = Object.values(countByHour).reduce((acc, v) => acc + v.powerSum, 0)
    const cnt = Object.values(countByHour).reduce((acc, v) => acc + v.powerCount, 0)
    return cnt > 0 ? sum / cnt : 0
  })()
  const sunPowerAvg = (() => {
    const s = countByHour['Sun']
    return s && s.powerCount > 0 ? s.powerSum / s.powerCount : 0
  })()
  if (overallPowerAvg > 0) {
    const ratio = safeDivide(sunPowerAvg, overallPowerAvg)
    if (ratio < 1.2)
      warnings.push('Power shows weak solar amplification (<20% over baseline during Sun hours).')
  }

  const isValid = warnings.length === 0
  const traditionalAssessment = isValid
    ? 'Kinetics align with classical expectations.'
    : 'Kinetics deviate from some classical expectations.'
  return { isValid, warnings, traditionalAssessment }
}
