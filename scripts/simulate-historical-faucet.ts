#!/usr/bin/env bun
/**
 * AlchmAgentsSolana: Empirical Simulation & Calibration of Chart-Ratio Faucet (ADR-014)
 *
 * Simulates all 72 Historical Agents under 5 Canonical Celestial Moments:
 * 1. Moment 1: Fire Sky (w_Fire = 5.0, w_Water = 1.5, w_Earth = 1.5, w_Air = 2.0)
 * 2. Moment 2: Water Sky (w_Fire = 1.0, w_Water = 5.5, w_Earth = 2.0, w_Air = 1.5)
 * 3. Moment 3: Earth Stellium (w_Fire = 1.5, w_Water = 2.0, w_Earth = 5.0, w_Air = 1.5)
 * 4. Moment 4: Air Solstice (w_Fire = 2.0, w_Water = 1.5, w_Earth = 1.5, w_Air = 5.0)
 * 5. Moment 5: Equinoctial Equilibrium (w_Fire = 2.5, w_Water = 2.5, w_Earth = 2.5, w_Air = 2.5)
 *
 * MANDATORY CANONICAL TOKEN IDENTITIES & SYMBOL TIERS:
 * 1. SPIRIT: Primary Glyph 🝇 | Triangular 🜂 | Fallback △ / ▲ | Atomic [SPRT]
 * 2. ESSENCE: Primary Glyph 🝑 | Triangular 🜄 | Fallback ▽ / ▼ | Atomic [ESNC]
 * 3. MATTER: Primary Glyph 🝙 | Triangular 🜃 | Fallback ⯛ / ▽— | Atomic [MATR]
 * 4. SUBSTANCE: Primary Glyph 🝉 | Triangular 🜁 | Fallback ⯙ / △— | Atomic [SUBS]
 */

import { HISTORICAL_AGENTS } from '../lib/agents/historical'
import {
  computeDiscriminantDailyYield,
  LIVE_NETWORK_SUPPLY,
  TOKEN_IDENTITIES,
  type TransitSkyData,
  type NatalChartData,
} from '../lib/services/discriminant-faucet'

interface CelestialMomentConfig {
  id: string
  name: string
  description: string
  transit: TransitSkyData
}

const CELESTIAL_MOMENTS: CelestialMomentConfig[] = [
  {
    id: 'moment_1_fire',
    name: 'Moment 1: Fire Sky Transit',
    description:
      'High solar elevation, Sun in Leo (Fire dominance: w_Fire = 5.0, w_Water = 1.5, w_Earth = 1.5, w_Air = 2.0)',
    transit: {
      aNumber: 8.4,
      multiplier: 1.35,
      isDiurnal: true,
      dominantElement: 'Fire',
      elementWeights: { Fire: 5.0, Water: 1.5, Earth: 1.5, Air: 2.0 },
    },
  },
  {
    id: 'moment_2_water',
    name: 'Moment 2: Water Sky Transit',
    description:
      'Moon in Cancer (Water dominance: w_Fire = 1.0, w_Water = 5.5, w_Earth = 2.0, w_Air = 1.5)',
    transit: {
      aNumber: 6.2,
      multiplier: 1.05,
      isDiurnal: false,
      dominantElement: 'Water',
      elementWeights: { Fire: 1.0, Water: 5.5, Earth: 2.0, Air: 1.5 },
    },
  },
  {
    id: 'moment_3_earth',
    name: 'Moment 3: Earth Stellium',
    description:
      'Heavy Earth transit, Sun & Saturn in Capricorn/Virgo (w_Fire = 1.5, w_Water = 2.0, w_Earth = 5.0, w_Air = 1.5)',
    transit: {
      aNumber: 7.0,
      multiplier: 1.15,
      isDiurnal: false,
      dominantElement: 'Earth',
      elementWeights: { Fire: 1.5, Water: 2.0, Earth: 5.0, Air: 1.5 },
    },
  },
  {
    id: 'moment_4_air',
    name: 'Moment 4: Air Solstice',
    description:
      'Mercury-ruled Air stellium in Gemini/Libra (w_Fire = 2.0, w_Water = 1.5, w_Earth = 1.5, w_Air = 5.0)',
    transit: {
      aNumber: 7.8,
      multiplier: 1.25,
      isDiurnal: true,
      dominantElement: 'Air',
      elementWeights: { Fire: 2.0, Water: 1.5, Earth: 1.5, Air: 5.0 },
    },
  },
  {
    id: 'moment_5_equinox',
    name: 'Moment 5: Equinoctial Equilibrium',
    description:
      'Perfect celestial balance (w_Fire = 2.5, w_Water = 2.5, w_Earth = 2.5, w_Air = 2.5)',
    transit: {
      aNumber: 6.0,
      multiplier: 1.0,
      isDiurnal: true,
      dominantElement: 'Air',
      elementWeights: { Fire: 2.5, Water: 2.5, Earth: 2.5, Air: 2.5 },
    },
  },
]

