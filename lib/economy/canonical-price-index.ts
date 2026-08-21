import { z } from 'zod'
import { ESMS_TOKEN_NAMES, type CanonicalPriceIndexPayload } from './price-index-contract'

const finiteNumber = z.number().finite()
const nullableRail = finiteNumber.nonnegative().nullable()

const tokenQuoteSchema = z.object({
  token: z.enum(ESMS_TOKEN_NAMES),
  index: finiteNumber.positive(),
  change24hPct: finiteNumber,
  weight: finiteNumber.min(0).max(1),
  sparkline: z.array(finiteNumber.positive()).min(2),
})

const canonicalPriceIndexSchema = z
  .object({
    success: z.literal(true),
    live: z.literal(true),
    generatedAt: z.string().datetime(),
    bucketStartUtc: z.string().datetime(),
    aNumber: finiteNumber.positive(),
    multiplier: finiteNumber.positive(),
    dominantElement: z.string().min(1),
    sunSign: z.string().min(1),
    isDiurnal: z.boolean(),
    tokens: z.array(tokenQuoteSchema).length(4),
    compositeIndex: finiteNumber.positive(),
    composite24hPct: finiteNumber,
    degraded: z.array(z.string()).nullable(),
    basis: z
      .object({
        model: z.string().min(1),
        engine: z.string().min(1),
        constants: z.string().min(1),
      })
      .passthrough(),
    railsUsd: z.object({
      mintPerTokenUsd: nullableRail,
      mintSource: z.string().nullable(),
      redeemPerTokenUsd: nullableRail,
      redeemSource: z.string().nullable(),
    }),
    supply: z.object({
      live: z.boolean(),
      spirit: finiteNumber.nonnegative(),
      essence: finiteNumber.nonnegative(),
      matter: finiteNumber.nonnegative(),
      substance: finiteNumber.nonnegative(),
    }),
  })
  .passthrough()
  .superRefine((payload, context) => {
    const names = payload.tokens.map(quote => quote.token)
    for (const token of ESMS_TOKEN_NAMES) {
      if (names.filter(name => name === token).length !== 1) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tokens'],
          message: `Expected exactly one ${token} quote`,
        })
      }
    }
  })

export const CANONICAL_PRICE_INDEX_URL =
  process.env.ALCHM_KITCHEN_PRICE_INDEX_URL ?? 'https://alchm.kitchen/api/economy/price-index'

export class CanonicalPriceIndexError extends Error {
  constructor(
    message: string,
    readonly status: 502 | 503
  ) {
    super(message)
    this.name = 'CanonicalPriceIndexError'
  }
}

/**
 * HTTP adapter for the owned Kitchen oracle. The parsed snapshot is the module
 * interface: callers never learn or reproduce the astronomical implementation.
 */
export async function loadCanonicalPriceIndex(
  transport: typeof fetch = fetch
): Promise<CanonicalPriceIndexPayload> {
  let response: Response
  try {
    response = await transport(CANONICAL_PRICE_INDEX_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8_000),
    })
  } catch (error) {
    throw new CanonicalPriceIndexError(
      `Canonical ESMS oracle request failed: ${error instanceof Error ? error.message : String(error)}`,
      503
    )
  }

  if (!response.ok) {
    throw new CanonicalPriceIndexError(
      `Canonical ESMS oracle returned HTTP ${response.status}`,
      503
    )
  }

  let input: unknown
  try {
    input = await response.json()
  } catch {
    throw new CanonicalPriceIndexError('Canonical ESMS oracle returned invalid JSON', 502)
  }

  const parsed = canonicalPriceIndexSchema.safeParse(input)
  if (!parsed.success) {
    throw new CanonicalPriceIndexError(
      `Canonical ESMS oracle contract mismatch: ${parsed.error.issues[0]?.message ?? 'invalid payload'}`,
      502
    )
  }

  return parsed.data as CanonicalPriceIndexPayload
}
