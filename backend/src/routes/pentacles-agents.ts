import { Router as createRouter, type NextFunction, type Request, type Response } from 'express'
import { AppError, asyncHandler } from '../middleware/error-handler.js'
import { pentaclesAgentService } from '../services/pentacles-agent-service.js'
import { pentaclesAgentScheduler } from '../services/pentacles-agent-scheduler.js'

const router = createRouter()

function requireInternalSecret(req: Request, _res: Response, next: NextFunction) {
  const expected = process.env.INTERNAL_API_SECRET
  if (!expected) return next(new AppError('INTERNAL_API_SECRET is not configured', 500))
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (supplied !== expected) return next(new AppError('Unauthorized', 401))
  next()
}

router.use(requireInternalSecret)

router.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ success: true, scheduler: await pentaclesAgentScheduler.status() })
  })
)

router.post(
  '/evaluate',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pentaclesAgentScheduler.runOnce({
      dryRun: req.body?.dryRun === undefined ? undefined : Boolean(req.body.dryRun),
      maxAgents: req.body?.maxAgents ? Number(req.body.maxAgents) : undefined,
      maxActions: req.body?.maxActions ? Number(req.body.maxActions) : undefined,
    })
    res.json({ success: true, acquired: Boolean(result), result })
  })
)

router.post(
  '/preview',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pentaclesAgentService.evaluate({
      dryRun: true,
      maxAgents: req.body?.maxAgents ? Number(req.body.maxAgents) : undefined,
      maxActions: req.body?.maxActions ? Number(req.body.maxActions) : undefined,
    })
    res.json({ success: true, result })
  })
)

router.post(
  '/control',
  asyncHandler(async (req: Request, res: Response) => {
    if (typeof req.body?.paused === 'boolean') {
      await pentaclesAgentScheduler.setPaused(req.body.paused)
    }
    if (typeof req.body?.dryRun === 'boolean') {
      await pentaclesAgentScheduler.setDryRun(req.body.dryRun)
    }
    res.json({ success: true, scheduler: await pentaclesAgentScheduler.status() })
  })
)

router.post(
  '/word',
  asyncHandler(async (req: Request, res: Response) => {
    if (!Array.isArray(req.body?.candidates)) {
      throw new AppError('candidates[] from Pentacles is required', 400)
    }
    const result = await pentaclesAgentService.castLegalWord({
      agentKey: String(req.body?.agentKey || ''),
      opponent: req.body?.opponent,
      word: String(req.body?.word || ''),
      candidates: req.body.candidates,
      dryRun: req.body?.dryRun === undefined ? undefined : Boolean(req.body.dryRun),
    })
    res.json({ success: true, result })
  })
)

router.post(
  '/jing',
  asyncHandler(async (req: Request, res: Response) => {
    const result = await pentaclesAgentService.castJing({
      agentKey: String(req.body?.agentKey || ''),
      move: String(req.body?.move || ''),
      targetIdentity: req.body?.targetIdentity ? String(req.body.targetIdentity) : null,
      targetAgent: req.body?.targetAgent ?? null,
      dryRun: req.body?.dryRun === undefined ? undefined : Boolean(req.body.dryRun),
    })
    res.json({ success: true, result })
  })
)

export default router
