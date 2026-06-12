/**
 * Chrome DevTools MCP Configuration for Alchemical Token Stabilization
 *
 * This configuration enables real-time monitoring and stabilization of elemental tokens
 * during astrological transitions. Based on hermetic principles where Spirit + Essence
 * must balance with Matter + Substance, maintaining the sacred equilibrium.
 */
export interface ElementalTokens {
  spirit: number
  essence: number
  matter: number
  substance: number
}
export interface TokenEquilibrium {
  /** Golden ratio aspiration between complementary elemental pairs */
  goldenRatio: number
  /** Natural elemental harmony (no forced mathematical equality) */
  elementalHarmony: number
  /** Traditional planetary rulership influence on elemental health */
  planetaryDignity: number
  /** Overall elemental health score (0-1) */
  overallHealth: number
}
export interface AlchemicalMCPConfig {
  /** Enable real-time token transition monitoring */
  captureTransitions: boolean
  /** Monitor energetic flow through DOM mutations and network requests */
  monitorEnergeticFlow: boolean
  /** Validate hermetic correspondences during calculations */
  validateCorrespondences: boolean
  /** Token stabilization parameters based on planetary dignities */
  tokenStabilization: {
    spirit: {
      min: number
      max: number
      equilibrium: number
    }
    essence: {
      min: number
      max: number
      equilibrium: number
    }
    matter: {
      min: number
      max: number
      equilibrium: number
    }
    substance: {
      min: number
      max: number
      equilibrium: number
    }
  }
  /** Performance monitoring for token calculations */
  performanceThresholds: {
    /** Maximum calculation time in milliseconds (< 100ms target) */
    maxCalculationTime: number
    /** Maximum DOM update time during transitions */
    maxDomUpdateTime: number
    /** Memory usage threshold for token state */
    maxMemoryUsage: number
  }
  /** Planetary transition monitoring */
  planetaryMonitoring: {
    /** Monitor planetary hour changes */
    trackHourChanges: boolean
    /** Capture screenshots during significant aspects */
    captureAspectScreenshots: boolean
    /** Log token fluctuations during retrograde periods */
    logRetrogradeEffects: boolean
    /** Validate lunar phase token behavior */
    validateLunarPhases: boolean
  }
}
/**
 * Default MCP configuration optimized for alchemical stability
 * Based on traditional astrological correspondences and hermetic principles
 */
export declare const defaultAlchemicalMCPConfig: AlchemicalMCPConfig
/**
 * Validate token equilibrium according to traditional elemental derivations
 * Each planet contributes its unique elemental signature based on astrological rulership
 */
export declare function validateTokenEquilibrium(tokens: ElementalTokens): TokenEquilibrium
/**
 * Check if tokens are within stabilization bounds
 */
export declare function isTokenStable(tokens: ElementalTokens, config: AlchemicalMCPConfig): boolean
/**
 * Calculate stabilization adjustment needed for imbalanced tokens
 * Focuses on maintaining healthy ranges for each element based on planetary derivations
 */
export declare function calculateStabilizationAdjustment(
  tokens: ElementalTokens,
  config: AlchemicalMCPConfig
): Partial<ElementalTokens>
