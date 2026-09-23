import { OverviewPage } from '@/components/admin/pages/OverviewPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/alerts and /api/admin/dashboard, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminOverviewRoute() {
  return <OverviewPage />
}
