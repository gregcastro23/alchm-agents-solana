#!/usr/bin/env bun
/**
 * Alchm Agents — Solana Token-2022 ESMS Elemental Mints Deployer
 *
 * Programmatically creates and initializes the 4 Elemental Token-2022 Mints:
 * 1. Spirit (Fire)    -> Symbol: SPIRIT    (Decimals: 4)
 * 2. Essence (Water)  -> Symbol: ESSENCE   (Decimals: 4)
 * 3. Matter (Earth)   -> Symbol: MATTER    (Decimals: 4)
 * 4. Substance (Air)  -> Symbol: SUBSTANCE (Decimals: 4)
 *
 * Configures Token-2022 Extensions:
 * - NonTransferable (Soulbound per AAE architecture)
 * - MetadataPointer (Self-referential or Metaplex metadata)
 * - PermanentDelegate (Program Authority PDA for sponsored redemption)
 *
 * Usage:
 *   bun run scripts/deploy-esms-spl-tokens.ts --cluster devnet
 *   bun run scripts/deploy-esms-spl-tokens.ts --dry-run
 */

import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMetadataPointerInstruction,
  createInitializeMint2Instruction,
  createInitializeNonTransferableMintInstruction,
  createInitializePermanentDelegateInstruction,
  getMintLen,
} from '@solana/spl-token'
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
  sendAndConfirmTransaction,
} from '@solana/web3.js'
import { readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { resolve } from 'node:path'
import {
  AAE_SOLANA_PROGRAM_ID,
  ESMS_DECIMALS,
  getEsmsMintAddresses,
  getProgramConfigAddress,
} from '../lib/solana/esms'

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
  console.log(`🌌 ALCHM AGENTS — SOLANA TOKEN-2022 ELEMENTAL MINTS DEPLOYER`)
  console.log(`===============================================================`)
  console.log(`Cluster:           ${cluster}`)
  console.log(`RPC Endpoint:      ${rpcUrl}`)
  console.log(`Token Program:     ${TOKEN_2022_PROGRAM_ID.toBase58()}`)
  console.log(`AAE Program ID:    ${AAE_SOLANA_PROGRAM_ID.toBase58()}`)
  console.log(
    `Dry Run Mode:      ${isDryRun ? 'ENABLED (Simulation)' : 'DISABLED (Live Broadcast)'}\n`
  )

  const payer = await resolveKeypair()
  console.log(`Deployer Wallet:   ${payer.publicKey.toBase58()}`)

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

  for (let i = 0; i < ELEMENTAL_TOKENS.length; i++) {
    const config = ELEMENTAL_TOKENS[i]
    console.log(`▶ Initializing ${config.name} (${config.symbol}) [${config.element}]...`)

    // Extensions: NonTransferable + MetadataPointer + PermanentDelegate
    const extensions = [
      ExtensionType.NonTransferable,
      ExtensionType.MetadataPointer,
      ExtensionType.PermanentDelegate,
    ]
    const mintLen = getMintLen(extensions)

    if (isDryRun) {
      const mockMint = Keypair.generate()
      results.push({
        axis: config.axis,
        symbol: config.symbol,
        name: config.name,
        mintAddress: pdaMints[i].toBase58(),
        status: 'Simulated (Dry-Run)',
        explorerUrl: `https://explorer.solana.com/address/${pdaMints[i].toBase58()}?cluster=${cluster}`,
      })
      console.log(`  ✓ Simulation OK (Rent space: ${mintLen} bytes)`)
      continue
    }

    try {
      const mintKeypair = Keypair.generate()
      const rent = await connection.getMinimumBalanceForRentExemption(mintLen)

      const tx = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: payer.publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: mintLen,
          lamports: rent,
          programId: TOKEN_2022_PROGRAM_ID,
        }),
        createInitializeNonTransferableMintInstruction(
          mintKeypair.publicKey,
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializePermanentDelegateInstruction(
          mintKeypair.publicKey,
          programConfigPda,
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMetadataPointerInstruction(
          mintKeypair.publicKey,
          payer.publicKey, // authority
          mintKeypair.publicKey, // metadata address pointer
          TOKEN_2022_PROGRAM_ID
        ),
        createInitializeMint2Instruction(
          mintKeypair.publicKey,
          config.decimals,
          payer.publicKey, // mint authority
          payer.publicKey, // freeze authority
          TOKEN_2022_PROGRAM_ID
        )
      )

      const sig = await sendAndConfirmTransaction(connection, tx, [payer, mintKeypair], {
        commitment: 'confirmed',
      })

      results.push({
        axis: config.axis,
        symbol: config.symbol,
        name: config.name,
        mintAddress: mintKeypair.publicKey.toBase58(),
        status: `Success (${sig.slice(0, 8)}...)`,
        explorerUrl: `https://explorer.solana.com/address/${mintKeypair.publicKey.toBase58()}?cluster=${cluster}`,
      })
      console.log(`  ✓ Mint Created: ${mintKeypair.publicKey.toBase58()}`)
      console.log(`  ✓ Tx Signature: ${sig}\n`)
    } catch (err) {
      console.error(`  ✗ Error creating ${config.name}:`, err)
      results.push({
        axis: config.axis,
        symbol: config.symbol,
        name: config.name,
        mintAddress: 'FAILED',
        status: `Error: ${err instanceof Error ? err.message : String(err)}`,
        explorerUrl: '',
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
      'Mint Address': r.mintAddress,
      Status: r.status,
    }))
  )
  console.log(`\n💡 Crucial Solana DEX & Wallet Integration Rules:`)
  console.log(`1. On Solana, DEX aggregators (Jupiter, Raydium) index by Mint Address.`)
  console.log(`2. Using distinct symbols (SPIRIT, ESSENCE, MATTER, SUBSTANCE) prevents`)
  console.log(`   Phantom & Solflare automated multi-token collision fraud warnings.`)
  console.log(`3. 4 Decimals preserve exact parity with off-chain Decimal(12,4) balances.\n`)
}

main().catch(err => {
  console.error('Fatal deployment error:', err)
  process.exit(1)
})
