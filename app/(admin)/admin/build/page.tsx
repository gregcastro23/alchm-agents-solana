import { BuildPage } from '@/components/admin/pages/BuildPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/build and /api/admin/codebase-health, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminBuildRoute() {
  return <BuildPage />
}
