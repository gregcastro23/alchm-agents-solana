/**
 * Token Economy & Account Entitlement Resolution.
 *
 * In the Planetary Agents token economy:
 *  - Visitors (unauthenticated / no userId) resolve to 'free' (base fast model chain).
 *  - Account Holders (authenticated users with an account) have full access to hold
 *    ESMS token balances, claim daily yield, and access enhanced model tiers ('alchemist').
 *  - Designated Administrators (database-backed roles) receive full
 *    operator access ('master').
 */

import { prisma } from '@/lib/db'
import type { PaTier, ByokProvider } from './tiers'
import { listByokProviders } from '@/lib/byok/store'

const ADMIN_ROLES = new Set(['admin', 'operator', 'alchemist'])
const ACTIVE_SUB_STATUSES = ['active', 'trialing']

export function isPremiumEnforcementEnabled(): boolean {
  return process.env.PREMIUM_ENFORCEMENT_ENABLED === 'true'
}

/**
 * Options for entitlement resolution.
 */
export type EntitlementOpts = { kitchenPremium?: boolean }

export async function getPaTier(userId: string, opts: EntitlementOpts = {}): Promise<PaTier> {
  try {
    const [user, sub] = await Promise.all([
      prisma.users.findUnique({
        where: { id: userId },
        select: { email: true, name: true, role: true, createdAt: true },
      }),
      prisma.userSubscription.findUnique({
        where: { userId },
        select: { tier: true, status: true },
      }),
    ])
    if (!user) return 'free'

    const role = (user.role || '').toLowerCase()
    // 1. Designated Administrator check
    if (ADMIN_ROLES.has(role)) {
      return 'master'
    }

    // 2. Authenticated account holder in the token economy -> full account capabilities
    return 'alchemist'
  } catch (err) {
    console.error('[entitlements] getPaTier failed', err)
    return 'free'
  }
}

export type Entitlements = {
  tier: PaTier
  /** An active PA-side account/subscription status. */
  hasActiveSub: boolean
  /** Account status verified via alchm.kitchen bridge. */
  premiumViaKitchen: boolean
  byokProviders: ByokProvider[]
}

export async function getEntitlements(
  userId: string,
  opts: EntitlementOpts = {}
): Promise<Entitlements> {
  const [tier, byokProviders, sub] = await Promise.all([
    getPaTier(userId, opts),
    listByokProviders(userId),
    prisma.userSubscription.findUnique({ where: { userId }, select: { status: true } }),
  ])
  const hasActiveSub = sub?.status ? ACTIVE_SUB_STATUSES.includes(sub.status.toLowerCase()) : false
  return { tier, hasActiveSub, premiumViaKitchen: !!opts.kitchenPremium, byokProviders }
}
