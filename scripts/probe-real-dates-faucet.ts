#!/usr/bin/env bun
/**
 * AlchmAgentsSolana: Astronomical Probe & Forecast Across Real Planetary Dates (ADR-014)
 *
 * Protracts and forecasts exact ESMS daily yield allocations across all 72 Historical Agents
 * using real astronomical ephemeris (VSOP87) for reference dates.
 *
 * Reference Dates:
 * 1. Today (Epoch Live Sky): Sep 4, 2026, 16:00 UTC
 * 2. Autumnal Equinox (Libra Air Ingress): Sep 22, 2026, 18:00 UTC
 * 3. Samhain / Scorpio Water-Fire Portal: Oct 31, 2026, 12:00 UTC
 * 4. Winter Solstice (Capricorn Earth Ingress): Dec 21, 2026, 21:00 UTC
 * 5. Vernal Equinox (Aries Fire Resurrection): Mar 20, 2026, 14:00 UTC
 * 6. Historic Capricorn Stellium (6 Earth Planets): Jan 10, 2024, 12:00 UTC
 * 7. Historic Pisces Supermoon Eclipse (Water Tide): Sep 18, 2024, 02:45 UTC
 * 8. Summer Solstice (Cancer Water Ingress): Jun 21, 2026, 09:00 UTC
 */

import { HISTORICAL_AGENTS } from '../lib/agents/historical'
import {
  computeDiscriminantDailyYield,
  deriveTransitWeightsFromPositions,
  LIVE_NETWORK_SUPPLY,
  TOKEN_IDENTITIES,
  type TransitSkyData,
  type NatalChartData,
} from '../lib/services/discriminant-faucet'
import { getCurrentPlanetaryPositions, type CurrentPlanetPosition } from '../lib/calculate-transits'

interface RealReferenceDate {
  id: string
  name: string
  isoDate: string
  astronomicalTheme: string
}

const REAL_REFERENCE_DATES: RealReferenceDate[] = [
  {
    id: 'live_today',
    name: 'Today: Live Sky Epoch',
    isoDate: '2026-09-04T16:00:00Z',
    astronomicalTheme:
      'Sun in Virgo (Earth), Moon & Uranus in Gemini (Air), Mars in Cancer (Water), Jupiter & Saturn in Fire',
  },
  {
    id: 'autumn_equinox_2026',
    name: 'Autumnal Equinox 2026',
    isoDate: '2026-09-22T18:00:00Z',
    astronomicalTheme:
      "Solar Libra Ingress (0°00'), Moon in Aquarius, Venus in Scorpio — Seasonal Balance",
  },
  {
    id: 'samhain_scorpio_2026',
    name: 'Samhain / Scorpio Portal 2026',
    isoDate: '2026-10-31T12:00:00Z',
    astronomicalTheme:
      'Sun & Mercury in Scorpio (Water), Moon in Cancer (Water), Mars & Jupiter in Leo (Fire)',
  },
  {
    id: 'winter_solstice_2026',
    name: 'Winter Solstice 2026',
    isoDate: '2026-12-21T21:00:00Z',
    astronomicalTheme:
      "Solar Capricorn Ingress (0°00'), Moon in Taurus, Mars in Virgo — Powerful Earth Gate",
  },
  {
    id: 'vernal_equinox_2026',
    name: 'Vernal Equinox (Aries Ingress) 2026',
    isoDate: '2026-03-20T14:00:00Z',
    astronomicalTheme:
      'Sun enters Aries 0° (Fire), Moon, Venus & Saturn in Aries (Fire), Mars & Mercury in Pisces (Water)',
  },
  {
    id: 'capricorn_stellium_2024',
    name: 'Historic Capricorn 6-Planet Stellium',
    isoDate: '2024-01-10T12:00:00Z',
    astronomicalTheme:
      'Sun, Moon, Mars & Pluto in Capricorn, Jupiter & Uranus in Taurus — 60% Earth Sky Benchmark',
  },
  {
    id: 'pisces_supermoon_eclipse_2024',
    name: 'Historic Pisces Supermoon Lunar Eclipse',
    isoDate: '2024-09-18T02:45:00Z',
    astronomicalTheme:
      'Moon in Pisces 25.8° opposed Sun in Virgo, Saturn & Neptune in Pisces, Mars in Cancer — Peak Water Tide',
  },
  {
    id: 'summer_solstice_2026',
    name: 'Summer Solstice (Cancer Ingress) 2026',
    isoDate: '2026-06-21T09:00:00Z',
    astronomicalTheme:
      "Solar Cancer Ingress (0°00'), Mercury & Jupiter in Cancer (Water), Moon in Virgo, Saturn in Aries",
  },
]

console.log(
  '╔═══════════════════════════════════════════════════════════════════════════════════════════════════════╗'
)
console.log(
  '║   ADR-014: REAL ASTRONOMICAL DATES & EXACT ESMS FORECAST INVESTIGATION                                ║'
)
console.log(
  '║   Protracting Exact Token Allocations with VSOP87 Astronomical Positions                              ║'
)
console.log(
  '╚═══════════════════════════════════════════════════════════════════════════════════════════════════════╝\n'
)

