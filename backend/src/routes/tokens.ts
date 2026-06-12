import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { body, validationResult } from 'express-validator'
import { tokenCalculatorService } from '../services/token-calculator.js'
import { asyncHandler, AppError } from '../middleware/error-handler.js'

const router: ExpressRouter = createRouter()

/**
 * POST /api/tokens/calculate
 * Calculate token rates with planetary and temporal influences
 */
router.post(
  '/calculate',
  [
    body('tokens.Spirit').isNumeric().withMessage('Spirit token rate must be numeric'),
    body('tokens.Essence').isNumeric().withMessage('Essence token rate must be numeric'),
    body('tokens.Matter').isNumeric().withMessage('Matter token rate must be numeric'),
    body('tokens.Substance').isNumeric().withMessage('Substance token rate must be numeric'),
    body('planetaryHour').optional().isString().withMessage('planetaryHour must be string'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('timestamp').optional().isISO8601().withMessage('timestamp must be valid ISO8601 string'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.tokenCalculationsBackend) {
      throw new AppError('Token calculations backend is disabled', 503)
    }

    const { tokens, planetaryHour, location, timestamp } = req.body

    // Convert string values to numbers
    const tokenRates = {
      Spirit: Number(tokens.Spirit),
      Essence: Number(tokens.Essence),
      Matter: Number(tokens.Matter),
      Substance: Number(tokens.Substance),
    }

    const request = {
      tokens: tokenRates,
      planetaryHour,
      location,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    }

    const result = await tokenCalculatorService.calculateTokens(request)

    res.json({
      success: true,
      data: result,
      metadata: {
        inputTokens: tokenRates,
        location,
        timestamp: (request.timestamp || new Date()).toISOString(),
      },
    })
  })
)

/**
 * POST /api/tokens/historical
 * Get historical token data for analysis
 */
router.post(
  '/historical',
  [
    body('startDate').isISO8601().withMessage('startDate must be valid ISO8601 string'),
    body('endDate').isISO8601().withMessage('endDate must be valid ISO8601 string'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('interval')
      .optional()
      .isInt({ min: 1, max: 1440 })
      .withMessage('interval must be between 1 and 1440 minutes'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.tokenCalculationsBackend) {
      throw new AppError('Token calculations backend is disabled', 503)
    }

    const { startDate, endDate, location, interval = 60 } = req.body

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate date range
    if (end <= start) {
      throw new AppError('endDate must be after startDate', 400)
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 7) {
      throw new AppError('Date range cannot exceed 7 days for historical data', 400)
    }

    const startTime = Date.now()
    const historicalData = await tokenCalculatorService.getHistoricalData(
      start,
      end,
      location,
      interval
    )
    const computeTime = Date.now() - startTime

    // Calculate statistics
    const totalPoints = historicalData.length
    const tokenStats = {
      Spirit: { min: Infinity, max: -Infinity, avg: 0 },
      Essence: { min: Infinity, max: -Infinity, avg: 0 },
      Matter: { min: Infinity, max: -Infinity, avg: 0 },
      Substance: { min: Infinity, max: -Infinity, avg: 0 },
    }

    // Calculate min, max, and sum for averages
    historicalData.forEach(point => {
      Object.keys(tokenStats).forEach(token => {
        const value = point.rates[token as keyof typeof point.rates]
        tokenStats[token as keyof typeof tokenStats].min = Math.min(
          tokenStats[token as keyof typeof tokenStats].min,
          value
        )
        tokenStats[token as keyof typeof tokenStats].max = Math.max(
          tokenStats[token as keyof typeof tokenStats].max,
          value
        )
        tokenStats[token as keyof typeof tokenStats].avg += value
      })
    })

    // Calculate averages
    Object.keys(tokenStats).forEach(token => {
      tokenStats[token as keyof typeof tokenStats].avg /= totalPoints
    })

    res.json({
      success: true,
      data: historicalData,
      metadata: {
        computeTime,
        totalPoints,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        interval,
        location,
        statistics: tokenStats,
      },
    })
  })
)

/**
 * POST /api/tokens/projections
 * Get token rate projections
 */
