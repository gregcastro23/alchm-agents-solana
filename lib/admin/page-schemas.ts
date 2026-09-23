/**
 * Client-side validation for the admin pages' payloads.
 *
 * Every page parses its endpoint's JSON with one of these before rendering, so
 * a changed or broken response shows as "—" plus the reason instead of as
 * wrong numbers. Each schema also carries a compile-time drift guard: if a
 * field is renamed or retyped on the server, `bunx tsc --noEmit` fails here.
 *
 * Only `import type` from the server modules — this file ships to the browser.
 */
import { z } from 'zod'
import type { JobsReport } from '@/lib/admin/jobs'
import type { WtenLinkReport } from '@/lib/admin/wten-link'
import type { RecipeLatencyReport } from '@/lib/admin/recipe-latency'
import type { SolanaChainReport } from '@/lib/admin/solana-chain'
import type { AdminAlert } from '@/lib/admin/alerts'
import type { AgentsReport } from '@/lib/admin/agents'
import type { BuildHealthReport } from '@/lib/admin/build-health'
import type { ChatsReport } from '@/lib/admin/chats'
import type { DashboardReport } from '@/lib/admin/dashboard'
import type { PulsePayload } from '@/components/admin/panels/SystemPulsePanel'
import type { EconomyPayload } from '@/components/admin/panels/TokenEconomyPanel'
import type { PlanetaryPayload } from '@/components/admin/panels/PlanetaryAgentsPanel'
import type { CodebaseHealthPayload } from '@/components/admin/panels/CodebaseHealthPanel'
import type { OnboardingPayload } from '@/components/admin/panels/OnboardingFunnelPanel'

type ServerSatisfies<S, T> = [S] extends [T] ? true : false
type AssertTrue<T extends true> = T

export const AdminAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(['critical', 'warning', 'info']),
  source: z.enum([
    'economy',
    'planetary',
    'codebase',
    'onboarding',
    'infrastructure',
    'agents',
    'users',
  ]),
  title: z.string(),
  detail: z.string(),
  href: z.string().optional(),
  remediation: z.string().optional(),
})
export type _AlertDrift = AssertTrue<ServerSatisfies<AdminAlert, z.infer<typeof AdminAlertSchema>>>

export const SourceStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('live') }),
  z.object({ status: z.literal('not_provisioned'), reason: z.string() }),
  z.object({ status: z.literal('unavailable'), reason: z.string() }),
])

const RunStatus = z.enum(['success', 'failure', 'timeout'])

export const JobsReportSchema = z.object({
  generatedAt: z.string(),
  heartbeats: SourceStatusSchema,
  jobs: z.array(
    z.object({
      name: z.string(),
      path: z.string(),
      schedule: z.string(),
      intervalMinutes: z.number(),
      limitMs: z.number(),
      callsWten: z.boolean(),
      callsModel: z.boolean(),
      state: z.enum(['ok', 'retrying', 'late', 'failing', 'never']).nullable(),
      lastRunAt: z.string().nullable(),
      lastStatus: RunStatus.nullable(),
      lastError: z.object({ at: z.string(), message: z.string() }).nullable(),
      expected24h: z.number(),
      runs24h: z.number().nullable(),
      missed24h: z.number().nullable(),
      runs7d: z.number().nullable(),
      successRate7d: z.number().nullable(),
      p95DurationMs: z.number().nullable(),
      recent: z.array(
        z.object({
          startedAt: z.string(),
          status: RunStatus,
          durationMs: z.number(),
          partial: z.boolean(),
          error: z.string().nullable(),
        })
      ),
    })
  ),
  minutes: z.array(
    z.object({ minute: z.number(), asolJobs: z.array(z.string()), wten: z.boolean() })
  ),
  alerts: z.array(AdminAlertSchema),
})
export type JobsReportPayload = z.infer<typeof JobsReportSchema>
export type _JobsDrift = AssertTrue<ServerSatisfies<JobsReport, JobsReportPayload>>

