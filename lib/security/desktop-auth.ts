import 'server-only'

import { prisma } from '@/lib/db'
import { safeEqual } from '@/lib/security/secure-compare'

export const DEV_DESKTOP_API_KEY = process.env.DESKTOP_DEV_API_KEY || 'dev-desktop-token'

export type DesktopAuthResult =
  | { status: 'verified'; userId: string; token: string; keyRecordId: string }
  | { status: 'unlinked-dev'; token: string }
  | { status: 'invalid'; error: string }
  | { status: 'none' }

/**
 * Extracts a desktop API key from either the `x-api-key` header or
 * the `Authorization: Bearer <key>` header.
 */
export function extractDesktopApiKey(req: Request): string | null {
  const xApiKey = req.headers.get('x-api-key')
  if (xApiKey && xApiKey.trim()) {
    return xApiKey.trim()
  }

  const authHeader = req.headers.get('Authorization') || req.headers.get('authorization')
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }

  return null
}

/**
 * Validates a desktop token against the database or detects the unlinked dev token.
 */
export async function authenticateDesktopApiKey(
  token: string | null | undefined
): Promise<DesktopAuthResult> {
  if (!token) {
    return { status: 'none' }
  }

  const trimmed = token.trim()
  if (!trimmed) {
    return { status: 'none' }
  }

  if (safeEqual(trimmed, DEV_DESKTOP_API_KEY) || trimmed === 'dev-desktop-token') {
    return { status: 'unlinked-dev', token: trimmed }
  }

  try {
    const apiKeyRecord = await prisma.desktopApiKey.findFirst({
      where: {
        token: trimmed,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    })

    if (!apiKeyRecord) {
      return { status: 'invalid', error: 'Invalid or expired desktop API key' }
    }

    // Update lastUsedAt asynchronously
    prisma.desktopApiKey
      .update({
        where: { id: apiKeyRecord.id },
        data: { lastUsedAt: new Date() },
      })
      .catch(err => console.error('Failed to update desktop key lastUsedAt:', err))

    return {
      status: 'verified',
      userId: apiKeyRecord.userId,
      token: trimmed,
      keyRecordId: apiKeyRecord.id,
    }
  } catch (err) {
    console.error('Failed to authenticate desktop token from database:', err)
    return { status: 'invalid', error: 'Database error during desktop authentication' }
  }
}
