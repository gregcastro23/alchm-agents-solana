import { RecipesPage } from '@/components/admin/pages/RecipesPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/recipe-latency, which is the only source of this page's data.
export const dynamic = 'force-dynamic'

export default function AdminRecipesPage() {
  return <RecipesPage />
}
