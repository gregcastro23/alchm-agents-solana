import { RagPage } from '@/components/admin/pages/AgentPanelPages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/vector-store/health (linked), which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminRagRoute() {
  return <RagPage />
}
