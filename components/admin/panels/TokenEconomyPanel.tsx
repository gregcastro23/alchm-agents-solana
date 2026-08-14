'use client'

import { useMemo } from 'react'
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Coins,
  CreditCard,
  Flame,
  Link2,
  Scale,
  Users,
  Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AdminAlert } from '@/lib/admin/alerts'
import {
  AlertRow,
  Bar,
  Empty,
  KeyValue,
  Metric,
  PanelError,
  PanelHeader,
  PanelSkeleton,
  Pill,
  Section,
  StatusDot,
  formatAge,
  formatDateTime,
  formatNumber,
} from './ui'

export type EconomyPayload = {
  generatedAt: string
  supply: {
    holders: number
    circulating: number
    perAxis: Array<{ axis: string; total: number; average: number; max: number }>
    distribution: Array<{ band: string; count: number }>
    dailyClaims: {
      humansToday: number
      agentsToday: number
      yieldPerClaim: number
      claimRatePct: number
    }
  } | null
  flow: {
    count24h: number
    count7d: number
    minted24h: number
    burned24h: number
    net24h: number
    sources24h: Array<{ sourceType: string; net: number; entries: number }>
    sources7d: Array<{ sourceType: string; net: number; entries: number }>
    recent: Array<{
      transactionGroupId: string
      userId: string
      tokenType: string
      amount: number
      sourceType: string
      sourceId: string | null
      description: string | null
      createdAt: string | null
    }>
  } | null
  chain: {
    statusCounts: Record<string, number>
    total: number
    failed: number
    minted: number
    stuck: Array<{
      id: string
      userId: string
      status: string
      amount: number
      error: string | null
      stuckForMinutes: number | null
      updatedAt: string | null
    }>
    recent: Array<{
      id: string
      userId: string
      walletAddress: string
      status: string
      txHash: string | null
      network: string
      error: string | null
      amount: number
      createdAt: string | null
    }>
  } | null
  subscriptions: {
    active: number
    churningWithin7d: number
    byTier: Array<{ tier: string; count: number }>
    byStatus: Array<{ status: string; count: number }>
  } | null
  solana: {
    services: Array<{
      service: string
      connectionStatus: string
      activeRpc: string | null
      reconnectAttempts: number
      queueDepth: number
      lastProcessedSlot: string | null
      lastError: string | null
      heartbeatAt: string | null
      staleForMinutes: number | null
    }>
    outbox: { pending: number; failing: number }
    bridge: Array<{ status: string; count: number }>
    verifiedWallets: number
  } | null
  pricing: {
    tokenTypes: string[]
    dailyYield: number
    duelYield: { reward: Record<string, number>; dailyCap: number }
    operations: Array<{ operation: string; cost: Record<string, number>; total: number }>
  }
  degraded: Array<{ section: string; error: string }>
  alerts: AdminAlert[]
}

const AXIS_TONE: Record<string, 'sky' | 'emerald' | 'amber' | 'violet'> = {
  spirit: 'violet',
  essence: 'sky',
  matter: 'amber',
  substance: 'emerald',
}

const CLAIM_STATUS_TONE: Record<string, 'emerald' | 'amber' | 'rose' | 'zinc'> = {
  minted: 'emerald',
  debited: 'amber',
  pending: 'amber',
  failed: 'rose',
}

