// Consciousness Survey Types for Personalized AI

export type SurveyQuestionType =
  | 'scale' // 1-7 scale
  | 'choice' // Single choice from options
  | 'multi' // Multiple choice
  | 'text' // Open text response
  | 'rank' // Rank items in order
  | 'slider' // Visual slider 0-100

export interface SurveyQuestion {
  id: string
  category: SurveyCategory
  type: SurveyQuestionType
  question: string
  description?: string
  options?: string[]
  min?: number
  max?: number
  maxLength?: number // For text inputs
  required: boolean
  weight: number // How much this affects personality (1-10)
}

export type SurveyCategory =
  | 'communication'
  | 'thinking_style'
  | 'emotional_patterns'
  | 'social_preferences'
  | 'learning_style'
  | 'values_beliefs'
  | 'behavioral_traits'
  | 'creative_expression'
  | 'decision_making'
  | 'life_philosophy'
  | 'astrological_foundation'

export interface SurveyResponse {
  questionId: string
  value: string | number | string[]
  confidence?: number // How confident user is in their answer (1-5)
}

export interface ConsciousnessSurvey {
  userId: string
  responses: SurveyResponse[]
  completedAt: string
  timeSpent: number // seconds
  version: string
}

export interface ConsciousnessProfile {
  // Core personality dimensions
  dimensions: {
    introversion_extraversion: number // 0-100
    sensing_intuition: number // 0-100
    thinking_feeling: number // 0-100
    judging_perceiving: number // 0-100
    openness: number // 0-100
    conscientiousness: number // 0-100
    agreeableness: number // 0-100
    neuroticism: number // 0-100
    assertiveness: number // 0-100
    emotional_stability: number // 0-100
  }

  // Communication preferences
  communication: {
    directness: number // 0-100
    formality: number // 0-100
    verbosity: number // 0-100
    emotional_expression: number // 0-100
    humor_style: 'dry' | 'playful' | 'witty' | 'gentle' | 'none'
    preferred_tone: 'casual' | 'professional' | 'friendly' | 'authoritative' | 'empathetic'
  }

  // Thinking patterns
  thinking: {
    analytical_intuitive: number // 0-100 (0=analytical, 100=intuitive)
    detail_big_picture: number // 0-100 (0=detail, 100=big picture)
    logical_emotional: number // 0-100 (0=logical, 100=emotional)
    structured_flexible: number // 0-100 (0=structured, 100=flexible)
    processing_speed: 'slow_deliberate' | 'moderate' | 'fast_decisive'
    problem_solving: 'systematic' | 'creative' | 'collaborative' | 'intuitive'
  }

  // Learning preferences
  learning: {
    visual_auditory_kinesthetic: 'visual' | 'auditory' | 'kinesthetic' | 'mixed'
    depth_breadth: number // 0-100 (0=depth, 100=breadth)
    theory_practice: number // 0-100 (0=theory, 100=practice)
    individual_collaborative: number // 0-100 (0=individual, 100=collaborative)
    feedback_style: 'direct' | 'gentle' | 'detailed' | 'encouraging'
  }

  // Values and motivations
  values: {
    achievement_harmony: number // 0-100
    security_adventure: number // 0-100
    tradition_innovation: number // 0-100
    independence_community: number // 0-100
    material_spiritual: number // 0-100
    competition_cooperation: number // 0-100
    primary_motivators: string[] // Top 3 motivating factors
  }

  // Behavioral patterns
  behavior: {
    routine_spontaneous: number // 0-100
    cautious_risk_taking: number // 0-100
    reserved_expressive: number // 0-100
    patient_urgent: number // 0-100
    optimistic_realistic: number // 0-100
    stress_response: 'withdraw' | 'seek_support' | 'take_action' | 'analyze'
    conflict_style: 'avoid' | 'accommodate' | 'compete' | 'compromise' | 'collaborate'
  }

  // Creative expression
  creativity: {
    artistic_logical: number // 0-100
    original_traditional: number // 0-100
    experimental_proven: number // 0-100
    creative_outlets: string[] // Preferred forms of creativity
    inspiration_sources: string[] // What inspires them
    writing_style: {
      tone: string // detected tone: poetic, direct, analytical, etc.
      complexity: number // 0-100 language sophistication
      creativity_level: number // 0-100 creative writing interest/ability
      sentence_structure: string // concise, flowing, etc.
      voice: string // expressive, thoughtful, authentic, etc.
      sample_text: string // excerpt from writing sample
    }
    language_complexity: number // 0-100 preferred vocabulary sophistication
    tarot_archetypal_profile: {
      primary_archetype: string // Main tarot archetype (The Fool, Magician, etc.)
      secondary_archetype: string // Supporting narrative role archetype
      elemental_ranking: string[] // Ordered preference for Fire, Water, Air, Earth
      planetary_alignment: string // Primary planetary timing preference
      alchemical_process: string // Preferred transformation process
      shadow_approach: string // How they integrate shadow aspects
      energy_transmission: string // How they communicate/transmit energy
      narrative_role: string // Life story archetype
      consciousness_signature: string // Seven-word personal truth
      tarot_personality_traits: string[] // Key traits from tarot analysis
    }
  }

  // Meta-awareness
  meta_cognition: {
    self_awareness: number // 0-100
    emotional_intelligence: number // 0-100
    adaptability: number // 0-100
    growth_mindset: number // 0-100
    reflection_tendency: number // 0-100
  }

  // Astrological foundation and alchemical consciousness
  astrological_foundation: {
    birth_data: {
      date: string // Birth date in YYYY-MM-DD format
      time: string | null // Birth time in HH:MM format or null
      location: string // Birth location (city, state, country)
      time_precision: string // Precision level of birth time
    }
    alchemical_self_assessment: {
      spirit_recognition: number // 1-7 self-assessed Spirit level
      essence_recognition: number // 1-7 self-assessed Essence level
      matter_recognition: number // 1-7 self-assessed Matter level
      substance_recognition: number // 1-7 self-assessed Substance level
    }
    planetary_dignity_self_assessment: {
      strongest_planet: string // Self-identified strongest planetary energy
      challenging_planet: string // Self-identified most challenging planetary energy
    }
    consciousness_state_preference: {
      thermodynamic_state: string // Current consciousness "temperature" state
      real_time_tracking_interest: string // Interest level in real-time consciousness stats
    }
  }
}

export interface PersonalityInsights {
  archetype: string
  strengths: string[]
  growth_areas: string[]
  communication_tips: string[]
  ideal_interaction_style: string
  potential_challenges: string[]
  ai_personality_adjustments: {
    tone_modifications: string[]
    content_preferences: string[]
    interaction_patterns: string[]
  }
}

export interface SurveyAnalysis {
  profile: ConsciousnessProfile
  insights: PersonalityInsights
  compatibility_score: number // How well AI can mirror this personality
  recommended_training_focus: string[]
  initial_conversation_starters: string[]
  personality_summary: string
}
