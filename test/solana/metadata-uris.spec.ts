import { promises as fs } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import Ajv from 'ajv'
import addFormats from 'ajv-formats'
import prettier from 'prettier'
import {
  ESMS_NAMES,
  ESMS_SYMBOLS,
  ESMS_METADATA_URIS,
  MAX_LEDGER_ATOMS,
} from '@/lib/solana/vectors'
import {
  FIXED_ACCOUNT_LEN,
  TLV_HEADER_LEN,
  computeMetadataValueLen,
  computeTotalMintAccountLen,
  calculateRentExemptLamports,
  computeSha256,
} from '@/scripts/metadata/upload-arweave-metadata'

const WORKSPACE_ROOT = process.cwd()
const TOKENS = ['spirit', 'essence', 'matter', 'substance'] as const

describe('Token-2022 Metadata, Schemas & Program Constant Integrity', () => {
  it('aligns Rust constants in programs/asol_program/src/constants.rs with lib/solana/vectors.ts', async () => {
    const constantsRsPath = path.join(
      WORKSPACE_ROOT,
      'programs',
      'asol_program',
      'src',
      'constants.rs'
    )
    const rustSource = await fs.readFile(constantsRsPath, 'utf8')

    // Extract ESMS_NAMES
    const namesMatch = rustSource.match(
      /pub const ESMS_NAMES:\s*\[&str;\s*ESMS_MINT_COUNT\]\s*=\s*\[([^\]]+)\];/
    )
    expect(namesMatch).not.toBeNull()
    const parsedNames = namesMatch![1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)

    // Extract ESMS_SYMBOLS
    const symbolsMatch = rustSource.match(
      /pub const ESMS_SYMBOLS:\s*\[&str;\s*ESMS_MINT_COUNT\]\s*=\s*\[([^\]]+)\];/
    )
    expect(symbolsMatch).not.toBeNull()
    const parsedSymbols = symbolsMatch![1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)

    // Extract ESMS_METADATA_URIS
    const urisMatch = rustSource.match(
      /pub const ESMS_METADATA_URIS:\s*\[&str;\s*ESMS_MINT_COUNT\]\s*=\s*\[([^\]]+)\];/
    )
    expect(urisMatch).not.toBeNull()
    const parsedUris = urisMatch![1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)

    // Extract MAX_LEDGER_ATOMS
    const maxLedgerMatch = rustSource.match(/pub const MAX_LEDGER_ATOMS:\s*u64\s*=\s*([0-9_]+);/)
    expect(maxLedgerMatch).not.toBeNull()
    const rustMaxLedgerAtoms = BigInt(maxLedgerMatch![1].replace(/_/g, ''))
    expect(MAX_LEDGER_ATOMS).toBe(rustMaxLedgerAtoms)
    expect(MAX_LEDGER_ATOMS).toBe(999_999_999_999n)

    expect(parsedNames).toEqual(Array.from(ESMS_NAMES))
    expect(parsedSymbols).toEqual(Array.from(ESMS_SYMBOLS))
    expect(parsedUris).toEqual(Array.from(ESMS_METADATA_URIS))
  })

  it('verifies Rust esms_mint_fixed_account_len test exists and matches TypeScript FIXED_ACCOUNT_LEN (310)', async () => {
    const esmsRsPath = path.join(
      WORKSPACE_ROOT,
      'programs',
      'asol_program',
      'src',
      'instructions',
      'esms.rs'
    )
    const esmsSource = await fs.readFile(esmsRsPath, 'utf8')

    // Verify Rust authoritative assertion with formatting-resilient regex
    expect(esmsSource).toMatch(
      /assert_eq!\s*\(\s*esms_mint_fixed_account_len\s*\(\s*\)\s*\.unwrap\s*\(\s*\)\s*,\s*310\s*\)\s*;/
    )
    expect(FIXED_ACCOUNT_LEN).toBe(310)
  })

  it('verifies off-chain token manifests byte-match on-chain ESMS_NAMES and ESMS_SYMBOLS exactly', async () => {
    for (let i = 0; i < TOKENS.length; i++) {
      const token = TOKENS[i]
      const manifestPath = path.join(
        WORKSPACE_ROOT,
        'metadata',
        'solana',
        'tokens',
        `${token}.json`
      )
      const content = JSON.parse(await fs.readFile(manifestPath, 'utf8'))

      // Exact match check representing on-chain esms.rs:481-483 validation
      expect(content.name).toBe(ESMS_NAMES[i])
      expect(content.symbol).toBe(ESMS_SYMBOLS[i])
      expect(content.decimals).toBe(4)

      // Ensure additional metadata / traits are purely off-chain
      expect(Array.isArray(content.attributes)).toBe(true)
      expect(content.attributes.length).toBe(4)

      const attrMap = Object.fromEntries(
        content.attributes.map((a: { trait_type: string; value: string | number }) => [
          a.trait_type,
          a.value,
        ])
      )
      expect(attrMap.Decimals).toBe(4)
      expect(attrMap.Soulbound).toBe('Non-Transferable')
      expect(attrMap.BurnAuthority).toBe('Permissioned')
    }
  })

  it('validates all off-chain token manifests against manifest.schema.json via AJV', async () => {
    const schemaPath = path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'manifest.schema.json')
    const schemaJson = JSON.parse(await fs.readFile(schemaPath, 'utf8'))

    const ajv = new Ajv({ allErrors: true, strict: false })
    addFormats(ajv)
    const validate = ajv.compile(schemaJson)

    for (const token of TOKENS) {
      const manifestPath = path.join(
        WORKSPACE_ROOT,
        'metadata',
        'solana',
        'tokens',
        `${token}.json`
      )
      const data = JSON.parse(await fs.readFile(manifestPath, 'utf8'))
      const valid = validate(data)
      if (!valid) {
        console.error(`Validation errors for ${token}.json:`, validate.errors)
      }
      expect(valid).toBe(true)
    }
  })

  it('verifies arweave-manifest.json receipt and cross-references live constants', async () => {
    const manifestReceiptPath = path.join(
      WORKSPACE_ROOT,
      'metadata',
      'solana',
      'arweave-manifest.json'
    )
    const raw = await fs.readFile(manifestReceiptPath, 'utf8')
    const receipt = JSON.parse(raw)

    expect(receipt.version).toBe('1.0.0')
    expect(receipt.assets).toBeDefined()

    const isPopulated = Object.values(receipt.assets).some((a: any) => a.txId !== null)

    if (isPopulated) {
      expect(receipt.cluster).toBe('mainnet-beta')
      expect(receipt.irysNetwork).toBe('mainnet')
      expect(receipt.uploadedAtIso).not.toBeNull()

      for (let i = 0; i < TOKENS.length; i++) {
        const token = TOKENS[i]
        const iconEntry = receipt.assets[`icons/${token}.svg`]
        const tokenEntry = receipt.assets[`tokens/${token}.json`]

        expect(iconEntry.txId).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(iconEntry.uri).toBe(`https://arweave.net/${iconEntry.txId}`)
        expect(iconEntry.irysNetwork).toBe('mainnet')

        expect(tokenEntry.txId).toMatch(/^[A-Za-z0-9_-]{43}$/)
        expect(tokenEntry.uri).toBe(`https://arweave.net/${tokenEntry.txId}`)
        expect(tokenEntry.irysNetwork).toBe('mainnet')

        // Constants must match the verified receipt
        expect(ESMS_METADATA_URIS[i]).toBe(tokenEntry.uri)
      }
    } else {
      // Pre-upload receipt state
      expect(receipt.cluster).toBeNull()
      expect(receipt.irysNetwork).toBeNull()
      expect(receipt.uploadedAtIso).toBeNull()

      for (const token of TOKENS) {
        const iconEntry = receipt.assets[`icons/${token}.svg`]
        const tokenEntry = receipt.assets[`tokens/${token}.json`]

        expect(iconEntry.txId).toBeNull()
        expect(iconEntry.uri).toBeNull()
        expect(iconEntry.sha256).toBeNull()

        expect(tokenEntry.txId).toBeNull()
        expect(tokenEntry.uri).toBeNull()
        expect(tokenEntry.sha256).toBeNull()
      }
    }
  })

  it('pins account sizes and rent balances directly derived from ESMS_METADATA_URIS constants', () => {
    expect(FIXED_ACCOUNT_LEN).toBe(310)
    expect(TLV_HEADER_LEN).toBe(4)

    // Compute expected sizes based directly on the authoritative ESMS_METADATA_URIS
    // If constants are current placeholders (length 47..50):
    // Spirit (47):    310 + 4 + 80 + 6 (Spirit) + 6 (SPIRIT) + 47 = 453 bytes -> rent: (453 + 128) * 6960 = 4,043,760 lamports
    // Essence (48):   310 + 4 + 80 + 7 (Essence) + 7 (ESSENCE) + 48 = 456 bytes -> rent: (456 + 128) * 6960 = 4,064,640 lamports
    // Matter (47):    310 + 4 + 80 + 6 (Matter) + 6 (MATTER) + 47 = 453 bytes -> rent: (453 + 128) * 6960 = 4,043,760 lamports
    // Substance (50): 310 + 4 + 80 + 9 (Substance) + 9 (SUBSTANCE) + 50 = 462 bytes -> rent: (462 + 128) * 6960 = 4,106,400 lamports
    const expectedCurrentValueLens = [139, 142, 139, 148]
    const expectedCurrentTotalLens = [453, 456, 453, 462]
    const expectedCurrentLamports = [4_043_760n, 4_064_640n, 4_043_760n, 4_106_400n]

    // If permanent Arweave URIs (length 64 with 44-char txId):
    // Spirit: 470 bytes -> 4,162,080 lamports
    // Essence: 472 bytes -> 4,176,000 lamports
    // Matter: 470 bytes -> 4,162,080 lamports
    // Substance: 476 bytes -> 4,203,840 lamports
    const expectedArweaveTotalLens = [470, 472, 470, 476]
    const expectedArweaveLamports = [4_162_080n, 4_176_000n, 4_162_080n, 4_203_840n]

    const isArweaveUri = ESMS_METADATA_URIS[0].startsWith('https://arweave.net/')

    for (let i = 0; i < TOKENS.length; i++) {
      const uriLen = ESMS_METADATA_URIS[i].length
      const valLen = computeMetadataValueLen(i, uriLen)
      const totalLen = computeTotalMintAccountLen(i, uriLen)
      const lamports = calculateRentExemptLamports(totalLen)

      if (isArweaveUri) {
        expect(totalLen).toBe(expectedArweaveTotalLens[i])
        expect(lamports).toBe(expectedArweaveLamports[i])
      } else {
        expect(valLen).toBe(expectedCurrentValueLens[i])
        expect(totalLen).toBe(expectedCurrentTotalLens[i])
        expect(lamports).toBe(expectedCurrentLamports[i])
      }
    }
  })

  it('enforces strict SVG security and self-containment for elemental icons', async () => {
    for (const token of TOKENS) {
      const iconPath = path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'icons', `${token}.svg`)
      const svg = await fs.readFile(iconPath, 'utf8')

      // Structural requirements
      expect(svg).toContain('<svg')
      expect(svg).toContain('</svg>')
      expect(svg).toContain('viewBox="0 0 512 512"')

      // Security gates: no scripts, no foreign objects, no external links or imports
      expect(svg.toLowerCase()).not.toContain('<script')
      expect(svg.toLowerCase()).not.toContain('<foreignobject')
      expect(svg.toLowerCase()).not.toContain('href="http')
      expect(svg.toLowerCase()).not.toContain('xlink:href="http')
      expect(svg.toLowerCase()).not.toContain('@import')
      expect(svg.toLowerCase()).not.toContain('url(http')
    }
  })

  it('guarantees Prettier formatting idempotence across all metadata JSON files', async () => {
    const files = [
      path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'manifest.schema.json'),
      path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'arweave-manifest.json'),
      ...TOKENS.map(t => path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'tokens', `${t}.json`)),
    ]

    for (const file of files) {
      const content = await fs.readFile(file, 'utf8')
      const options = (await prettier.resolveConfig(file)) ?? {}
      const formatted = await prettier.format(content, {
        ...options,
        filepath: file,
        parser: 'json',
      })
      expect(content).toBe(formatted)
    }
  })

  it('enforces manifest parity and image wiring across manifests, constants, and icons', async () => {
    const manifestReceiptPath = path.join(
      WORKSPACE_ROOT,
      'metadata',
      'solana',
      'arweave-manifest.json'
    )
    const receipt = JSON.parse(await fs.readFile(manifestReceiptPath, 'utf8'))

    const constantsRsPath = path.join(
      WORKSPACE_ROOT,
      'programs',
      'asol_program',
      'src',
      'constants.rs'
    )
    const rustSource = await fs.readFile(constantsRsPath, 'utf8')
    const urisMatch = rustSource.match(
      /pub const ESMS_METADATA_URIS:\s*\[&str;\s*ESMS_MINT_COUNT\]\s*=\s*\[([^\]]+)\];/
    )
    expect(urisMatch).not.toBeNull()
    const parsedConstantsUris = urisMatch![1]
      .split(',')
      .map(s => s.trim().replace(/^"|"$/g, ''))
      .filter(Boolean)

    const isPopulated = Object.values(receipt.assets).some((a: any) => a.txId !== null)
    if (!isPopulated) {
      // In honest pre-upload state, all token manifests have image: null and receipt txIds are null
      for (const token of TOKENS) {
        const tokenPath = path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'tokens', `${token}.json`)
        const tokenJson = JSON.parse(await fs.readFile(tokenPath, 'utf8'))
        expect(tokenJson.image).toBeNull()
      }
      for (const [k, a] of Object.entries(receipt.assets as Record<string, any>)) {
        expect(a.txId, `${k} txId`).toBeNull()
        expect(a.uri, `${k} uri`).toBeNull()
      }
      return
    }

    // every txId must be exactly 43 base64url chars (32-byte Arweave id)
    for (const [k, a] of Object.entries(receipt.assets as Record<string, any>)) {
      expect(a.txId, `${k} txId length`).toMatch(/^[A-Za-z0-9_-]{43}$/)
      expect(a.uri, `${k} uri format`).toBe(`https://arweave.net/${a.txId}`)
    }

    for (let i = 0; i < TOKENS.length; i++) {
      const token = TOKENS[i]
      const tokenPath = path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'tokens', `${token}.json`)
      const tokenBytes = await fs.readFile(tokenPath)
      const tokenSha = computeSha256(tokenBytes)
      const tokenJson = JSON.parse(tokenBytes.toString('utf8'))

      const manifestTokenEntry = receipt.assets[`tokens/${token}.json`]
      const manifestIconEntry = receipt.assets[`icons/${token}.svg`]

      // 1. Each token JSON SHA-256 equals its arweave-manifest entry
      expect(tokenSha).toBe(manifestTokenEntry.sha256)

      // 2. Each icon SVG SHA-256 equals its arweave-manifest entry
      const iconPath = path.join(WORKSPACE_ROOT, 'metadata', 'solana', 'icons', `${token}.svg`)
      const iconBytes = await fs.readFile(iconPath)
      const iconSha = computeSha256(iconBytes)
      expect(iconSha).toBe(manifestIconEntry.sha256)

      // 3. ESMS_METADATA_URIS (parsed from constants.rs) equals manifest URIs in mint order
      expect(parsedConstantsUris[i]).toBe(manifestTokenEntry.uri)

      // 4. Each token's image equals its own icon's manifest URI
      expect(tokenJson.image).toBe(manifestIconEntry.uri)
    }
  })
})