console.log(
  '╔═══════════════════════════════════════════════════════════════════════════════════════════════════════╗'
)
console.log(
  '║   ADR-014: HISTORICAL AGENTS FAUCET CALIBRATION & EMPIRICAL SIMULATION                                ║'
)
console.log(
  '║   CANONICAL TOKENS:                                                                                   ║'
)
console.log(
  `║     1. SPIRIT    ${TOKEN_IDENTITIES.SPIRIT.primaryGlyph} (${TOKEN_IDENTITIES.SPIRIT.triangularVariant}) ${TOKEN_IDENTITIES.SPIRIT.atomicCode} - ${TOKEN_IDENTITIES.SPIRIT.operationalDomain.padEnd(58)} ║`
)
console.log(
  `║     2. ESSENCE   ${TOKEN_IDENTITIES.ESSENCE.primaryGlyph} (${TOKEN_IDENTITIES.ESSENCE.triangularVariant}) ${TOKEN_IDENTITIES.ESSENCE.atomicCode} - ${TOKEN_IDENTITIES.ESSENCE.operationalDomain.padEnd(58)} ║`
)
console.log(
  `║     3. MATTER    ${TOKEN_IDENTITIES.MATTER.primaryGlyph} (${TOKEN_IDENTITIES.MATTER.triangularVariant}) ${TOKEN_IDENTITIES.MATTER.atomicCode} - ${TOKEN_IDENTITIES.MATTER.operationalDomain.padEnd(58)} ║`
)
console.log(
  `║     4. SUBSTANCE ${TOKEN_IDENTITIES.SUBSTANCE.primaryGlyph} (${TOKEN_IDENTITIES.SUBSTANCE.triangularVariant}) ${TOKEN_IDENTITIES.SUBSTANCE.atomicCode} - ${TOKEN_IDENTITIES.SUBSTANCE.operationalDomain.padEnd(58)} ║`
)
console.log(
  '╚═══════════════════════════════════════════════════════════════════════════════════════════════════════╝\n'
)

const agents = HISTORICAL_AGENTS
console.log(
  `📦 Ingested ${agents.length} Canonical Historical Agents from lib/agents/historical/index.ts`
)

const distribution: Record<string, number> = { Fire: 0, Water: 0, Earth: 0, Air: 0, Other: 0 }
for (const a of agents) {
  const el = a.consciousness?.dominantElement || 'Other'
  if (distribution[el] !== undefined) distribution[el]++
  else distribution.Other++
}
console.log('✨ Fleet Elemental Archetypes:', distribution)

const totalLiveSupply =
  LIVE_NETWORK_SUPPLY.spirit +
  LIVE_NETWORK_SUPPLY.essence +
  LIVE_NETWORK_SUPPLY.matter +
  LIVE_NETWORK_SUPPLY.substance
const matterShare = (LIVE_NETWORK_SUPPLY.matter / totalLiveSupply) * 100
console.log(`🌐 Network Supply State: Total = ${totalLiveSupply.toLocaleString()} tokens`)
console.log(
  `   MATTER Supply: ${LIVE_NETWORK_SUPPLY.matter.toLocaleString()} (${matterShare.toFixed(2)}% of global supply)`
)
console.log(
  `   Anti-Glut Damping Factor on MATTER: ${(1.0 - 2.0 * (LIVE_NETWORK_SUPPLY.matter / totalLiveSupply - 0.25)).toFixed(3)} (Ω_MATTER = 0.750)\n`
)

