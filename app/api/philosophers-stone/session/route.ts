import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import galileoLogger, { logQuantitiesToGalileo } from '@/lib/galileo-logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Minimal session persistence using UserSession

export async function POST(req: Request) {
  try {
    const { userId = 'guest', personalityId = 'stone', snapshot } = await req.json()
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    const created = await prisma.userSession.create({
      data: {
        userId,
        personalityId,
        sessionData: snapshot,
        expiresAt,
      },
    })
    // lightweight trace for session persistence
    try {
      const sessionName = `ps-session-${userId}-${personalityId}`
      const sessionId = galileoLogger.startSession(sessionName, { userId, personalityId })
      const traceId = galileoLogger.startTrace('persist-session', { record_id: created.id })
      const spanId = galileoLogger.startSpan('save-session', 'tool', {
        payload_keys: Object.keys(snapshot || {}),
      })
      galileoLogger.endSpan(spanId, { ok: true, id: created.id }, 'success')
      galileoLogger.endTrace()
      await galileoLogger.endSession()
    } catch (e) {
      // Galileo tracing is best-effort; the session row is already persisted.
      console.debug('[ps-session] galileo trace failed (non-fatal)', e)
    }

    return NextResponse.json({ id: created.id })
  } catch (error) {
    console.error('Session POST error:', error)
    return NextResponse.json({ error: 'Failed to save session' }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || 'guest'
    const personalityId = searchParams.get('personalityId') || 'stone'
    const last = await prisma.userSession.findFirst({
      where: { userId, personalityId },
      orderBy: { lastActive: 'desc' },
    })
    return NextResponse.json({ session: last })
  } catch (error) {
    console.error('Session GET error:', error)
    return NextResponse.json({ error: 'Failed to load session' }, { status: 500 })
  }
}
