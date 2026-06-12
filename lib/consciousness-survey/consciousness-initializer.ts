// Consciousness State Initialization - Combines Survey + Astrological Data

import type {
  ConsciousnessProfile,
  SurveyAnalysis,
  PersonalityInsights,
} from '../types/consciousness-survey'
import type { BirthChartData, BasePersonality, DualChartSystem } from '../types/personalized-ai'
import { generateBasePersonality } from '../personalized-ai/personality-generator'

export interface ConsciousnessState {
  // Core identity synthesis
  unified_archetype: string
  consciousness_signature: string

  // Enhanced personality model
  enhanced_personality: EnhancedPersonality

  // Optimized training approach
  personalized_training_plan: PersonalizedTrainingPlan

  // Initial AI behavioral programming
  ai_behavioral_matrix: AIBehavioralMatrix

  // Consciousness evolution tracking
  growth_trajectory: GrowthTrajectory
}

export interface EnhancedPersonality extends BasePersonality {
  // Survey-derived insights
  consciousness_profile: ConsciousnessProfile
  personality_insights: PersonalityInsights

  // Astrological-psychological synthesis
  cosmic_psychology: {
    chart_consciousness_alignment: number // How well chart matches survey
    dominant_psychological_planets: string[]
    consciousness_activation_points: string[]
    psychological_growth_aspects: string[]
  }

  // Integrated communication matrix
  optimal_communication: {
    base_style: BasePersonality['communicationStyle']
    consciousness_modifiers: {
      depth_preference: number // 0-100
      abstraction_comfort: number // 0-100
      introspection_tendency: number // 0-100
      philosophical_inclination: number // 0-100
    }
    contextual_adaptations: Record<string, any>
  }
}

export interface PersonalizedTrainingPlan {
  // Optimized training sequence
  priority_categories: Array<{
    category: string
    importance: number // 0-100
    astrological_support: number // 0-100
    consciousness_alignment: number // 0-100
    optimal_timing?: string[] // Best astrological windows
  }>

  // Learning approach optimization
  learning_optimization: {
    ideal_session_length: number // minutes
    preferred_complexity_curve: 'gentle' | 'moderate' | 'steep'
    feedback_frequency: 'high' | 'medium' | 'low'
    challenge_tolerance: number // 0-100
    support_needs: string[]
  }

  // Consciousness-specific exercises
  consciousness_exercises: Array<{
    type: 'reflection' | 'exploration' | 'integration' | 'application'
    description: string
    frequency: 'daily' | 'weekly' | 'monthly'
    astrological_timing?: string
  }>
}

export interface AIBehavioralMatrix {
  // Core behavioral parameters
  response_patterns: {
    questioning_depth: number // 0-100
    emotional_mirroring: number // 0-100
    intellectual_challenge: number // 0-100
    creative_encouragement: number // 0-100
    practical_grounding: number // 0-100
  }

  // Adaptive conversation flow
  conversation_dynamics: {
    initiation_style: 'curious' | 'supportive' | 'challenging' | 'reflective'
    pacing_preference: 'slow' | 'moderate' | 'dynamic'
    topic_transition: 'smooth' | 'direct' | 'associative'
    closure_style: 'summarizing' | 'forward_looking' | 'integrative'
  }

  // Consciousness-aware responses
  consciousness_integration: {
    awareness_reflections: boolean // Include self-awareness prompts
    growth_tracking: boolean // Monitor development progress
    pattern_recognition: boolean // Point out user patterns
    archetypal_references: boolean // Use archetypal language
  }
}

export interface GrowthTrajectory {
  // Development phases
  phases: Array<{
    phase_name: string
    duration_estimate: string
    goals: string[]
    milestones: string[]
    astrological_influences: string[]
  }>

  // Consciousness evolution metrics
  evolution_tracking: {
    self_awareness_growth: number // Starting baseline
    integration_capacity: number // How well user integrates insights
    transformation_readiness: number // Openness to deep change
    consciousness_expansion_rate: 'slow' | 'moderate' | 'rapid'
  }
}

/**
 * Initialize complete consciousness state from survey and astrological data
 */
