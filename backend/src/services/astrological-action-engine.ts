import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { logger } from '../utils/logger.js'
import {
  mapAgentActions,
  type CandidateAgentAction,
  type HistoricalAgentRecord,
} from './agent-action-mapper.js'
import {
  alchmKitchenWebhookService,
  type AlchmKitchenWebhookService,
} from './alchm-kitchen-webhook.js'
import {
  buildSkyContext,
  detectTransitTriggers,
  type SkyContext,
} from './transit-trigger-detector.js'

export interface AstrologicalActionEngineOptions {
  evaluatedAt?: Date
  dryRun?: boolean
  maxAgents?: number
  maxActionsPerAgent?: number
  dispatch?: boolean
}

export interface AstrologicalActionEngineResult {
  evaluatedAt: string
  agentsProcessed: number
  triggersFound: number
  actionsQueued: number
  actionsSkipped: number
  actionsPosted: number
  errors: string[]
  dryRun: boolean
}

const prisma = new PrismaClient()

function actionEventsDelegate(): any {
  return (prisma as any).agent_action_events
}

function historicalAgentsDelegate(): any {
  return (prisma as any).historical_agents
}

function bucketFor(date: Date, window: CandidateAgentAction['idempotencyWindow']): string {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')

  if (window === 'day') return `${year}-${month}-${day}`
  if (window === 'half-day')
    return `${year}-${month}-${day}-${date.getUTCHours() < 12 ? 'am' : 'pm'}`
  if (window === 'week') {
    const start = Date.UTC(year, 0, 1)
    const week = Math.ceil(((date.getTime() - start) / 86400000 + 1) / 7)
    return `${year}-W${String(week).padStart(2, '0')}`
  }

  return `${year}-${month}-${day}-${date.getUTCHours()}`
}

function idempotencyKeyFor(action: CandidateAgentAction, evaluatedAt: Date): string {
  const raw = [
    action.agentId,
    action.eventType,
    action.triggerType,
    action.triggerSummary,
    bucketFor(evaluatedAt, action.idempotencyWindow),
  ].join('|')

  return crypto.createHash('sha256').update(raw).digest('hex')
}

function cutoffForCooldown(evaluatedAt: Date, cooldownHours: number): Date {
  return new Date(evaluatedAt.getTime() - cooldownHours * 60 * 60 * 1000)
}

function webhookPayloadFor(action: CandidateAgentAction) {
  return {
    agentEmail: action.agentEmail,
    eventType: action.eventType,
    metadataPayload: action.metadataPayload,
  }
}

export class AstrologicalActionEngine {
  private isRunning = false

  constructor(
    private readonly webhookService: AlchmKitchenWebhookService = alchmKitchenWebhookService
  ) {}

  async evaluate(
    options: AstrologicalActionEngineOptions = {}
  ): Promise<AstrologicalActionEngineResult> {
    if (this.isRunning) {
      throw new Error('Astrological action engine evaluation is already running')
    }

    this.isRunning = true
    const evaluatedAt = options.evaluatedAt || new Date()
    const dryRun = options.dryRun ?? process.env.ASTRO_ACTION_DRY_RUN === 'true'
    const maxAgents = options.maxAgents ?? Number(process.env.ASTRO_ACTION_MAX_AGENTS || 100)
    const maxActionsPerAgent =
      options.maxActionsPerAgent ?? Number(process.env.ASTRO_ACTIONS_MAX_PER_AGENT || 1)
    const dispatch = options.dispatch ?? true
    const result: AstrologicalActionEngineResult = {
      evaluatedAt: evaluatedAt.toISOString(),
      agentsProcessed: 0,
      triggersFound: 0,
      actionsQueued: 0,
      actionsSkipped: 0,
      actionsPosted: 0,
      errors: [],
      dryRun,
    }

    try {
      const sky = buildSkyContext(evaluatedAt)
      const agents = await this.loadAgents(maxAgents)

      for (const agent of agents) {
        try {
          const triggers = detectTransitTriggers(agent.natalChart, sky)
          result.triggersFound += triggers.length

          const candidates = mapAgentActions(agent, triggers, sky).slice(0, maxActionsPerAgent)
          for (const candidate of candidates) {
            const queued = dryRun ? false : await this.queueAction(candidate, evaluatedAt)
            if (queued) {
              result.actionsQueued++
            } else {
              result.actionsSkipped++
            }
          }

          result.agentsProcessed++
        } catch (error) {
          const message = `Agent ${agent.agentId} evaluation failed: ${
            error instanceof Error ? error.message : String(error)
          }`
          result.errors.push(message)
          logger.warn(message)
        }
      }

      if (!dryRun && dispatch) {
        const dispatchResult = await this.dispatchPending()
        result.actionsPosted = dispatchResult.posted
        result.errors.push(...dispatchResult.errors)
      }

      logger.info('Astrological action engine evaluation completed', result)
      return result
    } finally {
      this.isRunning = false
    }
  }

