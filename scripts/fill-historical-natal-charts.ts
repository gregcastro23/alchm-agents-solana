import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { generateProfessionalHoroscope } from '../lib/monica/horoscope-generator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const historicalDir = path.resolve(__dirname, '../lib/agents/historical')

// Sign definitions
const signs = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

function calculateNatalChart(birthData: any) {
  const date = new Date(birthData.date)
  let hour = 12
  let minute = 0

  if (birthData.time && birthData.time !== 'unknown') {
    const parts = birthData.time.split(':')
    hour = parseInt(parts[0]) || 12
    minute = parseInt(parts[1]) || 0
  }

  // Handle extreme BCE dates
  let year = date.getFullYear()
  // Adjust year for display/date parsing
  if (isNaN(year)) {
    year = -750 // default fallback for Homer
  }

  const birthInfo = {
    year,
    month: isNaN(date.getMonth()) ? 1 : date.getMonth() + 1,
    day: isNaN(date.getDate()) ? 1 : date.getDate(),
    hour,
    minute,
    latitude: birthData.location.lat || 0,
    longitude: birthData.location.lon || 0,
  }

  const horoscope = generateProfessionalHoroscope(birthInfo)

  const ascSign = horoscope.tropical.Ascendant.Sign.label
  const ascDegree = horoscope.tropical.Ascendant.degrees
  const ascSignIndex = signs.indexOf(ascSign)
  const ascendantAbsolute = (ascSignIndex * 30 + ascDegree) % 360

  // Equal house system
  const houses: Record<string, number> = {}
  for (let h = 1; h <= 12; h++) {
    houses[String(h)] = Math.round(((ascendantAbsolute + (h - 1) * 30) % 360) * 10) / 10
  }

  // Planets
  const planets: Record<string, any> = {}
  horoscope.tropical.CelestialBodies.all.forEach((body: any) => {
    const planetSignIndex = signs.indexOf(body.Sign.label)
    const planetAbsolute = planetSignIndex * 30 + body.degrees

    let houseDiff = (planetAbsolute - ascendantAbsolute + 360) % 360
    let houseNumber = Math.floor(houseDiff / 30) + 1

    planets[body.label] = {
      sign: body.Sign.label,
      degree: Math.round(body.degrees * 10) / 10,
      retrograde: body.retrograde || false,
      house: houseNumber,
    }
  })

  const midheavenAbsolute = (ascendantAbsolute + 270) % 360

  return {
    planets,
    houses: {
      ASC: Math.round(ascendantAbsolute * 10) / 10,
      MC: Math.round(midheavenAbsolute * 10) / 10,
    },
    aspects: [] as any[],
    ascendant: Math.round(ascendantAbsolute * 10) / 10,
    midheaven: Math.round(midheavenAbsolute * 10) / 10,
  }
}

function formatNatalChart(natalChart: any) {
  return `natalChart: {
      planets: {
        Sun: { sign: '${natalChart.planets.Sun.sign}', degree: ${natalChart.planets.Sun.degree}, retrograde: ${natalChart.planets.Sun.retrograde}, house: ${natalChart.planets.Sun.house} },
        Moon: { sign: '${natalChart.planets.Moon.sign}', degree: ${natalChart.planets.Moon.degree}, retrograde: ${natalChart.planets.Moon.retrograde}, house: ${natalChart.planets.Moon.house} },
        Mercury: { sign: '${natalChart.planets.Mercury.sign}', degree: ${natalChart.planets.Mercury.degree}, retrograde: ${natalChart.planets.Mercury.retrograde}, house: ${natalChart.planets.Mercury.house} },
        Venus: { sign: '${natalChart.planets.Venus.sign}', degree: ${natalChart.planets.Venus.degree}, retrograde: ${natalChart.planets.Venus.retrograde}, house: ${natalChart.planets.Venus.house} },
        Mars: { sign: '${natalChart.planets.Mars.sign}', degree: ${natalChart.planets.Mars.degree}, retrograde: ${natalChart.planets.Mars.retrograde}, house: ${natalChart.planets.Mars.house} },
        Jupiter: { sign: '${natalChart.planets.Jupiter.sign}', degree: ${natalChart.planets.Jupiter.degree}, retrograde: ${natalChart.planets.Jupiter.retrograde}, house: ${natalChart.planets.Jupiter.house} },
        Saturn: { sign: '${natalChart.planets.Saturn.sign}', degree: ${natalChart.planets.Saturn.degree}, retrograde: ${natalChart.planets.Saturn.retrograde}, house: ${natalChart.planets.Saturn.house} },
        Uranus: { sign: '${natalChart.planets.Uranus.sign}', degree: ${natalChart.planets.Uranus.degree}, retrograde: ${natalChart.planets.Uranus.retrograde}, house: ${natalChart.planets.Uranus.house} },
        Neptune: { sign: '${natalChart.planets.Neptune.sign}', degree: ${natalChart.planets.Neptune.degree}, retrograde: ${natalChart.planets.Neptune.retrograde}, house: ${natalChart.planets.Neptune.house} },
        Pluto: { sign: '${natalChart.planets.Pluto.sign}', degree: ${natalChart.planets.Pluto.degree}, retrograde: ${natalChart.planets.Pluto.retrograde}, house: ${natalChart.planets.Pluto.house} }
      },
      houses: { ASC: ${natalChart.houses.ASC}, MC: ${natalChart.houses.MC} },
      aspects: [],
      ascendant: ${natalChart.ascendant},
      midheaven: ${natalChart.midheaven}
    }`
}

async function run() {
  console.log('🔮 Scanning for stub historical agents w/ empty natal charts...')

  const files = fs.readdirSync(historicalDir).filter(f => f.endsWith('.ts') && f !== 'index.ts')

  let filledCount = 0

  for (const file of files) {
    const filePath = path.join(historicalDir, file)
    let content = fs.readFileSync(filePath, 'utf-8')

    // Check if it has empty planets
    if (content.includes('planets: {},')) {
      console.log(`✨ Found stub agent: ${file}. Importing and calculating natal chart...`)

      const module = await import(filePath)
      const keys = Object.keys(module)
      const agentKey = keys.find(k => k === k.toUpperCase())

      if (!agentKey) {
        console.warn(`⚠️ No uppercase agent export found in ${file}`)
        continue
      }

      const agent = module[agentKey]
      const birthData = agent.birthData

      const natalChart = calculateNatalChart(birthData)
      const formatted = formatNatalChart(natalChart)

      // Replace in file content
      const replaced = content.replace(
        /natalChart:\s*\{\s*planets:\s*\{\},\s*houses:\s*\{\},\s*aspects:\s*\[\],\s*ascendant:\s*0,\s*midheaven:\s*0,?\s*\}/g,
        formatted
      )

      fs.writeFileSync(filePath, replaced, 'utf-8')
      console.log(`✅ Successfully updated ${file} with high-fidelity natal chart!`)
      filledCount++
    }
  }

  console.log(`\n🎉 Process complete! Successfully filled ${filledCount} empty agent natal charts.`)
}

run().catch(console.error)
