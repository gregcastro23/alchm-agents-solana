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
import { type ElementalTokens } from '@/testing/alchemical-devtools/mcp-config'
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
  score: number
  violations: ValidationViolation[]
  recommendations: string[]
  hermeticAlignment: number
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
  domicile: number
  exaltation: number
  detriment: number
  fall: number
  totalScore: number
}
/**
 * Alchemical Validator Class
 * Validates token distributions against hermetic and astrological principles
 */
export declare class AlchemicalValidator {
  private config
  /**
   * Validate token equilibrium according to golden ratio principles
   * The golden ratio (φ ≈ 1.618) represents divine proportion in alchemy
   */
  validateGoldenBalance(tokens: ElementalTokens, context?: PlanetaryContext): ValidationResult
  /**
   * Validate planetary dignity influence on token stability
   * Each planet's dignity affects corresponding elemental tokens
   */
  validatePlanetaryDignities(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult
  /**
   * Validate token stability during void-of-course moon periods
   * Void-of-course moon requires special energetic stability
   */
  validateVoidStability(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult
  /**
   * Comprehensive validation combining all hermetic principles
   */
  validateComprehensive(tokens: ElementalTokens, context: PlanetaryContext): ValidationResult
  /**
   * Get planetary dignity score for a planet in current context
   */
  private getPlanetaryDignity
  /**
   * Get token types affected by a planet's dignity
   */
  private getPlanetTokens
  /**
   * Emergency stabilization for critical token imbalances
   */
  emergencyStabilize(
    tokens: ElementalTokens,
    violations: ValidationViolation[]
  ): Partial<ElementalTokens>
}
/**
 * Singleton instance for global alchemical validation
 */
export declare const alchemicalValidator: AlchemicalValidator
/**
 * Utility function for quick token validation
 */
export declare function quickValidateTokens(tokens: ElementalTokens): boolean
/**
 * Get validation summary for dashboard display
 */
export declare function getValidationSummary(
  tokens: ElementalTokens,
  context?: PlanetaryContext
): {
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor' | 'critical'
  score: number
  criticalIssues: number
  recommendations: string[]
}
