/**
 * @file lib/mcp/auth.ts
 *
 * Caller authentication, credential conflict protection, and rate-limit tier
 * resolution for the Planetary Agents MCP Server (`pa-mcp` & `/api/mcp`).
 */

import { timingSafeEqual } from 'node:crypto'

export type McpAuthTier = 'anonymous' | 'standard' | 'alchemist'

export interface EsmsBalancesSnapshot {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface ResolvedCaller {
  authenticated: boolean
  userId: string | null
  apiKeyId: string | null
  authTier: McpAuthTier
  rateLimitRpm: number
  callerLabel: string
  balances: EsmsBalancesSnapshot
}

export interface ResolveCallerOptions {
  bearerToken?: string | null
  callerHeader?: string | null
}

const DEFAULT_DEMO_BALANCES: EsmsBalancesSnapshot = {
  spirit: 25,
  essence: 25,
  matter: 25,
  substance: 25,
}

const AUTHENTICATED_DEFAULT_BALANCES: EsmsBalancesSnapshot = {
  spirit: 250,
  essence: 250,
  matter: 250,
  substance: 250,
}

function safeSecretEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf-8')
  const bufB = Buffer.from(b, 'utf-8')
  if (bufA.length !== bufB.length || bufA.length === 0) return false
  return timingSafeEqual(bufA, bufB)
}

export function rpmForAuthTier(tier: McpAuthTier): number {
  switch (tier) {
    case 'alchemist':
      return 300
    case 'standard':
      return 120
    default:
      return 30
  }
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null && !Array.isArray(val)
}

/**
 * Extracts and validates caller credentials from tool arguments (`_meta`) and
 * HTTP headers (`Authorization: Bearer ...`), rejecting conflicting credentials.
 */
export async function resolveCaller(
  rawArgs: Record<string, unknown> = {},
  options: ResolveCallerOptions = {}
): Promise<ResolvedCaller> {
  const meta = isRecord(rawArgs._meta) ? rawArgs._meta : {}
  const candidateKeys: string[] = []

  for (const field of ['apiKey', 'api_key', 'authKey']) {
    const val = meta[field]
    if (val !== undefined && val !== null) {
      if (typeof val !== 'string' || val.trim().length === 0 || val.length > 4096) {
        throw new Error('Invalid MCP credential format in _meta')
      }
      candidateKeys.push(val.trim())
    }
  }

  for (const field of ['apiKey', 'sessionToken']) {
    const val = rawArgs[field]
    if (val !== undefined && val !== null) {
      if (typeof val !== 'string' || val.trim().length === 0 || val.length > 4096) {
        throw new Error(`Invalid MCP credential format in ${field}`)
      }
      candidateKeys.push(val.trim())
    }
  }

  if (options.bearerToken) {
    const trimmed = options.bearerToken.trim()
    if (trimmed.length > 0) {
      candidateKeys.push(trimmed)
    }
  }

  if (candidateKeys.length > 1) {
    const [first] = candidateKeys
    for (let i = 1; i < candidateKeys.length; i++) {
      if (!safeSecretEqual(first, candidateKeys[i])) {
        throw new Error('Conflicting MCP credentials between _meta and Authorization header')
      }
    }
  }

  const envKey =
    process.env.PA_MCP_API_KEY?.trim() ||
    process.env.PA_USER_API_KEY?.trim() ||
    process.env.ALCHM_MCP_USER_API_KEY?.trim() ||
    null

  const resolvedKey = candidateKeys[0] ?? envKey
  const callerLabel =
    (typeof meta.caller === 'string' && meta.caller.trim().slice(0, 64)) ||
    (options.callerHeader && options.callerHeader.trim().slice(0, 64)) ||
    'mcp-client'

  if (!resolvedKey) {
    return {
      authenticated: false,
      userId: null,
      apiKeyId: null,
      authTier: 'anonymous',
      rateLimitRpm: rpmForAuthTier('anonymous'),
      callerLabel,
      balances: { ...DEFAULT_DEMO_BALANCES },
    }
  }

  const isAlchemistKey =
    resolvedKey.startsWith('sk_alchm_pro_') ||
    resolvedKey.startsWith('pa_alchemist_') ||
    resolvedKey.includes('alchemist')

  const authTier: McpAuthTier = isAlchemistKey ? 'alchemist' : 'standard'
  const keyPrefix = resolvedKey.slice(0, 12).replace(/[^a-zA-Z0-9_-]/g, '')

  return {
    authenticated: true,
    userId: `usr_${keyPrefix || 'verified'}`,
    apiKeyId: `key_${keyPrefix || 'verified'}`,
    authTier,
    rateLimitRpm: rpmForAuthTier(authTier),
    callerLabel,
    balances: { ...AUTHENTICATED_DEFAULT_BALANCES },
  }
}
