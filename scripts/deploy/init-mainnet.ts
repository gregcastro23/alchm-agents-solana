#!/usr/bin/env bun
/**
 * Planetary Agents (asol_program) - Solana Mainnet Post-Deployment Initializer
 *
 * Responsibilities:
 * 1. Strictly asserts cluster genesis hash matches Mainnet-Beta (5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d).
 * 2. Resolves deployer authority from Cloud KMS HSM (AWS or GCP). Prohibits local signers in production.
 * 3. Asserts program bytecode is deployed at 5QheuqaicKvPPRFEoEXwaE5xaFp7gauvJCfsjpQv8WzD.
 * 4. Checks and idempotently initializes ProgramConfig PDA ([b"program_authority"]).
 * 5. Checks and idempotently initializes 4 Token-2022 ESMS Mints (Spirit, Essence, Matter, Substance).
 * 6. Validates on-chain Token-2022 extensions:
 *    - NonTransferable (Type 9)
 *    - PermanentDelegate (Type 12) -> ProgramConfig PDA
 *    - MetadataPointer (Type 18) -> ProgramConfig PDA + Mint Address
 *    - TokenMetadata (Type 19) -> Immutably matches verified Arweave URIs
 *    - PermissionedBurn (Type 28) -> ProgramConfig PDA
 * 7. Writes verified deployment receipt to deployments/solana-mainnet.json.
 */

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { AnchorProvider, Program } from '@coral-xyz/anchor'
import { Connection, PublicKey, SystemProgram, type AccountInfo } from '@solana/web3.js'
import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getEsmsMintAddresses,
  getProgramConfigAddress,
} from '@/lib/solana/esms'
import ASOL_PROGRAM_IDL from '@/lib/solana/idl/asol_program.json'
import type { AsolProgram } from '@/lib/solana/idl/asol_program'
import { getSolanaServiceSigner, type KmsSolanaSigner } from '@/lib/solana/kms-signer'
import { SOLANA_MAINNET_GENESIS_HASH } from '@/lib/solana/network-config'
import { ESMS_METADATA_URIS, ESMS_NAMES, ESMS_SYMBOLS } from '@/lib/solana/vectors'
import { getProgramDataAddress } from '@/scripts/governance/squads-multisig-runbook'

export const TOKEN_2022_TLV_START = 166
export const TLV_HEADER_LEN = 4
export const EXTENSION_TYPE_NON_TRANSFERABLE = 9
export const EXTENSION_TYPE_PERMANENT_DELEGATE = 12
export const EXTENSION_TYPE_METADATA_POINTER = 18
export const EXTENSION_TYPE_TOKEN_METADATA = 19
export const EXTENSION_TYPE_PERMISSIONED_BURN = 28

export interface InitMainnetCliOptions {
  dryRun: boolean
  allowDevnet: boolean
  allowLocalSigner: boolean
  rpcUrl?: string
  deploymentsFile?: string
}

export interface MintVerificationResult {
  mintIndex: number
  element: string
  symbol: string
  address: string
  metadataUri: string
  hasNonTransferable: boolean
  hasPermanentDelegate: boolean
  hasMetadataPointer: boolean
  hasTokenMetadata: boolean
  hasPermissionedBurn: boolean
  decimals: number
  isValid: boolean
}

export interface InitMainnetReceipt {
  cluster: string
  genesisHash: string
  programId: string
  programConfigPda: string
  programDataAddress: string
  deployer: string
  signerProvider: string
  configInitialized: boolean
  mintsInitialized: boolean
  mints: MintVerificationResult[]
  dryRun: boolean
  timestamp: string
}

/**
 * Parse CLI arguments for init-mainnet script.
 */
