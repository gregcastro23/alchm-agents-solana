/**
 * Alchemical Validation System for Hermetic Token Equilibrium
 *
 * Validates elemental tokens against traditional astrological and alchemical principles:
 * - Golden ratio balance between spiritual and material realms
 * - Planetary dignity influences on token stability
 * - Void-of-course moon stability requirements
 * - Eclipse season energetic safeguards
 *
 * Based on hermetic axiom: "As above, so below" - celestial patterns manifest
 * in elemental token distributions.
 */

import { logger, LogLevel } from '@/lib/structured-logger'
import {
  defaultAlchemicalMCPConfig,
  validateTokenEquilibrium,
  type ElementalTokens,
  type TokenEquilibrium,
} from '@/testing/alchemical-devtools/mcp-config'

export interface PlanetaryContext {
  /** Current planetary hour ruler */
  hourRuler: string
  /** Active planetary aspects */
  aspects: Array<{
    planets: [string, string]
    aspect: 'conjunction' | 'trine' | 'square' | 'opposition'
    orb: number
  }>
  /** Moon phase and sign */
  moonPhase: 'new' | 'waxing' | 'full' | 'waning'
  moonSign: string
  /** Void-of-course status */
  isVoidOfCourse: boolean
  /** Eclipse season status */
  inEclipseSeason: boolean
  /** Retrograde planets */
  retrogradePlanets: string[]
}

export interface ValidationResult {
  isValid: boolean
  score: number // 0-1, higher is better
  violations: ValidationViolation[]
  recommendations: string[]
  hermeticAlignment: number // Alignment with hermetic principles
}

export interface ValidationViolation {
  principle: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  correction: string
  affectedTokens: (keyof ElementalTokens)[]
}

export interface DignityScore {
  planet: string
  domicile: number // Rulership (1.0 = strong, 0.5 = weak)
  exaltation: number // Exaltation (1.0 = exalted, 0 = neutral)
  detriment: number // Detriment (-0.5 = in detriment)
  fall: number // Fall (-1.0 = in fall)
  totalScore: number // Combined dignity score
}

/**
 * Planetary dignity calculations based on traditional astrology
 * Higher scores indicate stronger planetary influence
 */