export const WtenLinkReportSchema = z.object({
  generatedAt: z.string(),
  windowHours: z.number(),
  deliveries: SourceStatusSchema,
  endpoints: z
    .array(
      z.object({
        endpoint: z.string(),
        attempts: z.number(),
        events: z.number(),
        split: z.object({
          ok2xx: z.number(),
          alreadyApplied409: z.number(),
          insufficientFunds402: z.number(),
          otherClient4xx: z.number(),
          server5xx: z.number(),
          timeouts: z.number(),
          networkErrors: z.number(),
        }),
        p95LatencyMs: z.number().nullable(),
        lastAt: z.string().nullable(),
        lastError: z
          .object({ at: z.string(), status: z.number().nullable(), message: z.string() })
          .nullable(),
        timeoutMs: z.number().nullable(),
        receiverDedupes: z.boolean().nullable(),
      })
    )
    .nullable(),
  recent: z
    .array(
      z.object({
        at: z.string(),
        endpoint: z.string(),
        eventId: z.string(),
        attempt: z.number(),
        status: z.number().nullable(),
        result: z.string(),
        latencyMs: z.number(),
        error: z.string().nullable(),
      })
    )
    .nullable(),
  secrets: z.array(
    z.object({
      secret: z.enum(['INTERNAL_API_SECRET', 'ALCHM_KITCHEN_SYNC_SECRET']),
      verdict: z.enum(['match', 'mismatch', 'not_configured', 'unknown']),
      probe: z.string(),
      status: z.number().nullable(),
      detail: z.string(),
      checkedAt: z.string(),
    })
  ),
  alerts: z.array(AdminAlertSchema),
})
export type WtenLinkPayload = z.infer<typeof WtenLinkReportSchema>
export type _WtenLinkDrift = AssertTrue<ServerSatisfies<WtenLinkReport, WtenLinkPayload>>

const MsOrNull = z.number().nullable()

export const RecipeLatencyReportSchema = z.object({
  generatedAt: z.string(),
  source: SourceStatusSchema,
  summary: z
    .object({
      windowSeconds: z.number(),
      countingSince: z.string(),
      processStartedAt: z.string(),
      requests: z.number(),
      generated: z.number(),
      cacheHits: z.number(),
      errors: z.number(),
      errorRate: z.number().nullable(),
      p50Ms: MsOrNull,
      p95Ms: MsOrNull,
      maxMs: MsOrNull,
      byProvider: z.record(
        z.string(),
        z.object({ count: z.number(), p50Ms: MsOrNull, p95Ms: MsOrNull })
      ),
    })
    .nullable(),
  wtenBudgetMs: z.number(),
  alerts: z.array(AdminAlertSchema),
})
export type RecipeLatencyPayload = z.infer<typeof RecipeLatencyReportSchema>

/** `{ ok: true, value } | { ok: false, reason }` — one independently-read section. */
const sectionOf = <T extends z.ZodTypeAny>(value: T) =>
  z.discriminatedUnion('ok', [
    z.object({ ok: z.literal(true), value }),
    z.object({ ok: z.literal(false), reason: z.string() }),
  ])

const WorkerViewSchema = z.object({
  connectionStatus: z.string(),
  queueDepth: z.number(),
  lastProcessedSlot: z.string().nullable(),
  lastError: z.string().nullable(),
  heartbeatAt: z.string().nullable(),
})

export const SolanaChainReportSchema = z.object({
  generatedAt: z.string(),
  cluster: z.literal('devnet'),
  rpc: z.object({ label: z.string(), private: z.boolean() }),
  program: sectionOf(
    z.object({
      programId: z.string(),
      executable: z.boolean(),
      lastDeploySlot: z.string().nullable(),
      upgradeAuthority: z.string().nullable(),
      authorityIsMultisigVault: z.boolean(),
    })
  ),
  config: sectionOf(
    z.object({
      address: z.string(),
      version: z.number(),
      admin: z.string(),
      attestor: z.string(),
      pauser: z.string(),
      pauseClaims: z.boolean(),
      pauseRedemptions: z.boolean(),
    })
  ),
  mints: sectionOf(
    z.array(
      z.object({
        symbol: z.string(),
        address: z.string(),
        decimals: z.number(),
        supply: z.number().nullable(),
        holders: z.number().nullable(),
        holdersReason: z.string().nullable(),
      })
    )
  ),
  pools: sectionOf(
    z.array(
      z.object({
        poolId: z.number(),
        address: z.string(),
        exists: z.boolean(),
        pair: z.string(),
        reserveA: z.string().nullable(),
        reserveB: z.string().nullable(),
        totalShares: z.string().nullable(),
        bootstrapped: z.boolean().nullable(),
        paused: z.boolean().nullable(),
      })
    )
  ),
  multisig: sectionOf(
    z.object({
      multisigPda: z.string(),
      vaultPda: z.string(),
      threshold: z.number(),
      members: z.array(z.object({ role: z.string(), address: z.string() })),
      accountExists: z.boolean(),
      vaultLamports: z.number(),
    })
  ),
  deployer: sectionOf(
    z.object({
      address: z.string(),
      lamports: z.number(),
      low: z.boolean(),
      lowBelowSol: z.number(),
    })
  ),
  workers: sectionOf(z.object({ sync: WorkerViewSchema, bridge: WorkerViewSchema })),
  readiness: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      state: z.enum(['pass', 'fail', 'unknown']),
      evidence: z.string(),
    })
  ),
  alerts: z.array(AdminAlertSchema),
})
export type SolanaChainPayload = z.infer<typeof SolanaChainReportSchema>
export type _SolanaChainDrift = AssertTrue<ServerSatisfies<SolanaChainReport, SolanaChainPayload>>
export type _RecipeLatencyDrift = AssertTrue<
  ServerSatisfies<RecipeLatencyReport, RecipeLatencyPayload>
