import { Keypair, PublicKey, Transaction, VersionedTransaction } from '@solana/web3.js'
import nacl from 'tweetnacl'
import type { AsolSolanaWallet } from '@/lib/solana/asol-solana-client'
import { solanaPayerFromEnvironment } from '@/lib/solana/solana-minter'

export type KmsProvider = 'aws' | 'gcp' | 'local'

export interface AwsKmsClientLike {
  send(command: unknown): Promise<{ Signature?: Uint8Array | ArrayBuffer | Buffer }>
}

export interface GcpKmsClientLike {
  asymmetricSign(
    request: unknown
  ): Promise<
    | [{ signature?: Uint8Array | ArrayBuffer | Buffer | null }]
    | { signature?: Uint8Array | ArrayBuffer | Buffer | null }
  >
}

export interface KmsSignerConfig {
  provider: KmsProvider
  keyId?: string
  publicKey: PublicKey
  keypair?: Keypair
  awsClient?: AwsKmsClientLike
  gcpClient?: GcpKmsClientLike
  signFn?: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array
}

function isVersionedTransaction(
  tx: Transaction | VersionedTransaction
): tx is VersionedTransaction {
  return (
    'version' in tx && 'message' in tx && Array.isArray((tx as VersionedTransaction).signatures)
  )
}

function normalizeSignatureBytes(rawSignature: Uint8Array | ArrayBuffer | Buffer): Uint8Array {
  const bytes =
    rawSignature instanceof Uint8Array
      ? rawSignature
      : rawSignature instanceof ArrayBuffer
        ? new Uint8Array(rawSignature)
        : Uint8Array.from(rawSignature)

  if (bytes.length !== 64) {
    throw new Error(`Expected 64-byte Ed25519 signature from KMS, received ${bytes.length} bytes`)
  }
  return bytes
}

/**
 * Cloud KMS HSM Signer for Solana transactions.
 * Implements `AsolSolanaWallet` ensuring private keys never touch memory in production.
 */
export class KmsSolanaSigner implements AsolSolanaWallet {
  readonly provider: KmsProvider
  readonly keyId?: string
  readonly publicKey: PublicKey
  private readonly keypair?: Keypair
  private readonly awsClient?: AwsKmsClientLike
  private readonly gcpClient?: GcpKmsClientLike
  private readonly customSignFn?: (message: Uint8Array) => Promise<Uint8Array> | Uint8Array

  constructor(config: KmsSignerConfig) {
    this.provider = config.provider
    this.keyId = config.keyId
    this.publicKey = config.publicKey
    this.keypair = config.keypair
    this.awsClient = config.awsClient
    this.gcpClient = config.gcpClient
    this.customSignFn = config.signFn

    if (this.provider === 'local' && !this.keypair && !this.customSignFn) {
      throw new Error('Local provider requires a Keypair or custom signFn')
    }
    if ((this.provider === 'aws' || this.provider === 'gcp') && !this.keyId && !this.customSignFn) {
      throw new Error(`Provider ${this.provider} requires a keyId (ARN or Resource Name)`)
    }
  }

  /**
   * Sign a raw message digest via Cloud KMS Ed25519 or local keypair.
   */
  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    if (this.customSignFn) {
      const sig = await this.customSignFn(message)
      return normalizeSignatureBytes(sig)
    }

