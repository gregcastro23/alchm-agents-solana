import { EconomyPage } from '@/components/admin/pages/EconomyPages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/economy, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminEconomyRoute() {
  return <EconomyPage />
}
