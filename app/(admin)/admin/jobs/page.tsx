import { JobsPage } from '@/components/admin/pages/JobsPage'

// Access is enforced by app/(admin)/admin/layout.tsx (requireAdmin) and again by
// /api/admin/jobs, which is the only source of this page's data.
export const dynamic = 'force-dynamic'

export default function AdminJobsPage() {
  return <JobsPage />
}
