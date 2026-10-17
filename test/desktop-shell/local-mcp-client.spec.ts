/**
 * Unit tests for the live LocalMcpClient behavior added in D5 (stderr
 * ring buffer) and D7 (retry/backoff + reconnect). These run against
 * the real client with a faked @tauri-apps/plugin-shell sidecar, so
 * they verify the logic that actually ships in the desktop app — not
 * the McpStatusPanel/useLocalMcp scaffolding (which isn't bundled yet).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

type Listener = (data: any) => void

/**
 * Fake of the Tauri Command child. Captures stdin writes and lets the
 * test drive stdout/stderr/close events. By default it auto-answers any
 * id-bearing JSON-RPC request with a success result, including the complete
 * 2026 discovery response required for start() to reach online.
 */
class FakeCommand {
  stdoutCbs: Listener[] = []
  stderrCbs: Listener[] = []
  closeCbs: Listener[] = []

  stdout = {
    on: (_evt: string, cb: Listener) => {
      this.stdoutCbs.push(cb)
    },
  }
  stderr = {
    on: (_evt: string, cb: Listener) => {
      this.stderrCbs.push(cb)
    },
  }
  on(evt: string, cb: Listener) {
    if (evt === 'close') this.closeCbs.push(cb)
  }

  async spawn() {
    return spawnMock(this)
  }
}

class FakeChild {
  writes: string[] = []
  killed = false
  autoRespond = true
  cmd: FakeCommand

  constructor(cmd: FakeCommand) {
    this.cmd = cmd
  }

  writeError: Error | null = null

  async write(line: string) {
    this.writes.push(line)
    if (this.writeError) throw this.writeError
    if (!this.autoRespond) return
    try {
      const msg = JSON.parse(line)
      if (msg.id !== undefined && msg.id !== null) {
        queueMicrotask(() =>
          this.emitStdout(
            JSON.stringify({ jsonrpc: '2.0', id: msg.id, ...responseFor(msg) }) + '\n'
          )
        )
      }
    } catch {
      /* notifications have no id; ignore */
    }
  }

  async kill() {
    this.killed = true
  }

  emitStdout(data: string) {
    this.cmd.stdoutCbs.forEach(cb => cb(data))
  }
  emitStderr(data: string) {
    this.cmd.stderrCbs.forEach(cb => cb(data))
  }
  emitClose(data: any) {
    this.cmd.closeCbs.forEach(cb => cb(data))
  }
}

const modernDiscovery = {
  supportedVersions: ['2026-07-28'],
  capabilities: { tools: {}, resources: {}, prompts: {} },
  resultType: 'complete',
  _meta: { 'io.modelcontextprotocol/serverInfo': { name: 'test-server', version: '2.0.0' } },
}
const legacyInitialization = {
  protocolVersion: '2025-06-18',
  capabilities: { tools: {} },
  serverInfo: { name: 'legacy-server', version: '1.1.0' },
}
let responseFor = (msg: any): Record<string, unknown> => ({
  result: msg.method === 'server/discover' ? modernDiscovery : {},
})
const children: FakeChild[] = []
const spawnMock = vi.fn(async (cmd: FakeCommand) => {
  const c = new FakeChild(cmd)
  children.push(c)
  return c
})

vi.mock('@tauri-apps/plugin-shell', () => ({
  Command: {
    sidecar: vi.fn(() => new FakeCommand()),
  },
}))

import { LocalMcpClient } from '../../desktop-shell/src/localMcpClient'
import { Command } from '@tauri-apps/plugin-shell'

beforeEach(() => {
  children.length = 0
  responseFor = msg => ({ result: msg.method === 'server/discover' ? modernDiscovery : {} })
  spawnMock.mockClear()
  // The client stashes the child on window[`__mcp_child_<name>`]; clear
  // it between tests so the "kill previous process" path doesn't fire.
  for (const key of Object.keys(window as any)) {
    if (key.startsWith('__mcp_child_')) delete (window as any)[key]
  }
})

