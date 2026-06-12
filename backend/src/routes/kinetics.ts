import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { body, validationResult } from 'express-validator'
import { asyncHandler, AppError } from '../middleware/error-handler.js'
import { cacheService } from '../services/cache.js'
import {
  calculateEnhancedKinetics,
  calculateGroupDynamics,
  calculateTokenKinetics,
} from '../services/kinetics-service.js'
import {
  calculateAlchemicalKinetics,
  calculateKineticsTimeline,
  getCachedKinetics,
  type AlchemicalState,
} from '../services/alchemical-kinetics-service.js'

const router: ExpressRouter = createRouter()

/**
 * POST /api/kinetics/enhanced
 * Enhanced kinetics calculation with backend optimizations
 * This mirrors the existing Next.js API but with improved caching and processing
 */
router.post(
  '/enhanced',
  [
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('options.includeAgentOptimization').optional().isBoolean(),
    body('options.includePowerPrediction').optional().isBoolean(),
    body('options.includeResonanceMap').optional().isBoolean(),
    body('options.agentIds').optional().isArray(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.kineticsBackend) {
      throw new AppError('Kinetics backend is disabled', 503)
    }

    const { location, options = {} } = req.body
    const startTime = Date.now()

    // Check cache first
    const cacheKey = `kinetics:${location.lat}:${location.lon}:${JSON.stringify(options)}`
    const cached = await cacheService.get(cacheKey)

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        computeTimeMs: 0,
        cacheHit: true,
        metadata: {
          location,
          options,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Calculate real kinetics data
    const data = await calculateEnhancedKinetics(location, options)

    // Cache the result for 2 minutes
    await cacheService.set(cacheKey, data, 120)

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data,
      computeTimeMs: computeTime,
      cacheHit: false,
      metadata: {
        location,
        options,
        timestamp: new Date().toISOString(),
      },
    })
  })
)

/**
 * POST /api/kinetics/group
 * Group dynamics calculation for multiple agents
 */
router.post(
  '/group',
  [
    body('agentIds')
      .isArray({ min: 2, max: 10 })
      .withMessage('agentIds must be array with 2-10 items'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.kineticsBackend) {
      throw new AppError('Kinetics backend is disabled', 503)
    }

    const { agentIds, location } = req.body
    const startTime = Date.now()

    // Check cache first
    const cacheKey = `group:${agentIds.sort().join(',')}:${location.lat}:${location.lon}`
    const cached = await cacheService.get(cacheKey)

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        computeTimeMs: 0,
        cacheHit: true,
        metadata: {
          agentCount: agentIds.length,
          location,
          timestamp: new Date().toISOString(),
        },
      })
    }

    // Calculate real group dynamics
    const data = calculateGroupDynamics(agentIds, location)

    // Cache for 2 minutes
    await cacheService.set(cacheKey, data, 120)

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data,
      computeTimeMs: computeTime,
      metadata: {
        agentCount: agentIds.length,
        location,
        timestamp: new Date().toISOString(),
      },
    })
  })
)

/**
 * POST /api/kinetics/token
 * Token-specific kinetics for rate and rarity calculations
 */
router.post(
  '/token',
  [
    body('baseTokenRate').isNumeric().withMessage('baseTokenRate must be numeric'),
    body('baseNFTRarity').isNumeric().withMessage('baseNFTRarity must be numeric'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.kineticsBackend) {
      throw new AppError('Kinetics backend is disabled', 503)
    }

    const { baseTokenRate, baseNFTRarity, location } = req.body
    const startTime = Date.now()

    // Check cache first
    const cacheKey = `token:${baseTokenRate}:${baseNFTRarity}:${location.lat}:${location.lon}`
    const cached = await cacheService.get(cacheKey)

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        computeTimeMs: 0,
        cacheHit: true,
        metadata: {
          baseInputs: { baseTokenRate, baseNFTRarity },
          location,
          timestamp: new Date().toISOString(),
          powerLevel: `${Math.round(cached.powerLevel * 100)}%`,
        },
      })
    }

    // Calculate real token kinetics
    const data = calculateTokenKinetics(Number(baseTokenRate), Number(baseNFTRarity), location)

    // Cache for 1 minute (token rates update more frequently)
    await cacheService.set(cacheKey, data, 60)

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data,
      computeTimeMs: computeTime,
      metadata: {
        baseInputs: { baseTokenRate, baseNFTRarity },
        location,
        timestamp: new Date().toISOString(),
        powerLevel: `${Math.round((data?.powerLevel ?? 0) * 100)}%`,
      },
    })
  })
)

/**
 * POST /api/kinetics/alchemical
 * Calculate complete alchemical kinetics for a state
 * Implements: Velocity, Momentum, Force, Flow States, Resonance, Temporal Pressure
 */
