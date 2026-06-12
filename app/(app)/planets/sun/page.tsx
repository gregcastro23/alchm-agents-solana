import { backend } from '@/lib/backend'
import SunPlanetClient from './sun-client'

export default async function SunPage() {
  let sunPosition: { sign: string; degree: string } | null = null
  try {
    const data = await backend.planetary.positions()
    const sun = (data as any)?.planetary_positions?.Sun
    if (sun) {
      sunPosition = {
        sign: sun.sign || '',
        degree: typeof sun.degree === 'number' ? sun.degree.toFixed(2) : String(sun.degree ?? '0'),
      }
    }
  } catch {
    // Client renders with static fallback when backend is unreachable
  }
  return <SunPlanetClient initialSunPosition={sunPosition} />
}