afterEach(() => {
  vi.useRealTimers()
})

describe('LocalMcpClient — start + status (D3 plumbing)', () => {
  it('reaches online after discovery and notifies subscribers', async () => {
    const client = new LocalMcpClient('pa-mcp')
    const seen: string[] = []
    client.subscribe(() => seen.push(client.getSnapshot().status))

    await client.start()

    expect(client.getSnapshot().status).toBe('online')
    expect(client.isOnline()).toBe(true)
    // checking → online transitions both observed
    expect(seen).toContain('checking')
    expect(seen).toContain('online')
  })

  it('bridges the legacy onStatusChange callback', async () => {
    const cb = vi.fn()
    const client = new LocalMcpClient('pa-mcp', cb)
    await client.start()
    expect(cb).toHaveBeenCalledWith('online')
  })
})

describe('LocalMcpClient — stderr ring buffer (D5)', () => {
  it('captures sidecar stderr into the snapshot, split per line', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()

    children[0].emitStderr('Traceback line 1\nTraceback line 2\n')
    children[0].emitStderr('a third line')

    const log = client.getSnapshot().stderrLog
    expect(log).toContain('Traceback line 1')
    expect(log).toContain('Traceback line 2')
    expect(log).toContain('a third line')
  })

  it('caps the ring so it never grows unbounded', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()

    // Emit well past the 200-line cap.
    for (let i = 0; i < 250; i++) children[0].emitStderr(`line ${i}`)

    const log = client.getSnapshot().stderrLog
    expect(log.length).toBeLessThanOrEqual(200)
    // Oldest lines evicted; newest retained.
    expect(log).toContain('line 249')
    expect(log).not.toContain('line 0')
  })
})

describe('LocalMcpClient — retry/backoff (D7)', () => {
  it('retries a transport failure the configured number of times then throws', async () => {
    vi.useFakeTimers()
    // Never started → child is null → every attempt is a transport error.
    const client = new LocalMcpClient('pa-mcp')

    const promise = client.call('tools/list', {})
    // Attach the rejection handler BEFORE advancing timers so the
    // rejection is never momentarily unhandled.
    const assertion = expect(promise).rejects.toThrow(/not running/i)
    // Drain the 250ms + 500ms backoff sleeps.
    await vi.advanceTimersByTimeAsync(1000)
    await assertion

    // lastError surfaced on the snapshot.
    expect(client.getSnapshot().lastError).toMatch(/not running/i)
  })
})

describe('LocalMcpClient — reconnect cycle (D7)', () => {
  it('schedules a respawn ~30s after the sidecar closes', async () => {
    // Fake timers from the start so the reconnect setTimeout is
    // registered with the fake clock (enabling them after the close
    // would leave the already-scheduled real-timer uncontrolled).
    vi.useFakeTimers()
    const client = new LocalMcpClient('pa-mcp')
    const startP = client.start()
    // Flush the microtask-driven initialize handshake.
    await vi.advanceTimersByTimeAsync(0)
    await startP
    expect(spawnMock).toHaveBeenCalledTimes(1)

    // Sidecar dies.
    children[0].emitClose({ code: 1 })
    expect(client.getSnapshot().status).toBe('offline')

    // Advance to the 30s reconnect tick; the timer calls start() again.
    // The extra 0-advance flushes the respawn's own handshake.
    await vi.advanceTimersByTimeAsync(30_000)
    await vi.advanceTimersByTimeAsync(0)

    expect(spawnMock).toHaveBeenCalledTimes(2)
  })

  it('does not reconnect after an explicit stop()', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    await client.stop()
    expect(client.getSnapshot().status).toBe('offline')

    vi.useFakeTimers()
    await vi.advanceTimersByTimeAsync(60_000)
    vi.useRealTimers()

    // Only the original spawn — stop() cancels the reconnect path.
    expect(spawnMock).toHaveBeenCalledTimes(1)
  })
})