export async function initializeConsciousnessState(
  surveyAnalysis: SurveyAnalysis,
  dualChartSystem: DualChartSystem,
  _birthInfo: any
): Promise<ConsciousnessState> {
  // Generate base astrological personality
  const astrologicalPersonality = generateBasePersonality(dualChartSystem.birthChart)

  // Create enhanced personality synthesis
  const enhancedPersonality = synthesizePersonalities(
    surveyAnalysis,
    astrologicalPersonality,
    dualChartSystem
  )

  // Generate unified archetype
  const unifiedArchetype = createUnifiedArchetype(
    surveyAnalysis.insights.archetype,
    astrologicalPersonality.archetype
  )

  // Create consciousness signature
  const consciousnessSignature = generateConsciousnessSignature(
    surveyAnalysis.profile,
    dualChartSystem.birthChart
  )

  // Build personalized training plan
  const trainingPlan = createPersonalizedTrainingPlan(
    surveyAnalysis,
    dualChartSystem,
    enhancedPersonality
  )

  // Configure AI behavioral matrix
  const behavioralMatrix = configureBehavioralMatrix(
    surveyAnalysis.profile,
    surveyAnalysis.insights,
    dualChartSystem.combinedInfluences
  )

  // Map growth trajectory
  const growthTrajectory = mapGrowthTrajectory(surveyAnalysis, dualChartSystem, enhancedPersonality)

  return {
    unified_archetype: unifiedArchetype,
    consciousness_signature: consciousnessSignature,
    enhanced_personality: enhancedPersonality,
    personalized_training_plan: trainingPlan,
    ai_behavioral_matrix: behavioralMatrix,
    growth_trajectory: growthTrajectory,
  }
}

/**
 * Synthesize survey-based and astrological personalities
 */
function synthesizePersonalities(
  surveyAnalysis: SurveyAnalysis,
  astrologicalPersonality: BasePersonality,
  dualChartSystem: DualChartSystem
): EnhancedPersonality {
  // Calculate alignment between survey and chart
  const alignment = calculateChartConsciousnessAlignment(
    surveyAnalysis.profile,
    dualChartSystem.birthChart
  )

  // Identify dominant psychological planets
  const psychologicalPlanets = identifyPsychologicalPlanets(
    surveyAnalysis.profile,
    dualChartSystem.birthChart
  )

  // Find consciousness activation points
  const activationPoints = findConsciousnessActivationPoints(
    surveyAnalysis.profile,
    dualChartSystem.birthChart
  )

  // Synthesize communication styles
  synthesizeCommunicationStyles(
    surveyAnalysis.profile.communication,
    astrologicalPersonality.communicationStyle
  )

  return {
    ...astrologicalPersonality,
    consciousness_profile: surveyAnalysis.profile,
    personality_insights: surveyAnalysis.insights,

    cosmic_psychology: {
      chart_consciousness_alignment: alignment,
      dominant_psychological_planets: psychologicalPlanets,
      consciousness_activation_points: activationPoints,
      psychological_growth_aspects: [],
    },

    optimal_communication: {
      base_style: astrologicalPersonality.communicationStyle,
      consciousness_modifiers: {
        depth_preference: surveyAnalysis.profile.learning.depth_breadth < 40 ? 80 : 40,
        abstraction_comfort: surveyAnalysis.profile.thinking.analytical_intuitive > 60 ? 75 : 35,
        introspection_tendency: surveyAnalysis.profile.meta_cognition.reflection_tendency,
        philosophical_inclination: calculatePhilosophicalInclination(surveyAnalysis.profile),
      },
      contextual_adaptations: generateContextualAdaptations(surveyAnalysis.profile),
    },
  }
}

/**
 * Create unified archetype from survey and astrological archetypes
 */
function createUnifiedArchetype(surveyArchetype: string, astrologicalArchetype: string): string {
  // Combine archetypes for unified identity
  const combinations: Record<string, Record<string, string>> = {
    'The Visionary Explorer': {
      'The Visionary Pioneer': 'The Cosmic Visionary',
      'The Practical Builder': 'The Grounded Visionary',
      'The Intellectual Explorer': 'The Infinite Explorer',
      'The Intuitive Healer': 'The Healing Visionary',
    },
    'The Methodical Builder': {
      'The Practical Builder': 'The Master Builder',
      'The Balanced Seeker': 'The Structured Seeker',
      'The Nurturing Guardian': 'The Protective Builder',
    },
    'The Empathetic Connector': {
      'The Intuitive Healer': 'The Healing Empath',
      'The Nurturing Guardian': 'The Compassionate Guardian',
      'The Creative Communicator': 'The Heart-Centered Communicator',
    },
    'The Creative Innovator': {
      'The Visionary Pioneer': 'The Revolutionary Creator',
      'The Creative Communicator': 'The Expressive Innovator',
      'The Balanced Seeker': 'The Harmonious Creator',
    },
  }

  return (
    combinations[surveyArchetype]?.[astrologicalArchetype] ||
    `The ${surveyArchetype.split(' ')[1]} ${astrologicalArchetype.split(' ')[1]}`
  )
}

