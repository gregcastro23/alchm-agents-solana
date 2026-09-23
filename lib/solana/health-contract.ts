/**
 * The response contract of `GET /api/solana/health`.
 *
 * WTEN's /admin/chain reads this endpoint (src/services/admin/solanaProgressService.ts)
 * with `Authorization: Bearer $INTERNAL_API_SECRET`: 401/403 means "the apps
 * don't share the secret"; 200 (healthy) and 503 (degraded or failed) both
 * carry a JSON body, which WTEN renders key by key. Bump SCHEMA_VERSION on any
 * breaking change to the body and tell WTEN; `test/solana/health-contract.spec.ts`
 * pins the shape and the status codes.
 */
import { z } from 'zod'

export const SOLANA_HEALTH_SCHEMA_VERSION = 1

const WorkerSchema = z.object({
  connectionStatus: z.string(),
  activeRpc: z.string().nullable(),
  reconnectAttempts: z.number().int().nonnegative(),
  queueDepth: z.number().int().nonnegative(),
  /** u64 slot as a decimal string — never a JS number. */
  lastProcessedSlot: z.string().regex(/^\d+$/).nullable(),
  lastError: z.string().nullable(),
  heartbeatAt: z.string().nullable(),
})

export const SolanaHealthBodySchema = z.object({
  schemaVersion: z.literal(SOLANA_HEALTH_SCHEMA_VERSION),
  status: z.enum(['healthy', 'degraded']),
  cluster: z.string(),
  checkedAt: z.string(),
  rpc: z.object({
    connectionStatus: z.string(),
    activeRpc: z.string().nullable(),
    reconnectAttempts: z.number().int().nonnegative(),
    observedSlot: z.string().regex(/^\d+$/).nullable(),
    lastError: z.string().nullable(),
  }),
  sync: WorkerSchema,
  bridge: WorkerSchema,
})

/** What the route answers (503) when collecting health threw. */
export const SolanaHealthFailureSchema = z.object({
  schemaVersion: z.literal(SOLANA_HEALTH_SCHEMA_VERSION),
  status: z.literal('unhealthy'),
  cluster: z.string(),
  checkedAt: z.string(),
  error: z.string(),
})

export const SolanaHealthResponseSchema = z.union([
  SolanaHealthBodySchema,
  SolanaHealthFailureSchema,
])
export type SolanaHealthResponse = z.infer<typeof SolanaHealthResponseSchema>
