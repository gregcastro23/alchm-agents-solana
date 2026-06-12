/**
 * Elemental Reinforcement System
 * =============================
 * Implements workspace-compliant elemental logic where same elements reinforce each other.
 * No "opposing" element mechanics - all elements can work together harmoniously.
 * Fire + Fire = enhanced creativity, Water + Water = deeper intuition, etc.
 */

export interface ElementVector {
  Fire: number
  Water: number
  Air: number
  Earth: number
}

export interface ReinforcementAnalysis {
  dominantElement: string
  reinforcementMultiplier: number
  elementalHarmony: number // 0-1 scale of how well elements work together
  combinationEffects: {
    element: string
    strength: number
    description: string
  }[]
  resonancePatterns: {
    pattern: string
    intensity: number
    meaning: string
  }[]
}

export interface ElementalCompatibility {
  element1: string
  element2: string
  compatibility: number // 0-1 scale
  synergy: string
  combinedEffect: string
}

/**
 * Calculate elemental reinforcement score with same-element boosting
 */
export function calculateElementalReinforcementScore(
  elements: ElementVector[],
  baseScore: number
): number {
  if (elements.length === 0) return baseScore

  // Calculate total elemental strength for each element
  const totalElements = elements.reduce(
    (acc, element) => ({
      Fire: acc.Fire + element.Fire,
      Water: acc.Water + element.Water,
      Air: acc.Air + element.Air,
      Earth: acc.Earth + element.Earth,
    }),
    { Fire: 0, Water: 0, Air: 0, Earth: 0 }
  )

  // Find the strongest element
  const elementStrengths = Object.entries(totalElements)
  const [dominantElement, maxStrength] = elementStrengths.reduce(
    (max, [element, strength]) => (strength > max[1] ? [element, strength] : max),
    ['Fire', -1]
  )

  // Calculate reinforcement based on elemental dominance and harmony
  let reinforcementMultiplier = 1.0

  // Same elements reinforce each other strongly
  const reinforcementBonus = Math.min(maxStrength * 0.15, 0.5) // Max 50% boost

  // Check for elemental harmony (multiple strong elements working together)
  const strongElements = elementStrengths.filter(([, strength]) => strength > 0.3).length
  const harmonyBonus = strongElements > 1 ? 0.1 : 0 // Bonus for elemental cooperation

  reinforcementMultiplier = 1.0 + reinforcementBonus + harmonyBonus

  return baseScore * reinforcementMultiplier
}

/**
 * Get elemental compatibility between two elements (no opposition mechanics)
 */
export function getElementalCompatibility(
  element1: string,
  element2: string
): ElementalCompatibility {
  // Same element has highest compatibility (perfect reinforcement)
  if (element1 === element2) {
    return {
      element1,
      element2,
      compatibility: 0.95, // Nearly perfect
      synergy: 'Perfect Reinforcement',
      combinedEffect: `Enhanced ${element1.toLowerCase()} manifestation with doubled intensity`,
    }
  }

  // Define complementary relationships (all positive)
  const compatibilityMap: Record<
    string,
    Record<string, { compatibility: number; synergy: string; effect: string }>
  > = {
    Fire: {
      Water: {
        compatibility: 0.85,
        synergy: 'Creative Flow',
        effect: 'Passionate intuition and inspired emotion',
      },
      Air: {
        compatibility: 0.9,
        synergy: 'Brilliant Innovation',
        effect: 'Intellectual fire and communicative inspiration',
      },
      Earth: {
        compatibility: 0.8,
        synergy: 'Practical Creativity',
        effect: 'Grounded manifestation of creative vision',
      },
    },
    Water: {
      Fire: {
        compatibility: 0.85,
        synergy: 'Creative Flow',
        effect: 'Passionate intuition and inspired emotion',
      },
      Air: {
        compatibility: 0.75,
        synergy: 'Flowing Communication',
        effect: 'Emotional intelligence and empathetic expression',
      },
      Earth: {
        compatibility: 0.88,
        synergy: 'Fertile Growth',
        effect: 'Nurturing wisdom and practical compassion',
      },
    },
    Air: {
      Fire: {
        compatibility: 0.9,
        synergy: 'Brilliant Innovation',
        effect: 'Intellectual fire and communicative inspiration',
      },
      Water: {
        compatibility: 0.75,
        synergy: 'Flowing Communication',
        effect: 'Emotional intelligence and empathetic expression',
      },
      Earth: {
        compatibility: 0.82,
        synergy: 'Methodical Thinking',
        effect: 'Structured analysis and practical reasoning',
      },
    },
    Earth: {
      Fire: {
        compatibility: 0.8,
        synergy: 'Practical Creativity',
        effect: 'Grounded manifestation of creative vision',
      },
      Water: {
        compatibility: 0.88,
        synergy: 'Fertile Growth',
        effect: 'Nurturing wisdom and practical compassion',
      },
      Air: {
        compatibility: 0.82,
        synergy: 'Methodical Thinking',
        effect: 'Structured analysis and practical reasoning',
      },
    },
  }

  const combination = compatibilityMap[element1]?.[element2]
  if (combination) {
    return {
      element1,
      element2,
      compatibility: combination.compatibility,
      synergy: combination.synergy,
      combinedEffect: combination.effect,
    }
  }

  // Fallback for unknown combinations (still positive)
  return {
    element1,
    element2,
    compatibility: 0.7,
    synergy: 'Harmonic Balance',
    combinedEffect: 'Balanced elemental cooperation',
  }
}