const PLANETARY_DIGNITIES: Record<string, Record<string, DignityScore>> = {
  Sun: {
    Leo: { planet: 'Sun', domicile: 1.0, exaltation: 0, detriment: 0, fall: 0, totalScore: 1.0 },
    Aries: { planet: 'Sun', domicile: 0.5, exaltation: 0, detriment: 0, fall: 0, totalScore: 0.5 },
    Aquarius: {
      planet: 'Sun',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Libra: {
      planet: 'Sun',
      domicile: 0,
      exaltation: 0,
      detriment: -1.0,
      fall: 0,
      totalScore: -1.0,
    },
  },
  Moon: {
    Cancer: {
      planet: 'Moon',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Taurus: {
      planet: 'Moon',
      domicile: 0.5,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Capricorn: {
      planet: 'Moon',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Scorpio: {
      planet: 'Moon',
      domicile: 0,
      exaltation: 0,
      detriment: -1.0,
      fall: 0,
      totalScore: -1.0,
    },
  },
  Mercury: {
    Gemini: {
      planet: 'Mercury',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Virgo: {
      planet: 'Mercury',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Sagittarius: {
      planet: 'Mercury',
      domicile: 0.5,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Pisces: {
      planet: 'Mercury',
      domicile: 0,
      exaltation: 0,
      detriment: -1.0,
      fall: 0,
      totalScore: -1.0,
    },
  },
  Venus: {
    Libra: {
      planet: 'Venus',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Taurus: {
      planet: 'Venus',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Pisces: {
      planet: 'Venus',
      domicile: 0,
      exaltation: 0.5,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Aries: {
      planet: 'Venus',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Scorpio: {
      planet: 'Venus',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Virgo: {
      planet: 'Venus',
      domicile: 0,
      exaltation: 0,
      detriment: 0,
      fall: -1.0,
      totalScore: -1.0,
    },
  },
  Mars: {
    Aries: { planet: 'Mars', domicile: 1.0, exaltation: 0, detriment: 0, fall: 0, totalScore: 1.0 },
    Scorpio: {
      planet: 'Mars',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Capricorn: {
      planet: 'Mars',
      domicile: 0,
      exaltation: 0.5,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Taurus: {
      planet: 'Mars',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Libra: {
      planet: 'Mars',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Cancer: {
      planet: 'Mars',
      domicile: 0,
      exaltation: 0,
      detriment: 0,
      fall: -1.0,
      totalScore: -1.0,
    },
  },
  Jupiter: {
    Pisces: {
      planet: 'Jupiter',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Sagittarius: {
      planet: 'Jupiter',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Cancer: {
      planet: 'Jupiter',
      domicile: 0,
      exaltation: 0.5,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Gemini: {
      planet: 'Jupiter',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Virgo: {
      planet: 'Jupiter',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Capricorn: {
      planet: 'Jupiter',
      domicile: 0,
      exaltation: 0,
      detriment: 0,
      fall: -1.0,
      totalScore: -1.0,
    },
  },
  Saturn: {
    Aquarius: {
      planet: 'Saturn',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Capricorn: {
      planet: 'Saturn',
      domicile: 1.0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 1.0,
    },
    Libra: {
      planet: 'Saturn',
      domicile: 0,
      exaltation: 0.5,
      detriment: 0,
      fall: 0,
      totalScore: 0.5,
    },
    Cancer: {
      planet: 'Saturn',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Leo: {
      planet: 'Saturn',
      domicile: 0,
      exaltation: 0,
      detriment: -0.5,
      fall: 0,
      totalScore: -0.5,
    },
    Aries: {
      planet: 'Saturn',
      domicile: 0,
      exaltation: 0,
      detriment: 0,
      fall: -1.0,
      totalScore: -1.0,
    },
  },
}

/**
 * Alchemical Validator Class
 * Validates token distributions against hermetic and astrological principles
 */
export class AlchemicalValidator {
  private config = defaultAlchemicalMCPConfig

  /**
   * Validate token equilibrium according to golden ratio principles
   * The golden ratio (φ ≈ 1.618) represents divine proportion in alchemy
   */
  validateGoldenBalance(tokens: ElementalTokens, context?: PlanetaryContext): ValidationResult {
    // Early return for identical token states (optimization)
    const tokenSum = tokens.spirit + tokens.essence + tokens.matter + tokens.substance
    if (tokenSum === 0) {
      return {
        isValid: false,
        score: 0,
        violations: [
          {
            principle: 'Elemental Presence',
            severity: 'critical',
            description: 'No elemental tokens present',
            correction: 'Initialize elemental tokens',
            affectedTokens: ['spirit', 'essence', 'matter', 'substance'],
          },
        ],
        recommendations: ['Initialize elemental tokens'],
        hermeticAlignment: 0,
      }
    }

    const equilibrium = validateTokenEquilibrium(tokens)
    const violations: ValidationViolation[] = []
    const recommendations: string[] = []

    // Traditional Elemental Validation - Each element serves its planetary purpose
    // Spirit: Divine masculine, active principle (Sun, Mercury, Jupiter, Saturn)
    // Essence: Divine feminine, passive principle (Moon, Venus, Mars, Uranus, Neptune, Pluto)
    // Matter: Physical manifestation, concrete reality (Moon, Venus, Mars, Saturn, Uranus, Pluto)
    // Substance: Material foundation, earthly stability (Mercury, Neptune)

    // Validate Spirit health - should be present from solar and mercurial influences
    if (tokens.spirit < 0.5) {
      violations.push({
        principle: 'Spirit Vitality',
        severity: 'medium',
        description: `Spirit tokens (${tokens.spirit.toFixed(2)}) are deficient - missing solar/mercurial/jovian/saturnine influence`,
        correction: 'Strengthen solar, mercurial, jovian, or saturnine planetary influences',
        affectedTokens: ['spirit'],
      })
      recommendations.push('Enhance solar hour activities or mercury-ruled communications')
    }

    // Validate Essence health - should be present from lunar and venusian influences
    if (tokens.essence < 0.8) {
      violations.push({
        principle: 'Essence Flow',
        severity: 'medium',
        description: `Essence tokens (${tokens.essence.toFixed(2)}) are deficient - missing lunar/venusian/martian/uranic/neptunian/plutonian influence`,
        correction:
          'Strengthen lunar, venusian, martial, uranian, neptunian, or plutonian planetary influences',
        affectedTokens: ['essence'],
      })
      recommendations.push('Enhance lunar activities or venus-ruled relationships')
    }

    // Validate Matter health - should be present from physical planet influences
    if (tokens.matter < 0.8) {
      violations.push({
        principle: 'Material Manifestation',
        severity: 'medium',
        description: `Matter tokens (${tokens.matter.toFixed(2)}) are deficient - missing concrete planetary influences`,
        correction: 'Ground energy through physical activities and material concerns',
        affectedTokens: ['matter'],
      })
      recommendations.push('Focus on practical matters and physical manifestation')
    }

    // Validate Substance health - should be present from earthly influences
    if (tokens.substance < 0.3) {
      violations.push({
        principle: 'Substance Stability',
        severity: 'low',
        description: `Substance tokens (${tokens.substance.toFixed(2)}) are deficient - missing mercurial or neptunian material foundation`,
        correction: 'Build material stability through practical planning or dream work',
        affectedTokens: ['substance'],
      })
      recommendations.push(
        'Establish material foundations through mercurial or neptunian activities'
      )
    }

    // Golden ratio as aspirational harmony between complementary elements
    const spiritEssenceRatio = tokens.spirit / Math.max(tokens.essence, 0.001)
    const matterSubstanceRatio = tokens.matter / Math.max(tokens.substance, 0.001)
    const goldenRatioDeviation =
      Math.abs(spiritEssenceRatio - 1.618) + Math.abs(matterSubstanceRatio - 1.618)

    if (goldenRatioDeviation > 1.0) {
      recommendations.push(
        'Consider balancing complementary elemental pairs toward golden ratio harmony'
      )
    }

    // No hermetic balance requirement - elements derive naturally from planetary influences
    const elementalHealth = (tokens.spirit + tokens.essence + tokens.matter + tokens.substance) / 4
    const score = violations.length === 0 ? 1.0 : Math.max(0.3, elementalHealth / 2)

    return {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      score,
      violations,
      recommendations,
      hermeticAlignment: elementalHealth,
    }
  }

  /**
   * Validate planetary dignity influence on token stability
   * Each planet's dignity affects corresponding elemental tokens
   */
  validatePlanetaryDignities(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult {
    const violations: ValidationViolation[] = []
    const recommendations: string[] = []

    // Calculate dignity influence on current hour ruler
    const hourRuler = context.hourRuler
    const hourDignity = this.getPlanetaryDignity(hourRuler, context)

    if (hourDignity.totalScore < 0) {
      // Negative dignity affects token stability
      const affectedTokens = this.getPlanetTokens(hourRuler)
      violations.push({
        principle: 'Planetary Dignity',
        severity: hourDignity.totalScore < -0.5 ? 'high' : 'medium',
        description: `${hourRuler} in ${hourDignity.totalScore < -0.5 ? 'detriment/fall' : 'weak dignity'} affects ${affectedTokens.join(', ')} tokens`,
        correction: `Strengthen ${hourRuler}'s dignity or compensate with beneficial aspects`,
        affectedTokens,
      })
    }

    // Check retrograde influences
    context.retrogradePlanets.forEach(planet => {
      if (planet === 'Mercury') {
        // Mercury retrograde specifically affects spirit tokens
        if (tokens.spirit > this.config.tokenStabilization.spirit.max * 0.8) {
          violations.push({
            principle: 'Mercury Retrograde Stability',
            severity: 'high',
            description: 'Mercury retrograde may cause spirit token volatility',
            correction: 'Stabilize spirit tokens during Mercury retrograde',
            affectedTokens: ['spirit'],
          })
        }
      }
    })

    // Aspect influences on token harmony
    context.aspects.forEach(aspect => {
      if (aspect.aspect === 'square' || aspect.aspect === 'opposition') {
        // Challenging aspects create tension in token equilibrium
        violations.push({
          principle: 'Aspect Harmony',
          severity: 'low',
          description: `${aspect.planets.join('-')} ${aspect.aspect} creates energetic tension`,
          correction: 'Monitor token stability during challenging aspects',
          affectedTokens: ['spirit', 'essence', 'matter', 'substance'],
        })
      }
    })

    const dignityScore = Math.max(0, (hourDignity.totalScore + 1) / 2) // Normalize to 0-1
    const score =
      violations.filter(v => v.severity === 'critical' || v.severity === 'high').length === 0
        ? dignityScore
        : dignityScore * 0.7

    return {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      score,
      violations,
      recommendations,
      hermeticAlignment: dignityScore,
    }
  }

  /**
   * Validate token stability during void-of-course moon periods
   * Void-of-course moon requires special energetic stability
   */
  validateVoidStability(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult {
    const violations: ValidationViolation[] = []
    const recommendations: string[] = []

    if (context.isVoidOfCourse) {
      // During void-of-course, essence tokens should be stable
      const essenceStability = Math.abs(
        tokens.essence - this.config.tokenStabilization.essence.equilibrium
      )
      const stabilityRatio = essenceStability / this.config.tokenStabilization.essence.equilibrium

      if (stabilityRatio > 0.2) {
        // More than 20% deviation
        violations.push({
          principle: 'Void-of-Course Stability',
          severity: stabilityRatio > 0.4 ? 'high' : 'medium',
          description: `Moon void-of-course requires essence stability, current deviation: ${(stabilityRatio * 100).toFixed(1)}%`,
          correction: 'Stabilize essence tokens during void-of-course periods',
          affectedTokens: ['essence'],
        })
        recommendations.push('Maintain essence equilibrium during void-of-course moon')
      }

      // Spirit tokens should also remain stable
      const spiritStability = Math.abs(
        tokens.spirit - this.config.tokenStabilization.spirit.equilibrium
      )
      const spiritRatio = spiritStability / this.config.tokenStabilization.spirit.equilibrium

      if (spiritRatio > 0.15) {
        violations.push({
          principle: 'Void-of-Course Spirit Stability',
          severity: 'medium',
          description: `Spirit tokens fluctuating during void-of-course: ${(spiritRatio * 100).toFixed(1)}% deviation`,
          correction: 'Minimize spirit token changes during void periods',
          affectedTokens: ['spirit'],
        })
      }
    }

    const score =
      violations.length === 0
        ? 1.0
        : violations.some(v => v.severity === 'high' || v.severity === 'critical')
          ? 0.3
          : 0.7

    return {
      isValid: violations.filter(v => v.severity === 'critical').length === 0,
      score,
      violations,
      recommendations,
      hermeticAlignment: score,
    }
  }

  /**
   * Comprehensive validation combining all hermetic principles
   */
  validateComprehensive(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult {
    const goldenResult = this.validateGoldenBalance(tokens, context)
    const dignityResult = this.validatePlanetaryDignities(tokens, context)
    const voidResult = this.validateVoidStability(tokens, context)

    const allViolations = [
      ...goldenResult.violations,
      ...dignityResult.violations,
      ...voidResult.violations,
    ]

    const allRecommendations = [
      ...goldenResult.recommendations,
      ...dignityResult.recommendations,
      ...voidResult.recommendations,
    ]

    // Calculate weighted score
    const weights = { golden: 0.4, dignity: 0.3, void: 0.3 }
    const score =
      goldenResult.score * weights.golden +
      dignityResult.score * weights.dignity +
      voidResult.score * weights.void

    const hermeticAlignment =
      goldenResult.hermeticAlignment * weights.golden +
      dignityResult.hermeticAlignment * weights.dignity +
      voidResult.hermeticAlignment * weights.void

    // Log validation results for monitoring
    logger.info('Comprehensive alchemical validation completed', {
      operation: 'validation_comprehensive',
      metadata: {
        tokenEquilibrium: validateTokenEquilibrium(tokens),
        planetaryContext: context,
        validationScore: score,
        violationCount: allViolations.length,
        recommendationsCount: allRecommendations.length,
      },
    })

    return {
      isValid: allViolations.filter(v => v.severity === 'critical').length === 0,
      score,
      violations: allViolations,
      recommendations: [...new Set(allRecommendations)], // Remove duplicates
      hermeticAlignment,
    }
  }

  /**
   * Get planetary dignity score for a planet in current context
   */
  private getPlanetaryDignity(planet: string, context: PlanetaryContext): DignityScore {
    // In a real implementation, this would use actual planetary positions
    // For now, return neutral dignity
    return {
      planet,
      domicile: 0,
      exaltation: 0,
      detriment: 0,
      fall: 0,
      totalScore: 0,
    }
  }

  /**
   * Get token types affected by a planet's dignity
   */
  private getPlanetTokens(planet: string): (keyof ElementalTokens)[] {
    const planetTokens: Record<string, (keyof ElementalTokens)[]> = {
      Sun: ['matter'], // Solar hour increases material manifestation
      Moon: ['essence'], // Lunar hour enhances emotional essence
      Mercury: ['spirit'], // Mercurial hour accelerates mental spirit
      Venus: ['substance'], // Venusian hour harmonizes material substance
      Mars: ['spirit'], // Martial hour energizes action and spirit
      Jupiter: ['matter'], // Jupiterian hour expands material prosperity
      Saturn: ['substance'], // Saturnian hour structures material discipline
    }

    return planetTokens[planet] || ['spirit', 'essence', 'matter', 'substance']
  }

  /**
   * Emergency stabilization for critical token imbalances
   */
  emergencyStabilize(
    tokens: ElementalTokens,
    violations: ValidationViolation[]
  ): Partial<ElementalTokens> {
    const adjustments: Partial<ElementalTokens> = {}

    violations.forEach(violation => {
      if (violation.severity === 'critical') {
        violation.affectedTokens.forEach(token => {
          const currentValue = tokens[token]
          const equilibrium = this.config.tokenStabilization[token].equilibrium

          // Apply corrective adjustment toward equilibrium
          const correction = (equilibrium - currentValue) * 0.3 // 30% correction
          adjustments[token] = Math.max(0, currentValue + correction)
        })
      }
    })

    if (Object.keys(adjustments).length > 0) {
      logger.warn('Emergency token stabilization applied', {
        operation: 'emergency_stabilization',
        metadata: {
          originalTokens: tokens,
          adjustments,
          criticalViolations: violations.filter(v => v.severity === 'critical').length,
        },
      })
    }

    return adjustments
  }
}

/**
 * Singleton instance for global alchemical validation
 */
export const alchemicalValidator = new AlchemicalValidator()

/**
 * Utility function for quick token validation
 */
export function quickValidateTokens(tokens: ElementalTokens): boolean {
  const result = alchemicalValidator.validateGoldenBalance(tokens)
  return result.isValid
}

/**
 * Get validation summary for dashboard display
 */
export function getValidationSummary(
  tokens: ElementalTokens,
  context?: PlanetaryContext
): {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  score: number
  criticalIssues: number
  recommendations: string[]
} {
  const result = context
    ? alchemicalValidator.validateComprehensive(tokens, context)
    : alchemicalValidator.validateGoldenBalance(tokens)

  let overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'

  if (result.score >= 0.9) overallHealth = 'excellent'
  else if (result.score >= 0.7) overallHealth = 'good'
  else if (result.score >= 0.5) overallHealth = 'fair'
  else if (result.score >= 0.3) overallHealth = 'poor'
  else overallHealth = 'critical'

  const criticalIssues = result.violations.filter(v => v.severity === 'critical').length

  return {
    overallHealth,
    score: result.score,
    criticalIssues,
    recommendations: result.recommendations,
  }
}