/**
 * Generate unique consciousness signature
 */
function generateConsciousnessSignature(
  profile: ConsciousnessProfile,
  birthChart: BirthChartData
): string {
  const elements = [
    profile.dimensions.openness > 70 ? 'Open' : 'Focused',
    profile.thinking.analytical_intuitive > 60 ? 'Intuitive' : 'Analytical',
    profile.communication.emotional_expression > 60 ? 'Expressive' : 'Reserved',
    profile.meta_cognition.growth_mindset > 70 ? 'Evolving' : 'Stable',
  ]

  const sunSign = birthChart.planets.Sun?.sign || 'Unknown'
  const moonSign = birthChart.planets.Moon?.sign || 'Unknown'

  return `${elements.join('-')} • ${sunSign}☉${moonSign}☽`
}

/**
 * Calculate alignment between psychological profile and astrological chart
 */
function calculateChartConsciousnessAlignment(
  profile: ConsciousnessProfile,
  birthChart: BirthChartData
): number {
  let alignment = 50 // Base alignment

  // Check fire signs vs extraversion
  const fireSignCount = countElementalPlanets(birthChart, ['Aries', 'Leo', 'Sagittarius'])
  if (fireSignCount > 2 && profile.dimensions.introversion_extraversion > 60) alignment += 15

  // Check water signs vs emotional expression
  const waterSignCount = countElementalPlanets(birthChart, ['Cancer', 'Scorpio', 'Pisces'])
  if (waterSignCount > 2 && profile.communication.emotional_expression > 60) alignment += 15

  // Check earth signs vs conscientiousness
  const earthSignCount = countElementalPlanets(birthChart, ['Taurus', 'Virgo', 'Capricorn'])
  if (earthSignCount > 2 && profile.dimensions.conscientiousness > 60) alignment += 15

  // Check air signs vs intellectual orientation
  const airSignCount = countElementalPlanets(birthChart, ['Gemini', 'Libra', 'Aquarius'])
  if (airSignCount > 2 && profile.thinking.analytical_intuitive < 40) alignment += 15

  return Math.min(100, alignment)
}

function countElementalPlanets(birthChart: BirthChartData, signs: string[]): number {
  return Object.values(birthChart.planets).filter(planet => signs.includes(planet.sign)).length
}

/**
 * Identify key psychological planets based on survey responses
 */
function identifyPsychologicalPlanets(
  profile: ConsciousnessProfile,
  _birthChart: BirthChartData
): string[] {
  const psychPlanets: string[] = []

  // Moon for emotional patterns
  if (profile.communication.emotional_expression > 60) {
    psychPlanets.push('Moon')
  }

  // Mercury for thinking and communication
  if (profile.communication.directness > 60 || profile.thinking.analytical_intuitive < 40) {
    psychPlanets.push('Mercury')
  }

  // Venus for values and relationships
  if (profile.values.competition_cooperation > 60) {
    psychPlanets.push('Venus')
  }

  // Mars for assertiveness and action
  if (profile.dimensions.assertiveness > 70) {
    psychPlanets.push('Mars')
  }

  // Jupiter for growth and philosophy
  if (profile.meta_cognition.growth_mindset > 70) {
    psychPlanets.push('Jupiter')
  }

  // Saturn for structure and discipline
  if (profile.dimensions.conscientiousness > 70) {
    psychPlanets.push('Saturn')
  }

  return psychPlanets
}

/**
 * Find consciousness activation points in the chart
 */
