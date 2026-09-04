#!/usr/bin/env bun
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import fsSync from 'node:fs'
import path from 'node:path'
import prettier from 'prettier'
import { getSolanaServiceSigner } from '@/lib/solana/kms-signer'
import { createIrysUploader } from '@/lib/solana/irys-signer-adapter'
import { ESMS_NAMES, ESMS_SYMBOLS, ESMS_METADATA_URIS } from '@/lib/solana/vectors'

export const ESMS_ORDER = ['spirit', 'essence', 'matter', 'substance'] as const

export const FIXED_ACCOUNT_LEN = 310
export const TLV_HEADER_LEN = 4
export const METADATA_BASE_LEN = 80
export const LAMPORTS_PER_BYTE_YEAR = 3480n
export const ACCOUNT_STORAGE_OVERHEAD = 128n

export interface AssetManifestEntry {
  file: string
  sha256: string | null
  byteLength: number | null
  txId: string | null
  uri: string | null
  irysNetwork: string | null
  uploadedAtIso: string | null
}

export interface ArweaveManifest {
  version: string
  cluster: string | null
  irysNetwork: string | null
  uploadedAtIso: string | null
  assets: Record<string, AssetManifestEntry>
}

export function computeSha256(data: Buffer | Uint8Array | string): string {
  const buf = typeof data === 'string' ? Buffer.from(data, 'utf8') : Buffer.from(data)
  return createHash('sha256').update(buf).digest('hex')
}

export function computeTotalMintAccountLen(elementIndex: number, uriLen: number): number {
  return FIXED_ACCOUNT_LEN + TLV_HEADER_LEN + computeMetadataValueLen(elementIndex, uriLen)
}

export function computeMetadataValueLen(elementIndex: number, uriLen: number): number {
  return (
    METADATA_BASE_LEN + ESMS_NAMES[elementIndex].length + ESMS_SYMBOLS[elementIndex].length + uriLen
  )
}

export function calculateRentExemptLamports(accountLen: number): bigint {
  const totalBytes = BigInt(accountLen) + ACCOUNT_STORAGE_OVERHEAD
  return totalBytes * LAMPORTS_PER_BYTE_YEAR * 2n
}

export async function formatJsonWithPrettier(filepath: string, content: string): Promise<string> {
  const options = (await prettier.resolveConfig(filepath)) ?? {}
  return prettier.format(content, { ...options, filepath, parser: 'json' })
}

export async function normalizeTokensJson(
  workspaceRoot: string,
  writeToDisk: boolean
): Promise<void> {
  for (const element of ESMS_ORDER) {
    const filePath = path.join(workspaceRoot, 'metadata', 'solana', 'tokens', `${element}.json`)
    try {
      const raw = await fs.readFile(filePath, 'utf8')
      const formatted = await formatJsonWithPrettier(filePath, raw)
      if (writeToDisk && formatted !== raw) {
        await fs.writeFile(filePath, formatted, 'utf8')
      }
    } catch {
      // File may not exist yet in early tests
    }
  }
}

export interface UploadOptions {
  dryRun?: boolean
  confirm?: boolean
  irysNetwork?: 'mainnet' | 'devnet'
  workspaceRoot?: string
  rpcUrl?: string
  allowLocalPayer?: boolean
  skipReadback?: boolean
}

export interface FetchRemoteAssetOptions {
  maxRetries?: number
  initialBackoffMs?: number
  maxBackoffMs?: number
}

async function fetchRemoteAsset(
  uri: string,
  txId?: string,
  options: FetchRemoteAssetOptions = {}
): Promise<Buffer> {
  const maxRetries = options.maxRetries ?? 15
  let backoffMs = options.initialBackoffMs ?? 2000
  const maxBackoffMs = options.maxBackoffMs ?? 10000

  const urlsToTry = [uri]
  if (txId) {
    urlsToTry.push(`https://gateway.irys.xyz/${txId}`)
    urlsToTry.push(`https://arweave.net/${txId}`)
    urlsToTry.push(`https://arweave.live/${txId}`)
  }

  let lastError: Error | null = null
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    for (const url of urlsToTry) {
      try {
        const res = await fetch(url)
        if (res.ok) {
          return Buffer.from(await res.arrayBuffer())
        }
        lastError = new Error(`Failed to read back ${url}: ${res.status} ${res.statusText}`)
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
      }
    }

    if (attempt < maxRetries) {
      console.log(
        `  ⏳ Gateway indexing delay (attempt ${attempt}/${maxRetries}): Retrying in ${Math.round(backoffMs / 1000)}s...`
      )
      await new Promise(resolve => setTimeout(resolve, backoffMs))
      backoffMs = Math.min(Math.round(backoffMs * 1.5), maxBackoffMs)
    }
  }

  throw lastError ?? new Error(`Failed to read back ${uri} after ${maxRetries} attempts`)
}

