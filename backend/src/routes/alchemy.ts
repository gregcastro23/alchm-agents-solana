import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { body, validationResult } from 'express-validator'
import rateLimit from 'express-rate-limit'
import { alchmClient } from '../services/alchm-client.js'
import { thermodynamicsService } from '../services/thermodynamics.js'
import {
  validateTokenEquilibrium,
  calculateStabilizationAdjustment,
  generateAlchmForCurrentMoment,
} from '../services/alchemizer-service.js'
import { getCurrentPlanetaryPositions } from '../services/planetary-service.js'
import { asyncHandler, AppError } from '../middleware/error-handler.js'
import { authMiddleware } from '../middleware/auth.js'
import { cacheService } from '../services/cache.js'

const router: ExpressRouter = createRouter()

// Stricter rate limiting for expensive alchemy operations
const alchemyLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // 5 alchemy calculations per minute per IP
  message: {
    error: 'Alchemy calculation rate limit exceeded, please wait before making more requests',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

// Rate limiting for image generation (most expensive)
const imaginizeLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 2, // 2 image generations per 5 minutes per IP
  message: {
    error: 'Image generation rate limit exceeded, please wait before making more requests',
    retryAfter: '5 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

/**
 * POST /api/alchemy/calculate
 * Calculate alchemical properties for birth information
 */
router.post(
  '/calculate',
  alchemyLimiter,
  [
    body('birthInfo.year')
      .isInt({ min: 1900, max: 2100 })
      .withMessage('year must be between 1900 and 2100'),
    body('birthInfo.month')
      .isInt({ min: 1, max: 12 })
      .withMessage('month must be between 1 and 12'),
    body('birthInfo.day').isInt({ min: 1, max: 31 }).withMessage('day must be between 1 and 31'),
    body('birthInfo.hour').isInt({ min: 0, max: 23 }).withMessage('hour must be between 0 and 23'),
    body('birthInfo.minute')
      .isInt({ min: 0, max: 59 })
      .withMessage('minute must be between 0 and 59'),
    body('birthInfo.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('birthInfo.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('options.includeAspects').optional().isBoolean(),
    body('options.includeTransits').optional().isBoolean(),
    body('options.includePlanetary').optional().isBoolean(),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { birthInfo, options = {} } = req.body
    const startTime = Date.now()

    // Call the alchm-backend for core calculations
    const result = await alchmClient.calculateAlchemy({
      birthInfo,
      options,
    })

    if (!result.success) {
      throw new AppError(result.error || 'Alchemy calculation failed', 500)
    }

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: result.data,
      metadata: {
        computeTime,
        backendTime: result.data?.computeTime,
        birthInfo,
        options,
      },
    })
  })
)

/**
 * POST /api/alchemy/thermodynamics
 * Calculate thermodynamic properties from elemental values
 */
router.post(
  '/thermodynamics',
  [
    body('elementalValues.spirit').isNumeric().withMessage('spirit must be numeric'),
    body('elementalValues.essence').isNumeric().withMessage('essence must be numeric'),
    body('elementalValues.matter').isNumeric().withMessage('matter must be numeric'),
    body('elementalValues.substance').isNumeric().withMessage('substance must be numeric'),
    body('elementalValues.fire').isNumeric().withMessage('fire must be numeric'),
    body('elementalValues.water').isNumeric().withMessage('water must be numeric'),
    body('elementalValues.air').isNumeric().withMessage('air must be numeric'),
    body('elementalValues.earth').isNumeric().withMessage('earth must be numeric'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.thermodynamicsBackend) {
      throw new AppError('Thermodynamics backend is disabled', 503)
    }

    const { elementalValues } = req.body

    // Convert string values to numbers
    const values = {
      spirit: Number(elementalValues.spirit),
      essence: Number(elementalValues.essence),
      matter: Number(elementalValues.matter),
      substance: Number(elementalValues.substance),
      fire: Number(elementalValues.fire),
      water: Number(elementalValues.water),
      air: Number(elementalValues.air),
      earth: Number(elementalValues.earth),
    }

    const result = await thermodynamicsService.analyzeThermodynamics(values)

    res.json({
      success: true,
      data: result,
      metadata: {
        inputValues: values,
        conservationPassed: result.conservationCheck.passed,
      },
    })
  })
)

