/**
 * Vector Store Ingestion Endpoint — gated by USE_RAG_GENERATION feature flag.
 * Use the standalone CLI script for batch ingestion when RAG is off:
 *   yarn rag:ingest
 */
import { NextRequest, NextResponse } from 'next/server'
import { recordAdminAction } from '@/lib/admin/audit'
import { requireAdminOrService, toAdminAuditActor } from '@/lib/security/privileged-api-auth'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch ingestion

export async function POST(req: NextRequest) {
  const access = await requireAdminOrService(req)
  if (!access.ok) return access.response

  if (process.env.USE_RAG_GENERATION !== 'true') {
    return NextResponse.json(
      { status: 'disabled', message: 'RAG features disabled. Set USE_RAG_GENERATION=true.' },
      { status: 503 }
    )
  }
  try {
    const body = await req.json().catch(() => ({}))
    const audit = await recordAdminAction(toAdminAuditActor(access), {
      action: 'rag.vector-store.ingest.requested',
      targetType: 'vector_store',
      targetId: 'agent_knowledge',
      after: { requested: true },
    })
    if (!audit.recorded) {
      return NextResponse.json(
        { success: false, error: `Mandatory audit write failed: ${audit.reason}` },
        { status: 503 }
      )
    }

    const { ingestAgentKnowledge } = await import('@/lib/llamaindex')
    const result = await ingestAgentKnowledge(body.options || {})
    return NextResponse.json({ ...result, audit })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
