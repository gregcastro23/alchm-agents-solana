import 'server-only'

import { loadDashboard } from '@/lib/admin/dashboard'
import { loadJobsReport } from '@/lib/admin/jobs'
import { memoizeAdmin } from '@/lib/admin/memory-cache'
import { buildOperationsControlPlane } from '@/lib/admin/operations-control-plane'
import { getAlertDeliveryStatus, getRecentOperatorAlerts } from '@/lib/admin/operator-alerts'
import type { OverviewPulsePayload } from '@/lib/admin/overview-pulse-schema'
import { classifyDebitPathFromDeliveries, loadWtenLinkReport } from '@/lib/admin/wten-link'

/**
 * Aggregates the Operations Control Plane, WTEN debit-path classification,
 * operator alert delivery status, and core dashboard telemetry under a single
 * 10s per-instance memoized read for `/api/admin/overview-pulse` and SSE ticks.
 */

const OVERVIEW_PULSE_TTL_MS = 10_000

export async function buildOverviewPulse(
  options: { fresh?: boolean; nowMs?: number } = {}
): Promise<OverviewPulsePayload> {
  const nowMs = options.nowMs ?? Date.now()
  return memoizeAdmin(
    'admin:overview-pulse',
    OVERVIEW_PULSE_TTL_MS,
    async () => {
      const [dashboard, jobs, wtenLink] = await Promise.all([
        loadDashboard(new Date(nowMs)),
        loadJobsReport(nowMs),
        loadWtenLinkReport({ nowMs }),
      ])
      const alertDelivery = getAlertDeliveryStatus()
      const controlPlane = buildOperationsControlPlane({
        dashboard,
        jobs,
        wtenLink,
        alertDelivery,
        nowIso: new Date(nowMs).toISOString(),
      })
      const debitPath = classifyDebitPathFromDeliveries(wtenLink.deliveries, wtenLink.endpoints)
      const recentAlerts = getRecentOperatorAlerts(15)

      return {
        generatedAt: new Date(nowMs).toISOString(),
        controlPlane,
        debitPath,
        alertDelivery,
        recentAlerts,
        dashboard,
      }
    },
    { fresh: options.fresh }
  )
}