describe('LocalMcpClient — sidecar env injection', () => {
  it('passes the provided env to Command.sidecar so the sidecar hits prod, not localhost', async () => {
    const sidecarMock = vi.mocked(Command.sidecar)
    sidecarMock.mockClear()
    const env = { PLANETARY_AGENTS_BACKEND_URL: 'https://api.agents.alchm.kitchen' }

    const client = new LocalMcpClient('bin/pa-mcp', undefined, env)
    await client.start()

    expect(sidecarMock).toHaveBeenCalledWith('bin/pa-mcp', [], { env })
  })

  it('spawns with no options when no env is given (back-compat)', async () => {
    const sidecarMock = vi.mocked(Command.sidecar)
    sidecarMock.mockClear()

    const client = new LocalMcpClient('bin/pa-mcp')
    await client.start()

    expect(sidecarMock).toHaveBeenCalledWith('bin/pa-mcp')
  })
})

describe('LocalMcpClient — protocol negotiation and metadata', () => {
  it('discovers 2026 servers with protocol metadata and records capabilities', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    const writes = children[0].writes.map(line => JSON.parse(line))
    expect(writes.map(message => message.method)).toEqual(['server/discover'])
    expect(writes[0].params._meta).toMatchObject({
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'alchm-desktop-shell' },
      'io.modelcontextprotocol/clientCapabilities': {},
    })
    expect(client.getSnapshot()).toMatchObject({
      protocolVersion: '2026-07-28',
      capabilities: modernDiscovery.capabilities,
      serverInfo: { name: 'test-server', version: '2.0.0' },
    })
    await client.stop()
  })

  it('falls back to initialize only for method-not-found and notifies initialized', async () => {
    responseFor = msg =>
      msg.method === 'server/discover'
        ? { error: { code: -32601, message: 'Unknown method' } }
        : { result: msg.method === 'initialize' ? legacyInitialization : {} }
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    const writes = children[0].writes.map(line => JSON.parse(line))
    expect(writes.map(message => message.method)).toEqual([
      'server/discover',
      'initialize',
      'notifications/initialized',
    ])
    expect(writes[1].params).toMatchObject({ protocolVersion: '2025-06-18' })
    expect(writes[1].params._meta).toBeUndefined()
    expect(client.getSnapshot().protocolVersion).toBe('2025-06-18')
    await client.stop()
  })

  it.each([
    { error: { code: -32603, message: 'Discovery failed' } },
    { result: {} },
    { result: { ...modernDiscovery, supportedVersions: ['2099-01-01'] } },
    { result: { ...modernDiscovery, resultType: 'partial' } },
    { result: { ...modernDiscovery, capabilities: [] } },
    { result: { ...modernDiscovery, _meta: 'invalid metadata' } },
  ])('rejects discovery failure without falling back: %j', async discoveryResponse => {
    responseFor = () => discoveryResponse
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    expect(client.getSnapshot().status).toBe('offline')
    expect(children[0].writes.map(line => JSON.parse(line).method)).toEqual(['server/discover'])
    expect(children[0].killed).toBe(true)
    await client.stop()
  })

  it('rejects malformed legacy initialization', async () => {
    responseFor = msg =>
      msg.method === 'server/discover'
        ? { error: { code: -32601, message: 'Unknown method' } }
        : { result: {} }
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    expect(client.getSnapshot()).toMatchObject({
      status: 'offline',
      lastError: 'Invalid or unsupported MCP initialize response',
    })
    await client.stop()
  })

  it.each(['2024-11-05', '2025-06-18'])('accepts legacy protocol %s', async protocolVersion => {
    responseFor = msg =>
      msg.method === 'server/discover'
        ? { error: { code: -32601, message: 'Unknown method' } }
        : {
            result: msg.method === 'initialize' ? { ...legacyInitialization, protocolVersion } : {},
          }
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    await client.call('tools/call', {
      name: 'chat_with_planetary_agent',
      arguments: { message: 'hello' },
      _meta: { apiKey: 'legacy-key', caller: 'test' },
    })
    const call = JSON.parse(children[0].writes.at(-1)!)
    expect(client.getSnapshot().status).toBe('online')
    expect(call.params._meta).toBeUndefined()
    expect(call.params.arguments._meta).toEqual({ apiKey: 'legacy-key', caller: 'test' })
    await client.stop()
  })

  it('moves legacy argument metadata into modern request metadata without mutating input', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    const params = {
      name: 'chat_with_planetary_agent',
      arguments: {
        message: 'hello',
        _meta: { apiKey: 'modern-key', caller: 'test' },
      },
    }
    await client.call('tools/call', params)
    const call = JSON.parse(children[0].writes.at(-1)!)
    expect(call.params.arguments).toEqual({ message: 'hello' })
    expect(call.params._meta).toMatchObject({
      apiKey: 'modern-key',
      caller: 'test',
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
    })
    expect(params.arguments._meta.apiKey).toBe('modern-key')
    await client.stop()
  })

  it('rejects conflicting credentials before writing a tool call', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    await expect(
      client.call('tools/call', {
        name: 'chat_with_planetary_agent',
        arguments: { _meta: { apiKey: 'first' } },
        _meta: { apiKey: 'second' },
      })
    ).rejects.toThrow('Conflicting MCP credentials')
    expect(children[0].writes).toHaveLength(1)
    await client.stop()
  })
})

