/**
 * useLocalMcp — thin React wrapper around LocalMcpClient.
 *
 * The desktop shell is currently vanilla TypeScript (see main.ts), so
 * this hook isn't consumed today. It exists so that when React panels
 * are added — particularly the MCP Status Panel documented in
 * desktop-shell/README.md — they can subscribe to a
 * client's snapshot via useSyncExternalStore without reinventing
 * boilerplate or risking torn reads.
 *
 * Design notes:
 *
 * - We do NOT call client.start() from the hook. The shell already
 *   manages sidecar lifecycle in main.ts, and React effects firing on
 *   mount/unmount would race that. The hook is observation-only.
 *
 * - useSyncExternalStore is intentional rather than useState + a
 *   useEffect subscribe pattern. The former handles concurrent
 *   rendering and tearing correctly; the latter doesn't.
 *
 * - The returned `call` is bound to the client so consumers can
 *   safely destructure: `const { call } = useLocalMcp(paMcpClient)`.
 */

import { useSyncExternalStore, useMemo, useDebugValue } from 'react'

import type { LocalMcpClient, LocalMcpSnapshot, LocalMcpStatus } from '../localMcpClient'

export interface UseLocalMcpResult {
  status: LocalMcpStatus
  lastError: string | null
  /**
   * Tail of stderr lines from the underlying sidecar process. Bounded
   * by the client's STDERR_RING_SIZE (currently 200). Order is
   * oldest-first. Diagnostic panels typically reverse this for
   * display.
   */
  stderrLog: readonly string[]
  /**
   * Pre-bound call() so consumers can `const { call } = useLocalMcp(x)`
   * and pass it down without worrying about losing `this`.
   */
  call: (method: string, params?: any) => Promise<any>
}

export function useLocalMcp(client: LocalMcpClient): UseLocalMcpResult {
  const snapshot: LocalMcpSnapshot = useSyncExternalStore(
    client.subscribe,
    client.getSnapshot,
    // SSR fallback. The desktop shell never renders on the server, but
    // returning the same initial snapshot keeps the contract honest
    // and means this hook is safely portable into the Next.js app
    // shell if that ever becomes useful.
    client.getSnapshot
  )

  // Bind call() once per client so component identity stays stable
  // and effect deps that include `call` don't re-fire every render.
  const call = useMemo(() => client.call.bind(client), [client])

  useDebugValue(snapshot.status)

  return {
    status: snapshot.status,
    lastError: snapshot.lastError,
    stderrLog: snapshot.stderrLog,
    call,
  }
}