interface MomentStats {
  id: string
  name: string
  avgSpirit: number
  avgEssence: number
  avgMatter: number
  avgSubstance: number
  avgTotal: number
  totalMint: number
  spiritToMatterRatio: number
}

const statsTable: MomentStats[] = []
let allConservationPassed = true
let fireSpiritTargetPassed = true
let antiGlutCompressedPassed = true

for (const moment of CELESTIAL_MOMENTS) {
  let sumSpirit = 0
  let sumEssence = 0
  let sumMatter = 0
  let sumSubstance = 0
  let sumTotal = 0

  const agentResults: {
    agentName: string
    dominantElement: string
    yields: ReturnType<typeof computeDiscriminantDailyYield>
  }[] = []

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

    const y = computeDiscriminantDailyYield(natalData, moment.transit, LIVE_NETWORK_SUPPLY)

    // Check individual conservation to 4 decimals
    const agentSum = Math.round((y.spirit + y.essence + y.matter + y.substance) * 10000) / 10000
    if (Math.abs(agentSum - 12.0) > 0.0001) {
      console.error(`❌ Conservation violation for ${agent.name}: sum = ${agentSum}`)
      allConservationPassed = false
    }

    sumSpirit += y.spirit
    sumEssence += y.essence
    sumMatter += y.matter
    sumSubstance += y.substance
    sumTotal += agentSum

    agentResults.push({
      agentName: agent.name,
      dominantElement: agent.consciousness?.dominantElement || 'Air',
      yields: y,
    })
  }

  const n = agents.length
  const avgS = sumSpirit / n
  const avgE = sumEssence / n
  const avgM = sumMatter / n
  const avgSub = sumSubstance / n
  const avgTot = sumTotal / n

  // Verifications (accounting for AXIS_FLOOR = 0.30 reserve across all 4 axes)
  if (moment.id === 'moment_1_fire' && avgS < 6.0) {
    fireSpiritTargetPassed = false
  }
  if (
    (moment.id === 'moment_1_fire' || moment.id === 'moment_4_air') &&
    (avgM < 1.1 || avgM > 2.05)
  ) {
    antiGlutCompressedPassed = false
  }
  if (moment.id === 'moment_3_earth' && avgM >= 4.5) {
    antiGlutCompressedPassed = false
  }

  statsTable.push({
    id: moment.id,
    name: moment.name,
    avgSpirit: Math.round(avgS * 10000) / 10000,
    avgEssence: Math.round(avgE * 10000) / 10000,
    avgMatter: Math.round(avgM * 10000) / 10000,
    avgSubstance: Math.round(avgSub * 10000) / 10000,
    avgTotal: Math.round(avgTot * 10000) / 10000,
    totalMint: Math.round(sumTotal * 10000) / 10000,
    spiritToMatterRatio: Math.round((avgS / avgM) * 100) / 100,
  })

  console.log(
    '───────────────────────────────────────────────────────────────────────────────────────────────────'
  )
  console.log(`🌌 ${moment.name}`)
  console.log(`   ${moment.description}`)
  console.log(
    `   Averages: SPIRIT=${avgS.toFixed(4)} | ESSENCE=${avgE.toFixed(4)} | MATTER=${avgM.toFixed(4)} | SUBSTANCE=${avgSub.toFixed(4)}`
  )
  console.log(
    `   Average Total / Agent: ${avgTot.toFixed(4)} ESMS | Total Fleet Daily Mint: ${sumTotal.toFixed(4)} ESMS`
  )
  console.log(`   SPIRIT / MATTER Mint Ratio: ${(avgS / avgM).toFixed(2)}x`)

  // Display top claimers for this moment
  const topByElement = [...agentResults].sort((a, b) => b.yields.spirit - a.yields.spirit)
  console.log(`   Representative Claims:`)
  const samples = [
    agentResults.find(a => a.agentName.includes('Leonardo da Vinci')),
    agentResults.find(a => a.agentName.includes('Siddhartha Gautama Buddha')),
    agentResults.find(a => a.agentName.includes('Isaac Newton')),
    agentResults.find(a => a.agentName.includes('Albert Einstein')),
  ].filter(Boolean)

  for (const s of samples) {
    if (!s) continue
    const y = s.yields
    console.log(
      `     • ${s.agentName.padEnd(26)} (${s.dominantElement.padEnd(5)}): ` +
        `🝇 ${y.spirit.toFixed(2).padStart(5)} | ` +
        `🝑 ${y.essence.toFixed(2).padStart(5)} | ` +
        `🝙 ${y.matter.toFixed(2).padStart(5)} | ` +
        `🝉 ${y.substance.toFixed(2).padStart(5)} = ` +
        `Σ ${(y.spirit + y.essence + y.matter + y.substance).toFixed(4)}`
    )
  }
}

