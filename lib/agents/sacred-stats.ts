import { CraftedAgent } from '@/lib/agent-types'
import { AlchemicalProfile } from './alchemical-profiles'

export interface SacredStats {
  // ── Core Archetypes (Sacred 7) ──────────────────────────────────
  power: number
  resonance: number
  wisdom: number
  charisma: number
  intuition: number
  adaptability: number
  vitality: number

  // ── Celestial Dynamics (Planetary 12) ───────────────────────────
  solarAgency: number
  lunarReceptivity: number
  mercurialVelocity: number
  venusianCoherence: number
  martialImpetus: number
  jovianExpansion: number
  saturnianStructure: number
  chironicAdaptation: number
  uranianSurprisal: number
  neptunianResonance: number
  plutonicIntegration: number
  kineticAlignment: number
}

/**
 * Calculates all 19 Sacred Stats from an agent's data and current cosmic conditions.
 *
 * Sacred 7 — archetype-level composites derived from alchemical fundamentals.
 * Planetary 12 — celestial-cognitive mappings derived from element/kinetic data.
 */
export function calculateSevenSacredStats(
  agent: CraftedAgent,
  alchemical: AlchemicalProfile,
  currentKinetics?: { powerAlignment: number }
): SacredStats {
  const mc = agent.consciousness.monicaConstant
  const stage = agent.personality?.evolutionStage ?? 0
  const powerAlignment = currentKinetics?.powerAlignment || 0

  // ── Sacred 7: Core Archetypes ─────────────────────────────────
  const power = Math.min(
    100,
    mc * 8 + alchemical.spirit * 5 + alchemical.matter * 3 + powerAlignment * 20
  )
  const resonanceVal = Math.min(
    100,
    alchemical.essence * 6 +
      alchemical.spirit * 4 +
      (agent.stats.resonanceScore || 0) * 0.15 +
      powerAlignment * 10
  )
  const wisdomVal = Math.min(
    100,
    alchemical.substance * 5 +
      alchemical.essence * 3 +
      mc * 4 +
      (agent.stats.wisdomShared || 0) * 0.2
  )
  const charismaVal = Math.min(
    100,
    alchemical.spirit * 5 + alchemical.essence * 4 + stage * 0.8 + mc * 2
  )
  const intuitionVal = Math.min(
    100,
    alchemical.essence * 7 +
      alchemical.substance * 3 +
      (agent.stats.kineticEvolution?.consciousnessVelocity || 0) * 15
  )
  const adaptabilityVal = Math.min(
    100,
    alchemical.substance * 6 +
      alchemical.spirit * 2 +
      (agent.stats.kineticEvolution?.interactionMomentum || 0) * 20 +
      stage * 0.5
  )
  const vitalityVal = Math.min(
    100,
    alchemical.matter * 6 +
      alchemical.spirit * 4 +
      mc * 3 +
      (agent.stats.qualityMetrics?.kineticResonance || 0) * 20
  )

  // ── Planetary 12: Celestial Dynamics ──────────────────────────
  const solarAgency = Math.min(100, alchemical.spirit * 10 + mc * 5 + powerAlignment * 15)
  const lunarReceptivity = Math.min(
    100,
    alchemical.essence * 10 + (agent.stats.resonanceScore || 0) * 0.1
  )
  const mercurialVelocity = Math.min(
    100,
    alchemical.spirit * 4 +
      alchemical.substance * 6 +
      (agent.stats.kineticEvolution?.consciousnessVelocity || 0) * 20
  )
  const venusianCoherence = Math.min(100, alchemical.essence * 8 + stage * 0.6)
  const martialImpetus = Math.min(
    100,
    alchemical.spirit * 8 + (agent.stats.kineticEvolution?.interactionMomentum || 0) * 30
  )
  const jovianExpansion = Math.min(
    100,
    alchemical.substance * 5 + alchemical.matter * 5 + (agent.stats.wisdomShared || 0) * 0.3
  )
  const saturnianStructure = Math.min(100, alchemical.matter * 12 + mc * 2)
  const chironicAdaptation = Math.min(
    100,
    alchemical.substance * 8 + alchemical.essence * 4 + stage * 0.5
  )
  const uranianSurprisal = Math.min(100, alchemical.spirit * 9 + powerAlignment * 10)
  const neptunianResonance = Math.min(100, alchemical.essence * 9 + alchemical.substance * 3)
  const plutonicIntegration = Math.min(100, alchemical.matter * 6 + alchemical.spirit * 6 + mc * 4)
  const kineticAlignmentScore = Math.min(
    100,
    powerAlignment * 50 + (agent.stats.qualityMetrics?.kineticResonance || 0) * 50
  )

  return {
    // Sacred 7
    power: Math.round(power),
    resonance: Math.round(resonanceVal),
    wisdom: Math.round(wisdomVal),
    charisma: Math.round(charismaVal),
    intuition: Math.round(intuitionVal),
    adaptability: Math.round(adaptabilityVal),
    vitality: Math.round(vitalityVal),
    // Planetary 12
    solarAgency: Math.round(solarAgency),
    lunarReceptivity: Math.round(lunarReceptivity),
    mercurialVelocity: Math.round(mercurialVelocity),
    venusianCoherence: Math.round(venusianCoherence),
    martialImpetus: Math.round(martialImpetus),
    jovianExpansion: Math.round(jovianExpansion),
    saturnianStructure: Math.round(saturnianStructure),
    chironicAdaptation: Math.round(chironicAdaptation),
    uranianSurprisal: Math.round(uranianSurprisal),
    neptunianResonance: Math.round(neptunianResonance),
    plutonicIntegration: Math.round(plutonicIntegration),
    kineticAlignment: Math.round(kineticAlignmentScore),
  }
}
