/**
 * Alchemical Emergency Handler for Critical Astrological Events
 *
 * Monitors for powerful aspects, eclipse seasons, and other critical astrological
 * configurations that may cause token imbalances. Implements emergency stabilization
 * protocols based on traditional astrological crisis management.
 *
 * Based on hermetic principles: during times of great change, maintain the
 * equilibrium of elemental health and planetary dignity.
 */
import { logger } from '@/lib/structured-logger'
import {
  defaultAlchemicalMCPConfig,
  validateTokenEquilibrium,
} from '@/testing/alchemical-devtools/mcp-config'
/**
 * Emergency protocols for different astrological crisis scenarios
 * Focus on individual element health rather than forced mathematical balance
 */
const EMERGENCY_PROTOCOLS = [
  {
    id: 'eclipse_essence_stabilization',
    triggerCondition: (tokens, _event) =>
      _event.type === 'eclipse' &&
      _event.severity === 'critical' &&
      tokens.essence < defaultAlchemicalMCPConfig.tokenStabilization.essence.min,
    stabilizationAction: (tokens, _event) => {
      // During eclipses, lunar essence tokens need special protection
      const essenceAdjustment =
        (defaultAlchemicalMCPConfig.tokenStabilization.essence.equilibrium - tokens.essence) * 0.6
      return {
        essence: tokens.essence + essenceAdjustment,
        // Support essence with complementary lunar matter
        matter: tokens.matter + essenceAdjustment * 0.4,
      }
    },
    recoveryTime: 180,
    description:
      'Eclipse essence stabilization protects lunar emotional foundations during solar-lunar conjunctions',
    hermeticPrinciple:
      'As above, so below: Solar eclipses unite celestial opposites - protect lunar essence',
  },
  {
    id: 'grand_cross_elemental_harmonization',
    triggerCondition: (tokens, _event) =>
      _event.type === 'grand_cross' &&
      // Check if any element is severely deficient during cross tension
      Object.values(tokens).some(value => value < 0.3),
    stabilizationAction: (tokens, _event) => {
      // Grand crosses create tension - strengthen deficient elements based on planetary rulership
      const adjustments = {}
      // Spirit deficiency during grand cross - strengthen solar/mercurial influences
      if (tokens.spirit < 0.5) {
        adjustments.spirit = tokens.spirit + 0.3
      }
      // Essence deficiency during grand cross - strengthen lunar/venusian influences
      if (tokens.essence < 0.7) {
        adjustments.essence = tokens.essence + 0.4
      }
      // Matter deficiency during grand cross - strengthen physical planetary influences
      if (tokens.matter < 0.7) {
        adjustments.matter = tokens.matter + 0.4
      }
      // Substance deficiency during grand cross - strengthen mercurial/neptunian foundations
      if (tokens.substance < 0.3) {
        adjustments.substance = tokens.substance + 0.2
      }
      return adjustments
    },
    recoveryTime: 120,
    description: 'Grand cross elemental harmonization strengthens deficient planetary influences',
    hermeticPrinciple: 'Balance through understanding opposition - strengthen planetary rulerships',
  },
  {
    id: 'retrograde_spirit_grounding',
    triggerCondition: (tokens, _event) =>
      event.type === 'retrograde_storm' &&
      tokens.spirit > defaultAlchemicalMCPConfig.tokenStabilization.spirit.max * 0.8,
    stabilizationAction: (tokens, _event) => {
      // During retrograde storms, excessive spirit energy needs grounding
      const spiritReduction =
        (tokens.spirit - defaultAlchemicalMCPConfig.tokenStabilization.spirit.equilibrium) * 0.4
      return {
        spirit: tokens.spirit - spiritReduction,
        // Ground excess spirit in saturnine matter structure
        matter: tokens.matter + spiritReduction * 0.6,
        // Provide mercurial substance foundation
        substance: tokens.substance + spiritReduction * 0.4,
      }
    },
    recoveryTime: 240,
    description:
      'Retrograde spirit grounding stabilizes volatile mental energy through material structure',
    hermeticPrinciple: 'During apparent backward motion, ground spirit in saturnine matter',
  },
  {
    id: 'planetary_station_energy_distribution',
    triggerCondition: (tokens, _event) =>
      event.type === 'planetary_station' &&
      // Check if any element is excessively concentrated
      Object.values(tokens).some(value => value > 2.0),
    stabilizationAction: (tokens, _event) => {
      // Planetary stations concentrate energy - distribute excessive amounts
      const adjustments = {}
      // Reduce excessive spirit concentration (solar/mercurial overload)
      if (tokens.spirit > 2.0) {
        const reduction =
          (tokens.spirit - defaultAlchemicalMCPConfig.tokenStabilization.spirit.equilibrium) * 0.3
        adjustments.spirit = tokens.spirit - reduction
        adjustments.matter = (adjustments.matter || tokens.matter) + reduction * 0.5
        adjustments.substance = (adjustments.substance || tokens.substance) + reduction * 0.5
      }
      // Reduce excessive essence concentration (lunar/venusian overload)
      if (tokens.essence > 2.5) {
        const reduction =
          (tokens.essence - defaultAlchemicalMCPConfig.tokenStabilization.essence.equilibrium) * 0.3
        adjustments.essence = tokens.essence - reduction
        adjustments.spirit = (adjustments.spirit || tokens.spirit) + reduction * 0.4
      }
      return adjustments
    },
    recoveryTime: 90,
    description:
      'Planetary station energy distribution prevents elemental overload from concentrated celestial power',
    hermeticPrinciple:
      'Stationary planets concentrate power - distribute wisely across elemental realms',
  },
  {
    id: 'void_moon_essence_protection',
    triggerCondition: (tokens, _event) =>
      event.type === 'void_moon' &&
      tokens.essence < defaultAlchemicalMCPConfig.tokenStabilization.essence.min,
    stabilizationAction: (tokens, _event) => {
      // Void moon periods require essence preservation without new initiations
      const essenceBoost =
        (defaultAlchemicalMCPConfig.tokenStabilization.essence.equilibrium - tokens.essence) * 0.4
      return {
        essence: tokens.essence + essenceBoost,
        // Support with lunar matter but don't initiate new spirit activities
        matter: tokens.matter + essenceBoost * 0.3,
      }
    },
    recoveryTime: 60,
    description:
      'Void moon essence protection preserves emotional stability during lunar rest periods',
    hermeticPrinciple:
      'In silence, essence finds its natural equilibrium - avoid new spirit initiations',
  },
]
/**
 * Alchemical Emergency Handler Class
 * Monitors astrological events and applies emergency stabilization protocols
 */
