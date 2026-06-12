import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { body, validationResult } from 'express-validator'
import { planetaryHoursService } from '../services/planetary-hours.js'
import { asyncHandler, AppError } from '../middleware/error-handler.js'

const router: ExpressRouter = createRouter()

/**
 * POST /api/planetary/current-hour
 * Get current planetary hour for a location and time
 */
router.post(
  '/current-hour',
  [
    body('datetime').optional().isISO8601().withMessage('datetime must be valid ISO8601 string'),
    body('timezone').optional().isString().withMessage('timezone must be string'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    // Check for validation errors
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { datetime, location } = req.body
    const requestTime = datetime ? new Date(datetime) : new Date()

    if (!req.featureFlags.planetaryHoursBackend) {
      throw new AppError('Planetary hours backend is disabled', 503)
    }

    const startTime = Date.now()
    const planetaryHour = await planetaryHoursService.getCurrentPlanetaryHour(requestTime, location)
    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: planetaryHour,
      metadata: {
        computeTime,
        requestTime: requestTime.toISOString(),
        location,
      },
    })
  })
)

/**
 * POST /api/planetary/forecast
 * Get planetary hour forecast for a date range
 */
router.post(
  '/forecast',
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

    const { startDate, endDate, location, interval = 60 } = req.body

    if (!req.featureFlags.planetaryHoursBackend) {
      throw new AppError('Planetary hours backend is disabled', 503)
    }

    const start = new Date(startDate)
    const end = new Date(endDate)

    // Validate date range
    if (end <= start) {
      throw new AppError('endDate must be after startDate', 400)
    }

    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    if (diffDays > 30) {
      throw new AppError('Date range cannot exceed 30 days', 400)
    }

    const startTime = Date.now()
    const forecast = await planetaryHoursService.getForecast(start, end, location, interval)
    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: forecast,
      metadata: {
        computeTime,
        totalPoints: forecast.length,
        dateRange: {
          start: start.toISOString(),
          end: end.toISOString(),
        },
        interval,
        location,
      },
    })
  })
)

/**
 * POST /api/planetary/optimal-times
 * Get optimal times for a specific planetary influence
 */
router.post(
  '/optimal-times',
  [
    body('date').isISO8601().withMessage('date must be valid ISO8601 string'),
    body('location.lat')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('location.lon')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('targetPlanet')
      .isIn(['Sun', 'Moon', 'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'])
      .withMessage('targetPlanet must be a valid planet'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed', 400)
    }

    const { date, location, targetPlanet } = req.body

    if (!req.featureFlags.planetaryHoursBackend) {
      throw new AppError('Planetary hours backend is disabled', 503)
    }

    const targetDate = new Date(date)
    const startTime = Date.now()

    const optimalTimes = await planetaryHoursService.getOptimalTimes(
      targetDate,
      location,
      targetPlanet
    )
    const computeTime = Date.now() - startTime

    res.json({
      success: true,
      data: optimalTimes,
      metadata: {
        computeTime,
        targetPlanet,
        date: targetDate.toISOString(),
        location,
        totalWindows: optimalTimes.length,
      },
    })
  })
)

/**
 * GET /api/planetary/planets
 * Get list of available planets
 */
router.get('/planets', (req: Request, res: Response) => {
  const planets = [
    { name: 'Sun', element: 'Fire', day: 'Sunday' },
    { name: 'Moon', element: 'Water', day: 'Monday' },
    { name: 'Mars', element: 'Fire', day: 'Tuesday' },
    { name: 'Mercury', element: 'Air', day: 'Wednesday' },
    { name: 'Jupiter', element: 'Air', day: 'Thursday' },
    { name: 'Venus', element: 'Water', day: 'Friday' },
    { name: 'Saturn', element: 'Earth', day: 'Saturday' },
  ]

  res.json({
    success: true,
    data: planets,
    metadata: {
      total: planets.length,
    },
  })
})

export default router
