import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'
import { loadAlchmSyncConfig } from '@/lib/alchmSyncConfig'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest) {
  try {
    // 1. Authenticate as Admin
    const admin = await requireAdmin()
    if (!admin.ok) return adminErrorResponse(admin)

    // 2. Fetch all local users
    const localUsers = await prisma.users.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        lastLogin: true,
        alchmKitchenUserId: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // 3. Load WTEN sync configuration
    let baseUrl = ''
    let secret = ''
    let configLoaded = false
    try {
      const config = loadAlchmSyncConfig()
      baseUrl = config.baseUrl
      secret = config.secret
      configLoaded = true
    } catch (err) {
      console.warn('[shared-users] Sync configuration not set in environment:', err)
    }

    // 4. Query WTEN backend for shared accounts
    let sharedEmailsSet = new Set<string>()
    let degraded = false

    if (configLoaded && baseUrl && secret) {
      try {
        const emails = localUsers.map(u => u.email)
        const response = await fetch(`${baseUrl}/api/internal/users/check-shared`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Sync-Secret': secret,
          },
          body: JSON.stringify({ emails }),
          signal: AbortSignal.timeout(5000), // 5s timeout safety
        })

        if (response.ok) {
          const data = (await response.json()) as { success?: boolean; sharedEmails?: string[] }
          if (data.success && Array.isArray(data.sharedEmails)) {
            sharedEmailsSet = new Set(data.sharedEmails.map(e => e.toLowerCase()))
          }
        } else {
          console.error(`[shared-users] WTEN API returned status ${response.status}`)
          degraded = true
        }
      } catch (err) {
        console.error('[shared-users] Failed to reach WTEN backend:', err)
        degraded = true
      }
    } else {
      degraded = true
    }

    // 5. Build merged user profiles
    const users = localUsers.map(user => {
      const hasWtenAccount = sharedEmailsSet.has(user.email.toLowerCase())
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        alchmKitchenUserId: user.alchmKitchenUserId,
        hasBothAccounts: hasWtenAccount,
      }
    })

    const sharedCount = users.filter(u => u.hasBothAccounts).length

    return NextResponse.json({
      success: true,
      degraded,
      summary: {
        totalLocalUsers: users.length,
        sharedUsersCount: sharedCount,
        onlyLocalUsersCount: users.length - sharedCount,
      },
      users,
    })
  } catch (error) {
    console.error('[shared-users] Main error:', error)
    return NextResponse.json(
      { success: false, message: 'Failed to process shared users coordination' },
      { status: 500 }
    )
  }
}