function findConsciousnessActivationPoints(
  profile: ConsciousnessProfile,
  _birthChart: BirthChartData
): string[] {
  const activationPoints: string[] = []

  // High self-awareness suggests strong 1st house or Sun aspects
  if (profile.meta_cognition.self_awareness > 70) {
    activationPoints.push('Solar Consciousness')
  }

  // Strong intuition suggests Neptune or 12th house emphasis
  if (profile.thinking.analytical_intuitive > 70) {
    activationPoints.push('Intuitive Awareness')
  }

  // Transformation readiness suggests Pluto activation
  if (profile.meta_cognition.adaptability > 70) {
    activationPoints.push('Transformational Power')
  }

  // Spiritual inclination suggests 9th house or Jupiter
  if (profile.values.material_spiritual > 60) {
    activationPoints.push('Spiritual Expansion')
  }

  return activationPoints
}

/**
 * Synthesize communication styles from both sources
 */
function synthesizeCommunicationStyles(
  surveyComm: ConsciousnessProfile['communication'],
  astroComm: BasePersonality['communicationStyle']
): any {
  return {
    ...astroComm,
    // Blend the styles, giving slight preference to survey data
    formality: Math.round(surveyComm.formality * 0.6 + astroComm.formality * 0.4),
    verbosity: Math.round(surveyComm.verbosity * 0.6 + astroComm.verbosity * 0.4),
    emotiveness: Math.round(surveyComm.emotional_expression * 0.6 + astroComm.emotiveness * 0.4),
    directness: Math.round(surveyComm.directness * 0.6 + astroComm.directness * 0.4),
    // Add survey-specific enhancements
    humor_integration: surveyComm.humor_style !== 'none',
    preferred_tone: surveyComm.preferred_tone,
  }
}

function calculatePhilosophicalInclination(profile: ConsciousnessProfile): number {
  const factors = [
    profile.meta_cognition.self_awareness > 60 ? 30 : 10,
    profile.values.material_spiritual > 50 ? 25 : 5,
    profile.thinking.analytical_intuitive > 60 ? 20 : 10,
    profile.meta_cognition.reflection_tendency > 60 ? 25 : 15,
  ]
  return Math.min(
    100,
    factors.reduce((a, b) => a + b)
  )
}

function generateContextualAdaptations(profile: ConsciousnessProfile): Record<string, any> {
  return {
    stress_response: {
      communication_shift:
        profile.behavior.stress_response === 'withdraw' ? 'gentler' : 'supportive',
      topic_adjustment: profile.behavior.stress_response === 'analyze' ? 'logical' : 'emotional',
    },
    learning_context: {
      feedback_style: profile.learning.feedback_style,
      challenge_level: profile.meta_cognition.growth_mindset > 70 ? 'high' : 'moderate',
    },
    social_context: {
      group_preference:
        profile.dimensions.introversion_extraversion > 60 ? 'collaborative' : 'individual',
      conflict_approach: profile.behavior.conflict_style,
    },
  }
}

/**
 * Create personalized training plan
 */
function createPersonalizedTrainingPlan(
  surveyAnalysis: SurveyAnalysis,
  dualChartSystem: DualChartSystem,
  enhancedPersonality: EnhancedPersonality
): PersonalizedTrainingPlan {
  // Determine priority categories based on profile and astrological timing
  const priorityCategories = determinePriorityCategories(
    surveyAnalysis,
    dualChartSystem,
    enhancedPersonality
  )

  // Optimize learning approach
  const learningOptimization = optimizeLearningApproach(surveyAnalysis.profile, enhancedPersonality)

  // Generate consciousness exercises
  const consciousnessExercises = generateConsciousnessExercises(
    surveyAnalysis.profile,
    enhancedPersonality
  )

  return {
    priority_categories: priorityCategories,
    learning_optimization: learningOptimization,
    consciousness_exercises: consciousnessExercises,
  }
}

