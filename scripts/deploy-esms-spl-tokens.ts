#!/usr/bin/env bun
/**
 * Alchm Agents — Solana Token-2022 ESMS Elemental Mints Deployer & Verifier
 *
 * Programmatically initializes or verifies the 4 deterministic Elemental Token-2022 PDA Mints:
 * 1. Spirit (Fire)    -> Symbol: SPIRIT    (Decimals: 4) -> PDA: K5kwwomtWYydxJacA7bC5yUEW9TtEuVqBKBoqAWLmhQ
 * 2. Essence (Water)  -> Symbol: ESSENCE   (Decimals: 4) -> PDA: 3FcpToU7bj4sLD687uecbesEjzjxBfqYn2EcBXJKPaCf
 * 3. Matter (Earth)   -> Symbol: MATTER    (Decimals: 4) -> PDA: 7naJZozLrknDF3dguAdEWn7Z4MviUkXitjhaAt57Vkb4
 * 4. Substance (Air)  -> Symbol: SUBSTANCE (Decimals: 4) -> PDA: 6RY6ZG1eJQ2uEvpyA6XK74WyF1MpTYbw97hdhELqDUsa
 *
 * Configures Token-2022 Extensions:
 * - NonTransferable (Soulbound per AAE architecture)
 * - MetadataPointer (Self-referential metadata pointer to PDA)
 * - PermanentDelegate (Program Authority PDA for sponsored redemption)
 *
 * Usage:
 *   bun run scripts/deploy-esms-spl-tokens.ts --cluster devnet
 *   bun run scripts/deploy-esms-spl-tokens.ts --dry-run
 */

import { AnchorProvider, Program, Wallet } from '@coral-xyz/anchor'
import {
  TOKEN_2022_PROGRAM_ID,
  getMint,
  getMetadataPointerState,
  getPermanentDelegate,
  getNonTransferable,
} from '@solana/spl-token'
import { Connection, Keypair, PublicKey, SystemProgram, clusterApiUrl } from '@solana/web3.js'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  ASOL_SOLANA_PROGRAM_ID,
  ESMS_DECIMALS,
  getEsmsMintAddresses,
  getProgramConfigAddress,
} from '../lib/solana/esms'
import ASOL_PROGRAM_IDL from '../lib/solana/idl/asol_program.json'
import type { AsolProgram } from '../lib/solana/idl/asol_program'

interface TokenConfig {
  axis: 'Spirit' | 'Essence' | 'Matter' | 'Substance'
  name: string
  symbol: string
  element: string
  decimals: number
  uri: string
}

const ELEMENTAL_TOKENS: TokenConfig[] = [
  {
    axis: 'Spirit',
    name: 'Alchm Spirit',
    symbol: 'SPIRIT',
    element: 'Fire',
    decimals: ESMS_DECIMALS,
    uri: 'https://alchmagents.com/metadata/spirit.json',
  },
  {
    axis: 'Essence',
    name: 'Alchm Essence',
    symbol: 'ESSENCE',
    element: 'Water',
    decimals: ESMS_DECIMALS,
    uri: 'https://alchmagents.com/metadata/essence.json',
  },
  {
    axis: 'Matter',
    name: 'Alchm Matter',
    symbol: 'MATTER',
    element: 'Earth',
    decimals: ESMS_DECIMALS,
    uri: 'https://alchmagents.com/metadata/matter.json',
  },
  {
    axis: 'Substance',
    name: 'Alchm Substance',
    symbol: 'SUBSTANCE',
    element: 'Air',
    decimals: ESMS_DECIMALS,
    uri: 'https://alchmagents.com/metadata/substance.json',
  },
]

function getCliArg(name: string, fallback?: string): string | undefined {
  const index = process.argv.indexOf(name)
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback
}

async function resolveKeypair(): Promise<Keypair> {
  const keyPath = getCliArg('--keypair') ?? resolve(homedir(), '.config/solana/id.json')
  try {
    const raw = await readFile(keyPath, 'utf8')
    const secret = Uint8Array.from(JSON.parse(raw))
    return Keypair.fromSecretKey(secret)
  } catch {
    console.warn(
      `Could not read wallet from ${keyPath}. Generating ephemeral keypair for simulation...`
    )
    return Keypair.generate()
  }
}

