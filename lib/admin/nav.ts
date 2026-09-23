/**
 * The admin surface's map: every route-level page, in the sidebar groups the
 * operator reaches for (Pulse / Agents / Economy & chain / Build / System).
 * `test/admin/admin-nav.spec.ts` fails if a page exists without a nav entry,
 * or a nav entry points at no page.
 *
 * `ids` are the subsystem / old console tab ids that alerts still use in their
 * `tab:<id>` hrefs, so an alert raised by any route lands on the page that owns it.
 */

export interface AdminNavItem {
  href: string
  label: string
  ids?: string[]
}

export const ADMIN_NAV: Array<{ group: string; items: AdminNavItem[] }> = [
  {
    group: 'Pulse',
    items: [
      { href: '/admin', label: 'Overview', ids: ['overview', 'pulse'] },
      { href: '/admin/users', label: 'Users', ids: ['users'] },
      { href: '/admin/onboarding', label: 'Onboarding funnel', ids: ['onboarding'] },
    ],
  },
  {
    group: 'Agents',
    items: [
      { href: '/admin/agents', label: 'Roster & sync', ids: ['agents'] },
      { href: '/admin/chats', label: 'Chats & providers', ids: ['chats', 'providers'] },
      { href: '/admin/councils', label: 'Council convenings', ids: ['groupChats', 'councils'] },
      { href: '/admin/leveling', label: 'Cosmic leveling', ids: ['leveling'] },
      { href: '/admin/arenas', label: 'Arenas', ids: ['jing', 'scrabble', 'arenas'] },
      { href: '/admin/rag', label: 'RAG & knowledge', ids: ['rag'] },
    ],
  },
  {
    group: 'Economy & chain',
    items: [
      { href: '/admin/economy', label: 'Token economy', ids: ['economy'] },
      { href: '/admin/solana', label: 'Solana & chain', ids: ['solana'] },
      { href: '/admin/web3', label: 'Arc & Base (EVM)', ids: ['web3'] },
      { href: '/admin/planetary', label: 'Planetary layer', ids: ['planetary'] },
    ],
  },
  {
    group: 'Build',
    items: [
      { href: '/admin/build', label: 'Build health', ids: ['codebase', 'build'] },
      { href: '/admin/deployments', label: 'Deployments', ids: ['deployments', 'desktop'] },
    ],
  },
  {
    group: 'System',
    items: [
      { href: '/admin/jobs', label: 'Jobs & crons', ids: ['jobs'] },
      { href: '/admin/wten', label: 'WTEN link', ids: ['wten-link', 'wten'] },
      { href: '/admin/recipes', label: 'Recipe generation', ids: ['recipes'] },
      { href: '/admin/mcp', label: 'MCP invocations', ids: ['mcp'] },
      { href: '/admin/infrastructure', label: 'Infrastructure', ids: ['infrastructure'] },
    ],
  },
]

const BY_ID = new Map(
  ADMIN_NAV.flatMap(g => g.items.flatMap(item => (item.ids ?? []).map(id => [id, item.href])))
)

/**
 * Where an alert or subsystem link goes. Accepts `tab:<id>`, a bare id, or an
 * admin path; anything unknown lands on the overview, which lists every alert.
 */
export function adminHref(target: string | null | undefined): string {
  if (!target) return '/admin'
  if (target.startsWith('/admin')) return target
  const id = target.startsWith('tab:') ? target.slice(4) : target
  return BY_ID.get(id) ?? '/admin'
}

export const ADMIN_PAGE_HREFS: string[] = ADMIN_NAV.flatMap(g => g.items.map(i => i.href))