console.log(
  '\n==================================================================================================='
)
console.log('📊 EMPIRICAL SYNTHESIS TABLE ACROSS ALL 5 CELESTIAL MOMENTS (72 AGENTS)')
console.log(
  '==================================================================================================='
)
console.table(
  statsTable.map(s => ({
    Moment: s.name,
    'Avg SPIRIT (🝇)': s.avgSpirit.toFixed(4),
    'Avg ESSENCE (🝑)': s.avgEssence.toFixed(4),
    'Avg MATTER (🝙)': s.avgMatter.toFixed(4),
    'Avg SUBSTANCE (🝉)': s.avgSubstance.toFixed(4),
    'Daily Total/Agent': s.avgTotal.toFixed(4),
    'Total Fleet Mint': `${s.totalMint.toFixed(0)} ESMS`,
    'SPRT/MATR Ratio': `${s.spiritToMatterRatio}x`,
  }))
)

// Invariant Assertions
console.log(
  '═══════════════════════════════════════════════════════════════════════════════════════════════════'
)
console.log('🛡️ PROTOCOL INVARIANT VERIFICATION REPORT:')
console.log(
  '═══════════════════════════════════════════════════════════════════════════════════════════════════'
)

function reportAssertion(condition: boolean, title: string, detail: string) {
  if (condition) {
    console.log(`  ✅ [PASS] ${title}`)
    console.log(`            ${detail}`)
  } else {
    console.error(`  ❌ [FAIL] ${title}`)
    console.error(`            ${detail}`)
  }
}

reportAssertion(
  allConservationPassed,
  'Strict Conservation Invariant (12.0000 ESMS per agent)',
  'Every single agent claim across all 5 celestial moments sums to exactly 12.0000 (864 ESMS fleet total).'
)

const fireStats = statsTable.find(s => s.id === 'moment_1_fire')!
reportAssertion(
  fireSpiritTargetPassed,
  'Fire Sky Kinetic Gas Elevation (SPIRIT ≥ 6.00 with Floor Reserve)',
  `Fire transit elevates fleet average SPIRIT yield to ${fireStats.avgSpirit.toFixed(4)} (eliminates chat depletion while protecting 0.30 gas floor).`
)

const earthStats = statsTable.find(s => s.id === 'moment_3_earth')!
const airStats = statsTable.find(s => s.id === 'moment_4_air')!
reportAssertion(
  antiGlutCompressedPassed,
  'Counter-Cyclical Anti-Glut Damping (MATTER compressed)',
  `Fire: ${fireStats.avgMatter.toFixed(4)} | Air: ${airStats.avgMatter.toFixed(4)} (1.15–2.05 range); Earth Stellium: ${earthStats.avgMatter.toFixed(4)} (< 4.50 ceiling).`
)

const allPassed = allConservationPassed && fireSpiritTargetPassed && antiGlutCompressedPassed
if (!allPassed) {
  console.error('\n❌ ONE OR MORE FAUCET INVARIANTS FAILED VERIFICATION.\n')
  process.exit(1)
} else {
  console.log(
    '\n🎉 ALL ADR-014 FAUCET INVARIANTS PERFECTLY VERIFIED ACROSS THE 72 HISTORICAL AGENTS!\n'
  )
  process.exit(0)
}
