// Inline sunrise/sunset calculation (NOAA simplified algorithm).
// Replaces the `suncalc` package which was never added to package.json.
const SunCalc = {
  getTimes(
    date: Date,
    lat: number,
    lon: number
  ): { sunrise: Date | undefined; sunset: Date | undefined } {
    const toRad = (d: number) => (d * Math.PI) / 180
    const jd = date.getTime() / 86400000 + 2440587.5
    const n = Math.round(jd - 2451545.0 + 0.0008)
    const jStar = n - lon / 360
    const M = (357.5291 + 0.98560028 * jStar) % 360
    const C =
      1.9148 * Math.sin(toRad(M)) + 0.02 * Math.sin(toRad(2 * M)) + 0.0003 * Math.sin(toRad(3 * M))
    const lambda = (M + C + 180 + 102.9372) % 360
    const jTransit =
      2451545.0 + jStar + 0.0053 * Math.sin(toRad(M)) - 0.0069 * Math.sin(toRad(2 * lambda))
    const sinD = Math.sin(toRad(lambda)) * Math.sin(toRad(23.4397))
    const cosD = Math.cos(Math.asin(sinD))
    const cosOmega =
      (Math.sin(toRad(-0.833)) - Math.sin(toRad(lat)) * sinD) / (Math.cos(toRad(lat)) * cosD)
    if (Math.abs(cosOmega) > 1) return { sunrise: undefined, sunset: undefined }
    const omega = (Math.acos(cosOmega) * 180) / Math.PI
    const toDate = (j: number) => new Date((j - 2440587.5) * 86400000)
    return {
      sunrise: toDate(jTransit - omega / 360),
      sunset: toDate(jTransit + omega / 360),
    }
  },
}

export type Planet = 'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn'

const dayNames = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const

const planetaryHours: Record<(typeof dayNames)[number], Planet[]> = {
  Sunday: ['Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars'],
  Monday: ['Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury'],
  Tuesday: ['Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter'],
  Wednesday: ['Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus'],
  Thursday: ['Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon', 'Saturn'],
  Friday: ['Venus', 'Mercury', 'Moon', 'Saturn', 'Jupiter', 'Mars', 'Sun'],
  Saturday: ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon'],
}

const dayRulers: Planet[] = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']

export class PlanetaryHourCalculator {
  private latitude: number
  private longitude: number

  constructor(latitude = 40.7128, longitude = -74.006) {
    this.latitude = latitude
    this.longitude = longitude
  }

  setCoordinates(latitude: number, longitude: number) {
    this.latitude = latitude
    this.longitude = longitude
  }

  getPlanetaryDay(date = new Date()): Planet {
    const dayOfWeek = date.getDay()
    return dayRulers[dayOfWeek]
  }

  getPlanetaryHour(date = new Date()): { planet: Planet; hourNumber: number; isDaytime: boolean } {
    const times = SunCalc.getTimes(
      new Date(date.getFullYear(), date.getMonth(), date.getDate()),
      this.latitude,
      this.longitude
    )
    const sunrise = times.sunrise
    const sunset = times.sunset

    if (!sunrise || !sunset) return this.getFallbackPlanetaryHour(date)

    const isDaytime = date >= sunrise && date <= sunset
    const dayLength = sunset.getTime() - sunrise.getTime()
    const nightLength = sunrise.getTime() + 24 * 60 * 60 * 1000 - sunset.getTime()
    const hourLength = (isDaytime ? dayLength : nightLength) / 12
    const startTime = isDaytime ? sunrise.getTime() : sunset.getTime()
    const timeSinceStart = date.getTime() - startTime
    let hourIndex = Math.floor(timeSinceStart / hourLength)
    if (hourIndex < 0) hourIndex = 0
    if (hourIndex > 11) hourIndex = 11

    const dayOfWeek = date.getDay()
    const dayName = dayNames[dayOfWeek]
    const sequence = planetaryHours[dayName]

    // First hour of daytime is day ruler; nighttime continues sequence
    const baseIndex = 0 // sequence already starts at day ruler
    const hourRulerIndex = (baseIndex + hourIndex) % 7

    return { planet: sequence[hourRulerIndex], hourNumber: hourIndex, isDaytime }
  }

  private getFallbackPlanetaryHour(date: Date): {
    planet: Planet
    hourNumber: number
    isDaytime: boolean
  } {
    const dayOfWeek = date.getDay()
    const dayName = dayNames[dayOfWeek]
    const sequence = planetaryHours[dayName]
    const hour = date.getHours()
    const isDaytime = hour >= 6 && hour < 18
    const hourIndex = isDaytime
      ? Math.floor(((hour - 6) / 12) * 12)
      : Math.floor((((hour < 6 ? hour + 24 : hour) - 18) / 12) * 12)
    const hourRulerIndex = (((hourIndex % 12) % 7) + 7) % 7
    return { planet: sequence[hourRulerIndex], hourNumber: hourIndex, isDaytime }
  }
}

// Sephirotic priority ordering (descending) for response precedence inspiration
// Kether → Chokmah → Binah → Chesed → Gevurah → Tiphereth → Netzach → Hod → Yesod → Malkuth
// Mapped to classical planets: Saturn, Zodiac/Fixed Stars (not used), Saturn (understanding), Jupiter, Mars, Sun, Venus, Mercury, Moon, Earth (Ascendant)
// Practical response order emphasizing traditional spheres: Sun, Saturn, Jupiter, Mars, Venus, Mercury, Moon
export const SEPHIROTIC_PRIORITY: Planet[] = [
  'Sun',
  'Saturn',
  'Jupiter',
  'Mars',
  'Venus',
  'Mercury',
  'Moon',
]
