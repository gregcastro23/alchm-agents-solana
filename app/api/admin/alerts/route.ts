import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import {
  alertIf,
  countBySeverity,
  healthPosture,
  sortAlerts,
  type AdminAlert,
} from '@/lib/admin/alerts'
import { minutesSince } from '@/lib/admin/serialize'

export const dynamic = 'force-dynamic'

/**
 * Unified problem digest — "what is wrong right now".
 *
 * Each subsystem route already decides whether its own numbers are bad, so this
 * route fans out to them and merges their `alerts` arrays rather than
 * re-deriving thresholds from raw data. One definition of "bad" per subsystem,
 * in the route that owns the number.
 *
 * The fan-out is over HTTP to this same deployment because those routes are
 * admin-gated request handlers, not exported functions; the caller's cookies
 * are forwarded so the gate applies identically. A subsystem that fails to
 * answer becomes an alert of its own — a digest that silently omits a subsystem
 * would read as "all clear" for the one place that is actually broken.
 */

const SUBSYSTEMS = [
  { id: 'economy', path: '/api/admin/economy', label: 'Token economy' },
  { id: 'planetary', path: '/api/admin/planetary', label: 'Planetary integration' },
  { id: 'codebase', path: '/api/admin/codebase-health', label: 'Codebase health' },
  { id: 'onboarding', path: '/api/admin/onboarding', label: 'Onboarding funnel' },
] as const

const SUBSYSTEM_TIMEOUT_MS = 15_000

