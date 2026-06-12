import {
  Request,
  Response,
  NextFunction,
  type RequestHandler,
  type ErrorRequestHandler,
} from 'express'
import { logger } from '../utils/logger.js'

export interface ApiError extends Error {
  statusCode?: number
  isOperational?: boolean
}

export class AppError extends Error implements ApiError {
  public readonly statusCode: number
  public readonly isOperational: boolean

  constructor(message: string, statusCode: number = 500, isOperational: boolean = true) {
    super(message)
    this.statusCode = statusCode
    this.isOperational = isOperational

    Error.captureStackTrace(this, this.constructor)
  }
}

export const errorHandler: ErrorRequestHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { statusCode = 500, message, stack } = error

  logger.error('API Error:', {
    statusCode,
    message,
    stack: process.env.NODE_ENV === 'development' ? stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  })

  // Don't leak error details in production
  const response = {
    success: false,
    error: {
      message:
        statusCode >= 500 && process.env.NODE_ENV === 'production'
          ? 'Internal Server Error'
          : message,
      statusCode,
      timestamp: new Date().toISOString(),
      path: req.path,
    },
    ...(process.env.NODE_ENV === 'development' && { stack }),
  }

  res.status(statusCode).json(response)
}

export const notFoundHandler: RequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const error = new AppError(`Route ${req.originalUrl} not found`, 404)
  next(error)
}

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
