#!/usr/bin/env bun
/**
 * Automated Solana Devnet ESMS Coin & Program Audit
 *
 * Verifies all 4 Token-2022 ESMS mints, ProgramConfig PDA, BPF bytecode,
 * on-chain TLV extensions, and account invariants on Solana Devnet.
 *
 * Usage:
 *   bun run scripts/audit/audit-devnet.ts [--rpc-url <url>] [--json]
 */

import { Connection, PublicKey } from '@solana/web3.js'
import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getProgramConfigAddress,
  getEsmsMintAddresses,
  ESMS_DEVNET_MINTS,
} from '@/lib/solana/esms'
import { SOLANA_DEVNET_GENESIS_HASH } from '@/lib/solana/network-config'
import { ESMS_NAMES, ESMS_SYMBOLS } from '@/lib/solana/vectors'
import { validateMintAccountData } from '@/scripts/deploy/init-mainnet'

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
  }
  programConfig: {
    pda: string
    exists: boolean
    owner: string
    dataLength: number
    balanceSol: number
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

  // 2. Program Bytecode Check
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
    errors.push(`Program account exists but is not an executable upgradeable BPF program`)
  }

  // 3. ProgramConfig PDA Check
  const programConfigPda = getProgramConfigAddress(programId)
  const configInfo = await connection.getAccountInfo(programConfigPda)
  if (!configInfo) {
    errors.push(`ProgramConfig PDA ${programConfigPda.toBase58()} is not initialized`)
  } else if (!configInfo.owner.equals(programId)) {
    errors.push(
      `ProgramConfig PDA owner mismatch: expected ${programId.toBase58()}, received ${configInfo.owner.toBase58()}`
    )
  }

  // 4. Token-2022 ESMS Mints Audit
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
      dataLength: programInfo ? programInfo.data.length : 0,
      balanceSol: programInfo ? programInfo.lamports / 1e9 : 0,
    },
    programConfig: {
      pda: programConfigPda.toBase58(),
      exists: Boolean(configInfo),
      owner: configInfo ? configInfo.owner.toBase58() : '',
      dataLength: configInfo ? configInfo.data.length : 0,
      balanceSol: configInfo ? configInfo.lamports / 1e9 : 0,
    },
    mints: mintReports,
    status: errors.length === 0 ? 'PASSED' : 'FAILED',
    errors,
  }

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
        console.log('🪐 SOLANA DEVNET ESMS COIN & PROGRAM ON-CHAIN AUDIT REPORT')
        console.log('=============================================================')
        console.log(`Timestamp:       ${report.timestamp}`)
        console.log(`Cluster:         ${report.cluster}`)
        console.log(`RPC URL:         ${report.rpcUrl}`)
        console.log(
          `Genesis Hash:    ${report.genesisHash} (${report.genesisMatch ? '✅ MATCH' : '❌ MISMATCH'})`
        )
        console.log('-------------------------------------------------------------')
        console.log(`Program ID:      ${report.program.id}`)
        console.log(`  • Deployed:    ${report.program.isDeployed ? '✅ YES' : '❌ NO'}`)
        console.log(`  • Executable:  ${report.program.executable ? '✅ YES' : '❌ NO'}`)
        console.log(`  • Owner:       ${report.program.owner}`)
        console.log(`  • Balance:     ${report.program.balanceSol} SOL`)
        console.log('-------------------------------------------------------------')
        console.log(`ProgramConfig:   ${report.programConfig.pda}`)
        console.log(`  • Initialized: ${report.programConfig.exists ? '✅ YES' : '❌ NO'}`)
        console.log(`  • Owner:       ${report.programConfig.owner}`)
        console.log(`  • Balance:     ${report.programConfig.balanceSol} SOL`)
        console.log('-------------------------------------------------------------')
        console.log('ESMS Token-2022 Mint Invariants:')
        for (const m of report.mints) {
          console.log(`  🪙 ${m.name} (${m.symbol}) -> ${m.address}`)
          console.log(
            `     - Extensions: NonTransferable=${m.hasNonTransferable} | PermanentDelegate=${m.hasPermanentDelegate} | MetadataPointer=${m.hasMetadataPointer} | PermissionedBurn=${m.hasPermissionedBurn}`
          )
          console.log(`     - Metadata URI: ${m.metadataUri}`)
          console.log(
            `     - Decimals: ${m.decimals} | Length: ${m.dataLength} bytes | Balance: ${m.balanceSol} SOL`
          )
          console.log(`     - Valid Layout: ${m.isValid ? '✅ PASS' : '❌ FAIL'}`)
        }
        console.log('=============================================================')
        if (report.status === 'PASSED') {
          console.log('🎉 AUDIT STATUS: ALL DEVNET OPERATIONS & INVARIANTS PASSING')
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
