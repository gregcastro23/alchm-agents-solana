// Astrological Character Vector System
// Calculates % composition of each zodiac sign based on planetary placements

export interface PlanetaryWeight {
  planet: string
  weight: number // How much this planet contributes to character
  essential_dignity_multiplier: number // Bonus for being in domicile/exaltation
}

export interface SignCharacterVector {
  aries: number // 0-100%
  taurus: number // 0-100%
  gemini: number // 0-100%
  cancer: number // 0-100%
  leo: number // 0-100%
  virgo: number // 0-100%
  libra: number // 0-100%
  scorpio: number // 0-100%
  sagittarius: number // 0-100%
  capricorn: number // 0-100%
  aquarius: number // 0-100%
  pisces: number // 0-100%
  total: number // Should equal 100%
}

export interface ChartCharacterProfile {
  sign_vectors: SignCharacterVector
  dominant_signs: string[] // Top 3-5 signs by percentage
  absent_signs: string[] // Signs with 0% or very low percentage
  elemental_distribution: {
    fire: number // % from Aries, Leo, Sagittarius
    earth: number // % from Taurus, Virgo, Capricorn
    air: number // % from Gemini, Libra, Aquarius
    water: number // % from Cancer, Scorpio, Pisces
  }
  modal_distribution: {
    cardinal: number // % from Aries, Cancer, Libra, Capricorn
    fixed: number // % from Taurus, Leo, Scorpio, Aquarius
    mutable: number // % from Gemini, Virgo, Sagittarius, Pisces
  }
  chart_signature: string // Unique fingerprint of this chart's character
  interaction_style_preferences: InteractionStylePreferences
}

export interface InteractionStylePreferences {
  learning_modalities: {
    visual: number // 0-100 preference
    auditory: number // 0-100 preference
    kinesthetic: number // 0-100 preference
    reading: number // 0-100 preference
  }
  communication_preferences: {
    direct_vs_diplomatic: number // 0-100 (0=diplomatic, 100=direct)
    fast_vs_slow: number // 0-100 (0=slow/deep, 100=fast/surface)
    logical_vs_intuitive: number // 0-100 (0=logical, 100=intuitive)
    structured_vs_freeform: number // 0-100 (0=structured, 100=freeform)
  }
  engagement_preferences: {
    competition_vs_collaboration: number // 0-100 (0=collaboration, 100=competition)
    routine_vs_variety: number // 0-100 (0=routine, 100=variety)
    depth_vs_breadth: number // 0-100 (0=depth, 100=breadth)
    individual_vs_social: number // 0-100 (0=individual, 100=social)
  }
  growth_preferences: {
    gentle_vs_challenging: number // 0-100 (0=gentle, 100=challenging)
    gradual_vs_intense: number // 0-100 (0=gradual, 100=intense)
    theoretical_vs_practical: number // 0-100 (0=theoretical, 100=practical)
    reflection_vs_action: number // 0-100 (0=reflection, 100=action)
  }
}

export interface UserLearningPreferences {
  user_id: string
  preferred_training_modes: string[] // ['conversation', 'game', 'meditation', 'visualization', etc.]
  session_preferences: {
    typical_session_length: number // minutes
    preferred_time_of_day: string
    energy_level_preference: 'high' | 'medium' | 'low' | 'variable'
    focus_style: 'single_topic' | 'mixed_topics' | 'spiral_learning'
  }
  interaction_history: {
    successful_methods: string[]
    challenging_methods: string[]
    preferred_feedback_style: string
    motivation_triggers: string[]
  }
  customization_requests: {
    avatar_preferences: string
    voice_tone_preferences: string
    content_complexity_level: number // 1-10
    humor_style: string
  }
  progress_tracking_preferences: {
    wants_detailed_progress: boolean
    prefers_milestones: boolean
    likes_surprises: boolean
    wants_regular_check_ins: boolean
  }
}

