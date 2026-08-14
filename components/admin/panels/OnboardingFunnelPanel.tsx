'use client'

import { useState } from 'react'
import {
  AlertTriangle,
  Check,
  Coins,
  MessageSquare,
  Route,
  Sparkles,
  Stars,
  UserPlus,
  Wallet,
  X,
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
  Section,
  formatDateTime,
  formatNumber,
} from './ui'

export type OnboardingPayload = {
  generatedAt: string
  funnels: Array<{
    window: string
    label: string
    steps: Array<{ id: string; label: string; count: number; pctOfSignups: number }>
  }>
  funnelError: string | null
  recent: Array<{
    id: string
    email: string
    name: string | null
    provider: string | null
    verified: boolean
    createdAt: string | null
    lastLogin: string | null
    hasProfile: boolean
    hasChart: boolean
    hasBalance: boolean
    hasWallet: boolean
    hasChatted: boolean
    completedSteps: number
  }>
  recentError: string | null
  monica: {
    withSettings: number
    withProgress: number
    avgLevel: number | null
    avgInteractions: number | null
    activeStreaks: number
  } | null
  alerts: AdminAlert[]
}

const STEP_ICON = {
  signup: UserPlus,
  profile: Stars,
  chart: Stars,
  tokens: Coins,
  chat: MessageSquare,
  wallet: Wallet,
} as const

function StepCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      title={label}
      className={cn(
        'inline-flex h-5 w-5 items-center justify-center rounded-md border',
        ok
          ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300'
          : 'border-zinc-800 bg-zinc-950/60 text-zinc-700'
      )}
    >
      {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
    </span>
  )
}

