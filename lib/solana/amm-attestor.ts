/**
 * Server-side Ed25519 signer for `ASOL_AMM_VISIBILITY_V1` attestations.
 *
 * SERVER ONLY -- never import into a client component.
 *
 * **The Arc attestor key cannot be reused here.** `ARC_ATTESTOR_PRIVATE_KEY` is a
 * secp256k1 key signing EIP-712 typed data for `ConstellationAMM.sol`. This path
 * verifies an Ed25519 signature against `ProgramConfig.attestor` through the
 * Solana Ed25519 precompile. They are different curves and different key material;
 * the two attestors are rotated independently.
 *
 * `SOLANA_ATTESTOR_KEYPAIR` accepts either a 64-byte JSON array (the format
 * `solana-keygen` writes) or a base58 secret key, and may name a file path.
 */

import { readFileSync } from 'node:fs'
import { Keypair, PublicKey } from '@solana/web3.js'
import bs58 from 'bs58'

import {
  AMM_VISIBILITY_MESSAGE_BYTES,
  buildAmmVisibilityAuthorizationMessage,
  type AmmVisibilityAuthorizationArgs,
} from '@/lib/solana/constellation-amm'
import { KmsSolanaSigner, getSolanaServiceSigner } from '@/lib/solana/kms-signer'

let cachedKeypair: Keypair | null | undefined

function parseSecret(raw: string): Uint8Array {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    return Uint8Array.from((JSON.parse(trimmed) as unknown[]).map(Number))
  }
  return bs58.decode(trimmed)
}

/** The raw configured attestor keypair (strictly disabled in production). */
export function ammAttestorKeypair(): Keypair | null {
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SOLANA_ALLOW_LOCAL_PAYER_IN_PROD !== 'true'
  ) {
    throw new Error(
      'Raw keypair fallback is prohibited in production environments. Use Cloud KMS signer instead.'
    )
  }

  if (cachedKeypair !== undefined) return cachedKeypair

  const configured = process.env.SOLANA_ATTESTOR_KEYPAIR?.trim()
  if (!configured) {
    cachedKeypair = null
    return cachedKeypair
  }

  let raw = configured
  if (!configured.startsWith('[') && configured.includes('/')) {
    raw = readFileSync(configured, 'utf8')
  }

  let bytes: Uint8Array
  try {
    bytes = parseSecret(raw)
  } catch (error) {
    throw new Error(
      `SOLANA_ATTESTOR_KEYPAIR is not a 64-byte JSON array or base58 secret key: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
  if (bytes.length !== 64) {
    throw new Error(`SOLANA_ATTESTOR_KEYPAIR must be 64 bytes, received ${bytes.length}`)
  }
  cachedKeypair = Keypair.fromSecretKey(bytes)
  return cachedKeypair
}

/**
 * Resolves the AMM attestor signer.
 * Prioritizes dedicated AMM KMS keys, falls back to general Solana KMS service signer,
 * and allows local keypair only in development/test.
 */
export function getAmmAttestorSigner(): KmsSolanaSigner | null {
  const awsKeyId =
    process.env.SOLANA_ATTESTOR_KMS_KEY_ID ??
    process.env.AWS_KMS_KEY_ID ??
    process.env.SOLANA_AWS_KMS_KEY_ID
  const gcpKeyName =
    process.env.SOLANA_ATTESTOR_GCP_KMS_KEY_NAME ??
    process.env.GCP_KMS_KEY_NAME ??
    process.env.SOLANA_GCP_KMS_KEY_NAME
  const pubKey =
    process.env.SOLANA_ATTESTOR_PUBLIC_KEY ??
    process.env.SOLANA_SERVICE_PUBLIC_KEY ??
    process.env.SOLANA_KMS_PUBLIC_KEY

  if (awsKeyId) {
    if (!pubKey) {
      throw new Error(
        'AWS KMS configured for AMM attestor but SOLANA_ATTESTOR_PUBLIC_KEY / SOLANA_SERVICE_PUBLIC_KEY is missing'
      )
    }
    return new KmsSolanaSigner({
      provider: 'aws',
      keyId: awsKeyId,
      publicKey: new PublicKey(pubKey),
    })
  }

  if (gcpKeyName) {
    if (!pubKey) {
      throw new Error(
        'GCP KMS configured for AMM attestor but SOLANA_ATTESTOR_PUBLIC_KEY / SOLANA_SERVICE_PUBLIC_KEY is missing'
      )
    }
    return new KmsSolanaSigner({
      provider: 'gcp',
      keyId: gcpKeyName,
      publicKey: new PublicKey(pubKey),
    })
  }

  // Non-KMS fallback check
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.SOLANA_ALLOW_LOCAL_PAYER_IN_PROD !== 'true'
  ) {
    throw new Error(
      'Cloud KMS signer (AWS_KMS_KEY_ID or GCP_KMS_KEY_NAME) is required for AMM attestations in production environments. Raw keypair fallback is prohibited.'
    )
  }

  const keypair = ammAttestorKeypair()
  if (!keypair) return null

  return new KmsSolanaSigner({
    provider: 'local',
    publicKey: keypair.publicKey,
    keypair,
  })
}

/** The attestor's public key, or `null` if no key is configured. */
export function ammAttestorPublicKey(): PublicKey | null {
  const signer = getAmmAttestorSigner()
  return signer?.publicKey ?? null
}

/** Test seam: forget the memoised keypair after changing the environment. */
export function resetAmmAttestorCache(): void {
  cachedKeypair = undefined
}

export interface SignedAmmVisibility {
  message: Buffer
  signature: Uint8Array
  attestor: PublicKey
}

/**
 * Signs the canonical 170-byte preimage using Cloud KMS or local test keypair.
 * The signature is carried by an Ed25519 precompile instruction placed immediately
 * before the AMM instruction; the program reads it from the instructions sysvar
 * at `current_index - 1`.
 */
export async function signAmmVisibilityAttestation(
  args: AmmVisibilityAuthorizationArgs
): Promise<SignedAmmVisibility> {
  const signer = getAmmAttestorSigner()
  if (!signer) {
    throw new Error(
      'Solana AMM attestor key is not configured — cannot sign AMM visibility attestations'
    )
  }
  const message = buildAmmVisibilityAuthorizationMessage(args)
  if (message.length !== AMM_VISIBILITY_MESSAGE_BYTES) {
    throw new Error(`refusing to sign a ${message.length}-byte preimage`)
  }
  const signature = await signer.signMessage(message)
  return {
    message,
    signature,
    attestor: signer.publicKey,
  }
}
