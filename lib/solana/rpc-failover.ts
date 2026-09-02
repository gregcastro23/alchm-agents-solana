import { Connection, PublicKey, type Logs } from '@solana/web3.js'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'

export const PUBLIC_SOLANA_DEVNET_RPC = 'https://api.devnet.solana.com'

export type SolanaConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'degraded'
  | 'stopped'

export type StreamIngestionTier = 'geyser' | 'websocket' | 'polling'

export interface SolanaServiceHealth {
  connectionStatus: SolanaConnectionStatus
  activeRpc: string | null
  activeTier?: StreamIngestionTier
  reconnectAttempts: number
  queueDepth: number
  lastProcessedSlot: bigint | null
  lastError: string | null
}

export interface SolanaGeyserConfig {
  endpoint: string | null
  xToken: string | null
}

export function resolveSolanaGeyserConfig(overrides?: {
  endpoint?: string
  xToken?: string
}): SolanaGeyserConfig {
  const endpoint =
    overrides?.endpoint ??
    process.env.SOLANA_GEYSER_ENDPOINT ??
    process.env.HELIUS_GEYSER_ENDPOINT ??
    null
  const xToken =
    overrides?.xToken ??
    process.env.SOLANA_GEYSER_X_TOKEN ??
    process.env.HELIUS_GEYSER_X_TOKEN ??
    process.env.HELIUS_API_KEY ??
    null
  return { endpoint, xToken }
}

export function resolveSolanaRpcUrls(
  overrides: {
    primary?: string
    helius?: string
    quickNode?: string
    additional?: string
  } = {}
): string[] {
  let config: ReturnType<typeof getSolanaNetworkConfig> | null = null
  try {
    config = getSolanaNetworkConfig()
  } catch {
    config = null
  }

  const isMainnet = config?.isMainnet ?? false

  const overrideCandidates = [
    overrides.primary,
    overrides.helius,
    overrides.quickNode,
    ...(overrides.additional ? overrides.additional.split(',').map(v => v.trim()) : []),
  ].filter((value): value is string => Boolean(value))

  const baseCandidates =
    overrideCandidates.length > 0
      ? overrideCandidates
      : config?.rpcUrls
        ? [...config.rpcUrls]
        : [
            process.env.SOLANA_RPC_URL,
            process.env.HELIUS_SOLANA_RPC_URL,
            process.env.QUICKNODE_SOLANA_RPC_URL,
            ...(process.env.SOLANA_RPC_URLS ?? '').split(',').map(value => value.trim()),
          ].filter((value): value is string => Boolean(value))

  // Append devnet public RPC ONLY when NOT on Mainnet-Beta
  if (!isMainnet) {
    baseCandidates.push(PUBLIC_SOLANA_DEVNET_RPC)
  }

  const unique = [...new Set(baseCandidates.filter(Boolean))]

  // Fail-closed in Mainnet-Beta: strictly forbid devnet or testnet RPCs
  if (isMainnet) {
    const forbidden = unique.filter(
      url =>
        url.includes('api.devnet.solana.com') ||
        url.includes('api.testnet.solana.com') ||
        url.includes('devnet.solana.com')
    )
    if (forbidden.length > 0) {
      throw new Error(
        `Forbidden non-mainnet RPC url in Mainnet-Beta configuration: ${forbidden.join(', ')}. Devnet fallbacks are strictly prohibited.`
      )
    }
  }

  return unique
}

export function reconnectDelayMs(attempt: number): number {
  return Math.min(30_000, 500 * 2 ** Math.max(0, attempt))
}

export function solanaSlotToBigInt(slot: number): bigint {
  if (!Number.isSafeInteger(slot) || slot < 0) {
    throw new RangeError('Solana SDK slot must be a non-negative safe integer')
  }
  return BigInt(slot)
}

/** Cache of cluster genesis hashes per endpoint to minimize RPC overhead */
const genesisHashCache = new Map<string, string>()

export function clearGenesisHashCache(): void {
  genesisHashCache.clear()
}

