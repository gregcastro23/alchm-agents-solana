import jwt from 'jsonwebtoken'
import type { Request, Response, NextFunction } from 'express'

/**
 * Secrets that are public in this repository, so a token signed with one is forgeable by
 * anyone: this file's old fallback, and the placeholder ARCHITECTURE_AUDIT_2026-06-01.md
 * recorded on Railway. They count as unset.
 */
const PUBLIC_PLACEHOLDER_SECRETS = new Set([
  'your-secret',
  'your-production-jwt-secret-change-this',
])

/**
 * The secret tokens are verified against, or null when there is no usable one. Read on
 * every call so the startup check and the middleware cannot disagree.
 */
export function getJwtSecret(): string | null {
  const secret = process.env.JWT_SECRET
  if (!secret?.trim() || PUBLIC_PLACEHOLDER_SECRETS.has(secret.trim())) return null
  return secret
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/health') return next()

  // Fail closed: with no usable secret there is nothing to verify a token against, and
  // falling back to a default would accept tokens anyone can sign. validateAuthConfig
  // (utils/startup-validation.ts) logs the cause once at startup.
  const secret = getJwtSecret()
  if (!secret) {
    return res.status(503).json({ error: 'Authentication is not configured' })
  }

  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, secret) as any
    ;(req as any).user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