/**
 * Analyze elemental reinforcement patterns in a set of elements
 */
export function analyzeElementalReinforcement(elements: ElementVector[]): ReinforcementAnalysis {
  if (elements.length === 0) {
    return {
      dominantElement: 'None',
      reinforcementMultiplier: 1.0,
      elementalHarmony: 0,
      combinationEffects: [],
      resonancePatterns: [],
    }
  }

  // Calculate average elemental strengths
  const avgElements = elements.reduce(
    (acc, element) => ({
      Fire: acc.Fire + element.Fire / elements.length,
      Water: acc.Water + element.Water / elements.length,
      Air: acc.Air + element.Air / elements.length,
      Earth: acc.Earth + element.Earth / elements.length,
    }),
    { Fire: 0, Water: 0, Air: 0, Earth: 0 }
  )

  // Find dominant element
  const [dominantElement, dominantStrength] = Object.entries(avgElements).reduce(
    (max, [element, strength]) => (strength > max[1] ? [element, strength] : max),
    ['Fire', -1]
  )

  // Calculate reinforcement multiplier
  const reinforcementMultiplier = calculateElementalReinforcementScore(elements, 1.0)

  // Calculate elemental harmony (how well balanced the elements are)
  const totalStrength = Object.values(avgElements).reduce((sum, val) => sum + val, 0)
  const elementalVariance =
    Object.values(avgElements).reduce(
      (variance, val) => variance + Math.pow(val - totalStrength / 4, 2),
      0
    ) / 4

  const elementalHarmony = Math.max(0, 1 - elementalVariance * 2) // Lower variance = higher harmony

  // Identify combination effects
  const combinationEffects = []
  const sortedElements = Object.entries(avgElements)
    .filter(([, strength]) => strength > 0.2)
    .sort((a, b) => b[1] - a[1])

  for (const [element, strength] of sortedElements) {
    combinationEffects.push({
      element,
      strength,
      description: getElementalEffect(element, strength),
    })
  }

  // Identify resonance patterns
  const resonancePatterns = identifyResonancePatterns(avgElements, elements.length)

  return {
    dominantElement,
    reinforcementMultiplier,
    elementalHarmony,
    combinationEffects,
    resonancePatterns,
  }
}

/**
 * Calculate reinforcement boost for UI visualization
 */
export function calculateReinforcementBoost(
  elements: ElementVector[],
  targetElement: string
): number {
  const totalElemental = elements.reduce(
    (sum, element) => sum + element[targetElement as keyof ElementVector],
    0
  )
  const avgElemental = totalElemental / elements.length

  // Calculate boost based on concentration of target element
  const baseBoost = Math.min(avgElemental * 0.5, 0.3) // Max 30% visual boost

  // Additional boost for multiple instances of same element
  const concentrationBonus = totalElemental > 2 ? 0.1 : 0

  return baseBoost + concentrationBonus
}

/**
 * Get visual emphasis level for UI components
 */
export function getVisualEmphasis(
  reinforcementScore: number
): 'subtle' | 'moderate' | 'strong' | 'intense' {
  if (reinforcementScore >= 1.4) return 'intense'
  if (reinforcementScore >= 1.25) return 'strong'
  if (reinforcementScore >= 1.1) return 'moderate'
  return 'subtle'
}

