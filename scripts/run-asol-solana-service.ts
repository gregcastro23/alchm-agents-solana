import { Wallet } from '@coral-xyz/anchor'
import { PrismaClient } from '@prisma/client'
import { withAccelerate } from '@prisma/extension-accelerate'
import { Keypair } from '@solana/web3.js'
import bs58 from 'bs58'
import type { Hex } from 'viem'

import { AsolSolanaClient } from '@/lib/solana/asol-solana-client'
import { getSolanaServiceSigner } from '@/lib/solana/kms-signer'
import { AsyncCosmicContextEncoder } from '@/lib/jepa/cosmic-context-encoder'
import type { SolanaServiceHealth } from '@/lib/solana/rpc-failover'
import {
  createAsolBridgeProcessor,
  createBaseSepoliaClients,
  createPrismaBridgeStore,
  listenToBridgeSourceEvents,
  startBridgeRelayPolling,
} from '@/lib/solana/bridge-service'
import {
  createPrismaSolanaSyncStore,
  createSolanaSyncWebhookBodyDispatcher,
  encodeSolanaSyncBody,
  startSolanaSyncService,
  startSolanaSyncOutboxPolling,
} from '@/lib/solana/solana-sync-service'

function databaseClient(): PrismaClient {
  const url =
    process.env.DIRECT_URL ??
    process.env.DATABASE_URL ??
    process.env.RAILWAY_DATABASE_URL ??
    process.env.POSTGRES_URL
  const base = url ? new PrismaClient({ datasources: { db: { url } } }) : new PrismaClient()
  return url?.startsWith('prisma+postgres://')
    ? (base.$extends(withAccelerate()) as unknown as PrismaClient)
    : base
}

function solanaMinter(): Keypair {
  const raw = process.env.SOLANA_MINTER_SECRET_KEY
  if (!raw) throw new Error('SOLANA_MINTER_SECRET_KEY is required')
  if (raw.startsWith('[')) {
    const bytes = JSON.parse(raw) as unknown
    if (!Array.isArray(bytes) || bytes.length !== 64) {
      throw new Error('SOLANA_MINTER_SECRET_KEY JSON must contain 64 bytes')
    }
    return Keypair.fromSecretKey(Uint8Array.from(bytes.map(Number)))
  }
  return Keypair.fromSecretKey(bs58.decode(raw))
}

function startServiceHeartbeat(
  client: PrismaClient,
  service: 'sync' | 'bridge',
  getHealth: () => Promise<SolanaServiceHealth>
) {
  const publish = async (overrideStatus?: 'stopped') => {
    const health = await getHealth()
    await client.solanaServiceHeartbeat.upsert({
      where: { service },
      create: {
        service,
        status: overrideStatus ?? health.connectionStatus,
        activeRpc: health.activeRpc,
        reconnectAttempts: health.reconnectAttempts,
        queueDepth: health.queueDepth,
        lastProcessedSlot: health.lastProcessedSlot,
        lastError: health.lastError,
      },
      update: {
        status: overrideStatus ?? health.connectionStatus,
        activeRpc: health.activeRpc,
        reconnectAttempts: health.reconnectAttempts,
        queueDepth: health.queueDepth,
        lastProcessedSlot: health.lastProcessedSlot,
        lastError: health.lastError,
      },
    })
  }

  const timer = setInterval(() => void publish().catch(console.error), 10_000)
  void publish().catch(console.error)

  return async () => {
    clearInterval(timer)
    try {
      await publish('stopped')
    } catch {
      // heartbeats best-effort on shutdown
    }
  }
}

async function runSync(client: PrismaClient) {
  const store = createPrismaSolanaSyncStore(client)
  const webhookUrl = process.env.SOLANA_SYNC_WEBHOOK_URL
  const secret = process.env.SOLANA_SYNC_WEBHOOK_SECRET ?? process.env.ALCHM_KITCHEN_SYNC_SECRET
  const dispatch =
    webhookUrl && secret
      ? createSolanaSyncWebhookBodyDispatcher({ url: webhookUrl, secret })
      : undefined

  const subscription = await startSolanaSyncService({ store })
  const polling = startSolanaSyncOutboxPolling({
    store,
    dispatch,
    serialize: encodeSolanaSyncBody,
  })

  const stopHeartbeat = startServiceHeartbeat(client, 'sync', async () => {
    const health = await subscription.getHealth()
    const depth = await store.getOutboxDepth()
    return { ...health, queueDepth: depth }
  })

  console.log('[Sync] Solana Devnet outbox sync started')
  return async () => {
    polling.stop()
    await subscription.stop()
    await stopHeartbeat()
  }
}

