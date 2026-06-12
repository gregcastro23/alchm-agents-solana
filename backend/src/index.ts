import express, { type Request, type Response } from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import rateLimit from 'express-rate-limit'
import { createServer } from 'http'
import { WebSocketServer } from 'ws'
import dotenv from 'dotenv'
import { logger } from './utils/logger.js'
import { validateProduction } from './utils/startup-validation.js'
import { errorHandler, notFoundHandler } from './middleware/error-handler.js'
import { requestLogger } from './middleware/request-logger.js'
import { featureFlagMiddleware } from './middleware/feature-flags.js'
import {
  securityHeaders,
  validateContentType,
  sanitizeInput,
  requestTimeout,
  suspiciousActivityLogger,
  blockAttacks,
} from './middleware/security.js'
import { cacheService } from './services/cache.js'
import { authMiddleware } from './middleware/auth.js'

// Routes
import alchemyRoutes from './routes/alchemy.js'
import planetaryRoutes from './routes/planetary.js'
import ephemerisRoutes from './routes/ephemeris.js'
import tokenRoutes from './routes/tokens.js'
import kineticsRoutes from './routes/kinetics.js'
import consciousnessRoutes from './routes/consciousness.js'
import healthRoutes from './routes/health.js'
import agentRoutes from './routes/agents.js'
import agentActionRoutes from './routes/agent-actions.js'
import { astrologicalActionScheduler } from './services/astrological-action-scheduler.js'

// WebSocket handlers
import { setupWebSocketHandlers } from './websocket/handlers.js'

// Load environment variables
dotenv.config()

const app = express()
const PORT: number = parseInt(process.env.PORT || '8000', 10)
const HOST = process.env.HOST || '0.0.0.0'
const ENABLE_WEBSOCKET = process.env.ENABLE_WEBSOCKET === 'true'

// Security middleware
app.use(
  helmet({
    contentSecurityPolicy: false, // Allow for development
    crossOriginEmbedderPolicy: false,
  })
)

// CORS configuration
const defaultOrigins = [
  'http://localhost:3000',
  'https://v0-planetary-agents1.vercel.app',
  'https://v0-planetary-agents-git-main-gregcastro23s-projects.vercel.app',
]

// Support wildcard patterns for Vercel preview deployments
const allowedOriginPatterns = [
  /^https:\/\/v0-planetary-agents.*\.vercel\.app$/,
  /^http:\/\/localhost:\d+$/,
]

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) {
      return callback(null, true)
    }

    // Check explicit origins
    const explicitOrigins = process.env.CORS_ORIGINS?.split(',') || defaultOrigins
    if (explicitOrigins.includes(origin)) {
      return callback(null, true)
    }

    // Check pattern matches
    if (allowedOriginPatterns.some(pattern => pattern.test(origin))) {
      return callback(null, true)
    }

    // Reject origin
    logger.warn(`CORS blocked origin: ${origin}`)
    callback(new Error('Not allowed by CORS'))
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}
app.use(cors(corsOptions))

// Compression and parsing with production limits
app.use(compression() as any)
const maxRequestSize = process.env.MAX_REQUEST_SIZE_MB || '2'
app.use(
  express.json({
    limit: `${maxRequestSize}mb`,
    verify: (req: Request, res: Response, buf: Buffer, _encoding: string) => {
      // Validate JSON payload size in production
      if (buf.length > parseInt(maxRequestSize) * 1024 * 1024) {
        const error: any = new Error('Request payload too large')
        error.status = 413
        throw error
      }
    },
  })
)
app.use(
  express.urlencoded({
    extended: true,
    limit: `${maxRequestSize}mb`,
    parameterLimit: 1000, // Prevent parameter pollution attacks
  })
)

// Rate limiting with different tiers
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '100') * 15, // Scale to window
  message: {
    error: 'Too many requests from this IP, please try again later',
    retryAfter: '15 minutes',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: req => {
    // Skip rate limiting for health checks
    return req.path === '/api/health'
  },
})

// Stricter rate limiting for expensive operations
const computeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // 10 requests per minute for heavy computations
  message: {
    error: 'Computation rate limit exceeded, please wait before making more requests',
    retryAfter: '1 minute',
  },
  standardHeaders: true,
  legacyHeaders: false,
})

app.use('/api/', globalLimiter)
app.use('/api/kinetics/', computeLimiter)
app.use('/api/consciousness/', computeLimiter)

// Security middleware
app.use(securityHeaders)
app.use(requestTimeout(30000)) // 30 second timeout
app.use(blockAttacks)
app.use(suspiciousActivityLogger)
app.use(validateContentType)
app.use(sanitizeInput)