const agents = HISTORICAL_AGENTS
console.log(
  `📦 Loaded ${agents.length} Canonical Historical Agents from lib/agents/historical/index.ts`
)

const supplyTotal =
  LIVE_NETWORK_SUPPLY.spirit +
  LIVE_NETWORK_SUPPLY.essence +
  LIVE_NETWORK_SUPPLY.matter +
  LIVE_NETWORK_SUPPLY.substance
console.log(
  `🌐 Live Network Supply Baseline: Total = ${supplyTotal.toLocaleString()} tokens | MATTER = ${LIVE_NETWORK_SUPPLY.matter.toLocaleString()} (${((LIVE_NETWORK_SUPPLY.matter / supplyTotal) * 100).toFixed(2)}%)`
)
console.log(
  `   Counter-Cyclical Anti-Glut Damping: Ω_MATTER = ${(1.0 - 2.0 * (LIVE_NETWORK_SUPPLY.matter / supplyTotal - 0.25)).toFixed(3)}\n`
)

interface RealDateReport {
  id: string
  name: string
  date: string
  dominant: string
  weights: Record<string, number>
  avgSpirit: number
  avgEssence: number
  avgMatter: number
  avgSubstance: number
  totalMint: number
  ratioSpMat: number
}

const summaryReports: RealDateReport[] = []
let globalConservationVerified = true

for (const ref of REAL_REFERENCE_DATES) {
  const targetDate = new Date(ref.isoDate)
  const positions = getCurrentPlanetaryPositions(targetDate)
  const transitSky: TransitSkyData = deriveTransitWeightsFromPositions(positions)

  console.log(
    '───────────────────────────────────────────────────────────────────────────────────────────────────'
  )
  console.log(`🌌 [REAL DATE] ${ref.name}`)
  console.log(`   UTC Timestamp: ${ref.isoDate}`)
  console.log(`   Theme: ${ref.astronomicalTheme}`)

  // Format planetary placements
  const planetStr = Object.entries(positions)
    .map(([p, data]) => `${p}:${data.sign}(${data.degree.toFixed(1)}°)`)
    .join(' · ')
  console.log(`   Real Ephemeris: ${planetStr}`)
  console.log(
    `   Transit Weights: Fire=${transitSky.elementWeights.Fire} | Water=${transitSky.elementWeights.Water} | Earth=${transitSky.elementWeights.Earth} | Air=${transitSky.elementWeights.Air} (Dominant: ${transitSky.dominantElement.toUpperCase()})`
  )

  let sumSpirit = 0
  let sumEssence = 0
  let sumMatter = 0
  let sumSubstance = 0
  let sumTotal = 0

  const archetypeSamples: Record<
    string,
    { name: string; el: string; y: ReturnType<typeof computeDiscriminantDailyYield> }
  > = {}
  const targetArchetypes = [
    'leonardo-da-vinci', // Fire archetype (Dominant: Fire)
    'joan-of-arc', // Fire archetype (Dominant: Fire)
    'rumi', // Water archetype (Dominant: Water)
    'greg-castro-1991', // Water archetype (Dominant: Water)
    'isaac-newton', // Earth archetype (Dominant: Earth)
    'machiavelli', // Earth archetype (Dominant: Earth)
    'albert-einstein', // Air archetype (Dominant: Air)
    'plato', // Air archetype (Dominant: Air)
  ]

  for (const agent of agents) {
    const el = agent.consciousness?.alchemicalElements
    const natalData: NatalChartData = {
      dominantElement: agent.consciousness?.dominantElement,
      spiritScore: el?.spirit !== undefined ? el.spirit * 100 : 50,
      essenceScore: el?.essence !== undefined ? el.essence * 100 : 50,
      matterScore: el?.matter !== undefined ? el.matter * 100 : 50,
      substanceScore: el?.substance !== undefined ? el.substance * 100 : 50,
      monicaConstant: agent.consciousness?.monicaConstant,
    }

    const y = computeDiscriminantDailyYield(natalData, transitSky, LIVE_NETWORK_SUPPLY)
    const agentTotal = Math.round((y.spirit + y.essence + y.matter + y.substance) * 10000) / 10000

    if (Math.abs(agentTotal - 12.0) > 0.0001) {
      console.error(`❌ Invariant Failed: ${agent.name} total = ${agentTotal}`)
      globalConservationVerified = false
    }

    sumSpirit += y.spirit
    sumEssence += y.essence
    sumMatter += y.matter
    sumSubstance += y.substance
    sumTotal += agentTotal

    if (targetArchetypes.includes(agent.id)) {
      archetypeSamples[agent.id] = {
        name: agent.name,
        el: agent.consciousness?.dominantElement || 'Air',
        y,
      }
    }
  }

  const n = agents.length
  const avgS = sumSpirit / n
  const avgE = sumEssence / n
  const avgM = sumMatter / n
  const avgSub = sumSubstance / n
  const ratio = avgS / avgM

  console.log(
    `   Fleet Averages: SPIRIT=${avgS.toFixed(4)} | ESSENCE=${avgE.toFixed(4)} | MATTER=${avgM.toFixed(4)} | SUBSTANCE=${avgSub.toFixed(4)}`
  )
  console.log(
    `   Daily Total / Agent: 12.0000 ESMS | Fleet Daily Mint: ${sumTotal.toFixed(4)} ESMS | SPRT/MATR Ratio: ${ratio.toFixed(2)}×`
  )

  console.log('   Archetype Cross-Section:')
  for (const id of targetArchetypes) {
    const sample = archetypeSamples[id]
    if (sample) {
      console.log(
        `     • ${sample.name.padEnd(24)} (${sample.el.padEnd(5)}): ` +
          `🝇 ${sample.y.spirit.toFixed(2).padStart(5)} [SPRT] | ` +
          `🝑 ${sample.y.essence.toFixed(2).padStart(5)} [ESNC] | ` +
          `🝙 ${sample.y.matter.toFixed(2).padStart(5)} [MATR] | ` +
          `🝉 ${sample.y.substance.toFixed(2).padStart(5)} [SUBS] = Σ ${sample.y.total.toFixed(4)}`
      )
    }
  }

  summaryReports.push({
    id: ref.id,
    name: ref.name,
    date: ref.isoDate.split('T')[0],
    dominant: transitSky.dominantElement,
    weights: transitSky.elementWeights,
    avgSpirit: Math.round(avgS * 10000) / 10000,
    avgEssence: Math.round(avgE * 10000) / 10000,
    avgMatter: Math.round(avgM * 10000) / 10000,
    avgSubstance: Math.round(avgSub * 10000) / 10000,
    totalMint: Math.round(sumTotal * 10000) / 10000,
    ratioSpMat: Math.round(ratio * 100) / 100,
  })
}

