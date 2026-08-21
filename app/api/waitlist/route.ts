/**
 * Waitlist API Route — agents.alchm.kitchen (Planetary Agents)
 * POST /api/waitlist — find-or-create a PA user from an email address alone.
 *
 * Receiving half of the "All Aboard" kiosk at `ondeck.alchm.kitchen/All-Aboard`.
 * The OnDeck server calls this and the sibling endpoint on alchm.kitchen in
 * parallel, so one email typed at a booth lands in both databases.
 *
 * Accepts: { email, name?, source?, event? }
 * Returns: { ok, created, userId }
 *
 * Auth: server-to-server only, via `hasInternalApiSecret` — the same
 * INTERNAL_API_SECRET / ALCHM_KITCHEN_SYNC_SECRET gate the other internal
 * routes use. Fails closed when no secret is configured.
 *
 * Provisioning goes through `provisionPaUser`, the single source of truth that
 * Google sign-in and the alchm.kitchen session bridge both use, so a kiosk
 * signup gets exactly the same satellite rows (user_profiles, profiles,
 * monica_user_settings) as any other new user.
 *
 * Cross-site linking is deliberately NOT done here. `users.alchmKitchenUserId`
 * is backfilled by `provisionPaUser` the first time this person actually signs
 * in through the bridge, so the kiosk can fan out to both sites in parallel
 * rather than serialising two round trips in front of someone at a booth.
 *
 * No welcome email: alchm.kitchen owns that message for the ecosystem, and
 * sending a second one from here would double up on every signup.
 *
 * @file app/api/waitlist/route.ts
 */

import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { hasInternalApiSecret } from '@/lib/security/internal-auth'
import { provisionPaUser } from '@/lib/user-provisioning'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const revalidate = 0

/** Same shape rule the kiosk applies client-side, re-checked at the boundary. */
const EMAIL_PATTERN = /^[^\s@,;:<>()[\]\\"]+@[^\s@,;:<>()[\]\\"]+\.[A-Za-z]{2,}$/

const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 80

export async function POST(request: NextRequest) {
  if (!hasInternalApiSecret(request)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as {
    email?: unknown
    name?: unknown
    source?: unknown
    event?: unknown
  } | null

  const rawEmail = typeof body?.email === 'string' ? body.email : ''
  const email = rawEmail.trim().replace(/^<|>$/g, '').toLowerCase()

  if (!email || email.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(email)) {
    return NextResponse.json({ ok: false, error: 'A valid email is required' }, { status: 400 })
  }

  const name =
    typeof body?.name === 'string'
      ? body.name.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH) || null
      : null

  // `provider` is a free-text tag on users; recording the kiosk's source string
  // here keeps booth attribution without adding a column.
  const provider =
    typeof body?.source === 'string' && body.source.trim()
      ? body.source.trim().slice(0, 64)
      : 'all-aboard'

  try {
    const { id, created } = await prisma.$transaction(tx =>
      provisionPaUser(tx, { email, name, provider })
    )

    console.log(`[waitlist] ${created ? 'created' : 'existing'} ${email} via ${provider}`)

    return NextResponse.json({ ok: true, created, userId: id })
  } catch (error) {
    console.error('[waitlist] provisioning failed:', error)
    return NextResponse.json(
      { ok: false, error: 'Could not add that address right now' },
      { status: 500 }
    )
  }
}
