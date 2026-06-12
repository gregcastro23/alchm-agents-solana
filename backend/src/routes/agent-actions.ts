import { Router as createRouter, type NextFunction, type Request, type Response } from 'express'
import { astrologicalActionEngine } from '../services/astrological-action-engine.js'
import { astrologicalActionScheduler } from '../services/astrological-action-scheduler.js'
import { asyncHandler, AppError } from '../middleware/error-handler.js'

const router = createRouter()

function requireInternalSecret(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) {
    return next(new AppError('INTERNAL_API_SECRET is not configured', 500))
  }

  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (token !== expected) {
    return next(new AppError('Unauthorized', 401))
  }

  next()
}

router.use(requireInternalSecret)

router.get('/status', (_req: Request, res: Response) => {
  res.json({
    success: true,
    scheduler: {
      enabled: process.env.ASTRO_ACTION_ENGINE_ENABLED === 'true',
      active: astrologicalActionScheduler.isActive(),
      cron: process.env.ASTRO_ACTION_CRON || '*/15 * * * *',
      dryRun: process.env.ASTRO_ACTION_DRY_RUN === 'true',
    },
  })
})

router.post(
  '/evaluate',
  asyncHandler(async (req: Request, res: Response) => {
    const evaluatedAt = req.body?.evaluatedAt ? new Date(req.body.evaluatedAt) : undefined
    if (evaluatedAt && isNaN(evaluatedAt.getTime())) {
      throw new AppError('evaluatedAt must be a valid ISO8601 date', 400)
    }

    const result = await astrologicalActionEngine.evaluate({
      evaluatedAt,
      dryRun: req.body?.dryRun === undefined ? undefined : Boolean(req.body.dryRun),
      maxAgents: req.body?.maxAgents ? Number(req.body.maxAgents) : undefined,
      maxActionsPerAgent: req.body?.maxActionsPerAgent
        ? Number(req.body.maxActionsPerAgent)
        : undefined,
      dispatch: req.body?.dispatch !== false,
    })

    res.json({ success: true, result })
  })
)

router.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const evaluatedAt = req.body?.evaluatedAt ? new Date(req.body.evaluatedAt) : undefined
    if (evaluatedAt && isNaN(evaluatedAt.getTime())) {
      throw new AppError('evaluatedAt must be a valid ISO8601 date', 400)
    }

    const result = await astrologicalActionEngine.preview({
      evaluatedAt,
      maxAgents: req.body?.maxAgents ? Number(req.body.maxAgents) : undefined,
      maxActionsPerAgent: req.body?.maxActionsPerAgent
        ? Number(req.body.maxActionsPerAgent)
        : undefined,
    })

    res.json({ success: true, result })
  })
)

router.post(
  '/dispatch',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await astrologicalActionEngine.dispatchPending(
      req.body?.limit ? Number(req.body.limit) : undefined
    )

    res.json({ success: true, result })
  })
)

export default router
