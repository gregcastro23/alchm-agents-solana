import 'server-only'

import { prisma } from '@/lib/db'

/**
 * Operator-console audit trail.
 *
 * Callers that mutate operational state must treat `recorded: false` as a
 * failed precondition and stop before the side effect. Read-only callers may
 * still surface an unavailable trail as a degraded state.
 */

export type AuditOutcome = { recorded: true; id: string } | { recorded: false; reason: string }

export type AuditEntry = {
  action: string
  targetType: string
  targetId: string
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  note?: string | null
}

export type AdminAuditActor = {
  user: {
    id?: string | null
    email?: string | null
  }
  source: string
}

export async function recordAdminAction(
  admin: AdminAuditActor,
  entry: AuditEntry
): Promise<AuditOutcome> {
  try {
    const row = await prisma.admin_audit_log.create({
      data: {
        actorId: admin.user.id ?? null,
        actorEmail: admin.user.email ?? null,
        actorSource: admin.source,
        action: entry.action,
        targetType: entry.targetType,
        targetId: entry.targetId,
        before: (entry.before ?? null) as never,
        after: (entry.after ?? null) as never,
        note: entry.note ?? null,
      },
      select: { id: true },
    })
    return { recorded: true, id: row.id }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    console.error('[admin-audit] failed to record action', entry.action, reason)
    return { recorded: false, reason }
  }
}

export async function recentAdminActions(limit = 25) {
  try {
    const rows = await prisma.admin_audit_log.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
    })
    return {
      available: true as const,
      entries: rows.map(row => ({
        id: row.id,
        actorEmail: row.actorEmail,
        actorSource: row.actorSource,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        before: row.before,
        after: row.after,
        note: row.note,
        createdAt: row.createdAt.toISOString(),
      })),
    }
  } catch (error) {
    // The table not existing yet is the expected case in an un-pushed
    // environment, and it is reported rather than rendered as "no activity".
    return {
      available: false as const,
      entries: [],
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