export async function runUploadArweaveMetadata(options: UploadOptions = {}) {
  const workspaceRoot = options.workspaceRoot ?? process.cwd()
  const isConfirmed = options.confirm ?? process.argv.includes('--confirm')
  const isDryRun = options.dryRun ?? !isConfirmed
  const allowLocalPayer = options.allowLocalPayer ?? process.argv.includes('--allow-local-payer')
  const skipReadback = options.skipReadback ?? process.argv.includes('--skip-readback')
  const irysNetwork =
    options.irysNetwork ??
    (process.argv.find(a => a.startsWith('--irys-network='))?.split('=')[1] as
      | 'mainnet'
      | 'devnet'
      | undefined) ??
    'mainnet'

  // 1. Live Execution Safety Checks: Network must be mainnet
  if (!isDryRun && irysNetwork !== 'mainnet') {
    throw new Error(
      `Live upload rejected: Irys network is "${irysNetwork}". Only "--irys-network=mainnet" produces permanent arweave.net URIs suitable for immutable program constants.`
    )
  }

  // 2. Resolve Signer
  const signer = await getSolanaServiceSigner()
  if (!signer) {
    throw new Error(
      'Unable to resolve Solana service signer. Configure AWS_KMS_KEY_ID, GCP_KMS_KEY_NAME, or SOLANA_AGENT_PAYER_KEY.'
    )
  }

  // Strict check: forbid unflagged local keypair fallback on live mainnet execution
  if (!isDryRun && irysNetwork === 'mainnet' && signer.provider === 'local' && !allowLocalPayer) {
    throw new Error(
      'Security violation: Live mainnet upload requires a Cloud KMS signer (provider: aws|gcp) or explicit --allow-local-payer for throwaway burner wallets.'
    )
  }

  if (signer.provider === 'local') {
    console.log(
      `  🔑 Signer: Local burner wallet (${signer.publicKey.toBase58()}) [allowLocalPayer: ${allowLocalPayer}]`
    )
  } else {
    console.log(`\n• Signer Pubkey: ${signer.publicKey.toBase58()} (Provider: ${signer.provider})`)
  }

  // 3. Normalize and check local files
  await normalizeTokensJson(workspaceRoot, !isDryRun)

  const assetsDir = path.join(workspaceRoot, 'metadata', 'solana')
  const allRelativeFiles = [
    ...ESMS_ORDER.map(e => `icons/${e}.svg`),
    ...ESMS_ORDER.map(e => `tokens/${e}.json`),
  ]

  // 4. Inspect Local Assets
  const assetDetails: Record<
    string,
    { absPath: string; buffer: Buffer; sha256: string; byteLength: number }
  > = {}
  let totalBytes = 0

  for (const relPath of allRelativeFiles) {
    const absPath = path.join(assetsDir, relPath)
    if (!fsSync.existsSync(absPath)) {
      throw new Error(`Required metadata asset missing: ${absPath}`)
    }
    const buffer = await fs.readFile(absPath)
    const sha256 = computeSha256(buffer)
    assetDetails[relPath] = { absPath, buffer, sha256, byteLength: buffer.length }
    totalBytes += buffer.length
  }

  console.log(`\n📦 Local Assets Summary (8 files, ${totalBytes} bytes total):`)
  for (const [relPath, detail] of Object.entries(assetDetails)) {
    console.log(
      `  - ${relPath.padEnd(22)}: ${detail.byteLength.toString().padStart(6)} bytes | sha256: ${detail.sha256.slice(0, 16)}...`
    )
  }

  // 4. Load or Initialize Manifest
  const manifestPath = path.join(assetsDir, 'arweave-manifest.json')
  let manifest: ArweaveManifest
  if (fsSync.existsSync(manifestPath)) {
    try {
      manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
    } catch {
      manifest = {
        version: '1.0.0',
        cluster: null,
        irysNetwork: null,
        uploadedAtIso: null,
        assets: {},
      }
    }
  } else {
    manifest = {
      version: '1.0.0',
      cluster: null,
      irysNetwork: null,
      uploadedAtIso: null,
      assets: {},
    }
  }

  // 5. Handle Dry-Run Mode first
  if (isDryRun) {
    console.log(`\n💰 Dry-Run Estimation:`)
    console.log(`• Estimated Arweave Storage Fee: < 0.0001 SOL (${totalBytes} bytes)`)
    console.log(`• Required Funding Account:      ${signer.publicKey.toBase58()}`)
    console.log(
      `• Action:                        Pass --confirm --irys-network=mainnet to execute live upload.`
    )
    printCalculatedAccountRent(64) // 64 bytes standard Arweave URI
    return manifest
  }

  // 6. Live Execution Safety Checks
  if (irysNetwork !== 'mainnet') {
    throw new Error(
      `Live upload rejected: Irys network is "${irysNetwork}". Only "--irys-network=mainnet" produces permanent arweave.net URIs suitable for immutable program constants.`
    )
  }

  // Check if existing manifest is already fully verified
  const allAlreadyUploaded = allRelativeFiles.every(relPath => {
    const entry = manifest.assets?.[relPath]
    return entry && entry.txId && entry.uri && entry.sha256 === assetDetails[relPath].sha256
  })

  if (allAlreadyUploaded) {
    console.log(
      `\n✅ All assets already recorded with matching checksums in arweave-manifest.json.`
    )
    if (!skipReadback) {
      console.log(`Performing live readback verification without re-uploading...`)
      for (const relPath of allRelativeFiles) {
        const entry = manifest.assets[relPath]
        console.log(`  🔍 Verifying ${relPath} from ${entry.uri}...`)
        const remoteBytes = await fetchRemoteAsset(entry.uri!, entry.txId!)
        const remoteHash = computeSha256(remoteBytes)
        if (remoteHash !== entry.sha256) {
          throw new Error(
            `Hash mismatch on verified asset ${relPath}: local=${entry.sha256} remote=${remoteHash}`
          )
        }
      }
      console.log(`\n🎉 All remote assets successfully re-verified.`)
    }
    printGeneratedConstants(manifest)
    return manifest
  }

  console.log(`\n🚀 Initializing Irys Uploader on network: ${irysNetwork}...`)
  const uploader = await createIrysUploader({
    signer,
    network: irysNetwork,
    rpcUrl: options.rpcUrl,
  })

  // Two-pass upload
  // Pass 1: Upload SVGs
  console.log(`\n--- Pass 1: Uploading Elemental Icons ---`)
  const iconUris: Record<string, string> = {}
  for (const element of ESMS_ORDER) {
    const relPath = `icons/${element}.svg`
    const detail = assetDetails[relPath]
    console.log(`Uploading ${relPath} (${detail.byteLength} bytes)...`)

    const receipt = await uploader.upload(detail.buffer, {
      tags: [
        { name: 'Content-Type', value: 'image/svg+xml' },
        { name: 'App-Name', value: 'AlchmAgentsSolana' },
        { name: 'Element', value: element },
        { name: 'Type', value: 'Elemental-Icon' },
      ],
    })

    const uri = `https://arweave.net/${receipt.id}`
    console.log(`  ✓ Uploaded ${relPath} -> ${uri}`)
    iconUris[element] = uri

    manifest.assets[relPath] = {
      file: `metadata/solana/${relPath}`,
      sha256: detail.sha256,
      byteLength: detail.byteLength,
      txId: receipt.id,
      uri,
      irysNetwork,
      uploadedAtIso: new Date().toISOString(),
    }
  }

  // Pass 2: Patch manifests, re-format, re-hash, and upload
  console.log(`\n--- Pass 2: Patching & Uploading Token Manifests ---`)
  for (let i = 0; i < ESMS_ORDER.length; i++) {
    const element = ESMS_ORDER[i]
    const relPath = `tokens/${element}.json`
    const absPath = assetDetails[relPath].absPath

    // Patch image URI
    const jsonContent = JSON.parse(await fs.readFile(absPath, 'utf8'))
    jsonContent.image = iconUris[element]
    const formatted = await formatJsonWithPrettier(absPath, JSON.stringify(jsonContent, null, 2))
    await fs.writeFile(absPath, formatted, 'utf8')

    const newBuffer = Buffer.from(formatted, 'utf8')
    const newSha256 = computeSha256(newBuffer)

    console.log(`Uploading ${relPath} (${newBuffer.length} bytes)...`)
    const receipt = await uploader.upload(newBuffer, {
      tags: [
        { name: 'Content-Type', value: 'application/json' },
        { name: 'App-Name', value: 'AlchmAgentsSolana' },
        { name: 'Element', value: element },
        { name: 'Type', value: 'Token-2022-Metadata' },
      ],
    })

    const uri = `https://arweave.net/${receipt.id}`
    console.log(`  ✓ Uploaded ${relPath} -> ${uri}`)

    manifest.assets[relPath] = {
      file: `metadata/solana/${relPath}`,
      sha256: newSha256,
      byteLength: newBuffer.length,
      txId: receipt.id,
      uri,
      irysNetwork,
      uploadedAtIso: new Date().toISOString(),
    }
  }

  manifest.uploadedAtIso = new Date().toISOString()
  manifest.irysNetwork = irysNetwork
  manifest.cluster = 'mainnet-beta'

  // Write receipt
  const formattedManifest = await formatJsonWithPrettier(
    manifestPath,
    JSON.stringify(manifest, null, 2)
  )
  await fs.writeFile(manifestPath, formattedManifest, 'utf8')
  console.log(`\n📝 Saved receipt to ${path.relative(process.cwd(), manifestPath) || manifestPath}`)

  // Pass 3: Readback Verification
  console.log(`\n--- Pass 3: Readback Verification ---`)
  for (const relPath of allRelativeFiles) {
    const entry = manifest.assets[relPath]
    console.log(`Verifying remote readback from ${entry.uri}...`)
    const res = await fetch(entry.uri!)
    if (!res.ok) {
      throw new Error(`Readback failed for ${entry.uri}: ${res.status}`)
    }
    const remoteBytes = Buffer.from(await res.arrayBuffer())
    const remoteHash = computeSha256(remoteBytes)
    if (remoteHash !== entry.sha256) {
      throw new Error(
        `Readback hash mismatch on ${relPath}! Local: ${entry.sha256}, Remote: ${remoteHash}`
      )
    }
  }
  console.log(`✅ All 8 assets verified identical on Arweave.`)

  printGeneratedConstants(manifest)
  return manifest
}

