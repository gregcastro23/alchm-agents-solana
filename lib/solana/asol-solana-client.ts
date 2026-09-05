import { AnchorProvider, BN, Program } from '@coral-xyz/anchor'
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token'
import {
  Connection,
  Ed25519Program,
  PublicKey,
  SYSVAR_INSTRUCTIONS_PUBKEY,
  Transaction,
  VersionedTransaction,
  type Commitment,
  type ConfirmOptions,
  type TransactionInstruction,
} from '@solana/web3.js'

import {
  ASOL_SOLANA_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  buildRedeemAuthorizationMessage,
  getEsmsMintAddresses,
  getPersonaCommitmentAddress,
  getProgramConfigAddress,
  getReceiptAddress,
} from '@/lib/solana/esms'
import ASOL_PROGRAM_IDL from '@/lib/solana/idl/asol_program.json'
import type { AsolProgram } from '@/lib/solana/idl/asol_program'
import {
  estimatePriorityFee,
  injectComputeBudgetInstructions,
  resolveComputeUnitLimit,
  type PriorityFeeOptions,
} from '@/lib/solana/priority-fee'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'

const MAX_U64 = (1n << 64n) - 1n

export function getDefaultSolanaRpcUrl(): string {
  try {
    return getSolanaNetworkConfig().rpcUrls[0]
  } catch {
    return 'https://api.devnet.solana.com'
  }
}

export type EsmsAmounts = readonly [bigint, bigint, bigint, bigint]

function bytes32(value: Uint8Array, label: string): number[] {
  if (value.length !== 32) throw new Error(`${label} must be exactly 32 bytes`)
  return [...value]
}

function amountsToBn(amounts: EsmsAmounts): [BN, BN, BN, BN] {
  return amounts.map(amount => {
    if (amount < 0n || amount > MAX_U64) throw new RangeError('ESMS amount must fit in u64')
    return new BN(amount.toString())
  }) as [BN, BN, BN, BN]
}

export interface AsolSolanaClientOptions {
  wallet: AsolSolanaWallet
  connection?: Connection
  confirmOptions?: ConfirmOptions
  onTransactionConfirmed?: (transaction: AsolSolanaTransaction) => void | Promise<void>
  priorityFee?: PriorityFeeOptions
}

export interface AsolSolanaWallet {
  publicKey: PublicKey
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>
}

export type AsolSolanaTransactionType = 'claim' | 'redeem' | 'redeemFor' | 'persona'

export interface AsolSolanaTransaction {
  type: AsolSolanaTransactionType
  signature: string
  explorerUrl: string
}

export const ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT = 'asol:solana-transaction-confirmed'
export const AAE_SOLANA_TRANSACTION_CONFIRMED_EVENT = ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT

export function solanaExplorerTransactionUrl(signature: string): string {
  try {
    return getSolanaNetworkConfig().buildExplorerTxUrl(signature)
  } catch {
    return `https://explorer.solana.com/tx/${encodeURIComponent(signature)}?cluster=devnet`
  }
}

export const solanaExplorerTxUrl = solanaExplorerTransactionUrl

/**
 * Thin Anchor client for AlchmAgentsSolana (ASOL). Chain state stays
 * isolated in this object; no browser provider is read at module load time.
 */
export class AsolSolanaClient {
  readonly connection: Connection
  readonly wallet: AsolSolanaWallet
  readonly program: Program<AsolProgram>
  readonly programId: PublicKey
  readonly programConfig: PublicKey
  readonly mints: readonly PublicKey[]
  private readonly onTransactionConfirmed?: AsolSolanaClientOptions['onTransactionConfirmed']
  private readonly priorityFeeOptions?: PriorityFeeOptions
  private readonly confirmOptions?: ConfirmOptions

  constructor(options: AsolSolanaClientOptions) {
    this.confirmOptions = options.confirmOptions
    this.connection =
      options.connection ??
      new Connection(
        process.env.SOLANA_RPC_URL ??
          process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
          getDefaultSolanaRpcUrl(),
        options.confirmOptions?.commitment ?? 'confirmed'
      )
    this.wallet = options.wallet
    this.onTransactionConfirmed = options.onTransactionConfirmed
    this.priorityFeeOptions = options.priorityFee
    const provider = new AnchorProvider(
      this.connection,
      options.wallet,
      options.confirmOptions ?? { commitment: 'confirmed', preflightCommitment: 'confirmed' }
    )
    this.program = new Program<AsolProgram>(ASOL_PROGRAM_IDL as unknown as AsolProgram, provider)
    this.programId = ASOL_SOLANA_PROGRAM_ID
    this.programConfig = getProgramConfigAddress(this.programId)
    this.mints = getEsmsMintAddresses(this.programId)
  }

  getClaimReceiptAddress(claimId: Uint8Array): PublicKey {
    return getReceiptAddress('claim', claimId, this.programId)
  }

