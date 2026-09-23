import 'server-only'

import { Connection, PublicKey } from '@solana/web3.js'
import devnetManifest from '@/deployments/solana-devnet.json'
import governanceManifest from '@/deployments/solana-devnet-governance.json'
import auditManifest from '@/deployments/solana-devnet-audit-receipt.json'
import mainnetManifest from '@/deployments/solana-mainnet.json'
import type { AdminAlert } from '@/lib/admin/alerts'
import { readSection, type Section } from '@/lib/admin/section'
import { prisma } from '@/lib/db'
import { collectSolanaOperationalHealth } from '@/lib/solana/health'
import {
  CONSTELLATION_PAIRS,
  anchorAccountDiscriminator,
  decodeConstellationPool,
  getConstellationPoolAddress,
} from '@/lib/solana/constellation-amm'
import {
  PUBLIC_SOLANA_DEVNET_RPC,
  resolveSolanaRpcUrls,
  rpcEndpointLabel,
} from '@/lib/solana/rpc-failover'

/**
 * Solana & chain report for the admin page — ASOL owns this program, so it
 * goes deeper than WTEN's read-only view: every address in deployments/*.json
 * is checked against the chain, section by section. A section whose read fails
 * is `null` with a reason; it never reads as an empty or zero value.
 */

export type { Section }

export interface ChainAccount {
  data: Buffer
  owner: string
  executable: boolean
  lamports: number
}

/** The few RPC reads the report needs; production uses web3.js, tests a fake. */
export interface ChainReader {
  rpcLabel: string
  privateRpc: boolean
  getAccount(address: string): Promise<ChainAccount | null>
  getAccounts(addresses: string[]): Promise<Array<ChainAccount | null>>
  getTokenSupply(
    mint: string
  ): Promise<{ amount: string; decimals: number; uiAmount: number | null }>
  getBalanceLamports(address: string): Promise<number>
  /** Token accounts with a non-zero balance. Only attempted on a private RPC. */
  countHolders(mint: string, tokenProgram: string): Promise<number>
}

export interface ProgramConfigState {
  version: number
  admin: string
  attestor: string
  pauser: string
  pauseClaims: boolean
  pauseRedemptions: boolean
}

export interface WorkerView {
  connectionStatus: string
  queueDepth: number
  lastProcessedSlot: string | null
  lastError: string | null
  heartbeatAt: string | null
}

export interface ChecklistItem {
  id: string
  label: string
  state: 'pass' | 'fail' | 'unknown'
  evidence: string
}

export interface SolanaChainReport {
  generatedAt: string
  cluster: 'devnet'
  rpc: { label: string; private: boolean }
  program: Section<{
    programId: string
    executable: boolean
    lastDeploySlot: string | null
    upgradeAuthority: string | null
    authorityIsMultisigVault: boolean
  }>
  config: Section<ProgramConfigState & { address: string }>
  mints: Section<
    Array<{
      symbol: string
      address: string
      decimals: number
      supply: number | null
      holders: number | null
      holdersReason: string | null
    }>
  >
  pools: Section<
    Array<{
      poolId: number
      address: string
      exists: boolean
      pair: string
      reserveA: string | null
      reserveB: string | null
      totalShares: string | null
      bootstrapped: boolean | null
      paused: boolean | null
    }>
  >
  multisig: Section<{
    multisigPda: string
    vaultPda: string
    threshold: number
    members: Array<{ role: string; address: string }>
    accountExists: boolean
    vaultLamports: number
  }>
  deployer: Section<{ address: string; lamports: number; low: boolean; lowBelowSol: number }>
  /** Sync and bridge worker queues and heartbeats (lib/solana/health.ts). */
  workers: Section<{
    sync: WorkerView
    bridge: WorkerView
  }>
  readiness: ChecklistItem[]
  alerts: AdminAlert[]
}

export const DEPLOYER_LOW_SOL = Number(process.env.SOLANA_DEPLOYER_LOW_SOL ?? 2)
const LAMPORTS_PER_SOL = 1_000_000_000
const RPC_TIMEOUT_MS = 8_000
const ELEMENTS = ['Spirit', 'Essence', 'Matter', 'Substance'] as const

const section = readSection

function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(`${label} timed out after ${RPC_TIMEOUT_MS}ms`)),
        RPC_TIMEOUT_MS
      )
    }),
  ]).finally(() => timer && clearTimeout(timer))
}

