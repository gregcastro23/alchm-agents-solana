export const DESKTOP_APP_REPOSITORY_URL = 'https://github.com/gregcastro23/alchm-agents-app'
export const DESKTOP_APP_DOWNLOAD_URL =
  process.env.NEXT_PUBLIC_ALCHM_DESKTOP_DOWNLOAD_URL?.trim() ||
  `${DESKTOP_APP_REPOSITORY_URL}/releases`

export const ALCHM_DESKTOP_APP_NAME = 'Alchm Desktop'
export const ALCHM_DESKTOP_DOWNLOAD_LABEL = 'Download Alchm Desktop'
export const ALCHM_DESKTOP_AGENT_DOWNLOAD_LABEL = 'Download to Alchm Desktop'
export const ALCHM_DESKTOP_AGENT_UNLOCK_LABEL = 'Unlock in Alchm Desktop'
export const ALCHM_DESKTOP_AGENT_UNLOCK_DESCRIPTION =
  'Alchm Desktop is the native chat interface. Agent cards unlock access inside that app instead of downloading separate agent files.'

export type DesktopAgentUnlockRequest = {
  id: string
  name: string
  tier?: 'base' | 'premium'
  expiresAt?: number
}

const PLATFORM_DOWNLOAD_URLS = {
  mac: process.env.NEXT_PUBLIC_ALCHM_DESKTOP_MAC_DOWNLOAD_URL?.trim(),
  windows: process.env.NEXT_PUBLIC_ALCHM_DESKTOP_WINDOWS_DOWNLOAD_URL?.trim(),
  linux: process.env.NEXT_PUBLIC_ALCHM_DESKTOP_LINUX_DOWNLOAD_URL?.trim(),
}

export function getDesktopAppDownloadUrl() {
  if (typeof window === 'undefined') {
    return DESKTOP_APP_DOWNLOAD_URL
  }

  const userAgent = window.navigator.userAgent.toLowerCase()
  const platform = window.navigator.platform.toLowerCase()

  if (PLATFORM_DOWNLOAD_URLS.mac && (userAgent.includes('mac') || platform.includes('mac'))) {
    return PLATFORM_DOWNLOAD_URLS.mac
  }

  if (PLATFORM_DOWNLOAD_URLS.windows && (userAgent.includes('win') || platform.includes('win'))) {
    return PLATFORM_DOWNLOAD_URLS.windows
  }

  if (PLATFORM_DOWNLOAD_URLS.linux && (userAgent.includes('linux') || platform.includes('linux'))) {
    return PLATFORM_DOWNLOAD_URLS.linux
  }

  return DESKTOP_APP_DOWNLOAD_URL
}

export function openDesktopAppDownload() {
  if (typeof window === 'undefined') {
    return
  }

  window.open(getDesktopAppDownloadUrl(), '_blank', 'noopener,noreferrer')
}

export async function createDesktopAgentUnlockDeepLink(agent: DesktopAgentUnlockRequest) {
  const res = await fetch('/api/deep-link/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id: agent.id,
      name: agent.name,
      tier: agent.tier || 'base',
      expiresAt: agent.expiresAt || Date.now() + 5 * 60 * 1000,
    }),
  })

  if (!res.ok) {
    throw new Error('Failed to create Alchm Desktop unlock link')
  }

  const data = (await res.json()) as { deepLink?: string }
  if (!data.deepLink) {
    throw new Error('Alchm Desktop unlock link response was missing a deep link')
  }

  return data.deepLink
}
