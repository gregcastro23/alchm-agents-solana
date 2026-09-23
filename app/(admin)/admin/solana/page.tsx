import { SolanaPage } from '@/components/admin/pages/SolanaPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/solana, which is the only source of this page's data.
export const dynamic = 'force-dynamic'

export default function AdminSolanaPage() {
  return <SolanaPage />
}
