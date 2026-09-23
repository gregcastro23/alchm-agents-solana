import { UsersPage } from '@/components/admin/pages/PulsePages'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/users, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminUsersRoute() {
  return <UsersPage />
}