describe('LocalMcpClient — asynchronous transport and cancellation', () => {
  it('surfaces an asynchronous write rejection without replaying a mutation', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    children[0].writeError = new Error('pipe closed asynchronously')
    await expect(client.call('tools/call', { name: 'publish_weekly_menu' })).rejects.toThrow(
      'stdin write failed: pipe closed asynchronously'
    )
    expect(children[0].writes.map(line => JSON.parse(line).method)).toEqual([
      'server/discover',
      'tools/call',
    ])
    await client.stop()
  })

  it('clears settled request timers and sends cancellation when a request times out', async () => {
    vi.useFakeTimers()
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    expect(vi.getTimerCount()).toBe(0)
    children[0].autoRespond = false
    const pending = client.call('tools/call', { name: 'chat_with_planetary_agent' })
    const assertion = expect(pending).rejects.toThrow('MCP Request timed out')
    await vi.advanceTimersByTimeAsync(30_000)
    await assertion
    const writes = children[0].writes.map(line => JSON.parse(line))
    expect(writes.at(-1)).toMatchObject({
      method: 'notifications/cancelled',
      params: { requestId: writes[1].id, reason: 'Desktop request timed out' },
    })
    expect(writes.at(-1).id).toBeUndefined()
    expect(writes.filter(message => message.method === 'tools/call')).toHaveLength(1)
    expect(vi.getTimerCount()).toBe(0)
    await client.stop()
  })

  it('ignores a previous child close after reconnecting', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    const previous = children[0]
    await client.start()
    previous.emitClose({ code: 0 })
    expect(client.isOnline()).toBe(true)
    expect(children[1].killed).toBe(false)
    await client.stop()
  })

  it('reassembles fragmented newline-delimited responses', async () => {
    const client = new LocalMcpClient('pa-mcp')
    await client.start()
    const child = children[0]
    child.autoRespond = false
    const pending = client.call('tools/list')
    const id = JSON.parse(child.writes.at(-1)!).id
    const line = JSON.stringify({ jsonrpc: '2.0', id, result: { tools: [] } }) + '\n'
    child.emitStdout(line.slice(0, 12))
    child.emitStdout(line.slice(12))
    await expect(pending).resolves.toEqual({ tools: [] })
    await client.stop()
  })
})
