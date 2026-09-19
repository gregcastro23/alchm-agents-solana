import crypto from 'node:crypto'
import { prisma } from '@/lib/db'
import { loadCanonicalPriceIndex } from '@/lib/economy/canonical-price-index'
import { syncCreditToAlchm } from '@/lib/alchm-credit-sync'
import { syncDebitToAlchm } from '@/lib/alchm-debit-sync'
import { EconomyService } from '@/lib/services/economyService'
import {
  calculatePentacleConversion,
  ESMS_ATOMS_PER_UNIT,
  PENTACLE_ATOMS_PER_UNIT,
  type ConversionDirection,
  type EsmsElement,
} from './rate'
import { resolveUserNatalGate } from './natal-gate'
import {
  escrowPentaclesForConversion,
  settlePentacleConversion,
  refundPentacleConversion,
  creditPentaclesFromConversion,
} from './client'
import type { Transport } from '@/lib/vessel/spacetime-stats'

export const MIN_PENTACLE_CONVERT_ATOMS = 10_000n // 10 ⛤
export const MIN_ESMS_CONVERT_ATOMS = 10_000n // 1.0 ESMS
export const MAX_DAILY_PENTACLE_CONVERT_ATOMS = 500_000n // 500 ⛤
export const MAX_DAILY_ESMS_CONVERT_ATOMS = 500_000n // 50.0 ESMS
export const QUOTE_TTL_MS = 120_000 // 120 seconds

export interface ConversionQuotePayload {
  quoteId: string
  userId: string
  identity: string
  userEmail: string
  direction: ConversionDirection
  element: EsmsElement
  inAmountAtoms: string
  outAmountAtoms: string
  dustAtoms: number
  rate: number
  gateApplied: number
  tokenIndex: number
  compositeIndex: number
  bucketStartUtc: string
  createdAt: number
  expiresAt: number
}

export interface CreateQuoteParams {
  userId: string
  direction: ConversionDirection
  element: EsmsElement
  amountAtoms: bigint
}

// In-memory set of consumed quote IDs to prevent duplicate execution attempts within process
const executedQuoteIds = new Set<string>()

export function getQuoteSigningSecret(): string {
  const secret = process.env.PENTACLE_QUOTE_SECRET
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PENTACLE_QUOTE_SECRET environment variable is required in production')
    }
    return 'test-pentacle-quote-secret-do-not-use-in-prod'
  }
  return secret
}

export function signQuoteToken(payload: ConversionQuotePayload): string {
  const secret = getQuoteSigningSecret()
  const serialized = JSON.stringify(payload)
  const hmac = crypto.createHmac('sha256', secret).update(serialized).digest('hex')
  return Buffer.from(JSON.stringify({ payload, hmac })).toString('base64url')
}

export function verifyQuoteToken(token: string): ConversionQuotePayload {
  let parsed: { payload: ConversionQuotePayload; hmac: string }
  try {
    const raw = Buffer.from(token, 'base64url').toString('utf8')
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid quote token format')
  }

  const { payload, hmac } = parsed
  if (!payload || !hmac || typeof hmac !== 'string') {
    throw new Error('Invalid quote token structure')
  }

  const secret = getQuoteSigningSecret()
  const expectedHmac = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex')

  const hmacBuf = Buffer.from(hmac, 'hex')
  const expectedBuf = Buffer.from(expectedHmac, 'hex')

  if (hmacBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(hmacBuf, expectedBuf)) {
    throw new Error('Quote token signature verification failed')
  }

  return payload
}

/**
 * Creates a signed conversion quote based on live ticker and user natal gate.
 */
export async function createConversionQuote(
  params: CreateQuoteParams,
  customTransport?: Transport
): Promise<
  | { ok: true; quote: ConversionQuotePayload; quoteToken: string }
  | { ok: false; code: string; message: string; status: number }
