// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js'
import nacl from 'tweetnacl'

import {
  KmsSolanaSigner,
  getSolanaServiceSigner,
  type AwsKmsClientLike,
  type GcpKmsClientLike,
} from '@/lib/solana/kms-signer'
import {
  SQUADS_V4_PROGRAM_ID,
  BPF_LOADER_UPGRADEABLE_PROGRAM_ID,
  getSquadsMultisigPda,
  getSquadsVaultPda,
  getSquadsProposalPda,
  getSquadsTransactionPda,
  getProgramDataAddress,
  buildSetProgramUpgradeAuthorityInstruction,
  buildSetServiceAuthoritiesInstruction,
  generateSquadsHandoverRunbook,
} from '@/scripts/governance/squads-multisig-runbook'
import { ASOL_SOLANA_PROGRAM_ID, getProgramConfigAddress } from '@/lib/solana/esms'

describe('Cloud KMS Solana Signer (Phase 1)', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    process.env = { ...originalEnv }
    delete process.env.AWS_KMS_KEY_ID
    delete process.env.GCP_KMS_KEY_NAME
    delete process.env.SOLANA_SERVICE_PUBLIC_KEY
    delete process.env.SOLANA_AGENT_PAYER_KEY
    delete process.env.SOLANA_ALLOW_LOCAL_PAYER_IN_PROD
  })

  afterEach(() => {
    process.env = { ...originalEnv }
    vi.restoreAllMocks()
  })

  it('signs legacy Transaction and VersionedTransaction with local provider and valid Ed25519 signature', async () => {
    const keypair = Keypair.generate()
    const signer = new KmsSolanaSigner({
      provider: 'local',
      publicKey: keypair.publicKey,
      keypair,
    })

    // 1. Test legacy Transaction
    const blockhash = Keypair.generate().publicKey.toBase58()
    const recipient = Keypair.generate().publicKey
    const legacyTx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: signer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: recipient,
        lamports: 1_000_000,
      })
    )

    const signedLegacy = await signer.signTransaction(legacyTx)
    const legacySig = signedLegacy.signature
    expect(legacySig).toBeDefined()
    expect(legacySig?.length).toBe(64)

    const messageBytes = signedLegacy.serializeMessage()
    const isLegacyValid = nacl.sign.detached.verify(
      messageBytes,
      legacySig!,
      signer.publicKey.toBytes()
    )
    expect(isLegacyValid).toBe(true)

    // 2. Test VersionedTransaction
    const v0Message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: recipient,
          lamports: 500_000,
        }),
      ],
    }).compileToV0Message()

    const versionedTx = new VersionedTransaction(v0Message)
    const signedVersioned = await signer.signTransaction(versionedTx)
    expect(signedVersioned.signatures[0]).toBeDefined()
    expect(signedVersioned.signatures[0].length).toBe(64)

    const v0Bytes = signedVersioned.message.serialize()
    const isV0Valid = nacl.sign.detached.verify(
      v0Bytes,
      signedVersioned.signatures[0],
      signer.publicKey.toBytes()
    )
    expect(isV0Valid).toBe(true)
  })

  it('signs transactions using mocked AWS KMS client', async () => {
    const keypair = Keypair.generate()
    const mockAwsClient: AwsKmsClientLike = {
      send: vi.fn().mockImplementation(async (command: { Message: Uint8Array }) => {
        // Mock KMS Ed25519 signing by signing the message with the keypair secret
        const signature = nacl.sign.detached(command.Message, keypair.secretKey)
        return { Signature: signature }
      }),
    }

    const signer = new KmsSolanaSigner({
      provider: 'aws',
      keyId: 'arn:aws:kms:us-east-1:123456789012:key/mock-solana-key',
      publicKey: keypair.publicKey,
      awsClient: mockAwsClient,
    })

    const blockhash = Keypair.generate().publicKey.toBase58()
    const recipient = Keypair.generate().publicKey

    // Sign legacy transaction
    const legacyTx = new Transaction({
      recentBlockhash: blockhash,
      feePayer: signer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: recipient,
        lamports: 100_000,
      })
    )

    await signer.signTransaction(legacyTx)
    expect(mockAwsClient.send).toHaveBeenCalledOnce()
    expect(legacyTx.signature?.length).toBe(64)

    // Sign VersionedTransaction
    const v0Message = new TransactionMessage({
      payerKey: signer.publicKey,
      recentBlockhash: blockhash,
      instructions: [
        SystemProgram.transfer({
          fromPubkey: signer.publicKey,
          toPubkey: recipient,
          lamports: 200_000,
        }),
      ],
    }).compileToV0Message()

    const versionedTx = new VersionedTransaction(v0Message)
    await signer.signTransaction(versionedTx)
    expect(mockAwsClient.send).toHaveBeenCalledTimes(2)
    expect(versionedTx.signatures[0].length).toBe(64)

    // Verify cryptographic validity
    const isValid = nacl.sign.detached.verify(
      versionedTx.message.serialize(),
      versionedTx.signatures[0],
      keypair.publicKey.toBytes()
    )
    expect(isValid).toBe(true)
  })

  it('signs transactions using mocked GCP KMS client', async () => {
    const keypair = Keypair.generate()
    const mockGcpClient: GcpKmsClientLike = {
      asymmetricSign: vi.fn().mockImplementation(async (request: { data: Uint8Array }) => {
        const signature = nacl.sign.detached(request.data, keypair.secretKey)
        return [{ signature }]
      }),
    }

    const signer = new KmsSolanaSigner({
      provider: 'gcp',
      keyId:
        'projects/alchm-mainnet/locations/global/keyRings/solana/cryptoKeys/signer/cryptoKeyVersions/1',
      publicKey: keypair.publicKey,
      gcpClient: mockGcpClient,
    })

    const blockhash = Keypair.generate().publicKey.toBase58()
    const recipient = Keypair.generate().publicKey

    const tx1 = new Transaction({
      recentBlockhash: blockhash,
      feePayer: signer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: recipient,
        lamports: 10_000,
      })
    )

    const tx2 = new Transaction({
      recentBlockhash: blockhash,
      feePayer: signer.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: recipient,
        lamports: 20_000,
      })
    )

    const signedTxs = await signer.signAllTransactions([tx1, tx2])
    expect(mockGcpClient.asymmetricSign).toHaveBeenCalledTimes(2)
    expect(signedTxs[0].signature?.length).toBe(64)
    expect(signedTxs[1].signature?.length).toBe(64)
  })

  it('getSolanaServiceSigner instantiates AWS KMS when configured', () => {
    const keypair = Keypair.generate()
    process.env.AWS_KMS_KEY_ID = 'arn:aws:kms:us-east-1:123456789012:key/test-key'
    process.env.SOLANA_SERVICE_PUBLIC_KEY = keypair.publicKey.toBase58()

    const signer = getSolanaServiceSigner()
    expect(signer).not.toBeNull()
    expect(signer?.provider).toBe('aws')
    expect(signer?.publicKey.toBase58()).toBe(keypair.publicKey.toBase58())
    expect(signer?.keyId).toBe('arn:aws:kms:us-east-1:123456789012:key/test-key')
  })

  it('getSolanaServiceSigner instantiates GCP KMS when configured', () => {
    const keypair = Keypair.generate()
    process.env.GCP_KMS_KEY_NAME =
      'projects/alchm/locations/global/keyRings/ring/cryptoKeys/key/cryptoKeyVersions/1'
    process.env.SOLANA_SERVICE_PUBLIC_KEY = keypair.publicKey.toBase58()

    const signer = getSolanaServiceSigner()
    expect(signer).not.toBeNull()
    expect(signer?.provider).toBe('gcp')
    expect(signer?.publicKey.toBase58()).toBe(keypair.publicKey.toBase58())
  })

  it('throws in production when KMS is not configured', () => {
    process.env.NODE_ENV = 'production'
    expect(() => getSolanaServiceSigner()).toThrow(
      /Cloud KMS signer \(AWS_KMS_KEY_ID or GCP_KMS_KEY_NAME\) is required in production/
    )
  })

  it('falls back to local keypair when KMS is absent in non-production', () => {
    process.env.NODE_ENV = 'development'
    const keypair = Keypair.generate()
    process.env.SOLANA_AGENT_PAYER_KEY = JSON.stringify(Array.from(keypair.secretKey))

    const signer = getSolanaServiceSigner()
    expect(signer).not.toBeNull()
    expect(signer?.provider).toBe('local')
    expect(signer?.publicKey.toBase58()).toBe(keypair.publicKey.toBase58())
  })
})