/**
 * POST /api/alchemy/batch-thermodynamics
 * Calculate thermodynamics for multiple input sets
 */
router.post(
  '/batch-thermodynamics',
  [
    body('inputSets')
      .isArray({ min: 1, max: 100 })
      .withMessage('inputSets must be array with 1-100 items'),
    body('inputSets.*.spirit').isNumeric().withMessage('spirit must be numeric'),
    body('inputSets.*.essence').isNumeric().withMessage('essence must be numeric'),
    body('inputSets.*.matter').isNumeric().withMessage('matter must be numeric'),
    body('inputSets.*.substance').isNumeric().withMessage('substance must be numeric'),
    body('inputSets.*.fire').isNumeric().withMessage('fire must be numeric'),
    body('inputSets.*.water').isNumeric().withMessage('water must be numeric'),
    body('inputSets.*.air').isNumeric().withMessage('air must be numeric'),
    body('inputSets.*.earth').isNumeric().withMessage('earth must be numeric'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.thermodynamicsBackend) {
      throw new AppError('Thermodynamics backend is disabled', 503)
    }

    const { inputSets } = req.body
    const startTime = Date.now()

    // Convert and validate all input sets
    const processedInputs = inputSets.map((set: any) => ({
      spirit: Number(set.spirit),
      essence: Number(set.essence),
      matter: Number(set.matter),
      substance: Number(set.substance),
      fire: Number(set.fire),
      water: Number(set.water),
      air: Number(set.air),
      earth: Number(set.earth),
    }))

    const results = await thermodynamicsService.batchAnalyze(processedInputs)
    const computeTime = Date.now() - startTime

    // Calculate batch statistics
    const conservationPassed = results.filter(r => r.conservationCheck.passed).length
    const avgHeat = results.reduce((sum, r) => sum + r.heat, 0) / results.length
    const avgEntropy = results.reduce((sum, r) => sum + r.entropy, 0) / results.length

    res.json({
      success: true,
      data: results,
      metadata: {
        totalInputs: inputSets.length,
        computeTime,
        statistics: {
          conservationPassRate: conservationPassed / results.length,
          averageHeat: avgHeat,
          averageEntropy: avgEntropy,
        },
      },
    })
  })
)

/**
 * POST /api/alchemy/imaginize
 * Generate alchemical image through backend
 */
router.post(
  '/imaginize',
  imaginizeLimiter,
  [
    body('birthInfo.year')
      .isInt({ min: 1900, max: 2100 })
      .withMessage('year must be between 1900 and 2100'),
    body('birthInfo.month')
      .isInt({ min: 1, max: 12 })
      .withMessage('month must be between 1 and 12'),
    body('birthInfo.day').isInt({ min: 1, max: 31 }).withMessage('day must be between 1 and 31'),
    body('birthInfo.hour').isInt({ min: 0, max: 23 }).withMessage('hour must be between 0 and 23'),
    body('birthInfo.minute')
      .isInt({ min: 0, max: 59 })
      .withMessage('minute must be between 0 and 59'),
    body('birthInfo.latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('birthInfo.longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('options.style').optional().isString(),
    body('options.format').optional().isIn(['png', 'jpg', 'webp']),
    body('options.quality').optional().isInt({ min: 1, max: 100 }),
    body('options.width').optional().isInt({ min: 100, max: 2048 }),
    body('options.height').optional().isInt({ min: 100, max: 2048 }),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { birthInfo, horoscope, options = {} } = req.body

    const result = await alchmClient.imaginize({
      birthInfo,
      horoscope,
      options,
    })

    if (!result.success) {
      throw new AppError(result.error || 'Image generation failed', 500)
    }

    res.json({
      success: true,
      data: {
        imageUrl: result.imageUrl,
        metadata: result.metadata,
      },
    })
  })
)

/**
 * GET /api/alchemy/status
 * Get alchemy service status
 */
router.get(
  '/status',
  asyncHandler(async (req: Request, res: Response) => {
    const alchmHealth = await alchmClient.healthCheck()
    const alchmStatus = alchmClient.getStatus()
    const cacheStats = cacheService.getStats()

    res.json({
      success: true,
      data: {
        backend: {
          healthy: alchmHealth.healthy,
          responseTime: alchmHealth.responseTime,
          error: alchmHealth.error,
        },
        circuitBreaker: alchmStatus,
        cache: cacheStats,
        featureFlags: {
          thermodynamicsBackend: req.featureFlags.thermodynamicsBackend,
        },
      },
    })
  })
)