function printGeneratedConstants(manifest: ArweaveManifest) {
  const uris = ESMS_ORDER.map(e => manifest.assets[`tokens/${e}.json`]?.uri ?? 'PLACEHOLDER')
  console.log(`\n📋 Replacement Block for programs/asol_program/src/constants.rs:`)
  console.log(`----------------------------------------------------------------`)
  console.log(`pub const ESMS_METADATA_URIS: [&str; ESMS_MINT_COUNT] = [`)
  uris.forEach(u => console.log(`    "${u}",`))
  console.log(`];\n`)

  printCalculatedAccountRent(uris[0]?.length || 63)
}

function printCalculatedAccountRent(uriLen: number) {
  console.log(`📊 Token-2022 Account Size & Rent Exemption Matrix (URI len: ${uriLen} bytes):`)
  console.log(`-----------------------------------------------------------------------------`)
  console.log(`Fixed account length (creation space): ${FIXED_ACCOUNT_LEN} bytes`)
  for (let i = 0; i < ESMS_ORDER.length; i++) {
    const metaValLen = computeMetadataValueLen(i, uriLen)
    const totalLen = computeTotalMintAccountLen(i, uriLen)
    const lamports = calculateRentExemptLamports(totalLen)
    const sol = Number(lamports) / 1e9
    console.log(
      `• [${i}] ${ESMS_NAMES[i].padEnd(10)}: MetaVal=${metaValLen}b | TotalLen=${totalLen}b | Rent=${lamports} lamports (${sol.toFixed(8)} SOL)`
    )
  }
  console.log(``)
}

if (import.meta.main) {
  runUploadArweaveMetadata().catch(err => {
    console.error(`\n❌ Error:`, err instanceof Error ? err.message : err)
    process.exit(1)
  })
}
