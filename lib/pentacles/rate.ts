export type EsmsElement = 'spirit' | 'essence' | 'matter' | 'substance'

export const ESMS_ELEMENTS: readonly EsmsElement[] = [
  'spirit',
  'essence',
  'matter',
  'substance',
] as const

export const PENTACLE_ATOMS_PER_UNIT = 1000n
export const ESMS_ATOMS_PER_UNIT = 10000n
export const G_MIN = 0.85
export const DEFAULT_FEE_BPS = 0

export type ConversionDirection = 'pentacles_to_esms' | 'esms_to_pentacles'

export interface ConversionRateParams {
  direction: ConversionDirection
  element: EsmsElement
  amountAtoms: bigint
  tokenIndex: number
  compositeIndex: number
  gate: number
  feeBps?: number
}

export interface ConversionCalculationResult {
  inAmountAtoms: bigint
  outAmountAtoms: bigint
  rate: number // effective rate: outAmount / inAmount
  dustAtoms: number // fractional atoms truncated by flooring
  gateApplied: number
  compositeIndex: number
  tokenIndex: number
}

/**
 * Calculates conversion output adhering to Invariant R1 (no round-trip profit)
 * and Invariant R2 (strict flooring toward the system).
 *
 * Formula:
 *   V_pentacle = compositeIndex / 10
 *   ⛤ → ESMS: esms_atoms = floor( pentacle_atoms * (compositeIndex / tokenIndex) * gate * (1 - fee) )
 *   ESMS → ⛤: pentacle_atoms = floor( esms_atoms * (tokenIndex / compositeIndex) * gate * (1 - fee) )
 */
export function calculatePentacleConversion(
  params: ConversionRateParams
): ConversionCalculationResult {
  const {
    direction,
    amountAtoms,
    tokenIndex,
    compositeIndex,
    gate,
    feeBps = DEFAULT_FEE_BPS,
  } = params

  if (amountAtoms <= 0n) {
    throw new Error('Conversion amount must be positive')
  }
  if (!Number.isFinite(tokenIndex) || tokenIndex <= 0) {
    throw new Error('tokenIndex must be a positive finite number')
  }
  if (!Number.isFinite(compositeIndex) || compositeIndex <= 0) {
    throw new Error('compositeIndex must be a positive finite number')
  }
  if (!Number.isFinite(gate) || gate < G_MIN || gate > 1.0) {
    throw new Error(`gate must be within [${G_MIN}, 1.0], got ${gate}`)
  }
  if (feeBps < 0 || feeBps > 10000) {
    throw new Error('feeBps must be within [0, 10000]')
  }

  const feeMultiplier = (10000 - feeBps) / 10000
  let rawOutput: number

  if (direction === 'pentacles_to_esms') {
    // ⛤ -> ESMS: out = in * (composite / tokenIndex) * gate * feeMultiplier
    const baseMultiplier = (compositeIndex / tokenIndex) * gate * feeMultiplier
    rawOutput = Number(amountAtoms) * baseMultiplier
  } else {
    // ESMS -> ⛤: out = in * (tokenIndex / compositeIndex) * gate * feeMultiplier
    const baseMultiplier = (tokenIndex / compositeIndex) * gate * feeMultiplier
    rawOutput = Number(amountAtoms) * baseMultiplier
  }

  const outAmountAtoms = BigInt(Math.floor(rawOutput))
  const dustAtoms = rawOutput - Math.floor(rawOutput)
  const rate = Number(outAmountAtoms) / Number(amountAtoms)

  return {
    inAmountAtoms: amountAtoms,
    outAmountAtoms,
    rate,
    dustAtoms,
    gateApplied: gate,
    compositeIndex,
    tokenIndex,
  }
}
