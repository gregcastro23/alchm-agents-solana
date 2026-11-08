/**
 * @file lib/mcp/httpSecurity.ts
 *
 * Security controls for Meta Muse connectors and the Planetary Agents MCP HTTP gateway:
 * 1. Strict Host header and Origin validation (DNS rebinding / cache poisoning defenses).
 * 2. Origin-bounded CORS policy for platform.muse.ai, meta.ai, agents.alchm.kitchen, and alchm.kitchen.
 * 3. Token & credential redaction for error logs and diagnostic telemetry.
 * 4. Input sanitization for string arrays and agent parameters.
 */

export const CANONICAL_ORIGIN = 'https://agents.alchm.kitchen'
export const MAX_BODY_BYTES = 256 * 1024

const TRUSTED_HOSTS = new Set([
  'agents.alchm.kitchen',
  'api.agents.alchm.kitchen',
  'alchm.kitchen',
  'www.alchm.kitchen',
  'whattoeatnext.com',
  'www.whattoeatnext.com',
])

const TRUSTED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/(.*\.)?alchm\.kitchen$/,
  /^https:\/\/(.*\.)?whattoeatnext\.com$/,
  /^https:\/\/(.*\.)?muse\.ai$/,
  /^https:\/\/(.*\.)?meta\.ai$/,
  /^https:\/\/(.*\.)?google\.com$/,
  /^https:\/\/(.*\.)?claude\.ai$/,
  /^https:\/\/(.*\.)?chatgpt\.com$/,
  /^https:\/\/(.*\.)?openai\.com$/,
  /^https:\/\/(.*\.)?modelcontextprotocol\.io$/,
  /^https:\/\/(.*\.)?smithery\.ai$/,
  /^https:\/\/(.*\.)?glama\.ai$/,
]

export function isLocalDevHost(host: string): boolean {
  if (process.env.NODE_ENV === 'production') return false
  const clean = host.toLowerCase().trim()
  return (
    clean.startsWith('localhost') || clean.startsWith('127.0.0.1') || clean.endsWith('.vercel.app')
  )
}

export function isTrustedHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false
  const [host] = hostHeader.toLowerCase().trim().split(':')
  if (!host) return false
  if (TRUSTED_HOSTS.has(host)) return true
  return isLocalDevHost(host)
}

export function getTrustedOrigin(req: Request): string {
  const url = new URL(req.url)
  const forwardedHost = req.headers.get('x-forwarded-host')
  const hostHeader = req.headers.get('host')
  const hostCandidate = (forwardedHost ?? hostHeader ?? url.host).split(',')[0]?.trim() ?? ''

  if (isTrustedHost(hostCandidate)) {
    const isLocal = isLocalDevHost(hostCandidate)
    const forwardedProto = req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
    const proto = isLocal ? (forwardedProto ?? url.protocol.replace(':', '')) : 'https'
    return `${proto}://${hostCandidate}`
  }

  return CANONICAL_ORIGIN
}

export function isTrustedOrigin(originHeader: string | null): boolean {
  if (!originHeader || originHeader === '*') return false
  try {
    const parsed = new URL(originHeader)
    const host = parsed.host.toLowerCase()
    if (isLocalDevHost(host)) return true
    return TRUSTED_ORIGIN_PATTERNS.some(pattern => pattern.test(originHeader))
  } catch {
    return false
  }
}

export function resolveCorsOrigin(req: Request): string {
  const origin = req.headers.get('origin')
  if (!origin) return '*' // Non-browser / server-to-server calls (stdio, curl, autonomous agent runtime)
  if (isTrustedOrigin(origin)) return origin
  return CANONICAL_ORIGIN
}

export function buildCorsHeaders(req: Request): Headers {
  const headers = new Headers()
  const allowedOrigin = resolveCorsOrigin(req)
  headers.set('Access-Control-Allow-Origin', allowedOrigin)
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
  headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Accept, Authorization, Idempotency-Key, X-Idempotency-Key, X-Correlation-ID, X-Request-ID, Mcp-Session-Id, MCP-Protocol-Version, User-Agent'
  )
  headers.set(
    'Access-Control-Expose-Headers',
    'Content-Type, Mcp-Session-Id, X-Correlation-ID, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining'
  )
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Vary', 'Origin, Host, Accept')
  return headers
}

export function redactSensitiveString(val: string): string {
  return val
    .replace(/sk_alchm_[a-zA-Z0-9_-]+/g, 'sk_alchm_***[REDACTED]')
    .replace(/pa_(?:live|test|key)_[a-zA-Z0-9_-]+/g, 'pa_***[REDACTED]')
    .replace(/Bearer\s+[A-Za-z0-9_.~-]+/gi, 'Bearer [REDACTED]')
    .replace(
      /((?:api_?key|auth_?key|password|secret|token))[:=]\s*["']?[^"',\s}]+/gi,
      '$1=[REDACTED]'
    )
}

export function sanitizeSecurityString(raw: unknown, maxLen = 64): string {
  if (typeof raw !== 'string') return ''
  const filtered: string[] = []
  for (let i = 0; i < raw.length; i++) {
    const code = raw.charCodeAt(i)
    const ch = raw.charAt(i)
    if (code >= 32 && code !== 127 && ch !== '<' && ch !== '>') {
      filtered.push(ch)
    }
  }
  return filtered.join('').trim().slice(0, maxLen)
}

export function sanitizeSecurityStringArray(raw: unknown, maxItems = 30, maxLen = 64): string[] {
  if (!Array.isArray(raw)) return []
  const result: string[] = []
  for (const item of raw) {
    if (result.length >= maxItems) break
    const sanitized = sanitizeSecurityString(item, maxLen)
    if (sanitized.length > 0) {
      result.push(sanitized)
    }
  }
  return result
}

export const isAllowedMcpOrigin = isTrustedOrigin
export const sanitizeHeaderInput = sanitizeSecurityString

export function buildMcpCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !isTrustedOrigin(origin)) {
    return {}
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers':
      'Content-Type, Accept, Authorization, Idempotency-Key, X-Idempotency-Key, X-Correlation-ID, X-Request-ID, Mcp-Session-Id, MCP-Protocol-Version, User-Agent',
    'Access-Control-Expose-Headers':
      'Content-Type, Mcp-Session-Id, X-Correlation-ID, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Host, Accept',
  }
}

export function buildDiscoveryCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('origin')
  if (!origin || !isTrustedOrigin(origin)) {
    return {
      Vary: 'Origin, Host',
    }
  }
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin, Host',
  }
}
