import { Command } from '@tauri-apps/plugin-shell'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  method: string
  params?: any
  id?: string | number
}

interface JsonRpcResponse {
  jsonrpc: '2.0'
  id?: string | number | null
  result?: any
  error?: {
    code: number
    message: string
    data?: any
  }
}

export type LocalMcpStatus = 'checking' | 'online' | 'offline'

const MODERN_PROTOCOL = '2026-07-28'
const LEGACY_PROTOCOL = '2025-06-18'
const LEGACY_PROTOCOLS = new Set(['2024-11-05', '2025-03-26', LEGACY_PROTOCOL, '2025-11-25'])
const CLIENT_INFO = { name: 'alchm-desktop-shell', version: '1.0.0' }
const RETRYABLE_METHODS = new Set([
  'server/discover',
  'initialize',
  'ping',
  'tools/list',
  'resources/list',
  'resources/templates/list',
  'resources/read',
  'prompts/list',
  'prompts/get',
])

function isObject(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function validCapabilities(value: unknown): value is Record<string, unknown> {
  return isObject(value) && Object.values(value).every(isObject)
}

class McpRpcError extends Error {
  constructor(
    readonly code: number,
    message: string
  ) {
    super(message)
    this.name = 'McpRpcError'
  }
}

/**
 * Snapshot of the client's externally-observable state. Consumed by
 * useSyncExternalStore in the React hook (see hooks/useLocalMcp.ts).
 * The reference identity changes on every update so React sees a
 * change; mutating in place would break that contract.
 */
export interface LocalMcpSnapshot {
  status: LocalMcpStatus
  lastError: string | null
  protocolVersion: string | null
  capabilities: Record<string, unknown> | null
  serverInfo: { name: string; version: string } | null
  /**
   * Tail of recent stderr lines from the sidecar process. Capped at
   * STDERR_RING_SIZE so this never grows unbounded for a long-lived
   * client. Diagnostic UI panels read this directly.
   */
  stderrLog: readonly string[]
}

/**
 * Maximum stderr lines retained per client. Tuned so a chatty sidecar
 * (e.g. PyInstaller bootstrap noise + a few crash traces) fits without
 * having to scroll back through hours of history.
 */
const STDERR_RING_SIZE = 200

/**
 * Retry budget for discovery/read transport failures: 2 retries after the
 * initial attempt, with exponential backoff starting at 250ms. Tool calls
 * receive no automatic replay because their write outcome may be uncertain.
 * Only process-unavailable and stdin-write failures permit a retry; explicit
 * JSON-RPC errors and timeouts remain final.
 */
const CALL_RETRY_ATTEMPTS = 2
const CALL_RETRY_BASE_DELAY_MS = 250

/**
 * Idle reconnect cadence. When the sidecar reports 'offline', the
 * client schedules a restart attempt this often until either start()
 * succeeds or stop() is called explicitly.
 */
const RECONNECT_INTERVAL_MS = 30_000

export class LocalMcpClient {
  private commandName: string
  private env?: Record<string, string>
  private child: any = null
  private pendingRequests = new Map<
    string | number,
    {
      resolve: (val: any) => void
      reject: (err: any) => void
      timer: ReturnType<typeof setTimeout>
    }
  >()
  private nextId = 1
  private buffer = ''
  private generation = 0
  private wireProtocol = MODERN_PROTOCOL

  // ---- Subscriber-style state. Replaces the single onStatusChange
  // callback the constructor used to take, but the constructor still
  // accepts an optional callback to stay backward-compatible with the
  // existing main.ts call sites that wired one in.
  private listeners = new Set<() => void>()
  private snapshot: LocalMcpSnapshot = {
    status: 'offline',
    lastError: null,
    protocolVersion: null,
    capabilities: null,
    serverInfo: null,
    stderrLog: [],
  }
  private stderrRing: string[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  /**
   * Set to true while stop() is in flight or after a manual stop. The
   * reconnect cycle checks this so a user-initiated shutdown doesn't
   * immediately race a restart.
   */
  private stopped = false

  constructor(
    commandName: string,
    onStatusChange?: (status: LocalMcpStatus) => void,
    env?: Record<string, string>
  ) {
    this.commandName = commandName
    // Extra env merged into the sidecar process (clearEnv stays false, so the
    // parent env — PATH etc. — is preserved). Used to point the bundled MCP
    // servers at the production backend instead of their localhost defaults.
    this.env = env
    if (onStatusChange) {
      // Bridge old-style callback into the new subscribe API so legacy
      // call sites (main.ts) keep working without changes.
      let lastStatus = this.snapshot.status
      this.subscribe(() => {
        const next = this.snapshot.status
        if (next !== lastStatus) {
          lastStatus = next
          onStatusChange(next)
        }
      })
    }
  }

  // ---- External-store interface (for React useSyncExternalStore). ----

  /** Subscribe to snapshot updates. Returns an unsubscribe function. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Return the current snapshot. Stable reference between updates —
   * useSyncExternalStore relies on referential equality to skip
   * re-renders. We allocate a new object only inside emit().
   */
  getSnapshot = (): LocalMcpSnapshot => this.snapshot

  private emit(partial: Partial<LocalMcpSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...partial,
      // stderrLog is always a fresh slice so external consumers can't
      // mutate our internal ring buffer.
      stderrLog: partial.stderrLog ?? [...this.stderrRing],
    }
    for (const listener of this.listeners) {
      try {
        listener()
      } catch (e) {
        console.error('LocalMcpClient listener threw:', e)
      }
    }
  }

  private appendStderr(line: string): void {
    // The Tauri shell plugin tends to hand us either a single line or
    // a multi-line chunk depending on flushing. Split defensively so
    // each entry in the ring is one logical line.
    const lines = line.split(/\r?\n/).filter(Boolean)
    if (lines.length === 0) return
    this.stderrRing.push(...lines)
    while (this.stderrRing.length > STDERR_RING_SIZE) {
      this.stderrRing.shift()
    }
    this.emit({ stderrLog: [...this.stderrRing] })
  }

  // ---- Lifecycle. ----

  async start(): Promise<void> {
    // Cancel any pending reconnect — an explicit start() supersedes
    // the timer-driven retry path.
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.stopped = false
    const generation = ++this.generation
    this.rejectPending('MCP connection restarting')
    this.buffer = ''
    this.wireProtocol = MODERN_PROTOCOL

    try {
      this.emit({
        status: 'checking',
        lastError: null,
        protocolVersion: null,
        capabilities: null,
        serverInfo: null,
      })

      // Process hygiene: kill existing process attached to window if any.
      const globalKey = `__mcp_child_${this.commandName}`
      const oldChild = (window as any)[globalKey]
      if (oldChild) {
        try {
          await oldChild.kill()
        } catch (e) {
          console.warn('Failed to kill previous sidecar process:', e)
        }
      }

      console.log(`Spawning local MCP sidecar: ${this.commandName}`)
      const command = this.env
        ? Command.sidecar(this.commandName, [], { env: this.env })
        : Command.sidecar(this.commandName)

      command.stdout.on('data', (data: string) => {
        if (generation === this.generation) this.handleStdout(data)
      })

      command.stderr.on('data', (data: string) => {
        // Keep the console log for dev-tools visibility, but also
        // capture so a UI Diagnostics panel can read it.
        console.error(`[${this.commandName} stderr]:`, data)
        this.appendStderr(typeof data === 'string' ? data : String(data))
      })

      command.on('close', (data: any) => {
        console.warn(`[${this.commandName}] sidecar process closed:`, data)
        if (generation === this.generation) this.handleProcessClose()
      })

      const spawned = await command.spawn()
      if (generation !== this.generation || this.stopped) {
        await spawned.kill()
        return
      }
      this.child = spawned
      ;(window as any)[globalKey] = this.child

      // Modern MCP is stateless: discover the server with protocol metadata on
      // every request. Only a method-not-found response permits legacy fallback.
      let discovery: any
      try {
        discovery = await this.call('server/discover')
      } catch (error) {
        if (!(error instanceof McpRpcError) || error.code !== -32601) throw error
        this.wireProtocol = LEGACY_PROTOCOL
        const initialized = await this.call('initialize', {
          protocolVersion: LEGACY_PROTOCOL,
          capabilities: {},
          clientInfo: CLIENT_INFO,
        })
        if (
          !isObject(initialized) ||
          !LEGACY_PROTOCOLS.has(initialized.protocolVersion) ||
          !validCapabilities(initialized.capabilities) ||
          !isObject(initialized.serverInfo) ||
          typeof initialized.serverInfo.name !== 'string' ||
          typeof initialized.serverInfo.version !== 'string'
        )
          throw new Error('Invalid or unsupported MCP initialize response')
        this.wireProtocol = initialized.protocolVersion
        await this.sendNotification('notifications/initialized')
        this.emit({
          protocolVersion: initialized.protocolVersion,
          capabilities: initialized.capabilities,
          serverInfo: {
            name: initialized.serverInfo.name,
            version: initialized.serverInfo.version,
          },
        })
      }
      if (this.wireProtocol === MODERN_PROTOCOL) {
        if (
          !isObject(discovery) ||
          discovery.resultType !== 'complete' ||
          !Array.isArray(discovery.supportedVersions) ||
          !discovery.supportedVersions.every((version: unknown) => typeof version === 'string') ||
          !discovery.supportedVersions.includes(MODERN_PROTOCOL) ||
          !validCapabilities(discovery.capabilities) ||
          (discovery._meta !== undefined && !isObject(discovery._meta))
        )
          throw new Error('Invalid or unsupported MCP discovery response')
        const serverInfo = discovery._meta?.['io.modelcontextprotocol/serverInfo']
        if (
          serverInfo !== undefined &&
          (!isObject(serverInfo) ||
            typeof serverInfo.name !== 'string' ||
            typeof serverInfo.version !== 'string')
        ) {
          throw new Error('Invalid MCP server information')
        }
        this.emit({
          protocolVersion: MODERN_PROTOCOL,
          capabilities: discovery.capabilities,
          serverInfo: serverInfo ?? null,
        })
      }
      if (generation !== this.generation || this.stopped) return

      this.emit({ status: 'online', lastError: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Failed to start sidecar ${this.commandName}:`, error)
      if (generation !== this.generation) return
      const failedChild = this.child
      this.child = null
      if (failedChild) {
        try {
          await failedChild.kill()
        } catch {
          /* best-effort process cleanup */
        }
      }
      this.rejectPending(message)
      this.emit({ status: 'offline', lastError: message })
      this.scheduleReconnect()
    }
  }

  async stop(): Promise<void> {
    this.stopped = true
    this.generation++
    this.rejectPending('MCP client stopped')
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.child) {
      try {
        await this.child.kill()
      } catch (e) {
        console.error(`Failed to kill sidecar ${this.commandName}:`, e)
      }
      this.child = null
    }
    this.emit({ status: 'offline' })
  }

  private handleProcessClose(): void {
    this.child = null
    // Fail any in-flight requests so callers don't hang forever waiting
    // on a response that will never arrive.
    this.rejectPending(`Sidecar ${this.commandName} exited mid-request`)

    this.emit({
      status: 'offline',
      lastError: this.snapshot.lastError ?? 'sidecar process closed',
    })
    this.scheduleReconnect()
  }

  private rejectPending(message: string): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timer)
      pending.reject(new Error(message))
    }
    this.pendingRequests.clear()
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      // Only retry if we're still offline. If something else brought
      // us back online (e.g. a manual start()), skip silently.
      if (this.snapshot.status === 'offline' && !this.stopped) {
        console.log(`[${this.commandName}] reconnect attempt`)
        void this.start()
      }
    }, RECONNECT_INTERVAL_MS)
  }

  // ---- JSON-RPC. ----

  /**
   * Send a JSON-RPC request and await the response.
   *
   * Discovery/read requests retry transient failures with exponential backoff.
   * tools/call never retries automatically, including after a failed write.
   * Server-side JSON-RPC errors (response.error populated) are NOT
   * retried — the sidecar made a decision and asking again won't
   * change it.
   */
  async call(method: string, params: any = {}): Promise<any> {
    let lastErr: unknown = null
    // A failed write can have delivered part or all of a mutation. The caller
    // must reconcile it; silently replaying tools/call can publish twice.
    const retryAttempts = RETRYABLE_METHODS.has(method) ? CALL_RETRY_ATTEMPTS : 0
    for (let attempt = 0; attempt <= retryAttempts; attempt++) {
      if (attempt > 0) {
        const delay = CALL_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1)
        await new Promise(r => setTimeout(r, delay))
      }
      if (!this.child) {
        lastErr = new Error(`Sidecar ${this.commandName} is not running`)
        continue
      }
      try {
        return await this.callOnce(method, params)
      } catch (e) {
        lastErr = e
        // Server-side JSON-RPC errors come through with a message
        // sourced from response.error.message. If the message wasn't
        // a wire/transport failure, don't retry — assume the sidecar
        // meant it.
        if (!isTransportError(e)) {
          throw e
        }
        console.warn(
          `[${this.commandName}] transport error on ${method} (attempt ${attempt + 1}):`,
          e
        )
      }
    }
    const message = lastErr instanceof Error ? lastErr.message : String(lastErr)
    this.emit({ lastError: message })
    throw lastErr instanceof Error ? lastErr : new Error(message)
  }

  private callOnce(method: string, params: any): Promise<any> {
    if (!this.child) {
      return Promise.reject(new Error(`Sidecar ${this.commandName} is not running`))
    }
    const id = this.nextId++
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: this.requestParams(method, params),
      id,
    }
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!this.pendingRequests.has(id)) return
        this.pendingRequests.delete(id)
        reject(new Error(`MCP Request timed out: ${method} (id: ${id})`))
        void this.sendNotification('notifications/cancelled', {
          requestId: id,
          reason: 'Desktop request timed out',
        }).catch(() => {
          /* process may already have exited */
        })
      }, 30000)
      this.pendingRequests.set(id, { resolve, reject, timer })
      void this.writeToStdin(request).catch(error => {
        const pending = this.pendingRequests.get(id)
        if (!pending) return
        this.pendingRequests.delete(id)
        clearTimeout(timer)
        reject(new TransportError(`stdin write failed: ${describeError(error)}`))
      })
    })
  }

  private async sendNotification(method: string, params: any = {}): Promise<void> {
    if (!this.child) return
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      method,
      params: this.requestParams(method, params),
    }
    await this.writeToStdin(request)
  }

  private requestParams(method: string, params: any): Record<string, any> {
    const result = isObject(params) ? { ...params } : {}
    const args = isObject(result.arguments) ? { ...result.arguments } : {}
    const legacyMeta = method === 'tools/call' && isObject(args._meta) ? args._meta : {}
    const requestMeta = isObject(result._meta) ? result._meta : {}
    const legacyCredential = legacyMeta.apiKey ?? legacyMeta.api_key
    const requestCredential = requestMeta.apiKey ?? requestMeta.api_key
    if (
      legacyCredential !== undefined &&
      requestCredential !== undefined &&
      legacyCredential !== requestCredential
    )
      throw new Error('Conflicting MCP credentials')
    const metadata = { ...legacyMeta, ...requestMeta }
    if (method === 'tools/call') {
      delete args._meta
      result.arguments = args
    }
    if (this.wireProtocol === MODERN_PROTOCOL) {
      result._meta = {
        ...metadata,
        'io.modelcontextprotocol/protocolVersion': MODERN_PROTOCOL,
        'io.modelcontextprotocol/clientInfo': CLIENT_INFO,
        'io.modelcontextprotocol/clientCapabilities': {},
      }
    } else {
      delete result._meta
      if (method === 'tools/call' && Object.keys(metadata).length) result.arguments._meta = metadata
    }
    return result
  }

  private async writeToStdin(request: JsonRpcRequest): Promise<void> {
    if (!this.child) {
      throw new TransportError('child process not running')
    }
    const line = JSON.stringify(request) + '\n'
    await this.child.write(line)
  }

  private handleStdout(data: string) {
    this.buffer += data
    let newlineIndex: number
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const line = this.buffer.slice(0, newlineIndex).trim()
      this.buffer = this.buffer.slice(newlineIndex + 1)

      if (!line) continue

      try {
        const response: JsonRpcResponse = JSON.parse(line)
        if (!isObject(response) || response.jsonrpc !== '2.0') {
          throw new Error('Invalid JSON-RPC response')
        }
        if (response.id !== undefined && response.id !== null) {
          const handler = this.pendingRequests.get(response.id)
          if (handler) {
            this.pendingRequests.delete(response.id)
            clearTimeout(handler.timer)
            if (response.error) {
              handler.reject(new McpRpcError(response.error.code, response.error.message))
            } else {
              handler.resolve(response.result)
            }
          }
        }
      } catch (e) {
        console.error('Failed to parse JSON-RPC line from stdout:', line, e)
      }
    }
  }

  isOnline(): boolean {
    return this.child !== null && this.snapshot.status === 'online'
  }
}

/**
 * Marker type for failures the retry layer should re-attempt. We
 * deliberately do NOT extend from a vendor error type — duck-typing
 * keeps it cheap to throw these from anywhere and easy for the retry
 * predicate to check without imports.
 */
class TransportError extends Error {
  readonly isTransportError = true
  constructor(message: string) {
    super(message)
    this.name = 'TransportError'
  }
}

function isTransportError(e: unknown): boolean {
  if (e instanceof TransportError) return true
  if (e && typeof e === 'object' && 'isTransportError' in e) {
    return Boolean((e as { isTransportError?: boolean }).isTransportError)
  }
  // "not running" failures come from callOnce() before we even have
  // a request id; treat them as transport-layer issues.
  if (e instanceof Error && /is not running/.test(e.message)) return true
  return false
}

function describeError(e: unknown): string {
  if (e instanceof Error) return e.message
  if (typeof e === 'string') return e
  try {
    return JSON.stringify(e)
  } catch {
    return String(e)
  }
}