> {
  const { userId, direction, element, amountAtoms } = params

  // 1. Resolve user and email
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  })
  if (!user || !user.email) {
    return {
      ok: false,
      code: 'user_not_found',
      message: 'User account or email not found',
      status: 404,
    }
  }

  // 2. Resolve verified wallet and identity
  const verifiedWallet = await prisma.verifiedSolanaWallet.findUnique({
    where: { userId },
    select: { solanaPubKey: true },
  })
  const walletAddress = verifiedWallet?.solanaPubKey
  if (!walletAddress) {
    return {
      ok: false,
      code: 'wallet_required',
      message: 'Verified Solana wallet required for pentacle conversion identity',
      status: 422,
    }
  }

  // 3. Minimum amount validation
  if (direction === 'pentacles_to_esms' && amountAtoms < MIN_PENTACLE_CONVERT_ATOMS) {
    return {
      ok: false,
      code: 'amount_below_minimum',
      message: `Minimum conversion is 10 ⛤ (${MIN_PENTACLE_CONVERT_ATOMS} atoms)`,
      status: 400,
    }
  }
  if (direction === 'esms_to_pentacles' && amountAtoms < MIN_ESMS_CONVERT_ATOMS) {
    return {
      ok: false,
      code: 'amount_below_minimum',
      message: `Minimum conversion is 1.0 ESMS (${MIN_ESMS_CONVERT_ATOMS} atoms)`,
      status: 400,
    }
  }

  // 4. Resolve Natal Gate
  const gateRes = await resolveUserNatalGate(userId)
  if (!gateRes.eligible || !gateRes.gates) {
    return {
      ok: false,
      code: gateRes.reason || 'birth_chart_required',
      message: gateRes.message || 'Natal birth chart required for pentacle conversion',
      status: 422,
    }
  }

  const gate = gateRes.gates[element]
  if (typeof gate !== 'number' || Number.isNaN(gate)) {
    return {
      ok: false,
      code: 'invalid_gate',
      message: `No valid natal gate found for element ${element}`,
      status: 500,
    }
  }

  // 5. Load canonical price index
  const priceIndexPayload = await loadCanonicalPriceIndex()
  if (!priceIndexPayload || !priceIndexPayload.compositeIndex) {
    return {
      ok: false,
      code: 'ticker_unavailable',
      message: 'Canonical ESMS price index is currently unavailable',
      status: 503,
    }
  }

  // Freshness check: reject if > 10 minutes stale
  const bucketTime = new Date(priceIndexPayload.bucketStartUtc).getTime()
  if (Date.now() - bucketTime > 600_000) {
    return {
      ok: false,
      code: 'ticker_stale',
      message: 'Canonical ESMS ticker data is stale (> 10m old)',
      status: 503,
    }
  }

  // Degraded check
  if (priceIndexPayload.degraded && priceIndexPayload.degraded.length > 0) {
    return {
      ok: false,
      code: 'ticker_degraded',
      message: `Canonical ESMS ticker is degraded: ${priceIndexPayload.degraded.join(', ')}`,
      status: 503,
    }
  }

  const tokenQuote = priceIndexPayload.tokens.find(t => t.token.toLowerCase() === element)
  if (!tokenQuote || !tokenQuote.index || tokenQuote.index <= 0) {
    return {
      ok: false,
      code: 'token_index_unavailable',
      message: `Price index for element ${element} is unavailable`,
      status: 503,
    }
  }

  // 6. Calculate conversion
  const calc = calculatePentacleConversion({
    direction,
    element,
    amountAtoms,
    tokenIndex: tokenQuote.index,
    compositeIndex: priceIndexPayload.compositeIndex,
    gate,
  })

  const now = Date.now()
  const expiresAt = Math.min(now + QUOTE_TTL_MS, bucketTime + 600_000)
  const quoteId = crypto
    .createHash('sha256')
    .update(
      `${userId}:${direction}:${element}:${amountAtoms.toString()}:${priceIndexPayload.bucketStartUtc}:${now}:${crypto.randomUUID()}`
    )
    .digest('hex')

  const quote: ConversionQuotePayload = {
    quoteId,
    userId,
    identity: walletAddress,
    userEmail: user.email,
    direction,
    element,
    inAmountAtoms: amountAtoms.toString(),
    outAmountAtoms: calc.outAmountAtoms.toString(),
    dustAtoms: calc.dustAtoms,
    rate: calc.rate,
    gateApplied: gate,
    tokenIndex: tokenQuote.index,
    compositeIndex: priceIndexPayload.compositeIndex,
    bucketStartUtc: priceIndexPayload.bucketStartUtc,
    createdAt: now,
    expiresAt,
  }

  const quoteToken = signQuoteToken(quote)
  return { ok: true, quote, quoteToken }
}

