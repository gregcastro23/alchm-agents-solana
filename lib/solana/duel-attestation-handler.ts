import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { extractDesktopApiKey, authenticateDesktopApiKey } from '@/lib/security/desktop-auth'
import { getSpacetimeConfig } from '@/lib/spacetime/config'
import { decodeSqlResult, identityHex, type Transport } from '@/lib/vessel/spacetime-stats'
import { ASOL_SOLANA_PROGRAM_ID, getReceiptAddress } from '@/lib/solana/esms'
import {
  computeDuelReceiptId,
  computeDuelLedgerReference,
  resolvePillarId,
} from '@/lib/solana/duel-attestation'

function getSpacetimeEndpoint(): { base: string; db: string } | null {
  const cfg = getSpacetimeConfig()
  if (!cfg) return null
  const base = cfg.uri
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/+$/, '')
  return { base, db: cfg.moduleName }
}

async function runSql(query: string, transport: Transport = fetch): Promise<Record<string, any>[]> {
  const target = getSpacetimeEndpoint()
  if (!target) throw new Error('SpacetimeDB not configured')
  const res = await transport(`${target.base}/v1/database/${target.db}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal: AbortSignal.timeout(6_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 120)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return decodeSqlResult(await res.json())
}

export async function handleDuelAttestation(
  req: Request,
  customTransport?: Transport
): Promise<Response> {
  // 1. Authentication: session or verified desktop API key
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

  // 2. Strict body validation: { duelId: string } only
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 })
  }

  const keys = Object.keys(body)
  if (keys.length !== 1 || !('duelId' in body)) {
    return NextResponse.json(
      { error: 'Extra body fields rejected. Request must strictly contain { duelId } only.' },
      { status: 400 }
    )
  }

  const rawDuelId = body.duelId
  if (typeof rawDuelId !== 'string' || !/^\d+$/.test(rawDuelId.trim())) {
    return NextResponse.json(
      { error: 'duelId must be a valid u64 decimal string' },
      { status: 400 }
    )
  }
  const duelIdStr = rawDuelId.trim()
  const duelIdBig = BigInt(duelIdStr)

  // 3. Caller verified Solana wallet check
  const verifiedRecord = await prisma.verifiedSolanaWallet.findUnique({
    where: { userId },
    select: { solanaPubKey: true },
  })
  const callerWallet = verifiedRecord?.solanaPubKey ?? null
  if (!callerWallet) {
    return NextResponse.json(
      { error: 'No verified Solana wallet linked to account', code: 'no_wallet' },
      { status: 403 }
    )
  }

  // 4. Load duel from SpacetimeDB
  const transport = customTransport ?? fetch
  let duelRows: Record<string, any>[]
  try {
    duelRows = await runSql(
      `SELECT duel_id, initiator, target_player, target_agent, sky, opening_pillar, opening_power_ratio, state, winner_is_initiator, created_at, updated_at FROM pillar_duel WHERE duel_id = ${duelIdStr}`,
      transport
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: `Arena database unreachable or paused: ${(err as Error).message}`,
        code: 'arena_unreachable',
      },
      { status: 503 }
    )
  }

  const duel = duelRows?.[0]
  if (!duel) {
    return NextResponse.json({ error: 'Duel not found', code: 'duel_not_found' }, { status: 404 })
  }

  // 5. Verify duel state: must be Resolved, winner_is_initiator not null, and target_player present
  const stateStr = typeof duel.state === 'string' ? duel.state : (duel.state?.name ?? '')
  if (stateStr !== 'Resolved') {
    return NextResponse.json(
      { error: 'Duel is not in resolved state', code: 'duel_not_resolved' },
      { status: 409 }
    )
  }
  if (duel.winner_is_initiator === null || duel.winner_is_initiator === undefined) {
    return NextResponse.json(
      { error: 'Duel winner not determined', code: 'duel_not_resolved' },
      { status: 409 }
    )
  }
  if (!duel.target_player || duel.target_agent !== null) {
    return NextResponse.json(
      {
        error: 'Agent duels are not eligible for duel attestation',
        code: 'agent_duel_not_eligible',
      },
      { status: 422 }
    )
  }

  // 6. Winner -> wallet verification
  const winnerIsInitiator = Boolean(duel.winner_is_initiator)
  const winnerIdentity = identityHex(winnerIsInitiator ? duel.initiator : duel.target_player)
  const opponentIdentity =
    identityHex(winnerIsInitiator ? duel.target_player : duel.initiator) ?? '0'.repeat(64)
  if (!winnerIdentity) {
    return NextResponse.json({ error: 'Invalid winner identity in duel record' }, { status: 422 })
  }

  let winnerWalletRows: Record<string, any>[] = []
  try {
    winnerWalletRows = await runSql(
      `SELECT solana_pubkey FROM verified_solana_wallet WHERE identity = 0x${winnerIdentity}`,
      transport
    )
  } catch (err) {
    return NextResponse.json(
      {
        error: `Failed to verify winner wallet: ${(err as Error).message}`,
        code: 'arena_unreachable',
      },
      { status: 503 }
    )
  }

  const winnerWallet = winnerWalletRows?.[0]?.solana_pubkey
  if (!winnerWallet || winnerWallet !== callerWallet) {
    return NextResponse.json(
      { error: 'Caller is not the verified winner of this duel', code: 'caller_not_winner' },
      { status: 403 }
    )
  }

  // 7. Canonical receipt & ledger reference derivation (F3: fail closed if missing or invalid)
  const dbIdentity = process.env.SPACETIMEDB_IDENTITY?.trim()
  if (!dbIdentity || !/^[0-9a-fA-F]{64}$/.test(dbIdentity)) {
    return NextResponse.json(
      {
        error: 'SpacetimeDB identity misconfigured (SPACETIMEDB_IDENTITY must be a 64-hex string)',
        code: 'arena_misconfigured',
      },
      { status: 503 }
    )
  }

  const createdAtMicros = BigInt(
    duel.created_at?.__timestamp_micros_since_unix_epoch__ ?? duel.created_at ?? 0
  )
  const resolvedAtMicros = BigInt(
    duel.updated_at?.__timestamp_micros_since_unix_epoch__ ?? duel.updated_at ?? createdAtMicros
  )
  const openingPillar = resolvePillarId(duel.opening_pillar)
  const powerRatio = typeof duel.opening_power_ratio === 'number' ? duel.opening_power_ratio : 1.0
  const powerRatioBps = Math.round(powerRatio * 10_000)

  const duelReceiptId = computeDuelReceiptId(dbIdentity, duelIdBig, createdAtMicros)
  const receiptAddress = getReceiptAddress('claim', duelReceiptId, ASOL_SOLANA_PROGRAM_ID)
  const ledgerReferenceHash = computeDuelLedgerReference({
    receiptId: duelReceiptId,
    winnerWallet: callerWallet,
    opponentIdentity,
    openingPillar,
    powerRatioBps,
    resolvedAtMicros,
  })

  const receiptIdHex = Buffer.from(duelReceiptId).toString('hex')

  // Duel verification complete. Duel wins earn pentacles off-chain in SpacetimeDB;
  // no ESMS is minted directly by this route.
  return NextResponse.json(
    {
      ok: true,
      verified: true,
      receiptId: receiptIdHex,
      receiptAddress: receiptAddress.toBase58(),
      ledgerReferenceHash: Buffer.from(ledgerReferenceHash).toString('hex'),
    },
    { status: 200 }
  )
}
