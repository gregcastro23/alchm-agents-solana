// @vitest-environment node
/**
 * Solana & chain report: decoders over real layouts, independent sections,
 * and a readiness checklist that says "unknown" when the chain can't be read.
 * (The decoders were also run once against live devnet while building this.)
 */
import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'

import devnet from '@/deployments/solana-devnet.json'
import governance from '@/deployments/solana-devnet-governance.json'
import {
  buildSolanaChainReport,
  decodeProgramConfig,
  decodeProgramData,
  type ChainAccount,
  type ChainReader,
} from '@/lib/admin/solana-chain'
import { SolanaChainReportSchema } from '@/lib/admin/page-schemas'
import {
  CONSTELLATION_PAIRS,
  anchorAccountDiscriminator,
  getConstellationPoolAddress,
} from '@/lib/solana/constellation-amm'

const key = (s: string) => new PublicKey(s).toBuffer()
const acct = (data: Buffer, executable = false): ChainAccount => ({
  data,
  owner: '11111111111111111111111111111111',
  executable,
  lamports: 1,
})

function programData(authority: string | null, slot = 493_115_240n) {
  const b = Buffer.alloc(45)
  b.writeUInt32LE(3, 0)
  b.writeBigUInt64LE(slot, 4)
  if (authority) {
    b.writeUInt8(1, 12)
    key(authority).copy(b, 13)
  }
  return b
}

function programConfig(opts: { admin: string; attestor: string; pauseClaims?: boolean }) {
  const b = Buffer.alloc(140)
  anchorAccountDiscriminator('ProgramConfig').copy(b, 0)
  b.writeUInt8(1, 8)
  key(opts.admin).copy(b, 9)
  key(opts.attestor).copy(b, 41)
  key(opts.admin).copy(b, 73)
  b.writeUInt8(opts.pauseClaims ? 1 : 0, 137)
  return b
}

function pool(poolId: number, paused = false) {
  const b = Buffer.alloc(42)
  anchorAccountDiscriminator('ConstellationPool').copy(b, 0)
  const body = 8
  b.writeUInt8(1, body)
  b.writeUInt16LE(poolId, body + 1)
  b.writeUInt8(CONSTELLATION_PAIRS[poolId]![0], body + 3)
  b.writeUInt8(CONSTELLATION_PAIRS[poolId]![1], body + 4)
  b.writeUInt16LE(30, body + 5)
  b.writeBigUInt64LE(100_000_000n, body + 7)
  b.writeBigUInt64LE(100_000_000n, body + 15)
  b.writeBigUInt64LE(100_000_000n, body + 23)
  b.writeUInt8(1, body + 31)
  b.writeUInt8(paused ? 1 : 0, body + 32)
  return b
}

const ATTESTOR = governance.members[1]!.address

function reader(
  opts: {
    privateRpc?: boolean
    deployerLamports?: number
    pauseClaims?: boolean
    failPools?: boolean
  } = {}
): ChainReader {
  const accounts: Record<string, ChainAccount> = {
    [devnet.programId]: acct(Buffer.alloc(36), true),
    [devnet.programDataAddress]: acct(programData(governance.vaultPda)),
    [devnet.programConfigPda]: acct(
      programConfig({ admin: devnet.deployer, attestor: ATTESTOR, pauseClaims: opts.pauseClaims })
    ),
    [governance.multisigPda]: acct(Buffer.alloc(8)),
  }
  CONSTELLATION_PAIRS.forEach((_, id) => {
    accounts[getConstellationPoolAddress(id).toBase58()] = acct(pool(id, id === 2))
  })
  return {
    rpcLabel: 'test-rpc',
    privateRpc: opts.privateRpc ?? false,
    getAccount: async a => accounts[a] ?? null,
    getAccounts: async list => {
      if (opts.failPools) throw new Error('429 Too Many Requests')
      return list.map(a => accounts[a] ?? null)
    },
    getTokenSupply: async () => ({ amount: '12950010', decimals: 4, uiAmount: 1295.001 }),
    getBalanceLamports: async a =>
      a === devnet.deployer ? (opts.deployerLamports ?? 12_006_901_120) : 49_998_000,
    countHolders: async () => 17,
  }
}

