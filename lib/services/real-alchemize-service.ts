import { generateAccurateHoroscope } from '@/lib/monica/horoscope-generator'
import { alchemize } from '@/lib/alchemizer'

export class RealAlchemizeService {
  static async generateHoroscopeAsync(params: {
    date: number
    month: number
    year: number
    hour: number
    minute: number
    latitude: number
    longitude: number
  }) {
    return generateAccurateHoroscope({
      day: params.date,
      month: params.month,
      year: params.year,
      hour: params.hour,
      minute: params.minute,
      latitude: params.latitude,
      longitude: params.longitude,
    })
  }

  static alchemize(birthInfo: Record<string, any>, horoscope: Record<string, any>) {
    return alchemize(birthInfo, horoscope)
  }
}