/**
 * Detects deterministic on-chain / simulation program errors that will never succeed
 * by retrying across other RPC nodes (e.g. AccountAlreadyInitialized, ClaimsPaused,
 * AmountOutOfRange, EmptyAmounts, invalid signatures, simulation failure).
 */
export function isDeterministicProgramError(error: unknown): boolean {
  if (!error) return false
  const err = error as Record<string, unknown>

  if (err.name === 'AnchorError' || typeof err.errorLogs === 'object') {
    return true
  }

  if (Array.isArray(err.logs)) {
    const logsStr = err.logs.join('\n')
    if (
      logsStr.includes('InstructionError') ||
      logsStr.includes('custom program error:') ||
      logsStr.includes('Program failed to complete')
    ) {
      return true
    }
  }

  const message = (error instanceof Error ? error.message : String(error)).toLowerCase()
  return (
    message.includes('instructionerror') ||
    message.includes('custom program error') ||
    message.includes('transaction simulation failed') ||
    message.includes('simulation failed') ||
    message.includes('already in use') ||
    message.includes('accountalreadyinitialized') ||
    message.includes('claimsalreadyprocessed') ||
    message.includes('amountoutofrange') ||
    message.includes('emptyamounts') ||
    message.includes('claimspaused')
  )
}

export async function withSolanaRpcFailover<T>(args: {
  operation: (connection: Connection, endpoint: string) => Promise<T>
  rpcUrls?: readonly string[]
  connectionFactory?: (rpcUrl: string) => Connection
}): Promise<T> {
  const urls = [...(args.rpcUrls ?? resolveSolanaRpcUrls())]
  if (!urls.length) throw new Error('No Solana RPC endpoints are configured')
  const connectionFactory =
    args.connectionFactory ?? ((rpcUrl: string) => new Connection(rpcUrl, 'confirmed'))
  const errors: string[] = []

  for (const endpoint of urls) {
    try {
      const connection = connectionFactory(endpoint)

      // Per-connection memoized cluster genesis assertion
      try {
        const config = getSolanaNetworkConfig()
        if (config.isMainnet) {
          let genesisHash = genesisHashCache.get(endpoint)
          if (!genesisHash) {
            genesisHash = await connection.getGenesisHash()
            genesisHashCache.set(endpoint, genesisHash)
          }
          config.assertGenesisHash(genesisHash)
        }
      } catch (genesisErr) {
        // Skip endpoint if genesis mismatch or unreachable
        errors.push(
          `${rpcEndpointLabel(endpoint)}: Genesis check failed: ${
            genesisErr instanceof Error ? genesisErr.message : genesisErr
          }`
        )
        continue
      }

      return await args.operation(connection, endpoint)
    } catch (error) {
      // Deterministic program rejections should abort immediately rather than exhausting failover endpoints
      if (isDeterministicProgramError(error)) {
        throw error
      }
      errors.push(
        `${rpcEndpointLabel(endpoint)}: ${error instanceof Error ? error.message : error}`
      )
    }
  }
  throw new Error(`All Solana RPC endpoints failed (${errors.join('; ')})`)
}

export function rpcEndpointLabel(endpoint: string): string {
  try {
    return new URL(endpoint).host
  } catch {
    return 'configured-rpc'
  }
}

export interface ResilientSolanaSubscription {
  readonly connection: Connection
  readonly subscriptionId: number
  getHealth(): SolanaServiceHealth
  stop(): Promise<void>
}

interface RpcWebSocketLike {
  on?(event: 'error' | 'close', listener: (error?: unknown) => void): void
  off?(event: 'error' | 'close', listener: (error?: unknown) => void): void
}

type ObservableConnection = Connection & { _rpcWebSocket?: RpcWebSocketLike }

