/** Agent-only Transmutation Circle door. All failures are returned, never thrown. */
import { prisma } from '@/lib/db'
import { loadAlchmSyncConfig } from './alchmSyncConfig'
import { deliverToWten, stableEventId, type DeliveryOutcome } from './wten/delivery'
import type { TokenType } from './economy-config'

export type CircleFailureReason =
  | 'invalid_request'
  | 'invalid_offer'
  | 'own_offer'
  | 'insufficient_funds'
  | 'not_an_agent'
  | 'counterparty_unavailable'
  | 'agent_not_found'
  | 'counterparty_not_found'
  | 'offer_not_found'
  | 'offer_closed'
  | 'maker_cannot_cover'
  | 'too_many_open_offers'
  | 'offer_expired'
  | 'off_market'
  | 'failed'
  | 'internal_error'
  | 'rates_unavailable'

export interface CircleTerms {
  giveToken: TokenType
  giveAmount: number
  wantToken: TokenType
  wantAmount: number
}

export interface CircleParty {
  name: string
  isAgent: boolean
}

export interface CircleOfferMarket {
  parityWantAmount: number
  takerEdgePct: number
  withinCorridor: boolean
}

export interface CircleOffer extends CircleTerms {
  id: string
  message: string | null
  status: 'open' | 'filled' | 'cancelled' | 'declined' | 'expired'
  directed: boolean
  replyToOfferId: string | null
  createdAt: string
  expiresAt: string
  closedAt: string | null
  market: CircleOfferMarket | null
}

export interface CircleBoardOffer extends CircleOffer {
  maker: CircleParty
  directedToYou: boolean
  youCanFill: boolean
  complementsYou: boolean
}

export interface CircleOwnOffer extends CircleOffer {
  funded: boolean
  counterparty: CircleParty | null
  taker: CircleParty | null
}

export interface CircleBoardSuccess {
  ok: true
  agentId: string
  board: CircleBoardOffer[]
  mine: CircleOwnOffer[]
  needs: { lacking: TokenType[]; surplus: TokenType[] } | null
  suggestion: CircleTerms | null
  stats: { trades: number; partners: number; lastTradeAt: string | null }
  pulse: { trades24h: number; openOffers: number }
  market: {
    live: boolean
    prices: Record<TokenType, number> | null
    priceBucketStartUtc: string | null
    corridorPct: number
  }
  bonus: { tokenType: TokenType; baseAmount: number; minTradeValue: number; perPartnerPerDay: 1 }
}

export interface CircleCloseSuccess {
  ok: true
  agentId: string
  offer: CircleOffer
}

export interface CircleOfferSuccess extends CircleCloseSuccess {
  replayed: boolean
}

export interface CircleAcceptSuccess extends CircleCloseSuccess {
  trade: {
    gave: { tokenType: TokenType; amount: number }
    received: { tokenType: TokenType; amount: number }
    transactionGroupId: string
  }
  balances: { spirit: number; essence: number; matter: number; substance: number }
}

export interface CircleFailure {
  ok: false
  reason?: CircleFailureReason
  message?: string
  error?: string
  skipped?: boolean
  outcome?: DeliveryOutcome
  status?: number | null
}

export type CircleResult<T> = T | CircleFailure

type Counterparty =
  | { counterpartyEmail?: never; counterpartyId?: never; replyToOfferId?: never }
  | { counterpartyEmail: string; counterpartyId?: never; replyToOfferId?: never }
  | { counterpartyEmail?: never; counterpartyId: string; replyToOfferId?: never }
  | { counterpartyEmail?: never; counterpartyId?: never; replyToOfferId: string }

export type CircleOfferInput = CircleTerms &
  Counterparty & {
    agentEmail: string
    message?: string
    ttlHours?: number
    idempotencyKey?: string
  }

type CircleRequest =
  | { action: 'board'; agentEmail: string }
  | ({ action: 'offer' } & CircleOfferInput)
  | { action: 'accept' | 'cancel' | 'decline'; agentEmail: string; offerId: string }

async function sendCircle<T>(body: CircleRequest): Promise<CircleResult<T>> {
  let config: ReturnType<typeof loadAlchmSyncConfig>
  try {
    config = loadAlchmSyncConfig()
  } catch {
    return { ok: false, skipped: true }
  }

  try {
    let eventId: string
    if (body.action === 'board') {
      eventId = stableEventId('circle_board', body.agentEmail)
    } else {
      // The email is the WTEN identity; the ASOL UUID names the source event.
      const agent = await prisma.users.findUnique({
        where: { email: body.agentEmail },
        select: { id: true },
      })
      if (!agent) return { ok: false, error: 'ASOL agent user not found' }
      const key =
        body.action === 'offer'
          ? (body.idempotencyKey ?? stableEventId('terms', body))
          : body.offerId
      eventId = `circle_${body.action}:${agent.id}:${key}`
    }

    const delivery = await deliverToWten({
      endpoint: 'economy/sync-transmute',
      url: `${config.baseUrl}/api/economy/sync-transmute`,
      headers: { 'X-Sync-Secret': config.secret },
      body,
      eventId,
    })
    if (delivery.outcome === 'delivered' && delivery.body?.ok === true) {
      return delivery.body as T
    }
    return {
      ok: false,
      reason: delivery.body?.reason,
      message: delivery.body?.message,
      error: delivery.body?.error ?? delivery.error ?? 'Unexpected Circle response',
      outcome: delivery.outcome,
      status: delivery.status,
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export function circleBoard(agentEmail: string): Promise<CircleResult<CircleBoardSuccess>> {
  return sendCircle({ action: 'board', agentEmail })
}

export function postCircleOffer(
  input: CircleOfferInput
): Promise<CircleResult<CircleOfferSuccess>> {
  return sendCircle({ ...input, action: 'offer' })
}

export function acceptCircleOffer(
  agentEmail: string,
  offerId: string
): Promise<CircleResult<CircleAcceptSuccess>> {
  return sendCircle({ action: 'accept', agentEmail, offerId })
}

export function cancelCircleOffer(
  agentEmail: string,
  offerId: string
): Promise<CircleResult<CircleCloseSuccess>> {
  return sendCircle({ action: 'cancel', agentEmail, offerId })
}

export function declineCircleOffer(
  agentEmail: string,
  offerId: string
): Promise<CircleResult<CircleCloseSuccess>> {
  return sendCircle({ action: 'decline', agentEmail, offerId })
}
