'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Coins,
  History,
  KeyRound,
  Search,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert } from '@/lib/admin/alerts'
import {
  AlertRow,
  Empty,
  KeyValue,
  Metric,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  Pill,
  Section,
  formatDateTime,
  formatNumber,
  type Tone,
} from './ui'

type AdminUserRow = {
  id: string
  email: string
  name: string | null
  role: string
  provider: string | null
  verified: boolean
  isAgentic: boolean
  createdAt: string | null
  lastLogin: string | null
  lastActivationAt: string | null
  activationCount: number
  walletAddress: string | null
  privyLinked: boolean
  alchmKitchenLinked: boolean
  balance: {
    spirit: number
    essence: number
    matter: number
    substance: number
    total: number
    lastDailyClaimAt: string | null
  } | null
  dominantElement: string | null
  subscription: { tier: string; status: string; currentPeriodEnd: string | null } | null
  providerKeys: Array<{ provider: string; last4: string; validated: boolean }>
}

export type UsersPayload = {
  generatedAt: string
  page: number
  pageSize: number
  total: number
  totalPages: number
  query: string
  role: string
  users: AdminUserRow[]
  totals: {
    byRole: Array<{ role: string; count: number }>
    agentic: number
    verified: number
  }
  configuredAdmins: { emails: string[]; handles: string[] }
  audit:
    | {
        available: true
        entries: Array<{
          id: string
          actorEmail: string | null
          actorSource: string
          action: string
          targetType: string
          targetId: string
          before: unknown
          after: unknown
          note: string | null
          createdAt: string
        }>
      }
    | { available: false; entries: never[]; error?: string }
  alerts: AdminAlert[]
}

const ROLE_TONE: Record<string, Tone> = {
  admin: 'rose',
  moderator: 'amber',
  user: 'zinc',
}

const ROLES = ['user', 'moderator', 'admin'] as const