export function createResilientSolanaLogSubscription(args: {
  programId: PublicKey
  onLogs: (logs: Logs, slot: number) => Promise<void>
  rpcUrls?: readonly string[]
  connection?: Connection
  connectionFactory?: (rpcUrl: string) => Connection
  heartbeatMs?: number
  onConnectionReady?: (connection: Connection, reconnected: boolean) => Promise<void>
  onDegradedOrFailed?: (error: unknown) => void
}): ResilientSolanaSubscription {
  const urls = args.connection ? [args.connection.rpcEndpoint] : [...(args.rpcUrls ?? [])]
  if (urls.length === 0) urls.push(...resolveSolanaRpcUrls())
  const connectionFactory =
    args.connectionFactory ?? ((rpcUrl: string) => new Connection(rpcUrl, 'finalized'))
  let endpointIndex = 0
  let connection: Connection
  let subscriptionId = -1
  let connectionStatus: SolanaConnectionStatus = 'connecting'
  let reconnectAttempts = 0
  let lastProcessedSlot: bigint | null = null
  let lastError: string | null = null
  let stopped = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let socket: RpcWebSocketLike | undefined
  let connectionGeneration = 0
  let readyForLiveLogs = false
  let pendingLogs: Array<{ logs: Logs; slot: number }> = []

  const websocketFailed = (error?: unknown) => {
    void scheduleReconnect(error ?? new Error('Solana WebSocket closed'))
  }

  const detachSocketListeners = () => {
    socket?.off?.('error', websocketFailed)
    socket?.off?.('close', websocketFailed)
    socket = undefined
  }

  const clearHeartbeat = () => {
    if (heartbeatTimer) clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  const removeSubscription = async () => {
    connectionGeneration += 1
    readyForLiveLogs = false
    pendingLogs = []
    detachSocketListeners()
    clearHeartbeat()
    if (subscriptionId >= 0) {
      const currentId = subscriptionId
      subscriptionId = -1
      try {
        await connection.removeOnLogsListener(currentId)
      } catch {
        // The failed endpoint may already have dropped the subscription.
      }
    }
  }

  const connect = () => {
    if (stopped) return
    connectionStatus = reconnectAttempts > 0 ? 'degraded' : 'connecting'
    connection = args.connection ?? connectionFactory(urls[endpointIndex])
    const generation = ++connectionGeneration
    readyForLiveLogs = !args.onConnectionReady
    pendingLogs = []
    const dispatchLogs = async (logs: Logs, slot: number) => {
      if (logs.err || generation !== connectionGeneration) return
      try {
        await args.onLogs(logs, slot)
        lastProcessedSlot = solanaSlotToBigInt(slot)
        connectionStatus = 'connected'
        lastError = null
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error)
        await scheduleReconnect(error)
        throw error
      }
    }
    try {
      subscriptionId = connection.onLogs(
        args.programId,
        async (logs, context) => {
          if (generation !== connectionGeneration || logs.err) return
          if (!readyForLiveLogs) {
            pendingLogs.push({ logs, slot: context.slot })
            return
          }
          await dispatchLogs(logs, context.slot).catch(() => undefined)
        },
        'finalized'
      )
      connectionStatus = reconnectAttempts > 0 ? 'degraded' : 'connected'
      socket = (connection as ObservableConnection)._rpcWebSocket
      socket?.on?.('error', websocketFailed)
      socket?.on?.('close', websocketFailed)
      heartbeatTimer = setInterval(() => {
        void connection
          .getSlot('finalized')
          .then(() => {
            connectionStatus = 'connected'
            lastError = null
          })
          .catch(websocketFailed)
      }, args.heartbeatMs ?? 30_000)
      if (args.onConnectionReady) {
        void args
          .onConnectionReady(connection, reconnectAttempts > 0)
          .then(async () => {
            while (generation === connectionGeneration && pendingLogs.length > 0) {
              const pending = pendingLogs.shift()!
              await dispatchLogs(pending.logs, pending.slot)
            }
            if (generation === connectionGeneration) readyForLiveLogs = true
          })
          .catch(error => scheduleReconnect(error))
      }
    } catch (error) {
      void scheduleReconnect(error)
    }
  }

  async function scheduleReconnect(error: unknown): Promise<void> {
    if (stopped || reconnectTimer || connectionStatus === 'reconnecting') return
    lastError = error instanceof Error ? error.message : String(error)
    connectionStatus = 'reconnecting'
    args.onDegradedOrFailed?.(error)
    await removeSubscription()
    endpointIndex = (endpointIndex + 1) % urls.length
    const delay = reconnectDelayMs(reconnectAttempts)
    reconnectAttempts += 1
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, delay)
  }

  connect()

  return {
    get connection() {
      return connection
    },
    get subscriptionId() {
      return subscriptionId
    },
    getHealth: () => ({
      connectionStatus,
      activeRpc: rpcEndpointLabel(connection.rpcEndpoint),
      activeTier: 'websocket',
      reconnectAttempts,
      queueDepth: 0,
      lastProcessedSlot,
      lastError,
    }),
    stop: async () => {
      stopped = true
      connectionStatus = 'stopped'
      if (reconnectTimer) clearTimeout(reconnectTimer)
      reconnectTimer = null
      await removeSubscription()
    },
  }
}

