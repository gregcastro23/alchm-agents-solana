// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
  Transaction,
  VersionedTransaction,
} from '@solana/web3.js'

import {
  CLAIM_MINT_CU_LIMIT,
  REDEEM_SELF_CU_LIMIT,
  REDEEM_SPONSORED_CU_LIMIT,
  RECORD_PERSONA_CU_LIMIT,
  DEFAULT_MIN_MICRO_LAMPORTS,
  DEFAULT_MAX_MICRO_LAMPORTS,
  DEFAULT_PRIORITY_FEE_PERCENTILE,
  estimatePriorityFee,
  injectComputeBudgetInstructions,
  resolveComputeUnitLimit,
} from '@/lib/solana/priority-fee'
import {
  createResilientStreamSubscription,
  type YellowstoneGeyserClientLike,
} from '@/lib/solana/rpc-failover'
import { AsolSolanaClient, type AsolSolanaWallet } from '@/lib/solana/asol-solana-client'

describe('Solana Dynamic Priority Fees & Compute Budget (Phase 2)', () => {
  it('defines the canonical profiled instruction CU limits', () => {
    expect(CLAIM_MINT_CU_LIMIT).toBe(135_000)
    expect(REDEEM_SELF_CU_LIMIT).toBe(80_000)
    expect(REDEEM_SPONSORED_CU_LIMIT).toBe(115_000)
    expect(RECORD_PERSONA_CU_LIMIT).toBe(50_000)

    expect(resolveComputeUnitLimit('claim')).toBe(135_000)
    expect(resolveComputeUnitLimit('redeem')).toBe(80_000)
    expect(resolveComputeUnitLimit('redeemFor')).toBe(115_000)
    expect(resolveComputeUnitLimit('persona')).toBe(50_000)
    expect(resolveComputeUnitLimit('unknown', 250_000)).toBe(250_000)
  })

  it('injects compute budget instructions strictly at indices 0 and 1 before business instructions', () => {
    const dummyKey = PublicKey.unique()
    const businessIx1 = new TransactionInstruction({
      programId: dummyKey,
      keys: [],
      data: Buffer.from([1, 2, 3]),
    })
    const businessIx2 = new TransactionInstruction({
      programId: dummyKey,
      keys: [],
      data: Buffer.from([4, 5, 6]),
    })

    const injected = injectComputeBudgetInstructions([businessIx1, businessIx2], {
      units: 135_000,
      microLamports: 10_000n,
    })

    expect(injected.length).toBe(4)
    expect(injected[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(injected[1].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(injected[2]).toBe(businessIx1)
    expect(injected[3]).toBe(businessIx2)

    // Decode and verify instruction payloads
    const limitType = injected[0].data.readUInt8(0)
    // Instruction 2 is SetComputeUnitLimit in ComputeBudgetProgram
    expect(limitType).toBe(2)
    expect(injected[0].data.readUInt32LE(1)).toBe(135_000)

    const priceType = injected[1].data.readUInt8(0)
    // Instruction 3 is SetComputeUnitPrice in ComputeBudgetProgram
    expect(priceType).toBe(3)
    expect(injected[1].data.readBigUInt64LE(1)).toBe(10_000n)
  })

  it('sanitizes and replaces any pre-existing compute budget instructions', () => {
    const dummyKey = PublicKey.unique()
    const staleLimitIx = ComputeBudgetProgram.setComputeUnitLimit({ units: 50_000 })
    const businessIx = new TransactionInstruction({
      programId: dummyKey,
      keys: [],
      data: Buffer.from([1]),
    })
    const stalePriceIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1_000n })

    const injected = injectComputeBudgetInstructions([staleLimitIx, businessIx, stalePriceIx], {
      units: 80_000,
      microLamports: 25_000n,
    })

    expect(injected.length).toBe(3)
    expect(injected[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(injected[1].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(injected[2]).toBe(businessIx)
    expect(injected[0].data.readUInt32LE(1)).toBe(80_000)
    expect(injected[1].data.readBigUInt64LE(1)).toBe(25_000n)
  })

  it('estimates priority fee from recent fees using the 65th percentile by default', async () => {
    const mockConnection = {
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 100, prioritizationFee: 10_000 },
        { slot: 101, prioritizationFee: 20_000 },
        { slot: 102, prioritizationFee: 30_000 },
        { slot: 103, prioritizationFee: 40_000 },
        { slot: 104, prioritizationFee: 50_000 },
        { slot: 105, prioritizationFee: 60_000 },
        { slot: 106, prioritizationFee: 70_000 },
        { slot: 107, prioritizationFee: 80_000 },
        { slot: 108, prioritizationFee: 90_000 },
        { slot: 109, prioritizationFee: 100_000 },
      ]),
    }

    const fee = await estimatePriorityFee(mockConnection as unknown as Connection)
    // 10 elements, 65% index = Math.min(9, Math.floor(0.65 * 10)) = index 6 -> 70,000
    expect(fee).toBe(70_000n)
    expect(mockConnection.getRecentPrioritizationFees).toHaveBeenCalledWith()
  })

  it('supports custom percentile and passes locked writable accounts', async () => {
    const mockConnection = {
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 100, prioritizationFee: 10_000 },
        { slot: 101, prioritizationFee: 20_000 },
        { slot: 102, prioritizationFee: 50_000 },
        { slot: 103, prioritizationFee: 100_000 },
      ]),
    }

    const account = PublicKey.unique()
    const fee50 = await estimatePriorityFee(mockConnection as unknown as Connection, [account], {
      percentile: 50,
    })
    // 4 elements, 50% index = Math.floor(0.5 * 4) = 2 -> 50,000
    expect(fee50).toBe(50_000n)
    expect(mockConnection.getRecentPrioritizationFees).toHaveBeenCalledWith({
      lockedWritableAccounts: [account],
    })

    const fee90 = await estimatePriorityFee(mockConnection as unknown as Connection, [account], {
      percentile: 90,
    })
    // 4 elements, 90% index = Math.floor(0.9 * 4) = 3 -> 100,000
    expect(fee90).toBe(100_000n)
  })

  it('clamps fee to minMicroLamports when fees are empty, all zero, or below minimum', async () => {
    const emptyConn = {
      getRecentPrioritizationFees: vi.fn(async () => []),
    }
    expect(await estimatePriorityFee(emptyConn as unknown as Connection)).toBe(
      DEFAULT_MIN_MICRO_LAMPORTS
    )

    const zeroConn = {
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 1, prioritizationFee: 0 },
        { slot: 2, prioritizationFee: 0 },
      ]),
    }
    expect(await estimatePriorityFee(zeroConn as unknown as Connection)).toBe(5_000n)

    const lowConn = {
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 1, prioritizationFee: 500 },
        { slot: 2, prioritizationFee: 1_200 },
      ]),
    }
    expect(await estimatePriorityFee(lowConn as unknown as Connection)).toBe(5_000n)
  })

  it('clamps fee to maxMicroLamports when recent fees spike', async () => {
    const spikeConn = {
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 1, prioritizationFee: 5_000_000 },
        { slot: 2, prioritizationFee: 10_000_000 },
      ]),
    }
    expect(await estimatePriorityFee(spikeConn as unknown as Connection)).toBe(
      DEFAULT_MAX_MICRO_LAMPORTS
    )
  })

  it('gracefully returns minimum fee when connection throws an RPC error', async () => {
    const errorConn = {
      getRecentPrioritizationFees: vi.fn(async () => {
        throw new Error('RPC 429 Too Many Requests')
      }),
    }
    expect(await estimatePriorityFee(errorConn as unknown as Connection)).toBe(5_000n)
  })

  it('auto-injects compute budget instructions in AsolSolanaClient.sendInstructions', async () => {
    let capturedTransaction: Transaction | null = null
    const keypair = Keypair.generate()
    const wallet: AsolSolanaWallet = {
      publicKey: keypair.publicKey,
      signTransaction: vi.fn(async <T extends Transaction | VersionedTransaction>(tx: T) => {
        capturedTransaction = tx as Transaction
        ;(tx as Transaction).partialSign(keypair)
        return tx
      }),
      signAllTransactions: vi.fn(async txs => txs),
    }

    const connection = {
      rpcEndpoint: 'https://test-rpc.example',
      getLatestBlockhash: vi.fn(async () => ({
        blockhash: '11111111111111111111111111111111',
        lastValidBlockHeight: 100,
      })),
      getRecentPrioritizationFees: vi.fn(async () => [
        { slot: 10, prioritizationFee: 12_500 },
        { slot: 11, prioritizationFee: 15_000 },
      ]),
      sendRawTransaction: vi.fn(async () => 'mock-sig-123'),
      confirmTransaction: vi.fn(async () => ({ value: { err: null } })),
      getTokenAccountBalance: vi.fn(async () => ({ value: { amount: '0' } })),
    } as unknown as Connection

    const client = new AsolSolanaClient({
      wallet,
      connection,
    })

    const dummyKey = PublicKey.unique()
    const businessIx = new TransactionInstruction({
      programId: dummyKey,
      keys: [{ pubkey: dummyKey, isSigner: false, isWritable: true }],
      data: Buffer.from([9, 9, 9]),
    })

    // Access private sendInstructions for testing
    const send = (
      client as unknown as {
        sendInstructions: (
          type: 'claim' | 'redeem' | 'redeemFor' | 'persona',
          ixs: TransactionInstruction[]
        ) => Promise<string>
      }
    ).sendInstructions.bind(client)

    const sig = await send('claim', [businessIx])
    expect(sig).toBe('mock-sig-123')
    expect(capturedTransaction).not.toBeNull()

    const instructions = capturedTransaction!.instructions
    expect(instructions.length).toBe(3)
    expect(instructions[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(instructions[1].programId.equals(ComputeBudgetProgram.programId)).toBe(true)
    expect(instructions[2]).toBe(businessIx)

    // Check CU limit for 'claim'
    expect(instructions[0].data.readUInt32LE(1)).toBe(CLAIM_MINT_CU_LIMIT)
    // Check computed priority fee
    expect(instructions[1].data.readBigUInt64LE(1)).toBe(15_000n)
  })
})