  getOrderReceiptAddress(orderId: Uint8Array): PublicKey {
    return getReceiptAddress('order', orderId, this.programId)
  }

  getPersonaCommitmentAddress(agentId: Uint8Array): PublicKey {
    return getPersonaCommitmentAddress(agentId, this.programId)
  }

  getTokenAccounts(owner: PublicKey): readonly PublicKey[] {
    return this.mints.map(mint =>
      getAssociatedTokenAddressSync(mint, owner, false, TOKEN_2022_PROGRAM_ID)
    )
  }

  private mintAccounts() {
    return {
      spiritMint: this.mints[0],
      essenceMint: this.mints[1],
      matterMint: this.mints[2],
      substanceMint: this.mints[3],
    }
  }

  private tokenAccounts(owner: PublicKey) {
    const accounts = this.getTokenAccounts(owner)
    return {
      spiritAccount: accounts[0],
      essenceAccount: accounts[1],
      matterAccount: accounts[2],
      substanceAccount: accounts[3],
    }
  }

  async buildClaimMintEsmsInstruction(args: {
    claimId: Uint8Array
    ledgerReferenceHash: Uint8Array
    recipient: PublicKey
    amounts: EsmsAmounts
    authority?: PublicKey
  }): Promise<TransactionInstruction> {
    const authority = args.authority ?? this.wallet.publicKey
    return this.program.methods
      .claimMintEsms(
        bytes32(args.claimId, 'claimId'),
        bytes32(args.ledgerReferenceHash, 'ledgerReferenceHash'),
        amountsToBn(args.amounts)
      )
      .accounts({
        authority,
        recipient: args.recipient,
        ...this.mintAccounts(),
        ...this.tokenAccounts(args.recipient),
      })
      .instruction()
  }

  async buildRedeemEsmsInstruction(args: {
    orderId: Uint8Array
    amounts: EsmsAmounts
    holder?: PublicKey
  }): Promise<TransactionInstruction> {
    const holder = args.holder ?? this.wallet.publicKey
    return this.program.methods
      .redeemEsms(bytes32(args.orderId, 'orderId'), amountsToBn(args.amounts))
      .accounts({
        holder,
        ...this.mintAccounts(),
        ...this.tokenAccounts(holder),
      })
      .instruction()
  }

  async buildRedeemForEsmsInstructions(args: {
    orderId: Uint8Array
    amounts: EsmsAmounts
    holder: PublicKey
    holderSignature: Uint8Array
    clusterDomain: Uint8Array
    deadline: bigint
    sponsor?: PublicKey
  }): Promise<readonly [TransactionInstruction, TransactionInstruction]> {
    if (args.holderSignature.length !== 64) {
      throw new Error('holderSignature must be exactly 64 bytes')
    }
    const message = buildRedeemAuthorizationMessage({
      programId: this.programId,
      clusterDomain: args.clusterDomain,
      holder: args.holder,
      orderId: args.orderId,
      amounts: args.amounts,
      deadline: args.deadline,
    })
    const ed25519Instruction = Ed25519Program.createInstructionWithPublicKey({
      publicKey: args.holder.toBytes(),
      message,
      signature: args.holderSignature,
    })
    const redeemInstruction = await this.program.methods
      .redeemForEsms(
        bytes32(args.orderId, 'orderId'),
        amountsToBn(args.amounts),
        new BN(args.deadline.toString())
      )
      .accounts({
        sponsor: args.sponsor ?? this.wallet.publicKey,
        holder: args.holder,
        ...this.mintAccounts(),
        ...this.tokenAccounts(args.holder),
        instructions: SYSVAR_INSTRUCTIONS_PUBKEY,
      })
      .instruction()
    return [ed25519Instruction, redeemInstruction]
  }

