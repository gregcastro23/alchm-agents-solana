import 'server-only'

import { prisma } from '@/lib/db'
import type { AdminAuthSuccess } from '@/lib/admin-auth'

/**
 * Operator-console audit trail.
 *
 * Two properties matter here and they pull in opposite directions:
 *
 *  - A mutation must not fail because the audit table is missing. This repo
 *    deploys schema with `db push`, so an environment can legitimately be a
 *    push behind and the console still has to work there.
 *  - An unaudited mutation must never *look* audited. So a failed write is
 *    returned to the caller, which surfaces it in the response, rather than
 *    swallowed into a log line nobody reads.
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

export async function recordAdminAction(
  admin: AdminAuthSuccess,
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