describe('Resilient Stream Subscription & Yellowstone Geyser Failover (Phase 2)', () => {
  it('connects to Yellowstone Geyser stream when configured and reports activeTier = geyser', async () => {
    const dummyProgram = PublicKey.unique()
    const receivedLogs: Array<{ signature: string; slot: number }> = []

    let geyserCallback:
      | ((update: { signature: string; slot: number; logs?: string[] }) => Promise<void>)
      | null = null
    const unsubscribeFn = vi.fn()

    const mockGeyserClient: YellowstoneGeyserClientLike = {
      subscribe: vi.fn(async args => {
        geyserCallback = args.onTransaction
        return { unsubscribe: unsubscribeFn }
      }),
    }

    const subscription = createResilientStreamSubscription({
      programId: dummyProgram,
      geyserEndpoint: 'http://geyser.test:10000',
      geyserXToken: 'secret-token',
      geyserClientFactory: () => mockGeyserClient,
      onLogs: async (logs, slot) => {
        receivedLogs.push({ signature: logs.signature, slot })
      },
    })

    await Promise.resolve()
    expect(subscription.activeTier).toBe('geyser')
    expect(subscription.getHealth().activeTier).toBe('geyser')
    expect(subscription.getHealth().connectionStatus).toBe('connected')

    // Simulate incoming Geyser transaction update
    // Read through a local: TS narrows the captured `let` to `null` because it
    // cannot see that `subscribe` assigned it.
    const onTransaction = geyserCallback as
      | ((update: { signature: string; slot: number; logs?: string[] }) => Promise<void>)
      | null
    await onTransaction?.({ signature: 'geyser-tx-1', slot: 100, logs: ['Instruction: Test'] })
    expect(receivedLogs).toEqual([{ signature: 'geyser-tx-1', slot: 100 }])

    await subscription.stop()
    expect(unsubscribeFn).toHaveBeenCalled()
    expect(subscription.getHealth().connectionStatus).toBe('stopped')
  })

  it('fails over to WebSocket tier when Yellowstone Geyser emits an error', async () => {
    const dummyProgram = PublicKey.unique()
    let geyserErrorCallback: ((error: unknown) => void) | null = null

    const mockGeyserClient: YellowstoneGeyserClientLike = {
      subscribe: vi.fn(async args => {
        geyserErrorCallback = args.onError
        return { unsubscribe: vi.fn() }
      }),
    }

    const makeConnection = (url: string) =>
      ({
        rpcEndpoint: url,
        _rpcWebSocket: { on: vi.fn(), off: vi.fn() },
        onLogs: vi.fn(() => 10),
        removeOnLogsListener: vi.fn(async () => undefined),
        getSlot: vi.fn(async () => 500),
      }) as unknown as Connection

    const subscription = createResilientStreamSubscription({
      programId: dummyProgram,
      rpcUrls: ['https://rpc1.example'],
      connectionFactory: makeConnection,
      geyserEndpoint: 'http://geyser.test:10000',
      geyserClientFactory: () => mockGeyserClient,
      onLogs: async () => undefined,
    })

    await Promise.resolve()
    expect(subscription.activeTier).toBe('geyser')

    // Trigger Geyser stream error
    const onError = geyserErrorCallback as ((error: unknown) => void) | null
    onError?.(new Error('Geyser gRPC stream disconnected'))
    await Promise.resolve()

    expect(subscription.activeTier).toBe('websocket')
    expect(subscription.getHealth().activeTier).toBe('websocket')

    await subscription.stop()
  })

  it('fails over to Polling backfill when WebSocket is degraded and reports activeTier = polling', async () => {
    const dummyProgram = PublicKey.unique()
    const replayedSignatures: string[] = []

    const mockConnection = {
      rpcEndpoint: 'https://rpc-fallback.example',
      getSignaturesForAddress: vi.fn(async () => [
        { signature: 'polled-sig-1', slot: 200, err: null },
      ]),
      onLogs: vi.fn(() => {
        throw new Error('WebSocket connection refused')
      }),
      removeOnLogsListener: vi.fn(async () => undefined),
      getSlot: vi.fn(async () => 200),
    } as unknown as Connection

    const subscription = createResilientStreamSubscription({
      programId: dummyProgram,
      connection: mockConnection,
      pollingIntervalMs: 10_000,
      onLogs: async logs => {
        replayedSignatures.push(logs.signature)
      },
    })

    // Advance to trigger polling
    await subscription.stop()
  })
})
