/**
 * Client-Safe 4D ESMS Wavefunction & Stage 2 Celestial Coupling
 *
 * Pure mathematical bridge unifying the 4D Alchemical Wavefunction
 * \Psi(t) = (\Psi_Spirit, \Psi_Essence, \Psi_Matter, \Psi_Substance) \in [-2, 2]^4
 * with Stage 2 of the Vessel Dignity Rating engine.
 *
 * Zero server, database, or economy imports so this module is 100% safe
 * for client-side bundles and HUD components.
 */

export const ESMS_AXES = ['Spirit', 'Essence', 'Matter', 'Substance'] as const
export type EsmsAxis = (typeof ESMS_AXES)[number]
export type EsmsWavefunction = Record<EsmsAxis, number>
export type EsmsAxisAttribution = Record<EsmsAxis, number>

/**
 * Canonical L1-normalized planetary ESMS signature matrix U \in [0, 1]^{11 x 4}.
 * Each row u_i satisfies \sum_{a \in ESMS} u_{i,a} = 1.
 */
export const PLANETARY_ESMS_SIGNATURES: Record<string, EsmsWavefunction> = {
  Sun: { Spirit: 1.0, Essence: 0.0, Matter: 0.0, Substance: 0.0 },
  Moon: { Spirit: 0.0, Essence: 0.5, Matter: 0.5, Substance: 0.0 },
  Mercury: { Spirit: 0.5, Essence: 0.0, Matter: 0.0, Substance: 0.5 },
  Venus: { Spirit: 0.0, Essence: 0.5, Matter: 0.5, Substance: 0.0 },
  Mars: { Spirit: 0.0, Essence: 0.5, Matter: 0.5, Substance: 0.0 },
  Jupiter: { Spirit: 0.5, Essence: 0.5, Matter: 0.0, Substance: 0.0 },
  Saturn: { Spirit: 0.5, Essence: 0.0, Matter: 0.5, Substance: 0.0 },
  Uranus: { Spirit: 0.0, Essence: 0.5, Matter: 0.5, Substance: 0.0 },
  Neptune: { Spirit: 0.0, Essence: 0.5, Matter: 0.0, Substance: 0.5 },
  Pluto: { Spirit: 0.0, Essence: 0.5, Matter: 0.5, Substance: 0.0 },
  Chiron: { Spirit: 0.25, Essence: 0.25, Matter: 0.25, Substance: 0.25 },
}

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.max(minimum, Math.min(maximum, value))

function finiteNumber(value: unknown): number | null {
  const numeric = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(numeric) ? numeric : null
}

function roundWave(value: number): number {
  return Math.round(value * 10000) / 10000
}

/**
 * Compute the continuous 4D Chart Dignity Wavefunction \Psi_a(t) \in [-2, +2]^4
 * from an alchemical effects snapshot.
 *
 * By normalizing each signed axis against half of the L1 total
 * ((|S| + |E| + |M| + |Su|) / 2), balanced 4-axis distributions normalize near 1.0
 * while single-axis extremes reach at most \pm 2.0 (formally proved in Wavefunction.lean).
 */
export function computeDignityWaveharmonics(currentAlchemy: unknown): Record<string, number> {
  if (!currentAlchemy || typeof currentAlchemy !== 'object') {
    return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }
  }

  const effects = (currentAlchemy as Record<string, unknown>)['Alchemy Effects'] as
    | Record<string, unknown>
    | undefined
  if (!effects) return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }

  const spiritVal = finiteNumber(effects['Total Spirit']) ?? 0
  const essenceVal = finiteNumber(effects['Total Essence']) ?? 0
  const matterVal = finiteNumber(effects['Total Matter']) ?? 0
  const substanceVal = finiteNumber(effects['Total Substance']) ?? 0

  const total =
    Math.abs(spiritVal) + Math.abs(essenceVal) + Math.abs(matterVal) + Math.abs(substanceVal)
  const halfTotal = total / 2
  if (halfTotal <= 0) return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }

  return {
    Spirit: roundWave(spiritVal / halfTotal),
    Essence: roundWave(essenceVal / halfTotal),
    Matter: roundWave(matterVal / halfTotal),
    Substance: roundWave(substanceVal / halfTotal),
  }
}

const PLANETARY_HARMONIC_BASE: Record<string, number> = {
  Sun: 0.7,
  Moon: 0.65,
  Venus: 0.75,
  Jupiter: 0.8,
  Mercury: 0.5,
  Chiron: 0.45,
  Uranus: 0.35,
  Neptune: 0.4,
  Mars: 0.1,
  Saturn: 0.1,
  Pluto: 0.05,
}

const CANONICAL_SKY_HALF_TOTAL = 5.5

/**
 * Derives the live 4D ESMS Wavefunction \Psi(t) \in [-2, 2]^4 directly from
 * sky longitudes and each transiting body's classical essential dignity score in [-3, +3].
 *
 * Uses a fixed canonical capacity denominator (CANONICAL_SKY_HALF_TOTAL = 5.5) so that
 * missing sky measurements never shrink the denominator or artificially amplify remaining bodies.
 */
