import { NextResponse, type NextRequest } from 'next/server'
import { prisma } from '@/lib/db'
import { recordAdminAction } from '@/lib/admin/audit'
import { requireAdminRequest } from '@/lib/security/privileged-api-auth'

export const dynamic = 'force-dynamic'

/**
 * User administration mutations.
 *
 * Deliberately narrow. Only three fields are writable from the console —
 * `role`, `verified`, `isAgentic` — because those are the ones an operator
 * legitimately needs to change while triaging, and every other column either
 * belongs to the user (name, email, wallet) or is derived state that must not
 * be hand-edited (balances, activation counts). Balances in particular are
 * ledger-backed: changing one without a matching `token_transactions` entry
 * would desynchronise the two, so this route refuses rather than offering it.
 *
 * Every accepted change is audited, and the response says whether the audit
 * write actually landed.
 */

const ASSIGNABLE_ROLES = ['user', 'admin', 'moderator'] as const
type AssignableRole = (typeof ASSIGNABLE_ROLES)[number]

type Patch = {
  role?: AssignableRole
  verified?: boolean
  isAgentic?: boolean
  note?: string
}

function parsePatch(body: unknown): { patch: Patch } | { error: string } {
  if (!body || typeof body !== 'object') return { error: 'Request body must be an object' }
  const input = body as Record<string, unknown>
  const patch: Patch = {}

  if ('role' in input && input.role !== undefined) {
    if (!ASSIGNABLE_ROLES.includes(input.role as AssignableRole)) {
      return { error: `role must be one of: ${ASSIGNABLE_ROLES.join(', ')}` }
    }
    patch.role = input.role as AssignableRole
  }

  for (const field of ['verified', 'isAgentic'] as const) {
    if (field in input && input[field] !== undefined) {
      if (typeof input[field] !== 'boolean') return { error: `${field} must be a boolean` }
      patch[field] = input[field] as boolean
    }
  }

  if ('note' in input && input.note !== undefined) {
    if (typeof input.note !== 'string') return { error: 'note must be a string' }
    patch.note = input.note.slice(0, 500)
  }

  const changedFields = (['role', 'verified', 'isAgentic'] as const).filter(
    field => patch[field] !== undefined
  )
  if (changedFields.length === 0) {
    return { error: 'No writable field supplied. Accepts: role, verified, isAgentic.' }
  }

  return { patch }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const access = await requireAdminRequest(req)
  if (!access.ok) return access.response
  const { admin } = access

  const { userId } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = parsePatch(body)
  if ('error' in parsed) {
    return NextResponse.json({ success: false, error: parsed.error }, { status: 400 })
  }
  const { patch } = parsed

  const existing = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true, role: true, verified: true, isAgentic: true },
  })

  if (!existing) {
    return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 })
  }

  if (existing.role === 'admin' && patch.role !== undefined && patch.role !== 'admin') {
    const adminCount = await prisma.users.count({ where: { role: 'admin' } })
    if (adminCount <= 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'Refusing to demote the last database admin.',
        },
        { status: 409 }
      )
    }
  }

  const changes: Record<string, unknown> = {}
  const before: Record<string, unknown> = {}
  for (const field of ['role', 'verified', 'isAgentic'] as const) {
    const next = patch[field]
    if (next === undefined || next === existing[field]) continue
    changes[field] = next
    before[field] = existing[field]
  }

  if (Object.keys(changes).length === 0) {
    return NextResponse.json({
      success: true,
      unchanged: true,
      message: 'Every supplied value already matches the stored record.',
      user: existing,
    })
  }

  const audit = await recordAdminAction(admin, {
    action: 'user.update.requested',
    targetType: 'user',
    targetId: userId,
    before,
    after: changes,
    note: patch.note ?? null,
  })

  if (!audit.recorded) {
    return NextResponse.json(
      {
        success: false,
        error: `Mandatory audit write failed: ${audit.reason}`,
      },
      { status: 503 }
    )
  }

  const updated = await prisma.users.update({
    where: { id: userId },
    data: changes,
    select: { id: true, email: true, name: true, role: true, verified: true, isAgentic: true },
  })

  return NextResponse.json({
    success: true,
    user: updated,
    changed: Object.keys(changes),
    audit,
  })
}
