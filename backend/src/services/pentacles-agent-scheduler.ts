import crypto from 'crypto'
import { logger } from '../utils/logger.js'
import { cacheService } from './cache.js'
import {
  pentaclesAgentService,
  type PentaclesAgentRunOptions,
  type PentaclesAgentRunResult,
  type PentaclesAgentService,
} from './pentacles-agent-service.js'

export interface PentaclesAgentSchedulerStatus {
  enabled: boolean
  active: boolean
  paused: boolean
  dryRun: boolean
  intervalMs: number
  writable: boolean
  distributedLock: boolean
  lastRun: PentaclesAgentRunResult | null
}

const PAUSE_KEY = 'pentacles:controller:paused'
const DRY_RUN_KEY = 'pentacles:controller:dry-run'
const LEASE_KEY = 'pentacles:controller:lease'

export class PentaclesAgentScheduler {
  private timer: NodeJS.Timeout | null = null
  private readonly intervalMs: number
  private readonly enabled: boolean

  constructor(private readonly service: PentaclesAgentService = pentaclesAgentService) {
    this.intervalMs = Math.max(1_000, Number(process.env.PENTACLES_AGENT_INTERVAL_MS || 10_000))
    this.enabled = process.env.PENTACLES_AGENT_CONTROLLER_ENABLED === 'true'
  }

  start(): void {
    if (this.timer || !this.enabled) return
    if (process.env.NODE_ENV === 'production' && !cacheService.isDistributed()) {
      throw new Error('Pentacles agent controller requires Redis locking in production')
    }
    this.timer = setInterval(() => {
      void this.runOnce().catch(error => {
        logger.error('Pentacles agent controller tick failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    }, this.intervalMs)
    void this.runOnce()
    logger.info('Pentacles agent controller started', { intervalMs: this.intervalMs })
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    logger.info('Pentacles agent controller stopped')
  }

  async setPaused(paused: boolean): Promise<void> {
    await cacheService.set(PAUSE_KEY, paused, 365 * 24 * 60 * 60)
  }

  async setDryRun(dryRun: boolean): Promise<void> {
    await cacheService.set(DRY_RUN_KEY, dryRun, 365 * 24 * 60 * 60)
  }

  async runOnce(options: PentaclesAgentRunOptions = {}): Promise<PentaclesAgentRunResult | null> {
    if (process.env.NODE_ENV === 'production' && !cacheService.isDistributed()) {
      throw new Error('Pentacles agent controller requires Redis locking in production')
    }
    const paused = await cacheService.get<boolean>(PAUSE_KEY)
    if (paused) return null

    const leaseOwner = crypto.randomUUID()
    const leaseTtlMs = Math.max(30_000, this.intervalMs * 3)
    const acquired = await cacheService.acquireLock(LEASE_KEY, leaseOwner, leaseTtlMs)
    if (!acquired) return null

    const heartbeat = setInterval(
      () => {
        void cacheService.renewLock(LEASE_KEY, leaseOwner, leaseTtlMs).then(renewed => {
          if (!renewed) logger.warn('Pentacles agent controller lease was lost during a sweep')
        })
      },
      Math.max(1_000, Math.floor(leaseTtlMs / 3))
    )

    try {
      const storedDryRun = await cacheService.get<boolean>(DRY_RUN_KEY)
      const dryRun =
        options.dryRun ??
        storedDryRun ??
        (process.env.PENTACLES_AGENT_DRY_RUN !== 'false' || !this.service.isWritable())
      return await this.service.evaluate({ ...options, dryRun })
    } finally {
      clearInterval(heartbeat)
      await cacheService.releaseLock(LEASE_KEY, leaseOwner)
    }
  }

  async status(): Promise<PentaclesAgentSchedulerStatus> {
    const [paused, storedDryRun, lastRun] = await Promise.all([
      cacheService.get<boolean>(PAUSE_KEY),
      cacheService.get<boolean>(DRY_RUN_KEY),
      this.service.lastRun(),
    ])
    return {
      enabled: this.enabled,
      active: Boolean(this.timer),
      paused: paused ?? false,
      dryRun:
        storedDryRun ??
        (process.env.PENTACLES_AGENT_DRY_RUN !== 'false' || !this.service.isWritable()),
      intervalMs: this.intervalMs,
      writable: this.service.isWritable(),
      distributedLock: cacheService.isDistributed(),
      lastRun,
    }
  }
}

export const pentaclesAgentScheduler = new PentaclesAgentScheduler()