function determinePriorityCategories(
  surveyAnalysis: SurveyAnalysis,
  dualChartSystem: DualChartSystem,
  enhancedPersonality: EnhancedPersonality
): PersonalizedTrainingPlan['priority_categories'] {
  const categories = [
    {
      category: 'communication_style',
      importance: surveyAnalysis.profile.communication.directness < 50 ? 90 : 60,
      astrological_support: calculateAstrologicalSupport('communication', dualChartSystem),
      consciousness_alignment: enhancedPersonality.cosmic_psychology.chart_consciousness_alignment,
    },
    {
      category: 'emotional_intelligence',
      importance: surveyAnalysis.profile.meta_cognition.emotional_intelligence < 60 ? 85 : 50,
      astrological_support: calculateAstrologicalSupport('emotional', dualChartSystem),
      consciousness_alignment: enhancedPersonality.cosmic_psychology.chart_consciousness_alignment,
    },
    {
      category: 'creativity',
      importance: surveyAnalysis.profile.creativity.creative_outlets.length > 0 ? 80 : 40,
      astrological_support: calculateAstrologicalSupport('creative', dualChartSystem),
      consciousness_alignment: enhancedPersonality.cosmic_psychology.chart_consciousness_alignment,
    },
    {
      category: 'personality_alignment',
      importance: 95, // Always important
      astrological_support: calculateAstrologicalSupport('personality', dualChartSystem),
      consciousness_alignment: enhancedPersonality.cosmic_psychology.chart_consciousness_alignment,
    },
  ]

  return categories.sort(
    (a, b) =>
      (b.importance * b.consciousness_alignment) / 100 -
      (a.importance * a.consciousness_alignment) / 100
  )
}

function calculateAstrologicalSupport(category: string, dualChartSystem: DualChartSystem): number {
  // Calculate how well current transits support this training category
  const transits = dualChartSystem.transits
  let support = 50 // Base support

  if (category === 'communication' && transits.currentMood.communication > 60) {
    support += 30
  }
  if (category === 'emotional' && transits.currentMood.emotion > 60) {
    support += 30
  }
  if (category === 'creative' && transits.currentMood.creativity > 60) {
    support += 30
  }

  return Math.min(100, support)
}

function optimizeLearningApproach(
  profile: ConsciousnessProfile,
  _enhancedPersonality: EnhancedPersonality
): PersonalizedTrainingPlan['learning_optimization'] {
  return {
    ideal_session_length:
      profile.thinking.processing_speed === 'slow_deliberate'
        ? 45
        : profile.thinking.processing_speed === 'fast_decisive'
          ? 15
          : 30,
    preferred_complexity_curve: profile.meta_cognition.growth_mindset > 70 ? 'steep' : 'moderate',
    feedback_frequency: profile.learning.feedback_style === 'detailed' ? 'high' : 'medium',
    challenge_tolerance: profile.dimensions.openness > 70 ? 80 : 50,
    support_needs: inferSupportNeeds(profile),
  }
}

function inferSupportNeeds(profile: ConsciousnessProfile): string[] {
  const needs: string[] = []

  if (profile.dimensions.neuroticism > 60) {
    needs.push('Emotional regulation support')
  }
  if (profile.behavior.conflict_style === 'avoid') {
    needs.push('Gentle challenge introduction')
  }
  if (profile.meta_cognition.self_awareness < 50) {
    needs.push('Self-reflection guidance')
  }
  if (profile.learning.feedback_style === 'gentle') {
    needs.push('Encouraging reinforcement')
  }

  return needs
}

function generateConsciousnessExercises(
  profile: ConsciousnessProfile,
  _enhancedPersonality: EnhancedPersonality
): PersonalizedTrainingPlan['consciousness_exercises'] {
  const exercises: PersonalizedTrainingPlan['consciousness_exercises'] = []

  if (profile.meta_cognition.reflection_tendency > 60) {
    exercises.push({
      type: 'reflection',
      description:
        'Daily consciousness check-in: What patterns did you notice in your thoughts and responses today?',
      frequency: 'daily',
    })
  }

  if (profile.dimensions.openness > 70) {
    exercises.push({
      type: 'exploration',
      description:
        'Weekly perspective exploration: Examine a belief or assumption from multiple angles',
      frequency: 'weekly',
    })
  }

  if (profile.meta_cognition.growth_mindset > 70) {
    exercises.push({
      type: 'integration',
      description:
        'Monthly integration review: How have your insights changed your approach to life?',
      frequency: 'monthly',
    })
  }

  return exercises
}

/**
 * Configure AI behavioral matrix
 */
