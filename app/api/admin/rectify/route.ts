import { NextResponse, type NextRequest } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { requireAdminRequest } from '@/lib/security/privileged-api-auth'
import {
  buildRectificationReport,
  executeRectificationAction,
  RectifyMutationSchema,
} from '@/lib/admin/rectification'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const admin = await requireAdmin()
  if (!admin.ok) return adminErrorResponse(admin)

  const sp = req.nextUrl.searchParams
  const scoreAll = sp.get('score') === 'all'
  const scoreAgentId = sp.get('agentId')
  const rawStep = Number(sp.get('stepMinutes') ?? '5')
  const stepMinutes = Number.isFinite(rawStep) ? Math.max(1, Math.min(10, Math.round(rawStep))) : 5

  const report = await buildRectificationReport({
    scoreAll,
    scoreAgentId,
    stepMinutes,
  })
  return NextResponse.json(report)
}

export async function POST(req: NextRequest) {
  const access = await requireAdminRequest(req)
  if (!access.ok) return access.response

  let rawBody: unknown
  try {
    rawBody = await req.json()
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = RectifyMutationSchema.safeParse(rawBody)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    return NextResponse.json(
      {
        success: false,
        error: `Validation failed (${issue?.path.join('.') || 'body'}: ${issue?.message ?? 'invalid input'})`,
      },
      { status: 400 }
    )
  }

  try {
    const result = await executeRectificationAction(parsed.data, access.admin)
    return NextResponse.json(result.body, { status: result.status })
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    )
  }
}
