'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Grouped navigation for the route-level admin pages. The operator console at
 * /admin still holds the older panels; they move into these groups page by page.
 */
export const ADMIN_NAV: Array<{ group: string; items: Array<{ href: string; label: string }> }> = [
  { group: 'Pulse', items: [{ href: '/admin', label: 'Operator console' }] },
  {
    group: 'System',
    items: [
      { href: '/admin/jobs', label: 'Jobs & crons' },
      { href: '/admin/wten', label: 'WTEN link' },
      { href: '/admin/recipes', label: 'Recipe generation' },
    ],
  },
]

export function AdminFrame({
  title,
  description,
  updated,
  children,
}: {
  title: string
  description: ReactNode
  updated?: ReactNode
  children: ReactNode
}) {
  const pathname = usePathname()
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-6">
        <nav aria-label="Admin sections" className="min-w-0">
          <ul className="flex flex-wrap gap-x-6 gap-y-3 lg:flex-col lg:gap-5">
            {ADMIN_NAV.map(section => (
              <li key={section.group} className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  {section.group}
                </p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5 lg:flex-col">
                  {section.items.map(item => {
                    const active = pathname === item.href
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          className={cn(
                            'block rounded-lg px-2.5 py-1.5 text-sm',
                            active
                              ? 'bg-indigo-500/15 font-semibold text-indigo-100'
                              : 'text-zinc-300 hover:bg-white/5 hover:text-zinc-50'
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 space-y-5">
          <header className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-zinc-50">{title}</h1>
              <p className="mt-1 max-w-3xl text-sm text-zinc-400">{description}</p>
            </div>
            {updated && <div className="text-xs text-zinc-400">{updated}</div>}
          </header>
          {children}
        </div>
      </div>
    </main>
  )
}
