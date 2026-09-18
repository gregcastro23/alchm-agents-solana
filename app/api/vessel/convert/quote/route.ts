import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { extractDesktopApiKey, authenticateDesktopApiKey } from '@/lib/security/desktop-auth'
import { prisma } from '@/lib/db'
import { createConversionQuote } from '@/lib/pentacles/service'
import { ESMS_ELEMENTS, type ConversionDirection, type EsmsElement } from '@/lib/pentacles/rate'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request): Promise<Response> {
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

  // 2. Parse and validate body
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { direction, element, amountAtoms } = body ?? {}

  if (direction !== 'pentacles_to_esms' && direction !== 'esms_to_pentacles') {
    return NextResponse.json(
      { error: 'direction must be "pentacles_to_esms" or "esms_to_pentacles"' },
      { status: 400 }
    )
  }

  const el = String(element || '').toLowerCase() as EsmsElement
  if (!ESMS_ELEMENTS.includes(el)) {
    return NextResponse.json(
      { error: 'element must be spirit, essence, matter, or substance' },
      { status: 400 }
    )
  }

  let atoms: bigint
  try {
    atoms = BigInt(String(amountAtoms || '0'))
    if (atoms <= 0n) throw new Error()
  } catch {
    return NextResponse.json(
      { error: 'amountAtoms must be a positive integer decimal string' },
      { status: 400 }
    )
  }

  // 3. Generate Quote
  const result = await createConversionQuote({
    userId,
    direction: direction as ConversionDirection,
    element: el,
    amountAtoms: atoms,
  })

  if (!result.ok) {
    return NextResponse.json(
      { error: result.message, code: result.code },
      { status: result.status }
    )
  }

  return NextResponse.json(
    {
      ok: true,
      quote: result.quote,
      quoteToken: result.quoteToken,
    },
    { status: 200 }
  )
}
