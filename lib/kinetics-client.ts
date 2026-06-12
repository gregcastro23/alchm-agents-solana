import { backend } from '@/lib/backend'

const CHALDEAN_HOURS = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'] as const

export interface KineticsRequest {
  lat: number
  lon: number
  date?: string
  window?: number
  includeElemental?: boolean
  includePlanetary?: boolean
  validateTraditional?: boolean
}

export interface KineticsResponse {
  timing: {
    planetaryHours: string[]
    seasonalInfluence: string
  }
  elemental?: {
    totals: {
      Fire: number
      Water: number
      Earth: number
      Air: number
    }
  }
  power: Array<{ power: number }>
  elementalVelocity: Array<{ magnitude: number }>
}

function getSeasonalInfluence(date: Date): string {
  const month = date.getUTCMonth()
  if (month >= 2 && month <= 4) return 'Spring'
  if (month >= 5 && month <= 7) return 'Summer'
  if (month >= 8 && month <= 10) return 'Autumn'
  return 'Winter'
}

function parseRequestDate(date?: string): Date {
  if (!date) return new Date()
  const parsed = new Date(date)
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed
}

function toFiniteNumber(value: unknown, fallback = 0): number {
  const num = Number(value)
  return Number.isFinite(num) ? num : fallback
}

export class AlchemicalKineticsClient {
  static async get(request: KineticsRequest): Promise<KineticsResponse> {
    const targetDate = parseRequestDate(request.date)
    const alchm = await backend.alchemy.defaultQuantities(targetDate, request.lat, request.lon)
    const kineticVal = toFiniteNumber(alchm?.kinetic_val, 0.5)
    const thermoVal = toFiniteNumber(alchm?.thermo_val, 0.5)
    const spirit = toFiniteNumber(alchm?.spirit_score)
    const essence = toFiniteNumber(alchm?.essence_score)
    const matter = toFiniteNumber(alchm?.matter_score)
    const substance = toFiniteNumber(alchm?.substance_score)
    const planetaryHour = CHALDEAN_HOURS[targetDate.getUTCHours() % CHALDEAN_HOURS.length]

    return {
      timing: {
        planetaryHours: [planetaryHour],
        seasonalInfluence: getSeasonalInfluence(targetDate),
      },
      elemental: {
        totals: {
          Fire: spirit,
          Water: essence,
          Earth: matter,
          Air: substance,
        },
      },
      power: [{ power: thermoVal }],
      elementalVelocity: [{ magnitude: kineticVal }],
    }
  }

  static async put(request: any): Promise<any> {
    const startTime = new Date(request['start-time'] || request.startTime || new Date())
    const endTime = new Date(request['end-time'] || request.endTime || new Date())
    const intervalMinutes = request['time-interval'] || request.timeInterval || 60
    const lat = request.lat
    const lon = request.lon

    const data: any[] = []
    const current = new Date(startTime)
    while (current <= endTime) {
      const targetDate = new Date(current)
      const alchm = await backend.alchemy.defaultQuantities(targetDate, lat, lon)
      const kineticVal = toFiniteNumber(alchm?.kinetic_val, 0.5)
      const thermoVal = toFiniteNumber(alchm?.thermo_val, 0.5)
      const spirit = toFiniteNumber(alchm?.spirit_score)
      const essence = toFiniteNumber(alchm?.essence_score)
      const matter = toFiniteNumber(alchm?.matter_score)
      const substance = toFiniteNumber(alchm?.substance_score)

      data.push({
        Timestamp: targetDate.toISOString(),
        Total_Spirit: spirit,
        Total_Essence: essence,
        Total_Matter: matter,
        Total_Substance: substance,
        Heat: thermoVal,
        Entropy: kineticVal,
      })

      current.setMinutes(current.getMinutes() + intervalMinutes)
    }

    return {
      ok: true,
      json: async () => ({ data }),
    }
  }
}
