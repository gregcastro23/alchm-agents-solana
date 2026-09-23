'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { ADMIN_NAV } from '@/lib/admin/nav'
import { cn } from '@/lib/utils'

export { ADMIN_NAV }

function NavList({ pathname }: { pathname: string | null }) {
  return (
    <ul className="flex flex-col gap-4 lg:gap-5">
      {ADMIN_NAV.map(section => (
        <li key={section.group} className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-400">
            {section.group}
          </p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5 lg:flex-col lg:gap-0.5">
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
  )
}

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
  const current = ADMIN_NAV.flatMap(g => g.items).find(i => i.href === pathname)
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-zinc-100">
      <div className="mx-auto grid max-w-[1400px] gap-6 px-4 py-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-6">
        <nav aria-label="Admin sections" className="min-w-0">
          {/* Phones get a disclosure so twenty links don't push the page below the fold. */}
          <details className="rounded-xl border border-white/10 bg-zinc-900/40 px-3 py-2 lg:hidden">
            <summary className="cursor-pointer text-sm font-semibold text-zinc-100">
              Admin sections
              {current && <span className="font-normal text-zinc-400"> · {current.label}</span>}
            </summary>
            <div className="mt-3">
              <NavList pathname={pathname} />
            </div>
          </details>
          <div className="hidden lg:block">
            <NavList pathname={pathname} />
          </div>
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