/**
 * POST /api/alchemy/token-equilibrium
 * Validate token equilibrium according to traditional elemental derivations
 */
router.post(
  '/token-equilibrium',
  authMiddleware,
  [
    body('tokens.spirit').isFloat({ min: 0, max: 1 }).withMessage('spirit must be between 0 and 1'),
    body('tokens.essence')
      .isFloat({ min: 0, max: 1 })
      .withMessage('essence must be between 0 and 1'),
    body('tokens.matter').isFloat({ min: 0, max: 1 }).withMessage('matter must be between 0 and 1'),
    body('tokens.substance')
      .isFloat({ min: 0, max: 1 })
      .withMessage('substance must be between 0 and 1'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { tokens } = req.body

    const equilibrium = validateTokenEquilibrium({
      spirit: Number(tokens.spirit),
      essence: Number(tokens.essence),
      matter: Number(tokens.matter),
      substance: Number(tokens.substance),
    })

    res.json({
      success: true,
      data: equilibrium,
      metadata: {
        inputTokens: tokens,
        overallHealth: equilibrium.overallHealth,
        goldenRatioDeviation: equilibrium.goldenRatio,
        elementalHarmony: equilibrium.elementalHarmony,
        planetaryDignity: equilibrium.planetaryDignity,
      },
    })
  })
)

/**
 * POST /api/alchemy/token-stabilization
 * Calculate stabilization adjustments for imbalanced tokens
 */
router.post(
  '/token-stabilization',
  authMiddleware,
  [
    body('tokens.spirit').isNumeric().withMessage('spirit must be numeric'),
    body('tokens.essence').isNumeric().withMessage('essence must be numeric'),
    body('tokens.matter').isNumeric().withMessage('matter must be numeric'),
    body('tokens.substance').isNumeric().withMessage('substance must be numeric'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { tokens } = req.body

    const currentTokens = {
      spirit: Number(tokens.spirit),
      essence: Number(tokens.essence),
      matter: Number(tokens.matter),
      substance: Number(tokens.substance),
    }

    const adjustments = calculateStabilizationAdjustment(currentTokens)

    res.json({
      success: true,
      data: {
        adjustments,
        stabilizedTokens: {
          spirit: currentTokens.spirit + (adjustments.spirit || 0),
          essence: currentTokens.essence + (adjustments.essence || 0),
          matter: currentTokens.matter + (adjustments.matter || 0),
          substance: currentTokens.substance + (adjustments.substance || 0),
        },
      },
      metadata: {
        originalTokens: currentTokens,
        hasAdjustments: Object.keys(adjustments).length > 0,
      },
    })
  })
)

/**
 * POST /api/alchemy/current-planetary-alchemy
 * Get current planetary positions with alchemical calculations
 */
router.post(
  '/current-planetary-alchemy',
  [
    body('timestamp').optional().isISO8601().withMessage('timestamp must be valid ISO8601 string'),
    body('location.lat')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { timestamp, location } = req.body
    const requestTime = timestamp ? new Date(timestamp) : Date.now()

    const startTime = Date.now()

    // Get planetary positions
    const positions = await getCurrentPlanetaryPositions(new Date(requestTime))

    // Get alchemical calculations
    const alchm = await generateAlchmForCurrentMoment()

    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: {
        planetaryPositions: positions,
        alchemicalQuantities: alchm,
        timestamp: new Date(requestTime).toISOString(),
      },
      metadata: {
        computeTime,
        requestTime: new Date(requestTime).toISOString(),
        location: location || null,
        hasAlchemicalData: !!alchm,
      },
    })
  })
)

/**
 * POST /api/alchemy/emergency-assessment
 * Assess emergency stabilization needs for critical astrological events
 */