>

const Counts = z.record(z.string(), z.number())

export const AgentsReportSchema = z.object({
  generatedAt: z.string(),
  code: z.array(z.object({ agentId: z.string(), name: z.string(), chart: z.string() })),
  db: sectionOf(
    z.object({
      historical: z.number(),
      active: z.number(),
      created: z.number(),
      rows: z.array(
        z.object({ agentId: z.string(), isActive: z.boolean(), hasBirthchart: z.boolean() })
      ),
    })
  ),
  sync: sectionOf(
    z.object({
      rows: z.array(
        z.object({
          agentId: z.string(),
          linked: z.boolean(),
          lastActivationAt: z.string().nullable(),
        })
      ),
    })
  ),
  wallets: sectionOf(z.object({ agentIds: z.array(z.string()) })),
  activity: sectionOf(
    z.object({
      conversations24h: z.number(),
      conversations7d: z.number(),
      actions24h: Counts,
      actions7d: Counts,
      byAgent7d: z.record(z.string(), z.object({ chats: z.number(), actions: z.number() })),
    })
  ),
  wten: sectionOf(z.object({ agents: z.number() })),
  alerts: z.array(AdminAlertSchema),
})
export type AgentsPayload = z.infer<typeof AgentsReportSchema>
export type _AgentsDrift = AssertTrue<ServerSatisfies<AgentsReport, AgentsPayload>>

const CiStateSchema = z.enum(['success', 'failure', 'pending', 'cancelled', 'none'])

export const BuildHealthReportSchema = z.object({
  generatedAt: z.string(),
  repo: z.string(),
  authenticated: z.boolean(),
  deployed: z.object({
    sha: z.string().nullable(),
    ref: z.string().nullable(),
    env: z.string().nullable(),
  }),
  main: sectionOf(
    z.object({ sha: z.string(), message: z.string(), committedAt: z.string(), url: z.string() })
  ),
  behind: sectionOf(z.object({ commits: z.number() })),
  ci: sectionOf(
    z.array(
      z.object({
        workflow: z.string(),
        state: CiStateSchema,
        sha: z.string(),
        url: z.string(),
        startedAt: z.string(),
        durationMs: z.number().nullable(),
      })
    )
  ),
  pulls: sectionOf(
    z.array(
      z.object({
        number: z.number(),
        title: z.string(),
        draft: z.boolean(),
        author: z.string(),
        head: z.string(),
        updatedAt: z.string(),
        url: z.string(),
        ci: CiStateSchema,
      })
    )
  ),
  alerts: z.array(AdminAlertSchema),
})
export type BuildHealthPayload = z.infer<typeof BuildHealthReportSchema>
export type _BuildHealthDrift = AssertTrue<ServerSatisfies<BuildHealthReport, BuildHealthPayload>>

const ModelStatsSchema = z.object({
  model: z.string(),
  calls: z.number(),
  failures: z.number(),
  timed: z.number(),
  p50Ms: z.number().nullable(),
  p95Ms: z.number().nullable(),
  lastAt: z.string(),
})

export const ChatsReportSchema = z.object({
  generatedAt: z.string(),
  byModel24h: sectionOf(z.array(ModelStatsSchema)),
  byModel7d: sectionOf(z.array(ModelStatsSchema)),
  recent: sectionOf(
    z.array(
      z.object({
        id: z.string(),
        agentId: z.string(),
        agentName: z.string(),
        sessionId: z.string(),
        userMessage: z.string(),
        agentResponse: z.string(),
        responseTime: z.number().nullable(),
        modelUsed: z.string().nullable(),
        createdAt: z.string(),
        failed: z.boolean(),
      })
    )
  ),
  alerts: z.array(AdminAlertSchema),
})
export type ChatsPayload = z.infer<typeof ChatsReportSchema>
export type _ChatsDrift = AssertTrue<ServerSatisfies<ChatsReport, ChatsPayload>>

const Histogram = z.record(z.string(), z.number())

/**
 * A stored Json column. Not `z.unknown()`: zod makes an `unknown` key optional,
 * which would let a dropped column pass as "absent".
 */
const JsonValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.string(), z.unknown()),
])

