import { Connection, PublicKey } from '@solana/web3.js'
import { getAssociatedTokenAddressSync } from '@solana/spl-token'
import { ESMS_DEVNET_MINTS, TOKEN_2022_PROGRAM_ID } from '@/lib/solana/esms'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'
/**
 * Assembles the Alchm Vessel for one already-authenticated user from its four
 * read-only sources. Authentication and the wallet-ownership check live in
 * app/api/vessel/summary/route.ts; nothing here trusts caller-supplied ids.
 *
 *   kitchenLedger — alchm.kitchen GET /api/economy/vessel (authoritative ESMS)
 *   agentsArena   — this repo's AgentJingDuel rows + VerifiedSolanaWallet
 *   spacetimedb   — Pentacles public tables, linked via the verified wallet
 *   priceIndex    — the Kitchen canonical price index USD redeem rail
 */

import { prisma } from '@/lib/db'
import { loadCanonicalPriceIndex } from '@/lib/economy/canonical-price-index'
import { loadAlchmSyncConfig } from '@/lib/alchmSyncConfig'
import {
  EMPTY_ESMS,
  VESSEL_CONTRACT_VERSION,
  quantizeEsms,
  type AlchmVesselState,
  type EsmsTuple,
  type VesselClash,
  type VesselLedgerEntry,
  type VesselSourceKey,
  type VesselSourceStatus,
  type VesselStreamKey,
} from './contract'
import { loadPentaclesVesselStats, type PentaclesVesselStats } from './spacetime-stats'

/** The alchm.kitchen /api/economy/vessel payload this module consumes. */
export interface KitchenVesselLedger {
  success: true
  version: number
  generatedAt: string
  balances: { spirit: number; essence: number; matter: number; substance: number }
  streakDays: number
  streams: Record<
    VesselStreamKey,
    { esms: EsmsTuple; entries: number; lastAt: string | null; sourceTypes: string[] }
  >
  quests: { achievementsUnlocked: number; questsCompleted: number; rewardsClaimed: number } | null
  recent: VesselLedgerEntry[]
}

export interface AgentsArenaStats {
  duelsRecorded: number
  recentClashes: VesselClash[]
}

export interface VesselInputs {
  walletAddress: string | null
  kitchen: KitchenVesselLedger | null
  agents: AgentsArenaStats | null
  pentacles: PentaclesVesselStats | null
  usdRail: { perTokenUsd: number; source: string | null } | null
  onchain?: {
    cluster: 'devnet' | 'mainnet-beta'
    wallet: string
    atoms: [string, string, string, string]
    slot: number
  } | null
  sources: Record<VesselSourceKey, VesselSourceStatus>
  now?: number
}

function isKitchenLedger(value: unknown): value is KitchenVesselLedger {
  const v = value as KitchenVesselLedger
  return Boolean(
    v &&
    v.success === true &&
    v.balances &&
    v.streams &&
    ['jingDuels', 'staking', 'pentaclesMelee', 'kitchenAchievements'].every(k =>
      Array.isArray(v.streams[k as VesselStreamKey]?.esms)
    )
  )
}

function streamEsms(kitchen: KitchenVesselLedger | null, key: VesselStreamKey): EsmsTuple {
  const esms = kitchen?.streams[key]?.esms
  return esms ? (esms.map(v => quantizeEsms(Number(v))) as EsmsTuple) : [...EMPTY_ESMS]
}

