'use client'

interface SidecarProxyResponse {
  status: number
  body: string
  contentType?: string | null
}

interface SidecarRequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
  apiKey?: string
  nonce?: string
}

export function hasTauriInvokeRuntime() {
  if (typeof window === 'undefined') return false
  const tauriWindow = window as Window & {
    __TAURI_INTERNALS__?: { invoke?: unknown }
  }
  return typeof tauriWindow.__TAURI_INTERNALS__?.invoke === 'function'
}

export async function requestDesktopSidecar(
  path: string,
  { method = 'GET', body, apiKey, nonce }: SidecarRequestOptions = {}
) {
  if (hasTauriInvokeRuntime()) {
    const { invoke } = await import('@tauri-apps/api/core')
    const response = await invoke<SidecarProxyResponse>('sidecar_request', {
      request: {
        method,
        path,
        body: body ?? null,
        apiKey: apiKey || null,
      },
    })

    return new Response(response.body || '', {
      status: response.status,
      headers: {
        'Content-Type': response.contentType || 'text/plain',
      },
    })
  }

  const headers: Record<string, string> = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  if (nonce) headers['X-IPC-Nonce'] = nonce

  return fetch(`http://localhost:8080${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  })
}
