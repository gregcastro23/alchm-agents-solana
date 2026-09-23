import { NextResponse } from 'next/server'

import { prisma } from '@/lib/db'
import { hasInternalApiSecret } from '@/lib/security/internal-auth'
import { collectSolanaOperationalHealth } from '@/lib/solana/health'
import { SOLANA_HEALTH_SCHEMA_VERSION } from '@/lib/solana/health-contract'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * Solana worker health, read by WTEN's /admin/chain with
 * `Authorization: Bearer $INTERNAL_API_SECRET` (compared in constant time by
 * hasInternalApiSecret). 200 = healthy, 503 = degraded or failed, both with a
 * JSON body; 401 = the secret was not accepted. The body's shape is pinned in
 * lib/solana/health-contract.ts.
 *
 * `no-store`: vercel.json gives every /api/* response `s-maxage=60`, and a
 * CDN-cached copy of an authorized body must never be served to anyone else.
 */
const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET(request: Request) {
  if (!hasInternalApiSecret(request)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }
  try {
    const health = await collectSolanaOperationalHealth(prisma)
    return NextResponse.json(
      { schemaVersion: SOLANA_HEALTH_SCHEMA_VERSION, ...health },
      { status: health.status === 'healthy' ? 200 : 503, headers: NO_STORE }
    )
  } catch (error) {
    return NextResponse.json(
      {
        schemaVersion: SOLANA_HEALTH_SCHEMA_VERSION,
        status: 'unhealthy',
        cluster: 'devnet',
        checkedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Solana health check failed',
      },
      { status: 503, headers: NO_STORE }
    )
  }
}