async function runBridge(client: PrismaClient) {
  const kmsSigner = getSolanaServiceSigner()
  const solanaWallet =
    kmsSigner ?? (process.env.SOLANA_MINTER_SECRET_KEY ? new Wallet(solanaMinter()) : null)
  if (!solanaWallet) {
    throw new Error(
      'Solana bridge signer not configured (set AWS_KMS_KEY_ID, GCP_KMS_KEY_NAME, or SOLANA_MINTER_SECRET_KEY)'
    )
  }
  const evmKey = process.env.EVM_MINTER_PRIVATE_KEY as Hex | undefined
  if (!evmKey) throw new Error('EVM_MINTER_PRIVATE_KEY is required for bridge service')

  const { publicClient, walletClient } = createBaseSepoliaClients(evmKey)
  const solanaClient = new AsolSolanaClient({
    wallet: solanaWallet,
  })

  const store = createPrismaBridgeStore(client)
  const processor = createAsolBridgeProcessor({
    store,
    solanaClient,
    evmPublicClient: publicClient,
    evmWalletClient: walletClient,
  })

  const listeners = await listenToBridgeSourceEvents({
    store,
    solanaClient,
    evmPublicClient: publicClient,
  })

  const polling = startBridgeRelayPolling({
    store,
    processor,
    pollIntervalMs: Number(process.env.SOLANA_BRIDGE_POLL_INTERVAL_MS ?? 5_000),
  })

  const stopHeartbeat = startServiceHeartbeat(client, 'bridge', async () => {
    const listenerHealth = await listeners.getHealth()
    const relayHealth = await processor.getHealth()
    return {
      connectionStatus:
        listenerHealth.connectionStatus === 'healthy' && relayHealth.connectionStatus === 'healthy'
          ? 'healthy'
          : listenerHealth.connectionStatus === 'stopped' ||
              relayHealth.connectionStatus === 'stopped'
            ? 'stopped'
            : 'degraded',
      activeRpc: listenerHealth.activeRpc,
      reconnectAttempts: listenerHealth.reconnectAttempts,
      queueDepth: relayHealth.queueDepth,
      lastProcessedSlot: relayHealth.lastProcessedSlot ?? listenerHealth.lastProcessedSlot,
      lastError: listenerHealth.lastError ?? relayHealth.lastError,
    }
  })
  console.log('[Bridge] Base Sepolia ↔ Solana Devnet relay started')
  return async () => {
    polling.stop()
    await listeners.stop()
    await stopHeartbeat()
  }
}

async function runJepaAnchorWorker() {
  const intervalMs = Number(process.env.JEPA_COSMIC_EPOCH_INTERVAL_MS ?? 60_000)
  AsyncCosmicContextEncoder.startCronJob(intervalMs)
  console.log(`[JEPA] dual-chain persona anchor worker started (${intervalMs}ms)`)
  return () => AsyncCosmicContextEncoder.stopCronJob()
}

const mode = process.argv[2]
if (mode !== 'sync' && mode !== 'bridge' && mode !== 'jepa') {
  throw new Error('Usage: bun run scripts/run-asol-solana-service.ts <sync|bridge|jepa>')
}
const client = mode === 'jepa' ? null : databaseClient()
const stop =
  mode === 'sync'
    ? await runSync(client!)
    : mode === 'bridge'
      ? await runBridge(client!)
      : await runJepaAnchorWorker()
let stopping = false
const shutdown = async () => {
  if (stopping) return
  stopping = true
  await stop()
  await client?.$disconnect()
  process.exit(0)
}
process.once('SIGINT', () => void shutdown())
process.once('SIGTERM', () => void shutdown())