/**
 * Executes a verified conversion quote using two-phase settlement.
 * Adheres to P9: Kitchen authoritative write first, then ASOL local mirror with the same key.
 */
export async function executeConversionQuote(
  quoteToken: string,
  callerUserId: string,
  customTransport?: Transport
): Promise<
  | {
      ok: true
      settled: true
      quoteId: string
      outAmountAtoms: string
      direction: ConversionDirection
    }
  | { ok: false; code: string; message: string; status: number }
> {
  // 1. Verify token signature and expiration
  let quote: ConversionQuotePayload
  try {
    quote = verifyQuoteToken(quoteToken)
  } catch (err: any) {
    return { ok: false, code: 'invalid_quote_token', message: err.message, status: 400 }
  }

  if (quote.userId !== callerUserId) {
    return {
      ok: false,
      code: 'unauthorized',
      message: 'Quote does not belong to caller',
      status: 403,
    }
  }

  if (Date.now() > quote.expiresAt) {
    return {
      ok: false,
      code: 'quote_expired',
      message: 'Conversion quote has expired',
      status: 410,
    }
  }

  if (executedQuoteIds.has(quote.quoteId)) {
    return {
      ok: false,
      code: 'quote_already_executed',
      message: 'Quote has already been settled',
      status: 409,
    }
  }

  executedQuoteIds.add(quote.quoteId)
  const idempotencyKey = `pentacle_conv:${quote.quoteId}`
  const element = quote.element

  const elementVector = (elem: EsmsElement, val: bigint): [bigint, bigint, bigint, bigint] => {
    return [
      elem === 'spirit' ? val : 0n,
      elem === 'essence' ? val : 0n,
      elem === 'matter' ? val : 0n,
      elem === 'substance' ? val : 0n,
    ]
  }

  if (quote.direction === 'pentacles_to_esms') {
    // ⛤ -> ESMS
    const pentacleAtoms = BigInt(quote.inAmountAtoms)
    const esmsAtoms = BigInt(quote.outAmountAtoms)
    const esmsUnits = (Number(esmsAtoms) / Number(ESMS_ATOMS_PER_UNIT)).toFixed(4)

    // Step 1: Escrow free pentacles in SpacetimeDB
    const escrowRes = await escrowPentaclesForConversion(
      quote.identity,
      quote.quoteId,
      elementVector(element, pentacleAtoms),
      customTransport
    )
    if (!escrowRes.ok) {
      executedQuoteIds.delete(quote.quoteId)
      return {
        ok: false,
        code: 'escrow_failed',
        message: `Failed to escrow pentacles: ${escrowRes.error || 'insufficient free atoms'}`,
        status: 400,
      }
    }

    // Step 2: Credit Kitchen ledger (authoritative)
    const creditRes = await syncCreditToAlchm({
      userEmail: quote.userEmail,
      amounts: { [element]: esmsUnits },
      source: 'pentacle_conversion',
      idempotencyKey,
    })

    if (!creditRes.ok) {
      // Determine if rejection was definitive vs unconfirmed network error
      const errStr = (creditRes.error || '').toLowerCase()
      const isDefinitiveRejection =
        errStr.includes('400') ||
        errStr.includes('404') ||
        errStr.includes('422') ||
        errStr.includes('user not found') ||
        errStr.includes('invalid')

      if (isDefinitiveRejection) {
        // Safe to refund escrow immediately: Kitchen definitely did not apply credit
        await refundPentacleConversion(quote.quoteId, customTransport).catch(err => {
          console.error(`[PentaclesConversion] Escrow refund failed for ${quote.quoteId}:`, err)
        })
        executedQuoteIds.delete(quote.quoteId)
        return {
          ok: false,
          code: 'kitchen_credit_failed',
          message: `Kitchen rejected credit: ${creditRes.error}`,
          status: 400,
        }
      }

      // If network timeout or 5xx: State is UNCERTAIN.
      // Attempt an immediate idempotent retry to check if Kitchen accepted it
      const retryRes = await syncCreditToAlchm({
        userEmail: quote.userEmail,
        amounts: { [element]: esmsUnits },
        source: 'pentacle_conversion',
        idempotencyKey,
      }).catch(() => null)

      if (retryRes && retryRes.ok) {
        console.info(
          `[PentaclesConversion] Kitchen credit confirmed on idempotent retry for ${quote.quoteId}`
        )
      } else {
        // Unconfirmed: Escrow is RETAINED in SpacetimeDB for automated reconciler
        console.warn(
          `[PentaclesConversion] Kitchen credit unconfirmed for ${quote.quoteId}. Escrow retained for reconciliation.`
        )
        return {
          ok: false,
          code: 'kitchen_sync_pending',
          message:
            'Credit transaction status unconfirmed with Kitchen. Escrow retained for automated reconciliation.',
          status: 504,
        }
      }
    }

    // Step 3: Credit local ASOL mirror (EconomyService) with same key per P9
    try {
      const num = Number(esmsUnits)
      await EconomyService.creditTokens(
        quote.userId,
        {
          spirit: element === 'spirit' ? num : 0,
          essence: element === 'essence' ? num : 0,
          matter: element === 'matter' ? num : 0,
          substance: element === 'substance' ? num : 0,
        },
        'pentacle_conversion',
        `Converted ${quote.inAmountAtoms} pentacle atoms into ${quote.outAmountAtoms} ESMS atoms`,
        idempotencyKey
      )
    } catch (mirrorErr) {
      console.error(
        `[PentaclesConversion] ASOL local mirror credit failed for ${quote.userId}:`,
        mirrorErr
      )
    }

    // Step 4: Settle SpacetimeDB escrow
    await settlePentacleConversion(quote.quoteId, customTransport).catch(settleErr => {
      console.error(
        `[PentaclesConversion] Escrow settlement call failed for ${quote.quoteId}:`,
        settleErr
      )
    })

    return {
      ok: true,
      settled: true,
      quoteId: quote.quoteId,
      outAmountAtoms: quote.outAmountAtoms,
      direction: quote.direction,
    }
  } else {
    // ESMS -> ⛤
    const esmsAtoms = BigInt(quote.inAmountAtoms)
    const pentacleAtoms = BigInt(quote.outAmountAtoms)
    const esmsUnits = (Number(esmsAtoms) / Number(ESMS_ATOMS_PER_UNIT)).toFixed(4)

    // Step 1: Debit Kitchen ledger (authoritative)
    const debitRes = await syncDebitToAlchm({
      userEmail: quote.userEmail,
      amounts: {
        spirit: element === 'spirit' ? esmsUnits : '0',
        essence: element === 'essence' ? esmsUnits : '0',
        matter: element === 'matter' ? esmsUnits : '0',
        substance: element === 'substance' ? esmsUnits : '0',
      },
      operationType: 'pentacle_conversion',
      source: 'vessel_conversion',
      idempotencyKey,
      metadata: {
        agentName: 'Vessel',
        actionType: 'pentacle_conversion',
        activationScore: 1.0,
        triggers: ['vessel_convert'],
      },
    })

    // Multi-instance serverless replay protection:
    // Kitchen returns { ok: true, reason: 'already_applied' } on 409 idempotency hit.
    // If already applied, this quote was previously executed! Do NOT credit SpacetimeDB again!
    if (debitRes.ok && debitRes.reason === 'already_applied') {
      return {
        ok: false,
        code: 'quote_already_executed',
        message: 'Quote has already been executed',
        status: 409,
      }
    }

    if (!debitRes.ok) {
      executedQuoteIds.delete(quote.quoteId)
      if (debitRes.reason === 'insufficient_funds') {
        return {
          ok: false,
          code: 'insufficient_funds',
          message: 'Insufficient ESMS token balance in Kitchen ledger',
          status: 402,
        }
      }
      return {
        ok: false,
        code: 'kitchen_debit_failed',
        message: `Failed to debit ESMS: ${debitRes.error || debitRes.reason}`,
        status: 502,
      }
    }

    // Step 2: Debit local ASOL mirror with same key per P9
    try {
      const num = Number(esmsUnits)
      const tokenKey = (element.charAt(0).toUpperCase() + element.slice(1)) as
        | 'Spirit'
        | 'Essence'
        | 'Matter'
        | 'Substance'
      await EconomyService.debitDynamic(
        quote.userId,
        { [tokenKey]: num },
        {
          idempotencyKey,
        }
      )
    } catch (mirrorErr) {
      console.error(
        `[PentaclesConversion] ASOL local mirror debit failed for ${quote.userId}:`,
        mirrorErr
      )
    }

    // Step 3: Credit free pentacles in SpacetimeDB
    const creditPentaclesRes = await creditPentaclesFromConversion(
      quote.identity,
      quote.quoteId,
      elementVector(element, pentacleAtoms),
      customTransport
    )

    if (!creditPentaclesRes.ok) {
      console.error(
        `[PentaclesConversion] SpacetimeDB credit failed for quote ${quote.quoteId}: ${creditPentaclesRes.error}. Compensating Kitchen and ASOL mirror...`
      )

      // 1. Compensate Kitchen ledger
      try {
        await syncCreditToAlchm({
          userEmail: quote.userEmail,
          amounts: { [element]: esmsUnits },
          source: 'pentacle_conversion_refund',
          idempotencyKey: `pentacle_conv_refund:${quote.quoteId}`,
        })
      } catch (compErr) {
        console.error(
          `[PentaclesConversion] Kitchen refund compensation failed for ${quote.quoteId}:`,
          compErr
        )
      }

      // 2. Compensate ASOL local mirror
      try {
        const num = Number(esmsUnits)
        await EconomyService.creditTokens(
          quote.userId,
          {
            spirit: element === 'spirit' ? num : 0,
            essence: element === 'essence' ? num : 0,
            matter: element === 'matter' ? num : 0,
            substance: element === 'substance' ? num : 0,
          },
          'pentacle_conversion_refund',
          `Compensate failed pentacle credit for quote ${quote.quoteId}`,
          `pentacle_conv_refund:${quote.quoteId}`
        )
      } catch (mirrorCompErr) {
        console.error(
          `[PentaclesConversion] Mirror compensation failed for ${quote.quoteId}:`,
          mirrorCompErr
        )
      }

      executedQuoteIds.delete(quote.quoteId)
      return {
        ok: false,
        code: 'pentacle_credit_failed_compensated',
        message: `Failed to credit pentacles: ${creditPentaclesRes.error}. Your ESMS debit has been compensated back to your account.`,
        status: 502,
      }
    }

    return {
      ok: true,
      settled: true,
      quoteId: quote.quoteId,
      outAmountAtoms: quote.outAmountAtoms,
      direction: quote.direction,
    }
  }
}
