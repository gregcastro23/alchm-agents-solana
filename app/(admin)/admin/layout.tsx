import type { ReactNode } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/admin-auth'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin()

  if (!admin.ok && admin.status === 401) {
    redirect('/auth/signin?callbackUrl=/admin')
  }

  if (!admin.ok) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
        <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-xl font-semibold">Admin Access Required</h1>
          <p className="mt-2 text-sm text-zinc-400">{admin.error}</p>
          <Link
            href="/"
            className="mt-5 inline-flex rounded-md bg-zinc-100 px-3 py-2 text-sm font-semibold text-zinc-950"
          >
            Return home
          </Link>
        </div>
      </main>
    )
  }

  return children
}
