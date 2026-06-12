import 'server-only'
import { agentRegistry, type AgentDefinition } from './registry'
import { backend } from '@/lib/backend'
import {
  agentKineticProfiles,
  calculateKineticState,
  getAgentKineticProfile,
  calculateKineticCompatibility,
} from './kinetic-profiles'
import { consciousnessPersistence } from '@/lib/consciousness-persistence'

const CHALDEAN_HOURS = ['Saturn', 'Jupiter', 'Mars', 'Sun', 'Venus', 'Mercury', 'Moon']

async function fetchKineticsEnvelope(_lat: number, _lon: number) {
  const alchm = await backend.alchemy.defaultQuantities(new Date(), _lat, _lon)
  const kineticVal = Number(alchm?.kinetic_val ?? 0)
  const thermoVal = Number(alchm?.thermo_val ?? 0)
  const spirit = Number(alchm?.spirit_score ?? 0)
  const essence = Number(alchm?.essence_score ?? 0)
  const matter = Number(alchm?.matter_score ?? 0)
  const substance = Number(alchm?.substance_score ?? 0)
  const planetaryHour = CHALDEAN_HOURS[new Date().getUTCHours() % 7]
  // The alchm backend is ESMS-native: /api/alchemy returns Spirit /
  // Essence / Matter / Substance scores plus a single dominantElement,
  // never Fire/Water/Earth/Air *totals*. That's deliberate — elemental
  // totals aren't part of the canonical data model. We map ESMS →
  // FWEA here as the agreed stand-in (Spirit→Fire, Essence→Water,
  // Matter→Earth, Substance→Air). This is the long-term shape, not a
  // placeholder awaiting a backend endpoint.
  return {
    timing: { planetaryHours: [planetaryHour] },
    elemental: { totals: { Fire: spirit, Water: essence, Earth: matter, Air: substance } },
    power: [{ power: thermoVal }],
    elementalVelocity: [{ magnitude: kineticVal }],
  }
}

export type RouterTask =
  | { kind: 'alchemize'; payload: any }
  | { kind: 'monica_mc'; payload: any }
  | { kind: 'synastry'; payload: any }
  | { kind: 'tarot'; payload: any }
  | { kind: 'temporal_delta'; payload: any }
  | {
      kind: 'kinetics'
      payload: { agentId: string; timeRange?: string; location?: { lat: number; lon: number } }
    }
  | {
      kind: 'consciousness_velocity'
      payload: { agentIds: string[]; location?: { lat: number; lon: number } }
    }
  | {
      kind: 'evolution_rate'
      payload: { agentId: string; interactions: number; location?: { lat: number; lon: number } }
    }
  | {
      kind: 'agent_compatibility'
      payload: { agent1Id: string; agent2Id: string; location?: { lat: number; lon: number } }
    }

export interface RoutedResult<T = any> {
  output: T | null
  agentId: string
  degraded?: boolean
  confidence?: number
  latencyMs?: number
}

export async function routeTask(task: RouterTask): Promise<RoutedResult> {
  const start = Date.now()
  let agent: AgentDefinition | undefined

  switch (task.kind) {
    case 'alchemize':
      agent = agentRegistry.get('alchemizer')
      break
    case 'monica_mc':
      agent = agentRegistry.get('monica_mc')
      break
    case 'synastry':
      agent = agentRegistry.get('synastry')
      break
    case 'tarot':
      agent = agentRegistry.get('tarot')
      break
    case 'temporal_delta':
      agent = agentRegistry.get('temporal_delta')
      break

    // New kinetics task handlers
    case 'kinetics':
      return await handleKineticsTask(task.payload, start)
    case 'consciousness_velocity':
      return await handleConsciousnessVelocityTask(task.payload, start)
    case 'evolution_rate':
      return await handleEvolutionRateTask(task.payload, start)
    case 'agent_compatibility':
      return await handleAgentCompatibilityTask(task.payload, start)

    default:
      agent = agentRegistry.get('router')
  }

  if (!agent || !agent.handler) {
    return {
      output: null,
      agentId: agent?.id || 'router',
      degraded: true,
      latencyMs: Date.now() - start,
    }
  }

  try {
    const output = await agent.handler((task as any).payload)
    return {
      output,
      agentId: agent.id,
      degraded: false,
      confidence: agent.confidenceThreshold || 0.7,
      latencyMs: Date.now() - start,
    }
  } catch (_e) {
    return {
      output: null,
      agentId: agent.id,
      degraded: true,
      confidence: 0.0,
      latencyMs: Date.now() - start,
    }
  }
}