export default function UserAdministrationPanel({
  onNavigate,
}: {
  onNavigate?: (tab: string) => void
}) {
  const [data, setData] = useState<UsersPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [mutationNotice, setMutationNotice] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (submittedQuery) params.set('q', submittedQuery)
      if (roleFilter) params.set('role', roleFilter)

      const response = await fetch(`/api/admin/users?${params}`, { cache: 'no-store' })
      const payload = await response.json().catch(() => null)
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.error || `User directory returned ${response.status}`)
      }
      setData(payload as UsersPayload)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user directory')
    } finally {
      setLoading(false)
    }
  }, [page, submittedQuery, roleFilter])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const mutate = useCallback(
    async (userId: string, patch: Record<string, unknown>) => {
      setPending(userId)
      setMutationError(null)
      setMutationNotice(null)
      try {
        const response = await fetch(`/api/admin/users/${userId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        const payload = await response.json().catch(() => null)
        if (!response.ok || !payload?.success) {
          throw new Error(payload?.error || `Update failed with ${response.status}`)
        }
        if (payload.unchanged) {
          setMutationNotice(payload.message)
        } else if (payload.audit && payload.audit.recorded === false) {
          // The change applied; the trail did not. Say both.
          setMutationNotice(
            `Updated ${payload.changed.join(', ')} — but the change was NOT recorded in the audit log (${payload.audit.reason}).`
          )
        } else {
          setMutationNotice(`Updated ${payload.changed.join(', ')} and recorded to the audit log.`)
        }
        await fetchUsers()
      } catch (err) {
        setMutationError(err instanceof Error ? err.message : 'Update failed')
      } finally {
        setPending(null)
      }
    },
    [fetchUsers]
  )

  if (error) return <PanelError message={error} onRetry={fetchUsers} />
  if (loading && !data) return <PanelSkeleton />
  if (!data) return <Empty label="User directory is unavailable." />

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="User Administration"
        title="Directory & Access Control"
        description="Search every account and see what it actually holds — balance, profile, subscription, wallet, BYOK keys — then change the three fields an operator legitimately needs. Every change is written to an append-only audit trail."
        icon={UserCog}
        tone="sky"
        action={
          <span className="font-mono text-[10px] text-zinc-500">
            read {formatDateTime(data.generatedAt)}
          </span>
        }
      />

      {data.alerts.length > 0 && (
        <Section title="Access Findings" icon={AlertTriangle}>
          <div className="space-y-2.5">
            {data.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={Users} label="Accounts" value={formatNumber(data.total)} tone="sky" />
        <Metric
          icon={ShieldCheck}
          label="Verified"
          value={formatNumber(data.totals.verified)}
          tone="emerald"
        />
        <Metric
          icon={UserCog}
          label="Agentic"
          value={formatNumber(data.totals.agentic)}
          detail="Auto-acting accounts"
          tone="violet"
        />
        <Metric
          icon={ShieldCheck}
          label="Admin Role"
          value={formatNumber(data.totals.byRole.find(r => r.role === 'admin')?.count ?? 0)}
          detail={`+${data.configuredAdmins.emails.length} configured identities`}
          tone="rose"
        />
      </div>

      {/* Configured admins — access that no role filter will reveal */}
      <Section
        title="Configured Admin Identities"
        icon={KeyRound}
        subtitle="These hold console access through env configuration, not a database role — a role=admin filter will never show them"
      >
        <div className="flex flex-wrap gap-2">
          {data.configuredAdmins.emails.map(email => (
            <span
              key={email}
              className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-2.5 py-1 font-mono text-[11px] text-rose-200"
            >
              {email}
            </span>
          ))}
          {data.configuredAdmins.handles.map(handle => (
            <span
              key={handle}
              className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 font-mono text-[11px] text-amber-200"
            >
              @{handle}
            </span>
          ))}
        </div>
      </Section>

      {(mutationError || mutationNotice) && (
        <div
          className={cn(
            'rounded-2xl border p-4 text-xs',
            mutationError
              ? 'border-rose-500/25 bg-rose-500/10 text-rose-200'
              : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200'
          )}
        >
          {mutationError ?? mutationNotice}
        </div>
      )}

      {/* Directory */}
      <Section
        title="Account Directory"
        icon={Users}
        subtitle={`Page ${data.page} of ${data.totalPages} · ${formatNumber(data.total)} matching`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-600" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    setPage(1)
                    setSubmittedQuery(query.trim())
                  }
                }}
                placeholder="email, name, or id"
                className="w-52 rounded-xl border border-white/10 bg-zinc-950/60 py-1.5 pl-8 pr-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-sky-500/40 focus:outline-none"
              />
            </div>
            <select
              value={roleFilter}
              onChange={event => {
                setPage(1)
                setRoleFilter(event.target.value)
              }}
              className="rounded-xl border border-white/10 bg-zinc-950/60 px-2.5 py-1.5 text-xs text-zinc-200 focus:border-sky-500/40 focus:outline-none"
            >
              <option value="">all roles</option>
              {ROLES.map(role => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                setPage(1)
                setSubmittedQuery(query.trim())
              }}
              className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/[0.07]"
            >
              Search
            </button>
          </div>
        }
      >
        {data.users.length === 0 ? (
          <Empty label="No account matches this search." />
        ) : (
          <div className="space-y-2">
            {data.users.map(user => {
              const isOpen = expanded === user.id
              return (
                <div
                  key={user.id}
                  className="overflow-hidden rounded-xl border border-white/5 bg-zinc-950/40"
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : user.id)}
                    className="flex w-full flex-wrap items-center justify-between gap-3 p-3.5 text-left transition hover:bg-white/[0.02]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-xs font-bold text-zinc-100">
                          {user.name || 'Unnamed alchemist'}
                        </span>
                        <Pill tone={ROLE_TONE[user.role] ?? 'zinc'}>{user.role}</Pill>
                        {user.verified && <Pill tone="emerald">verified</Pill>}
                        {user.isAgentic && <Pill tone="violet">agentic</Pill>}
                      </div>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-zinc-500">
                        {user.email} · joined {formatDateTime(user.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-[10px] text-zinc-500">
                        <Coins className="mr-1 inline h-3 w-3" />
                        {user.balance ? formatNumber(user.balance.total) : 'no balance'}
                      </span>
                      {user.walletAddress && <Wallet className="h-3.5 w-3.5 text-emerald-400" />}
                      <ChevronRight
                        className={cn(
                          'h-4 w-4 text-zinc-600 transition-transform',
                          isOpen && 'rotate-90'
                        )}
                      />
                    </div>
                  </button>

                  {isOpen && (
                    <div className="grid gap-5 border-t border-white/5 bg-zinc-950/60 p-4 lg:grid-cols-[1fr_1fr_0.9fr]">
                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          Identity
                        </p>
                        <KeyValue label="User id" value={user.id} />
                        <KeyValue label="Provider" value={user.provider ?? '—'} />
                        <KeyValue label="Last login" value={formatDateTime(user.lastLogin)} />
                        <KeyValue label="Privy linked" value={user.privyLinked ? 'yes' : 'no'} />
                        <KeyValue
                          label="alchm.kitchen linked"
                          value={user.alchmKitchenLinked ? 'yes' : 'no'}
                        />
                        <KeyValue
                          label="Wallet"
                          value={
                            user.walletAddress
                              ? `${user.walletAddress.slice(0, 6)}…${user.walletAddress.slice(-4)}`
                              : '—'
                          }
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          Holdings
                        </p>
                        {user.balance ? (
                          <>
                            <KeyValue label="Spirit" value={user.balance.spirit} />
                            <KeyValue label="Essence" value={user.balance.essence} />
                            <KeyValue label="Matter" value={user.balance.matter} />
                            <KeyValue label="Substance" value={user.balance.substance} />
                            <KeyValue
                              label="Last daily claim"
                              value={formatDateTime(user.balance.lastDailyClaimAt)}
                            />
                          </>
                        ) : (
                          <p className="text-[11px] leading-relaxed text-amber-300/80">
                            No token_balances row — this account cannot pay for a consultation.
                          </p>
                        )}
                        <KeyValue label="Element" value={user.dominantElement ?? 'no profile'} />
                        <KeyValue
                          label="Subscription"
                          value={
                            user.subscription
                              ? `${user.subscription.tier} · ${user.subscription.status}`
                              : 'none'
                          }
                        />
                        <KeyValue
                          label="BYOK keys"
                          value={
                            user.providerKeys.length === 0
                              ? 'none'
                              : user.providerKeys
                                  .map(
                                    k =>
                                      `${k.provider}…${k.last4}${k.validated ? '' : ' (unvalidated)'}`
                                  )
                                  .join(', ')
                          }
                        />
                      </div>

                      <div>
                        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                          Actions
                        </p>
                        <div className="space-y-2.5">
                          <div>
                            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                              Role
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                              {ROLES.map(role => (
                                <button
                                  key={role}
                                  type="button"
                                  disabled={pending === user.id || user.role === role}
                                  onClick={() => mutate(user.id, { role })}
                                  className={cn(
                                    'rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition disabled:cursor-not-allowed',
                                    user.role === role
                                      ? 'border-sky-500/40 bg-sky-500/20 text-sky-200'
                                      : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.08] disabled:opacity-40'
                                  )}
                                >
                                  {role}
                                </button>
                              ))}
                            </div>
                          </div>

                          <button
                            type="button"
                            disabled={pending === user.id}
                            onClick={() => mutate(user.id, { verified: !user.verified })}
                            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            <span>{user.verified ? 'Revoke verification' : 'Mark verified'}</span>
                            {user.verified && <Check className="h-3.5 w-3.5 text-emerald-400" />}
                          </button>

                          <button
                            type="button"
                            disabled={pending === user.id}
                            onClick={() => mutate(user.id, { isAgentic: !user.isAgentic })}
                            className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[11px] font-bold text-zinc-300 transition hover:bg-white/[0.08] disabled:opacity-50"
                          >
                            <span>
                              {user.isAgentic ? 'Disable agentic mode' : 'Enable agentic mode'}
                            </span>
                            {user.isAgentic && <Check className="h-3.5 w-3.5 text-violet-400" />}
                          </button>

                          <p className="pt-1 text-[10px] leading-relaxed text-zinc-600">
                            Balances are ledger-backed and deliberately not editable here — a
                            balance changed without a matching token_transactions entry would
                            desynchronise the two.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {data.totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between border-t border-white/5 pt-4">
            <button
              type="button"
              disabled={data.page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/[0.07] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </button>
            <span className="font-mono text-[11px] text-zinc-500">
              {data.page} / {data.totalPages}
            </span>
            <button
              type="button"
              disabled={data.page >= data.totalPages}
              onClick={() => setPage(p => p + 1)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-300 transition hover:bg-white/[0.07] disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </Section>

      {/* Audit trail */}
      <Section
        title="Admin Audit Trail"
        icon={History}
        subtitle="Append-only record of every mutation made from this console"
      >
        {!data.audit.available ? (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-relaxed text-amber-200">
            The <span className="font-mono">admin_audit_log</span> table does not exist in this
            environment, so mutations made here are applying without being recorded. Run{' '}
            <span className="font-mono">bunx prisma db push</span> to create it.
            {data.audit.error && (
              <p className="mt-2 font-mono text-[10px] text-amber-100/70">{data.audit.error}</p>
            )}
          </div>
        ) : data.audit.entries.length === 0 ? (
          <Empty label="No admin mutation has been recorded yet." />
        ) : (
          <div className="space-y-2">
            {data.audit.entries.map(entry => (
              <div key={entry.id} className="rounded-xl border border-white/5 bg-zinc-950/40 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-bold text-zinc-200">
                    {entry.action}
                  </span>
                  <span className="font-mono text-[10px] text-zinc-500">
                    {formatDateTime(entry.createdAt)}
                  </span>
                </div>
                <p className="mt-1 font-mono text-[10px] text-zinc-500">
                  {entry.actorEmail ?? 'unknown actor'} ({entry.actorSource}) → {entry.targetType}:
                  {entry.targetId}
                </p>
                <p className="mt-1 break-all font-mono text-[10px] text-zinc-400">
                  {JSON.stringify(entry.before)} → {JSON.stringify(entry.after)}
                </p>
                {entry.note && (
                  <p className="mt-1 text-[11px] italic text-zinc-500">{entry.note}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>
    </div>
  )
}
