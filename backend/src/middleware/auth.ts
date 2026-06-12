import jwt from 'jsonwebtoken'
import { type Request, type Response, type NextFunction } from 'express'

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret'

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.path === '/api/health') return next()

  const token = req.headers.authorization?.split(' ')[1]
  if (!token) {
    return res.status(401).json({ error: 'No token provided' })
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any
    ;(req as any).user = decoded
    next()
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' })
  }
}