// Kinetics task handlers
async function handleKineticsTask(
  payload: { agentId: string; timeRange?: string; location?: { lat: number; lon: number } },
  start: number
): Promise<RoutedResult> {
  try {
    const { agentId, location = { lat: 37.7749, lon: -122.4194 } } = payload

    const kinetics = await fetchKineticsEnvelope(location.lat, location.lon)

    // Get agent profile from new kinetic profiles
    const profile = agentKineticProfiles[agentId]
    if (!profile) {
      return {
        output: { error: `Kinetic profile not found for agent: ${agentId}` },
        agentId,
        degraded: true,
        latencyMs: Date.now() - start,
      }
    }

    // Calculate current power from actual consciousness evolution data
    let currentPower = 100 // Default starting power
    try {
      // Try to get evolution state for the agent
      const evolutionState = await consciousnessPersistence.loadEvolutionState('anonymous', agentId)
      currentPower = evolutionState?.totalPower || 100
    } catch (error) {
      console.warn('Failed to load evolution state for power calculation, using default:', error)
    }

    // Get planetary influences
    const planetaryInfluences = kinetics.timing?.planetaryHours || ['Sun']

    // Get elemental totals
    const elementalTotals = kinetics.elemental?.totals || { Fire: 5, Water: 5, Air: 5, Earth: 5 }

    // Calculate kinetic state
    const kineticState = calculateKineticState(
      agentId,
      currentPower,
      planetaryInfluences,
      elementalTotals
    )

    return {
      output: {
        agentId,
        currentPower,
        evolutionLevel: kineticState?.evolutionLevel || 'bronze',
        powerMultiplier: kineticState?.powerMultiplier || 1.0,
        alignmentBonus: kineticState?.alignmentBonus || 0,
        nextThreshold: kineticState?.nextThreshold || 100,
        specialAbilitiesUnlocked: kineticState?.specialAbilitiesUnlocked || [],
        elementalResonance: kineticState?.elementalResonance || 0.5,
        planetaryInfluences,
        elementalTotals,
        velocitySignature: profile.velocitySignature,
        evolutionRate: profile.evolutionRate,
        kinetics: {
          power: kinetics.power[kinetics.power.length - 1]?.power || 0.5,
          velocity:
            kinetics.elementalVelocity?.[kinetics.elementalVelocity.length - 1]?.magnitude || 0.5,
        },
      },
      agentId,
      degraded: false,
      confidence: 0.9,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    console.error('Kinetics task error:', error)
    return {
      output: null,
      agentId: payload.agentId || 'kinetics',
      degraded: true,
      confidence: 0.0,
      latencyMs: Date.now() - start,
    }
  }
}

async function handleConsciousnessVelocityTask(
  payload: { agentIds: string[]; location?: { lat: number; lon: number } },
  start: number
): Promise<RoutedResult> {
  try {
    const { agentIds, location = { lat: 37.7749, lon: -122.4194 } } = payload

    const kinetics = await fetchKineticsEnvelope(location.lat, location.lon)

    const agentVelocities = agentIds
      .map(agentId => {
        const profile = getAgentKineticProfile(agentId)
        if (!profile) return null

        const currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
        const baseVelocity = profile.consciousness_rate
        const isOptimal = profile.peak_hours.includes(currentHour)
        const enhancedVelocity = isOptimal ? baseVelocity * 1.2 : baseVelocity

        return {
          agentId,
          baseVelocity,
          enhancedVelocity,
          isOptimal,
          momentumType: profile.momentum_type,
        }
      })
      .filter(Boolean)

    const averageVelocity =
      agentVelocities.reduce((sum, agent) => sum + (agent?.enhancedVelocity || 0), 0) /
      agentVelocities.length

    return {
      output: {
        agentVelocities,
        averageVelocity,
        groupSynergy: calculateGroupSynergy(agentIds),
        optimalAgents: agentVelocities.filter(agent => agent?.isOptimal),
      },
      agentId: 'consciousness_velocity',
      degraded: false,
      confidence: 0.8,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    console.error('Consciousness velocity task error:', error)
    return {
      output: null,
      agentId: 'consciousness_velocity',
      degraded: true,
      confidence: 0.0,
      latencyMs: Date.now() - start,
    }
  }
}

async function handleEvolutionRateTask(
  payload: { agentId: string; interactions: number; location?: { lat: number; lon: number } },
  start: number
): Promise<RoutedResult> {
  try {
    const { agentId, interactions, location = { lat: 37.7749, lon: -122.4194 } } = payload

    const profile = getAgentKineticProfile(agentId)
    if (!profile) {
      throw new Error(`Agent profile not found: ${agentId}`)
    }

    // Calculate evolution rate based on interactions and profile
    const baseRate = profile.consciousness_rate
    const interactionBoost = Math.min(0.3, interactions * 0.01) // Up to 30% boost
    const persistenceModifier = profile.memory_persistence

    const evolutionRate = (baseRate + interactionBoost) * persistenceModifier

    // Determine evolution stage based on interactions
    let evolutionStage: string
    if (interactions < 10) evolutionStage = 'Initial'
    else if (interactions < 50) evolutionStage = 'Developing'
    else if (interactions < 150) evolutionStage = 'Maturing'
    else if (interactions < 300) evolutionStage = 'Advanced'
    else evolutionStage = 'Transcendent'

    return {
      output: {
        agentId,
        evolutionRate,
        evolutionStage,
        baseRate,
        interactionBoost,
        persistenceModifier,
        interactions,
        nextStageThreshold: getNextStageThreshold(interactions),
      },
      agentId,
      degraded: false,
      confidence: 0.85,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    console.error('Evolution rate task error:', error)
    return {
      output: null,
      agentId: payload.agentId || 'evolution_rate',
      degraded: true,
      confidence: 0.0,
      latencyMs: Date.now() - start,
    }
  }
}

async function handleAgentCompatibilityTask(
  payload: { agent1Id: string; agent2Id: string; location?: { lat: number; lon: number } },
  start: number
): Promise<RoutedResult> {
  try {
    const { agent1Id, agent2Id, location = { lat: 37.7749, lon: -122.4194 } } = payload

    const kinetics = await fetchKineticsEnvelope(location.lat, location.lon)

    const compatibility = calculateKineticCompatibility(agent1Id, agent2Id)
    const agent1Profile = getAgentKineticProfile(agent1Id)
    const agent2Profile = getAgentKineticProfile(agent2Id)

    if (!agent1Profile || !agent2Profile) {
      throw new Error(`Agent profile not found: ${!agent1Profile ? agent1Id : agent2Id}`)
    }

    const currentHour = kinetics.timing?.planetaryHours[0] || 'Sun'
    const bothOptimal =
      agent1Profile.peak_hours.includes(currentHour) &&
      agent2Profile.peak_hours.includes(currentHour)
    const enhancedCompatibility = bothOptimal ? compatibility * 1.2 : compatibility

    return {
      output: {
        agent1Id,
        agent2Id,
        baseCompatibility: compatibility,
        enhancedCompatibility,
        bothOptimal,
        currentHour,
        interactionQuality:
          enhancedCompatibility > 0.7
            ? 'Excellent'
            : enhancedCompatibility > 0.5
              ? 'Good'
              : 'Moderate',
        sharedPeakHours: agent1Profile.peak_hours.filter(hour =>
          agent2Profile.peak_hours.includes(hour)
        ),
        momentumSynergy: calculateMomentumSynergy(
          agent1Profile.momentum_type,
          agent2Profile.momentum_type
        ),
      },
      agentId: `${agent1Id}_${agent2Id}`,
      degraded: false,
      confidence: 0.8,
      latencyMs: Date.now() - start,
    }
  } catch (error) {
    console.error('Agent compatibility task error:', error)
    return {
      output: null,
      agentId: 'agent_compatibility',
      degraded: true,
      confidence: 0.0,
      latencyMs: Date.now() - start,
    }
  }
}

// Helper functions
function calculatePowerAlignment(powerAlignment: string, kinetics: any): number {
  const alignmentPlanets = powerAlignment.split('_')
  const currentHours = kinetics.timing?.planetaryHours || []

  let alignment = 0
  alignmentPlanets.forEach(planet => {
    if (currentHours.includes(planet)) {
      alignment += 1
    }
  })

  return alignment / alignmentPlanets.length
}

function calculateGroupSynergy(agentIds: string[]): number {
  if (agentIds.length < 2) return 0

  let totalSynergy = 0
  let pairCount = 0

  for (let i = 0; i < agentIds.length; i++) {
    for (let j = i + 1; j < agentIds.length; j++) {
      totalSynergy += calculateKineticCompatibility(agentIds[i], agentIds[j])
      pairCount++
    }
  }

  return pairCount > 0 ? totalSynergy / pairCount : 0
}

function getNextStageThreshold(currentInteractions: number): number {
  if (currentInteractions < 10) return 10
  if (currentInteractions < 50) return 50
  if (currentInteractions < 150) return 150
  if (currentInteractions < 300) return 300
  return -1 // Already at max
}

function calculateMomentumSynergy(type1: string, type2: string): string {
  if (type1 === type2) return 'Perfect Resonance'
  if (
    (type1 === 'building' && type2 === 'sustained') ||
    (type1 === 'sustained' && type2 === 'building')
  ) {
    return 'Complementary Flow'
  }
  if (
    (type1 === 'explosive' && type2 === 'oscillating') ||
    (type1 === 'oscillating' && type2 === 'explosive')
  ) {
    return 'Dynamic Tension'
  }
  return 'Moderate Synergy'
}
