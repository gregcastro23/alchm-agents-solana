import 'server-only'

import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'

type AdminIdentity = {
  id?: string | null
  email?: string | null
  name?: string | null
}

function normalizeEmail(value?: string | null) {
  return (value || '').trim().toLowerCase()
}

export type AdminSessionUser = AdminIdentity & {
  role?: string | null
  tier?: string | null
}

export type AdminAuthSuccess = {
  ok: true
  user: AdminSessionUser
  source: 'session-role' | 'db-role'
}

export type AdminAuthFailure = {
  ok: false
  status: 401 | 403
  error: 'Authentication required' | 'Admin privileges required'
  user?: AdminSessionUser | null
}

export type AdminAuthResult = AdminAuthSuccess | AdminAuthFailure

function hasSessionIdentity(user?: AdminSessionUser | null) {
  return Boolean(user?.id || user?.email || user?.name)
}

function toSessionUser(user?: AdminSessionUser | null): AdminSessionUser | null {
  if (!user) return null

  return {
    id: user.id ?? null,
    email: user.email ?? null,
    name: user.name ?? null,
    role: user.role ?? null,
    tier: user.tier ?? null,
  }
}

export function isAdminSession(user?: AdminSessionUser | null) {
  if (!hasSessionIdentity(user)) return false
  return user?.role === 'admin'
}

export function adminErrorResponse(result: AdminAuthFailure) {
  return NextResponse.json({ error: result.error }, { status: result.status })
}

async function getSessionUser(): Promise<AdminSessionUser | null> {
  const session = await auth()
  const user = session?.user as AdminSessionUser | undefined

  return toSessionUser(user)
}

async function findDbAdminUser(user: AdminSessionUser) {
  const email = normalizeEmail(user.email)
  const clauses: Array<{ id: string } | { email: string }> = []

  if (user.id) clauses.push({ id: user.id })
  if (email) clauses.push({ email })

  if (clauses.length === 0) return null

  return prisma.users.findFirst({
    where: { OR: clauses },
    select: { id: true, email: true, name: true, role: true },
  })
}

export async function requireAdmin(
  userOverride?: AdminSessionUser | null
): Promise<AdminAuthResult> {
  const user = userOverride === undefined ? await getSessionUser() : toSessionUser(userOverride)

  if (!user || !hasSessionIdentity(user)) {
    return {
      ok: false,
      status: 401,
      error: 'Authentication required',
      user,
    }
  }

  if (user?.role === 'admin') {
    return { ok: true, user, source: 'session-role' }
  }

  try {
    const dbUser = await findDbAdminUser(user)
    if (!dbUser) {
      return {
        ok: false,
        status: 403,
        error: 'Admin privileges required',
        user,
      }
    }

    const resolvedUser: AdminSessionUser = {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      role: dbUser.role,
      tier: user.tier,
    }

    if (dbUser.role === 'admin') {
      return { ok: true, user: resolvedUser, source: 'db-role' }
    }
  } catch (error) {
    console.warn('[AdminAuth] Failed to verify database admin role:', error)
  }

  return {
    ok: false,
    status: 403,
    error: 'Admin privileges required',
    user,
  }
}