/** Pure fold of source reads into the Vessel contract. Unit tested. */
export function assembleVesselState(inputs: VesselInputs): AlchmVesselState {
  const { kitchen, agents, pentacles, usdRail } = inputs
  const balances = {
    spirit: quantizeEsms(kitchen?.balances.spirit ?? 0),
    essence: quantizeEsms(kitchen?.balances.essence ?? 0),
    matter: quantizeEsms(kitchen?.balances.matter ?? 0),
    substance: quantizeEsms(kitchen?.balances.substance ?? 0),
  }
  const totalTokens = balances.spirit + balances.essence + balances.matter + balances.substance

  const clashes = [...(agents?.recentClashes ?? []), ...(pentacles?.recentClashes ?? [])]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 10)

  return {
    version: VESSEL_CONTRACT_VERSION,
    walletAddress: inputs.walletAddress,
    spacetimeIdentity: pentacles?.identity ?? null,
    lastSyncedAt: inputs.now ?? Date.now(),
    balances: {
      ...balances,
      // Only meaningful with a real ledger read and a published USD rail.
      totalUsdEquivalent:
        kitchen && usdRail ? Math.round(totalTokens * usdRail.perTokenUsd * 100) / 100 : null,
      usdRail,
    },
    streams: {
      jingDuels: {
        ledgerEsms: streamEsms(kitchen, 'jingDuels'),
        ledgerEntries: kitchen?.streams.jingDuels.entries ?? 0,
        agentDuelsRecorded: agents?.duelsRecorded ?? null,
        arenaWins: pentacles?.arenaWins ?? null,
        arenaResolved: pentacles?.arenaResolved ?? null,
        recentClashes: clashes,
      },
      staking: {
        ledgerEsms: streamEsms(kitchen, 'staking'),
        ledgerEntries: kitchen?.streams.staking.entries ?? 0,
        streakDays: kitchen ? kitchen.streakDays : null,
        starVaultAccrued: null,
      },
      pentaclesMelee: {
        ledgerEsms: streamEsms(kitchen, 'pentaclesMelee'),
        ledgerEntries: kitchen?.streams.pentaclesMelee.entries ?? 0,
        arenaTokens: pentacles?.arenaTokens ?? null,
        wordWins: pentacles?.wordWins ?? null,
        pillarPool: pentacles?.pillarPool ?? null,
      },
      kitchenAchievements: {
        ledgerEsms: streamEsms(kitchen, 'kitchenAchievements'),
        ledgerEntries: kitchen?.streams.kitchenAchievements.entries ?? 0,
        achievementsUnlocked: kitchen?.quests?.achievementsUnlocked ?? null,
        questsCompleted: kitchen?.quests?.questsCompleted ?? null,
      },
    },
    ledger: kitchen?.recent ?? [],
    onchain: inputs.onchain ?? null,
    sources: inputs.sources,
  }
}

// ── Source readers ──────────────────────────────────────────────────────────

const KITCHEN_BASE = () =>
  (
    process.env.ALCHM_KITCHEN_SYNC_URL ||
    process.env.ALCHM_KITCHEN_API_BASE_URL ||
    'https://alchm.kitchen'
  ).replace(/\/$/, '')

/**
 * Session callers forward their shared `.alchm.kitchen` cookie first (the
 * Kitchen resolves its own session); server callers — and cookie misses with a
 * known email — use the shared sync secret, exactly like /api/economy/balances.
 */
async function loadKitchenLedger(opts: {
  cookie: string | null
  email: string | null
}): Promise<KitchenVesselLedger> {
  let response: Response | null = null
  if (opts.cookie) {
    response = await fetch(`${KITCHEN_BASE()}/api/economy/vessel`, {
      headers: { Cookie: opts.cookie, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000),
    })
  }
  if ((!response || response.status === 401) && opts.email) {
    const { baseUrl, secret } = loadAlchmSyncConfig()
    response = await fetch(
      `${baseUrl}/api/economy/vessel?email=${encodeURIComponent(opts.email)}`,
      {
        headers: { 'X-Sync-Secret': secret, Accept: 'application/json' },
        cache: 'no-store',
        signal: AbortSignal.timeout(8_000),
      }
    )
  }
  if (!response) throw new Error('no kitchen credentials')
  if (!response.ok) throw new Error(`alchm.kitchen returned HTTP ${response.status}`)
  const body = await response.json()
  if (!isKitchenLedger(body)) throw new Error('alchm.kitchen vessel contract mismatch')
  return body
}