describe('Squads v4 Multisig Governance Runbook', () => {
  it('derives consistent Squads v4 PDAs', () => {
    const createKey = new PublicKey('11111111111111111111111111111111')
    const [multisigPda] = getSquadsMultisigPda(createKey)
    expect(multisigPda).toBeInstanceOf(PublicKey)

    const [vaultPda, vaultBump] = getSquadsVaultPda(multisigPda, 1)
    expect(vaultPda).toBeInstanceOf(PublicKey)
    expect(vaultBump).toBeGreaterThanOrEqual(0)

    const [proposalPda] = getSquadsProposalPda(multisigPda, 1n)
    const [txPda] = getSquadsTransactionPda(multisigPda, 1n)
    expect(proposalPda).toBeInstanceOf(PublicKey)
    expect(txPda).toBeInstanceOf(PublicKey)
    expect(proposalPda.toBase58()).not.toBe(txPda.toBase58())
  })

  it('builds BPF Loader Upgradeable SetUpgradeAuthority instruction', () => {
    const currentAuthority = Keypair.generate().publicKey
    const newAuthority = Keypair.generate().publicKey

    const ix = buildSetProgramUpgradeAuthorityInstruction({
      programId: ASOL_SOLANA_PROGRAM_ID,
      currentAuthority,
      newAuthority,
    })

    expect(ix.programId.toBase58()).toBe(BPF_LOADER_UPGRADEABLE_PROGRAM_ID.toBase58())
    expect(ix.keys.length).toBe(3)
    expect(ix.keys[0].pubkey.toBase58()).toBe(
      getProgramDataAddress(ASOL_SOLANA_PROGRAM_ID).toBase58()
    )
    expect(ix.keys[0].isWritable).toBe(true)
    expect(ix.keys[0].isSigner).toBe(false)
    expect(ix.keys[1].pubkey.toBase58()).toBe(currentAuthority.toBase58())
    expect(ix.keys[1].isSigner).toBe(true)
    expect(ix.keys[2].pubkey.toBase58()).toBe(newAuthority.toBase58())
    expect(ix.data.readUInt32LE(0)).toBe(4) // Instruction index 4
  })

  it('builds asol_program.set_service_authorities instruction', () => {
    const adminAuthority = Keypair.generate().publicKey
    const attestor = Keypair.generate().publicKey
    const pauser = Keypair.generate().publicKey

    const ix = buildSetServiceAuthoritiesInstruction({
      programId: ASOL_SOLANA_PROGRAM_ID,
      adminAuthority,
      attestor,
      pauser,
    })

    expect(ix.programId.toBase58()).toBe(ASOL_SOLANA_PROGRAM_ID.toBase58())
    expect(ix.keys.length).toBe(2)
    expect(ix.keys[0].pubkey.toBase58()).toBe(
      getProgramConfigAddress(ASOL_SOLANA_PROGRAM_ID).toBase58()
    )
    expect(ix.keys[0].isWritable).toBe(true)
    expect(ix.keys[1].pubkey.toBase58()).toBe(adminAuthority.toBase58())
    expect(ix.keys[1].isSigner).toBe(true)

    // Data should be 8-byte discriminator + 32-byte attestor + 32-byte pauser = 72 bytes
    expect(ix.data.length).toBe(72)
    const discriminator = Buffer.from([42, 156, 68, 130, 225, 158, 43, 33])
    expect(ix.data.subarray(0, 8)).toEqual(discriminator)
    expect(ix.data.subarray(8, 40)).toEqual(attestor.toBuffer())
    expect(ix.data.subarray(40, 72)).toEqual(pauser.toBuffer())
  })

  it('generates a complete Squads v4 handover runbook report', () => {
    const createKey = Keypair.generate().publicKey
    const currentAuthority = Keypair.generate().publicKey
    const report = generateSquadsHandoverRunbook({
      createKey,
      currentAuthority,
    })

    expect(report.programId).toBe(ASOL_SOLANA_PROGRAM_ID.toBase58())
    expect(report.currentAuthority).toBe(currentAuthority.toBase58())
    expect(report.vaultIndex).toBe(1)
    expect(report.upgradeAuthorityCliCommand).toContain('solana program set-upgrade-authority')
    expect(report.upgradeAuthorityCliCommand).toContain(report.vaultPda)
    expect(report.setServiceAuthoritiesInstruction.programConfig).toBe(
      getProgramConfigAddress(ASOL_SOLANA_PROGRAM_ID).toBase58()
    )
  })
})
