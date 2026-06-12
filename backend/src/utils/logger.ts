import winston from 'winston'

const logLevel = process.env.LOG_LEVEL || 'info'
const logFormat = process.env.LOG_FORMAT || 'json'

// Create custom format for development
const developmentFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
    return `${timestamp} [${level}]: ${message} ${metaStr}`
  })
)

// Create custom format for production
const productionFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
)

// Create logger
export const logger = winston.createLogger({
  level: logLevel,
  format: winston.format.combine(
    winston.format((info: any) => {
      try {
        if (info?.req && (info.req as any).user?.id) {
          info.userId = (info.req as any).user.id
        }
      } catch {}
      return info
    })(),
    logFormat === 'json' ? productionFormat : developmentFormat
  ),
  defaultMeta: { service: 'planetary-agents-backend' },
  transports: [
    // Console transport
    new winston.transports.Console({
      stderrLevels: ['error'],
    }),
  ],
})

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  logger.add(
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
    })
  )

  logger.add(
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 10485760, // 10MB
      maxFiles: 10,
    })
  )
}

// Create a stream for morgan middleware
export const loggerStream = {
  write: (message: string) => {
    logger.info(message.trim())
  },
}

export default logger