/**
 * Generate elemental color scheme based on reinforcement
 */
export function getElementalColorScheme(
  element: string,
  intensity: number
): {
  primary: string
  secondary: string
  accent: string
  background: string
} {
  const baseColors = {
    Fire: { primary: '#FF6B35', secondary: '#F7931E', accent: '#FFD700', background: '#FFF8DC' },
    Water: { primary: '#0077BE', secondary: '#00A9D4', accent: '#87CEEB', background: '#F0F8FF' },
    Air: { primary: '#FFD700', secondary: '#FFA500', accent: '#FFFF99', background: '#FFFACD' },
    Earth: { primary: '#8B4513', secondary: '#A0522D', accent: '#DEB887', background: '#F5F5DC' },
  }

  const colors = baseColors[element as keyof typeof baseColors] || baseColors.Fire

  // Adjust intensity based on reinforcement score
  const alpha = Math.min(intensity, 1.0)

  return {
    primary: colors.primary,
    secondary: colors.secondary,
    accent: colors.accent,
    background: colors.background,
  }
}

// Private helper functions

function getElementalEffect(element: string, strength: number): string {
  const effects = {
    Fire: [
      'Subtle creative spark',
      'Growing inspiration',
      'Strong creative drive',
      'Intense passionate expression',
      'Overwhelming creative fire',
    ],
    Water: [
      'Gentle emotional awareness',
      'Deepening intuition',
      'Strong emotional wisdom',
      'Intense psychic sensitivity',
      'Overwhelming spiritual depth',
    ],
    Air: [
      'Clear mental focus',
      'Enhanced communication',
      'Strong intellectual clarity',
      'Intense analytical power',
      'Overwhelming mental brilliance',
    ],
    Earth: [
      'Practical grounding',
      'Steady manifestation',
      'Strong material focus',
      'Intense structural building',
      'Overwhelming material mastery',
    ],
  }

  const elementEffects = effects[element as keyof typeof effects] || effects.Fire
  const index = Math.min(Math.floor(strength * 5), 4)
  return elementEffects[index]
}

function identifyResonancePatterns(
  avgElements: ElementVector,
  sampleCount: number
): { pattern: string; intensity: number; meaning: string }[] {
  const patterns = []

  // Check for dominance patterns
  const maxElement = Math.max(...Object.values(avgElements))
  if (maxElement > 0.6) {
    const dominantElement = Object.entries(avgElements).find(([, val]) => val === maxElement)?.[0]
    patterns.push({
      pattern: `${dominantElement} Dominance`,
      intensity: maxElement,
      meaning: `Strong ${dominantElement?.toLowerCase()} energy creates focused manifestation`,
    })
  }

  // Check for balance patterns
  const elementValues = Object.values(avgElements)
  const variance = elementValues.reduce((v, val) => v + Math.pow(val - maxElement / 4, 2), 0) / 4
  if (variance < 0.1 && maxElement > 0.3) {
    patterns.push({
      pattern: 'Elemental Harmony',
      intensity: 1 - variance,
      meaning: 'Balanced elemental forces create stable, integrated energy',
    })
  }

  // Check for dual element patterns
  const strongElements = Object.entries(avgElements).filter(([, val]) => val > 0.4)
  if (strongElements.length === 2) {
    const [elem1, elem2] = strongElements.map(([name]) => name)
    const compatibility = getElementalCompatibility(elem1, elem2)
    patterns.push({
      pattern: `${elem1}-${elem2} Synthesis`,
      intensity: compatibility.compatibility,
      meaning: compatibility.combinedEffect,
    })
  }

  // Check for reinforcement patterns
  if (sampleCount > 3) {
    const reinforcementRatio = maxElement / (1 / sampleCount)
    if (reinforcementRatio > 2) {
      patterns.push({
        pattern: 'Elemental Reinforcement',
        intensity: Math.min(reinforcementRatio / 3, 1),
        meaning: 'Multiple sources amplify elemental expression',
      })
    }
  }

  return patterns.sort((a, b) => b.intensity - a.intensity)
}

// Export utility functions for component use
export {
  getElementalEffect as getElementDescription,
  identifyResonancePatterns as findResonancePatterns,
}