function configureBehavioralMatrix(
  profile: ConsciousnessProfile,
  _insights: PersonalityInsights,
  _influences: any
): AIBehavioralMatrix {
  return {
    response_patterns: {
      questioning_depth: profile.meta_cognition.reflection_tendency,
      emotional_mirroring: profile.communication.emotional_expression,
      intellectual_challenge: profile.meta_cognition.growth_mindset > 70 ? 80 : 50,
      creative_encouragement: profile.creativity.artistic_logical > 50 ? 80 : 40,
      practical_grounding: profile.thinking.analytical_intuitive < 50 ? 80 : 40,
    },

    conversation_dynamics: {
      initiation_style: profile.meta_cognition.self_awareness > 70 ? 'reflective' : 'supportive',
      pacing_preference:
        profile.thinking.processing_speed === 'slow_deliberate' ? 'slow' : 'moderate',
      topic_transition: profile.thinking.detail_big_picture > 60 ? 'associative' : 'direct',
      closure_style:
        profile.meta_cognition.reflection_tendency > 60 ? 'integrative' : 'summarizing',
    },

    consciousness_integration: {
      awareness_reflections: profile.meta_cognition.self_awareness > 60,
      growth_tracking: profile.meta_cognition.growth_mindset > 70,
      pattern_recognition: profile.meta_cognition.reflection_tendency > 60,
      archetypal_references: profile.values.material_spiritual > 50,
    },
  }
}

/**
 * Map growth trajectory
 */
function mapGrowthTrajectory(
  surveyAnalysis: SurveyAnalysis,
  _dualChartSystem: DualChartSystem,
  enhancedPersonality: EnhancedPersonality
): GrowthTrajectory {
  const phases = generateGrowthPhases(surveyAnalysis.profile, enhancedPersonality)
  const evolutionTracking = assessEvolutionCapacity(surveyAnalysis.profile)

  return {
    phases,
    evolution_tracking: evolutionTracking,
  }
}

function generateGrowthPhases(
  _profile: ConsciousnessProfile,
  _enhancedPersonality: EnhancedPersonality
): GrowthTrajectory['phases'] {
  return [
    {
      phase_name: 'Foundation Building',
      duration_estimate: '2-4 weeks',
      goals: [
        'Establish communication rapport',
        'Understand core personality patterns',
        'Build trust and safety',
      ],
      milestones: [
        'Complete 50 interactions',
        'Achieve 70% alignment score',
        'Unlock first communication achievement',
      ],
      astrological_influences: ['Building on birth chart strengths'],
    },
    {
      phase_name: 'Consciousness Expansion',
      duration_estimate: '1-3 months',
      goals: ['Deepen self-awareness', 'Explore growth edges', 'Integrate new perspectives'],
      milestones: [
        'Reach level 25',
        'Complete consciousness exercises',
        'Achieve 80% in target training areas',
      ],
      astrological_influences: ['Working with current transits'],
    },
    {
      phase_name: 'Mastery Integration',
      duration_estimate: '3-6 months',
      goals: [
        'Embody authentic self-expression',
        'Master personality integration',
        'Become consciousness mirror for AI',
      ],
      milestones: [
        'Reach level 75+',
        'Achieve 90% overall alignment',
        'Unlock all core achievements',
      ],
      astrological_influences: ['Major transit integration', 'Return cycles'],
    },
  ]
}

function assessEvolutionCapacity(
  profile: ConsciousnessProfile
): GrowthTrajectory['evolution_tracking'] {
  return {
    self_awareness_growth: profile.meta_cognition.self_awareness,
    integration_capacity: calculateIntegrationCapacity(profile),
    transformation_readiness: calculateTransformationReadiness(profile),
    consciousness_expansion_rate: determineExpansionRate(profile),
  }
}

function calculateIntegrationCapacity(profile: ConsciousnessProfile): number {
  const factors = [
    profile.meta_cognition.reflection_tendency,
    profile.meta_cognition.growth_mindset,
    profile.dimensions.openness,
    profile.meta_cognition.adaptability,
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateTransformationReadiness(profile: ConsciousnessProfile): number {
  const factors = [
    profile.meta_cognition.growth_mindset,
    profile.meta_cognition.adaptability,
    profile.behavior.optimistic_realistic,
    100 - profile.dimensions.neuroticism, // Emotional stability
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function determineExpansionRate(profile: ConsciousnessProfile): 'slow' | 'moderate' | 'rapid' {
  const readiness = calculateTransformationReadiness(profile)
  if (readiness > 80) return 'rapid'
  if (readiness > 60) return 'moderate'
  return 'slow'
}
