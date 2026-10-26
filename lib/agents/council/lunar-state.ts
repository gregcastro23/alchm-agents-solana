const PHASES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
] as const

/** Phase names describe an eighth of the cycle; exact phase events are timed separately. */
export function buildLunarState(sunLongitude: number, moonLongitude: number, moonSign: string) {
  const elongation = (((moonLongitude - sunLongitude) % 360) + 360) % 360
  return {
    phase: PHASES[Math.round(elongation / 45) % 8],
    elongation,
    illumination: (1 - Math.cos((elongation * Math.PI) / 180)) / 2,
    sign: moonSign,
  }
}