export function web3Reader(url: string): ChainReader {
  const conn = new Connection(url, 'confirmed')
  const toAccount = (a: Awaited<ReturnType<Connection['getAccountInfo']>>): ChainAccount | null =>
    a
      ? {
          data: Buffer.from(a.data),
          owner: a.owner.toBase58(),
          executable: a.executable,
          lamports: a.lamports,
        }
      : null
  return {
    rpcLabel: rpcEndpointLabel(url),
    privateRpc: url !== PUBLIC_SOLANA_DEVNET_RPC && !url.includes('api.devnet.solana.com'),
    getAccount: async address =>
      toAccount(await withTimeout(conn.getAccountInfo(new PublicKey(address)), 'getAccountInfo')),
    getAccounts: async addresses =>
      (
        await withTimeout(
          conn.getMultipleAccountsInfo(addresses.map(a => new PublicKey(a))),
          'getMultipleAccountsInfo'
        )
      ).map(toAccount),
    getTokenSupply: async mint => {
      const { value } = await withTimeout(
        conn.getTokenSupply(new PublicKey(mint)),
        'getTokenSupply'
      )
      return { amount: value.amount, decimals: value.decimals, uiAmount: value.uiAmount }
    },
    getBalanceLamports: async address =>
      withTimeout(conn.getBalance(new PublicKey(address)), 'getBalance'),
    countHolders: async (mint, tokenProgram) => {
      const accounts = await withTimeout(
        conn.getProgramAccounts(new PublicKey(tokenProgram), {
          dataSlice: { offset: 64, length: 8 },
          filters: [{ memcmp: { offset: 0, bytes: mint } }],
        }),
        'getProgramAccounts'
      )
      return accounts.filter(a => Buffer.from(a.account.data).readBigUInt64LE(0) > 0n).length
    },
  }
}

// ---------------------------------------------------------------------------
// Decoders (layouts pinned by test/solana/wten-reads-contract.spec.ts)
// ---------------------------------------------------------------------------

export function decodeProgramConfig(data: Buffer): ProgramConfigState {
  if (
    data.length < 140 ||
    !data.subarray(0, 8).equals(anchorAccountDiscriminator('ProgramConfig'))
  ) {
    throw new Error('account is not a ProgramConfig')
  }
  const key = (start: number) => new PublicKey(data.subarray(start, start + 32)).toBase58()
  return {
    version: data.readUInt8(8),
    admin: key(9),
    attestor: key(41),
    pauser: key(73),
    pauseClaims: data.readUInt8(137) === 1,
    pauseRedemptions: data.readUInt8(138) === 1,
  }
}

/** BPF upgradeable loader ProgramData: u32 tag (3) | u64 slot | Option<Pubkey>. */
export function decodeProgramData(data: Buffer): { slot: string; upgradeAuthority: string | null } {
  if (data.length < 13 || data.readUInt32LE(0) !== 3) throw new Error('account is not ProgramData')
  const slot = data.readBigUInt64LE(4).toString()
  const hasAuthority = data.readUInt8(12) === 1
  return {
    slot,
    upgradeAuthority: hasAuthority ? new PublicKey(data.subarray(13, 45)).toBase58() : null,
  }
}

// ---------------------------------------------------------------------------