router.post(
  '/projections',
  [
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('timestamp').optional().isISO8601().withMessage('timestamp must be valid ISO8601 string'),
    body('timeframe')
      .optional()
      .isIn(['nearTerm', 'seasonal', 'both'])
      .withMessage('timeframe must be nearTerm, seasonal, or both'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.tokenCalculationsBackend) {
      throw new AppError('Token calculations backend is disabled', 503)
    }

    const { location, timestamp, timeframe = 'both' } = req.body

    const baseTokens = {
      Spirit: 1.0,
      Essence: 0.8,
      Matter: 0.6,
      Substance: 0.4,
    }

    const request = {
      tokens: baseTokens,
      location,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    }

    const result = await tokenCalculatorService.calculateTokens(request)

    // Filter projections based on timeframe
    let projections = result.projections
    if (timeframe === 'nearTerm') {
      projections = { nearTerm: result.projections.nearTerm, seasonal: [] }
    } else if (timeframe === 'seasonal') {
      projections = { nearTerm: [], seasonal: result.projections.seasonal }
    }

    res.json({
      success: true,
      data: {
        projections,
        events: result.events,
        harmonics: result.harmonics,
        metadata: result.metadata,
      },
      metadata: {
        timeframe,
        location,
        timestamp: (request.timestamp || new Date()).toISOString(),
      },
    })
  })
)

/**
 * POST /api/tokens/events
 * Get upcoming token events
 */
router.post(
  '/events',
  [
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('timestamp').optional().isISO8601().withMessage('timestamp must be valid ISO8601 string'),
    body('lookAhead')
      .optional()
      .isInt({ min: 1, max: 168 })
      .withMessage('lookAhead must be between 1 and 168 hours'),
  ],
  asyncHandler(async (req, res) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    if (!req.featureFlags.tokenCalculationsBackend) {
      throw new AppError('Token calculations backend is disabled', 503)
    }

    const { location, timestamp, lookAhead = 48 } = req.body

    const baseTokens = {
      Spirit: 1.0,
      Essence: 0.8,
      Matter: 0.6,
      Substance: 0.4,
    }

    const request = {
      tokens: baseTokens,
      location,
      timestamp: timestamp ? new Date(timestamp) : undefined,
    }

    const result = await tokenCalculatorService.calculateTokens(request)

    // Filter events within lookAhead window
    const now = request.timestamp || new Date()
    const cutoffTime = new Date(now.getTime() + lookAhead * 60 * 60 * 1000)

    const upcomingEvents = result.events.filter(event => event.timestamp <= cutoffTime)

    res.json({
      success: true,
      data: {
        events: upcomingEvents,
        marketPhase: result.metadata.marketPhase,
        volatilityIndex: result.metadata.volatilityIndex,
      },
      metadata: {
        lookAheadHours: lookAhead,
        location,
        timestamp: now.toISOString(),
        totalEvents: upcomingEvents.length,
      },
    })
  })
)

/**
 * GET /api/tokens/info
 * Get information about available tokens
 */
router.get('/info', (req: Request, res: Response) => {
  const tokenInfo = {
    Spirit: {
      element: 'Fire',
      baseRate: 1.0,
      description: 'Primary alchemical essence, highest volatility',
      planetaryAffinities: ['Sun', 'Mars', 'Jupiter'],
    },
    Essence: {
      element: 'Water',
      baseRate: 0.8,
      description: 'Life force energy, moderate volatility',
      planetaryAffinities: ['Moon', 'Venus', 'Jupiter'],
    },
    Matter: {
      element: 'Earth',
      baseRate: 0.6,
      description: 'Physical manifestation, stable growth',
      planetaryAffinities: ['Saturn', 'Mars', 'Venus'],
    },
    Substance: {
      element: 'Air',
      baseRate: 0.4,
      description: 'Transformative catalyst, high reactivity',
      planetaryAffinities: ['Mercury', 'Saturn', 'Sun'],
    },
  }

  res.json({
    success: true,
    data: tokenInfo,
    metadata: {
      totalTokens: Object.keys(tokenInfo).length,
      description: 'Alchemical token system with planetary influences',
    },
  })
})

export default router
