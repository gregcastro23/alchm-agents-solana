import { ChatsPage } from '@/components/admin/pages/ChatsPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/chats, which the page reads.
export const dynamic = 'force-dynamic'

export default function AdminChatsRoute() {
  return <ChatsPage />
}
