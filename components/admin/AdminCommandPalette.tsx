'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ADMIN_NAV, adminHref } from '@/lib/admin/nav'

interface PaletteItem {
  id: string
  label: string
  group: string
  href: string
  hint: string
}

/**
 * Native top-layer admin command palette (`⌘K` / `Ctrl+K`).
 *
 * Uses `<dialog closedby="any">` + `showModal()` plus bounding-rect pointer
 * light-dismiss fallback (per modern-web-guidance `dialog` and
 * `light-dismiss-a-dialog`). No redundant `role="dialog"`, `aria-modal`, custom
 * focus trap, or Escape listener is added because `<dialog>.showModal()` handles
 * focus restoration and Escape natively.
 */
export function AdminCommandPalette({ triggerLabel = 'Quick jump' }: { triggerLabel?: string }) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const pointerDownOutsideRef = useRef(false)

  const [query, setQuery] = useState('')
  const [selectedIdx, setSelectedIdx] = useState(0)

  const baseItems: PaletteItem[] = useMemo(
    () =>
      ADMIN_NAV.flatMap(group =>
        group.items.map(item => ({
          id: item.href,
          label: item.label,
          group: group.group,
          href: adminHref(item.href),
          hint: item.ids?.length ? `${item.href} · ${item.ids.join(', ')}` : item.href,
        }))
      ),
    []
  )

  const results: PaletteItem[] = useMemo(() => {
    const q = query.trim()
    if (!q) return baseItems

    const lower = q.toLowerCase()
    const matched = baseItems.filter(
      item =>
        item.label.toLowerCase().includes(lower) ||
        item.group.toLowerCase().includes(lower) ||
        item.hint.toLowerCase().includes(lower) ||
        item.href.toLowerCase().includes(lower)
    )

    const dynamic: PaletteItem[] = []
    if (q.startsWith('@') && q.length > 1) {
      dynamic.push({
        id: `dynamic:email:${q}`,
        label: `Inspect operator/user ${q}`,
        group: 'Jump action',
        href: adminHref(`/admin/agents?q=${encodeURIComponent(q.slice(1))}`),
        hint: 'Search agents & user activity',
      })
    } else if (lower.startsWith('agent:') && q.length > 6) {
      const term = q.slice(6).trim()
      dynamic.push({
        id: `dynamic:agent:${term}`,
        label: `Search agent “${term}”`,
        group: 'Jump action',
        href: adminHref(`/admin/agents?q=${encodeURIComponent(term)}`),
        hint: 'Open Agent Roster filtered by query',
      })
    } else if (q.startsWith('/admin/')) {
      dynamic.push({
        id: `dynamic:path:${q}`,
        label: `Go directly to ${q}`,
        group: 'Direct path',
        href: adminHref(q),
        hint: 'Navigate to path',
      })
    }

    return [...dynamic, ...matched]
  }, [baseItems, query])

  const openPalette = useCallback(() => {
    const dialog = dialogRef.current
    if (!dialog || dialog.open) return
    setQuery('')
    setSelectedIdx(0)
    dialog.showModal()
    requestAnimationFrame(() => inputRef.current?.focus())
  }, [])

  const closePalette = useCallback(() => {
    const dialog = dialogRef.current
    if (dialog?.open) {
      dialog.close()
    }
  }, [])

  const navigateTo = useCallback(
    (href: string) => {
      closePalette()
      router.push(href)
    },
    [closePalette, router]
  )

  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        const dialog = dialogRef.current
        if (dialog?.open) {
          closePalette()
        } else {
          openPalette()
        }
      }
    }
    window.addEventListener('keydown', handleGlobalKey)
    return () => window.removeEventListener('keydown', handleGlobalKey)
  }, [closePalette, openPalette])

  const clampedIdx = Math.min(selectedIdx, Math.max(0, results.length - 1))

  const isOutsideDialog = (dialog: HTMLDialogElement, e: React.PointerEvent<HTMLDialogElement>) => {
    const rect = dialog.getBoundingClientRect()
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    )
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-zinc-900/80 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-white/30 hover:bg-zinc-800/80"
        aria-label="Open admin command palette"
      >
        <span>{triggerLabel}</span>
        <kbd className="rounded border border-white/15 bg-zinc-950 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
          ⌘K
        </kbd>
      </button>

      <dialog
        ref={dialogRef}
        closedby="any"
        aria-labelledby="admin-command-palette-title"
        onClose={e => {
          e.currentTarget.returnValue = ''
        }}
        onPointerDown={e => {
          pointerDownOutsideRef.current = isOutsideDialog(e.currentTarget, e)
        }}
        onPointerUp={e => {
          const upOutside = isOutsideDialog(e.currentTarget, e)
          if (pointerDownOutsideRef.current && upOutside) {
            closePalette()
          }
          pointerDownOutsideRef.current = false
        }}
        className="admin-command-dialog m-auto w-[min(92vw,600px)] rounded-2xl border border-white/15 bg-zinc-950 p-0 text-zinc-100 shadow-2xl"
      >
        <div className="border-b border-white/10 p-3">
          <div className="flex items-center justify-between gap-2 pb-2">
            <h2
              id="admin-command-palette-title"
              className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            >
              Operator Command Palette
            </h2>
            <button
              type="button"
              onClick={closePalette}
              className="rounded px-2 py-0.5 text-xs text-zinc-400 hover:bg-white/10 hover:text-zinc-100"
            >
              Esc
            </button>
          </div>
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setSelectedIdx(0)
            }}
            onKeyDown={e => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setSelectedIdx(prev => (results.length === 0 ? 0 : (prev + 1) % results.length))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setSelectedIdx(prev =>
                  results.length === 0 ? 0 : (prev - 1 + results.length) % results.length
                )
              } else if (e.key === 'Enter' && results[clampedIdx]) {
                e.preventDefault()
                navigateTo(results[clampedIdx].href)
              }
            }}
            placeholder="Filter 20 admin consoles, type @user, agent:name, or /admin/..."
            className="w-full rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400/50 focus:outline-none"
          />
        </div>

        <ul className="max-h-[55vh] divide-y divide-white/5 overflow-y-auto p-1.5">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-zinc-400">
              No matching admin route or operator action for “{query}”.
            </li>
          ) : (
            results.map((item, idx) => {
              const selected = idx === clampedIdx
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIdx(idx)}
                    onClick={() => navigateTo(item.href)}
                    className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition ${
                      selected ? 'bg-amber-500/15 text-amber-100' : 'text-zinc-200 hover:bg-white/5'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{item.label}</div>
                      <div className="truncate text-xs text-zinc-400">{item.hint}</div>
                    </div>
                    <span className="shrink-0 rounded border border-white/10 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">
                      {item.group}
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </dialog>
    </>
  )
}
