// @vitest-environment node
/**
 * The admin sidebar and the admin pages cannot drift apart: every page under
 * app/(admin)/admin has a nav entry, every nav entry has a page, and every
 * `tab:<id>` an alert can carry lands on a real page rather than the fallback.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { ADMIN_NAV, ADMIN_PAGE_HREFS, adminHref } from '@/lib/admin/nav'

const ROOT = path.resolve(__dirname, '../..')
const PAGES_DIR = path.join(ROOT, 'app/(admin)/admin')
/** Pages reached from another page rather than the sidebar. */
const SUB_PAGES = new Set(['/admin/rag-analytics'])

function pageHrefs(dir: string, prefix = '/admin'): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isDirectory()) return pageHrefs(path.join(dir, entry.name), `${prefix}/${entry.name}`)
    return entry.name === 'page.tsx' ? [prefix] : []
  })
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.tsx?$/.test(entry.name) ? [full] : []
  })
}

describe('admin navigation', () => {
  it('lists every admin page, and only pages that exist', () => {
    const onDisk = pageHrefs(PAGES_DIR)
      .filter(h => !SUB_PAGES.has(h))
      .sort()
    expect([...ADMIN_PAGE_HREFS].sort()).toEqual(onDisk)
  })

  it('uses the five groups, each non-empty', () => {
    expect(ADMIN_NAV.map(g => g.group)).toEqual([
      'Pulse',
      'Agents',
      'Economy & chain',
      'Build',
      'System',
    ])
    for (const g of ADMIN_NAV) expect(g.items.length).toBeGreaterThan(0)
  })

  it('routes every tab: id used by an alert, and every digest subsystem, to a page', () => {
    const ids = new Set<string>()
    for (const file of [
      ...sourceFiles(path.join(ROOT, 'app/api/admin')),
      ...sourceFiles(path.join(ROOT, 'lib')),
    ]) {
      const src = fs.readFileSync(file, 'utf8')
      for (const m of src.matchAll(/['"`]tab:([a-zA-Z-]+)['"`]/g)) ids.add(m[1])
    }
    const alerts = fs.readFileSync(path.join(ROOT, 'app/api/admin/alerts/route.ts'), 'utf8')
    const subsystems = alerts.slice(
      alerts.indexOf('const SUBSYSTEMS'),
      alerts.indexOf('] as const')
    )
    for (const m of subsystems.matchAll(/id: '([a-z-]+)'/g)) ids.add(m[1])

    expect(ids.size).toBeGreaterThan(8)
    const unrouted = [...ids].filter(id => adminHref(`tab:${id}`) === '/admin' && id !== 'pulse')
    expect(unrouted).toEqual([])
  })

  it('passes admin paths through and sends unknown ids to the overview', () => {
    expect(adminHref('/admin/jobs')).toBe('/admin/jobs')
    expect(adminHref('tab:codebase')).toBe('/admin/build')
    expect(adminHref('wten-link')).toBe('/admin/wten')
    expect(adminHref('tab:no-such-tab')).toBe('/admin')
    expect(adminHref(undefined)).toBe('/admin')
  })
})