export async function buildSolanaChainReport(
  reader: ChainReader,
  mainnetReader: Pick<ChainReader, 'getAccount'> | null,
  readWorkers: () => Promise<{ sync: WorkerView; bridge: WorkerView }>,
  now: Date = new Date()
): Promise<SolanaChainReport> {
  const token2022 = String(mainnetManifest.token2022ProgramId)

  const [program, config, mints, pools, multisig, deployer, workers, mainnetProgram] =
    await Promise.all([
      section(async () => {
        const programAccount = await reader.getAccount(devnetManifest.programId)
        if (!programAccount) throw new Error('program account not found on devnet')
        const dataAccount = await reader.getAccount(devnetManifest.programDataAddress)
        const decoded = dataAccount ? decodeProgramData(dataAccount.data) : null
        return {
          programId: devnetManifest.programId,
          executable: programAccount.executable,
          lastDeploySlot: decoded?.slot ?? null,
          upgradeAuthority: decoded?.upgradeAuthority ?? null,
          authorityIsMultisigVault: decoded?.upgradeAuthority === governanceManifest.vaultPda,
        }
      }),
      section(async () => {
        const account = await reader.getAccount(devnetManifest.programConfigPda)
        if (!account) throw new Error('ProgramConfig account not found')
        return { address: devnetManifest.programConfigPda, ...decodeProgramConfig(account.data) }
      }),
      section(async () =>
        Promise.all(
          devnetManifest.mints.map(async mint => {
            const supply = await reader.getTokenSupply(mint.address)
            let holders: number | null = null
            let holdersReason: string | null = null
            if (!reader.privateRpc) {
              holdersReason = 'Needs a private RPC: the public devnet RPC rate-limits holder scans.'
            } else {
              try {
                holders = await reader.countHolders(mint.address, token2022)
              } catch (err) {
                holdersReason = err instanceof Error ? err.message.slice(0, 200) : String(err)
              }
            }
            return {
              symbol: mint.symbol,
              address: mint.address,
              decimals: mint.decimals,
              supply: supply.uiAmount,
              holders,
              holdersReason,
            }
          })
        )
      ),
      section(async () => {
        const addresses = CONSTELLATION_PAIRS.map((_, poolId) =>
          getConstellationPoolAddress(poolId).toBase58()
        )
        const accounts = await reader.getAccounts(addresses)
        return accounts.map((account, poolId) => {
          const [a, b] = CONSTELLATION_PAIRS[poolId]!
          const pair = `${ELEMENTS[a] ?? a} / ${ELEMENTS[b] ?? b}`
          if (!account) {
            return {
              poolId,
              address: addresses[poolId]!,
              exists: false,
              pair,
              reserveA: null,
              reserveB: null,
              totalShares: null,
              bootstrapped: null,
              paused: null,
            }
          }
          const pool = decodeConstellationPool(account.data)
          return {
            poolId,
            address: addresses[poolId]!,
            exists: true,
            pair,
            reserveA: pool.reserveA.toString(),
            reserveB: pool.reserveB.toString(),
            totalShares: pool.totalShares.toString(),
            bootstrapped: pool.bootstrapped,
            paused: pool.paused,
          }
        })
      }),
      section(async () => {
        const [account, vaultLamports] = await Promise.all([
          reader.getAccount(governanceManifest.multisigPda),
          reader.getBalanceLamports(governanceManifest.vaultPda),
        ])
        return {
          multisigPda: governanceManifest.multisigPda,
          vaultPda: governanceManifest.vaultPda,
          threshold: governanceManifest.threshold,
          members: governanceManifest.members.map(m => ({
            role: String(m.role),
            address: String(m.address),
          })),
          accountExists: account !== null,
          vaultLamports,
        }
      }),
      section(async () => {
        const lamports = await reader.getBalanceLamports(devnetManifest.deployer)
        return {
          address: devnetManifest.deployer,
          lamports,
          low: lamports < DEPLOYER_LOW_SOL * LAMPORTS_PER_SOL,
          lowBelowSol: DEPLOYER_LOW_SOL,
        }
      }),
      section(readWorkers),
      mainnetReader
        ? section(
            async () => (await mainnetReader.getAccount(String(mainnetManifest.programId))) !== null
          )
        : Promise.resolve<Section<boolean>>({ ok: false, reason: 'mainnet RPC not configured' }),
    ])

  const readiness = buildReadiness({ program, config, mints, pools, deployer, mainnetProgram, now })
  const report: Omit<SolanaChainReport, 'alerts'> = {
    generatedAt: now.toISOString(),
    cluster: 'devnet',
    rpc: { label: reader.rpcLabel, private: reader.privateRpc },
    program,
    config,
    mints,
    pools,
    multisig,
    deployer,
    workers,
    readiness,
  }
  return { ...report, alerts: chainAlerts(report) }
}