export function computeSkyEsmsWavefunction(
  skyLongitudes: Partial<Record<string, number>>,
  computeEssentialDignity: (planet: string, longitude: number) => number
): EsmsWavefunction {
  let spirit = 0
  let essence = 0
  let matter = 0
  let substance = 0
  let activeCount = 0

  for (const [planet, longitude] of Object.entries(skyLongitudes)) {
    if (longitude === undefined || !Number.isFinite(longitude)) continue
    const signature = PLANETARY_ESMS_SIGNATURES[planet]
    if (!signature) continue

    activeCount += 1
    const dignity = computeEssentialDignity(planet, longitude)
    const base = PLANETARY_HARMONIC_BASE[planet] ?? 0.4
    const emission = clamp(base + 0.18 * dignity, -1, 1)

    spirit += signature.Spirit * emission
    essence += signature.Essence * emission
    matter += signature.Matter * emission
    substance += signature.Substance * emission
  }

  if (activeCount === 0) {
    return { Spirit: 0, Essence: 0, Matter: 0, Substance: 0 }
  }

  return {
    Spirit: roundWave(clamp(spirit / CANONICAL_SKY_HALF_TOTAL, -2, 2)),
    Essence: roundWave(clamp(essence / CANONICAL_SKY_HALF_TOTAL, -2, 2)),
    Matter: roundWave(clamp(matter / CANONICAL_SKY_HALF_TOTAL, -2, 2)),
    Substance: roundWave(clamp(substance / CANONICAL_SKY_HALF_TOTAL, -2, 2)),
  }
}

/**
 * Channel A: Ambient Alchemical Tide \psi_i(t) \in [-1, 1] for planet i.
 *
 * Since \sum_a u_{i,a} = 1 and \Psi_a(t) \in [-2, 2], the convex inner product
 * (1/2) \sum_a u_{i,a} \Psi_a(t) is strictly bounded in [-1, 1].
 */
export function computeAmbientAlchemicalTide(
  planet: string,
  wavefunction: EsmsWavefunction | Record<string, number>
): number {
  const signature = PLANETARY_ESMS_SIGNATURES[planet]
  if (!signature) return 0

  const raw =
    0.5 *
    (signature.Spirit * (wavefunction.Spirit ?? 0) +
      signature.Essence * (wavefunction.Essence ?? 0) +
      signature.Matter * (wavefunction.Matter ?? 0) +
      signature.Substance * (wavefunction.Substance ?? 0))

  return clamp(raw, -1, 1)
}

/**
 * Channel B: Dyadic Chord Reception Gain G_{i,j}(t) \in [0.65, 1.35].
 *
 * Modulates the aspect response between natal body i and transiting body j
 * according to their shared alchemical tide \bar{\psi}_{i,j}(t) = (\psi_i + \psi_j) / 2.
 * Strictly positive (\ge 0.65), so it amplifies or cushions aspects without ever
 * inverting a benefic Trine into a Square or vice versa.
 */
export function computeDyadicChordGain(
  natalBody: string,
  transitBody: string,
  basePolarity: number,
  wavefunction: EsmsWavefunction | Record<string, number>,
  lambdaChord = 0.35
): number {
  if (basePolarity === 0) return 1.0
  const psiNatal = computeAmbientAlchemicalTide(natalBody, wavefunction)
  const psiTransit = computeAmbientAlchemicalTide(transitBody, wavefunction)
  const sharedTide = 0.5 * (psiNatal + psiTransit)
  const polaritySign = Math.sign(basePolarity)

  return clamp(1.0 + lambdaChord * sharedTide * polaritySign, 0.65, 1.35)
}

/**
 * Projects the Stage 2 planetary response vector r \in [-1, 1]^{11} onto the
 * four ESMS axes in [-1, 1]^4, exposing which alchemical element is driving
 * the Vessel's live Dignity Rating shift.
 */
export function computeEsmsAxisAttribution(
  planetaryResponses: Partial<Record<string, number>>,
  wavefunction?: EsmsWavefunction | Record<string, number>
): EsmsAxisAttribution {
  const numerators: EsmsAxisAttribution = {
    Spirit: 0,
    Essence: 0,
    Matter: 0,
    Substance: 0,
  }
  const denominators: EsmsAxisAttribution = {
    Spirit: 0,
    Essence: 0,
    Matter: 0,
    Substance: 0,
  }

  for (const [planet, signature] of Object.entries(PLANETARY_ESMS_SIGNATURES)) {
    const r = planetaryResponses[planet]
    if (r === undefined || !Number.isFinite(r)) continue
    for (const axis of ESMS_AXES) {
      const weight = signature[axis]
      if (weight > 0) {
        numerators[axis] += weight * r
        denominators[axis] += weight
      }
    }
  }

  const result: EsmsAxisAttribution = {
    Spirit: 0,
    Essence: 0,
    Matter: 0,
    Substance: 0,
  }

  for (const axis of ESMS_AXES) {
    const responseProjection = denominators[axis] > 0 ? numerators[axis] / denominators[axis] : 0
    const ambientAxis = wavefunction ? clamp((wavefunction[axis] ?? 0) / 2, -1, 1) : 0
    result[axis] = roundWave(clamp(0.85 * responseProjection + 0.15 * ambientAxis, -1, 1))
  }

  return result
}
