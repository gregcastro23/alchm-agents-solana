import { Request, Response, NextFunction } from 'express'
import { logger } from '../utils/logger.js'

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now()

  // Log request
  logger.info('Incoming request:', {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
  })

  // Override res.end to capture response details
  const originalEnd = res.end.bind(res)
  res.end = function (this: Response, chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - startTime

    logger.info('Request completed:', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      responseTime: `${responseTime}ms`,
      contentLength: res.get('Content-Length'),
    })

    // Call the original end method
    if (typeof encoding === 'function') {
      return originalEnd(chunk, encoding as any)
    }
    return originalEnd(chunk, encoding as any, cb)
  }

  next()
}
