/**
 * Server-only rating resolver and lookup helpers for agent rating endpoints.
 *
 * Kept apart from `vessel-payload.ts` because this module accesses `@/lib/db`, `@/lib/auth`,
 * and Prisma. Serves both `/api/agents/rating` and `/api/agents/[slug]/ratings`.
 */
import 'server-only'
import type { NextRequest } from 'next/server'
import { getHistoricalAgent } from '@/lib/agents/historical'
import {
  resolveAgentEsmsBalances,
  type CreatorWalletPolicy,
} from '@/lib/agents/rating/esms-balance-resolver'
import { prismaLedgerLoader } from '@/lib/agents/rating/esms-ledger-store.server'
import { SkyUnavailableError, resolveLiveSky } from '@/lib/agents/rating/live-sky'
import type { EsmsHoldings } from '@/lib/agents/rating/seals-surge'
import {
  buildRatedAgentPayload,
  ratableFromForgedRow,
  ratableFromRoster,
  resolveVesselAlias,
  type RatableVessel,
  type RatedVesselPayload,
} from '@/lib/agents/rating/vessel-payload'
import { bearerMatches } from '@/lib/security/secure-compare'

export const AGENT_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/

const PUSH_TTL_MS = 60_000
const MAX_PUSHED = 5_000
const pushed = new Map<string, { balances: EsmsHoldings; at: number }>()

export function readPushed(agentId: string, now = Date.now()): EsmsHoldings | null {
  const entry = pushed.get(agentId)
  if (!entry) return null
  if (now - entry.at > PUSH_TTL_MS) {
    pushed.delete(agentId)
    return null
  }
  return entry.balances
}

export function rememberPushed(agentId: string, balances: EsmsHoldings, now = Date.now()): void {
  if (pushed.size >= MAX_PUSHED) {
    for (const [key, value] of pushed) if (now - value.at > PUSH_TTL_MS) pushed.delete(key)
    if (pushed.size >= MAX_PUSHED) pushed.clear()
  }
  pushed.set(agentId, { balances, at: now })
}

export function clearPushed(): void {
  pushed.clear()
}

/** Error class and driver code only: a message can carry a connection string or a path. */
export function describeError(error: unknown): string {
  if (!(error instanceof Error)) return typeof error
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? `${error.name} (${code})` : error.name
}

export class AgentLookupUnavailable extends Error {}

/** The ledger id a vessel's wallet and pushed holdings are keyed by (an alias folds into it). */
export function ledgerIdOf(vessel: RatableVessel): string {
  return resolveVesselAlias(vessel.agentId) ?? vessel.agentId
}

/** Does the request carry the server-to-server secret? Fails closed when none is configured. */
export function hasInternalSecret(request: NextRequest): boolean {
  const secret = process.env.INTERNAL_API_SECRET
  return secret ? bearerMatches(request.headers.get('authorization'), secret) : false
}

/**
 * Who may read a forged vessel's creator wallet on a GET: a server holding the secret, or the
 * signed-in creator themselves. Anyone else, and any failure to find out, is denied.
 */
export async function creatorWalletPolicy(request: NextRequest): Promise<CreatorWalletPolicy> {
  if (hasInternalSecret(request)) return 'allow'
  try {
    const { auth } = await import('@/lib/auth')
    const userId = (await auth())?.user?.id
    if (typeof userId === 'string' && userId !== '') return { userId }
  } catch {
    // No session is no entitlement; an auth outage must not open the wallet either.
  }
  return 'deny'
}

export type VesselLookupResult =
  | { found: true; vessel: RatableVessel }
  | { found: false; reason: 'unknown' | 'unratable' }

/** Roster first (with the avatar alias), then a user-forged `historical_agents` row. */
export async function resolveVessel(agentId: string): Promise<VesselLookupResult> {
  const alias = resolveVesselAlias(agentId)
  const rostered = getHistoricalAgent(alias ?? agentId)
  if (rostered) {
    const requested = alias ? agentId : rostered.id
    return { found: true, vessel: ratableFromRoster(rostered, requested) }
  }
  try {
    const { prisma } = await import('@/lib/db')
    const row = await prisma.historical_agents.findUnique({ where: { agentId } })
    if (!row) return { found: false, reason: 'unknown' }
    const vessel = ratableFromForgedRow(row)
    return vessel ? { found: true, vessel } : { found: false, reason: 'unratable' }
  } catch (error) {
    throw new AgentLookupUnavailable(describeError(error))
  }
}

export async function ratedPayload(
  vessel: RatableVessel,
  spacetime: EsmsHoldings | null,
  creatorWallet: CreatorWalletPolicy
): Promise<RatedVesselPayload> {
  const [balances, skyResult] = await Promise.all([
    resolveAgentEsmsBalances(ledgerIdOf(vessel), {
      spacetime,
      strict: false,
      loadLedger: prismaLedgerLoader,
      creatorWallet,
      onDegraded: (stage, detail) =>
        console.error(`[rating] esms ${stage} fell through: ${detail}`),
    }),
    resolveLiveSky().then(
      sky => ({ sky, error: undefined }),
      (error: unknown) => {
        console.error(
          '[rating] live sky unavailable:',
          describeError(error instanceof SkyUnavailableError && error.cause ? error.cause : error)
        )
        return {
          sky: null,
          error: error instanceof SkyUnavailableError ? error.message : 'live sky unavailable',
        }
      }
    ),
  ])
  return buildRatedAgentPayload({
    vessel,
    balances,
    sky: skyResult.sky,
    skyError: skyResult.error,
  })
}
