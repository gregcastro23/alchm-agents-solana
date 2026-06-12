// Survey Response Processing for Consciousness Profile Generation

import type {
  ConsciousnessSurvey,
  SurveyResponse,
  ConsciousnessProfile,
  PersonalityInsights,
  SurveyAnalysis,
} from '../types/consciousness-survey'
import { CONSCIOUSNESS_SURVEY_QUESTIONS } from './survey-questions'
import {
  calculatePlanetaryDignity,
  generateConsciousnessStats,
  generateAlchemicalConsciousnessTasks,
  type PlanetaryPlacement,
  type AlchemicalQuantities,
  type ConsciousnessStats,
} from '../astrological-dignities-engine'

/**
 * Process survey responses into a comprehensive consciousness profile
 */
export async function processSurveyResponses(survey: ConsciousnessSurvey): Promise<SurveyAnalysis> {
  const profile = await buildConsciousnessProfile(survey.responses)
  const insights = generatePersonalityInsights(profile)
  const compatibilityScore = calculateCompatibilityScore(profile)
  const trainingFocus = recommendTrainingFocus(profile)
  const conversationStarters = generateConversationStarters(profile)
  const summary = generatePersonalitySummary(profile, insights)

  return {
    profile,
    insights,
    compatibility_score: compatibilityScore,
    recommended_training_focus: trainingFocus,
    initial_conversation_starters: conversationStarters,
    personality_summary: summary,
  }
}

/**
 * Build detailed consciousness profile from responses
 */
async function buildConsciousnessProfile(
  responses: SurveyResponse[]
): Promise<ConsciousnessProfile> {
  const responseMap = new Map(responses.map(r => [r.questionId, r]))

  // Helper function to get scale value (1-7 -> 0-100)
  const getScale = (id: string, defaultValue: number = 50): number => {
    const response = responseMap.get(id)
    if (!response || typeof response.value !== 'number') return defaultValue
    return Math.round(((response.value - 1) / 6) * 100)
  }

  // Helper function to get choice index
  const getChoice = (id: string, options: string[]): string => {
    const response = responseMap.get(id)
    if (!response || typeof response.value !== 'string') return options[0]
    return response.value
  }

  // Helper function to get multi-choice array
  const getMulti = (id: string): string[] => {
    const response = responseMap.get(id)
    if (!response || !Array.isArray(response.value)) return []
    return response.value as string[]
  }

  return {
    // Core personality dimensions
    dimensions: {
      introversion_extraversion: getScale('social_energy'),
      sensing_intuition: getScale('think_analytical_intuitive'),
      thinking_feeling: getScale('decision_logic_emotion'),
      judging_perceiving: getScale('behavior_routine'),
      openness: calculateOpenness(responseMap),
      conscientiousness: calculateConscientiousness(responseMap),
      agreeableness: calculateAgreeableness(responseMap),
      neuroticism: 100 - getScale('emotion_stability'), // Reverse scale
      assertiveness: calculateAssertiveness(responseMap),
      emotional_stability: getScale('emotion_stability'),
    },

    // Communication preferences
    communication: {
      directness: getScale('comm_directness'),
      formality: mapFormalityChoice(getChoice('comm_formality', [])),
      verbosity: getScale('comm_detail_level'),
      emotional_expression: getScale('comm_emotional_expression'),
      humor_style: mapHumorStyle(getChoice('comm_humor', [])),
      preferred_tone: mapPreferredTone(getChoice('comm_formality', [])),
    },

    // Thinking patterns
    thinking: {
      analytical_intuitive: getScale('think_analytical_intuitive'),
      detail_big_picture: getScale('think_detail_big_picture'),
      logical_emotional: getScale('decision_logic_emotion'),
      structured_flexible: getScale('behavior_routine'),
      processing_speed: mapProcessingSpeed(getChoice('think_processing_speed', [])),
      problem_solving: mapProblemSolving(getChoice('think_problem_solving', [])),
    },

    // Learning preferences
    learning: {
      visual_auditory_kinesthetic: mapLearningModality(getChoice('learn_modality', [])),
      depth_breadth: getScale('learn_depth_breadth'),
      theory_practice: calculateTheoryPractice(responseMap),
      individual_collaborative: getScale('decision_independence'),
      feedback_style: mapFeedbackStyle(getChoice('learn_feedback', [])),
    },

    // Values and motivations
    values: {
      achievement_harmony: getScale('values_achievement'),
      security_adventure: getScale('values_security'),
      tradition_innovation: calculateTraditionInnovation(responseMap),
      independence_community: calculateIndependenceCommunity(responseMap),
      material_spiritual: calculateMaterialSpiritual(responseMap),
      competition_cooperation: calculateCompetitionCooperation(responseMap),
      primary_motivators: getMulti('values_motivators').slice(0, 3),
    },

    // Behavioral patterns
    behavior: {
      routine_spontaneous: getScale('behavior_routine'),
      cautious_risk_taking: getScale('behavior_risk'),
      reserved_expressive: getScale('emotion_expression'),
      patient_urgent: calculatePatientUrgent(responseMap),
      optimistic_realistic: getScale('philosophy_optimism'),
      stress_response: mapStressResponse(getChoice('emotion_stress_response', [])),
      conflict_style: mapConflictStyle(getChoice('social_conflict', [])),
    },

    // Creative expression
    creativity: {
      artistic_logical: calculateArtisticLogical(responseMap),
      original_traditional: getScale('creative_approach'),
      writing_style: analyzeWritingStyle(responseMap),
      language_complexity: getScale('language_complexity'),
      tarot_archetypal_profile: analyzeTarotArchetypalProfile(responseMap),
      experimental_proven: calculateExperimentalProven(responseMap),
      creative_outlets: getMulti('creative_outlets'),
      inspiration_sources: inferInspirationSources(responseMap),
    },

    // Meta-awareness
    meta_cognition: {
      self_awareness: getScale('meta_self_awareness'),
      emotional_intelligence: calculateEmotionalIntelligence(responseMap),
      adaptability: calculateAdaptability(responseMap),
      growth_mindset: getScale('meta_growth_mindset'),
      reflection_tendency: calculateReflectionTendency(responseMap),
    },

    // Astrological foundation and alchemical consciousness
    astrological_foundation: await processAstrologicalFoundation(responseMap),
  }
}