// PLANETARY WEIGHTS for character calculation
export const PLANETARY_WEIGHTS: Record<string, PlanetaryWeight> = {
  sun: {
    planet: 'sun',
    weight: 25, // Core identity
    essential_dignity_multiplier: 1.5, // Strong in Leo, exalted in Aries
  },
  moon: {
    planet: 'moon',
    weight: 20, // Emotional nature
    essential_dignity_multiplier: 1.4, // Strong in Cancer, exalted in Taurus
  },
  ascendant: {
    planet: 'ascendant',
    weight: 20, // How you meet the world (if birth time known)
    essential_dignity_multiplier: 1.3,
  },
  mercury: {
    planet: 'mercury',
    weight: 12, // Communication and thinking
    essential_dignity_multiplier: 1.3, // Strong in Gemini/Virgo
  },
  venus: {
    planet: 'venus',
    weight: 10, // Values and relationships
    essential_dignity_multiplier: 1.3, // Strong in Taurus/Libra
  },
  mars: {
    planet: 'mars',
    weight: 8, // Action and drive
    essential_dignity_multiplier: 1.3, // Strong in Aries, exalted in Capricorn
  },
  jupiter: {
    planet: 'jupiter',
    weight: 3, // Growth and wisdom
    essential_dignity_multiplier: 1.2,
  },
  saturn: {
    planet: 'saturn',
    weight: 2, // Structure and discipline
    essential_dignity_multiplier: 1.2,
  },
}

// SIGN GROUPS for elemental and modal distribution
export const SIGN_GROUPS = {
  fire: ['aries', 'leo', 'sagittarius'],
  earth: ['taurus', 'virgo', 'capricorn'],
  air: ['gemini', 'libra', 'aquarius'],
  water: ['cancer', 'scorpio', 'pisces'],
  cardinal: ['aries', 'cancer', 'libra', 'capricorn'],
  fixed: ['taurus', 'leo', 'scorpio', 'aquarius'],
  mutable: ['gemini', 'virgo', 'sagittarius', 'pisces'],
}

// CHARACTER VECTOR CALCULATOR
export class CharacterVectorCalculator {
  static calculateSignVectors(
    placements: Array<{ planet: string; sign: string; dignity?: string }>
  ): SignCharacterVector {
    // Initialize all signs to 0
    const vectors: SignCharacterVector = {
      aries: 0,
      taurus: 0,
      gemini: 0,
      cancer: 0,
      leo: 0,
      virgo: 0,
      libra: 0,
      scorpio: 0,
      sagittarius: 0,
      capricorn: 0,
      aquarius: 0,
      pisces: 0,
      total: 100,
    }

    let totalWeight = 0

    // Calculate weighted contribution of each placement
    for (const placement of placements) {
      const planetWeight = PLANETARY_WEIGHTS[placement.planet]
      if (!planetWeight) continue

      let weight = planetWeight.weight

      // Apply dignity multiplier if planet is in domicile or exaltation
      if (placement.dignity === 'domicile' || placement.dignity === 'exaltation') {
        weight *= planetWeight.essential_dignity_multiplier
      }

      const sign = placement.sign.toLowerCase()
      if (vectors.hasOwnProperty(sign)) {
        vectors[sign as keyof SignCharacterVector] += weight
        totalWeight += weight
      }
    }

    // Convert to percentages
    const percentageVectors: SignCharacterVector = {
      aries: (vectors.aries / totalWeight) * 100,
      taurus: (vectors.taurus / totalWeight) * 100,
      gemini: (vectors.gemini / totalWeight) * 100,
      cancer: (vectors.cancer / totalWeight) * 100,
      leo: (vectors.leo / totalWeight) * 100,
      virgo: (vectors.virgo / totalWeight) * 100,
      libra: (vectors.libra / totalWeight) * 100,
      scorpio: (vectors.scorpio / totalWeight) * 100,
      sagittarius: (vectors.sagittarius / totalWeight) * 100,
      capricorn: (vectors.capricorn / totalWeight) * 100,
      aquarius: (vectors.aquarius / totalWeight) * 100,
      pisces: (vectors.pisces / totalWeight) * 100,
      total: 100,
    }

    return percentageVectors
  }

