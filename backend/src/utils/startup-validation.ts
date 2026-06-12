import { logger } from './logger.js'

interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validates production environment configuration
 */
export function validateProductionConfig(): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Required environment variables for production
  const requiredEnvVars = ['NODE_ENV']

  // Check required variables
  requiredEnvVars.forEach(envVar => {
    if (!process.env[envVar]) {
      errors.push(`Missing required environment variable: ${envVar}`)
    }
  })

  // Validate NODE_ENV
  if (
    process.env.NODE_ENV &&
    !['development', 'test', 'production'].includes(process.env.NODE_ENV)
  ) {
    errors.push(
      `Invalid NODE_ENV value: ${process.env.NODE_ENV}. Must be one of: development, test, production`
    )
  }

  // Check CORS configuration
  if (
    process.env.NODE_ENV === 'production' &&
    (!process.env.CORS_ORIGINS || process.env.CORS_ORIGINS.includes('localhost'))
  ) {
    warnings.push('Production environment should not include localhost in CORS_ORIGINS')
  }

  // Validate port configuration
  const port = parseInt(process.env.PORT || '8000')
  if (isNaN(port) || port < 1 || port > 65535) {
    errors.push(`Invalid PORT value: ${process.env.PORT}. Must be a number between 1 and 65535`)
  }

  // Validate rate limiting configuration
  const rateLimit = parseInt(process.env.RATE_LIMIT_REQUESTS_PER_MINUTE || '100')
  if (isNaN(rateLimit) || rateLimit < 1) {
    errors.push(
      `Invalid RATE_LIMIT_REQUESTS_PER_MINUTE value: ${process.env.RATE_LIMIT_REQUESTS_PER_MINUTE}. Must be a positive number`
    )
  }

  // Validate request size limits
  const maxRequestSize = parseInt(process.env.MAX_REQUEST_SIZE_MB || '2')
  if (isNaN(maxRequestSize) || maxRequestSize < 1 || maxRequestSize > 50) {
    errors.push(
      `Invalid MAX_REQUEST_SIZE_MB value: ${process.env.MAX_REQUEST_SIZE_MB}. Must be between 1 and 50`
    )
  }

  // Check cache configuration
  if (!process.env.REDIS_URL && process.env.NODE_ENV === 'production') {
    warnings.push(
      'No REDIS_URL configured in production. Memory cache will be used, which may not be optimal for scaling.'
    )
  }

  // Validate cache TTL values
  const cacheTTLs = [
    'PLANETARY_CACHE_TTL',
    'CONSCIOUSNESS_CACHE_TTL',
    'KINETICS_CACHE_TTL',
    'TOKEN_CACHE_TTL',
  ]

  cacheTTLs.forEach(ttlVar => {
    const value = parseInt(process.env[ttlVar] || '120')
    if (isNaN(value) || value < 1 || value > 3600) {
      warnings.push(`${ttlVar} value (${process.env[ttlVar]}) should be between 1 and 3600 seconds`)
    }
  })

  // Check feature flags
  const featureFlags = [
    'ENABLE_KINETICS_BACKEND',
    'ENABLE_CONSCIOUSNESS_BACKEND',
    'ENABLE_PLANETARY_BACKEND',
    'ENABLE_TOKEN_BACKEND',
  ]

  const enabledFeatures = featureFlags.filter(flag => process.env[flag] === 'true')
  if (enabledFeatures.length === 0) {
    warnings.push(
      'No backend features are enabled. At least one feature should be enabled for the service to be useful.'
    )
  }

  // Check WebSocket configuration
  if (process.env.ENABLE_WEBSOCKET === 'true') {
    const wsPort = parseInt(process.env.WEBSOCKET_PORT || '8001')
    if (isNaN(wsPort) || wsPort < 1 || wsPort > 65535) {
      errors.push(
        `Invalid WEBSOCKET_PORT value: ${process.env.WEBSOCKET_PORT}. Must be a number between 1 and 65535`
      )
    }
    if (wsPort === port) {
      errors.push('WEBSOCKET_PORT cannot be the same as PORT')
    }
  }

  // Check external service URLs
  if (process.env.ALCHM_BACKEND_URL && !isValidUrl(process.env.ALCHM_BACKEND_URL)) {
    errors.push(`Invalid ALCHM_BACKEND_URL: ${process.env.ALCHM_BACKEND_URL}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Validates system resources and dependencies
 */
export async function validateSystemResources(): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  try {
    // Check memory usage
    const memUsage = process.memoryUsage()
    const memUsageMB = memUsage.heapUsed / 1024 / 1024

    if (memUsageMB > 500) {
      warnings.push(`High memory usage detected: ${memUsageMB.toFixed(2)}MB`)
    }

    // Check Node.js version
    const nodeVersion = process.version
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0])

    if (majorVersion < 18) {
      errors.push(
        `Node.js version ${nodeVersion} is not supported. Minimum required version is 18.x`
      )
    } else if (majorVersion < 20) {
      warnings.push(
        `Node.js version ${nodeVersion} is supported but upgrading to 20.x is recommended`
      )
    }

    // Check available disk space (simplified check)
    try {
      const fs = await import('fs')
      const stats = fs.statSync('.')
      // This is a basic check - in production you might want more sophisticated disk space monitoring
    } catch (error) {
      warnings.push('Unable to check disk space')
    }
  } catch (error) {
    errors.push(
      `Error during system resource validation: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Runs all production validations
 */
export async function validateProduction(): Promise<boolean> {
  logger.info('Starting production validation...')

  const configValidation = validateProductionConfig()
  const systemValidation = await validateSystemResources()

  // Log configuration validation results
  if (configValidation.errors.length > 0) {
    logger.error('Configuration validation failed:')
    configValidation.errors.forEach(error => logger.error(`  ❌ ${error}`))
  }

  if (configValidation.warnings.length > 0) {
    logger.warn('Configuration warnings:')
    configValidation.warnings.forEach(warning => logger.warn(`  ⚠️  ${warning}`))
  }

  // Log system validation results
  if (systemValidation.errors.length > 0) {
    logger.error('System validation failed:')
    systemValidation.errors.forEach(error => logger.error(`  ❌ ${error}`))
  }

  if (systemValidation.warnings.length > 0) {
    logger.warn('System warnings:')
    systemValidation.warnings.forEach(warning => logger.warn(`  ⚠️  ${warning}`))
  }

  const isValid = configValidation.valid && systemValidation.valid

  if (isValid) {
    logger.info('✅ Production validation passed')
  } else {
    logger.error('❌ Production validation failed')
  }

  return isValid
}

// Helper functions
function isValidUrl(string: string): boolean {
  try {
    new URL(string)
    return true
  } catch {
    return false
  }
}
