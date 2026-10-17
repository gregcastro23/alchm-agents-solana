import { NextRequest, NextResponse } from 'next/server'
import { generateText, type LanguageModel } from 'ai'
import { ORACLE_SYSTEM_PROMPT } from '@/lib/agents/oracle-persona'
import {
  gatewayAnthropic,
  gatewayGoogle,
  gatewayGroq,
  gatewayOpenAI,
  isGatewayEnabled,
} from '@/lib/models/gateway'
import { GATEWAY_MODELS, GEMINI, GROQ, HISTORICAL_AGENT_TIERS, OPENAI } from '@/lib/models/registry'
import { getClientIp, rateLimit } from '@/lib/security/rate-limit'

// Network LLM work → Node runtime, never cached. maxDuration leaves ~6 s of
// headroom over ORACLE_DEADLINE_MS so the route can always answer its own 503.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0
export const maxDuration = 20

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key',
}

// vercel.json puts `s-maxage=60` on every /api/* response; an Oracle answer is
// per-question and must never be shared or replayed.
const RESPONSE_HEADERS = { ...CORS_HEADERS, 'Cache-Control': 'no-store' }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// ─── Contract constants (mirrored from backend/oracle_brain.py) ──────────────
// The Pentacles reducer rejects questions over 500 BYTES, not characters.
const MAX_QUESTION_BYTES = 500
const MAX_CONTEXT_CHARS = 2000
// ~120 words is ~170 tokens; headroom so no provider truncates mid-sentence.
const MAX_OUTPUT_TOKENS = 280
const REPLY_LIMIT_INSTRUCTION = 'Reply in at most 120 words.'

// The feeder waits 30 s per attempt and the player's client 25-30 s. Bound each
// provider call and the whole walk so a slow chain answers 503 (which sends the
// feeder to its own fallback) instead of keeping the player waiting.
const PROVIDER_TIMEOUT_MS = 8_000
const ORACLE_DEADLINE_MS = 14_000

const UNAVAILABLE_ERROR = 'No LLM provider available to channel the oracle.'

// The route is public (the Pentacles feeder sends no credentials), so it is gated like the
// FastAPI primary (backend/main.py _oracle_gate): per caller and overall, same env names and
// defaults. The feeder caps itself at 60 questions an hour. The store is per serverless
// instance (lib/security/rate-limit.ts), so this is best-effort, not a distributed limit.
const HOUR_MS = 60 * 60 * 1000
const MAX_BODY_BYTES = 16 * 1024

function envLimit(name: string, fallback: number): number {
  const parsed = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function gate(request: NextRequest): NextResponse | null {
  const declared = Number(request.headers.get('content-length') ?? '')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json(
      { success: false, error: 'Request body too large' },
      { status: 413, headers: RESPONSE_HEADERS }
    )
  }
  const perCaller = rateLimit(`oracle:${getClientIp(request.headers)}`, {
    limit: envLimit('BRAIN_ORACLE_PER_CALLER_PER_HOUR', 120),
    windowMs: HOUR_MS,
  })
  const overall = perCaller.ok
    ? rateLimit('oracle:global', {
        limit: envLimit('BRAIN_ORACLE_GLOBAL_PER_HOUR', 400),
        windowMs: HOUR_MS,
      })
    : perCaller
  if (perCaller.ok && overall.ok) return null
  return NextResponse.json(
    { success: false, error: 'Too Many Requests' },
    { status: 429, headers: { ...RESPONSE_HEADERS, 'Retry-After': '60' } }
  )
}

// ─── Request parsing ─────────────────────────────────────────────────────────

type ParsedRequest = { ok: true; question: string; context: string } | { ok: false; error: string }

function parseOracleRequest(body: unknown): ParsedRequest {
  const record = body && typeof body === 'object' && !Array.isArray(body) ? body : {}
  const { question: rawQuestion, context: rawContext } = record as Record<string, unknown>

  if (typeof rawQuestion !== 'string') {
    return { ok: false, error: 'Invalid or missing question. Must be a string.' }
  }
  const question = rawQuestion.trim()
  if (!question) {
    return { ok: false, error: 'Invalid or missing question. Must not be empty.' }
  }
  if (Buffer.byteLength(question, 'utf8') > MAX_QUESTION_BYTES) {
    return { ok: false, error: `Invalid question. Must be at most ${MAX_QUESTION_BYTES} bytes.` }
  }

  // null/absent context means "none" (the Python brain accepts the same).
  if (rawContext != null && typeof rawContext !== 'string') {
    return { ok: false, error: 'Invalid context. Must be a string.' }
  }
  // Trim, then cap by code point (not UTF-16 unit) so an astral character is
  // never split and this agrees with the Python brain's `strip()[:2000]`.
  const trimmed = (rawContext ?? '').trim()
  const context =
    trimmed.length > MAX_CONTEXT_CHARS
      ? Array.from(trimmed).slice(0, MAX_CONTEXT_CHARS).join('')
      : trimmed

  return { ok: true, question, context }
}

