import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

/**
 * Additional security middleware for production hardening
 */

/**
 * Remove sensitive headers and add security headers
 */
export function securityHeaders(req: Request, res: Response, next: NextFunction) {
  // Remove server information
  res.removeHeader('X-Powered-By')

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader('X-XSS-Protection', '1; mode=block')
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')

  // Cache control for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')
  }

  next()
}

/**
 * Validate request content type for POST/PUT requests
 */
export function validateContentType(req: Request, res: Response, next: NextFunction) {
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    const contentType = req.get('Content-Type')

    if (!contentType) {
      return res.status(400).json({
        error: 'Content-Type header is required for this request',
      })
    }

    if (
      !contentType.includes('application/json') &&
      !contentType.includes('application/x-www-form-urlencoded')
    ) {
      return res.status(415).json({
        error:
          'Unsupported Media Type. Only application/json and application/x-www-form-urlencoded are supported',
      })
    }
  }

  next()
}

/**
 * Sanitize request parameters to prevent injection attacks
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction) {
  try {
    // Sanitize query parameters
    if (req.query) {
      Object.keys(req.query).forEach(key => {
        if (typeof req.query[key] === 'string') {
          // Basic XSS prevention
          req.query[key] = (req.query[key] as string)
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
            .replace(/javascript:/gi, '')
            .replace(/on\w+\s*=/gi, '')
        }
      })
    }

    // Sanitize body parameters
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body)
    }

    next()
  } catch (error) {
    logger.error('Error in input sanitization:', error)
    res.status(500).json({
      error: 'Request processing error',
    })
  }
}

/**
 * Request timeout middleware
 */
export function requestTimeout(timeoutMs: number = 30000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const timeout = setTimeout(() => {
      if (!res.headersSent) {
        logger.warn(`Request timeout for ${req.method} ${req.path}`)
        res.status(408).json({
          error: 'Request timeout',
          message: 'The request took too long to process',
        })
      }
    }, timeoutMs)

    res.on('finish', () => {
      clearTimeout(timeout)
    })

    res.on('close', () => {
      clearTimeout(timeout)
    })

    next()
  }
}

/**
 * Log suspicious activity
 */
export function suspiciousActivityLogger(req: Request, res: Response, next: NextFunction) {
  const suspiciousPatterns = [
    /\.\.\//, // Path traversal
    /<script/i, // XSS attempts
    /union\s+select/i, // SQL injection
    /javascript:/i, // JavaScript injection
    /eval\(/i, // Code execution attempts
    /proc\/self\/environ/i, // Environment access attempts
  ]

  const userAgent = req.get('User-Agent') || ''
  const path = req.path
  const query = JSON.stringify(req.query)
  const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {})

  const requestData = `${path} ${query} ${body} ${userAgent}`

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestData)) {
      logger.warn('Suspicious activity detected', {
        ip: req.ip,
        userAgent,
        path,
        method: req.method,
        pattern: pattern.toString(),
        timestamp: new Date().toISOString(),
      })
      break
    }
  }

  next()
}

/**
 * Block common attack patterns
 */
export function blockAttacks(req: Request, res: Response, next: NextFunction) {
  const attackPatterns = [
    /\.\.\/.*etc\/passwd/i, // File system access
    /\.\.\/.*proc\/version/i, // System information
    /union.*select.*from/i, // SQL injection
    /<script.*src.*>/i, // External script injection
  ]

  const requestData = `${req.path} ${JSON.stringify(req.query)} ${JSON.stringify(req.body || {})}`

  for (const pattern of attackPatterns) {
    if (pattern.test(requestData)) {
      logger.error('Attack attempt blocked', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method,
        pattern: pattern.toString(),
        timestamp: new Date().toISOString(),
      })

      return res.status(403).json({
        error: 'Forbidden',
        message: 'Request blocked due to security policy',
      })
    }
  }

  next()
}

// Helper function to recursively sanitize objects
function sanitizeObject(obj: any): void {
  if (obj && typeof obj === 'object') {
    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'string') {
        obj[key] = obj[key]
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/javascript:/gi, '')
          .replace(/on\w+\s*=/gi, '')
      } else if (typeof obj[key] === 'object') {
        sanitizeObject(obj[key])
      }
    })
  }
}
