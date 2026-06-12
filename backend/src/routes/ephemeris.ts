/**
 * Swiss Ephemeris API Routes (Backend)
 * =====================================
 *
 * RESTful API for astronomical calculations
 * Provides planetary positions, house systems, and consciousness parameters
 */

import { Router as createRouter, type Request, type Response } from 'express'
import type { Router as ExpressRouter } from 'express'
import { body, validationResult } from 'express-validator'
import { swissEphemerisService } from '../services/swiss-ephemeris.js'
import { asyncHandler, AppError } from '../middleware/error-handler.js'

const router: ExpressRouter = createRouter()

/**
 * POST /api/planets/positions
 * Get planetary positions for a given moment in time
 */
router.post(
  '/positions',
  [
    body('date').isISO8601().withMessage('date must be valid ISO8601 string'),
    body('latitude').optional().isFloat({ min: -90, max: 90 }),
    body('longitude').optional().isFloat({ min: -180, max: 180 }),
    body('planets').optional().isArray().withMessage('planets must be an array of planet names'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed: ' + JSON.stringify(errors.array()), 400)
    }

    const { date, latitude, longitude, planets } = req.body
    const requestDate = new Date(date)

    if (isNaN(requestDate.getTime())) {
      throw new AppError('Invalid date format', 400)
    }

    const startTime = Date.now()

    try {
      const positions = swissEphemerisService.getPlanetaryPositions(requestDate, planets)
      const computeTime = Date.now() - startTime

      res.json({
        success: true,
        data: positions,
        metadata: {
          computeTime,
          requestDate: requestDate.toISOString(),
          totalPlanets: Object.keys(positions).length,
          coordinates: latitude !== undefined ? { latitude, longitude } : null,
        },
      })
    } catch (error) {
      throw new AppError(
        `Planetary position calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      )
    }
  })
)

/**
 * POST /api/planets/batch-positions
 * Get planetary positions for a batch of dates and planets
 */
router.post(
  '/batch-positions',
  [
    body('requests').isArray().withMessage('requests must be an array'),
    body('requests.*.date').isISO8601().withMessage('Each request must have a valid ISO8601 date'),
    body('requests.*.planet').isString().withMessage('Each request must specify a planet'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed: ' + JSON.stringify(errors.array()), 400)
    }

    const { requests } = req.body
    const startTime = Date.now()

    try {
      const results = requests.map((reqItem: { date: string; planet: string }) => {
        const date = new Date(reqItem.date)
        const planetKey = reqItem.planet.toLowerCase()
        const pos = swissEphemerisService.getPlanetaryPositions(date, [planetKey])
        return {
          date: reqItem.date,
          planet: reqItem.planet,
          position: pos[planetKey] || null,
        }
      })

      const computeTime = Date.now() - startTime

      res.json({
        success: true,
        data: results,
        metadata: {
          computeTime,
          totalRequests: requests.length,
        },
      })
    } catch (error) {
      throw new AppError(
        `Batch planetary position calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      )
    }
  })
)

/**
 * POST /api/planets/houses

 * Calculate house system for a birth chart
 */