  buildEnsureAtaInstructions(
    owner: PublicKey,
    payer?: PublicKey
  ): readonly TransactionInstruction[] {
    const feePayer = payer ?? this.wallet.publicKey
    const tokenAccounts = this.getTokenAccounts(owner)
    return this.mints.map((mint, index) =>
      createAssociatedTokenAccountIdempotentInstruction(
        feePayer,
        tokenAccounts[index],
        owner,
        mint,
        TOKEN_2022_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    )
  }

  async fetchClusterDomain(): Promise<Uint8Array> {
    const config = await this.program.account.programConfig.fetch(this.programConfig)
    return Uint8Array.from(config.clusterDomain)
  }

  async hasClaimReceipt(claimId: Uint8Array, commitment?: Commitment): Promise<boolean> {
    const address = this.getClaimReceiptAddress(claimId)
    const account = await this.program.account.claimReceipt.fetchNullable(address, commitment)
    return account !== null
  }

  async hasOrderReceipt(orderId: Uint8Array, commitment?: Commitment): Promise<boolean> {
    const address = this.getOrderReceiptAddress(orderId)
    const account = await this.program.account.orderReceipt.fetchNullable(address, commitment)
    return account !== null
  }

  async buildRecordPersonaCommitmentInstruction(args: {
    agentId: Uint8Array
    targetPersonaHash: Uint8Array
    epochHash: Uint8Array
    sequence: bigint
    writer?: PublicKey
  }): Promise<TransactionInstruction> {
    return this.program.methods
      .recordPersonaCommitment(
        bytes32(args.agentId, 'agentId'),
        bytes32(args.targetPersonaHash, 'targetPersonaHash'),
        bytes32(args.epochHash, 'epochHash'),
        new BN(args.sequence.toString())
      )
      .accounts({
        writer: args.writer ?? this.wallet.publicKey,
      })
      .instruction()
  }

  private async sendInstructions(
    type: AsolSolanaTransactionType,
    instructions: readonly TransactionInstruction[]
  ): Promise<string> {
    const writableAccounts = instructions.flatMap(ix =>
      ix.keys.filter(k => k.isWritable).map(k => k.pubkey)
    )
    const priorityFee = await estimatePriorityFee(
      this.connection,
      writableAccounts,
      this.priorityFeeOptions
    ).catch(() => 5_000n)
    const units = resolveComputeUnitLimit(type)
    const computeBudgetedInstructions = injectComputeBudgetInstructions(instructions, {
      units,
      microLamports: priorityFee,
    })

    const commitment = this.confirmOptions?.commitment ?? 'confirmed'
    const latest = await this.connection.getLatestBlockhash(commitment)
    const transaction = new Transaction({
      feePayer: this.wallet.publicKey,
      blockhash: latest.blockhash,
      lastValidBlockHeight: latest.lastValidBlockHeight,
    }).add(...computeBudgetedInstructions)
    const signed = await this.wallet.signTransaction(transaction)
    const signature = await this.connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
      preflightCommitment: commitment,
    })
    await this.connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      commitment
    )
    await this.onTransactionConfirmed?.({
      type,
      signature,
      explorerUrl: solanaExplorerTransactionUrl(signature),
    })
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent<AsolSolanaTransaction>(ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT, {
          detail: { type, signature, explorerUrl: solanaExplorerTransactionUrl(signature) },
        })
      )
    }
    return signature
  }

  async claimMintEsms(
    args: Parameters<AsolSolanaClient['buildClaimMintEsmsInstruction']>[0]
  ): Promise<string> {
    return this.sendInstructions('claim', [await this.buildClaimMintEsmsInstruction(args)])
  }

  async redeemEsms(
    args: Parameters<AsolSolanaClient['buildRedeemEsmsInstruction']>[0]
  ): Promise<string> {
    return this.sendInstructions('redeem', [await this.buildRedeemEsmsInstruction(args)])
  }

  async redeemForEsms(
    args: Parameters<AsolSolanaClient['buildRedeemForEsmsInstructions']>[0]
  ): Promise<string> {
    const ataInstructions = this.buildEnsureAtaInstructions(args.holder, args.sponsor)
    const redeemInstructions = await this.buildRedeemForEsmsInstructions(args)
    return this.sendInstructions('redeemFor', [...ataInstructions, ...redeemInstructions])
  }

  async nextPersonaSequence(agentId: Uint8Array): Promise<bigint> {
    const address = this.getPersonaCommitmentAddress(agentId)
    const account = await this.program.account.personaCommitment.fetchNullable(address)
    return account ? BigInt(account.sequence.toString()) + 1n : 1n
  }

  async recordPersonaCommitment(args: {
    agentId: Uint8Array
    targetPersonaHash: Uint8Array
    epochHash: Uint8Array
    sequence?: bigint
    writer?: PublicKey
  }): Promise<string> {
    const sequence = args.sequence ?? (await this.nextPersonaSequence(args.agentId))
    const instruction = await this.buildRecordPersonaCommitmentInstruction({ ...args, sequence })
    return this.sendInstructions('persona', [instruction])
  }

  async readEsmsBalances(owner: PublicKey | string): Promise<EsmsAmounts> {
    const publicKey = typeof owner === 'string' ? new PublicKey(owner) : owner
    const balances = await Promise.all(
      this.getTokenAccounts(publicKey).map(async account => {
        try {
          return BigInt(
            (await this.connection.getTokenAccountBalance(account, 'confirmed')).value.amount
          )
        } catch {
          return 0n
        }
      })
    )
    return balances as [bigint, bigint, bigint, bigint]
  }
}

export { AsolSolanaClient as AaeSolanaClient }
export type {
  AsolSolanaClientOptions as AaeSolanaClientOptions,
  AsolSolanaWallet as AaeSolanaWallet,
  AsolSolanaTransactionType as AaeSolanaTransactionType,
  AsolSolanaTransaction as AaeSolanaTransaction,
}