export interface GeyserTransactionUpdate {
  signature: string
  slot: number | bigint
  err?: unknown
  logs?: string[]
}

export interface YellowstoneGeyserClientLike {
  subscribe(args: {
    programId: PublicKey
    onTransaction: (update: GeyserTransactionUpdate) => Promise<void> | void
    onError: (error: unknown) => void
  }): Promise<{ unsubscribe: () => Promise<void> | void }>
}

export interface ResilientStreamSubscriptionOptions {
  programId: PublicKey
  onLogs: (logs: Logs, slot: number) => Promise<void>
  rpcUrls?: readonly string[]
  connection?: Connection
  connectionFactory?: (rpcUrl: string) => Connection
  geyserEndpoint?: string
  geyserXToken?: string
  geyserClientFactory?: (config: SolanaGeyserConfig) => YellowstoneGeyserClientLike
  heartbeatMs?: number
  pollingIntervalMs?: number
  onConnectionReady?: (connection: Connection, reconnected: boolean) => Promise<void>
}

export interface ResilientStreamSubscription extends ResilientSolanaSubscription {
  readonly activeTier: StreamIngestionTier
}

/**
 * Three-tier resilient subscription for Solana events:
 * Tier 1 (Primary): Yellowstone gRPC Geyser stream (low-latency push)
 * Tier 2 (Secondary fallback): WebSocket onLogs subscription with multi-RPC failover
 * Tier 3 (Tertiary fallback): Polling backfill via getSignaturesForAddress
 */