export default function OnboardingFunnelPanel({
  data,
  loading,
  error,
  onRetry,
  onNavigate,
}: {
  data: OnboardingPayload | null
  loading: boolean
  error: string | null
  onRetry: () => void
  onNavigate?: (tab: string) => void
}) {
  const [activeWindow, setActiveWindow] = useState('7d')

  if (error) return <PanelError message={error} onRetry={onRetry} />
  if (loading && !data) return <PanelSkeleton />
  if (!data) return <Empty label="Onboarding telemetry is unavailable." />

  const funnel = data.funnels.find(f => f.window === activeWindow) ?? data.funnels[0]
  const signups = funnel?.steps[0]?.count ?? 0

  return (
    <div className="space-y-6">
      <PanelHeader
        eyebrow="Onboarding & Activation"
        title="Signup Funnel"
        description="Where new accounts stall between registering and actually using the product. Each step is counted absolutely against the signup cohort, so a user who acquires one thing without another is visible rather than averaged away."
        icon={Route}
        tone="emerald"
        action={
          <span className="text-[10px] font-mono text-zinc-500">
            read {formatDateTime(data.generatedAt)}
          </span>
        }
      />

      {data.alerts.length > 0 && (
        <Section title="Onboarding Findings" icon={AlertTriangle}>
          <div className="space-y-2.5">
            {data.alerts.map(alert => (
              <AlertRow key={alert.id} alert={alert} onNavigate={onNavigate} />
            ))}
          </div>
        </Section>
      )}

      {data.funnelError ? (
        <PanelError message={data.funnelError} onRetry={onRetry} />
      ) : (
        <Section
          title="Conversion Funnel"
          icon={Route}
          subtitle="Percentages are of the signup cohort, not of the previous step"
          action={
            <div className="flex flex-wrap gap-1.5">
              {data.funnels.map(f => (
                <button
                  key={f.window}
                  type="button"
                  onClick={() => setActiveWindow(f.window)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition',
                    activeWindow === f.window
                      ? 'border-emerald-500/30 bg-emerald-500/15 text-emerald-200'
                      : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:bg-white/[0.07]'
                  )}
                >
                  {f.window}
                </button>
              ))}
            </div>
          }
        >
          {!funnel || signups === 0 ? (
            <Empty label={`No signups in this window (${funnel?.label ?? 'unknown'}).`} />
          ) : (
            <div className="space-y-5">
              {funnel.steps.map((step, index) => {
                const Icon = STEP_ICON[step.id as keyof typeof STEP_ICON] ?? Route
                const previous = index > 0 ? funnel.steps[index - 1].count : null
                const stepOverStep =
                  previous && previous > 0 ? Math.round((step.count / previous) * 1000) / 10 : null
                const severe = index > 0 && step.pctOfSignups < 25

                return (
                  <div key={step.id} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-xs font-bold text-zinc-200">
                        <Icon className="h-4 w-4 text-zinc-500" />
                        {step.label}
                      </span>
                      <span className="font-mono text-[11px] text-zinc-500">
                        <span className="font-bold text-zinc-300">{formatNumber(step.count)}</span>{' '}
                        · {step.pctOfSignups}% of signups
                        {stepOverStep !== null && (
                          <span className="text-zinc-600"> · {stepOverStep}% step-over-step</span>
                        )}
                      </span>
                    </div>
                    <Bar
                      value={step.count}
                      max={signups}
                      tone={index === 0 ? 'sky' : severe ? 'rose' : 'emerald'}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </Section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <Section
          title="Recent Signups — Completion State"
          icon={UserPlus}
          subtitle="Profile · Chart · Balance · Chat · Wallet"
        >
          {data.recentError ? (
            <PanelError message={data.recentError} onRetry={onRetry} />
          ) : data.recent.length === 0 ? (
            <Empty label="No users have registered." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs">
                <thead className="border-b border-zinc-800 text-[10px] font-extrabold uppercase tracking-wider text-zinc-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left">User</th>
                    <th className="px-3 py-2.5 text-left">Joined</th>
                    <th className="px-3 py-2.5 text-center">Steps</th>
                    <th className="px-3 py-2.5 text-right">Done</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850">
                  {data.recent.map(user => (
                    <tr key={user.id} className="transition-colors hover:bg-white/[0.02]">
                      <td className="px-3 py-2.5">
                        <div className="font-bold text-zinc-200">
                          {user.name || 'Unnamed alchemist'}
                        </div>
                        <div className="mt-0.5 font-mono text-[10px] text-zinc-500">
                          {user.email}
                          {user.provider && (
                            <span className="text-zinc-700"> · {user.provider}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[10px] text-zinc-500">
                        {formatDateTime(user.createdAt)}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <StepCheck ok={user.hasProfile} label="Birth profile" />
                          <StepCheck ok={user.hasChart} label="Natal chart" />
                          <StepCheck ok={user.hasBalance} label="ESMS balance" />
                          <StepCheck ok={user.hasChatted} label="First consultation" />
                          <StepCheck ok={user.hasWallet} label="Wallet linked" />
                        </div>
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2.5 text-right font-mono font-bold',
                          user.completedSteps === 0
                            ? 'text-rose-300'
                            : user.completedSteps >= 4
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                        )}
                      >
                        {user.completedSteps}/5
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Monica Guide Progress" icon={Sparkles}>
          {!data.monica ? (
            <Empty label="Monica progress tables unreadable." />
          ) : (
            <div className="space-y-4">
              <Metric
                icon={Sparkles}
                label="Users Guided"
                value={formatNumber(data.monica.withProgress)}
                detail={`${data.monica.withSettings} have settings`}
                tone="violet"
              />
              <div>
                <KeyValue label="Average level" value={data.monica.avgLevel ?? '—'} />
                <KeyValue label="Average interactions" value={data.monica.avgInteractions ?? '—'} />
                <KeyValue label="Active streaks (2+)" value={data.monica.activeStreaks} />
              </div>
              {data.monica.withProgress === 0 && (
                <p className="text-[11px] leading-relaxed text-zinc-500">
                  No user has any Monica progress recorded. Either the guide is not reached during
                  onboarding, or its progress writes are not landing.
                </p>
              )}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