// Custom middleware
app.use(requestLogger)
app.use(featureFlagMiddleware)

// API Routes
app.use('/api/health', healthRoutes)
app.use('/api/alchemy', alchemyRoutes)
app.use('/api/planetary', planetaryRoutes)
app.use('/api/planets', ephemerisRoutes) // Swiss Ephemeris endpoints
app.use('/api/tokens', tokenRoutes)
app.use('/api/agents', agentRoutes)
app.use('/api/agent-actions', agentActionRoutes)

// Apply auth before protected routes
app.use('/api/kinetics', authMiddleware)
app.use('/api/consciousness', authMiddleware)

app.use('/api/kinetics', kineticsRoutes)
app.use('/api/consciousness', consciousnessRoutes)

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    name: 'Planetary Agents Backend',
    version: '1.0.0',
    description: 'Gateway service for alchemical calculations and data orchestration',
    endpoints: {
      health: '/api/health',
      alchemy: '/api/alchemy',
      planetary: '/api/planetary',
      planets: '/api/planets (Swiss Ephemeris)',
      tokens: '/api/tokens',
      kinetics: '/api/kinetics',
      consciousness: '/api/consciousness',
    },
    timestamp: new Date().toISOString(),
  })
})

// Error handling
app.use(notFoundHandler)
app.use(errorHandler)

// Initialize cache service
async function initializeServices() {
  try {
    await cacheService.connect()
    logger.info('Cache service initialized')
  } catch (error) {
    logger.warn('Cache service initialization failed, using memory fallback:', error)
  }
}

// Start server
async function startServer() {
  // Run production validation first
  if (process.env.NODE_ENV === 'production') {
    const isValid = await validateProduction()
    if (!isValid) {
      logger.error('Production validation failed, exiting...')
      process.exit(1)
    }
  }

  await initializeServices()

  const server = createServer(app)

  // Setup WebSocket if enabled
  if (ENABLE_WEBSOCKET) {
    const wsPort = parseInt(process.env.WEBSOCKET_PORT || '8001')
    const wss = new WebSocketServer({ port: wsPort })
    setupWebSocketHandlers(wss)
    logger.info(`WebSocket server started on port ${wsPort}`)
  }

  if (process.env.ASTRO_ACTION_ENGINE_ENABLED === 'true') {
    try {
      astrologicalActionScheduler.start()
    } catch (error) {
      logger.error('Failed to start astrological action scheduler', {
        error: error instanceof Error ? error.message : String(error),
      })
      if (process.env.NODE_ENV === 'production') {
        throw error
      }
    }
  }

  server.listen(PORT, HOST, () => {
    logger.info(`🚀 Planetary Agents Backend started`)
    logger.info(`📍 Server: http://${HOST}:${PORT}`)
    logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`)
    logger.info(`💾 Cache: ${process.env.REDIS_URL ? 'Redis' : 'Memory'}`)
    logger.info(
      `🔧 Feature Flags: ${Object.keys(process.env)
        .filter(k => k.endsWith('_BACKEND'))
        .join(', ')}`
    )
  })

  // Graceful shutdown handling
  let isShuttingDown = false

  const gracefulShutdown = (signal: string) => {
    if (isShuttingDown) {
      logger.warn(`${signal} received again, forcing shutdown`)
      process.exit(1)
    }

    isShuttingDown = true
    logger.info(`${signal} received, starting graceful shutdown`)

    // Set a timeout for forced shutdown
    const shutdownTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timeout, forcing exit')
      process.exit(1)
    }, 30000) // 30 seconds timeout

    server.close(err => {
      if (err) {
        logger.error('Error during server shutdown:', err)
        clearTimeout(shutdownTimeout)
        process.exit(1)
        return
      }

      logger.info('HTTP server closed')

      // Close cache connections
      try {
        cacheService.disconnect()
        logger.info('Cache service disconnected')
      } catch (error) {
        logger.error('Error disconnecting cache service:', error)
      }

      try {
        astrologicalActionScheduler.stop()
      } catch (error) {
        logger.error('Error stopping astrological action scheduler:', error)
      }

      clearTimeout(shutdownTimeout)
      logger.info('Graceful shutdown completed')
      process.exit(0)
    })

    // Stop accepting new requests
    server.closeAllConnections?.()
  }

  // Handle different shutdown signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))

  // Handle uncaught exceptions
  process.on('uncaughtException', error => {
    logger.error('Uncaught Exception:', error)
    gracefulShutdown('UNCAUGHT_EXCEPTION')
  })

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason)
    gracefulShutdown('UNHANDLED_REJECTION')
  })
}

startServer().catch(error => {
  logger.error('Failed to start server:', error)
  process.exit(1)
})