router.post(
  '/emergency-assessment',
  authMiddleware,
  [
    body('tokens.spirit').isNumeric().withMessage('spirit must be numeric'),
    body('tokens.essence').isNumeric().withMessage('essence must be numeric'),
    body('tokens.matter').isNumeric().withMessage('matter must be numeric'),
    body('tokens.substance').isNumeric().withMessage('substance must be numeric'),
    body('astrologicalEvent.type')
      .isIn([
        'eclipse',
        'retrograde',
        'conjunction',
        'opposition',
        'square',
        'trine',
        'transit',
        'lunar-phase',
        'solar-return',
        'aspect',
      ])
      .withMessage('event type must be a valid astrological event'),
    body('astrologicalEvent.severity')
      .isIn(['low', 'medium', 'high', 'critical'])
      .withMessage('severity must be low, medium, high, or critical'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { tokens, astrologicalEvent } = req.body

    // Emergency protocols based on traditional astrological crisis management
    const emergencyProtocols = [
      {
        id: 'eclipse_essence_stabilization',
        triggerCondition: () =>
          astrologicalEvent.type === 'eclipse' &&
          astrologicalEvent.severity === 'critical' &&
          tokens.essence < 0.7,
        stabilizationAction: () => {
          const essenceAdjustment = (1.0 - tokens.essence) * 0.6
          return {
            essence: essenceAdjustment,
            matter: essenceAdjustment * 0.4,
            priority: 'high',
            reason: 'Eclipse essence stabilization protects lunar emotional foundations',
          }
        },
      },
      {
        id: 'grand_cross_elemental_harmonization',
        triggerCondition: () =>
          astrologicalEvent.type === 'grand_cross' &&
          Object.values(tokens).some((value: number) => value < 0.3),
        stabilizationAction: () => {
          const adjustments: any = {
            priority: 'high',
            reason: 'Grand cross creates elemental tension',
          }
          if (tokens.spirit < 0.5) adjustments.spirit = 0.3
          if (tokens.essence < 0.7) adjustments.essence = 0.4
          if (tokens.matter < 0.6) adjustments.matter = 0.25
          if (tokens.substance < 0.4) adjustments.substance = 0.2
          return adjustments
        },
      },
      {
        id: 'retrograde_mercury_communication_stress',
        triggerCondition: () =>
          astrologicalEvent.type === 'retrograde' &&
          astrologicalEvent.planet === 'Mercury' &&
          tokens.substance < 0.5,
        stabilizationAction: () => ({
          substance: (1.0 - tokens.substance) * 0.5,
          spirit: (1.0 - tokens.spirit) * 0.3,
          priority: 'medium',
          reason: 'Mercury retrograde communication stress affects mercurial substance',
        }),
      },
    ]

    // Find applicable emergency protocols
    const applicableProtocols = emergencyProtocols.filter(protocol => protocol.triggerCondition())

    let totalAdjustments: any = { priority: 'low', reason: 'No emergency stabilization needed' }
    const triggeredProtocols = []

    for (const protocol of applicableProtocols) {
      const adjustment = protocol.stabilizationAction()
      triggeredProtocols.push({
        id: protocol.id,
        priority: adjustment.priority,
        reason: adjustment.reason,
      })

      // Merge adjustments
      for (const [key, value] of Object.entries(adjustment)) {
        if (key !== 'priority' && key !== 'reason' && typeof value === 'number') {
          totalAdjustments[key] = (totalAdjustments[key] || 0) + value
        }
      }

      // Update priority if higher
      if (
        adjustment.priority === 'critical' ||
        (adjustment.priority === 'high' && totalAdjustments.priority !== 'critical')
      ) {
        totalAdjustments.priority = adjustment.priority
      } else if (adjustment.priority === 'medium' && totalAdjustments.priority === 'low') {
        totalAdjustments.priority = adjustment.priority
      }
    }

    // Clean up adjustments object
    const { priority, reason, ...adjustments } = totalAdjustments

    res.json({
      success: true,
      data: {
        emergencyDetected: applicableProtocols.length > 0,
        triggeredProtocols,
        recommendedAdjustments: adjustments,
        priority,
        reason,
        assessment: {
          eventType: astrologicalEvent.type,
          severity: astrologicalEvent.severity,
          tokenHealth: validateTokenEquilibrium(tokens),
        },
      },
      metadata: {
        inputTokens: tokens,
        astrologicalEvent,
        protocolsChecked: emergencyProtocols.length,
        protocolsTriggered: applicableProtocols.length,
      },
    })
  })
)

export default router