  async preview(
    options: Omit<AstrologicalActionEngineOptions, 'dryRun' | 'dispatch'> = {}
  ): Promise<{
    sky: SkyContext
    agents: Array<{
      agentId: string
      name: string
      triggerCount: number
      actions: CandidateAgentAction[]
    }>
  }> {
    const evaluatedAt = options.evaluatedAt || new Date()
    const maxAgents = options.maxAgents ?? 10
    const maxActionsPerAgent = options.maxActionsPerAgent ?? 3
    const sky = buildSkyContext(evaluatedAt)
    const agents = await this.loadAgents(maxAgents)

    return {
      sky,
      agents: agents.map(agent => {
        const triggers = detectTransitTriggers(agent.natalChart, sky)
        return {
          agentId: agent.agentId,
          name: agent.name,
          triggerCount: triggers.length,
          actions: mapAgentActions(agent, triggers, sky).slice(0, maxActionsPerAgent),
        }
      }),
    }
  }

  async dispatchPending(limit = Number(process.env.ASTRO_ACTION_DISPATCH_LIMIT || 25)): Promise<{
    posted: number
    failed: number
    errors: string[]
  }> {
    const rows = await actionEventsDelegate().findMany({
      where: {
        status: 'pending',
        attempts: { lt: Number(process.env.ASTRO_ACTION_MAX_ATTEMPTS || 5) },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    })

    let posted = 0
    let failed = 0
    const errors: string[] = []

    for (const row of rows) {
      const payload = {
        agentEmail: row.agentEmail,
        eventType: row.eventType,
        metadataPayload: row.metadataPayload,
      }
      const postResult = await this.webhookService.postFeedEvent(payload)

      if (postResult.success) {
        await actionEventsDelegate().update({
          where: { id: row.id },
          data: {
            status: 'posted',
            attempts: { increment: 1 },
            postedAt: new Date(),
            lastError: null,
          },
        })
        posted++
        continue
      }

      const lastError = postResult.error || postResult.responseBody || 'Unknown webhook failure'
      await actionEventsDelegate().update({
        where: { id: row.id },
        data: {
          status:
            row.attempts + 1 >= Number(process.env.ASTRO_ACTION_MAX_ATTEMPTS || 5)
              ? 'failed'
              : 'pending',
          attempts: { increment: 1 },
          lastError,
        },
      })
      failed++
      errors.push(`Event ${row.id} failed: ${lastError}`)
    }

    return { posted, failed, errors }
  }

  private async loadAgents(maxAgents: number): Promise<HistoricalAgentRecord[]> {
    return historicalAgentsDelegate().findMany({
      where: { isActive: true },
      select: {
        agentId: true,
        name: true,
        title: true,
        dominantElement: true,
        spiritScore: true,
        essenceScore: true,
        matterScore: true,
        substanceScore: true,
        specialty: true,
        wisdomDomains: true,
        natalChart: true,
      },
      orderBy: { agentId: 'asc' },
      take: maxAgents,
    })
  }

  private async queueAction(action: CandidateAgentAction, evaluatedAt: Date): Promise<boolean> {
    const existingRecent = await actionEventsDelegate().findFirst({
      where: {
        agentId: action.agentId,
        eventType: action.eventType,
        createdAt: {
          gte: cutoffForCooldown(evaluatedAt, action.cooldownHours),
        },
      },
      select: { id: true },
    })

    if (existingRecent) return false

    try {
      await actionEventsDelegate().create({
        data: {
          agentId: action.agentId,
          agentEmail: action.agentEmail,
          eventType: action.eventType,
          triggerType: action.triggerType,
          triggerSummary: action.triggerSummary,
          metadataPayload: {
            ...action.metadataPayload,
            idempotencyKey: idempotencyKeyFor(action, evaluatedAt),
          },
          score: action.score,
          idempotencyKey: idempotencyKeyFor(action, evaluatedAt),
          evaluatedAt,
        },
      })
      return true
    } catch (error: any) {
      if (error?.code === 'P2002') return false
      throw error
    }
  }
}

export const astrologicalActionEngine = new AstrologicalActionEngine()

export function toWebhookPayload(action: CandidateAgentAction) {
  return webhookPayloadFor(action)
}
