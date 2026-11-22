/**
 * Structured classification and safe sanitization for PostgreSQL / Prisma errors.
 *
 * Keeps raw connection strings and credentials out of logs, health checks, and
 * admin UI badges while distinguishing quota exhaustion (PG 53000) and pooler
 * saturation (P2024 / 53300) from generic connection drops.
 */

export type DbFailureKind =
  | 'quota_exceeded'
  | 'pooler_saturated'
  | 'unreachable'
  | 'missing_table'
  | 'query_error'

export interface ClassifiedDbError {
  kind: DbFailureKind
  isUnavailable: boolean
  summary: string
  remediation: string
}

/** Strip URLs/passwords so connection strings never leak into API responses or logs. */
export function sanitizeDbMessage(raw: string): string {
  return raw
    .replace(/postgres(?:ql)?(?:\+[a-z0-9_+-]+)?:\/\/[^\s"'`]+/gi, '[redacted-dsn]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 260)
}

function errorText(error: unknown): { name: string; code: string; message: string } {
  if (!error || typeof error !== 'object') {
    return { name: typeof error, code: '', message: String(error ?? '') }
  }
  const obj = error as {
    name?: unknown
    code?: unknown
    message?: unknown
    meta?: { code?: unknown }
  }
  return {
    name: typeof obj.name === 'string' ? obj.name : 'Error',
    code:
      typeof obj.code === 'string'
        ? obj.code
        : typeof obj.meta?.code === 'string'
          ? obj.meta.code
          : '',
    message: typeof obj.message === 'string' ? obj.message : String(error),
  }
}

export function classifyDbError(error: unknown): ClassifiedDbError {
  const { name, code, message } = errorText(error)
  const combined = `${name} ${code} ${message}`

  if (
    code === '53000' ||
    /exceeded the quota|quota.*exceeded|compute time quota|project size limit/i.test(combined)
  ) {
    return {
      kind: 'quota_exceeded',
      isUnavailable: true,
      summary: 'Database quota exceeded (PG 53000)',
      remediation:
        'Raise limits or upgrade the Neon plan on console.neon.tech, or migrate DATABASE_URL/DIRECT_URL to Railway PostgreSQL.',
    }
  }

  if (
    code === 'P2024' ||
    code === '53300' ||
    /too many clients|max_client_conn|connection pool.*timed out|pooler.*saturated/i.test(combined)
  ) {
    return {
      kind: 'pooler_saturated',
      isUnavailable: true,
      summary: `Database connection pool saturated (${code || '53300'})`,
      remediation:
        'Ensure DATABASE_URL includes ?pgbouncer=true&connection_limit=1 and reduce concurrent admin/rating fan-outs.',
    }
  }

  if (
    name === 'PrismaClientInitializationError' ||
    code === 'P1001' ||
    code === 'P1002' ||
    code === 'P1017' ||
    /Can't reach database server|Can’t reach database server|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|Connection terminated|socket hang up/i.test(
      combined
    )
  ) {
    return {
      kind: 'unreachable',
      isUnavailable: true,
      summary: `Database unreachable (${code || name}): ${sanitizeDbMessage(message)}`,
      remediation:
        'Verify database host availability and Neon quota status (Neon PG 53000 quota exhaustion often surfaces via Prisma as "Can\'t reach database server").',
    }
  }

  if (code === 'P2021' || code === '42P01' || /relation .* does not exist/i.test(combined)) {
    return {
      kind: 'missing_table',
      isUnavailable: false,
      summary: `Missing database relation (${code || '42P01'}): ${sanitizeDbMessage(message)}`,
      remediation: 'Run `bunx prisma db push` or apply pending migrations to this environment.',
    }
  }

  return {
    kind: 'query_error',
    isUnavailable: false,
    summary: sanitizeDbMessage(message) || `${name} (${code || 'unknown'})`,
    remediation: 'Inspect server logs and verify database schema parity.',
  }
}

export function isDatabaseUnavailableError(error: unknown): boolean {
  return classifyDbError(error).isUnavailable
}