async function loadAgentsArena(userId: string): Promise<AgentsArenaStats> {
  const [duelsRecorded, recent] = await Promise.all([
    prisma.agentJingDuel.count({ where: { userId } }),
    prisma.agentJingDuel.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, casterId: true, targetId: true, stance: true, createdAt: true },
    }),
  ])
  return {
    duelsRecorded,
    // Agents Jing rounds record stance and agents, not a winner.
    recentClashes: recent.map(d => ({
      duelId: `agents:${d.id}`,
      source: 'agents' as const,
      kind: `Jing · ${d.stance}`,
      opponent: `${d.casterId} vs ${d.targetId}`,
      won: null,
      timestamp: d.createdAt.getTime(),
    })),
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function loadOnchainBalances(walletAddress: string): Promise<{
  cluster: 'devnet' | 'mainnet-beta'
  wallet: string
  atoms: [string, string, string, string]
  slot: number
} | null> {
  const walletPubkey = new PublicKey(walletAddress)
  const networkConfig = getSolanaNetworkConfig()
  const rpcUrl = networkConfig.rpcUrls[0] || 'https://api.devnet.solana.com'
  const connection = new Connection(rpcUrl, 'confirmed')
  const cluster = networkConfig.network === 'mainnet-beta' ? 'mainnet-beta' : 'devnet'

  const mints = [
    ESMS_DEVNET_MINTS.Spirit,
    ESMS_DEVNET_MINTS.Essence,
    ESMS_DEVNET_MINTS.Matter,
    ESMS_DEVNET_MINTS.Substance,
  ]

  const { context } = await connection.getLatestBlockhashAndContext()
  const slot = context.slot

  const atoms: [string, string, string, string] = ['0', '0', '0', '0']

  await Promise.all(
    mints.map(async (mint, idx) => {
      try {
        const ata = getAssociatedTokenAddressSync(mint, walletPubkey, false, TOKEN_2022_PROGRAM_ID)
        const bal = await connection.getTokenAccountBalance(ata)
        atoms[idx] = bal.value.amount
      } catch {
        atoms[idx] = '0'
      }
    })
  )

  return {
    cluster,
    wallet: walletAddress,
    atoms,
    slot,
  }
}

export async function loadVesselForUser(opts: {
  userId: string
  email: string | null
  cookie: string | null
  walletAddress: string | null
}): Promise<AlchmVesselState> {
  const sources: Record<VesselSourceKey, VesselSourceStatus> = {
    kitchenLedger: { ok: false },
    agentsArena: { ok: false },
    spacetimedb: { ok: false },
    priceIndex: { ok: false },
    onchain: { ok: false },
  }

  const track = <T>(key: VesselSourceKey, promise: Promise<T>): Promise<T | null> =>
    promise.then(
      value => {
        sources[key] = { ok: true }
        return value
      },
      error => {
        sources[key] = { ok: false, detail: describe(error) }
        return null
      }
    )

  const [kitchen, agents, pentacles, priceIndex, onchain] = await Promise.all([
    track('kitchenLedger', loadKitchenLedger({ cookie: opts.cookie, email: opts.email })),
    track('agentsArena', loadAgentsArena(opts.userId)),
    opts.walletAddress
      ? track('spacetimedb', loadPentaclesVesselStats(opts.walletAddress))
      : Promise.resolve(null),
    track('priceIndex', loadCanonicalPriceIndex()),
    opts.walletAddress
      ? track('onchain', loadOnchainBalances(opts.walletAddress))
      : Promise.resolve(null),
  ])

  if (!opts.walletAddress) {
    sources.spacetimedb = { ok: false, detail: 'no verified Solana wallet' }
    sources.onchain = { ok: false, detail: 'no verified Solana wallet' }
  } else if (sources.spacetimedb.ok && !pentacles) {
    sources.spacetimedb = { ok: false, detail: 'no Pentacles identity bound to this wallet' }
  } else if (pentacles?.unavailable.length) {
    sources.spacetimedb = { ok: true, detail: `partial — ${pentacles.unavailable.join('; ')}` }
  }

  const redeem = priceIndex?.railsUsd.redeemPerTokenUsd ?? null
  if (priceIndex && redeem === null) {
    sources.priceIndex = { ok: true, detail: 'no USD redeem rail published' }
  }

  return assembleVesselState({
    walletAddress: opts.walletAddress,
    kitchen,
    agents,
    pentacles,
    usdRail:
      redeem !== null
        ? { perTokenUsd: redeem, source: priceIndex?.railsUsd.redeemSource ?? null }
        : null,
    onchain,
    sources,
  })
}
