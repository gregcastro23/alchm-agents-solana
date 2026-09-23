import { AgentsPage } from '@/components/admin/pages/AgentsPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/agents, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminAgentsRoute() {
  return <AgentsPage />
}