router.post(
  '/alchemical',
  [
    body('current.spirit').isNumeric().withMessage('current.spirit must be numeric'),
    body('current.essence').isNumeric().withMessage('current.essence must be numeric'),
    body('current.matter').isNumeric().withMessage('current.matter must be numeric'),
    body('current.substance').isNumeric().withMessage('current.substance must be numeric'),
    body('current.elementals.Fire')
      .isNumeric()
      .withMessage('current.elementals.Fire must be numeric'),
    body('current.elementals.Water')
      .isNumeric()
      .withMessage('current.elementals.Water must be numeric'),
    body('current.elementals.Air')
      .isNumeric()
      .withMessage('current.elementals.Air must be numeric'),
    body('current.elementals.Earth')
      .isNumeric()
      .withMessage('current.elementals.Earth must be numeric'),
    body('current.timestamp').isISO8601().withMessage('current.timestamp must be valid ISO8601'),
    body('previous').optional().isObject(),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.kineticsBackend) {
      throw new AppError('Kinetics backend is disabled', 503)
    }

    const { current, previous, location } = req.body
    const startTime = Date.now()

    // Calculate alchemical kinetics
    const kinetics = await getCachedKinetics(
      current as AlchemicalState,
      previous as AlchemicalState | null,
      location
    )

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: kinetics,
      computeTimeMs: computeTime,
      metadata: {
        location,
        timestamp: current.timestamp,
        hasPreviousState: !!previous,
        planetaryHour: kinetics.metadata.planetaryHour,
        forceType: kinetics.force.type,
        flowType: kinetics.flowState.type,
        resonanceQuality: kinetics.resonance.quality,
        temporalRhythm: kinetics.temporalPressure.rhythm,
      },
    })
  })
)

/**
 * POST /api/kinetics/alchemical-timeline
 * Calculate alchemical kinetics timeline for a date range
 */
router.post(
  '/alchemical-timeline',
  [
    body('startDate').isISO8601().withMessage('startDate must be valid ISO8601'),
    body('endDate').isISO8601().withMessage('endDate must be valid ISO8601'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('intervalHours')
      .optional()
      .isInt({ min: 1, max: 24 })
      .withMessage('intervalHours must be between 1 and 24'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.kineticsBackend) {
      throw new AppError('Kinetics backend is disabled', 503)
    }

    const { startDate, endDate, location, intervalHours = 1 } = req.body
    const startTime = Date.now()

    // Validate date range
    const start = new Date(startDate)
    const end = new Date(endDate)
    const durationHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60)

    if (durationHours > 168) {
      // Max 7 days
      throw new AppError('Date range cannot exceed 7 days (168 hours)', 400)
    }

    if (durationHours <= 0) {
      throw new AppError('endDate must be after startDate', 400)
    }

    // Check cache first
    const cacheKey = `kinetics-timeline:${startDate}:${endDate}:${location.lat}:${location.lon}:${intervalHours}`
    const cached = await cacheService.get(cacheKey)

    if (cached) {
      return res.json({
        success: true,
        data: cached,
        computeTimeMs: 0,
        cacheHit: true,
        metadata: {
          dataPoints: cached.length,
          startDate,
          endDate,
          intervalHours,
          location,
        },
      })
    }

    // Calculate timeline
    const timeline = await calculateKineticsTimeline(start, end, location, intervalHours)

    // Cache for 5 minutes
    await cacheService.set(cacheKey, timeline, 300)

    const computeTime = Date.now() - startTime

    // Calculate timeline statistics
    const avgVelocity = timeline.reduce((sum, k) => sum + k.velocity.magnitude, 0) / timeline.length
    const avgMomentum = timeline.reduce((sum, k) => sum + k.momentum.magnitude, 0) / timeline.length
    const avgForce = timeline.reduce((sum, k) => sum + k.force.magnitude, 0) / timeline.length

    // Count flow state types
    const flowStates = timeline.reduce(
      (acc, k) => {
        acc[k.flowState.type] = (acc[k.flowState.type] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    res.json({
      success: true,
      data: timeline,
      computeTimeMs: computeTime,
      cacheHit: false,
      metadata: {
        dataPoints: timeline.length,
        startDate,
        endDate,
        intervalHours,
        location,
        statistics: {
          averageVelocity: avgVelocity,
          averageMomentum: avgMomentum,
          averageForce: avgForce,
          flowStateDistribution: flowStates,
        },
      },
    })
  })
)

/**
 * GET /api/kinetics/status
 * Get kinetics system status
 */
router.get('/status', (req: Request, res: Response) => {
  const status = {
    system: 'online',
    version: '3.0.0',
    features: {
      enhanced: req.featureFlags.kineticsBackend,
      groupDynamics: req.featureFlags.kineticsBackend,
      tokenMetrics: req.featureFlags.kineticsBackend,
      alchemicalKinetics: req.featureFlags.kineticsBackend,
    },
    capabilities: [
      'Enhanced kinetics with agent optimization',
      'Group harmony calculations',
      'Token rate and rarity dynamics',
      'Power prediction and resonance mapping',
      'Alchemical kinetics: Velocity, Momentum, Force',
      'Flow states: Expansion (Jupiter) and Contraction (Saturn)',
      'Resonance fields: Harmonic and Discord calculations',
      'Temporal pressure: Solar and Lunar rhythms',
    ],
  }

  res.json({
    success: true,
    data: status,
    timestamp: new Date().toISOString(),
  })
})

export default router