export function createResilientStreamSubscription(
  options: ResilientStreamSubscriptionOptions
): ResilientStreamSubscription {
  const geyserConfig = resolveSolanaGeyserConfig({
    endpoint: options.geyserEndpoint,
    xToken: options.geyserXToken,
  })

  let activeTier: StreamIngestionTier = geyserConfig.endpoint ? 'geyser' : 'websocket'
  let connectionStatus: SolanaConnectionStatus = 'connecting'
  let lastError: string | null = null
  let lastProcessedSlot: bigint | null = null
  let reconnectAttempts = 0
  let stopped = false

  let activeGeyserUnsub: (() => Promise<void> | void) | null = null
  let websocketSub: ResilientSolanaSubscription | null = null
  let pollingTimer: ReturnType<typeof setInterval> | null = null
  let pollingActive = false

  const urls = options.connection ? [options.connection.rpcEndpoint] : [...(options.rpcUrls ?? [])]
  if (urls.length === 0) urls.push(...resolveSolanaRpcUrls())
  const connectionFactory =
    options.connectionFactory ?? ((rpcUrl: string) => new Connection(rpcUrl, 'finalized'))
  const baseConnection = options.connection ?? connectionFactory(urls[0])

  const handleIncomingLogs = async (logs: Logs, slot: number) => {
    if (stopped) return
    try {
      await options.onLogs(logs, slot)
      lastProcessedSlot = solanaSlotToBigInt(slot)
      connectionStatus = 'connected'
      lastError = null
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error)
      throw error
    }
  }

  const startPollingFallback = () => {
    if (pollingTimer || stopped) return
    activeTier = 'polling'
    connectionStatus = 'degraded'
    const pollSignatures = async () => {
      if (pollingActive || stopped) return
      pollingActive = true
      try {
        const signatures = await baseConnection.getSignaturesForAddress(
          options.programId,
          { limit: 20 },
          'finalized'
        )
        for (const entry of signatures.reverse()) {
          if (entry.err) continue
          const entrySlot = solanaSlotToBigInt(entry.slot)
          if (lastProcessedSlot !== null && entrySlot <= lastProcessedSlot) continue
          await handleIncomingLogs(
            { err: entry.err, logs: entry.memo ? [entry.memo] : [], signature: entry.signature },
            entry.slot
          )
        }
      } catch (err) {
        lastError = err instanceof Error ? err.message : String(err)
      } finally {
        pollingActive = false
      }
    }
    pollingTimer = setInterval(() => void pollSignatures(), options.pollingIntervalMs ?? 5_000)
    void pollSignatures()
  }

  const stopPolling = () => {
    if (pollingTimer) clearInterval(pollingTimer)
    pollingTimer = null
  }

  const startWebSocketTier = () => {
    if (websocketSub || stopped) return
    activeTier = 'websocket'
    connectionStatus = 'connecting'
    websocketSub = createResilientSolanaLogSubscription({
      programId: options.programId,
      onLogs: handleIncomingLogs,
      rpcUrls: urls,
      connection: options.connection,
      connectionFactory: options.connectionFactory,
      heartbeatMs: options.heartbeatMs,
      onConnectionReady: options.onConnectionReady,
      onDegradedOrFailed: error => {
        reconnectAttempts += 1
        lastError = error instanceof Error ? error.message : String(error)
        if (reconnectAttempts > 3 && !pollingTimer) {
          startPollingFallback()
        }
      },
    })
  }

  const stopWebSocketTier = async () => {
    if (websocketSub) {
      const sub = websocketSub
      websocketSub = null
      await sub.stop()
    }
  }

  const startGeyserTier = async () => {
    if (!geyserConfig.endpoint || stopped) {
      startWebSocketTier()
      return
    }

    try {
      activeTier = 'geyser'
      connectionStatus = 'connecting'
      const client = options.geyserClientFactory ? options.geyserClientFactory(geyserConfig) : null

      if (!client) {
        // If no factory provided, fall back to WebSocket tier gracefully
        startWebSocketTier()
        return
      }

      const subscription = await client.subscribe({
        programId: options.programId,
        onTransaction: async update => {
          if (update.err) return
          await handleIncomingLogs(
            {
              err: update.err ?? null,
              logs: update.logs ?? [],
              signature: update.signature,
            },
            Number(update.slot)
          )
        },
        onError: async err => {
          lastError = err instanceof Error ? err.message : String(err)
          reconnectAttempts += 1
          if (activeGeyserUnsub) {
            try {
              await activeGeyserUnsub()
            } catch {
              // ignore
            }
            activeGeyserUnsub = null
          }
          startWebSocketTier()
        },
      })
      activeGeyserUnsub = subscription.unsubscribe
      connectionStatus = 'connected'
      lastError = null
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err)
      startWebSocketTier()
    }
  }

  void startGeyserTier()

  return {
    get connection() {
      return websocketSub?.connection ?? baseConnection
    },
    get subscriptionId() {
      return websocketSub?.subscriptionId ?? -1
    },
    get activeTier() {
      return activeTier
    },
    getHealth: () => {
      const wsHealth = websocketSub?.getHealth()
      return {
        connectionStatus: wsHealth ? wsHealth.connectionStatus : connectionStatus,
        activeRpc:
          activeTier === 'geyser'
            ? rpcEndpointLabel(geyserConfig.endpoint ?? 'geyser')
            : (wsHealth?.activeRpc ?? rpcEndpointLabel(baseConnection.rpcEndpoint)),
        activeTier,
        reconnectAttempts: wsHealth ? wsHealth.reconnectAttempts : reconnectAttempts,
        queueDepth: 0,
        lastProcessedSlot: lastProcessedSlot ?? wsHealth?.lastProcessedSlot ?? null,
        lastError: lastError ?? wsHealth?.lastError ?? null,
      }
    },
    stop: async () => {
      stopped = true
      connectionStatus = 'stopped'
      stopPolling()
      if (activeGeyserUnsub) {
        try {
          await activeGeyserUnsub()
        } catch {
          // ignore
        }
        activeGeyserUnsub = null
      }
      await stopWebSocketTier()
    },
  }
}