    switch (this.provider) {
      case 'local': {
        if (!this.keypair) throw new Error('Local keypair is not configured')
        const sig = nacl.sign.detached(message, this.keypair.secretKey)
        return normalizeSignatureBytes(sig)
      }

      case 'aws': {
        let client = this.awsClient
        if (!client) {
          try {
            // Dynamic import of @aws-sdk/client-kms if installed
            const { KMSClient, SignCommand } = await import('@aws-sdk/client-kms' as string)
            const kms = new KMSClient({
              region: process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? 'us-east-1',
            })
            const response = await kms.send(
              new SignCommand({
                KeyId: this.keyId,
                Message: message,
                MessageType: 'RAW',
                SigningAlgorithm: 'ED25519_SHA_512',
              })
            )
            if (!response.Signature) {
              throw new Error('AWS KMS Sign returned empty signature')
            }
            return normalizeSignatureBytes(response.Signature)
          } catch (error) {
            throw new Error(
              `AWS KMS signing failed: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }

        const response = await client.send({
          KeyId: this.keyId,
          Message: message,
          MessageType: 'RAW',
          SigningAlgorithm: 'ED25519_SHA_512',
        })
        if (!response.Signature) {
          throw new Error('AWS KMS Sign returned empty signature')
        }
        return normalizeSignatureBytes(response.Signature)
      }

      case 'gcp': {
        let client = this.gcpClient
        if (!client) {
          try {
            // Dynamic import of @google-cloud/kms if installed (via Function to bypass Webpack static bundle analysis)
            const dynamicImport = new Function('specifier', 'return import(specifier)')
            const gcpKmsModule = (await dynamicImport('@google-cloud/kms')) as {
              KeyManagementServiceClient: new () => {
                asymmetricSign: (req: any) => Promise<[{ signature?: Uint8Array | null }]>
              }
            }
            const { KeyManagementServiceClient } = gcpKmsModule
            const kms = new KeyManagementServiceClient()
            const [response] = await kms.asymmetricSign({
              name: this.keyId,
              data: message,
            })
            if (!response.signature) {
              throw new Error('GCP KMS asymmetricSign returned empty signature')
            }
            return normalizeSignatureBytes(response.signature as Uint8Array)
          } catch (error) {
            throw new Error(
              `GCP KMS signing failed: ${error instanceof Error ? error.message : String(error)}`
            )
          }
        }

        const rawResponse = await client.asymmetricSign({
          name: this.keyId,
          data: message,
        })
        const response = Array.isArray(rawResponse) ? rawResponse[0] : rawResponse
        if (!response?.signature) {
          throw new Error('GCP KMS asymmetricSign returned empty signature')
        }
        return normalizeSignatureBytes(response.signature)
      }

      default:
        throw new Error(`Unsupported KMS provider: ${this.provider as string}`)
    }
  }

  /**
   * Sign a legacy Transaction or VersionedTransaction.
   */
  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    if (isVersionedTransaction(transaction)) {
      const messageBytes = transaction.message.serialize()
      const signature = await this.signMessage(messageBytes)

      const signerIndex = transaction.message.staticAccountKeys.findIndex(key =>
        key.equals(this.publicKey)
      )
      const targetIndex = signerIndex >= 0 ? signerIndex : 0
      transaction.signatures[targetIndex] = Uint8Array.from(signature)
      return transaction
    }

    const legacyTx = transaction as Transaction
    if (!legacyTx.feePayer) {
      legacyTx.feePayer = this.publicKey
    }
    if (!legacyTx.recentBlockhash) {
      throw new Error('Transaction must contain a recentBlockhash before signing')
    }

    const messageBytes = legacyTx.serializeMessage()
    const signature = await this.signMessage(messageBytes)
    legacyTx.addSignature(this.publicKey, Buffer.from(signature))
    return transaction
  }

  /**
   * Sign multiple transactions sequentially.
   */
  async signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]> {
    for (const tx of transactions) {
      await this.signTransaction(tx)
    }
    return transactions
  }
}

export interface GetSolanaServiceSignerOptions {
  allowLocalInProd?: boolean
}

/**
 * Instantiate the Solana service signer from environment configuration.
 * - If AWS_KMS_KEY_ID is set, uses AWS KMS.
 * - If GCP_KMS_KEY_NAME is set, uses GCP Cloud KMS.
 * - Otherwise, falls back to solanaPayerFromEnvironment() (with warning in non-production).
 */
export function getSolanaServiceSigner(
  options?: GetSolanaServiceSignerOptions
): KmsSolanaSigner | null {
  const awsKeyId = process.env.AWS_KMS_KEY_ID ?? process.env.SOLANA_AWS_KMS_KEY_ID
  const gcpKeyName = process.env.GCP_KMS_KEY_NAME ?? process.env.SOLANA_GCP_KMS_KEY_NAME
  const configuredPubKey =
    process.env.SOLANA_SERVICE_PUBLIC_KEY ??
    process.env.SOLANA_KMS_PUBLIC_KEY ??
    process.env.AWS_KMS_PUBLIC_KEY ??
    process.env.GCP_KMS_PUBLIC_KEY

  if (awsKeyId) {
    if (!configuredPubKey) {
      throw new Error(
        'AWS KMS configured (AWS_KMS_KEY_ID) but SOLANA_SERVICE_PUBLIC_KEY is missing'
      )
    }
    return new KmsSolanaSigner({
      provider: 'aws',
      keyId: awsKeyId,
      publicKey: new PublicKey(configuredPubKey),
    })
  }

  if (gcpKeyName) {
    if (!configuredPubKey) {
      throw new Error(
        'GCP KMS configured (GCP_KMS_KEY_NAME) but SOLANA_SERVICE_PUBLIC_KEY is missing'
      )
    }
    return new KmsSolanaSigner({
      provider: 'gcp',
      keyId: gcpKeyName,
      publicKey: new PublicKey(configuredPubKey),
    })
  }

  // Non-KMS fallback
  if (
    process.env.NODE_ENV === 'production' &&
    !options?.allowLocalInProd &&
    process.env.SOLANA_ALLOW_LOCAL_PAYER_IN_PROD !== 'true'
  ) {
    throw new Error(
      'Cloud KMS signer (AWS_KMS_KEY_ID or GCP_KMS_KEY_NAME) is required in production environments'
    )
  }

  const localPayer = solanaPayerFromEnvironment()
  if (!localPayer) return null

  if (process.env.NODE_ENV !== 'test') {
    console.warn(
      '[KmsSigner] Warning: Using local keypair fallback. For production, configure AWS_KMS_KEY_ID or GCP_KMS_KEY_NAME.'
    )
  }

  return new KmsSolanaSigner({
    provider: 'local',
    publicKey: localPayer.publicKey,
    keypair: localPayer,
  })
}
