// @vitest-environment node

import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { PublicKey } from '@solana/web3.js'
import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getEsmsMintAddresses,
  getProgramConfigAddress,
} from '@/lib/solana/esms'
import { SOLANA_MAINNET_GENESIS_HASH } from '@/lib/solana/network-config'
import { ESMS_METADATA_URIS, ESMS_NAMES, ESMS_SYMBOLS } from '@/lib/solana/vectors'
import {
  parseArgs,
  validateMintAccountData,
  TOKEN_2022_TLV_START,
  EXTENSION_TYPE_NON_TRANSFERABLE,
  EXTENSION_TYPE_PERMANENT_DELEGATE,
  EXTENSION_TYPE_METADATA_POINTER,
  EXTENSION_TYPE_TOKEN_METADATA,
  EXTENSION_TYPE_PERMISSIONED_BURN,
} from '@/scripts/deploy/init-mainnet'
import { getProgramDataAddress } from '@/scripts/governance/squads-multisig-runbook'

const WORKSPACE_ROOT = process.cwd()

function buildMockMintBuffer(
  authority: PublicKey,
  mintAddress: PublicKey,
  mintIndex: number,
  options: {
    decimals?: number
    isInitialized?: boolean
    freezeAuth?: PublicKey | null
    wrongAuthority?: PublicKey
    skipNonTransferable?: boolean
    skipPermanentDelegate?: boolean
    skipMetadataPointer?: boolean
    skipTokenMetadata?: boolean
    skipPermissionedBurn?: boolean
    customUri?: string
  } = {}
): Buffer {
  const buf = Buffer.alloc(512)

  const mintAuth = options.wrongAuthority ?? authority
  const decimals = options.decimals ?? 4
  const isInitialized = options.isInitialized ?? true
  const freezeAuth = options.freezeAuth ?? null

  // Base mint layout
  buf.writeUInt32LE(1, 0) // mint authority Option = Some
  mintAuth.toBuffer().copy(buf, 4)
  buf.writeBigUInt64LE(0n, 36) // supply = 0
  buf.writeUInt8(decimals, 44) // decimals
  buf.writeUInt8(isInitialized ? 1 : 0, 45) // is_initialized
  if (freezeAuth) {
    buf.writeUInt32LE(1, 46) // freeze authority Option = Some
    freezeAuth.toBuffer().copy(buf, 50)
  } else {
    buf.writeUInt32LE(0, 46) // freeze authority Option = None
  }

  let cursor = TOKEN_2022_TLV_START

  // Ext 9: NonTransferable
  if (!options.skipNonTransferable) {
    buf.writeUInt16LE(EXTENSION_TYPE_NON_TRANSFERABLE, cursor)
    buf.writeUInt16LE(0, cursor + 2)
    cursor += 4
  }

  // Ext 12: PermanentDelegate
  if (!options.skipPermanentDelegate) {
    buf.writeUInt16LE(EXTENSION_TYPE_PERMANENT_DELEGATE, cursor)
    buf.writeUInt16LE(32, cursor + 2)
    authority.toBuffer().copy(buf, cursor + 4)
    cursor += 4 + 32
  }

  // Ext 18: MetadataPointer
  if (!options.skipMetadataPointer) {
    buf.writeUInt16LE(EXTENSION_TYPE_METADATA_POINTER, cursor)
    buf.writeUInt16LE(64, cursor + 2)
    authority.toBuffer().copy(buf, cursor + 4)
    mintAddress.toBuffer().copy(buf, cursor + 4 + 32)
    cursor += 4 + 64
  }

  // Ext 19: TokenMetadata
  if (!options.skipTokenMetadata) {
    const name = Buffer.from(ESMS_NAMES[mintIndex], 'utf8')
    const sym = Buffer.from(ESMS_SYMBOLS[mintIndex], 'utf8')
    const uri = Buffer.from(options.customUri ?? ESMS_METADATA_URIS[mintIndex], 'utf8')
    const metaValLen = 32 + 32 + 4 + name.length + 4 + sym.length + 4 + uri.length

    buf.writeUInt16LE(EXTENSION_TYPE_TOKEN_METADATA, cursor)
    buf.writeUInt16LE(metaValLen, cursor + 2)
    cursor += 4

    authority.toBuffer().copy(buf, cursor)
    cursor += 32
    mintAddress.toBuffer().copy(buf, cursor)
    cursor += 32

    buf.writeUInt32LE(name.length, cursor)
    cursor += 4
    name.copy(buf, cursor)
    cursor += name.length

    buf.writeUInt32LE(sym.length, cursor)
    cursor += 4
    sym.copy(buf, cursor)
    cursor += sym.length

    buf.writeUInt32LE(uri.length, cursor)
    cursor += 4
    uri.copy(buf, cursor)
    cursor += uri.length
  }

  // Ext 28: PermissionedBurn
  if (!options.skipPermissionedBurn) {
    buf.writeUInt16LE(EXTENSION_TYPE_PERMISSIONED_BURN, cursor)
    buf.writeUInt16LE(32, cursor + 2)
    authority.toBuffer().copy(buf, cursor + 4)
    cursor += 4 + 32
  }

  return buf.subarray(0, cursor)
}

