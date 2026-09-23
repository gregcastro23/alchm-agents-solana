import { CouncilsPage } from '@/components/admin/pages/AgentPanelPages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/dashboard, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminCouncilsRoute() {
  return <CouncilsPage />
}
