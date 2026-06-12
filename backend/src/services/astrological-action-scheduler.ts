import cron, { type ScheduledTask } from 'node-cron'
import { logger } from '../utils/logger.js'
import {
  astrologicalActionEngine,
  type AstrologicalActionEngine,
} from './astrological-action-engine.js'

export class AstrologicalActionScheduler {
  private task: ScheduledTask | null = null
  private running = false

  constructor(
    private readonly engine: AstrologicalActionEngine = astrologicalActionEngine,
    private readonly schedule = process.env.ASTRO_ACTION_CRON || '*/15 * * * *'
  ) {}

  start(): void {
    if (this.task) {
      logger.warn('Astrological action scheduler is already active')
      return
    }

    if (!cron.validate(this.schedule)) {
      throw new Error(`Invalid ASTRO_ACTION_CRON expression: ${this.schedule}`)
    }

    this.task = cron.schedule(this.schedule, () => {
      this.runOnce().catch(error => {
        logger.error('Astrological action scheduled run failed', {
          error: error instanceof Error ? error.message : String(error),
        })
      })
    })

    logger.info('Astrological action scheduler started', { schedule: this.schedule })
  }

  stop(): void {
    this.task?.stop()
    this.task = null
    logger.info('Astrological action scheduler stopped')
  }

  isActive(): boolean {
    return Boolean(this.task)
  }

  async runOnce(): Promise<void> {
    if (this.running) {
      logger.warn('Skipping astrological action run because a previous run is still active')
      return
    }

    this.running = true
    try {
      await this.engine.evaluate()
    } finally {
      this.running = false
    }
  }
}

export const astrologicalActionScheduler = new AstrologicalActionScheduler()
