import { Request, Response, NextFunction } from 'express'

export interface FeatureFlags {
  planetaryHoursBackend: boolean
  thermodynamicsBackend: boolean
  tokenCalculationsBackend: boolean
  kineticsBackend: boolean
}

// Extend Request interface to include feature flags
declare global {
  namespace Express {
    interface Request {
      featureFlags: FeatureFlags
    }
  }
}

export const featureFlagMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  req.featureFlags = {
    planetaryHoursBackend: process.env.PLANETARY_HOURS_BACKEND === 'true',
    thermodynamicsBackend: process.env.THERMODYNAMICS_BACKEND === 'true',
    tokenCalculationsBackend: process.env.TOKEN_CALCULATIONS_BACKEND === 'true',
    kineticsBackend: process.env.KINETICS_BACKEND === 'true',
  }

  next()
}