/** The user turn. The system prompt is byte-stable, so nothing is interpolated into it. */
function buildUserMessage(question: string, context: string): string {
  return context
    ? `Context:\n${context}\n\nQuestion:\n${question}\n\n${REPLY_LIMIT_INSTRUCTION}`
    : `Question:\n${question}\n\n${REPLY_LIMIT_INSTRUCTION}`
}

/** Collapse whitespace to single spaces — the Oracle UI shows one paragraph. */
function cleanAnswer(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim()
}

// ─── Provider chain ──────────────────────────────────────────────────────────

interface OracleLink {
  provider: 'anthropic' | 'groq' | 'gemini' | 'openai'
  /** The exact model id sent (the Gateway catalog id when the Gateway is on). */
  model: string
  make: () => LanguageModel
}

const TIER_ORDER = ['free', 'cheap_fast', 'primary', 'reflective'] as const
type OracleTier = (typeof TIER_ORDER)[number]

function parseTier(raw: string | undefined, fallback: OracleTier): OracleTier {
  const tier = (raw ?? '').trim().toLowerCase()
  return (TIER_ORDER as readonly string[]).includes(tier) ? (tier as OracleTier) : fallback
}

/**
 * Same rule as backend/main.py:_resolve_tier(None): HISTORICAL_AGENT_DEFAULT_TIER
 * (default `free`) clamped to HISTORICAL_AGENT_MAX_TIER (default `primary`).
 * There is deliberately no per-request tier: this route is public, so a caller
 * must not be able to pick a paid model.
 */
function resolveOracleTier(): OracleTier {
  const tier = parseTier(process.env.HISTORICAL_AGENT_DEFAULT_TIER, 'free')
  const ceiling = parseTier(process.env.HISTORICAL_AGENT_MAX_TIER, 'primary')
  return TIER_ORDER.indexOf(tier) > TIER_ORDER.indexOf(ceiling) ? ceiling : tier
}

/**
 * Providers this route can use, in order. Free chain by default (CLAUDE.md:
 * Anthropic credits are reserved for development); Anthropic leads only when the
 * deploy's tier is paid. A link is present when the Vercel AI Gateway is on, or
 * when its own direct key is set. Model ids come from lib/models/registry.
 */
function buildChain(): OracleLink[] {
  const links: OracleLink[] = []
  const tier = resolveOracleTier()

  if (tier !== 'free' && (isGatewayEnabled || process.env.ANTHROPIC_API_KEY)) {
    // Oracle replies are <=120 words, so `reflective` (Opus) is clamped to the
    // Sonnet model, which is also the only one the registry has a Gateway id for.
    const cheap = tier === 'cheap_fast'
    const model = isGatewayEnabled
      ? cheap
        ? GATEWAY_MODELS.CLAUDE_HAIKU_4_5
        : GATEWAY_MODELS.CLAUDE_SONNET_4_6
      : cheap
        ? HISTORICAL_AGENT_TIERS.CHEAP_FAST.model
        : HISTORICAL_AGENT_TIERS.PRIMARY.model
    links.push({
      provider: 'anthropic',
      model,
      make: () => gatewayAnthropic(model) as unknown as LanguageModel,
    })
  }

  if (isGatewayEnabled || process.env.GROQ_API_KEY) {
    const model = isGatewayEnabled ? GATEWAY_MODELS.LLAMA_70B : GROQ.LLAMA_70B
    links.push({
      provider: 'groq',
      model,
      make: () => gatewayGroq(model) as unknown as LanguageModel,
    })
  }

  // gateway.ts builds the direct Gemini client from GOOGLE_GENERATIVE_AI_API_KEY
  // only, so that is the one direct key worth gating on.
  if (isGatewayEnabled || process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
    const model = isGatewayEnabled ? `google/${GEMINI.FLASH_20}` : GEMINI.FLASH_20
    links.push({
      provider: 'gemini',
      model,
      make: () => gatewayGoogle(model) as unknown as LanguageModel,
    })
  }

  // Paid last-ditch, the same position it holds in the Python chain.
  if (isGatewayEnabled || process.env.OPENAI_API_KEY) {
    const model = isGatewayEnabled ? `openai/${OPENAI.GPT_5_4_MINI}` : OPENAI.GPT_5_4_MINI
    links.push({
      provider: 'openai',
      model,
      make: () => gatewayOpenAI(model) as unknown as LanguageModel,
    })
  }

  return links
}

class OracleDeadlineError extends Error {
  override name = 'OracleDeadlineError'
}

