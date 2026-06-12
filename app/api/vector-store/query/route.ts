/**
 * Vector Store Query Endpoint — gated by USE_RAG_GENERATION feature flag.
 */
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

function disabledResponse() {
  return NextResponse.json(
    { status: 'disabled', message: 'RAG features disabled. Set USE_RAG_GENERATION=true.' },
    { status: 503 }
  )
}

export async function POST(req: NextRequest) {
  if (process.env.USE_RAG_GENERATION !== 'true') return disabledResponse()
  const { semanticSearch } = await import('@/lib/llamaindex')
  try {
    const body = await req.json().catch(() => ({}))
    const result = await semanticSearch(body.query || '', body.options || {})
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  if (process.env.USE_RAG_GENERATION !== 'true') return disabledResponse()
  const { semanticSearch } = await import('@/lib/llamaindex')
  try {
    const url = new URL(req.url)
    const result = await semanticSearch(url.searchParams.get('query') || '', {})
    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err?.message }, { status: 500 })
  }
}
