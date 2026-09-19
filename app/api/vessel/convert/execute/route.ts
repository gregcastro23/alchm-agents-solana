import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { extractDesktopApiKey, authenticateDesktopApiKey } from '@/lib/security/desktop-auth'
import { prisma } from '@/lib/db'
import { executeConversionQuote } from '@/lib/pentacles/service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request): Promise<Response> {
  // 0. Feature Kill-Switch
  if (process.env.FEATURE_PENTACLE_CONVERT !== 'true') {
    return NextResponse.json(
      {
        error: 'Pentacle conversion is currently disabled pending ecosystem upgrade',
        code: 'pentacle_conversion_disabled',
      },
      { status: 503 }
    )
  }

  // 1. Auth: session or desktop API key
  let userId: string
  const desktopKey = extractDesktopApiKey(req)
  if (desktopKey) {
    const desktop = await authenticateDesktopApiKey(desktopKey)
    if (desktop.status !== 'verified') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const user = await prisma.users.findUnique({
      where: { id: desktop.userId },
      select: { id: true },
    })
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    userId = user.id
  } else {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = session.user.id
  }

  // 2. Parse body: { quoteToken: string }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { quoteToken } = body ?? {}
  if (!quoteToken || typeof quoteToken !== 'string') {
    return NextResponse.json({ error: 'quoteToken is required' }, { status: 400 })
  }

  // 3. Execute conversion
  const result = await executeConversionQuote(quoteToken, userId)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      settled: true,
      quoteId: result.quoteId,
      outAmountAtoms: result.outAmountAtoms,
      direction: result.direction,
    },
    { status: 200 }
  )
}
