import express from 'express'
import dotenv from 'dotenv'
import { createServer } from 'node:http'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import pentaclesAgentRoutes from './routes/pentacles-agents.js'
import { cacheService } from './services/cache.js'
import { pentaclesAgentScheduler } from './services/pentacles-agent-scheduler.js'
import { logger } from './utils/logger.js'

dotenv.config()

const port = Number(process.env.PORT || 8000)
const host = process.env.HOST || '0.0.0.0'
const app = express()

app.use(express.json({ limit: '256kb' }))
app.get('/health', async (_req, res, next) => {
  try {
    const scheduler = await pentaclesAgentScheduler.status()
    res.json({
      status: scheduler.active && scheduler.distributedLock ? 'healthy' : 'degraded',
      scheduler,
    })
  } catch (error) {
    next(error)
  }
})
app.use('/api/pentacles-agents', pentaclesAgentRoutes)
app.use(notFoundHandler)
app.use(errorHandler)

async function start(): Promise<void> {
  await cacheService.connect()
  pentaclesAgentScheduler.start()
  const server = createServer(app)
  server.listen(port, host, () => {
    logger.info('Pentacles controller listening', { host, port })
  })

  let shuttingDown = false
  const shutdown = (signal: string) => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info('Pentacles controller stopping', { signal })
    pentaclesAgentScheduler.stop()
    server.close(() => {
      cacheService.disconnect()
      process.exit(0)
    })
    setTimeout(() => process.exit(1), 10_000).unref()
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

start().catch(error => {
  logger.error('Pentacles controller failed to start', {
    error: error instanceof Error ? error.message : String(error),
  })
  cacheService.disconnect()
  process.exit(1)
})