/**
 * Run `work` for at most `ms`. On expiry the signal is aborted AND the race is
 * settled, so the route answers on time even if a provider SDK ignores the abort.
 */
async function withDeadline<T>(work: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController()
  let timer: ReturnType<typeof setTimeout> | undefined
  const expiry = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort()
      reject(new OracleDeadlineError('deadline'))
    }, ms)
  })
  const pending = work(controller.signal)
  pending.catch(() => {}) // a late rejection after the race is lost is not unhandled
  try {
    return await Promise.race([pending, expiry])
  } finally {
    clearTimeout(timer)
  }
}

/** Log-safe failure label. Never the message: SDK errors can embed the prompt. */
function failureKind(error: unknown): string {
  if (error instanceof Error) {
    const status = (error as { statusCode?: unknown }).statusCode
    return typeof status === 'number' ? `${error.name}:${status}` : error.name
  }
  return 'unknown'
}

interface OracleAnswer {
  answer: string
  provider: OracleLink['provider']
  model: string
}

async function askOracle(question: string, context: string): Promise<OracleAnswer | null> {
  const links = buildChain()
  if (links.length === 0) {
    console.warn('[oracle] oracle_unavailable reason=no_provider_keys')
    return null
  }

  const userMessage = buildUserMessage(question, context)
  const started = Date.now()

  for (const link of links) {
    const remaining = ORACLE_DEADLINE_MS - (Date.now() - started)
    if (remaining <= 0) {
      console.warn(`[oracle] oracle_unavailable reason=deadline ms=${ORACLE_DEADLINE_MS}`)
      return null
    }
    try {
      const text = await withDeadline(
        async signal => {
          const result = await generateText({
            model: link.make(),
            system: ORACLE_SYSTEM_PROMPT,
            prompt: userMessage,
            maxOutputTokens: MAX_OUTPUT_TOKENS,
            maxRetries: 0, // the chain is the retry; an SDK retry would eat the budget
            abortSignal: signal,
          })
          return result.text
        },
        Math.min(PROVIDER_TIMEOUT_MS, remaining)
      )

      const answer = cleanAnswer(text)
      if (answer) {
        console.log(
          `[oracle] oracle_answered provider=${link.provider} model=${link.model} ` +
            `latency_ms=${Date.now() - started} chars=${answer.length}`
        )
        return { answer, provider: link.provider, model: link.model }
      }
      console.warn(`[oracle] fallback_event provider=${link.provider} reason=empty_answer`)
    } catch (error) {
      console.warn(`[oracle] fallback_event provider=${link.provider} reason=${failureKind(error)}`)
    }
  }

  console.warn('[oracle] oracle_unavailable reason=no_answer')
  return null
}

// ─── Route ───────────────────────────────────────────────────────────────────

/**
 * POST /api/agents/oracle
 *
 * The Vercel FALLBACK brain for the Pentacles Oracle. The feeder
 * (feeder/oracle-service.ts) posts here only after the primary brain
 * (api.agents.alchm.kitchen, backend/oracle_brain.py) has not answered. The two
 * brains share one persona (lib/agents/oracle-persona.ts / oracle_persona.py),
 * one user-turn layout and one response shape, so a player cannot tell which
 * answered.
 *
 * Request:  { question: string (trimmed, 1..500 UTF-8 bytes), context?: string }
 * Response: 200 { answer, provider, model, timestamp }
 * Errors:   400 { success: false, error } bad question/context
 *           503 { success: false, error } no provider answered in time
 *
 * There is deliberately NO stub answer. The feeder treats any non-2xx as "try the
 * next brain" but would publish a 200 body to the player as the Oracle's reply.
 */
export async function POST(request: NextRequest) {
  try {
    const denied = gate(request)
    if (denied) return denied

    const body: unknown = await request.json().catch(() => null)
    const parsed = parseOracleRequest(body)
    if (!parsed.ok) {
      return NextResponse.json(
        { success: false, error: parsed.error },
        { status: 400, headers: RESPONSE_HEADERS }
      )
    }

    const result = await askOracle(parsed.question, parsed.context)
    if (!result) {
      return NextResponse.json(
        { success: false, error: UNAVAILABLE_ERROR },
        { status: 503, headers: RESPONSE_HEADERS }
      )
    }

    return NextResponse.json(
      {
        answer: result.answer,
        provider: result.provider,
        model: result.model,
        timestamp: new Date().toISOString(),
      },
      { headers: RESPONSE_HEADERS }
    )
  } catch (error) {
    console.error(`[oracle] Error handling oracle question: ${failureKind(error)}`)
    return NextResponse.json(
      { success: false, error: 'Internal server error.' },
      { status: 500, headers: RESPONSE_HEADERS }
    )
  }
}