export class AlchemicalEmergencyHandler {
  activeEmergencies = new Map()
  eventHistory = []
  monitoringLevel = 'standard'
  /**
   * Assess current astrological situation and determine if emergency protocols are needed
   */
  assessEmergency(tokens, activeEvents) {
    // Early return if no events to process
    if (!activeEvents.length) return null
    // Check for already active emergencies first (optimization)
    const activeProtocolIds = Array.from(this.activeEmergencies.keys())
    const availableProtocols = EMERGENCY_PROTOCOLS.filter(p => !activeProtocolIds.includes(p.id))
    // Check each available protocol against current conditions
    for (const protocol of availableProtocols) {
      for (const event of activeEvents) {
        // Quick pre-check for severity before full condition evaluation
        if (event.severity === 'low') continue
        if (protocol.triggerCondition(tokens, event)) {
          const adjustments = protocol.stabilizationAction(tokens, event)
          const response = {
            triggered: true,
            protocol,
            adjustments,
            recoveryDeadline: new Date(Date.now() + protocol.recoveryTime * 60 * 1000),
            monitoringLevel: this.determineMonitoringLevel(event, tokens),
          }
          // Log emergency activation
          logger.warn('Alchemical emergency protocol activated', {
            operation: 'emergency_handler',
            metadata: {
              protocolId: protocol.id,
              eventType: event.type,
              severity: event.severity,
              adjustments,
              recoveryTime: protocol.recoveryTime,
              hermeticPrinciple: protocol.hermeticPrinciple,
            },
          })
          this.activeEmergencies.set(protocol.id, response)
          this.monitoringLevel = response.monitoringLevel
          return response
        }
      }
    }
    return null
  }
  /**
   * Check if any active emergencies need recovery monitoring
   */
  checkRecoveryStatus() {
    const now = new Date()
    const recovering = []
    const completed = []
    for (const [protocolId, response] of this.activeEmergencies) {
      if (now > response.recoveryDeadline) {
        completed.push(protocolId)
        this.activeEmergencies.delete(protocolId)
        logger.info('Emergency protocol recovery completed', {
          operation: 'emergency_recovery',
          metadata: {
            protocolId,
            duration: response.protocol?.recoveryTime,
          },
        })
      } else {
        recovering.push(response)
      }
    }
    return { recovering, completed }
  }
  /**
   * Apply emergency stabilization adjustments
   */
  applyEmergencyAdjustments(tokens, response) {
    const adjustedTokens = { ...tokens }
    Object.entries(response.adjustments).forEach(([element, adjustment]) => {
      if (adjustment) {
        const elementKey = element
        adjustedTokens[elementKey] = Math.max(0, tokens[elementKey] + adjustment)
        // Ensure bounds are respected
        const config = defaultAlchemicalMCPConfig.tokenStabilization[elementKey]
        adjustedTokens[elementKey] = Math.max(
          config.min,
          Math.min(config.max, adjustedTokens[elementKey])
        )
      }
    })
    // Validate that adjustments improved the situation
    const beforeEquilibrium = validateTokenEquilibrium(tokens)
    const afterEquilibrium = validateTokenEquilibrium(adjustedTokens)
    if (afterEquilibrium.overallHealth > beforeEquilibrium.overallHealth) {
      logger.info('Emergency adjustments improved token equilibrium', {
        operation: 'emergency_adjustment_success',
        metadata: {
          protocolId: response.protocol?.id,
          beforeHealth: beforeEquilibrium.overallHealth,
          afterHealth: afterEquilibrium.overallHealth,
          improvement: beforeEquilibrium.overallHealth - afterEquilibrium.overallHealth,
        },
      })
    } else {
      logger.warn('Emergency adjustments did not improve equilibrium', {
        operation: 'emergency_adjustment_failure',
        metadata: {
          protocolId: response.protocol?.id,
          beforeHealth: beforeEquilibrium.overallHealth,
          afterHealth: afterEquilibrium.overallHealth,
        },
      })
    }
    return adjustedTokens
  }
  /**
   * Get predictive alerts for upcoming critical astrological events
   */
  getPredictiveAlerts(upcomingEvents) {
    return upcomingEvents
      .filter(event => event.severity !== 'low')
      .map(event => ({
        event,
        riskLevel: this.calculateEventRisk(event),
        preparationSteps: this.getPreparationSteps(event),
      }))
      .sort((a, b) => {
        const severityOrder = { low: 0, medium: 1, high: 2, critical: 3 }
        return severityOrder[b.riskLevel] - severityOrder[a.riskLevel]
      })
  }
  /**
   * Comprehensive emergency monitoring and response
   */
  monitorAndRespond(tokens, activeEvents) {
    // Check for active emergency recovery
    this.checkRecoveryStatus()
    // Assess current situation
    const emergency = this.assessEmergency(tokens, activeEvents)
    // Apply emergency adjustments if needed
    const adjustedTokens = emergency ? this.applyEmergencyAdjustments(tokens, emergency) : tokens
    // Get predictive alerts
    const alerts = this.getPredictiveAlerts(activeEvents)
    return {
      emergency,
      adjustedTokens,
      alerts,
    }
  }
  /**
   * Determine monitoring level based on event severity and token stability
   */
  determineMonitoringLevel(event, tokens) {
    const equilibrium = validateTokenEquilibrium(tokens)
    const hasImbalance = equilibrium.overallHealth < 0.7
    if (event.severity === 'critical' || (event.severity === 'high' && hasImbalance)) {
      return 'critical'
    } else if (event.severity === 'high' || (event.severity === 'medium' && hasImbalance)) {
      return 'elevated'
    }
    return 'standard'
  }
  /**
   * Calculate risk level for an astrological event
   */
  calculateEventRisk(event) {
    const severityScore = { low: 1, medium: 2, high: 3, critical: 4 }[event.severity]
    const planetCount = event.planets.length
    const durationHours =
      (event.duration.end.getTime() - event.duration.start.getTime()) / (1000 * 60 * 60)
    // Risk increases with severity, planet involvement, and duration
    const riskScore = severityScore + planetCount * 0.5 + durationHours * 0.1
    if (riskScore >= 5) return 'critical'
    if (riskScore >= 3.5) return 'high'
    if (riskScore >= 2) return 'medium'
    return 'low'
  }
  /**
   * Get preparation steps for an astrological event
   */
  getPreparationSteps(event) {
    const baseSteps = [
      'Monitor token equilibrium closely',
      'Prepare emergency stabilization protocols',
      'Log baseline token values',
    ]
    switch (event.type) {
      case 'eclipse':
        return [
          ...baseSteps,
          'Secure essence token stability during lunar eclipse',
          'Monitor spirit-matter balance during solar eclipse',
          'Prepare for sudden energetic shifts',
        ]
      case 'grand_cross':
        return [
          ...baseSteps,
          'Balance all four elements during cross tensions',
          'Monitor for elemental conflicts',
          'Prepare for rapid stabilization needs',
        ]
      case 'retrograde_storm':
        return [
          ...baseSteps,
          'Ground excess spirit energy in matter',
          'Monitor communication token stability',
          'Prepare for extended volatility period',
        ]
      case 'planetary_station':
        return [
          ...baseSteps,
          'Monitor planet-specific token concentrations',
          'Prepare for energy intensification',
          'Track token flow during stationary period',
        ]
      case 'void_moon':
        return [
          ...baseSteps,
          'Preserve essence token equilibrium',
          'Minimize major energetic changes',
          'Maintain stable token baseline',
        ]
      default:
        return baseSteps
    }
  }
  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    const { recovering } = this.checkRecoveryStatus()
    return {
      level: this.monitoringLevel,
      activeEmergencies: this.activeEmergencies.size,
      recoveryProtocols: recovering.length,
    }
  }
}
/**
 * Singleton emergency handler instance
 */
export const emergencyHandler = new AlchemicalEmergencyHandler()
/**
 * Utility function for quick emergency assessment
 */
export function assessEmergencySituation(tokens, activeEvents) {
  const emergency = emergencyHandler.assessEmergency(tokens, activeEvents)
  return emergency !== null
}
/**
 * Get emergency preparation recommendations
 */
export function getEmergencyPreparation(tokens, upcomingEvents) {
  return emergencyHandler.getPredictiveAlerts(upcomingEvents)
}
//# sourceMappingURL=alchemical-emergency-handler.js.map
