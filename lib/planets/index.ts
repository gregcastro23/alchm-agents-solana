import { PlanetData } from './types'

import sunData from './sun'
import moonData from './moon'
import mercuryData from './mercury'
import venusData from './venus'
import marsData from './mars'
import jupiterData from './jupiter'
import saturnData from './saturn'
import uranusData from './uranus'
import neptuneData from './neptune'
import plutoData from './pluto'
import ascendantData from './ascendant'

export const planetInfo: Record<string, PlanetData> = {
  Sun: sunData,
  Moon: moonData,
  Mercury: mercuryData,
  Venus: venusData,
  Mars: marsData,
  Jupiter: jupiterData,
  Saturn: saturnData,
  Uranus: uranusData,
  Neptune: neptuneData,
  Pluto: plutoData,
  Ascendant: ascendantData,
}

export * from './types'
export {
  sunData,
  moonData,
  mercuryData,
  venusData,
  marsData,
  jupiterData,
  saturnData,
  uranusData,
  neptuneData,
  plutoData,
  ascendantData,
}

// For backward compatibility
export default planetInfo