function buildReadiness(r: {
  program: SolanaChainReport['program']
  config: SolanaChainReport['config']
  mints: SolanaChainReport['mints']
  pools: SolanaChainReport['pools']
  deployer: SolanaChainReport['deployer']
  mainnetProgram: Section<boolean>
  now: Date
}): ChecklistItem[] {
  const fromChain = <T>(
    s: Section<T>,
    test: (v: T) => boolean,
    pass: (v: T) => string,
    fail: (v: T) => string
  ) =>
    s.ok
      ? {
          state: test(s.value) ? ('pass' as const) : ('fail' as const),
          evidence: test(s.value) ? pass(s.value) : fail(s.value),
        }
      : { state: 'unknown' as const, evidence: `Could not read the chain: ${s.reason}` }

  const auditAgeDays = Math.round(
    (r.now.getTime() - Date.parse(auditManifest.timestamp)) / 86_400_000
  )
  const drill = (governanceManifest as { lifecycleDrill?: Record<string, unknown> }).lifecycleDrill
  const drillExecuted = Boolean(
    drill && (drill.executeSignature || drill.status === 'executed' || drill.status === 'passed')
  )

  return [
    {
      id: 'devnet-program',
      label: 'Devnet program deployed and executable',
      ...fromChain(
        r.program,
        v => v.executable,
        v => `Executable; last deploy slot ${v.lastDeploySlot ?? 'unknown'}.`,
        () => 'Program account is not executable.'
      ),
    },
    {
      id: 'devnet-authority-multisig',
      label: 'Devnet upgrade authority is the Squads vault',
      ...fromChain(
        r.program,
        v => v.authorityIsMultisigVault,
        () => `Authority = vault ${governanceManifest.vaultPda}.`,
        v =>
          `Authority is ${v.upgradeAuthority ?? 'none (immutable)'}, not the vault ${governanceManifest.vaultPda}.`
      ),
    },
    {
      id: 'config-unpaused',
      label: 'ProgramConfig initialised and not paused',
      ...fromChain(
        r.config,
        v => !v.pauseClaims && !v.pauseRedemptions,
        () => 'Claims and redemptions open.',
        v =>
          `Paused: ${[v.pauseClaims && 'claims', v.pauseRedemptions && 'redemptions'].filter(Boolean).join(', ')}.`
      ),
    },
    {
      id: 'attestor-separate',
      label: 'Attestor key is separate from the admin key',
      ...fromChain(
        r.config,
        v => v.attestor !== v.admin,
        () => 'Distinct keys.',
        () => 'Admin and attestor are the same key.'
      ),
    },
    {
      id: 'mints-live',
      label: 'All ESMS mints live on devnet',
      ...fromChain(
        r.mints,
        v => v.length === 4 && v.every(m => m.supply !== null),
        v => `${v.length} mints, supply read for each.`,
        v => `${v.length} of 4 mints readable.`
      ),
    },
    {
      id: 'pools-bootstrapped',
      label: 'Every Constellation AMM pool bootstrapped',
      ...fromChain(
        r.pools,
        v => v.every(p => p.exists && p.bootstrapped),
        v => `${v.length} pools bootstrapped.`,
        v => `${v.filter(p => p.exists && p.bootstrapped).length} of ${v.length} bootstrapped.`
      ),
    },
    {
      id: 'audit-receipt',
      label: 'Latest devnet audit receipt passed',
      state:
        auditManifest.status === 'PASSED' && (auditManifest.errors?.length ?? 0) === 0
          ? 'pass'
          : 'fail',
      evidence: `Status ${auditManifest.status}, ${auditManifest.errors?.length ?? 0} errors, ${auditAgeDays} days old (deployments/solana-devnet-audit-receipt.json).`,
    },
    {
      id: 'governance-drill',
      label: 'Multisig lifecycle drill executed',
      state: drillExecuted ? 'pass' : drill ? 'unknown' : 'fail',
      evidence: drill
        ? drillExecuted
          ? 'Drill recorded as executed in deployments/solana-devnet-governance.json.'
          : 'A drill is recorded but not marked executed.'
        : 'No lifecycle drill recorded.',
    },
    {
      id: 'verifiable-build',
      label: 'Verifiable build recorded for mainnet',
      state: (mainnetManifest as { verifiableBuild?: unknown }).verifiableBuild ? 'pass' : 'fail',
      evidence: 'deployments/solana-mainnet.json verifiableBuild.',
    },
    {
      id: 'deployer-funded',
      label: `Deployer holds at least ${DEPLOYER_LOW_SOL} SOL`,
      ...fromChain(
        r.deployer,
        v => !v.low,
        v => `${(v.lamports / LAMPORTS_PER_SOL).toFixed(2)} SOL.`,
        v => `${(v.lamports / LAMPORTS_PER_SOL).toFixed(2)} SOL.`
      ),
    },
    {
      id: 'mainnet-program',
      label: 'Program deployed on mainnet-beta',
      ...(r.mainnetProgram.ok
        ? {
            state: r.mainnetProgram.value ? ('pass' as const) : ('fail' as const),
            evidence: r.mainnetProgram.value
              ? 'Program account exists on mainnet-beta.'
              : `Not deployed yet (manifest status "${mainnetManifest.status}").`,
          }
        : {
            state: 'unknown' as const,
            evidence: `Could not read mainnet: ${r.mainnetProgram.reason}`,
          }),
    },
    {
      id: 'mainnet-authority',
      label: 'Mainnet upgrade authority handed to the multisig',
      state: mainnetManifest.governance?.upgradeAuthorityTransferred ? 'pass' : 'fail',
      evidence: `deployments/solana-mainnet.json governance.upgradeAuthorityTransferred = ${String(mainnetManifest.governance?.upgradeAuthorityTransferred)}.`,
    },
  ]
}

