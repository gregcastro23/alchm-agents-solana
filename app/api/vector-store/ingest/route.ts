/**
 * Vector Store Ingestion Endpoint — gated by USE_RAG_GENERATION feature flag.
 * Use the standalone CLI script for batch ingestion when RAG is off:
 *   yarn rag:ingest
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 300 // 5 minutes for batch ingestion

export async function POST(req: NextRequest) {
  if (process.env.USE_RAG_GENERATION !== 'true') {
    return NextResponse.json(
      { status: 'disabled', message: 'RAG features disabled. Set USE_RAG_GENERATION=true.' },
      { status: 503 }
    )
  }
  const { ingestAgentKnowledge } = await import('@/lib/llamaindex')
  try {
    const body = await req.json().catch(() => ({}))
    const result = await ingestAgentKnowledge(body.options || {})
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