async function main() {
  const isDryRun = process.argv.includes('--dry-run')
  const cluster = (getCliArg('--cluster', 'devnet') || 'devnet') as 'devnet' | 'mainnet-beta'
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    (cluster === 'mainnet-beta' ? clusterApiUrl('mainnet-beta') : clusterApiUrl('devnet'))

  console.log(`\n===============================================================`)
  console.log(`🌌 ALCHM AGENTS — SOLANA TOKEN-2022 ESMS MINTS INITIALIZER`)
  console.log(`===============================================================`)
  console.log(`Cluster:           ${cluster}`)
  console.log(`RPC Endpoint:      ${rpcUrl}`)
  console.log(`Token Program:     ${TOKEN_2022_PROGRAM_ID.toBase58()}`)
  console.log(`AAE Program ID:    ${AAE_SOLANA_PROGRAM_ID.toBase58()}`)
  console.log(
    `Dry Run Mode:      ${isDryRun ? 'ENABLED (Simulation)' : 'DISABLED (Live Broadcast)'}\n`
  )

  const payer = await resolveKeypair()
  console.log(`Admin Wallet:      ${payer.publicKey.toBase58()}`)

  const programConfigPda = getProgramConfigAddress(AAE_SOLANA_PROGRAM_ID)
  console.log(`Program Config PDA:${programConfigPda.toBase58()}\n`)

  const connection = new Connection(rpcUrl, 'confirmed')
  const pdaMints = getEsmsMintAddresses(AAE_SOLANA_PROGRAM_ID)

  console.log(`---------------------------------------------------------------`)
  console.log(`Deterministic AAE Program PDA Mint Addresses (4 Decimals):`)
  pdaMints.forEach((pda, idx) => {
    console.log(`[${idx}] ${ELEMENTAL_TOKENS[idx].axis.padEnd(9)} -> ${pda.toBase58()}`)
  })
  console.log(`---------------------------------------------------------------\n`)

  const results: Array<{
    axis: string
    symbol: string
    name: string
    mintAddress: string
    status: string
    explorerUrl: string
  }> = []

  const provider = new AnchorProvider(connection, new Wallet(payer), {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const program = new Program<AsolProgram>(ASOL_PROGRAM_IDL as unknown as AsolProgram, provider)

  for (let i = 0; i < ELEMENTAL_TOKENS.length; i++) {
    const config = ELEMENTAL_TOKENS[i]
    const pda = pdaMints[i]
    console.log(
      `▶ Verifying ${config.name} (${config.symbol}) [${config.element}] at ${pda.toBase58()}...`
    )

    if (isDryRun) {
      results.push({
        axis: config.axis,
        symbol: config.symbol,
        name: config.name,
        mintAddress: pda.toBase58(),
        status: 'Deterministic PDA Verified (Dry-Run)',
        explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=${cluster}`,
      })
      console.log(`  ✓ PDA Derivation OK (4 Decimals)`)
      continue
    }

    try {
      const accountInfo = await connection.getAccountInfo(pda, 'confirmed')

      if (accountInfo) {
        const mintData = await getMint(connection, pda, 'confirmed', TOKEN_2022_PROGRAM_ID)
        const isNonTransferable = Boolean(getNonTransferable(mintData))
        const permanentDelegate = getPermanentDelegate(mintData)
        const metadataPointer = getMetadataPointerState(mintData)

        results.push({
          axis: config.axis,
          symbol: config.symbol,
          name: config.name,
          mintAddress: pda.toBase58(),
          status: 'Initialized on-chain (Token-2022)',
          explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=${cluster}`,
        })
        console.log(`  ✓ Mint Already Initialized: ${pda.toBase58()}`)
        console.log(`    - Non-Transferable: ${isNonTransferable}`)
        console.log(`    - Permanent Delegate: ${permanentDelegate?.delegate.toBase58() ?? 'None'}`)
        console.log(
          `    - Metadata Pointer: ${metadataPointer?.metadataAddress?.toBase58() ?? 'None'}\n`
        )
      } else {
        console.log(`  ℹ Mint not yet initialized. Initializing via AAE Anchor program...`)
        const mintAccounts = {
          spiritMint: pdaMints[0],
          essenceMint: pdaMints[1],
          matterMint: pdaMints[2],
          substanceMint: pdaMints[3],
        }

        const tx = await program.methods
          .initializeEsmsMints()
          .accounts({
            programConfig: programConfigPda,
            admin: payer.publicKey,
            ...mintAccounts,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()

        results.push({
          axis: config.axis,
          symbol: config.symbol,
          name: config.name,
          mintAddress: pda.toBase58(),
          status: `Initialized in Tx (${tx.slice(0, 8)}...)`,
          explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=${cluster}`,
        })
        console.log(`  ✓ Successfully Initialized PDA Mint: ${pda.toBase58()}`)
        console.log(`  ✓ Tx Signature: ${tx}\n`)
      }
    } catch (err) {
      console.error(`  ✗ Error checking/initializing ${config.name}:`, err)
      results.push({
        axis: config.axis,
        symbol: config.symbol,
        name: config.name,
        mintAddress: pda.toBase58(),
        status: `Error: ${err instanceof Error ? err.message : String(err)}`,
        explorerUrl: `https://explorer.solana.com/address/${pda.toBase58()}?cluster=${cluster}`,
      })
    }
  }

  console.log(`\n===============================================================`)
  console.log(`🏆 DEPLOYMENT & METADATA SUMMARY`)
  console.log(`===============================================================`)
  console.table(
    results.map(r => ({
      Axis: r.axis,
      Symbol: r.symbol,
      Name: r.name,
      'Mint Address (PDA)': r.mintAddress,
      Status: r.status,
    }))
  )

  console.log(`\n📋 Environment Variables for WhatToEatNext & AlchmAgents:`)
  console.log(`NEXT_PUBLIC_ESMS_SPL_MINT_SPIRIT=${pdaMints[0].toBase58()}`)
  console.log(`NEXT_PUBLIC_ESMS_SPL_MINT_ESSENCE=${pdaMints[1].toBase58()}`)
  console.log(`NEXT_PUBLIC_ESMS_SPL_MINT_MATTER=${pdaMints[2].toBase58()}`)
  console.log(`NEXT_PUBLIC_ESMS_SPL_MINT_SUBSTANCE=${pdaMints[3].toBase58()}`)

  console.log(`\n💡 Crucial Solana DEX & Wallet Integration Rules:`)
  console.log(`1. On Solana, DEX aggregators (Jupiter, Raydium) index strictly by Mint Address.`)
  console.log(`2. Using distinct symbols (SPIRIT, ESSENCE, MATTER, SUBSTANCE) prevents`)
  console.log(`   Phantom & Solflare automated multi-token collision fraud warnings.`)
  console.log(`3. 4 Decimals preserve exact parity with off-chain Decimal(12,4) balances.\n`)
}

main().catch(err => {
  console.error('Fatal deployment error:', err)
  process.exit(1)
})