function originFrom(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host') || req.headers.get('host')
  const forwardedProto =
    req.headers.get('x-forwarded-proto') ||
    (forwardedHost?.startsWith('localhost') ? 'http' : 'https')
  if (forwardedHost) return `${forwardedProto}://${forwardedHost}`
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
}

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const origin = originFrom(req)
  const cookie = req.headers.get('cookie') ?? ''
  const started = Date.now()

  const results = await Promise.all(
    SUBSYSTEMS.map(async subsystem => {
      const subsystemStart = Date.now()
      try {
        const response = await fetch(`${origin}${subsystem.path}`, {
          headers: { cookie },
          cache: 'no-store',
          signal: AbortSignal.timeout(SUBSYSTEM_TIMEOUT_MS),
        })
        const payload = (await response.json().catch(() => null)) as {
          alerts?: AdminAlert[]
        } | null

        if (!response.ok || !payload) {
          return {
            id: subsystem.id,
            label: subsystem.label,
            ok: false,
            latencyMs: Date.now() - subsystemStart,
            alerts: [] as AdminAlert[],
            error: `HTTP ${response.status}`,
          }
        }

        return {
          id: subsystem.id,
          label: subsystem.label,
          ok: true,
          latencyMs: Date.now() - subsystemStart,
          alerts: Array.isArray(payload.alerts) ? payload.alerts : [],
          error: null as string | null,
        }
      } catch (error) {
        return {
          id: subsystem.id,
          label: subsystem.label,
          ok: false,
          latencyMs: Date.now() - subsystemStart,
          alerts: [] as AdminAlert[],
          error: error instanceof Error ? error.message : String(error),
        }
      }
    })
  )

  const merged: AdminAlert[] = results.flatMap(result => result.alerts)

  for (const failed of results.filter(result => !result.ok)) {
    merged.push({
      id: `digest:subsystem-unreachable:${failed.id}`,
      severity: 'critical',
      source: 'infrastructure',
      title: `${failed.label} diagnostics could not be collected`,
      detail: `${failed.error} after ${failed.latencyMs}ms. Nothing below reflects that subsystem — treat its state as unknown, not healthy.`,
      href: `tab:${failed.id}`,
    })
  }

  // ── Signals that belong to no single subsystem ───────────────────────────
  let database: { ok: boolean; latencyMs: number; error: string | null }
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    database = { ok: true, latencyMs: Date.now() - dbStart, error: null }
  } catch (error) {
    database = {
      ok: false,
      latencyMs: Date.now() - dbStart,
      error: error instanceof Error ? error.message : String(error),
    }
  }

  alertIf(merged, !database.ok, {
    id: 'infrastructure:database-down',
    severity: 'critical',
    source: 'infrastructure',
    title: 'Database is not answering',
    detail: database.error ?? 'SELECT 1 failed.',
  })

  // Model-provider configuration: the free chain skips missing keys silently,
  // so an operator can only learn a provider is absent by being told.
  const providers = [
    { id: 'anthropic', env: 'ANTHROPIC_API_KEY', role: 'Paid tiers + prompt caching' },
    { id: 'openai', env: 'OPENAI_API_KEY', role: 'Monica + last-ditch paid fallback' },
    { id: 'groq', env: 'GROQ_API_KEY', role: 'Free tier first choice' },
    { id: 'cerebras', env: 'CEREBRAS_API_KEY', role: 'Free chain #2' },
    { id: 'gemini', env: 'GEMINI_API_KEY', role: 'Free chain #3' },
    { id: 'openrouter', env: 'OPENROUTER_API_KEY', role: 'Free chain #4' },
  ].map(provider => ({ ...provider, configured: Boolean(process.env[provider.env]) }))

  const freeChain = providers.filter(p =>
    ['groq', 'cerebras', 'gemini', 'openrouter'].includes(p.id)
  )
  const configuredFree = freeChain.filter(p => p.configured)

  alertIf(merged, configuredFree.length === 0, {
    id: 'infrastructure:no-free-provider',
    severity: 'critical',
    source: 'infrastructure',
    title: 'No free-tier model provider is configured',
    detail:
      'Historical agent chat defaults to the free tier. With Groq, Cerebras, Gemini and OpenRouter all unset, every default-tier request falls through to paid OpenAI.',
    href: '/api/providers/health',
    remediation: 'Set at least GROQ_API_KEY.',
  })

  alertIf(merged, !providers.find(p => p.id === 'anthropic')?.configured, {
    id: 'infrastructure:no-anthropic',
    severity: 'info',
    source: 'infrastructure',
    title: 'ANTHROPIC_API_KEY is not set',
    detail:
      'Opt-in cheap_fast / primary / reflective tiers and persona prompt-caching are unavailable; those requests will walk the fallback chain instead.',
  })

  // Secrets whose absence fails a whole surface closed.
  const requiredSecrets = [
    {
      env: 'CRON_SECRET',
      impact: 'All seven scheduled jobs reject their own invocations in production.',
    },
    { env: 'INTERNAL_API_SECRET', impact: 'The MCP telemetry proxies fail closed with 503.' },
    { env: 'DATABASE_URL', impact: 'No database access at all.' },
  ].map(secret => ({ ...secret, configured: Boolean(process.env[secret.env]) }))

  for (const secret of requiredSecrets.filter(s => !s.configured)) {
    merged.push({
      id: `infrastructure:secret-missing:${secret.env}`,
      severity: secret.env === 'DATABASE_URL' ? 'critical' : 'warning',
      source: 'infrastructure',
      title: `${secret.env} is not set`,
      detail: secret.impact,
    })
  }

  // ── Recent error surface from live traffic ───────────────────────────────
  let recentFailures: {
    mcpFailures24h: number
    mcpTotal24h: number
    lastConversationMinutesAgo: number | null
  } | null = null

  try {
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
    const [mcpFailures, mcpTotal, lastConversation] = await Promise.all([
      prisma.mcp_invocations.count({ where: { calledAt: { gte: since24h }, success: false } }),
      prisma.mcp_invocations.count({ where: { calledAt: { gte: since24h } } }),
      prisma.agentConversation.aggregate({ _max: { createdAt: true } }),
    ])
    recentFailures = {
      mcpFailures24h: mcpFailures,
      mcpTotal24h: mcpTotal,
      lastConversationMinutesAgo: minutesSince(lastConversation._max.createdAt),
    }

    alertIf(merged, mcpTotal > 0 && mcpFailures / mcpTotal > 0.1, {
      id: 'infrastructure:mcp-error-rate',
      severity: 'warning',
      source: 'infrastructure',
      title: 'MCP tool error rate above 10%',
      detail: `${mcpFailures} of ${mcpTotal} invocations failed in the last 24 hours.`,
      href: 'tab:mcp',
    })
  } catch {
    // Non-fatal: the digest still stands on the subsystem alerts.
  }

  const sorted = sortAlerts(merged)
  const counts = countBySeverity(sorted)

  return NextResponse.json({
    success: true,
    generatedAt: new Date().toISOString(),
    collectionMs: Date.now() - started,
    posture: healthPosture(sorted),
    counts,
    alerts: sorted,
    subsystems: results.map(({ alerts, ...rest }) => ({ ...rest, alertCount: alerts.length })),
    database,
    providers,
    requiredSecrets,
    recentFailures,
  })
}
