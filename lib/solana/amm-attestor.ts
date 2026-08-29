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
import nacl from 'tweetnacl'

import {
  AMM_VISIBILITY_MESSAGE_BYTES,
  buildAmmVisibilityAuthorizationMessage,
  type AmmVisibilityAuthorizationArgs,
} from '@/lib/solana/constellation-amm'

let cached: Keypair | null | undefined

function parseSecret(raw: string): Uint8Array {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[')) {
    return Uint8Array.from((JSON.parse(trimmed) as unknown[]).map(Number))
  }
  return bs58.decode(trimmed)
}

/** The configured attestor, or `null` when the env var is unset. */
export function ammAttestorKeypair(): Keypair | null {
  if (cached !== undefined) return cached

  const configured = process.env.SOLANA_ATTESTOR_KEYPAIR?.trim()
  if (!configured) {
    cached = null
    return cached
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
  cached = Keypair.fromSecretKey(bytes)
  return cached
}

/** The attestor's public key, or `null` if no key is configured. */
export function ammAttestorPublicKey(): PublicKey | null {
  return ammAttestorKeypair()?.publicKey ?? null
}

/** Test seam: forget the memoised keypair after changing the environment. */
export function resetAmmAttestorCache(): void {
  cached = undefined
}

export interface SignedAmmVisibility {
  message: Buffer
  signature: Uint8Array
  attestor: PublicKey
}

/**
 * Signs the canonical 170-byte preimage. The signature is carried by an Ed25519
 * precompile instruction placed immediately before the AMM instruction; the program
 * reads it from the instructions sysvar at `current_index - 1`.
 */
export function signAmmVisibilityAttestation(
  args: AmmVisibilityAuthorizationArgs
): SignedAmmVisibility {
  const keypair = ammAttestorKeypair()
  if (!keypair) {
    throw new Error('SOLANA_ATTESTOR_KEYPAIR is not set — cannot sign AMM visibility attestations')
  }
  const message = buildAmmVisibilityAuthorizationMessage(args)
  if (message.length !== AMM_VISIBILITY_MESSAGE_BYTES) {
    throw new Error(`refusing to sign a ${message.length}-byte preimage`)
  }
  return {
    message,
    signature: nacl.sign.detached(message, keypair.secretKey),
    attestor: keypair.publicKey,
  }
}