describe('Solana Mainnet Deployment & Initialization Tooling (Workstream 5)', () => {
  const authority = getProgramConfigAddress(ASOL_SOLANA_PROGRAM_ID)
  const mints = getEsmsMintAddresses(ASOL_SOLANA_PROGRAM_ID)

  describe('init-mainnet CLI Arg Parsing', () => {
    it('parses all flags and default options correctly', () => {
      const defaultOpts = parseArgs([])
      expect(defaultOpts.dryRun).toBe(false)
      expect(defaultOpts.allowDevnet).toBe(false)
      expect(defaultOpts.allowLocalSigner).toBe(false)
      expect(defaultOpts.skipUriLivenessCheck).toBe(false)
      expect(defaultOpts.rpcUrl).toBeUndefined()
      expect(defaultOpts.deploymentsFile).toBeUndefined()

      const fullOpts = parseArgs([
        '--dry-run',
        '--allow-devnet',
        '--allow-local-signer',
        '--skip-uri-liveness-check',
        '--rpc-url',
        'https://my-rpc.com',
        '--deployments-file',
        'custom-deploy.json',
      ])

      expect(fullOpts.dryRun).toBe(true)
      expect(fullOpts.allowDevnet).toBe(true)
      expect(fullOpts.allowLocalSigner).toBe(true)
      expect(fullOpts.skipUriLivenessCheck).toBe(true)
      expect(fullOpts.rpcUrl).toBe('https://my-rpc.com')
      expect(fullOpts.deploymentsFile).toBe('custom-deploy.json')
    })
  })

  describe('Token-2022 On-Chain Mint Layout Validation', () => {
    it('validates a compliant Token-2022 mint account buffer for each element', () => {
      for (let i = 0; i < 4; i++) {
        const buf = buildMockMintBuffer(authority, mints[i], i)
        const result = validateMintAccountData(buf, mints[i], i, authority)

        expect(result.isValid).toBe(true)
        expect(result.mintIndex).toBe(i)
        expect(result.element).toBe(ESMS_NAMES[i])
        expect(result.symbol).toBe(ESMS_SYMBOLS[i])
        expect(result.address).toBe(mints[i].toBase58())
        expect(result.metadataUri).toBe(ESMS_METADATA_URIS[i])
        expect(result.hasNonTransferable).toBe(true)
        expect(result.hasPermanentDelegate).toBe(true)
        expect(result.hasMetadataPointer).toBe(true)
        expect(result.hasTokenMetadata).toBe(true)
        expect(result.hasPermissionedBurn).toBe(true)
        expect(result.decimals).toBe(4)
      }
    })

    it('rejects mint buffer if decimals != 4', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { decimals: 6 })
      expect(() => validateMintAccountData(buf, mints[0], 0, authority)).toThrow(
        /decimals = 6, expected 4/
      )
    })

    it('rejects mint buffer if uninitialized', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { isInitialized: false })
      expect(() => validateMintAccountData(buf, mints[0], 0, authority)).toThrow(
        /is not initialized/
      )
    })

    it('rejects mint buffer if freeze authority is configured', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { freezeAuth: authority })
      expect(() => validateMintAccountData(buf, mints[0], 0, authority)).toThrow(
        /has freeze authority, expected None/
      )
    })

    it('rejects mint buffer if mint authority does not match programConfigPda', () => {
      const wrongAuth = new PublicKey('11111111111111111111111111111111')
      const buf = buildMockMintBuffer(authority, mints[0], 0, { wrongAuthority: wrongAuth })
      expect(() => validateMintAccountData(buf, mints[0], 0, authority)).toThrow(
        /authority is 11111111111111111111111111111111, expected/
      )
    })

    it('rejects mint buffer if NonTransferable extension is missing', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { skipNonTransferable: true })
      const res = validateMintAccountData(buf, mints[0], 0, authority)
      expect(res.hasNonTransferable).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('rejects mint buffer if PermanentDelegate extension is missing', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { skipPermanentDelegate: true })
      const res = validateMintAccountData(buf, mints[0], 0, authority)
      expect(res.hasPermanentDelegate).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('rejects mint buffer if MetadataPointer extension is missing', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { skipMetadataPointer: true })
      const res = validateMintAccountData(buf, mints[0], 0, authority)
      expect(res.hasMetadataPointer).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('rejects mint buffer if TokenMetadata URI does not match permanent Arweave URI', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, {
        customUri: 'https://arweave.net/tampered-uri',
      })
      const res = validateMintAccountData(buf, mints[0], 0, authority)
      expect(res.hasTokenMetadata).toBe(false)
      expect(res.isValid).toBe(false)
    })

    it('rejects mint buffer if PermissionedBurn extension is missing', () => {
      const buf = buildMockMintBuffer(authority, mints[0], 0, { skipPermissionedBurn: true })
      const res = validateMintAccountData(buf, mints[0], 0, authority)
      expect(res.hasPermissionedBurn).toBe(false)
      expect(res.isValid).toBe(false)
    })
  })

  describe('Deployments JSON Schema & Receipts (deployments/solana-mainnet.json)', () => {
    it('aligns with canonical program constants and Arweave URIs', async () => {
      const deploymentPath = path.join(WORKSPACE_ROOT, 'deployments', 'solana-mainnet.json')
      const content = JSON.parse(await fs.readFile(deploymentPath, 'utf8'))

      expect(content.cluster).toBe('mainnet-beta')
      expect(content.genesisHash).toBe(SOLANA_MAINNET_GENESIS_HASH)
      expect(content.programId).toBe(ASOL_SOLANA_PROGRAM_ID.toBase58())
      expect(content.programConfigPda).toBe(
        getProgramConfigAddress(ASOL_SOLANA_PROGRAM_ID).toBase58()
      )
      expect(content.programDataAddress).toBe(
        getProgramDataAddress(ASOL_SOLANA_PROGRAM_ID).toBase58()
      )
      expect(content.token2022ProgramId).toBe(TOKEN_2022_PROGRAM_ID.toBase58())

      const mintKeys = ['spirit', 'essence', 'matter', 'substance'] as const
      for (let i = 0; i < 4; i++) {
        const key = mintKeys[i]
        const m = content.mints[key]
        expect(m.mintIndex).toBe(i)
        expect(m.address).toBe(mints[i].toBase58())
        expect(m.name).toBe(ESMS_NAMES[i])
        expect(m.symbol).toBe(ESMS_SYMBOLS[i])
        expect(m.decimals).toBe(4)
        expect(m.metadataUri).toBe(ESMS_METADATA_URIS[i])
      }
    })
  })

  describe('Deployment Script Security & Attributes (deploy-mainnet.sh)', () => {
    it('verifies deploy-mainnet.sh exists, is executable, and contains strict guards', async () => {
      const scriptPath = path.join(WORKSPACE_ROOT, 'scripts', 'deploy', 'deploy-mainnet.sh')
      const stat = await fs.stat(scriptPath)
      // Executable bit check: 0o111
      expect(stat.mode & 0o111).toBeGreaterThan(0)

      const scriptContent = await fs.readFile(scriptPath, 'utf8')
      expect(scriptContent).toContain('set -euo pipefail')
      expect(scriptContent).toContain(SOLANA_MAINNET_GENESIS_HASH)
      expect(scriptContent).toContain(ASOL_SOLANA_PROGRAM_ID.toBase58())
      expect(scriptContent).toContain('backpackapp/build:v0.30.1')
      expect(scriptContent).toContain('init-mainnet.ts')
      expect(scriptContent).toContain('solana-verify')
    })
  })

  describe('Production Environment Sample (.env.production.sample)', () => {
    it('verifies critical Mainnet and KMS configuration parameters', async () => {
      const envPath = path.join(WORKSPACE_ROOT, '.env.production.sample')
      const envContent = await fs.readFile(envPath, 'utf8')

      expect(envContent).toContain('SOLANA_NETWORK=mainnet-beta')
      expect(envContent).toContain('SOLANA_ALLOW_LOCAL_PAYER_IN_PROD=false')
      expect(envContent).toContain('AWS_KMS_KEY_ID=')
      expect(envContent).toContain('GCP_KMS_KEY_NAME=')
      expect(envContent).toContain('SOLANA_SERVICE_PUBLIC_KEY=')
      expect(envContent).toContain('SOLANA_COMMITMENT=finalized')
      expect(envContent).toContain(`SOLANA_PROGRAM_ID=${ASOL_SOLANA_PROGRAM_ID.toBase58()}`)
      expect(envContent).toContain(`SOLANA_ESMS_MINT_SPIRIT=${mints[0].toBase58()}`)
      expect(envContent).toContain(`SOLANA_ESMS_MINT_ESSENCE=${mints[1].toBase58()}`)
      expect(envContent).toContain(`SOLANA_ESMS_MINT_MATTER=${mints[2].toBase58()}`)
      expect(envContent).toContain(`SOLANA_ESMS_MINT_SUBSTANCE=${mints[3].toBase58()}`)
    })
  })
})
