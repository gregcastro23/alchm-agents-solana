// Updated with fixed configuration

import { logger } from '../utils/logger.js'

const GALILEO_URL = 'https://console.rungalileo.io/api/logs'
const API_KEY = process.env.GALILEO_API_KEY
const PROJECT = process.env.GALILEO_PROJECT || 'AlchmPlanetaryAgents'
const LOG_STREAM = process.env.GALILEO_LOG_STREAM || 'test'
const FAIL_SILENTLY = process.env.GALILEO_FAIL_SILENTLY === 'true'

export const galileoConfig = {
  url: GALILEO_URL,
  apiKeyConfigured: !!API_KEY,
  project: PROJECT,
  stream: LOG_STREAM,
  failSilently: FAIL_SILENTLY,
}

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function sendLogWithRetry(level: string, message: string, metadata: any = {}): Promise<void> {
  if (!API_KEY) {
    if (!FAIL_SILENTLY) logger.warn('Galileo API key not configured - falling back to console')
    return fallbackToConsole(level, message, metadata)
  }

  const logData = {
    project: PROJECT,
    stream: LOG_STREAM,
    level,
    message,
    metadata: {
      ...metadata,
      timestamp: new Date().toISOString(),
    },
  }

  const retries = 3
  const backoffDelays = [1000, 2000, 4000]
  let lastError: any = null

  for (let attempt = 0; attempt < retries; attempt++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
      const response = await fetch(GALILEO_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(logData),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      if (!response.ok) {
        if (response.status === 422) {
          logger.error('Galileo 422 error: Check project type/configuration')
          break
        }
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      return
    } catch (error) {
      clearTimeout(timeout)
      lastError = error
      if (attempt < retries - 1) {
        await delay(backoffDelays[attempt])
      }
    }
  }

  logger.error(`Galileo logging failed after ${retries} attempts: ${lastError?.message}`)
  if (!FAIL_SILENTLY) {
    fallbackToConsole(level, message, metadata)
  }
}

function fallbackToConsole(level: string, message: string, metadata: any): void {
  const logMessage = `[Galileo Fallback - ${level.toUpperCase()}] ${message}`
  const metaStr = Object.keys(metadata).length
    ? `\nMetadata: ${JSON.stringify(metadata, null, 2)}`
    : ''
  logger[level](`${logMessage}${metaStr}`)
}

// Log levels
export async function logInfo(message: string, metadata: any = {}): Promise<void> {
  await sendLogWithRetry('info', message, metadata)
}

export async function logError(message: string, metadata: any = {}): Promise<void> {
  await sendLogWithRetry('error', message, metadata)
}

export async function logWarn(message: string, metadata: any = {}): Promise<void> {
  await sendLogWithRetry('warn', message, metadata)
}

export async function logDebug(message: string, metadata: any = {}): Promise<void> {
  await sendLogWithRetry('debug', message, metadata)
}

// Specialized functions
export async function logQuantities(quantities: any): Promise<void> {
  await logInfo('Quantities Log', { quantities })
}

export async function logAgentInteraction(interaction: any): Promise<void> {
  await logInfo('Agent Interaction', { interaction })
}