function chainAlerts(r: Omit<SolanaChainReport, 'alerts'>): AdminAlert[] {
  const alerts: AdminAlert[] = []
  const unread = (
    ['program', 'config', 'mints', 'pools', 'multisig', 'deployer', 'workers'] as const
  ).filter(k => !r[k].ok)
  if (unread.length > 0) {
    alerts.push({
      id: 'solana:sections-unreadable',
      severity: 'warning',
      source: 'infrastructure',
      title: `Could not read ${unread.join(', ')} for the Solana report`,
      detail: unread.map(k => `${k}: ${(r[k] as { reason: string }).reason}`).join(' · '),
      href: '/admin/solana',
    })
  }
  if (r.config.ok && (r.config.value.pauseClaims || r.config.value.pauseRedemptions)) {
    alerts.push({
      id: 'solana:config-paused',
      severity: 'critical',
      source: 'economy',
      title: 'ESMS program is paused on devnet',
      detail: `pause_claims=${r.config.value.pauseClaims}, pause_redemptions=${r.config.value.pauseRedemptions}.`,
      href: '/admin/solana',
    })
  }
  if (r.deployer.ok && r.deployer.value.low) {
    alerts.push({
      id: 'solana:deployer-low',
      severity: 'warning',
      source: 'infrastructure',
      title: 'Deployer SOL balance is low',
      detail: `${(r.deployer.value.lamports / LAMPORTS_PER_SOL).toFixed(3)} SOL; upgrades need more than ${DEPLOYER_LOW_SOL} SOL.`,
      href: '/admin/solana',
    })
  }
  if (r.workers.ok) {
    for (const [name, w] of Object.entries(r.workers.value)) {
      if (w.connectionStatus === 'stopped') {
        alerts.push({
          id: `solana:worker-${name}-stopped`,
          severity: 'warning',
          source: 'infrastructure',
          title: `Solana ${name} worker is not reporting`,
          detail: `${w.lastError ?? 'No heartbeat'}; ${w.queueDepth} queued.`,
          href: '/admin/solana',
        })
      }
    }
  }
  if (r.pools.ok && r.pools.value.some(p => p.paused)) {
    alerts.push({
      id: 'solana:pool-paused',
      severity: 'warning',
      source: 'economy',
      title: 'An AMM pool is paused',
      detail: r.pools.value
        .filter(p => p.paused)
        .map(p => `pool ${p.poolId} (${p.pair})`)
        .join(', '),
      href: '/admin/solana',
    })
  }
  return alerts
}

export async function loadSolanaChainReport(): Promise<SolanaChainReport> {
  const [primary] = resolveSolanaRpcUrls()
  const mainnetUrl = process.env.SOLANA_MAINNET_RPC_URL || 'https://api.mainnet-beta.solana.com'
  return buildSolanaChainReport(
    web3Reader(primary ?? PUBLIC_SOLANA_DEVNET_RPC),
    web3Reader(mainnetUrl),
    async () => {
      const health = await collectSolanaOperationalHealth(prisma)
      const view = (w: typeof health.sync): WorkerView => ({
        connectionStatus: w.connectionStatus,
        queueDepth: w.queueDepth,
        lastProcessedSlot: w.lastProcessedSlot,
        lastError: w.lastError,
        heartbeatAt: w.heartbeatAt,
      })
      return { sync: view(health.sync), bridge: view(health.bridge) }
    }
  )
}