export const DashboardReportSchema = z.object({
  generatedAt: z.string(),
  users: sectionOf(z.object({ total: z.number(), newToday: z.number(), admins: z.number() })),
  agents: sectionOf(
    z.object({ historical: z.number(), created: z.number(), totalConversations: z.number() })
  ),
  harmony: sectionOf(
    z.object({
      spirit: z.number().nullable(),
      essence: z.number().nullable(),
      matter: z.number().nullable(),
      substance: z.number().nullable(),
    })
  ),
  activity: sectionOf(
    z.array(z.object({ type: z.string(), description: z.string(), timestamp: z.string() }))
  ),
  topAgents: sectionOf(
    z.array(z.object({ id: z.string(), name: z.string(), interactions: z.number() }))
  ),
  jing: sectionOf(
    z.object({
      recentJingDuels: z.array(
        z.object({
          id: z.string(),
          sessionId: z.string(),
          userId: z.string().nullable(),
          source: z.string(),
          casterId: z.string(),
          casterName: z.string(),
          targetId: z.string(),
          targetName: z.string(),
          attackMoveId: z.string(),
          counterMoveId: z.string(),
          stance: z.string(),
          boostElement: z.string().nullable(),
          boostMagnitude: z.number(),
          cacheHit: z.boolean(),
          latencyMs: z.number().nullable(),
          modelUsed: z.string().nullable(),
          createdAt: z.string(),
          synastrySnapshot: JsonValueSchema,
          casterTransitSnapshot: JsonValueSchema,
          targetTransitSnapshot: JsonValueSchema,
          casterPrompt: z.string().nullable(),
          casterResponse: z.string().nullable(),
          targetPrompt: z.string().nullable(),
          targetResponse: z.string().nullable(),
        })
      ),
      jingAggregates: z.object({
        total: z.number(),
        last24h: z.number(),
        last7d: z.number(),
        stanceHistogram: Histogram,
        boostElementHistogram: Histogram,
        topPairs: z.array(
          z.object({
            casterId: z.string(),
            targetId: z.string(),
            casterName: z.string(),
            targetName: z.string(),
            count: z.number(),
          })
        ),
        avgLatencyMs: z.number().nullable(),
      }),
    })
  ),
  mcp: sectionOf(
    z.object({
      total: z.number(),
      last24h: z.number(),
      successRate: z.number().nullable(),
      avgLatencyMs: z.number().nullable(),
      topTools: z.array(z.object({ toolName: z.string(), count: z.number() })),
      recent: z.array(
        z.object({
          toolName: z.string(),
          calledAt: z.string(),
          completedAt: z.string().nullable(),
          latencyMs: z.number().nullable(),
          success: z.boolean(),
          caller: z.string().nullable(),
          arguments: JsonValueSchema,
          errorMessage: z.string().nullable(),
          agentId: z.string().nullable(),
        })
      ),
    })
  ),
  groupChats: sectionOf(
    z.object({
      total: z.number(),
      last24h: z.number(),
      recent: z.array(
        z.object({
          id: z.string(),
          agentIds: JsonValueSchema,
          transitKey: z.string().nullable(),
          userId: z.string().nullable(),
          origin: z.string().nullable(),
          createdAt: z.string(),
        })
      ),
      originHistogram: Histogram,
    })
  ),
  system: z.object({
    database: sectionOf(z.object({ latencyMs: z.number() })),
    backend: sectionOf(z.object({ url: z.string(), status: z.number(), latencyMs: z.number() })),
    providersConfigured: z.record(z.string(), z.boolean()),
    deployment: z.object({
      url: z.string().nullable(),
      env: z.string().nullable(),
      commitSha: z.string().nullable(),
      commitRef: z.string().nullable(),
      region: z.string().nullable(),
    }),
  }),
  alerts: z.array(AdminAlertSchema),
})
export type DashboardPayload = z.infer<typeof DashboardReportSchema>
export type _DashboardDrift = AssertTrue<ServerSatisfies<DashboardReport, DashboardPayload>>

/**
 * The older subsystem panels (pulse, economy, planetary, codebase, onboarding)
 * already report a degraded section as `null` plus an alert, and render that
 * distinctly. Their pages validate the envelope — timestamp and alerts — so an
 * error page or a changed contract fails loudly; their deep schemas are a
 * follow-up. The drift guards pin the envelope against each server type.
 */
export const LegacyEnvelopeSchema = z
  .object({ generatedAt: z.string(), alerts: z.array(AdminAlertSchema) })
  .passthrough()
type Envelope = z.infer<typeof LegacyEnvelopeSchema>
export type _PulseEnvelopeDrift = AssertTrue<ServerSatisfies<PulsePayload, Envelope>>
export type _EconomyEnvelopeDrift = AssertTrue<ServerSatisfies<EconomyPayload, Envelope>>
export type _PlanetaryEnvelopeDrift = AssertTrue<ServerSatisfies<PlanetaryPayload, Envelope>>
export type _CodebaseEnvelopeDrift = AssertTrue<ServerSatisfies<CodebaseHealthPayload, Envelope>>
export type _OnboardingEnvelopeDrift = AssertTrue<ServerSatisfies<OnboardingPayload, Envelope>>
