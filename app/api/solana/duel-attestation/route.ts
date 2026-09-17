import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { authenticateDesktopApiKey, extractDesktopApiKey } from '@/lib/security/desktop-auth'
import { getSpacetimeConfig } from '@/lib/spacetime/config'
import { decodeSqlResult, identityHex, type Transport } from '@/lib/vessel/spacetime-stats'
import { ASOL_SOLANA_PROGRAM_ID, getReceiptAddress } from '@/lib/solana/esms'
import { mintEsmsClaimSolana, getSolanaClaimSettlementProof } from '@/lib/solana/solana-minter'
import {
  computeDuelReceiptId,
  computeDuelLedgerReference,
  DUEL_WIN_REWARD,
  DUEL_WIN_DAILY_CAP,
} from '@/lib/solana/duel-attestation'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

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
      { error: 'Agent duels are not rewarded with on-chain ESMS', code: 'agent_duel_not_rewarded' },
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

  // 7. Canonical receipt & ledger reference derivation
  const dbIdentity = process.env.SPACETIMEDB_IDENTITY || '0'.repeat(64)
  const createdAtMicros = BigInt(
    duel.created_at?.__timestamp_micros_since_unix_epoch__ ?? duel.created_at ?? 0
  )
  const resolvedAtMicros = BigInt(
    duel.updated_at?.__timestamp_micros_since_unix_epoch__ ?? duel.updated_at ?? createdAtMicros
  )
  const openingPillar = typeof duel.opening_pillar === 'number' ? duel.opening_pillar : 1
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

  // 8. Pre-check: Idempotency / Already settled claim
  try {
    const proof = await getSolanaClaimSettlementProof(Buffer.from(duelReceiptId).toString('hex'))
    if (proof.settled) {
      return NextResponse.json(
        {
          ok: true,
          settled: true,
          txHash: proof.txHash,
          receiptId: Buffer.from(duelReceiptId).toString('hex'),
          receiptAddress: receiptAddress.toBase58(),
          ledgerReferenceHash: Buffer.from(ledgerReferenceHash).toString('hex'),
        },
        { status: 200 }
      )
    }
  } catch {
    // Continue if proof pre-check failover passes to mint path
  }

  // 9. Daily Cap Enforcement
  const utcDayStart = new Date()
  utcDayStart.setUTCHours(0, 0, 0, 0)
  const claimsToday = await prisma.tokenTransaction.count({
    where: {
      userId,
      sourceType: 'pillar_duel_win',
      tokenType: 'Spirit',
      createdAt: { gte: utcDayStart },
    },
  })

  if (claimsToday >= DUEL_WIN_DAILY_CAP) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Daily duel reward cap reached',
        code: 'daily_cap_reached',
        capped: true,
        claimsToday,
        dailyCap: DUEL_WIN_DAILY_CAP,
      },
      { status: 429 }
    )
  }

  // 10. Mint on-chain via claim_mint_esms
  let txHash: string
  try {
    txHash = await mintEsmsClaimSolana({
      recipient: callerWallet,
      claimId: Buffer.from(duelReceiptId).toString('hex'),
      amounts: DUEL_WIN_REWARD,
    })
  } catch (mintErr) {
    // Re-check settlement proof in case of network timeout after transaction landing
    const proof = await getSolanaClaimSettlementProof(
      Buffer.from(duelReceiptId).toString('hex')
    ).catch(() => ({ settled: false as const }))
    if (proof.settled) {
      txHash = proof.txHash
    } else {
      return NextResponse.json(
        {
          error: `Solana on-chain claim mint failed: ${(mintErr as Error).message}`,
          code: 'mint_failed',
        },
        { status: 502 }
      )
    }
  }

  // Track transaction in Prisma for daily cap counting
  await prisma.tokenTransaction
    .create({
      data: {
        userId,
        transactionGroupId: txHash,
        tokenType: 'Spirit',
        amount: 0.1 as any,
        sourceType: 'pillar_duel_win',
        sourceId: duelIdStr,
        description: `14-Pillars Duel Win #${duelIdStr}`,
        idempotencyKey: `pillar_duel:${duelIdStr}`,
        createdAt: new Date(),
      },
    })
    .catch(() => {})

  return NextResponse.json(
    {
      ok: true,
      settled: true,
      txHash,
      receiptId: Buffer.from(duelReceiptId).toString('hex'),
      receiptAddress: receiptAddress.toBase58(),
      ledgerReferenceHash: Buffer.from(ledgerReferenceHash).toString('hex'),
      reward: DUEL_WIN_REWARD,
      claimsToday: claimsToday + 1,
      dailyCap: DUEL_WIN_DAILY_CAP,
    },
    { status: 200 }
  )
}

export async function POST(req: Request): Promise<Response> {
  return handleDuelAttestation(req)
}