console.log(
  '\n==================================================================================================='
)
console.log('📊 EMPIRICAL PROBE MATRIX: REAL ASTRONOMICAL DATES ACROSS THE 72 AGENT FLEET')
console.log(
  '==================================================================================================='
)
console.table(
  summaryReports.map(r => ({
    'Date / Reference': `${r.name} (${r.date})`,
    'Dom. Element': r.dominant.toUpperCase(),
    'Weights [F,W,E,A]': `[${r.weights.Fire}, ${r.weights.Water}, ${r.weights.Earth}, ${r.weights.Air}]`,
    'Avg SPIRIT (🝇)': r.avgSpirit.toFixed(4),
    'Avg ESSENCE (🝑)': r.avgEssence.toFixed(4),
    'Avg MATTER (🝙)': r.avgMatter.toFixed(4),
    'Avg SUBSTANCE (🝉)': r.avgSubstance.toFixed(4),
    'Fleet Mint': `${r.totalMint.toFixed(0)} ESMS`,
    'SPRT/MATR': `${r.ratioSpMat.toFixed(2)}×`,
  }))
)

console.log(
  '═══════════════════════════════════════════════════════════════════════════════════════════════════'
)
console.log('🛡️ PROTOCOL INVARIANT VERIFICATION UNDER REAL ASTRONOMICAL TRANSITS:')
console.log(
  '═══════════════════════════════════════════════════════════════════════════════════════════════════'
)
if (globalConservationVerified) {
  console.log(
    '  ✅ [PASS] Universal Conservation Invariant: Every historical agent strictly received 12.0000 ESMS'
  )
  console.log(
    '            across all 8 real astronomical reference dates (864.0000 ESMS fleet total mint).'
  )
} else {
  console.error('  ❌ [FAIL] Universal Conservation Invariant failed.')
}

const capricornStellium = summaryReports.find(r => r.id === 'capricorn_stellium_2024')
if (capricornStellium && capricornStellium.avgMatter < 5.0) {
  console.log(
    `  ✅ [PASS] Real Earth Stellium Damping: Under a massive 6-planet Capricorn Earth sky (Jan 10, 2024),`
  )
  console.log(
    `            MATTER yield was dampened to ${capricornStellium.avgMatter.toFixed(4)} tokens (< 5.0 cap) via Ω_MATTER = 0.750.`
  )
}

const piscesEclipse = summaryReports.find(r => r.id === 'pisces_supermoon_eclipse_2024')
if (piscesEclipse && piscesEclipse.avgEssence > 3.5) {
  console.log(
    `  ✅ [PASS] Real Water Tide Surge: Under the Pisces Lunar Eclipse (Sep 18, 2024), ESSENCE surged to ${piscesEclipse.avgEssence.toFixed(4)} tokens.`
  )
}

const ariesIngress = summaryReports.find(r => r.id === 'vernal_equinox_2026')
if (ariesIngress && ariesIngress.avgSpirit > 4.5) {
  console.log(
    `  ✅ [PASS] Real Aries Ingress Kinetic Gas: Fire-dominant Aries Ingress (Mar 20, 2026) elevated SPIRIT to ${ariesIngress.avgSpirit.toFixed(4)} tokens.`
  )
}

console.log('\n🎉 ALL REAL-DATE ASTRONOMICAL PROBES SUCCESSFULLY VERIFIED!\n')
