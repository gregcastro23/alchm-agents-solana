import { logger } from '../utils/logger.js'

export interface AlchmKitchenFeedPayload {
  agentEmail: string
  eventType: string
  actionType?: string
  activityDetails?: Record<string, unknown>
  timestamp?: string
  agentDisplayName?: string
  metadataPayload: Record<string, unknown>
}

export interface WebhookPostResult {
  success: boolean
  status?: number
  responseBody?: string
  error?: string
  dryRun?: boolean
}

export class AlchmKitchenWebhookService {
  constructor(
    private readonly baseUrl = resolveAlchmKitchenBaseUrl(),
    private readonly internalSecret = process.env.INTERNAL_API_SECRET || '',
    private readonly dryRun = process.env.ASTRO_ACTION_DRY_RUN === 'true'
  ) {}

  isConfigured(): boolean {
    return Boolean(this.baseUrl && this.internalSecret)
  }

  async postFeedEvent(payload: AlchmKitchenFeedPayload): Promise<WebhookPostResult> {
    if (this.dryRun) {
      logger.info('Astrological action webhook dry run', payload)
      return { success: true, dryRun: true }
    }

    if (!this.isConfigured()) {
      return {
        success: false,
        error: 'ALCHM_KITCHEN_SYNC_URL/ALCHM_KITCHEN_FEED_URL and INTERNAL_API_SECRET are required',
      }
    }

    const endpoint = `${this.baseUrl.replace(/\/$/, '')}/api/feed`

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.internalSecret}`,
        },
        body: JSON.stringify(enrichFeedPayload(payload)),
      })

      const responseBody = await response.text()

      if (!response.ok) {
        return {
          success: false,
          status: response.status,
          responseBody,
          error: `Feed webhook failed with HTTP ${response.status}`,
        }
      }

      return {
        success: true,
        status: response.status,
        responseBody,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }
    }
  }
}

export const alchmKitchenWebhookService = new AlchmKitchenWebhookService()

function resolveAlchmKitchenBaseUrl(): string {
  const configuredBase =
    process.env.ALCHM_KITCHEN_SYNC_URL ||
    process.env.ALCHM_KITCHEN_FEED_URL ||
    process.env.ALCHM_KITCHEN_BASE_URL ||
    process.env.WHATTOEATNEXT_URL ||
    process.env.WHATTOEATNEXT_BASE_URL

  if (configuredBase) return configuredBase

  const legacyBase = process.env.ALCHM_KITCHEN_URL
  if (legacyBase && !legacyBase.includes('railway.app')) return legacyBase

  return 'https://alchm.kitchen'
}

function enrichFeedPayload(payload: AlchmKitchenFeedPayload): AlchmKitchenFeedPayload {
  const metadata = withNarrationMetadata(payload.eventType, payload.metadataPayload)
  const actionType =
    payload.actionType ||
    stringFromMetadata(metadata, 'actionType', 'action_type') ||
    payload.eventType
  const timestamp =
    payload.timestamp || stringFromMetadata(metadata, 'timestamp') || new Date().toISOString()
  const activityDetails =
    payload.activityDetails ||
    objectFromMetadata(metadata, 'activityDetails', 'activity_details') ||
    metadata

  return {
    ...payload,
    actionType,
    activityDetails,
    timestamp,
    metadataPayload: {
      ...metadata,
      actionType,
      activityDetails,
      timestamp,
    },
  }
}

function withNarrationMetadata(
  eventType: string,
  metadataPayload: Record<string, unknown>
): Record<string, unknown> {
  // Keep these names aligned with WTEN's eventNarration helper.
  const metadata = { ...metadataPayload }
  const targetName = stringFromMetadata(metadata, 'targetName', 'withAgent', 'partnerName')
  if (targetName) {
    metadata.targetName ??= targetName
    metadata.withAgent ??= targetName
  }

  const topic =
    stringFromMetadata(metadata, 'topic', 'subject', 'summary') ||
    stringFromMetadata(metadata, 'item', 'recipeName', 'dishName', 'insightTitle', 'message')
  if (topic) metadata.topic ??= truncateForFeed(topic, 90)

  if (['agent_chat', 'chat', 'agent.chat'].includes(eventType)) {
    const excerpt = stringFromMetadata(
      metadata,
      'messageExcerpt',
      'message',
      'responsePreview',
      'insightContent',
      'description'
    )
    if (excerpt) {
      metadata.messageExcerpt ??= truncateForFeed(excerpt, 160)
      metadata.message ??= truncateForFeed(excerpt, 500)
    }
  }

  const recipeId = stringFromMetadata(metadata, 'recipeId', 'recipe_id')
  if (recipeId) {
    metadata.recipeId ??= recipeId
    metadata.recipe_id ??= recipeId
  }

  const summary = stringFromMetadata(metadata, 'summary', 'insightContent', 'description', 'review')
  if (summary) metadata.summary ??= truncateForFeed(summary, 180)

  return metadata
}

function truncateForFeed(value: string, limit: number): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= limit) return compact
  return `${compact.slice(0, Math.max(0, limit - 3)).trim()}...`
}

function stringFromMetadata(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = metadata[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return undefined
}

function objectFromMetadata(
  metadata: Record<string, unknown>,
  ...keys: string[]
): Record<string, unknown> | undefined {
  for (const key of keys) {
    const value = metadata[key]
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>
    }
  }
  return undefined
}
