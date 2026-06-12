import 'express-serve-static-core'

declare module 'express-serve-static-core' {
  interface Request {
    user?: { id: string; [key: string]: any }
    featureFlags?: Record<string, boolean>
  }
}