router.post(
  '/houses',
  [
    body('date').isISO8601().withMessage('date must be valid ISO8601 string'),
    body('latitude')
      .isFloat({ min: -90, max: 90 })
      .withMessage('latitude must be between -90 and 90'),
    body('longitude')
      .isFloat({ min: -180, max: 180 })
      .withMessage('longitude must be between -180 and 180'),
    body('houseSystem')
      .optional()
      .isString()
      .isLength({ min: 1, max: 1 })
      .withMessage('houseSystem must be single character (P, K, etc.)'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed: ' + JSON.stringify(errors.array()), 400)
    }

    const { date, latitude, longitude, houseSystem = 'P' } = req.body
    const requestDate = new Date(date)

    if (isNaN(requestDate.getTime())) {
      throw new AppError('Invalid date format', 400)
    }

    const startTime = Date.now()

    try {
      const houses = swissEphemerisService.getHouseSystem(
        requestDate,
        latitude,
        longitude,
        houseSystem
      )
      const computeTime = Date.now() - startTime

      res.json({
        success: true,
        data: houses,
        metadata: {
          computeTime,
          requestDate: requestDate.toISOString(),
          coordinates: { latitude, longitude },
          houseSystem,
        },
      })
    } catch (error) {
      throw new AppError(
        `House system calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      )
    }
  })
)

/**
 * POST /api/consciousness/calculate
 * Calculate consciousness parameters from birth data and current transits
 */
router.post(
  '/calculate',
  [
    body('birthData.date').isISO8601().withMessage('birthData.date must be valid ISO8601 string'),
    body('birthData.latitude')
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage('birthData.latitude must be between -90 and 90'),
    body('birthData.longitude')
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage('birthData.longitude must be between -180 and 180'),
    body('currentDate')
      .optional()
      .isISO8601()
      .withMessage('currentDate must be valid ISO8601 string'),
  ],
  asyncHandler(async (req: Request, res: Response) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) {
      throw new AppError('Validation failed: ' + JSON.stringify(errors.array()), 400)
    }

    const { birthData, currentDate } = req.body
    const birthDate = new Date(birthData.date)
    const transitDate = currentDate ? new Date(currentDate) : new Date()

    if (isNaN(birthDate.getTime())) {
      throw new AppError('Invalid birth date format', 400)
    }

    if (currentDate && isNaN(transitDate.getTime())) {
      throw new AppError('Invalid current date format', 400)
    }

    const startTime = Date.now()

    try {
      const consciousness = swissEphemerisService.calculateConsciousness(
        transitDate,
        birthData.latitude,
        birthData.longitude
      )
      const computeTime = Date.now() - startTime

      res.json({
        success: true,
        data: consciousness,
        metadata: {
          computeTime,
          birthDate: birthDate.toISOString(),
          transitDate: transitDate.toISOString(),
          coordinates:
            birthData.latitude !== undefined
              ? { latitude: birthData.latitude, longitude: birthData.longitude }
              : null,
        },
      })
    } catch (error) {
      throw new AppError(
        `Consciousness calculation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        500
      )
    }
  })
)

/**
 * GET /api/planets/available
 * Get list of available planets for calculation
 */
router.get('/available', (req: Request, res: Response) => {
  const availablePlanets = [
    {
      id: 'sun',
      name: 'Sun',
      element: 'fire',
      alchemy: { spirit: 1, essence: 0, matter: 0, substance: 0 },
    },
    {
      id: 'moon',
      name: 'Moon',
      element: 'water',
      alchemy: { spirit: 0, essence: 1, matter: 1, substance: 0 },
    },
    {
      id: 'mercury',
      name: 'Mercury',
      element: 'air',
      alchemy: { spirit: 1, essence: 0, matter: 0, substance: 1 },
    },
    {
      id: 'venus',
      name: 'Venus',
      element: 'water',
      alchemy: { spirit: 0, essence: 1, matter: 1, substance: 0 },
    },
    {
      id: 'mars',
      name: 'Mars',
      element: 'fire',
      alchemy: { spirit: 0, essence: 0, matter: 1, substance: 1 },
    },
    {
      id: 'jupiter',
      name: 'Jupiter',
      element: 'air',
      alchemy: { spirit: 0, essence: 1, matter: 0, substance: 0 },
    },
    {
      id: 'saturn',
      name: 'Saturn',
      element: 'earth',
      alchemy: { spirit: 0, essence: 0, matter: 0, substance: 1 },
    },
    {
      id: 'uranus',
      name: 'Uranus',
      element: 'air',
      alchemy: { spirit: 1, essence: 0, matter: 0, substance: 0 },
    },
    {
      id: 'neptune',
      name: 'Neptune',
      element: 'water',
      alchemy: { spirit: 0, essence: 1, matter: 0, substance: 0 },
    },
    {
      id: 'pluto',
      name: 'Pluto',
      element: 'earth',
      alchemy: { spirit: 0, essence: 0, matter: 1, substance: 0 },
    },
    {
      id: 'north-node',
      name: 'North Node',
      element: 'spirit',
      alchemy: { spirit: 1, essence: 0, matter: 0, substance: 0 },
    },
    {
      id: 'chiron',
      name: 'Chiron',
      element: 'hybrid',
      alchemy: { spirit: 0, essence: 1, matter: 1, substance: 0 },
    },
  ]

  res.json({
    success: true,
    data: availablePlanets,
    metadata: {
      total: availablePlanets.length,
      alchemicalPrinciple:
        'Each planet carries specific alchemical energies (Spirit, Essence, Matter, Substance)',
    },
  })
})

export default router