  static generateChartCharacterProfile(
    placements: Array<{ planet: string; sign: string; dignity?: string }>
  ): ChartCharacterProfile {
    const signVectors = this.calculateSignVectors(placements)

    // Identify dominant signs (>= 5% representation)
    const dominantSigns = Object.entries(signVectors)
      .filter(([sign, percentage]) => sign !== 'total' && percentage >= 5)
      .sort(([, a], [, b]) => b - a)
      .map(([sign]) => sign)

    // Identify absent signs (< 2% representation)
    const absentSigns = Object.entries(signVectors)
      .filter(([sign, percentage]) => sign !== 'total' && percentage < 2)
      .map(([sign]) => sign)

    // Calculate elemental distribution
    const elementalDistribution = {
      fire: SIGN_GROUPS.fire.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
      earth: SIGN_GROUPS.earth.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
      air: SIGN_GROUPS.air.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
      water: SIGN_GROUPS.water.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
    }

    // Calculate modal distribution
    const modalDistribution = {
      cardinal: SIGN_GROUPS.cardinal.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
      fixed: SIGN_GROUPS.fixed.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
      mutable: SIGN_GROUPS.mutable.reduce(
        (sum, sign) => sum + signVectors[sign as keyof SignCharacterVector],
        0
      ),
    }

    // Generate interaction style preferences based on sign vectors
    const interactionPreferences = this.deriveInteractionPreferences(
      signVectors,
      elementalDistribution,
      modalDistribution
    )

    // Create unique chart signature
    const chartSignature = this.generateChartSignature(signVectors, dominantSigns, absentSigns)

    return {
      sign_vectors: signVectors,
      dominant_signs: dominantSigns,
      absent_signs: absentSigns,
      elemental_distribution: elementalDistribution,
      modal_distribution: modalDistribution,
      chart_signature: chartSignature,
      interaction_style_preferences: interactionPreferences,
    }
  }

  private static deriveInteractionPreferences(
    signVectors: SignCharacterVector,
    elemental: any,
    modal: any
  ): InteractionStylePreferences {
    // Learning modalities based on elemental emphasis
    const learning_modalities = {
      visual: Math.min(100, (elemental.fire + elemental.air) * 1.2), // Fire & Air prefer visual
      auditory: Math.min(100, (elemental.air + elemental.water) * 1.1), // Air & Water prefer auditory
      kinesthetic: Math.min(100, (elemental.fire + elemental.earth) * 1.3), // Fire & Earth prefer hands-on
      reading: Math.min(100, (elemental.earth + elemental.water) * 1.1), // Earth & Water prefer reading
    }

    // Communication preferences
    const communication_preferences = {
      direct_vs_diplomatic: Math.min(100, elemental.fire + signVectors.aries * 2), // Fire signs more direct
      fast_vs_slow: Math.min(
        100,
        elemental.fire + elemental.air - (elemental.earth + elemental.water) + 50
      ),
      logical_vs_intuitive: Math.min(
        100,
        elemental.water + elemental.fire - (elemental.earth + elemental.air) + 50
      ),
      structured_vs_freeform: Math.min(
        100,
        elemental.fire + elemental.water - (elemental.earth + elemental.air) + 50
      ),
    }

    // Engagement preferences based on modal emphasis
    const engagement_preferences = {
      competition_vs_collaboration: Math.min(
        100,
        modal.cardinal + elemental.fire - (elemental.water + elemental.earth) + 50
      ),
      routine_vs_variety: Math.min(
        100,
        modal.mutable + elemental.air - (modal.fixed + elemental.earth) + 50
      ),
      depth_vs_breadth: Math.min(
        100,
        elemental.water + modal.fixed - (elemental.air + modal.mutable) + 50
      ),
      individual_vs_social: Math.min(
        100,
        elemental.air + elemental.fire - (elemental.earth + elemental.water) + 50
      ),
    }

    // Growth preferences
    const growth_preferences = {
      gentle_vs_challenging: Math.min(
        100,
        elemental.fire + modal.cardinal - (elemental.water + elemental.earth) + 50
      ),
      gradual_vs_intense: Math.min(
        100,
        elemental.fire + signVectors.scorpio * 2 - (elemental.earth + elemental.air) + 50
      ),
      theoretical_vs_practical: Math.min(
        100,
        elemental.earth + elemental.fire - (elemental.air + elemental.water) + 50
      ),
      reflection_vs_action: Math.min(
        100,
        elemental.fire + modal.cardinal - (elemental.water + elemental.earth) + 50
      ),
    }

    return {
      learning_modalities,
      communication_preferences,
      engagement_preferences,
      growth_preferences,
    }
  }