export default function TokenEconomyPanel({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  data: EconomyPayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate?: (tab: string) => void
}) {
  const maxBand = useMemo(
    () => Math.max(1, ...(data?.supply?.distribution.map(b => b.count) ?? [1])),
    [data]
  )
  const maxSource = useMemo(
    () => Math.max(1, ...(data?.flow?.sources24h.map(s => Math.abs(s.net)) ?? [1])),
    [data]
  )

  if (error) return <PanelError message={error} onRetry={onRetry} />
  if (loading && !data) return <PanelSkeleton />
  if (!data) return <Empty label="Token economy telemetry is unavailable." />

  const { supply, flow, chain, subscriptions, solana, pricing } = data
  const netTone = (flow?.net24h ?? 0) > 0 ? 'amber' : 'emerald'

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="ESMS Token Economy"
        title="Economy Ledger & Chain Reconciliation"
        description="Spirit · Essence · Matter · Substance across the authoritative off-chain ledger, the on-chain claim mirror, and the Solana settlement rail. Faucet against sink, and every claim that has left one ledger without arriving in the other."
        icon={Coins}
        tone="amber"
        action={
          <span className="text-[10px] font-mono text-zinc-500">
            read {formatDateTime(data.generatedAt)}
          </span>
        }
      />

      {data.degraded.length > 0 && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs text-amber-200">
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4" />
            {data.degraded.length} section(s) unreadable
          </div>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-amber-100/80">
            {data.degraded.map(d => (
              <li key={d.section}>
                <span className="font-bold">{d.section}</span>: {d.error}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.alerts.length > 0 && (
        <Section title="Economy Alerts" icon={AlertTriangle}>
          <div className="space-y-2.5">
            {data.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      )}

      {/* Headline supply + flow */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={Coins}
          label="ESMS Circulating"
          value={formatNumber(supply?.circulating ?? null)}
          detail={`${formatNumber(supply?.holders ?? null)} wallets on the books`}
          tone="amber"
        />
        <Metric
          icon={ArrowUpRight}
          label="Minted 24h"
          value={formatNumber(flow?.minted24h ?? null)}
          detail={`${formatNumber(flow?.count24h ?? null)} ledger entries`}
          tone="emerald"
        />
        <Metric
          icon={Flame}
          label="Burned 24h"
          value={formatNumber(flow?.burned24h ?? null)}
          detail="Consultations, forging, shop"
          tone="rose"
        />
        <Metric
          icon={Scale}
          label="Net 24h"
          value={flow ? `${flow.net24h > 0 ? '+' : ''}${formatNumber(flow.net24h)}` : '—'}
          detail={(flow?.net24h ?? 0) > 0 ? 'Faucet outpacing sink' : 'Sink holding the supply'}
          tone={netTone}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        {/* Per-axis supply */}
        <Section title="Supply by Axis" icon={Coins} subtitle="Total held across all wallets">
          {!supply ? (
            <Empty label="Balance ledger unreadable." />
          ) : (
            <div className="space-y-4">
              {supply.perAxis.map(axis => {
                const max = Math.max(...supply.perAxis.map(a => a.total), 1)
                return (
                  <div key={axis.axis} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-bold capitalize text-zinc-300">{axis.axis}</span>
                      <span className="font-mono text-[10px] font-bold text-zinc-500">
                        {formatNumber(axis.total)} total · avg {formatNumber(axis.average)} · max{' '}
                        {formatNumber(axis.max)}
                      </span>
                    </div>
                    <Bar value={axis.total} max={max} tone={AXIS_TONE[axis.axis] ?? 'sky'} />
                  </div>
                )
              })}

              <div className="mt-5 border-t border-white/5 pt-4">
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.16em] text-zinc-500">
                  Holder distribution (total ESMS)
                </p>
                <div className="space-y-2.5">
                  {supply.distribution.map(band => (
                    <div key={band.band} className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="font-medium text-zinc-400">{band.band}</span>
                        <span className="font-mono font-bold text-zinc-500">
                          {formatNumber(band.count)}
                        </span>
                      </div>
                      <Bar value={band.count} max={maxBand} tone="sky" />
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-t border-white/5 pt-3">
                <KeyValue
                  label="Daily claims today (humans)"
                  value={`${supply.dailyClaims.humansToday} · ${supply.dailyClaims.claimRatePct}% of holders`}
                />
                <KeyValue
                  label="Daily claims today (agents)"
                  value={supply.dailyClaims.agentsToday}
                />
                <KeyValue
                  label="Yield per claim"
                  value={`${supply.dailyClaims.yieldPerClaim} ESMS`}
                />
              </div>
            </div>
          )}
        </Section>

        {/* Flow by source */}
        <Section
          title="Faucet & Sink (24h)"
          icon={Scale}
          subtitle="Net ESMS per transaction source"
        >
          {!flow || flow.sources24h.length === 0 ? (
            <Empty label="No token transactions in the last 24 hours." />
          ) : (
            <div className="space-y-3.5">
              {flow.sources24h.map(source => (
                <div key={source.sourceType} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="flex items-center gap-1.5 truncate font-bold text-zinc-300">
                      {source.net >= 0 ? (
                        <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                      ) : (
                        <ArrowDownRight className="h-3.5 w-3.5 shrink-0 text-rose-400" />
                      )}
                      <span className="truncate font-mono">{source.sourceType}</span>
                    </span>
                    <span
                      className={cn(
                        'shrink-0 font-mono text-[10px] font-bold',
                        source.net >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      )}
                    >
                      {source.net > 0 ? '+' : ''}
                      {formatNumber(source.net)} · {source.entries}×
                    </span>
                  </div>
                  <Bar
                    value={Math.abs(source.net)}
                    max={maxSource}
                    tone={source.net >= 0 ? 'emerald' : 'rose'}
                  />
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {/* Chain reconciliation */}
      <Section
        title="On-Chain Claim Reconciliation"
        icon={Link2}
        subtitle="esms_claims mirrors an off-chain debit onto Base — a claim stranded between the two destroys ESMS silently"
        action={
          chain && (
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(chain.statusCounts).map(([status, count]) => (
                <Pill key={status} tone={CLAIM_STATUS_TONE[status] ?? 'zinc'}>
                  {status} {count}
                </Pill>
              ))}
            </div>
          )
        }
      >
        {!chain ? (
          <Empty label="Claim ledger unreadable." />
        ) : chain.total === 0 ? (
          <Empty label="No ESMS claims have been submitted." />
        ) : (
          <div className="space-y-5">
            {chain.stuck.length > 0 && (
              <div className="rounded-xl border border-rose-500/25 bg-rose-500/10 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-rose-200">
                  {chain.stuck.length} claim(s) stranded mid-settlement
                </p>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[640px] text-[11px]">
                    <thead className="border-b border-rose-500/20 text-[10px] uppercase tracking-wider text-rose-300/70">
                      <tr>
                        <th className="px-2 py-1.5 text-left font-bold">Claim</th>
                        <th className="px-2 py-1.5 text-left font-bold">User</th>
                        <th className="px-2 py-1.5 text-left font-bold">Status</th>
                        <th className="px-2 py-1.5 text-right font-bold">ESMS</th>
                        <th className="px-2 py-1.5 text-right font-bold">Stuck</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-rose-500/10">
                      {chain.stuck.map(row => (
                        <tr key={row.id}>
                          <td className="px-2 py-1.5 font-mono text-rose-100/90">
                            {row.id.slice(0, 12)}…
                          </td>
                          <td className="px-2 py-1.5 font-mono text-rose-100/60">
                            {row.userId.slice(0, 10)}…
                          </td>
                          <td className="px-2 py-1.5 font-bold text-rose-200">{row.status}</td>
                          <td className="px-2 py-1.5 text-right font-mono text-rose-100">
                            {formatNumber(row.amount)}
                          </td>
                          <td className="px-2 py-1.5 text-right font-mono text-rose-200">
                            {formatAge(row.stuckForMinutes)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs">
                <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">Claim</th>
                    <th className="px-3 py-2.5 text-left">Wallet</th>
                    <th className="px-3 py-2.5 text-left">Status</th>
                    <th className="px-3 py-2.5 text-right">ESMS</th>
                    <th className="px-3 py-2.5 text-left">Tx</th>
                    <th className="px-3 py-2.5 text-left">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {chain.recent.map(row => (
                    <tr key={row.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-400">
                        {row.id.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-400">
                        {row.walletAddress.slice(0, 6)}…{row.walletAddress.slice(-4)}
                      </td>
                      <td className="px-3 py-2.5">
                        <Pill tone={CLAIM_STATUS_TONE[row.status] ?? 'zinc'}>{row.status}</Pill>
                        {row.error && (
                          <p className="mt-1 max-w-[200px] truncate font-mono text-[10px] text-rose-300/70">
                            {row.error}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-bold text-zinc-200">
                        {formatNumber(row.amount)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                        {row.txHash ? `${row.txHash.slice(0, 10)}…` : '—'}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                        {formatDateTime(row.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Section>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Solana rail */}
        <Section title="Solana Settlement Rail" icon={Wallet}>
          {!solana ? (
            <Empty label="Solana tables unreadable." />
          ) : (
            <div className="space-y-4">
              {solana.services.length === 0 ? (
                <Empty label="No Solana worker has ever written a heartbeat." />
              ) : (
                solana.services.map(service => {
                  const stale = service.staleForMinutes !== null && service.staleForMinutes > 15
                  return (
                    <div
                      key={service.service}
                      className="rounded-xl border border-white/5 bg-zinc-950/40 p-3.5"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs font-bold text-zinc-200">
                          {service.service}
                        </span>
                        <StatusDot
                          ok={!stale && service.connectionStatus === 'connected'}
                          label={
                            stale
                              ? `stale ${formatAge(service.staleForMinutes)}`
                              : service.connectionStatus
                          }
                        />
                      </div>
                      <div className="mt-2">
                        <KeyValue label="Queue depth" value={service.queueDepth} />
                        <KeyValue label="Reconnects" value={service.reconnectAttempts} />
                        <KeyValue label="Last slot" value={service.lastProcessedSlot ?? '—'} />
                        {service.lastError && (
                          <KeyValue label="Last error" value={service.lastError} tone="rose" />
                        )}
                      </div>
                    </div>
                  )
                })
              )}

              <div className="border-t border-white/5 pt-3">
                <KeyValue
                  label="Outbox undelivered"
                  value={`${solana.outbox.pending} (${solana.outbox.failing} failing)`}
                  tone={solana.outbox.failing > 0 ? 'rose' : undefined}
                />
                <KeyValue label="Verified wallets" value={solana.verifiedWallets} />
                {solana.bridge.map(row => (
                  <KeyValue key={row.status} label={`Bridge · ${row.status}`} value={row.count} />
                ))}
              </div>
            </div>
          )}
        </Section>

        {/* Subscriptions */}
        <Section title="Subscriptions" icon={CreditCard}>
          {!subscriptions ? (
            <Empty label="Subscription table unreadable." />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <Metric
                  icon={Users}
                  label="Active"
                  value={formatNumber(subscriptions.active)}
                  tone="emerald"
                />
                <Metric
                  icon={AlertTriangle}
                  label="Churning ≤7d"
                  value={formatNumber(subscriptions.churningWithin7d)}
                  detail="cancel_at_period_end"
                  tone={subscriptions.churningWithin7d > 0 ? 'amber' : 'zinc'}
                />
              </div>
              <div>
                {subscriptions.byTier.map(row => (
                  <KeyValue key={row.tier} label={`Tier · ${row.tier}`} value={row.count} />
                ))}
                {subscriptions.byStatus.map(row => (
                  <KeyValue key={row.status} label={`Status · ${row.status}`} value={row.count} />
                ))}
              </div>
            </div>
          )}
        </Section>
      </div>

      {/* Sink pricing */}
      <Section
        title="Configured Sink Pricing"
        icon={Flame}
        subtitle="Live values from lib/economy-config.ts — what each operation costs the user right now"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-xs">
            <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-3 py-2.5 text-left">Operation</th>
                {pricing.tokenTypes.map(type => (
                  <th key={type} className="px-3 py-2.5 text-right">
                    {type}
                  </th>
                ))}
                <th className="px-3 py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850">
              {pricing.operations.map(op => (
                <tr key={op.operation} className="transition-colors hover:bg-white/[0.02]">
                  <td className="px-3 py-2.5 font-mono text-zinc-300">{op.operation}</td>
                  {pricing.tokenTypes.map(type => (
                    <td key={type} className="px-3 py-2.5 text-right font-mono text-zinc-500">
                      {op.cost[type] ?? '·'}
                    </td>
                  ))}
                  <td className="px-3 py-2.5 text-right font-mono font-bold text-amber-300">
                    {op.total}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 border-t border-white/5 pt-3">
          <KeyValue label="Daily free yield" value={`${pricing.dailyYield} ESMS`} />
          <KeyValue
            label="Duel yield"
            value={`${Object.values(pricing.duelYield.reward).reduce((a, b) => a + b, 0)} ESMS · cap ${pricing.duelYield.dailyCap}/day`}
          />
        </div>
      </Section>

      {/* Recent ledger */}
      <Section title="Recent Ledger Entries" icon={Coins}>
        {!flow || flow.recent.length === 0 ? (
          <Empty label="No ledger entries recorded." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                <tr>
                  <th className="px-3 py-2.5 text-left">When</th>
                  <th className="px-3 py-2.5 text-left">User</th>
                  <th className="px-3 py-2.5 text-left">Axis</th>
                  <th className="px-3 py-2.5 text-right">Amount</th>
                  <th className="px-3 py-2.5 text-left">Source</th>
                  <th className="px-3 py-2.5 text-left">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-850">
                {flow.recent.map((tx, index) => (
                  <tr
                    key={`${tx.transactionGroupId}-${tx.tokenType}-${index}`}
                    className="transition-colors hover:bg-white/[0.02]"
                  >
                    <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                      {formatDateTime(tx.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-400">
                      {tx.userId.slice(0, 10)}…
                    </td>
                    <td className="px-3 py-2.5 text-zinc-300">{tx.tokenType}</td>
                    <td
                      className={cn(
                        'px-3 py-2.5 text-right font-mono font-bold',
                        tx.amount >= 0 ? 'text-emerald-300' : 'text-rose-300'
                      )}
                    >
                      {tx.amount > 0 ? '+' : ''}
                      {tx.amount}
                    </td>
                    <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-400">
                      {tx.sourceType}
                    </td>
                    <td className="max-w-[240px] truncate px-3 py-2.5 text-zinc-500">
                      {tx.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}