export function parseArgs(argv: string[]): InitMainnetCliOptions {
  const options: InitMainnetCliOptions = {
    dryRun: false,
    allowDevnet: false,
    allowLocalSigner: false,
  }

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--dry-run') {
      options.dryRun = true
    } else if (arg === '--allow-devnet') {
      options.allowDevnet = true
    } else if (arg === '--allow-local-signer') {
      options.allowLocalSigner = true
    } else if (arg === '--rpc-url' && argv[i + 1]) {
      options.rpcUrl = argv[++i]
    } else if (arg === '--deployments-file' && argv[i + 1]) {
      options.deploymentsFile = argv[++i]
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: bun run scripts/deploy/init-mainnet.ts [options]

Options:
  --dry-run               Simulate checks and transaction building without broadcasting.
  --allow-devnet          Allow execution on clusters other than Mainnet-Beta.
  --allow-local-signer    Allow using a local filesystem/env keypair (prohibited on Mainnet by default).
  --rpc-url <url>         Solana RPC endpoint URL (overrides SOLANA_RPC_URL).
  --deployments-file <f>  Target JSON deployment receipt file (default: deployments/solana-mainnet.json).
  --help, -h              Show this help message.
`)
      process.exit(0)
    }
  }

  return options
}

/**
 * Validates the raw on-chain Token-2022 mint account buffer against required extensions.
 * Mirror of Rust on-chain validation: `programs/asol_program/src/instructions/esms.rs:validate_existing_mint`.
 */
export function validateMintAccountData(
  data: Buffer,
  mintAddress: PublicKey,
  mintIndex: number,
  authority: PublicKey
): MintVerificationResult {
  const element = ESMS_NAMES[mintIndex]
  const symbol = ESMS_SYMBOLS[mintIndex]
  const expectedUri = ESMS_METADATA_URIS[mintIndex]

  if (data.length < TOKEN_2022_TLV_START) {
    throw new Error(
      `Account data too small for Token-2022 mint: ${data.length} bytes (min: ${TOKEN_2022_TLV_START})`
    )
  }

  // Base mint layout
  const mintAuthOption = data.readUInt32LE(0)
  const mintAuth = new PublicKey(data.subarray(4, 36))
  const decimals = data.readUInt8(44)
  const isInitialized = data.readUInt8(45) === 1
  const freezeAuthOption = data.readUInt32LE(46)

  if (!isInitialized) {
    throw new Error(`Mint ${mintAddress.toBase58()} is not initialized`)
  }
  if (decimals !== 4) {
    throw new Error(`Mint ${mintAddress.toBase58()} decimals = ${decimals}, expected 4`)
  }
  if (mintAuthOption !== 1 || !mintAuth.equals(authority)) {
    throw new Error(
      `Mint ${mintAddress.toBase58()} authority is ${mintAuth.toBase58()}, expected ${authority.toBase58()}`
    )
  }
  if (freezeAuthOption !== 0) {
    throw new Error(`Mint ${mintAddress.toBase58()} has freeze authority, expected None`)
  }

  let hasNonTransferable = false
  let hasPermanentDelegate = false
  let hasMetadataPointer = false
  let hasTokenMetadata = false
  let hasPermissionedBurn = false

  let cursor = TOKEN_2022_TLV_START
  while (cursor + TLV_HEADER_LEN <= data.length) {
    const extensionType = data.readUInt16LE(cursor)
    const extensionLen = data.readUInt16LE(cursor + 2)

    if (extensionType === 0 && extensionLen === 0) {
      break
    }

    const valStart = cursor + TLV_HEADER_LEN
    const valEnd = valStart + extensionLen
    if (valEnd > data.length) {
      throw new Error(`TLV extension ${extensionType} length overflow`)
    }

    const value = data.subarray(valStart, valEnd)

    switch (extensionType) {
      case EXTENSION_TYPE_NON_TRANSFERABLE:
        hasNonTransferable = extensionLen === 0
        break

      case EXTENSION_TYPE_PERMANENT_DELEGATE:
        hasPermanentDelegate = extensionLen === 32 && value.equals(authority.toBuffer())
        break

      case EXTENSION_TYPE_METADATA_POINTER:
        hasMetadataPointer =
          extensionLen === 64 &&
          value.subarray(0, 32).equals(authority.toBuffer()) &&
          value.subarray(32, 64).equals(mintAddress.toBuffer())
        break

      case EXTENSION_TYPE_TOKEN_METADATA: {
        // Unpack TokenMetadata:
        // updateAuthority (32) + mint (32) + name (4+len) + symbol (4+len) + uri (4+len)
        if (extensionLen >= 68) {
          const updateAuth = new PublicKey(value.subarray(0, 32))
          const mintPub = new PublicKey(value.subarray(32, 64))

          let textCursor = 64
          const nameLen = value.readUInt32LE(textCursor)
          textCursor += 4
          const name = value.subarray(textCursor, textCursor + nameLen).toString('utf8')
          textCursor += nameLen

          const symLen = value.readUInt32LE(textCursor)
          textCursor += 4
          const sym = value.subarray(textCursor, textCursor + symLen).toString('utf8')
          textCursor += symLen

          const uriLen = value.readUInt32LE(textCursor)
          textCursor += 4
          const uri = value.subarray(textCursor, textCursor + uriLen).toString('utf8')

          hasTokenMetadata =
            updateAuth.equals(authority) &&
            mintPub.equals(mintAddress) &&
            name === element &&
            sym === symbol &&
            uri === expectedUri
        }
        break
      }

      case EXTENSION_TYPE_PERMISSIONED_BURN:
        hasPermissionedBurn = extensionLen === 32 && value.equals(authority.toBuffer())
        break
    }

    cursor = valEnd
  }

  const isValid =
    hasNonTransferable &&
    hasPermanentDelegate &&
    hasMetadataPointer &&
    hasTokenMetadata &&
    hasPermissionedBurn

  return {
    mintIndex,
    element,
    symbol,
    address: mintAddress.toBase58(),
    metadataUri: expectedUri,
    hasNonTransferable,
    hasPermanentDelegate,
    hasMetadataPointer,
    hasTokenMetadata,
    hasPermissionedBurn,
    decimals,
    isValid,
  }
}

/**
 * Execute the complete post-deployment initialization flow for Solana Mainnet.
 */
export async function initMainnet(
  options: InitMainnetCliOptions,
  customSigner?: KmsSolanaSigner | null
): Promise<InitMainnetReceipt> {
  const rpcUrl =
    options.rpcUrl ??
    process.env.SOLANA_RPC_URL ??
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
    'https://api.mainnet-beta.solana.com'

  const connection = new Connection(rpcUrl, 'confirmed')

  // 1. Genesis Hash Check
  console.log(`[InitMainnet] Querying cluster genesis hash at: ${rpcUrl}`)
  const genesisHash = await connection.getGenesisHash()
  const isMainnet = genesisHash === SOLANA_MAINNET_GENESIS_HASH

  console.log(`[InitMainnet] Cluster Genesis Hash: ${genesisHash}`)
  if (!isMainnet && !options.allowDevnet) {
    throw new Error(
      `Solana cluster genesis mismatch! Expected ${SOLANA_MAINNET_GENESIS_HASH} (Mainnet-Beta), but cluster returned ${genesisHash}. Pass --allow-devnet to bypass for testing.`
    )
  }

  // 2. Signer Resolution
  const signer =
    customSigner ?? getSolanaServiceSigner({ allowLocalInProd: options.allowLocalSigner })
  if (!signer) {
    throw new Error(
      'No Solana service signer available. In production, configure AWS_KMS_KEY_ID or GCP_KMS_KEY_NAME. Pass --allow-local-signer for local dry-runs.'
    )
  }

  console.log(
    `[InitMainnet] Signer resolved: ${signer.publicKey.toBase58()} (Provider: ${signer.provider})`
  )

  if (isMainnet && signer.provider === 'local' && !options.allowLocalSigner) {
    throw new Error(
      'Cloud KMS HSM signer (AWS or GCP) is strictly required on Mainnet-Beta. Local keypairs are prohibited without --allow-local-signer.'
    )
  }

  // 3. Program Deployment Check
  const programId = ASOL_SOLANA_PROGRAM_ID
  const programConfigPda = getProgramConfigAddress(programId)
  const programDataAddress = getProgramDataAddress(programId)
  const mintAddresses = getEsmsMintAddresses(programId)

  console.log(`[InitMainnet] Target Program ID: ${programId.toBase58()}`)
  console.log(`[InitMainnet] Program Config PDA: ${programConfigPda.toBase58()}`)
  console.log(`[InitMainnet] Program Data Address: ${programDataAddress.toBase58()}`)

  const programAccount = await connection.getAccountInfo(programId)
  if (!programAccount) {
    if (options.dryRun) {
      console.warn(
        `[InitMainnet] [DRY RUN] Warning: Program account ${programId.toBase58()} not yet deployed on cluster.`
      )
    } else {
      throw new Error(
        `Program ${programId.toBase58()} is not deployed on-chain at ${rpcUrl}. Deploy the program before running post-deploy initialization.`
      )
    }
  }

  // Setup Anchor Provider & Program Client
  const provider = new AnchorProvider(connection, signer, {
    commitment: 'confirmed',
    preflightCommitment: 'confirmed',
  })
  const program = new Program<AsolProgram>(ASOL_PROGRAM_IDL as unknown as AsolProgram, provider)

  // 4. Program Config Initialization
  let configInitialized = false
  const configAccountInfo = await connection.getAccountInfo(programConfigPda)

  if (configAccountInfo) {
    console.log(
      `[InitMainnet] ProgramConfig PDA ${programConfigPda.toBase58()} is already initialized.`
    )
    configInitialized = true
  } else {
    console.log(`[InitMainnet] ProgramConfig PDA ${programConfigPda.toBase58()} is uninitialized.`)

    const attestorPubkey = process.env.SOLANA_ATTESTOR_PUBKEY
      ? new PublicKey(process.env.SOLANA_ATTESTOR_PUBKEY)
      : process.env.SQUADS_VAULT_PDA
        ? new PublicKey(process.env.SQUADS_VAULT_PDA)
        : signer.publicKey

    const pauserPubkey = process.env.SOLANA_PAUSER_PUBKEY
      ? new PublicKey(process.env.SOLANA_PAUSER_PUBKEY)
      : process.env.SQUADS_VAULT_PDA
        ? new PublicKey(process.env.SQUADS_VAULT_PDA)
        : signer.publicKey

    const clusterDomainHex = process.env.SOLANA_CLUSTER_DOMAIN?.replace(/^0x/, '')
    const clusterDomain = clusterDomainHex
      ? Buffer.from(clusterDomainHex, 'hex')
      : crypto.createHash('sha256').update('ASOL_MAINNET_V1').digest()

    if (clusterDomain.length !== 32) {
      throw new Error(`Cluster domain must be exactly 32 bytes, got ${clusterDomain.length}`)
    }

    if (options.dryRun) {
      console.log(
        `[InitMainnet] [DRY RUN] Would initialize ProgramConfig with:` +
          `\n  Admin: ${signer.publicKey.toBase58()}` +
          `\n  Attestor: ${attestorPubkey.toBase58()}` +
          `\n  Pauser: ${pauserPubkey.toBase58()}` +
          `\n  Cluster Domain: 0x${clusterDomain.toString('hex')}`
      )
    } else {
      console.log(`[InitMainnet] Submitting initialize_config transaction...`)
      const sig = await program.methods
        .initializeConfig(attestorPubkey, pauserPubkey, Array.from(clusterDomain))
        .accountsStrict({
          programConfig: programConfigPda,
          admin: signer.publicKey,
          program: programId,
          programData: programDataAddress,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'finalized' })

      console.log(`[InitMainnet] ProgramConfig initialized! Tx: ${sig}`)
      configInitialized = true
    }
  }

  // 5. ESMS Mints Initialization
  let mintsInitialized = false
  const mintAccountInfos = await connection.getMultipleAccountsInfo(mintAddresses as PublicKey[])
  const allMintsExist = mintAccountInfos.every(
    info => info !== null && info.data.length >= TOKEN_2022_TLV_START
  )

  if (allMintsExist) {
    console.log(`[InitMainnet] All 4 ESMS Token-2022 mint accounts are already initialized.`)
    mintsInitialized = true
  } else {
    if (options.dryRun) {
      console.log(
        `[InitMainnet] [DRY RUN] Would initialize 4 ESMS Token-2022 mints:` +
          mintAddresses.map((m, i) => `\n  ${ESMS_NAMES[i]}: ${m.toBase58()}`).join('')
      )
    } else {
      console.log(`[InitMainnet] Submitting initialize_esms_mints transaction...`)
      const sig = await program.methods
        .initializeEsmsMints()
        .accountsStrict({
          programConfig: programConfigPda,
          admin: signer.publicKey,
          spiritMint: mintAddresses[0],
          essenceMint: mintAddresses[1],
          matterMint: mintAddresses[2],
          substanceMint: mintAddresses[3],
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .rpc({ commitment: 'finalized' })

      console.log(`[InitMainnet] 4 ESMS mints initialized! Tx: ${sig}`)
      mintsInitialized = true
    }
  }

  // 6. On-Chain Mint Validation
  const verifiedMints: MintVerificationResult[] = []
  if (!options.dryRun || allMintsExist) {
    const updatedMintInfos = await connection.getMultipleAccountsInfo(mintAddresses as PublicKey[])
    for (let i = 0; i < 4; i++) {
      const info = updatedMintInfos[i]
      if (!info) {
        throw new Error(`Mint account ${mintAddresses[i].toBase58()} does not exist on-chain!`)
      }
      if (!info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
        throw new Error(
          `Mint account owner is ${info.owner.toBase58()}, expected ${TOKEN_2022_PROGRAM_ID.toBase58()}`
        )
      }
      const verified = validateMintAccountData(info.data, mintAddresses[i], i, programConfigPda)
      if (!verified.isValid) {
        throw new Error(
          `Mint ${ESMS_NAMES[i]} (${mintAddresses[i].toBase58()}) failed extension validation!`
        )
      }
      verifiedMints.push(verified)
      console.log(
        `[InitMainnet] ✅ Verified ${verified.element} (${verified.symbol}) Mint: ${verified.address}` +
          ` | URI: ${verified.metadataUri}`
      )
    }
  } else {
    // Provide simulated verification in dry run
    for (let i = 0; i < 4; i++) {
      verifiedMints.push({
        mintIndex: i,
        element: ESMS_NAMES[i],
        symbol: ESMS_SYMBOLS[i],
        address: mintAddresses[i].toBase58(),
        metadataUri: ESMS_METADATA_URIS[i],
        hasNonTransferable: true,
        hasPermanentDelegate: true,
        hasMetadataPointer: true,
        hasTokenMetadata: true,
        hasPermissionedBurn: true,
        decimals: 4,
        isValid: true,
      })
    }
  }

  // 7. Write Deployment Receipt
  const deploymentsPath = path.resolve(
    options.deploymentsFile ?? path.join(process.cwd(), 'deployments', 'solana-mainnet.json')
  )

  let existingDeployments: Record<string, unknown> = {}
  try {
    const raw = await fs.readFile(deploymentsPath, 'utf8')
    existingDeployments = JSON.parse(raw)
  } catch {
    // Fresh file
  }

  const receipt: InitMainnetReceipt = {
    cluster: isMainnet ? 'mainnet-beta' : 'devnet',
    genesisHash,
    programId: programId.toBase58(),
    programConfigPda: programConfigPda.toBase58(),
    programDataAddress: programDataAddress.toBase58(),
    deployer: signer.publicKey.toBase58(),
    signerProvider: signer.provider,
    configInitialized,
    mintsInitialized,
    mints: verifiedMints,
    dryRun: options.dryRun,
    timestamp: new Date().toISOString(),
  }

  const updatedDeployments = {
    ...existingDeployments,
    ...receipt,
    status: options.dryRun ? 'dry_run_completed' : 'initialized',
  }

  await fs.mkdir(path.dirname(deploymentsPath), { recursive: true })
  await fs.writeFile(deploymentsPath, JSON.stringify(updatedDeployments, null, 2), 'utf8')
  console.log(`[InitMainnet] Deployment receipt updated at: ${deploymentsPath}`)

  return receipt
}

// Run CLI directly
if (
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith('init-mainnet.ts')
) {
  const options = parseArgs(process.argv.slice(2))
  initMainnet(options)
    .then(receipt => {
      console.log('\n=============================================================')
      console.log('🎉 Solana Mainnet Initialization Completed Successfully')
      console.log('=============================================================')
      console.log(`Cluster:        ${receipt.cluster}`)
      console.log(`Genesis Hash:   ${receipt.genesisHash}`)
      console.log(`Program ID:     ${receipt.programId}`)
      console.log(`Program Config: ${receipt.programConfigPda}`)
      console.log(`Deployer:       ${receipt.deployer} (${receipt.signerProvider})`)
      console.log(`Mode:           ${receipt.dryRun ? 'DRY-RUN' : 'LIVE'}`)
      console.log('=============================================================\n')
      process.exit(0)
    })
    .catch(err => {
      console.error('\n❌ Initialization failed with error:', err)
      process.exit(1)
    })
}
