import { InfrastructurePage } from '@/components/admin/pages/SystemPages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/dashboard, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminInfrastructureRoute() {
  return <InfrastructurePage />
}