  private static generateChartSignature(
    signVectors: SignCharacterVector,
    dominantSigns: string[],
    absentSigns: string[]
  ): string {
    // Create a unique fingerprint combining dominant signs and absent signs
    const dominantCode = dominantSigns.slice(0, 3).join('-')
    const absentCode = absentSigns.length > 0 ? `_missing_${absentSigns.slice(0, 2).join('-')}` : ''
    const vectorHash = Math.round(signVectors.total * 1000).toString() // Simple hash

    return `${dominantCode}${absentCode}_${vectorHash}`
  }

  // CHART INTERACTION ANALYSIS
  static analyzeChartInteraction(
    chart1: ChartCharacterProfile,
    chart2: ChartCharacterProfile
  ): {
    compatibility_vector: number
    complementary_areas: string[]
    challenge_areas: string[]
    missing_sign_dynamics: string[]
    recommended_interaction_style: string
  } {
    // Calculate compatibility based on sign vector overlap and complementarity
    let compatibilityScore = 0
    const complementaryAreas: string[] = []
    const challengeAreas: string[] = []
    const missingSignDynamics: string[] = []

    // Analyze dominant sign interactions
    for (const sign1 of chart1.dominant_signs) {
      for (const sign2 of chart2.dominant_signs) {
        const interaction = this.getSignInteractionDynamic(sign1, sign2)
        if (interaction.harmony > 70) {
          compatibilityScore += 10
          complementaryAreas.push(`${sign1}-${sign2}: ${interaction.theme}`)
        } else if (interaction.harmony < 40) {
          challengeAreas.push(`${sign1}-${sign2}: ${interaction.challenge}`)
        }
      }
    }

    // Analyze missing sign dynamics - where one chart has what the other lacks
    for (const missingSign of chart1.absent_signs) {
      if (chart2.dominant_signs.includes(missingSign)) {
        missingSignDynamics.push(
          `Chart 2's ${missingSign} can teach Chart 1 about ${this.getSignLessons(missingSign)}`
        )
      }
    }

    for (const missingSign of chart2.absent_signs) {
      if (chart1.dominant_signs.includes(missingSign)) {
        missingSignDynamics.push(
          `Chart 1's ${missingSign} can teach Chart 2 about ${this.getSignLessons(missingSign)}`
        )
      }
    }

    // Determine recommended interaction style
    const recommendedStyle = this.determineOptimalInteractionStyle(chart1, chart2)

    return {
      compatibility_vector: Math.min(100, compatibilityScore),
      complementary_areas: complementaryAreas,
      challenge_areas: challengeAreas,
      missing_sign_dynamics: missingSignDynamics,
      recommended_interaction_style: recommendedStyle,
    }
  }

  private static getSignInteractionDynamic(
    sign1: string,
    sign2: string
  ): { harmony: number; theme: string; challenge: string } {
    // This would contain detailed sign interaction dynamics
    const interactions: Record<
      string,
      Record<string, { harmony: number; theme: string; challenge: string }>
    > = {
      aries: {
        leo: { harmony: 85, theme: 'Fiery creative collaboration', challenge: 'Ego competition' },
        sagittarius: {
          harmony: 90,
          theme: 'Adventurous exploration',
          challenge: 'Scattered energy',
        },
        cancer: {
          harmony: 45,
          theme: 'Learning patience vs action',
          challenge: 'Timing differences',
        },
        capricorn: {
          harmony: 55,
          theme: 'Initiative meets structure',
          challenge: 'Impulsivity vs planning',
        },
      },
      // ... would include all 144 combinations
    }

    return (
      interactions[sign1]?.[sign2] || {
        harmony: 60,
        theme: 'Neutral interaction',
        challenge: 'Communication differences',
      }
    )
  }

  private static getSignLessons(sign: string): string {
    const lessons: Record<string, string> = {
      aries: 'initiative, courage, and pioneering spirit',
      taurus: 'patience, sensuality, and grounded stability',
      gemini: 'curiosity, communication, and mental flexibility',
      cancer: 'emotional depth, nurturing, and intuitive wisdom',
      leo: 'creative self-expression, confidence, and generous leadership',
      virgo: 'attention to detail, service, and practical wisdom',
      libra: 'harmony, diplomacy, and aesthetic beauty',
      scorpio: 'transformation, intensity, and psychological depth',
      sagittarius: 'philosophical wisdom, adventure, and higher learning',
      capricorn: 'discipline, ambition, and practical achievement',
      aquarius: 'innovation, humanitarian ideals, and collective consciousness',
      pisces: 'compassion, spirituality, and imaginative empathy',
    }

    return lessons[sign] || 'unique cosmic wisdom'
  }

