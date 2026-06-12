import { NextResponse } from 'next/server'
import { z } from 'zod'
import { swissEphemerisService } from '@/lib/swiss-ephemeris-service'
import { logger } from '@/lib/structured-logger'
import { withApiErrorHandling } from '@/lib/error-handling'

// Request schema
const CalculateRequestSchema = z.object({
  birthDate: z.string().datetime(),
  latitude: z.number(),
  longitude: z.number(),
  agentName: z.string().optional(),
})

export async function POST(req: Request) {
  return withApiErrorHandling(
    async () => {
      const body = await req.json()
      const data = CalculateRequestSchema.parse(body)

      logger.info('Calculating Philosopher Stone consciousness', {
        system: 'philosophers-stone',
        operation: 'calculateConsciousness',
        metadata: {
          birthDate: data.birthDate,
          latitude: data.latitude,
          longitude: data.longitude,
          agentName: data.agentName,
        },
      })

      const date = new Date(data.birthDate)

      const consciousness = await swissEphemerisService.calculateConsciousness(
        date,
        data.latitude,
        data.longitude
      )

      return {
        success: true,
        data: {
          ...consciousness,
          agentName: data.agentName,
        },
      }
    },
    {
      system: 'philosophers-stone',
      operation: 'calculateConsciousness',
      severity: 'medium',
    }
  )
}
