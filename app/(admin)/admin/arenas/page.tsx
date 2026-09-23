import { ArenasPage } from '@/components/admin/pages/AgentPanelPages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/dashboard and /api/admin/scrabble-standings, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminArenasRoute() {
  return <ArenasPage />
}