  private static determineOptimalInteractionStyle(
    chart1: ChartCharacterProfile,
    chart2: ChartCharacterProfile
  ): string {
    const avgDirectness =
      (chart1.interaction_style_preferences.communication_preferences.direct_vs_diplomatic +
        chart2.interaction_style_preferences.communication_preferences.direct_vs_diplomatic) /
      2

    const avgSpeed =
      (chart1.interaction_style_preferences.communication_preferences.fast_vs_slow +
        chart2.interaction_style_preferences.communication_preferences.fast_vs_slow) /
      2

    const avgStructure =
      (chart1.interaction_style_preferences.communication_preferences.structured_vs_freeform +
        chart2.interaction_style_preferences.communication_preferences.structured_vs_freeform) /
      2

    if (avgDirectness > 70 && avgSpeed > 70) {
      return 'Fast-paced, direct communication with clear objectives'
    } else if (avgDirectness < 30 && avgSpeed < 30) {
      return 'Gentle, diplomatic approach with plenty of processing time'
    } else if (avgStructure > 70) {
      return 'Structured, organized interaction with clear frameworks'
    } else {
      return 'Flexible, intuitive interaction style that adapts to the moment'
    }
  }
}

// ADAPTIVE LEARNING SYSTEM
export class AdaptiveLearningSystem {
  static generatePersonalizedTrainingRecommendations(
    characterProfile: ChartCharacterProfile,
    userPreferences: UserLearningPreferences,
    sessionHistory: any[]
  ): {
    recommended_modes: string[]
    session_structure: any
    content_adaptation: any
    interaction_style: any
  } {
    const preferences = characterProfile.interaction_style_preferences

    // Determine training modes based on character and user preferences
    const recommendedModes = this.selectOptimalTrainingModes(preferences, userPreferences)

    // Structure sessions based on dominant signs and modal emphasis
    const sessionStructure = this.designSessionStructure(characterProfile, userPreferences)

    // Adapt content complexity and delivery
    const contentAdaptation = this.adaptContentDelivery(characterProfile, sessionHistory)

    // Customize interaction style
    const interactionStyle = this.customizeInteractionStyle(characterProfile, userPreferences)

    return {
      recommended_modes: recommendedModes,
      session_structure: sessionStructure,
      content_adaptation: contentAdaptation,
      interaction_style: interactionStyle,
    }
  }

  private static selectOptimalTrainingModes(
    preferences: InteractionStylePreferences,
    userPreferences: UserLearningPreferences
  ): string[] {
    const modes: string[] = []

    // Visual learners with high Fire/Air
    if (preferences.learning_modalities.visual > 70) {
      modes.push('visual_chart_exploration', 'constellation_mapping', 'symbol_meditation')
    }

    // Kinesthetic learners with high Fire/Earth
    if (preferences.learning_modalities.kinesthetic > 70) {
      modes.push('movement_astrology', 'hands_on_calculation', 'elemental_exercises')
    }

    // High competition preference
    if (preferences.engagement_preferences.competition_vs_collaboration > 70) {
      modes.push('astrological_games', 'chart_competitions', 'prediction_challenges')
    }

    // High collaboration preference
    if (preferences.engagement_preferences.competition_vs_collaboration < 30) {
      modes.push('group_learning', 'peer_mentoring', 'collaborative_analysis')
    }

    // Depth preference
    if (preferences.engagement_preferences.depth_vs_breadth < 30) {
      modes.push('deep_dive_study', 'meditation_practice', 'shadow_work')
    }

    // Variety preference
    if (preferences.engagement_preferences.routine_vs_variety > 70) {
      modes.push('rotating_techniques', 'surprise_learning', 'adaptive_content')
    }

    return modes.length > 0 ? modes : ['balanced_approach', 'gentle_exploration']
  }

