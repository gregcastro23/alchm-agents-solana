import { WtenLinkPage } from '@/components/admin/pages/WtenLinkPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/wten-link, which is the only source of this page's data.
export const dynamic = 'force-dynamic'

export default function AdminWtenLinkPage() {
  return <WtenLinkPage />
}