const workers = async () => ({
  sync: {
    connectionStatus: 'connected',
    queueDepth: 0,
    lastProcessedSlot: '1',
    lastError: null,
    heartbeatAt: new Date().toISOString(),
  },
  bridge: {
    connectionStatus: 'stopped',
    queueDepth: 4,
    lastProcessedSlot: null,
    lastError: 'worker heartbeat is missing or stale',
    heartbeatAt: null,
  },
})

describe('decoders', () => {
  it('ProgramData and ProgramConfig', () => {
    expect(decodeProgramData(programData(governance.vaultPda))).toEqual({
      slot: '493115240',
      upgradeAuthority: governance.vaultPda,
    })
    expect(decodeProgramData(programData(null)).upgradeAuthority).toBeNull()
    const c = decodeProgramConfig(
      programConfig({ admin: devnet.deployer, attestor: ATTESTOR, pauseClaims: true })
    )
    expect(c).toMatchObject({
      admin: devnet.deployer,
      attestor: ATTESTOR,
      pauseClaims: true,
      pauseRedemptions: false,
    })
    expect(() => decodeProgramConfig(Buffer.alloc(140))).toThrow(/not a ProgramConfig/)
  })
})

describe('buildSolanaChainReport', () => {
  it('reads every section and validates against the client schema', async () => {
    const r = await buildSolanaChainReport(
      reader({ privateRpc: true }),
      { getAccount: async () => null },
      workers
    )
    expect(SolanaChainReportSchema.safeParse(JSON.parse(JSON.stringify(r))).success).toBe(true)
    expect(r.program).toMatchObject({
      ok: true,
      value: { authorityIsMultisigVault: true, lastDeploySlot: '493115240' },
    })
    expect(r.mints.ok && r.mints.value.every(m => m.holders === 17)).toBe(true)
    expect(r.pools.ok && r.pools.value).toHaveLength(CONSTELLATION_PAIRS.length)
    const state = Object.fromEntries(r.readiness.map(i => [i.id, i.state]))
    expect(state).toMatchObject({
      'devnet-authority-multisig': 'pass',
      'attestor-separate': 'pass',
      'mainnet-program': 'fail',
    })
    expect(r.alerts.map(a => a.id)).toEqual(
      expect.arrayContaining(['solana:pool-paused', 'solana:worker-bridge-stopped'])
    )
  })

  it('holder counts need a private RPC — unknown with a reason, not 0', async () => {
    const r = await buildSolanaChainReport(reader({ privateRpc: false }), null, workers)
    expect(r.mints.ok && r.mints.value[0]!.holders).toBeNull()
    expect(r.mints.ok && r.mints.value[0]!.holdersReason).toMatch(/private RPC/)
  })

  it('a failed read leaves that section unknown and the checklist item "unknown", others intact', async () => {
    const r = await buildSolanaChainReport(reader({ failPools: true }), null, workers)
    expect(r.pools).toEqual({ ok: false, reason: '429 Too Many Requests' })
    expect(r.readiness.find(i => i.id === 'pools-bootstrapped')?.state).toBe('unknown')
    expect(r.config.ok).toBe(true)
    expect(r.alerts.map(a => a.id)).toContain('solana:sections-unreadable')
  })

  it('flags a paused config (critical) and a low deployer balance', async () => {
    const r = await buildSolanaChainReport(
      reader({ pauseClaims: true, deployerLamports: 500_000_000 }),
      null,
      workers
    )
    expect(r.alerts.find(a => a.id === 'solana:config-paused')?.severity).toBe('critical')
    expect(r.alerts.map(a => a.id)).toContain('solana:deployer-low')
  })
})