  private static designSessionStructure(
    characterProfile: ChartCharacterProfile,
    userPreferences: UserLearningPreferences
  ): any {
    const modal = characterProfile.modal_distribution
    const elemental = characterProfile.elemental_distribution

    return {
      opening: modal.cardinal > 40 ? 'quick_start_action' : 'gradual_warm_up',
      main_content: {
        segments: elemental.fire > 40 ? 3 : elemental.earth > 40 ? 1 : 2,
        length_per_segment: elemental.air > 40 ? 'short_bursts' : 'extended_focus',
        interaction_style: elemental.water > 40 ? 'reflective_dialogue' : 'active_engagement',
      },
      closing: modal.mutable > 40 ? 'open_ended_reflection' : 'concrete_summary',
      follow_up: userPreferences.progress_tracking_preferences.wants_regular_check_ins
        ? 'scheduled_check_in'
        : 'self_directed_practice',
    }
  }

  private static adaptContentDelivery(
    characterProfile: ChartCharacterProfile,
    sessionHistory: any[]
  ): any {
    const preferences = characterProfile.interaction_style_preferences

    return {
      complexity_level: this.calculateOptimalComplexity(preferences, sessionHistory),
      delivery_pace:
        preferences.communication_preferences.fast_vs_slow > 60 ? 'fast' : 'deliberate',
      explanation_style:
        preferences.communication_preferences.logical_vs_intuitive > 60
          ? 'intuitive_metaphors'
          : 'logical_frameworks',
      feedback_frequency:
        preferences.engagement_preferences.individual_vs_social > 60
          ? 'frequent_social_feedback'
          : 'periodic_individual_reflection',
    }
  }

  private static calculateOptimalComplexity(
    preferences: InteractionStylePreferences,
    sessionHistory: any[]
  ): number {
    // Base complexity on chart preferences
    let complexity = 5 // Start at medium

    if (preferences.engagement_preferences.depth_vs_breadth < 30) complexity += 2 // Depth preference
    if (preferences.growth_preferences.gentle_vs_challenging > 70) complexity += 1 // Challenge preference
    if (preferences.communication_preferences.logical_vs_intuitive < 30) complexity += 1 // Logical preference

    // Adjust based on session history success
    // This would analyze past session performance

    return Math.min(10, Math.max(1, complexity))
  }

  private static customizeInteractionStyle(
    characterProfile: ChartCharacterProfile,
    userPreferences: UserLearningPreferences
  ): any {
    const preferences = characterProfile.interaction_style_preferences

    return {
      communication_tone: this.determineCommunicationTone(preferences, userPreferences),
      encouragement_style: this.determineEncouragementStyle(preferences),
      challenge_delivery: this.determineChallengeDelivery(preferences),
      personalization_level: this.determinePersonalizationLevel(characterProfile),
    }
  }

  private static determineCommunicationTone(
    preferences: InteractionStylePreferences,
    userPreferences: UserLearningPreferences
  ): string {
    if (preferences.communication_preferences.direct_vs_diplomatic > 70) {
      return userPreferences.customization_requests.humor_style === 'playful'
        ? 'direct_playful'
        : 'direct_supportive'
    } else {
      return 'gentle_encouraging'
    }
  }

  private static determineEncouragementStyle(preferences: InteractionStylePreferences): string {
    if (preferences.growth_preferences.gentle_vs_challenging > 70) {
      return 'bold_celebration'
    } else {
      return 'gentle_acknowledgment'
    }
  }

  private static determineChallengeDelivery(preferences: InteractionStylePreferences): string {
    if (preferences.growth_preferences.gradual_vs_intense > 70) {
      return 'intensive_immersion'
    } else {
      return 'step_by_step_progression'
    }
  }

  private static determinePersonalizationLevel(characterProfile: ChartCharacterProfile): string {
    const dominantCount = characterProfile.dominant_signs.length
    const absentCount = characterProfile.absent_signs.length

    if (dominantCount <= 2 && absentCount >= 6) {
      return 'highly_specialized' // Very focused chart
    } else if (dominantCount >= 6 && absentCount <= 2) {
      return 'broadly_adaptable' // Well-rounded chart
    } else {
      return 'moderately_personalized'
    }
  }
}

// USER PREFERENCE PERSISTENCE
export interface UserSessionData {
  user_id: string
  character_profile: ChartCharacterProfile
  learning_preferences: UserLearningPreferences
  session_history: SessionRecord[]
  adaptive_insights: string[]
  next_session_recommendations: any
}

export interface SessionRecord {
  session_id: string
  date: string
  duration_minutes: number
  training_modes_used: string[]
  effectiveness_rating: number // 1-10
  user_feedback: string
  chart_insights_gained: string[]
  interaction_adjustments_made: string[]
  next_session_preferences: any
}
