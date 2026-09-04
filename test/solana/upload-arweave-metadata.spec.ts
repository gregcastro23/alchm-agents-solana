import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Keypair } from '@solana/web3.js'
import { KmsSolanaSigner } from '@/lib/solana/kms-signer'
import * as adapterModule from '@/lib/solana/irys-signer-adapter'
import {
  KmsIrysSignerAdapter,
  ARWEAVE_SOLANA_SIGNATURE_TYPE,
  ED25519_SIGNATURE_LENGTH,
  ED25519_OWNER_LENGTH,
} from '@/lib/solana/irys-signer-adapter'
import {
  runUploadArweaveMetadata,
  computeSha256,
  ESMS_ORDER,
} from '@/scripts/metadata/upload-arweave-metadata'

describe('Irys Signer Adapter & Upload Automation', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('bridges KmsSolanaSigner with Irys Signer contract and verifies valid detached signatures', async () => {
    const keypair = Keypair.generate()
    const kmsSigner = new KmsSolanaSigner({
      provider: 'local',
      publicKey: keypair.publicKey,
      keypair,
    })

    const irysAdapter = new KmsIrysSignerAdapter(kmsSigner)

    expect(irysAdapter.signatureType).toBe(ARWEAVE_SOLANA_SIGNATURE_TYPE)
    expect(irysAdapter.signatureLength).toBe(ED25519_SIGNATURE_LENGTH)
    expect(irysAdapter.ownerLength).toBe(ED25519_OWNER_LENGTH)
    expect(irysAdapter.publicKey).toEqual(Buffer.from(keypair.publicKey.toBytes()))

    const testMessage = Buffer.from('Alchm Arweave Token Manifest Payload', 'utf8')
    const signature = await irysAdapter.sign(testMessage)

    expect(signature.length).toBe(64)
    const verified = irysAdapter.verify(irysAdapter.publicKey, testMessage, signature)
    expect(verified).toBe(true)

    // Verification fails with tampered message
    const tamperedMessage = Buffer.from('Tampered Payload', 'utf8')
    const badVerify = irysAdapter.verify(irysAdapter.publicKey, tamperedMessage, signature)
    expect(badVerify).toBe(false)
  })

  it('runs upload automation in dry-run mode without modifying state or spending funds', async () => {
    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))

    const manifest = await runUploadArweaveMetadata({
      dryRun: true,
      irysNetwork: 'mainnet',
      workspaceRoot: process.cwd(),
    })

    expect(manifest).toBeDefined()
    expect(manifest.version).toBe('1.0.0')
  })

  it('rejects live upload if irys-network is not mainnet', async () => {
    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))

    await expect(
      runUploadArweaveMetadata({
        dryRun: false,
        confirm: true,
        irysNetwork: 'devnet',
        workspaceRoot: process.cwd(),
      })
    ).rejects.toThrow(/Live upload rejected: Irys network is "devnet"/)
  })

  it('rejects local provider on live mainnet execution when --allow-local-payer is false', async () => {
    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))

    await expect(
      runUploadArweaveMetadata({
        dryRun: false,
        confirm: true,
        irysNetwork: 'mainnet',
        allowLocalPayer: false,
        workspaceRoot: process.cwd(),
      })
    ).rejects.toThrow(/Security violation: Live mainnet upload requires a Cloud KMS signer/)
  })

  it('executes two-pass upload with image patching and readback verification against mocked Irys', async () => {
    const tempDir = path.join(os.tmpdir(), '.tmp-test-uploader-' + Date.now())
    const metadataDir = path.join(tempDir, 'metadata', 'solana')
    const iconsDir = path.join(metadataDir, 'icons')
    const tokensDir = path.join(metadataDir, 'tokens')

    await fs.mkdir(iconsDir, { recursive: true })
    await fs.mkdir(tokensDir, { recursive: true })

    // Copy SVG icons and JSON tokens to tempDir
    for (const el of ESMS_ORDER) {
      const svgSrc = path.join(process.cwd(), 'metadata', 'solana', 'icons', `${el}.svg`)
      const jsonSrc = path.join(process.cwd(), 'metadata', 'solana', 'tokens', `${el}.json`)
      await fs.copyFile(svgSrc, path.join(iconsDir, `${el}.svg`))
      await fs.copyFile(jsonSrc, path.join(tokensDir, `${el}.json`))
    }

    const uploadedAssets: Array<{ buffer: Buffer; tags: any[]; id: string }> = []
    let uploadCounter = 0

    const mockUploader = {
      upload: vi.fn(async (buffer: Buffer, options: { tags: any[] }) => {
        uploadCounter++
        const mockId = `mockArweaveTxId${uploadCounter.toString().padStart(28, '0')}`
        uploadedAssets.push({ buffer, tags: options.tags, id: mockId })
        return { id: mockId }
      }),
    }

    vi.spyOn(adapterModule, 'createIrysUploader').mockResolvedValue(mockUploader as any)

    // Mock fetch for readback verification
    const globalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
      const urlStr = url.toString()
      const match = urlStr.match(/https:\/\/arweave\.net\/(mockArweaveTxId\d+)/)
      if (match) {
        const found = uploadedAssets.find(a => a.id === match[1])
        if (found) {
          // Node `Buffer` is not a `BodyInit`; its backing bytes are.
          return new Response(new Uint8Array(found.buffer), { status: 200 })
        }
      }
      return new Response('Not Found', { status: 404 })
    }) as any

    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))
    process.env.AWS_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/mock-kms-key'
    process.env.SOLANA_SERVICE_PUBLIC_KEY = keypair.publicKey.toBase58()

    try {
      const manifest = await runUploadArweaveMetadata({
        dryRun: false,
        confirm: true,
        irysNetwork: 'mainnet',
        workspaceRoot: tempDir,
      })

      // 8 assets uploaded (4 SVGs first, 4 JSON manifests second)
      expect(mockUploader.upload).toHaveBeenCalledTimes(8)

      // First 4 calls must be SVG icons
      for (let i = 0; i < 4; i++) {
        const call = uploadedAssets[i]
        expect(call.tags.find((t: any) => t.name === 'Type')?.value).toBe('Elemental-Icon')
      }

      // Next 4 calls must be JSON manifests with patched image URIs
      for (let i = 4; i < 8; i++) {
        const call = uploadedAssets[i]
        expect(call.tags.find((t: any) => t.name === 'Type')?.value).toBe('Token-2022-Metadata')
        const json = JSON.parse(call.buffer.toString('utf8'))
        expect(json.image).toMatch(/^https:\/\/arweave\.net\/mockArweaveTxId/)
      }

      expect(manifest.irysNetwork).toBe('mainnet')
      expect(manifest.cluster).toBe('mainnet-beta')

      // Verify idempotency: re-running with populated receipt performs readback only and does not re-upload
      mockUploader.upload.mockClear()
      const secondRun = await runUploadArweaveMetadata({
        dryRun: false,
        confirm: true,
        irysNetwork: 'mainnet',
        workspaceRoot: tempDir,
      })
      expect(mockUploader.upload).not.toHaveBeenCalled()
      expect(secondRun).toBeDefined()
    } finally {
      globalThis.fetch = globalFetch
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('fails loudly when remote readback hash does not match uploaded bytes', async () => {
    const tempDir = path.join(os.tmpdir(), '.tmp-test-uploader-fail-' + Date.now())
    const metadataDir = path.join(tempDir, 'metadata', 'solana')
    const iconsDir = path.join(metadataDir, 'icons')
    const tokensDir = path.join(metadataDir, 'tokens')

    await fs.mkdir(iconsDir, { recursive: true })
    await fs.mkdir(tokensDir, { recursive: true })

    for (const el of ESMS_ORDER) {
      const svgSrc = path.join(process.cwd(), 'metadata', 'solana', 'icons', `${el}.svg`)
      const jsonSrc = path.join(process.cwd(), 'metadata', 'solana', 'tokens', `${el}.json`)
      await fs.copyFile(svgSrc, path.join(iconsDir, `${el}.svg`))
      await fs.copyFile(jsonSrc, path.join(tokensDir, `${el}.json`))
    }

    const mockUploader = {
      upload: vi.fn(async () => {
        return { id: 'mockCorruptedTxId00000000000000000000000' }
      }),
    }

    vi.spyOn(adapterModule, 'createIrysUploader').mockResolvedValue(mockUploader as any)

    // Mock fetch returning corrupted byte stream
    const globalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async () => {
      return new Response(Buffer.from('Corrupted Byte Stream', 'utf8'), { status: 200 })
    }) as any

    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))
    process.env.AWS_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/mock-kms-key'
    process.env.SOLANA_SERVICE_PUBLIC_KEY = keypair.publicKey.toBase58()

    try {
      await expect(
        runUploadArweaveMetadata({
          dryRun: false,
          confirm: true,
          irysNetwork: 'mainnet',
          workspaceRoot: tempDir,
        })
      ).rejects.toThrow(/Readback hash mismatch on icons\/spirit\.svg/)
    } finally {
      globalThis.fetch = globalFetch
      await fs.rm(tempDir, { recursive: true, force: true })
    }
  })

  it('computes consistent sha256 checksums across strings and buffers', () => {
    const text = 'AlchmAgentsSolana Token-2022'
    const buf = Buffer.from(text, 'utf8')

    expect(computeSha256(text)).toBe(computeSha256(buf))
  })
})