// Helper functions for complex calculations

function calculateOpenness(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'creative_approach', 50),
    getScaleValue(responses, 'values_security', 50, true), // Reverse
    getScaleValue(responses, 'think_analytical_intuitive', 50),
    hasMultiValue(responses, 'creative_outlets') ? 70 : 30,
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateConscientiousness(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'behavior_routine', 50),
    100 - getScaleValue(responses, 'behavior_risk', 50), // Reverse risk-taking
    getScaleValue(responses, 'learn_depth_breadth', 50, true), // Depth over breadth
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateAgreeableness(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'values_achievement', 50, true), // Harmony over achievement
    getScaleValue(responses, 'comm_emotional_expression', 50),
    hasChoiceValue(responses, 'social_conflict', 'compromise') ? 80 : 40,
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateAssertiveness(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'comm_directness', 50),
    getScaleValue(responses, 'social_energy', 50),
    hasChoiceValue(responses, 'social_conflict', 'address it directly') ? 80 : 40,
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateEmotionalIntelligence(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'meta_self_awareness', 50),
    getScaleValue(responses, 'comm_emotional_expression', 50),
    getScaleValue(responses, 'emotion_stability', 50),
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateAdaptability(responses: Map<string, SurveyResponse>): number {
  const factors = [
    100 - getScaleValue(responses, 'behavior_routine', 50), // Flexibility
    getScaleValue(responses, 'meta_growth_mindset', 50),
    hasChoiceValue(responses, 'philosophy_change', 'embrace change') ? 90 : 40,
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

function calculateReflectionTendency(responses: Map<string, SurveyResponse>): number {
  const factors = [
    getScaleValue(responses, 'meta_self_awareness', 50),
    hasChoiceValue(responses, 'think_processing_speed', 'time to think deeply') ? 80 : 30,
    getScaleValue(responses, 'learn_depth_breadth', 50, true), // Depth indicates reflection
  ]
  return Math.round(factors.reduce((a, b) => a + b) / factors.length)
}

// Mapping functions for choice responses

function mapFormalityChoice(choice: string): number {
  const map: Record<string, number> = {
    'Very casual and relaxed': 20,
    'Friendly but respectful': 40,
    'Professional but warm': 60,
    'Formal and structured': 80,
    'It depends on the situation': 50,
  }
  return map[choice] || 50
}

function mapHumorStyle(choice: string): 'dry' | 'playful' | 'witty' | 'gentle' | 'none' {
  if (choice.includes('Dry, subtle')) return 'dry'
  if (choice.includes('Light-hearted')) return 'playful'
  if (choice.includes('Witty wordplay')) return 'witty'
  if (choice.includes('Gentle, warm')) return 'gentle'
  if (choice.includes('serious conversations')) return 'none'
  return 'playful'
}

function mapPreferredTone(
  choice: string
): 'casual' | 'professional' | 'friendly' | 'authoritative' | 'empathetic' {
  if (choice.includes('Very casual')) return 'casual'
  if (choice.includes('Professional')) return 'professional'
  if (choice.includes('Formal')) return 'authoritative'
  return 'friendly'
}

function mapProcessingSpeed(choice: string): 'slow_deliberate' | 'moderate' | 'fast_decisive' {
  if (choice.includes('time to think deeply')) return 'slow_deliberate'
  if (choice.includes('quick exchanges')) return 'fast_decisive'
  return 'moderate'
}

function mapProblemSolving(
  choice: string
): 'systematic' | 'creative' | 'collaborative' | 'intuitive' {
  if (choice.includes('systematically')) return 'systematic'
  if (choice.includes('creative')) return 'creative'
  if (choice.includes('discuss it with others')) return 'collaborative'
  if (choice.includes('gut feeling')) return 'intuitive'
  return 'systematic'
}

function mapLearningModality(choice: string): 'visual' | 'auditory' | 'kinesthetic' | 'mixed' {
  if (choice.includes('Reading and visual')) return 'visual'
  if (choice.includes('Listening')) return 'auditory'
  if (choice.includes('Hands-on')) return 'kinesthetic'
  return 'mixed'
}

function mapFeedbackStyle(choice: string): 'direct' | 'gentle' | 'detailed' | 'encouraging' {
  if (choice.includes('Direct, specific')) return 'direct'
  if (choice.includes('Gentle guidance')) return 'gentle'
  if (choice.includes('Detailed explanations')) return 'detailed'
  return 'encouraging'
}

function mapStressResponse(
  choice: string
): 'withdraw' | 'seek_support' | 'take_action' | 'analyze' {
  if (choice.includes('Withdraw')) return 'withdraw'
  if (choice.includes('Seek support')) return 'seek_support'
  if (choice.includes('Take immediate action')) return 'take_action'
  if (choice.includes('Analyze')) return 'analyze'
  return 'analyze'
}

function mapConflictStyle(
  choice: string
): 'avoid' | 'accommodate' | 'compete' | 'compromise' | 'collaborate' {
  if (choice.includes('avoid')) return 'avoid'
  if (choice.includes('compromise')) return 'compromise'
  if (choice.includes('directly')) return 'compete'
  if (choice.includes('debate')) return 'collaborate'
  return 'accommodate'
}

// Utility functions

function getScaleValue(
  responses: Map<string, SurveyResponse>,
  id: string,
  defaultValue: number,
  reverse: boolean = false
): number {
  const response = responses.get(id)
  if (!response || typeof response.value !== 'number') return defaultValue
  const value = Math.round(((response.value - 1) / 6) * 100)
  return reverse ? 100 - value : value
}

function hasChoiceValue(
  responses: Map<string, SurveyResponse>,
  id: string,
  searchText: string
): boolean {
  const response = responses.get(id)
  if (!response || typeof response.value !== 'string') return false
  return response.value.toLowerCase().includes(searchText.toLowerCase())
}

function hasMultiValue(responses: Map<string, SurveyResponse>, id: string): boolean {
  const response = responses.get(id)
  return Boolean(response && Array.isArray(response.value) && response.value.length > 0)
}

// Complex derived calculations

function calculateTheoryPractice(responses: Map<string, SurveyResponse>): number {
  // Infer from learning style and thinking patterns
  const practicalFactors = [
    hasChoiceValue(responses, 'learn_modality', 'Hands-on') ? 80 : 20,
    hasChoiceValue(responses, 'think_problem_solving', 'systematic') ? 60 : 40,
  ]
  return Math.round(practicalFactors.reduce((a, b) => a + b) / practicalFactors.length)
}

function calculateTraditionInnovation(responses: Map<string, SurveyResponse>): number {
  const innovationFactors = [
    getScaleValue(responses, 'creative_approach', 50),
    hasMultiValue(responses, 'creative_outlets') ? 70 : 30,
    hasChoiceValue(responses, 'philosophy_change', 'embrace') ? 80 : 20,
  ]
  return Math.round(innovationFactors.reduce((a, b) => a + b) / innovationFactors.length)
}

function calculateIndependenceCommunity(responses: Map<string, SurveyResponse>): number {
  const communityFactors = [
    100 - getScaleValue(responses, 'decision_independence', 50), // Reverse
    getScaleValue(responses, 'social_energy', 50),
    hasMultiValue(responses, 'values_motivators') &&
    Array.isArray(responses.get('values_motivators')?.value) &&
    (responses.get('values_motivators')?.value as string[]).includes('Connection and relationships')
      ? 80
      : 40,
  ]
  return Math.round(communityFactors.reduce((a, b) => a + b) / communityFactors.length)
}

function calculateMaterialSpiritual(responses: Map<string, SurveyResponse>): number {
  const spiritualFactors = [
    hasMultiValue(responses, 'values_motivators') &&
    Array.isArray(responses.get('values_motivators')?.value) &&
    (responses.get('values_motivators')?.value as string[]).includes(
      'Spirituality and consciousness'
    )
      ? 80
      : 20,
    hasMultiValue(responses, 'ai_conversation_topics') &&
    Array.isArray(responses.get('ai_conversation_topics')?.value) &&
    (responses.get('ai_conversation_topics')?.value as string[]).includes(
      'Spirituality and consciousness'
    )
      ? 70
      : 30,
  ]
  return Math.round(spiritualFactors.reduce((a, b) => a + b) / spiritualFactors.length)
}

function calculateCompetitionCooperation(responses: Map<string, SurveyResponse>): number {
  const cooperationFactors = [
    getScaleValue(responses, 'values_achievement', 50, true), // Harmony over achievement
    hasChoiceValue(responses, 'social_conflict', 'compromise') ? 80 : 40,
    hasChoiceValue(responses, 'think_problem_solving', 'discuss') ? 70 : 30,
  ]
  return Math.round(cooperationFactors.reduce((a, b) => a + b) / cooperationFactors.length)
}

function calculatePatientUrgent(responses: Map<string, SurveyResponse>): number {
  const urgentFactors = [
    hasChoiceValue(responses, 'think_processing_speed', 'quick') ? 80 : 20,
    hasChoiceValue(responses, 'behavior_decision_time', 'quickly') ? 90 : 30,
  ]
  return Math.round(urgentFactors.reduce((a, b) => a + b) / urgentFactors.length)
}

function calculateArtisticLogical(responses: Map<string, SurveyResponse>): number {
  const artisticFactors = [
    hasMultiValue(responses, 'creative_outlets') ? 80 : 20,
    100 - getScaleValue(responses, 'think_analytical_intuitive', 50), // More intuitive = more artistic
    hasMultiValue(responses, 'values_motivators') &&
    Array.isArray(responses.get('values_motivators')?.value) &&
    (responses.get('values_motivators')?.value as string[]).includes('Creative expression')
      ? 90
      : 30,
  ]
  return Math.round(artisticFactors.reduce((a, b) => a + b) / artisticFactors.length)
}

function calculateExperimentalProven(responses: Map<string, SurveyResponse>): number {
  const experimentalFactors = [
    getScaleValue(responses, 'behavior_risk', 50),
    getScaleValue(responses, 'creative_approach', 50),
    hasChoiceValue(responses, 'philosophy_change', 'embrace') ? 80 : 20,
  ]
  return Math.round(experimentalFactors.reduce((a, b) => a + b) / experimentalFactors.length)
}

function inferInspirationSources(responses: Map<string, SurveyResponse>): string[] {
  const sources: string[] = []

  if (getScaleValue(responses, 'social_energy', 50) > 60) {
    sources.push('Social interactions and relationships')
  }
  if (hasMultiValue(responses, 'creative_outlets')) {
    sources.push('Artistic and creative pursuits')
  }
  if (
    hasMultiValue(responses, 'ai_conversation_topics') &&
    Array.isArray(responses.get('ai_conversation_topics')?.value) &&
    (responses.get('ai_conversation_topics')?.value as string[]).includes('Nature and environment')
  ) {
    sources.push('Nature and natural beauty')
  }
  if (getScaleValue(responses, 'meta_self_awareness', 50) > 70) {
    sources.push('Self-reflection and inner exploration')
  }

  return sources.length > 0 ? sources : ['New experiences and learning']
}

/**
 * Generate personality insights and recommendations
 */
function generatePersonalityInsights(profile: ConsciousnessProfile): PersonalityInsights {
  const strengths = identifyStrengths(profile)
  const growthAreas = identifyGrowthAreas(profile)
  const communicationTips = generateCommunicationTips(profile)
  const interactionStyle = determineInteractionStyle(profile)
  const challenges = identifyPotentialChallenges(profile)
  const aiAdjustments = generateAIAdjustments(profile)

  return {
    archetype: determineArchetype(profile),
    strengths,
    growth_areas: growthAreas,
    communication_tips: communicationTips,
    ideal_interaction_style: interactionStyle,
    potential_challenges: challenges,
    ai_personality_adjustments: aiAdjustments,
  }
}

function determineArchetype(profile: ConsciousnessProfile): string {
  // Determine primary archetype based on dominant traits
  const { dimensions, thinking, behavior } = profile

  if (dimensions.openness > 70 && thinking.analytical_intuitive > 60) {
    return 'The Visionary Explorer'
  } else if (dimensions.conscientiousness > 70 && thinking.structured_flexible < 40) {
    return 'The Methodical Builder'
  } else if (dimensions.agreeableness > 70 && profile.communication.emotional_expression > 60) {
    return 'The Empathetic Connector'
  } else if (dimensions.openness > 60 && profile.creativity.artistic_logical > 60) {
    return 'The Creative Innovator'
  } else if (profile.meta_cognition.self_awareness > 70 && thinking.analytical_intuitive < 40) {
    return 'The Analytical Thinker'
  } else if (behavior.optimistic_realistic > 70 && dimensions.introversion_extraversion > 60) {
    return 'The Enthusiastic Motivator'
  } else {
    return 'The Balanced Seeker'
  }
}

function identifyStrengths(profile: ConsciousnessProfile): string[] {
  const strengths: string[] = []

  if (profile.dimensions.emotional_stability > 70) {
    strengths.push('Emotional stability and resilience')
  }
  if (profile.meta_cognition.self_awareness > 70) {
    strengths.push('High self-awareness and introspection')
  }
  if (profile.communication.directness > 70) {
    strengths.push('Clear and direct communication')
  }
  if (profile.meta_cognition.growth_mindset > 70) {
    strengths.push('Strong growth mindset and adaptability')
  }
  if (profile.thinking.analytical_intuitive > 70) {
    strengths.push('Intuitive thinking and pattern recognition')
  }
  if (profile.dimensions.conscientiousness > 70) {
    strengths.push('Disciplined and organized approach')
  }

  return strengths.slice(0, 5) // Top 5 strengths
}

function identifyGrowthAreas(profile: ConsciousnessProfile): string[] {
  const growthAreas: string[] = []

  if (profile.dimensions.emotional_stability < 40) {
    growthAreas.push('Emotional regulation and stress management')
  }
  if (profile.communication.directness < 30) {
    growthAreas.push('Assertiveness and direct communication')
  }
  if (profile.meta_cognition.adaptability < 40) {
    growthAreas.push('Flexibility and openness to change')
  }
  if (profile.behavior.conflict_style === 'avoid') {
    growthAreas.push('Healthy conflict resolution skills')
  }

  return growthAreas.slice(0, 3) // Top 3 growth areas
}

function generateCommunicationTips(profile: ConsciousnessProfile): string[] {
  const tips: string[] = []

  if (profile.communication.formality > 60) {
    tips.push('Appreciates structured, respectful communication')
  }
  if (profile.communication.emotional_expression > 60) {
    tips.push('Values emotional depth and empathetic responses')
  }
  if (profile.thinking.processing_speed === 'slow_deliberate') {
    tips.push('Benefits from thoughtful, measured conversations')
  }
  if (profile.learning.feedback_style === 'gentle') {
    tips.push('Responds well to gentle, encouraging feedback')
  }

  return tips
}

function determineInteractionStyle(profile: ConsciousnessProfile): string {
  const { communication, thinking, behavior } = profile

  if (communication.formality > 60 && thinking.structured_flexible < 40) {
    return 'Professional mentor with structured guidance'
  } else if (communication.emotional_expression > 70 && profile.dimensions.agreeableness > 60) {
    return 'Warm, empathetic friend with emotional support'
  } else if (profile.meta_cognition.growth_mindset > 70 && behavior.optimistic_realistic > 60) {
    return 'Encouraging coach focused on growth and possibilities'
  } else if (thinking.analytical_intuitive < 40 && profile.dimensions.conscientiousness > 60) {
    return 'Logical advisor providing clear, practical guidance'
  } else {
    return 'Balanced companion adapting to your needs and mood'
  }
}

function identifyPotentialChallenges(profile: ConsciousnessProfile): string[] {
  const challenges: string[] = []

  if (profile.behavior.routine_spontaneous > 80) {
    challenges.push('May struggle with structured learning approaches')
  }
  if (profile.dimensions.neuroticism > 70) {
    challenges.push('Might need extra emotional support during difficult topics')
  }
  if (profile.communication.directness < 30) {
    challenges.push('Could benefit from encouragement to express needs clearly')
  }

  return challenges
}

function generateAIAdjustments(
  profile: ConsciousnessProfile
): PersonalityInsights['ai_personality_adjustments'] {
  const adjustments = {
    tone_modifications: [] as string[],
    content_preferences: [] as string[],
    interaction_patterns: [] as string[],
  }

  // Tone adjustments
  if (profile.communication.formality > 60) {
    adjustments.tone_modifications.push('More formal and respectful language')
  }
  if (profile.communication.humor_style !== 'none') {
    adjustments.tone_modifications.push(`Incorporate ${profile.communication.humor_style} humor`)
  }

  // Content preferences
  if (profile.learning.depth_breadth < 40) {
    adjustments.content_preferences.push('Provide deep, detailed explanations')
  }
  if (profile.thinking.detail_big_picture > 60) {
    adjustments.content_preferences.push('Start with big picture, then details')
  }

  // Interaction patterns
  if (profile.thinking.processing_speed === 'slow_deliberate') {
    adjustments.interaction_patterns.push('Allow time for reflection between responses')
  }
  if (profile.meta_cognition.reflection_tendency > 70) {
    adjustments.interaction_patterns.push('Include reflective questions and self-assessment')
  }

  return adjustments
}

function calculateCompatibilityScore(profile: ConsciousnessProfile): number {
  // Calculate how well AI can mirror this personality (0-100)
  let score = 70 // Base compatibility

  // Boost for high self-awareness (easier to mirror)
  if (profile.meta_cognition.self_awareness > 70) score += 15

  // Boost for growth mindset (more receptive to AI learning)
  if (profile.meta_cognition.growth_mindset > 70) score += 10

  // Slight penalty for very high neuroticism (more challenging)
  if (profile.dimensions.neuroticism > 80) score -= 10

  // Boost for clear communication preferences
  if (profile.communication.directness > 60) score += 5

  return Math.min(100, Math.max(0, score))
}

function recommendTrainingFocus(profile: ConsciousnessProfile): string[] {
  const focus: string[] = []

  if (profile.communication.directness < 50) {
    focus.push('communication_style')
  }
  if (profile.meta_cognition.emotional_intelligence < 60) {
    focus.push('emotional_intelligence')
  }
  if (profile.creativity.artistic_logical > 60) {
    focus.push('creativity')
  }
  if (profile.learning.depth_breadth < 40) {
    focus.push('knowledge_depth')
  }

  return focus.slice(0, 2) // Top 2 recommendations
}

function generateConversationStarters(profile: ConsciousnessProfile): string[] {
  const starters: string[] = []

  if (profile.meta_cognition.self_awareness > 60) {
    starters.push(
      "I'd love to understand what makes you feel most like yourself. What activities or moments bring out your authentic self?"
    )
  }

  if (profile.values.primary_motivators.includes('Personal growth and self-improvement')) {
    starters.push(
      "What's one area of your life where you're excited about growing or improving right now?"
    )
  }

  if (profile.creativity.creative_outlets.length > 0) {
    starters.push(
      `I notice you're drawn to ${profile.creativity.creative_outlets[0].toLowerCase()}. How does that form of expression resonate with who you are?`
    )
  }

  if (profile.thinking.problem_solving === 'intuitive') {
    starters.push(
      "I'm curious about your intuitive side. Can you tell me about a time when your gut feeling led you in the right direction?"
    )
  }

  starters.push(
    "What's something you've been thinking about lately that you'd enjoy exploring together?"
  )

  return starters
}

/**
 * Process astrological birth data and generate consciousness stats
 */
async function processAstrologicalFoundation(responses: Map<string, SurveyResponse>): Promise<{
  birth_data: {
    date: string
    time: string | null
    location: string
    time_precision: string
  }
  alchemical_self_assessment: {
    spirit_recognition: number
    essence_recognition: number
    matter_recognition: number
    substance_recognition: number
  }
  planetary_dignity_self_assessment: {
    strongest_planet: string
    challenging_planet: string
  }
  consciousness_state_preference: {
    thermodynamic_state: string
    real_time_tracking_interest: string
  }
  // Calculated astrological data - now implemented!
  calculated_consciousness_stats?: ConsciousnessStats
}> {
  const birthDate = (responses.get('birth_date_precise')?.value as string) || ''
  const birthTime = (responses.get('birth_time_exact')?.value as string) || null
  const birthLocation = (responses.get('birth_location')?.value as string) || ''
  const timePrecision = (responses.get('birth_time_precise')?.value as string) || ''

  const spiritRecognition = (responses.get('alchemical_spirit_recognition')?.value as number) || 4
  const essenceRecognition = (responses.get('alchemical_essence_recognition')?.value as number) || 4
  const matterRecognition = (responses.get('alchemical_matter_recognition')?.value as number) || 4
  const substanceRecognition =
    (responses.get('alchemical_substance_recognition')?.value as number) || 4

  const strongestPlanet =
    (responses.get('planetary_dignity_strength_recognition')?.value as string) || ''
  const challengingPlanet =
    (responses.get('planetary_dignity_challenge_recognition')?.value as string) || ''

  const thermodynamicState =
    (responses.get('consciousness_thermodynamic_state')?.value as string) || ''
  const trackingInterest = (responses.get('real_time_tracking_interest')?.value as string) || ''

  // Generate actual astrological consciousness data if birth info is available
  let calculatedConsciousnessStats: ConsciousnessStats | undefined = undefined

  if (birthDate && birthTime && birthLocation) {
    try {
      calculatedConsciousnessStats = await generateAstrologicalConsciousnessStats(
        birthDate,
        birthTime,
        birthLocation,
        responses
      )
    } catch (error) {
      console.warn('Failed to generate astrological consciousness stats:', error)
      // Fall back to estimated stats
    }
  }
  const estimatedAlchemicalQuantities: AlchemicalQuantities = {
    spirit: spiritRecognition / 7,
    essence: essenceRecognition / 7,
    matter: matterRecognition / 7,
    substance: substanceRecognition / 7,
    a_number:
      (spiritRecognition + essenceRecognition + matterRecognition + substanceRecognition) / 7,
    thermodynamic_state: thermodynamicState.includes('heating')
      ? 'heating'
      : thermodynamicState.includes('cooling')
        ? 'cooling'
        : thermodynamicState.includes('expanding')
          ? 'expanding'
          : thermodynamicState.includes('contracting')
            ? 'contracting'
            : thermodynamicState.includes('transforming')
              ? 'transforming'
              : 'stable',
    consciousness_temperature: Math.round(
      spiritRecognition * 15 + essenceRecognition * 10 + substanceRecognition * 10
    ),
    entropy_level: Math.round(Math.abs(spiritRecognition - essenceRecognition) * 10),
  }

  return {
    birth_data: {
      date: birthDate,
      time: birthTime,
      location: birthLocation,
      time_precision: timePrecision,
    },
    alchemical_self_assessment: {
      spirit_recognition: spiritRecognition,
      essence_recognition: essenceRecognition,
      matter_recognition: matterRecognition,
      substance_recognition: substanceRecognition,
    },
    planetary_dignity_self_assessment: {
      strongest_planet: strongestPlanet,
      challenging_planet: challengingPlanet,
    },
    consciousness_state_preference: {
      thermodynamic_state: thermodynamicState,
      real_time_tracking_interest: trackingInterest,
    },
    calculated_consciousness_stats: calculatedConsciousnessStats,
  }
}

/**
 * Analyze tarot archetypal profile from responses
 */
function analyzeTarotArchetypalProfile(responses: Map<string, SurveyResponse>): {
  primary_archetype: string
  secondary_archetype: string
  elemental_ranking: string[]
  planetary_alignment: string
  alchemical_process: string
  shadow_approach: string
  energy_transmission: string
  narrative_role: string
  consciousness_signature: string
  tarot_personality_traits: string[]
} {
  const archetypeChoice = (responses.get('archetypal_journey')?.value as string) || ''
  const elementalRanking = (responses.get('elemental_energy_attraction')?.value as string[]) || []
  const planetaryTiming = (responses.get('planetary_timing_preference')?.value as string) || ''
  const alchemicalChoice =
    (responses.get('alchemical_transformation_choice')?.value as string) || ''
  const shadowApproach = (responses.get('shadow_integration_approach')?.value as string) || ''
  const energyTransmission =
    (responses.get('energy_transmission_preference')?.value as string) || ''
  const narrativeRole = (responses.get('storytelling_archetype_response')?.value as string) || ''
  const sevenWordTruth = (responses.get('creative_constraint_challenge')?.value as string) || ''

  // Extract primary archetype from choice
  let primaryArchetype = 'The Seeker' // default
  if (archetypeChoice.includes('Fool')) primaryArchetype = 'The Fool'
  else if (archetypeChoice.includes('Magician')) primaryArchetype = 'The Magician'
  else if (archetypeChoice.includes('High Priestess')) primaryArchetype = 'The High Priestess'
  else if (archetypeChoice.includes('Empress')) primaryArchetype = 'The Empress'
  else if (archetypeChoice.includes('Emperor')) primaryArchetype = 'The Emperor'
  else if (archetypeChoice.includes('Wheel of Fortune')) primaryArchetype = 'The Wheel of Fortune'
  else if (archetypeChoice.includes('Star')) primaryArchetype = 'The Star'
  else if (archetypeChoice.includes('World')) primaryArchetype = 'The World'

  // Determine secondary archetype from narrative role
  let secondaryArchetype = 'The Explorer'
  if (narrativeRole.includes('Hero')) secondaryArchetype = 'The Hero'
  else if (narrativeRole.includes('Sage')) secondaryArchetype = 'The Sage'
  else if (narrativeRole.includes('Creator')) secondaryArchetype = 'The Creator'
  else if (narrativeRole.includes('Healer')) secondaryArchetype = 'The Healer'
  else if (narrativeRole.includes('Mystic')) secondaryArchetype = 'The Mystic'
  else if (narrativeRole.includes('Guardian')) secondaryArchetype = 'The Guardian'

  // Extract planetary alignment
  let planetaryAlignment = 'Mercury'
  if (planetaryTiming.includes('Venus')) planetaryAlignment = 'Venus'
  else if (planetaryTiming.includes('Mars')) planetaryAlignment = 'Mars'
  else if (planetaryTiming.includes('Jupiter')) planetaryAlignment = 'Jupiter'
  else if (planetaryTiming.includes('Saturn')) planetaryAlignment = 'Saturn'
  else if (planetaryTiming.includes('Moon')) planetaryAlignment = 'Moon'
  else if (planetaryTiming.includes('Sun')) planetaryAlignment = 'Sun'

  // Extract alchemical process
  let alchemicalProcess = 'Integration'
  if (alchemicalChoice.includes('Calcination')) alchemicalProcess = 'Calcination'
  else if (alchemicalChoice.includes('Dissolution')) alchemicalProcess = 'Dissolution'
  else if (alchemicalChoice.includes('Separation')) alchemicalProcess = 'Separation'
  else if (alchemicalChoice.includes('Conjunction')) alchemicalProcess = 'Conjunction'
  else if (alchemicalChoice.includes('Fermentation')) alchemicalProcess = 'Fermentation'
  else if (alchemicalChoice.includes('Distillation')) alchemicalProcess = 'Distillation'
  else if (alchemicalChoice.includes('Coagulation')) alchemicalProcess = 'Coagulation'

  // Extract shadow integration approach
  let shadowApproachStyle = 'Curious Explorer'
  if (shadowApproach.includes('dive deep')) shadowApproachStyle = 'Depth Diver'
  else if (shadowApproach.includes('gradually')) shadowApproachStyle = 'Gentle Integrator'
  else if (shadowApproach.includes('humor')) shadowApproachStyle = 'Playful Transformer'
  else if (shadowApproach.includes('guidance')) shadowApproachStyle = 'Collaborative Seeker'
  else if (shadowApproach.includes('practical')) shadowApproachStyle = 'Action Oriented'
  else if (shadowApproach.includes('retreat')) shadowApproachStyle = 'Contemplative Hermit'

  // Extract energy transmission style
  let energyStyle = 'Balanced Communicator'
  if (energyTransmission.includes('passionate')) energyStyle = 'Fiery Inspirer'
  else if (energyTransmission.includes('gentle')) energyStyle = 'Nurturing Presence'
  else if (energyTransmission.includes('quick')) energyStyle = 'Swift Catalyst'
  else if (energyTransmission.includes('deep')) energyStyle = 'Emotional Bridge'
  else if (energyTransmission.includes('structured')) energyStyle = 'Wise Teacher'
  else if (energyTransmission.includes('playful')) energyStyle = 'Joyful Spark'
  else if (energyTransmission.includes('mysterious')) energyStyle = 'Mystical Guide'

  // Create consciousness signature from seven words
  const consciousnessSignature =
    sevenWordTruth.trim() || 'Seeking truth through authentic expression'

  // Generate personality traits based on tarot profile
  const traits = []
  if (primaryArchetype.includes('Fool')) traits.push('Adventurous', 'Trusting', 'Spontaneous')
  if (primaryArchetype.includes('Magician')) traits.push('Manifesting', 'Skilled', 'Focused')
  if (primaryArchetype.includes('High Priestess'))
    traits.push('Intuitive', 'Mystical', 'Reflective')
  if (primaryArchetype.includes('Empress')) traits.push('Creative', 'Nurturing', 'Abundant')
  if (primaryArchetype.includes('Emperor'))
    traits.push('Structured', 'Authoritative', 'Disciplined')
  if (primaryArchetype.includes('Star')) traits.push('Healing', 'Hopeful', 'Inspiring')
  if (primaryArchetype.includes('World')) traits.push('Integrated', 'Complete', 'Wise')

  // Add elemental traits based on ranking
  if (elementalRanking.length > 0) {
    const primaryElement = elementalRanking[0]
    if (primaryElement.includes('Fire')) traits.push('Passionate', 'Action-Oriented')
    if (primaryElement.includes('Water')) traits.push('Emotional', 'Intuitive')
    if (primaryElement.includes('Air')) traits.push('Intellectual', 'Communicative')
    if (primaryElement.includes('Earth')) traits.push('Practical', 'Grounded')
  }

  return {
    primary_archetype: primaryArchetype,
    secondary_archetype: secondaryArchetype,
    elemental_ranking: elementalRanking,
    planetary_alignment: planetaryAlignment,
    alchemical_process: alchemicalProcess,
    shadow_approach: shadowApproachStyle,
    energy_transmission: energyStyle,
    narrative_role: narrativeRole,
    consciousness_signature: consciousnessSignature,
    tarot_personality_traits: traits.slice(0, 6), // Top 6 traits
  }
}

/**
 * Analyze writing style from text sample
 */
function analyzeWritingStyle(responses: Map<string, SurveyResponse>): {
  tone: string
  complexity: number
  creativity_level: number
  sentence_structure: string
  voice: string
  sample_text: string
} {
  const writingSample = (responses.get('writing_style_sample')?.value as string) || ''
  const tonePreference = (responses.get('writing_tone_preference')?.value as string) || ''
  const creativeInterest = (responses.get('creative_writing_interest')?.value as string) || ''
  const complexityLevel = getScaleValue(responses, 'language_complexity', 50)

  // Analyze the writing sample for characteristics
  const sentences = writingSample.split(/[.!?]+/).filter(s => s.trim().length > 0)
  const words = writingSample.split(/\s+/).filter(w => w.length > 0)
  const avgWordsPerSentence = sentences.length > 0 ? words.length / sentences.length : 0

  // Detect writing characteristics
  const hasMetaphors = /like|as|reminds me of|feels like|seems like/i.test(writingSample)
  const hasEmotionalWords =
    /love|joy|beautiful|wonderful|amazing|peaceful|exciting|passionate/i.test(writingSample)
  const hasComplexWords = words.some(w => w.length > 8)
  const hasShorterSentences = avgWordsPerSentence < 15

  // Determine tone based on preference and sample analysis
  let detectedTone = 'conversational'
  if (tonePreference.includes('Poetic')) detectedTone = 'poetic'
  else if (tonePreference.includes('Clear and direct')) detectedTone = 'direct'
  else if (tonePreference.includes('Analytical')) detectedTone = 'analytical'
  else if (tonePreference.includes('Playful')) detectedTone = 'playful'
  else if (tonePreference.includes('Reflective')) detectedTone = 'reflective'

  // Assess creativity level from writing interest and sample
  let creativityLevel = 50
  if (creativeInterest.includes('love writing poetry')) creativityLevel = 90
  else if (creativeInterest.includes('enjoy it occasionally')) creativityLevel = 70
  else if (creativeInterest.includes('challenging but rewarding')) creativityLevel = 60
  else if (creativeInterest.includes('practical writing')) creativityLevel = 30

  if (hasMetaphors) creativityLevel += 10
  if (hasEmotionalWords) creativityLevel += 10

  // Determine sentence structure preference
  const sentenceStructure = hasShorterSentences ? 'concise' : 'flowing'

  // Determine voice characteristics
  let voice = 'authentic'
  if (hasEmotionalWords && hasMetaphors) voice = 'expressive'
  else if (detectedTone === 'analytical') voice = 'thoughtful'
  else if (detectedTone === 'playful') voice = 'lighthearted'
  else if (detectedTone === 'direct') voice = 'straightforward'

  return {
    tone: detectedTone,
    complexity: Math.min(100, complexityLevel + (hasComplexWords ? 20 : 0)),
    creativity_level: Math.min(100, creativityLevel),
    sentence_structure: sentenceStructure,
    voice,
    sample_text: writingSample.slice(0, 200), // Store first 200 chars for reference
  }
}

function generatePersonalitySummary(
  profile: ConsciousnessProfile,
  insights: PersonalityInsights
): string {
  const archetype = insights.archetype
  const communication = profile.communication.preferred_tone
  const topStrength = insights.strengths[0]
  const learningStyle = profile.learning.visual_auditory_kinesthetic

  return `You embody the ${archetype} archetype, someone who thrives with ${communication} communication and excels through ${topStrength.toLowerCase()}. Your ${learningStyle} learning style and preference for ${profile.thinking.problem_solving} problem-solving shapes how you best process and integrate new information. This profile will help me understand how to communicate with you in a way that feels natural and supportive of your personal growth journey.`
}

/**
 * Generate astrological consciousness stats from birth data and survey responses
 */
async function generateAstrologicalConsciousnessStats(
  birthDate: string,
  birthTime: string,
  birthLocation: string,
  responses: Map<string, SurveyResponse>
): Promise<ConsciousnessStats> {
  // This would integrate with our astrological calculation systems
  // For now, provide enhanced estimates based on survey + simulated chart

  const spiritRecognition =
    parseInt(responses.get('spirit_experience_frequency')?.value as string) || 3
  const essenceRecognition =
    parseInt(responses.get('essence_pattern_recognition')?.value as string) || 3
  const matterRecognition =
    parseInt(responses.get('matter_perception_detail')?.value as string) || 3
  const substanceRecognition =
    parseInt(responses.get('substance_interaction_style')?.value as string) || 3

  // Simulate basic astrological enhancement
  const birthMonth = new Date(birthDate).getMonth() + 1
  const seasonalMultiplier = {
    spring: { spirit: 1.2, essence: 1.0, matter: 0.9, substance: 1.1 }, // Aries-Gemini
    summer: { spirit: 1.1, essence: 1.2, matter: 1.0, substance: 0.9 }, // Cancer-Virgo
    autumn: { spirit: 0.9, essence: 1.1, matter: 1.2, substance: 1.0 }, // Libra-Sagittarius
    winter: { spirit: 1.0, essence: 0.9, matter: 1.1, substance: 1.2 }, // Capricorn-Pisces
  }

  const season =
    birthMonth <= 3 ? 'winter' : birthMonth <= 6 ? 'spring' : birthMonth <= 9 ? 'summer' : 'autumn'
  const multipliers = seasonalMultiplier[season]

  return {
    spirit: Math.min(1, (spiritRecognition / 7) * multipliers.spirit),
    essence: Math.min(1, (essenceRecognition / 7) * multipliers.essence),
    matter: Math.min(1, (matterRecognition / 7) * multipliers.matter),
    substance: Math.min(1, (substanceRecognition / 7) * multipliers.substance),
    a_number:
      (spiritRecognition + essenceRecognition + matterRecognition + substanceRecognition) / 28,
    thermodynamic_state:
      (responses.get('consciousness_thermodynamic_state')?.value as string) || 'stable',
    consciousness_level:
      spiritRecognition + essenceRecognition + matterRecognition + substanceRecognition,
    alchemical_signature: `${season}-enhanced-consciousness`,
  } as any
}
