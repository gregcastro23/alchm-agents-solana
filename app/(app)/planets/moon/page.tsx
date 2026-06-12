import { backend } from '@/lib/backend'
import MoonPlanetClient from './moon-client'

function getPhaseFromDegree(degree: number): string {
  if (degree < 45) return 'New Moon'
  if (degree < 90) return 'Waxing Crescent'
  if (degree < 135) return 'First Quarter'
  if (degree < 180) return 'Waxing Gibbous'
  if (degree < 225) return 'Full Moon'
  if (degree < 270) return 'Waning Gibbous'
  if (degree < 315) return 'Last Quarter'
  return 'Waning Crescent'
}

export default async function MoonPage() {
  let moonPosition: { sign: string; degree: string } | null = null
  let moonPhase = 'Full Moon'
  try {
    const data = await backend.planetary.positions()
    const positions = (data as any)?.planetary_positions || {}
    const moon = positions.Moon
    const sun = positions.Sun
    if (moon) {
      moonPosition = {
        sign: moon.sign || '',
        degree:
          typeof moon.degree === 'number' ? moon.degree.toFixed(2) : String(moon.degree ?? '0'),
      }
      // Compute moon phase from Moon–Sun longitude difference
      const moonDeg = typeof moon.degree === 'number' ? moon.degree : 0
      const sunDeg = typeof sun?.degree === 'number' ? sun.degree : 0
      const phaseDeg = (moonDeg - sunDeg + 360) % 360
      moonPhase = getPhaseFromDegree(phaseDeg)
    }
  } catch {
    // Client renders with defaults when backend is unreachable
  }
  return <MoonPlanetClient initialMoonPosition={moonPosition} initialMoonPhase={moonPhase} />
}
