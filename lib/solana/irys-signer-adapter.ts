import { PublicKey } from '@solana/web3.js'
import nacl from 'tweetnacl'
import { Uploader } from '@irys/upload'
import { Solana } from '@irys/upload-solana'
import type { KmsSolanaSigner } from '@/lib/solana/kms-signer'

/**
 * Signature type constant for Solana / Ed25519 in Arweave bundle data items (type 2).
 */
export const ARWEAVE_SOLANA_SIGNATURE_TYPE = 2 as const
export const ED25519_SIGNATURE_LENGTH = 64 as const
export const ED25519_OWNER_LENGTH = 32 as const

export interface IrysSignerLike {
  publicKey: Buffer
  key: Buffer
  signatureType: number
  signatureLength: number
  ownerLength: number
  sign(message: Uint8Array): Promise<Uint8Array> | Uint8Array
  verify(
    pub: Buffer | Uint8Array,
    data: Uint8Array,
    signature: Uint8Array
  ): Promise<boolean> | boolean
}

/**
 * Adapter bridging KmsSolanaSigner (Cloud KMS Ed25519 HSM or local keypair)
 * to the raw message Signer interface required by Arweave/Irys data bundles.
 */
export class KmsIrysSignerAdapter implements IrysSignerLike {
  readonly kmsSigner: KmsSolanaSigner
  readonly publicKey: Buffer
  readonly key: Buffer
  readonly signatureType: number = ARWEAVE_SOLANA_SIGNATURE_TYPE
  readonly signatureLength: number = ED25519_SIGNATURE_LENGTH
  readonly ownerLength: number = ED25519_OWNER_LENGTH

  constructor(kmsSigner: KmsSolanaSigner) {
    this.kmsSigner = kmsSigner
    this.publicKey = Buffer.from(kmsSigner.publicKey.toBytes())
    this.key = this.publicKey
  }

  async sign(message: Uint8Array): Promise<Uint8Array> {
    const signature = await this.kmsSigner.signMessage(message)
    if (signature.length !== this.signatureLength) {
      throw new Error(
        `Expected ${this.signatureLength}-byte signature from KMS adapter, received ${signature.length} bytes`
      )
    }
    return signature
  }

  verify(pub: Buffer | Uint8Array, data: Uint8Array, signature: Uint8Array): boolean {
    const pubBytes = pub instanceof Uint8Array ? pub : Uint8Array.from(pub)
    const sigBytes = signature instanceof Uint8Array ? signature : Uint8Array.from(signature)
    const dataBytes = data instanceof Uint8Array ? data : Uint8Array.from(data)
    return nacl.sign.detached.verify(dataBytes, sigBytes, pubBytes)
  }
}

/**
 * Custom Solana Token configuration for @irys/upload that plugs in our KmsIrysSignerAdapter.
 */
export class CustomKmsSolanaToken extends Solana {
  private customSigner?: IrysSignerLike

  constructor(config: {
    providerUrl?: string
    customSigner?: IrysSignerLike
    wallet?: unknown
    [key: string]: unknown
  }) {
    super(config)
    this.customSigner = config.customSigner
  }

  getSigner(): IrysSignerLike {
    if (this.customSigner) {
      return this.customSigner
    }
    return super.getSigner()
  }
}

export interface CreateIrysUploaderOptions {
  signer: KmsSolanaSigner
  network?: 'mainnet' | 'devnet'
  rpcUrl?: string
}

/**
 * Instantiate an Irys Uploader wired to the Phase 1 KMS Solana Signer.
 */
export async function createIrysUploader(options: CreateIrysUploaderOptions) {
  const adapter = new KmsIrysSignerAdapter(options.signer)
  const isMainnet = options.network !== 'devnet'
  const defaultRpc = isMainnet
    ? (process.env.SOLANA_RPC_URL ?? 'https://api.mainnet-beta.solana.com')
    : 'https://api.devnet.solana.com'

  const rpcUrl = options.rpcUrl ?? defaultRpc

  const builder = Uploader(CustomKmsSolanaToken)
    .withWallet({
      providerUrl: rpcUrl,
      customSigner: adapter,
    })
    .withRpc(rpcUrl)

  if (isMainnet) {
    builder.mainnet()
  } else {
    builder.devnet()
  }

  return await builder.build()
}
