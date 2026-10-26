/**
 * The server half of forged-vessel privacy: who is looking at a vessel.
 *
 * Kept apart from `forged-privacy-profile.ts` so that module stays free of the session and the database
 * (and importable from a spec with nothing mocked). Importing this file from a client component
 * fails the build on `server-only`, which is the point.
 *
 * Entitlement is decided here, on the server, from the session cookie and `created_agents`:
 *
 *   - the vessel's CREATOR, found through the `created_agents` ownership ledger that
 *     `/api/create-agent` writes (the vessel's public id lives in `blueprint.agentId`);
 *   - an ADMIN, verified against `users.role` in the database by `requireAdmin`. The session's own
 *     `role` claim is not enough: a bridged alchm.kitchen session copies the kitchen's role, and a
 *     stale JWT keeps whatever it was stamped with, and neither is an admin as far as this app's
 *     own `/api/admin/*` guard is concerned.
 *
 * Anything that goes wrong while finding out (the session read throws, the ledger read throws) is
 * a stranger, with `degraded: true` so the page can say the view was limited because the viewer
 * could not be established, rather than pretending the viewer is simply nobody.
 */
import 'server-only'

import { unstable_rethrow } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { ANONYMOUS_VIEWER, type ForgedViewer } from './forged-privacy-profile'

/**
 * Every `historical_agents.agentId` this user forged, per the `created_agents` ledger. Throws if the
 * ledger cannot be read: a caller that must not mistake "could not read" for "owns nothing" uses
 * this one.
 */
export async function readCreatorAgentIds(userId: string): Promise<Set<string>> {
  const ids = new Set<string>()
  if (!prisma?.created_agents?.findMany) throw new Error('created_agents is unavailable')
  const vessels = await prisma.created_agents.findMany({
    where: { creatorId: userId },
    select: { id: true, blueprint: true, momentChart: true },
  })
  for (const v of vessels) {
    if (v.id) ids.add(v.id)
    const bp = v.blueprint as any
    if (bp && typeof bp === 'object' && typeof bp.agentId === 'string' && bp.agentId) {
      ids.add(bp.agentId)
    }
    const mc = v.momentChart as any
    if (mc && typeof mc === 'object' && typeof mc.agentId === 'string' && mc.agentId) {
      ids.add(mc.agentId)
    }
  }
  return ids
}

/**
 * Same lookup as {@link readCreatorAgentIds}, but a failed read yields an empty set and a warning,
 * which is what the PR #67 route does. Only for callers that treat "owns nothing" and "could not
 * read" alike and say nothing about the difference.
 */
export async function resolveCreatorAgentIds(userId: string): Promise<Set<string>> {
  try {
    return await readCreatorAgentIds(userId)
  } catch (err: any) {
    console.warn('[agents] could not resolve creator vessels:', err?.message)
    return new Set<string>()
  }
}

/**
 * Who is looking, from the request's session. Never throws (Next's own control-flow errors
 * excepted); every failure is a stranger with `degraded: true`.
 */
export async function resolveForgedViewer(): Promise<ForgedViewer> {
  let session: Awaited<ReturnType<typeof auth>>
  try {
    session = await auth()
  } catch (err) {
    unstable_rethrow(err)
    console.warn('[forged-privacy] session read failed; treating the viewer as a stranger:', err)
    return { ...ANONYMOUS_VIEWER, degraded: true }
  }
  const sessionUser = session?.user
  if (!sessionUser?.id) return ANONYMOUS_VIEWER

  let degraded = false
  const [isAdmin, creatorAgentIds] = await Promise.all([
    requireAdmin({
      id: sessionUser.id,
      email: sessionUser.email,
      name: sessionUser.name,
      role: sessionUser.role,
      tier: sessionUser.tier,
    })
      .then(result => result.ok === true)
      .catch(err => {
        unstable_rethrow(err)
        degraded = true
        return false
      }),
    readCreatorAgentIds(sessionUser.id).catch(err => {
      unstable_rethrow(err)
      console.warn('[forged-privacy] could not read the creator ledger:', err?.message)
      degraded = true
      return new Set<string>()
    }),
  ])

  return { isAdmin, userId: sessionUser.id, creatorAgentIds, degraded }
}
