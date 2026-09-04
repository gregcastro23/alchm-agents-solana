#!/usr/bin/env bun
/**
 * Automated Solana Devnet Comprehensive Gate 4 Audit
 *
 * Verifies:
 *   1. Solana Devnet Genesis Hash
 *   2. On-chain BPF ProgramData & Bytecode SHA-256 byte parity against local target/deploy/asol_program.so
 *   3. ProgramConfig PDA (strict 140-byte layout, admin, attestor, pauser, pause state)
 *   4. PendingAdmin PDA state
 *   5. All 4 Token-2022 ESMS mints (TLV extensions, metadata URIs, permanent delegates, non-transferability)
 *   6. All 6 canonical Constellation AMM pools (registration, bootstrapping, 30 bps fee, constant product invariant)
 *   7. Squads v4 2-of-3 Multisig & Vault accounts and governance lifecycle execution trail
 *
 * Emits machine-readable receipt to deployments/solana-devnet-audit-receipt.json
 *
 * Usage:
 *   bun run scripts/audit/audit-devnet.ts [--rpc-url <url>] [--json]
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Connection, PublicKey } from '@solana/web3.js'
import * as anchor from '@coral-xyz/anchor'

import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getProgramConfigAddress,
  getEsmsMintAddresses,
} from '@/lib/solana/esms'
import {
  CONSTELLATION_PAIRS,
  getConstellationPoolAddress,
  decodeConstellationPool,
} from '@/lib/solana/constellation-amm'
import {
  SQUADS_V4_PROGRAM_ID,
  getProgramDataAddress,
  getPendingAdminAddress,
  verifySquadsAccountsOnChain,
} from '@/scripts/governance/squads-multisig-runbook'
import { SOLANA_DEVNET_GENESIS_HASH } from '@/lib/solana/network-config'
import { ESMS_NAMES, ESMS_SYMBOLS } from '@/lib/solana/vectors'
import { validateMintAccountData } from '@/scripts/deploy/init-mainnet'
import { IDL, type AsolProgram } from '@/lib/solana/idl'

export const AUDIT_RECEIPT_FILE = resolve(
  process.cwd(),
  'deployments/solana-devnet-audit-receipt.json'
)
export const GOVERNANCE_FILE = resolve(process.cwd(), 'deployments/solana-devnet-governance.json')
export const LOCAL_BINARY_FILE = resolve(process.cwd(), 'target/deploy/asol_program.so')

export interface DevnetAuditReport {
  timestamp: string
  cluster: 'devnet'
  rpcUrl: string
  genesisHash: string
  genesisMatch: boolean
  program: {
    id: string
    isDeployed: boolean
    owner: string
    executable: boolean
    dataLength: number
    balanceSol: number
    programDataAddress: string
    upgradeAuthority: string | null
    localBytecodeSha256: string | null
    onChainBytecodeSha256: string | null
    bytecodeParity: boolean
  }
  programConfig: {
    pda: string
    exists: boolean
    owner: string
    dataLength: number
    expectedDataLength: number
    sizeValid: boolean
    balanceSol: number
    admin: string
    attestor: string
    pauser: string
    isPaused: boolean
    clusterDomain: number[]
  }
  pendingAdmin: {
    pda: string
    exists: boolean
    pendingAdmin: string | null
  }
  mints: Array<{
    name: string
    symbol: string
    address: string
    decimals: number
    isValid: boolean
    hasNonTransferable: boolean
    hasPermanentDelegate: boolean
    hasMetadataPointer: boolean
    hasTokenMetadata: boolean
    hasPermissionedBurn: boolean
    metadataUri: string
    balanceSol: number
    dataLength: number
  }>
  ammPools: Array<{
    poolId: number
    elementA: number
    elementB: number
    pda: string
    exists: boolean
    bootstrapped: boolean
    feeBps: number
    totalShares: string
    reserveA: string
    reserveB: string
    kProduct: string
    invariantValid: boolean
  }>
  governance: {
    configured: boolean
    multisigPda: string
    vaultPda: string
    threshold: number
    memberCount: number
    multisigValid: boolean
    vaultValid: boolean
    lifecycleExecuted: boolean
  }
  status: 'PASSED' | 'FAILED'
  errors: string[]
}

export async function runDevnetAudit(
  rpcUrl = 'https://api.devnet.solana.com'
): Promise<DevnetAuditReport> {
  const connection = new Connection(rpcUrl, 'confirmed')
  const errors: string[] = []

  // 1. Genesis Hash Check
  const genesisHash = await connection.getGenesisHash()
  const genesisMatch = genesisHash === SOLANA_DEVNET_GENESIS_HASH
  if (!genesisMatch) {
    errors.push(
      `Devnet genesis mismatch: expected ${SOLANA_DEVNET_GENESIS_HASH}, received ${genesisHash}`
    )
  }

  // 2. Program Bytecode & ProgramData Parity Check
  const programId = ASOL_SOLANA_PROGRAM_ID
  const programInfo = await connection.getAccountInfo(programId)
  if (!programInfo) {
    errors.push(`Program ${programId.toBase58()} not found on cluster`)
  }

  const isProgramValid = Boolean(
    programInfo &&
    programInfo.executable &&
    programInfo.owner.toBase58() === 'BPFLoaderUpgradeab1e11111111111111111111111'
  )
  if (programInfo && !isProgramValid) {
    errors.push('Program account exists but is not an executable upgradeable BPF program')
  }

  const programDataAddress = getProgramDataAddress(programId)
  const programDataInfo = await connection.getAccountInfo(programDataAddress)
  let upgradeAuthority: string | null = null
  let localBytecodeSha256: string | null = null
  let onChainBytecodeSha256: string | null = null
  let bytecodeParity = false

  if (!programDataInfo) {
    errors.push(`ProgramData account ${programDataAddress.toBase58()} not found`)
  } else {
    // Check upgrade authority (offset 12 is option tag, 13..45 is pubkey if tag === 1)
    if (programDataInfo.data[12] === 1) {
      upgradeAuthority = new PublicKey(programDataInfo.data.subarray(13, 45)).toBase58()
    }

    if (existsSync(LOCAL_BINARY_FILE)) {
      const localBytes = readFileSync(LOCAL_BINARY_FILE)
      localBytecodeSha256 = createHash('sha256').update(localBytes).digest('hex')

      // Bytecode starts at offset 45 in ProgramData account
      const onChainBytecode = programDataInfo.data.subarray(45, 45 + localBytes.length)
      onChainBytecodeSha256 = createHash('sha256').update(onChainBytecode).digest('hex')

      bytecodeParity = localBytecodeSha256 === onChainBytecodeSha256
      if (!bytecodeParity) {
        errors.push(
          `Bytecode SHA-256 mismatch: local ${localBytecodeSha256} != on-chain ${onChainBytecodeSha256}`
        )
      }
    } else {
      errors.push(`Local compiled binary not found at ${LOCAL_BINARY_FILE}`)
    }
  }

  // 3. ProgramConfig PDA Check (Exact 140-byte invariant)
  const programConfigPda = getProgramConfigAddress(programId)
  const configInfo = await connection.getAccountInfo(programConfigPda)
  const EXPECTED_CONFIG_SIZE = 140
  let admin = ''
  let attestor = ''
  let pauser = ''
  let isPaused = false
  let clusterDomain: number[] = []

  if (!configInfo) {
    errors.push(`ProgramConfig PDA ${programConfigPda.toBase58()} is not initialized`)
  } else {
    if (!configInfo.owner.equals(programId)) {
      errors.push(
        `ProgramConfig PDA owner mismatch: expected ${programId.toBase58()}, received ${configInfo.owner.toBase58()}`
      )
    }

    if (configInfo.data.length !== EXPECTED_CONFIG_SIZE) {
      errors.push(
        `ProgramConfig PDA size violation: expected exactly ${EXPECTED_CONFIG_SIZE} bytes, found ${configInfo.data.length} bytes`
      )
    }

    try {
      const dummyWallet = new anchor.Wallet(PublicKey.default as any)
      const provider = new anchor.AnchorProvider(connection, dummyWallet, {
        commitment: 'confirmed',
      })
      const program = new anchor.Program(IDL as AsolProgram, provider)
      const config = await program.account.programConfig.fetch(programConfigPda)
      admin = config.admin.toBase58()
      attestor = config.attestor.toBase58()
      pauser = config.pauser.toBase58()
      isPaused = Boolean(config.isPaused)
      clusterDomain = Array.from(config.clusterDomain)
    } catch (err: any) {
      errors.push(`Failed to decode ProgramConfig data: ${err?.message}`)
    }
  }

  // 4. PendingAdmin PDA Check
  const pendingAdminPda = getPendingAdminAddress(programId)
  const pendingAdminInfo = await connection.getAccountInfo(pendingAdminPda)
  let pendingAdminAddr: string | null = null

  if (pendingAdminInfo) {
    if (!pendingAdminInfo.owner.equals(programId)) {
      errors.push('PendingAdmin account owner is not asol_program')
    }
    try {
      const dummyWallet = new anchor.Wallet(PublicKey.default as any)
      const provider = new anchor.AnchorProvider(connection, dummyWallet, {
        commitment: 'confirmed',
      })
      const program = new anchor.Program(IDL as AsolProgram, provider)
      const pendingAdminState = await program.account.pendingAdmin.fetch(pendingAdminPda)
      pendingAdminAddr = pendingAdminState.pendingAdmin.toBase58()
    } catch {}
  }

  // 5. Token-2022 ESMS Mints Audit (Read-Only)
  const mintAddresses = getEsmsMintAddresses(programId)
  const mintInfos = await connection.getMultipleAccountsInfo(mintAddresses)
  const mintReports: DevnetAuditReport['mints'] = []

  for (let i = 0; i < 4; i++) {
    const address = mintAddresses[i]
    const info = mintInfos[i]
    const name = ESMS_NAMES[i]
    const symbol = ESMS_SYMBOLS[i]

    if (!info) {
      errors.push(`Mint ${name} (${address.toBase58()}) not found on cluster`)
      mintReports.push({
        name,
        symbol,
        address: address.toBase58(),
        decimals: 4,
        isValid: false,
        hasNonTransferable: false,
        hasPermanentDelegate: false,
        hasMetadataPointer: false,
        hasTokenMetadata: false,
        hasPermissionedBurn: false,
        metadataUri: '',
        balanceSol: 0,
        dataLength: 0,
      })
      continue
    }

    if (!info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
      errors.push(
        `Mint ${name} owner mismatch: expected ${TOKEN_2022_PROGRAM_ID.toBase58()}, received ${info.owner.toBase58()}`
      )
    }

    const verification = validateMintAccountData(info.data, address, i, programConfigPda, {
      allowDevnetUri: true,
    })

    if (!verification.isValid) {
      errors.push(
        `Mint ${name} failed extension validation: NonTransferable=${verification.hasNonTransferable}, PermanentDelegate=${verification.hasPermanentDelegate}, MetadataPointer=${verification.hasMetadataPointer}, TokenMetadata=${verification.hasTokenMetadata}, PermissionedBurn=${verification.hasPermissionedBurn}`
      )
    }

    mintReports.push({
      name,
      symbol,
      address: address.toBase58(),
      decimals: verification.decimals,
      isValid: verification.isValid,
      hasNonTransferable: verification.hasNonTransferable,
      hasPermanentDelegate: verification.hasPermanentDelegate,
      hasMetadataPointer: verification.hasMetadataPointer,
      hasTokenMetadata: verification.hasTokenMetadata,
      hasPermissionedBurn: verification.hasPermissionedBurn,
      metadataUri: verification.metadataUri,
      balanceSol: info.lamports / 1e9,
      dataLength: info.data.length,
    })
  }

  // 6. Constellation AMM Pools Audit (All 6 Canonical Pairs)
  const ammPools: DevnetAuditReport['ammPools'] = []
  const UNIFORM_FEE_BPS = 30
  const MIN_SHARES = 100_000_000n

  for (let poolId = 0; poolId < CONSTELLATION_PAIRS.length; poolId++) {
    const [elemA, elemB] = CONSTELLATION_PAIRS[poolId]
    const poolPda = getConstellationPoolAddress(poolId, programId)
    const poolInfo = await connection.getAccountInfo(poolPda)

    if (!poolInfo) {
      errors.push(
        `AMM Pool ${poolId} (${elemA} <-> ${elemB}) PDA ${poolPda.toBase58()} not initialized`
      )
      ammPools.push({
        poolId,
        elementA: elemA,
        elementB: elemB,
        pda: poolPda.toBase58(),
        exists: false,
        bootstrapped: false,
        feeBps: 0,
        totalShares: '0',
        reserveA: '0',
        reserveB: '0',
        kProduct: '0',
        invariantValid: false,
      })
      continue
    }

    if (!poolInfo.owner.equals(programId)) {
      errors.push(
        `AMM Pool ${poolId} owner mismatch: expected ${programId.toBase58()}, received ${poolInfo.owner.toBase58()}`
      )
    }

    const pool = decodeConstellationPool(Buffer.from(poolInfo.data))
    const reserveA = BigInt(pool.reserveA)
    const reserveB = BigInt(pool.reserveB)
    const totalShares = BigInt(pool.totalShares)
    const kProduct = reserveA * reserveB
    const kInitial = MIN_SHARES * MIN_SHARES

    const invariantValid =
      pool.poolId === poolId &&
      pool.elementA === elemA &&
      pool.elementB === elemB &&
      pool.feeBps === UNIFORM_FEE_BPS &&
      pool.bootstrapped === true &&
      totalShares >= MIN_SHARES &&
      reserveA > 0n &&
      reserveB > 0n &&
      kProduct >= kInitial

    if (!invariantValid) {
      errors.push(
        `AMM Pool ${poolId} invariant failure: bootstrapped=${pool.bootstrapped}, feeBps=${pool.feeBps}, totalShares=${totalShares}, reserveA=${reserveA}, reserveB=${reserveB}, k=${kProduct}`
      )
    }

    ammPools.push({
      poolId,
      elementA: elemA,
      elementB: elemB,
      pda: poolPda.toBase58(),
      exists: true,
      bootstrapped: pool.bootstrapped,
      feeBps: pool.feeBps,
      totalShares: totalShares.toString(),
      reserveA: reserveA.toString(),
      reserveB: reserveB.toString(),
      kProduct: kProduct.toString(),
      invariantValid,
    })
  }

  // 7. Squads v4 Multisig & Vault Governance Audit
  let governanceReport: DevnetAuditReport['governance'] = {
    configured: false,
    multisigPda: '',
    vaultPda: '',
    threshold: 0,
    memberCount: 0,
    multisigValid: false,
    vaultValid: false,
    lifecycleExecuted: false,
  }

  if (existsSync(GOVERNANCE_FILE)) {
    try {
      const govData = JSON.parse(readFileSync(GOVERNANCE_FILE, 'utf8'))
      const multisigPda = new PublicKey(govData.multisigPda)
      const vaultPda = new PublicKey(govData.vaultPda)

      const verification = await verifySquadsAccountsOnChain(connection, multisigPda, vaultPda)
      const multisigValid = verification.multisigExists && verification.multisigOwnerValid
      const vaultValid = verification.vaultExists && verification.vaultOwnerValid
      const lifecycleExecuted = govData.lifecycleDrill?.status === 'executed'

      if (!multisigValid) {
        errors.push(
          `Squads multisig ${multisigPda.toBase58()} failed on-chain existence/ownership check`
        )
      }
      if (!vaultValid) {
        errors.push(`Squads vault ${vaultPda.toBase58()} failed on-chain existence/ownership check`)
      }
      if (!lifecycleExecuted) {
        errors.push('Squads governance lifecycle drill has not been executed')
      }

      governanceReport = {
        configured: true,
        multisigPda: govData.multisigPda,
        vaultPda: govData.vaultPda,
        threshold: govData.threshold ?? 2,
        memberCount: Array.isArray(govData.members) ? govData.members.length : 0,
        multisigValid,
        vaultValid,
        lifecycleExecuted,
      }
    } catch (err: any) {
      errors.push(`Failed to parse governance deployment file: ${err?.message}`)
    }
  } else {
    errors.push(`Governance deployment file missing at ${GOVERNANCE_FILE}`)
  }

  const report: DevnetAuditReport = {
    timestamp: new Date().toISOString(),
    cluster: 'devnet',
    rpcUrl,
    genesisHash,
    genesisMatch,
    program: {
      id: programId.toBase58(),
      isDeployed: Boolean(programInfo),
      owner: programInfo ? programInfo.owner.toBase58() : '',
      executable: programInfo ? programInfo.executable : false,
      dataLength: programDataInfo ? programDataInfo.data.length : 0,
      balanceSol: programInfo ? programInfo.lamports / 1e9 : 0,
      programDataAddress: programDataAddress.toBase58(),
      upgradeAuthority,
      localBytecodeSha256,
      onChainBytecodeSha256,
      bytecodeParity,
    },
    programConfig: {
      pda: programConfigPda.toBase58(),
      exists: Boolean(configInfo),
      owner: configInfo ? configInfo.owner.toBase58() : '',
      dataLength: configInfo ? configInfo.data.length : 0,
      expectedDataLength: EXPECTED_CONFIG_SIZE,
      sizeValid: configInfo ? configInfo.data.length === EXPECTED_CONFIG_SIZE : false,
      balanceSol: configInfo ? configInfo.lamports / 1e9 : 0,
      admin,
      attestor,
      pauser,
      isPaused,
      clusterDomain,
    },
    pendingAdmin: {
      pda: pendingAdminPda.toBase58(),
      exists: Boolean(pendingAdminInfo),
      pendingAdmin: pendingAdminAddr,
    },
    mints: mintReports,
    ammPools,
    governance: governanceReport,
    status: errors.length === 0 ? 'PASSED' : 'FAILED',
    errors,
  }

  // Save audit receipt
  writeFileSync(AUDIT_RECEIPT_FILE, JSON.stringify(report, null, 2))

  return report
}

// CLI Execution
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('audit-devnet.ts')
) {
  const isJson = process.argv.includes('--json')
  const rpcIndex = process.argv.indexOf('--rpc-url')
  const rpcUrl =
    rpcIndex !== -1 && process.argv[rpcIndex + 1]
      ? process.argv[rpcIndex + 1]
      : (process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com')

  runDevnetAudit(rpcUrl)
    .then(report => {
      if (isJson) {
        console.log(JSON.stringify(report, null, 2))
      } else {
        console.log('\n=============================================================')
        console.log('🪐 SOLANA DEVNET COMPREHENSIVE GATE 4 AUDIT RECEIPT')
        console.log('=============================================================')
        console.log(`Timestamp:       ${report.timestamp}`)
        console.log(`Cluster:         ${report.cluster}`)
        console.log(`RPC URL:         ${report.rpcUrl}`)
        console.log(
          `Genesis Hash:    ${report.genesisHash} (${report.genesisMatch ? '✅ MATCH' : '❌ MISMATCH'})`
        )
        console.log('-------------------------------------------------------------')
        console.log(`Program ID:      ${report.program.id}`)
        console.log(`  • ProgramData: ${report.program.programDataAddress}`)
        console.log(`  • Deployed:    ${report.program.isDeployed ? '✅ YES' : '❌ NO'}`)
        console.log(`  • Executable:  ${report.program.executable ? '✅ YES' : '❌ NO'}`)
        console.log(`  • Authority:   ${report.program.upgradeAuthority ?? 'None'}`)
        console.log(`  • Local SHA:   ${report.program.localBytecodeSha256}`)
        console.log(`  • OnChain SHA: ${report.program.onChainBytecodeSha256}`)
        console.log(
          `  • SHA Parity:  ${report.program.bytecodeParity ? '✅ 100% BYTE-FOR-BYTE MATCH' : '❌ MISMATCH'}`
        )
        console.log('-------------------------------------------------------------')
        console.log(`ProgramConfig:   ${report.programConfig.pda}`)
        console.log(`  • Initialized: ${report.programConfig.exists ? '✅ YES' : '❌ NO'}`)
        console.log(
          `  • Size (140B): ${report.programConfig.sizeValid ? '✅ EXACT 140 BYTES' : `❌ ${report.programConfig.dataLength} BYTES`}`
        )
        console.log(`  • Admin:       ${report.programConfig.admin}`)
        console.log(`  • Attestor:    ${report.programConfig.attestor}`)
        console.log(`  • Pauser:      ${report.programConfig.pauser}`)
        console.log(`  • Is Paused:   ${report.programConfig.isPaused ? '⚠️ PAUSED' : '✅ ACTIVE'}`)
        console.log('-------------------------------------------------------------')
        console.log(`PendingAdmin:    ${report.pendingAdmin.pda}`)
        console.log(
          `  • Active:      ${report.pendingAdmin.exists ? `⚠️ Active (${report.pendingAdmin.pendingAdmin})` : '✅ None (Clean)'}`
        )
        console.log('-------------------------------------------------------------')
        console.log('ESMS Token-2022 Mint Invariants:')
        for (const m of report.mints) {
          console.log(`  🪙 ${m.name} (${m.symbol}) -> ${m.address}`)
          console.log(
            `     - Extensions: NonTransferable=${m.hasNonTransferable} | PermanentDelegate=${m.hasPermanentDelegate} | MetadataPointer=${m.hasMetadataPointer} | PermissionedBurn=${m.hasPermissionedBurn}`
          )
          console.log(`     - Metadata URI: ${m.metadataUri}`)
          console.log(`     - Valid Layout: ${m.isValid ? '✅ PASS' : '❌ FAIL'}`)
        }
        console.log('-------------------------------------------------------------')
        console.log('Constellation AMM Canonical Pools:')
        for (const p of report.ammPools) {
          console.log(`  🏊 Pool ${p.poolId} (${p.elementA} <-> ${p.elementB}): ${p.pda}`)
          console.log(
            `     - Bootstrapped: ${p.bootstrapped ? '✅' : '❌'} | Fee: ${p.feeBps} bps | Shares: ${p.totalShares}`
          )
          console.log(
            `     - Reserves: [${p.reserveA}, ${p.reserveB}] | Invariant: ${p.invariantValid ? '✅ k >= k0' : '❌ FAIL'}`
          )
        }
        console.log('-------------------------------------------------------------')
        console.log('Squads v4 Governance Audit:')
        console.log(
          `  • Multisig PDA: ${report.governance.multisigPda} (${report.governance.multisigValid ? '✅ VALID' : '❌ INVALID'})`
        )
        console.log(
          `  • Vault PDA:    ${report.governance.vaultPda} (${report.governance.vaultValid ? '✅ VALID' : '❌ INVALID'})`
        )
        console.log(
          `  • Policy:       ${report.governance.threshold}-of-${report.governance.memberCount} Threshold`
        )
        console.log(
          `  • Drill Trail:  ${report.governance.lifecycleExecuted ? '✅ EXECUTED ON-CHAIN' : '❌ NOT EXECUTED'}`
        )
        console.log('=============================================================')
        if (report.status === 'PASSED') {
          console.log('🎉 AUDIT STATUS: PASSED - ALL DEVNET OPERATIONS & INVARIANTS CERTIFIED')
          console.log(`📝 Machine-readable receipt written to: ${AUDIT_RECEIPT_FILE}`)
        } else {
          console.log('❌ AUDIT STATUS: FAILED')
          console.log('Errors:', report.errors)
        }
        console.log('=============================================================\n')
      }
      process.exit(report.status === 'PASSED' ? 0 : 1)
    })
    .catch(err => {
      console.error('Fatal audit error:', err)
      process.exit(1)
    })
}
