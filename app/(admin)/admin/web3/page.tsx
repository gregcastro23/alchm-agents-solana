import { Web3Page } from '@/components/admin/pages/Web3Page'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// public EVM RPCs, read from the browser on demand, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminWeb3Route() {
  return <Web3Page />
}
