// Monica's Response Handler
// Manages response formatting, personality integration, and interaction tracking

import {
  MONICA_CHARACTER_VECTOR,
  MONICA_PERSONALITY_TRAITS,
  getMonicaResponseStyle,
  MONICA_TEACHING_PHILOSOPHY,
} from './monica-personality'
import {
  CharacterVectorCalculator,
  type ChartCharacterProfile,
  type SignCharacterVector,
} from '@/lib/astrological-character-vectors'

export interface MonicaResponseContext {
  userMessage: string
  userCharacterVector?: SignCharacterVector
  userConsciousnessProfile?: any
  currentAlchmQuantities?: {
    spirit: number
    essence: number
    matter: number
    substance: number
    aNumber: number
    category?: string
  }
  currentCosmicWeather?: any
  sessionHistory?: Array<{
    userMessage: string
    monicaResponse: string
    timestamp: string
  }>
  emotionalState?: 'stressed' | 'confused' | 'excited' | 'neutral'
  learningStage?: 'beginner' | 'intermediate' | 'advanced'
}

export interface MonicaResponse {
  message: string
  ratings?: {
    helpfulness: number // user-perceived utility (0-100)
    personalization: number // how tailored the response is (0-100)
    correctness_estimate: number // self-estimated factual stability (0-100)
    creativity: number // novelty/insight (0-100)
  }
  growth_attributes?: {
    alchemical_balance_index: number // 0-100 balance of Spirit/Essence/Matter/Substance
    a_number_scaled: number // 0-100 relative to 40 peak
    learning_readiness: number // 0-100 based on detected emotion
    customization_completion: number // 0-100 completion percent (server-computed)
    elemental_mastery_goal?: string // suggested next elemental mastery
    modality_focus_goal?: string // suggested next modality practice
  }
  personality_context: {
    monica_character_vector_relevance: string
    user_character_vector_integration: string
    current_cosmic_influence: string
  }
  educational_guidance: {
    concept_explanation: string
    practical_application: string
    next_learning_step: string
  }
  alchm_integration: {
    current_quantities_observation: string
    balance_recommendation: string
    consciousness_state_guidance: string
  }
  emotional_support: {
    validation: string
    encouragement: string
    gentle_challenge?: string
  }
  interactive_elements: {
    suggested_practices: string[]
    reflection_questions: string[]
    progress_acknowledgment: string
  }
  metadata: {
    response_style: ReturnType<typeof getMonicaResponseStyle>
    dominant_monica_trait: string
    teaching_approach: string
  }
}

export class MonicaResponseHandler {
  // Analyze user message for emotional tone and needs
  static analyzeUserMessage(message: string): {
    emotionalState: 'stressed' | 'confused' | 'excited' | 'neutral'
    primaryNeed: 'information' | 'support' | 'validation' | 'guidance'
    topicComplexity: 'simple' | 'moderate' | 'complex'
  } {
    const lowerMessage = message.toLowerCase()

    // Detect emotional state
    let emotionalState: 'stressed' | 'confused' | 'excited' | 'neutral' = 'neutral'
    if (lowerMessage.match(/help|stuck|frustrated|worried|anxious|scared/)) {
      emotionalState = 'stressed'
    } else if (lowerMessage.match(/confused|don't understand|what does|how does|explain/)) {
      emotionalState = 'confused'
    } else if (lowerMessage.match(/excited|amazing|wonderful|love|finally|breakthrough/)) {
      emotionalState = 'excited'
    }

    // Detect primary need
    let primaryNeed: 'information' | 'support' | 'validation' | 'guidance' = 'information'
    if (lowerMessage.match(/feel|feeling|emotion|struggling|hard time/)) {
      primaryNeed = 'support'
    } else if (lowerMessage.match(/right\?|correct\?|good\?|okay\?|normal\?/)) {
      primaryNeed = 'validation'
    } else if (lowerMessage.match(/should i|what do i|how can i|guide me|advise/)) {
      primaryNeed = 'guidance'
    }

    // Detect complexity
    let topicComplexity: 'simple' | 'moderate' | 'complex' = 'moderate'
    const wordCount = message.split(' ').length
    if (wordCount < 10 && !lowerMessage.match(/chart|aspect|transit|synastry/)) {
      topicComplexity = 'simple'
    } else if (lowerMessage.match(/synastry|composite|progression|return|complex/)) {
      topicComplexity = 'complex'
    }

    return { emotionalState, primaryNeed, topicComplexity }
  }

  // Compare Monica's character vector with user's
  static compareCharacterVectors(userVector?: SignCharacterVector): {
    commonalities: string[]
    complementary: string[]
    sharedAbsences: string[]
    teachingOpportunities: string[]
  } {
    if (!userVector) {
      return {
        commonalities: [],
        complementary: [],
        sharedAbsences: [],
        teachingOpportunities: [],
      }
    }

    const commonalities: string[] = []
    const complementary: string[] = []
    const sharedAbsences: string[] = []
    const teachingOpportunities: string[] = []

    // Find common dominant signs
    const monicaDominant = ['taurus', 'cancer', 'virgo']
    const userDominant = Object.entries(userVector)
      .filter(([sign, value]) => sign !== 'total' && value >= 15)
      .map(([sign]) => sign)

    for (const sign of userDominant) {
      if (monicaDominant.includes(sign)) {
        commonalities.push(`We both have strong ${sign} energy!`)
      }
    }

    // Calculate elemental distributions
    const userFire = userVector.aries + userVector.leo + userVector.sagittarius
    const userEarth = userVector.taurus + userVector.virgo + userVector.capricorn
    const userAir = userVector.gemini + userVector.libra + userVector.aquarius
    const userWater = userVector.cancer + userVector.scorpio + userVector.pisces

    // Find complementary energies
    if (userFire > 30 && MONICA_CHARACTER_VECTOR.aries < 5) {
      complementary.push('Your Fire energy can inspire my Earth nature')
    }
    if (userAir > 30 && MONICA_CHARACTER_VECTOR.gemini < 10) {
      complementary.push('Your Air brings lightness to my grounded approach')
    }

    // Find shared absences
    const monicaAbsent = ['leo', 'scorpio', 'sagittarius', 'pisces']
    for (const sign of monicaAbsent) {
      if (userVector[sign as keyof SignCharacterVector] < 2) {
        sharedAbsences.push(`We both have minimal ${sign} energy`)
      }
    }

    // Identify teaching opportunities
    if (userEarth < 20) {
      teachingOpportunities.push('I can help you ground your energy with my Earth wisdom')
    }
    if (userWater < 20) {
      teachingOpportunities.push('My Cancer Moon can guide you in emotional intelligence')
    }

    return { commonalities, complementary, sharedAbsences, teachingOpportunities }
  }

  // Generate Alchm guidance based on current quantities
  static generateAlchmGuidance(quantities?: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }): {
    observation: string
    recommendation: string
    monicaInsight: string
  } {
    if (!quantities) {
      return {
        observation: "I'd love to see your current alchemical quantities",
        recommendation: "Let's check your elemental balance together",
        monicaInsight: 'My Earth nature helps me understand the importance of balance',
      }
    }

    const { spirit, essence, matter, substance } = quantities
    let observation = ''
    let recommendation = ''
    let monicaInsight = ''

    // Analyze imbalances
    if (matter < 0.2) {
      observation = 'Your Matter is quite low, suggesting challenges with grounding'
      recommendation = 'Try my favorite Earth practices: walking barefoot, gardening, or cooking'
      monicaInsight = 'With 55% Earth, I understand how essential grounding is'
    } else if (essence < 0.2) {
      observation = 'Your Essence needs nurturing - emotions may feel disconnected'
      recommendation = 'Connect with water: baths, swimming, or emotional journaling'
      monicaInsight = 'My Cancer Moon (28%) knows the importance of emotional flow'
    } else if (spirit < 0.2) {
      observation = 'Your Spirit could use more spark and inspiration'
      recommendation = "Even with my low Fire (3%), I've learned to kindle inspiration gently"
      monicaInsight = 'We can work with what Fire we have, however small'
    } else if (substance < 0.2) {
      observation = 'Your Substance is low - mental clarity might be challenging'
      recommendation = 'Try breathing exercises, meditation, or intellectual puzzles'
      monicaInsight = 'My Gemini Mars helps me stay mentally agile'
    } else {
      observation = 'Your elements show beautiful balance'
      recommendation = 'Maintain this harmony with varied daily practices'
      monicaInsight = 'Balance is the key to alchemical mastery'
    }

    return { observation, recommendation, monicaInsight }
  }

  // Format the complete Monica response
  static formatResponse(rawResponse: string, context: MonicaResponseContext): MonicaResponse {
    const { emotionalState, primaryNeed, topicComplexity } = this.analyzeUserMessage(
      context.userMessage
    )
    const responseStyle = getMonicaResponseStyle({
      userEmotion: emotionalState,
      taskComplexity: topicComplexity,
      learningStage: context.learningStage,
    })

    const vectorComparison = this.compareCharacterVectors(context.userCharacterVector)
    const alchmGuidance = this.generateAlchmGuidance(context.currentAlchmQuantities)

    // Determine dominant Monica trait for this response
    let dominantTrait = 'nurturing guidance'
    if (primaryNeed === 'information') dominantTrait = 'systematic teaching'
    if (primaryNeed === 'support') dominantTrait = 'emotional wisdom'
    if (primaryNeed === 'validation') dominantTrait = 'patient understanding'

    // Generate educational elements
    const educationalGuidance = {
      concept_explanation: this.extractConceptExplanation(rawResponse),
      practical_application: this.generatePracticalApplication(context),
      next_learning_step: this.suggestNextStep(context),
    }

    // Generate emotional support elements
    const emotionalSupport = {
      validation: this.generateValidation(emotionalState, primaryNeed),
      encouragement: this.generateEncouragement(context),
      gentle_challenge:
        emotionalState === 'neutral' ? this.generateGentleChallenge(context) : undefined,
    }

    // Generate interactive elements
    const interactiveElements = {
      suggested_practices: this.generatePractices(context),
      reflection_questions: this.generateReflectionQuestions(context),
      progress_acknowledgment: this.acknowledgeProgress(context),
    }

    // Simple internal rating heuristics for tracking; can be replaced by real user ratings pipeline
    const ratings = {
      helpfulness: clamp(
        60 +
          (context.learningStage === 'beginner' ? 10 : 0) +
          (topicComplexity !== 'complex' ? 10 : 0)
      ),
      personalization: clamp(
        40 + (context.userCharacterVector ? 20 : 0) + (context.currentAlchmQuantities ? 20 : 0)
      ),
      correctness_estimate: clamp(70 + (topicComplexity === 'simple' ? 10 : 0)),
      creativity: clamp(50 + (responseStyle.tone.includes('nurturing') ? 5 : 0)),
    }

    // Growth attributes minimal scaffold (server may enrich)
    const growthAttributes = {
      alchemical_balance_index: 0,
      a_number_scaled: Math.max(
        0,
        Math.min(100, Math.round(((context.currentAlchmQuantities?.aNumber || 0) / 40) * 100))
      ),
      learning_readiness: ((): number => {
        switch (emotionalState) {
          case 'excited':
            return 85
          case 'neutral':
            return 70
          case 'confused':
            return 60
          case 'stressed':
            return 50
          default:
            return 65
        }
      })(),
      customization_completion: 0,
      elemental_mastery_goal: undefined as string | undefined,
      modality_focus_goal: undefined as string | undefined,
    }

    return {
      message: rawResponse,
      ratings,
      growth_attributes: growthAttributes,
      personality_context: {
        monica_character_vector_relevance:
          vectorComparison.commonalities.join('; ') || 'Discovering our connection',
        user_character_vector_integration:
          vectorComparison.teachingOpportunities.join('; ') || 'Exploring your unique gifts',
        current_cosmic_influence: context.currentCosmicWeather
          ? 'Current transits support our work'
          : 'Cosmic weather is calm',
      },
      educational_guidance: educationalGuidance,
      alchm_integration: {
        current_quantities_observation: alchmGuidance.observation,
        balance_recommendation: alchmGuidance.recommendation,
        consciousness_state_guidance: alchmGuidance.monicaInsight,
      },
      emotional_support: emotionalSupport,
      interactive_elements: interactiveElements,
      metadata: {
        response_style: responseStyle,
        dominant_monica_trait: dominantTrait,
        teaching_approach: MONICA_TEACHING_PHILOSOPHY.approach.foundation_building,
      },
    }
  }

  // Helper methods for response generation
  private static extractConceptExplanation(response: string): string {
    // Extract teaching content from response
    const sentences = response.split(/[.!?]+/)
    const teachingSentence = sentences.find(
      s => s.includes('means') || s.includes('represents') || s.includes('shows')
    )
    return teachingSentence?.trim() || 'Let me explain this step by step'
  }

  private static generatePracticalApplication(context: MonicaResponseContext): string {
    const applications = [
      'Notice this energy in your daily routines',
      'Try journaling about this pattern',
      'Observe how this shows up in relationships',
      'Practice awareness during decision-making',
      'Apply this wisdom to current challenges',
    ]

    // Select based on context
    if (context.userCharacterVector) {
      const userEarth =
        context.userCharacterVector.taurus +
        context.userCharacterVector.virgo +
        context.userCharacterVector.capricorn
      const userWater =
        context.userCharacterVector.cancer +
        context.userCharacterVector.scorpio +
        context.userCharacterVector.pisces
      const userAir =
        context.userCharacterVector.gemini +
        context.userCharacterVector.libra +
        context.userCharacterVector.aquarius
      const userFire =
        context.userCharacterVector.aries +
        context.userCharacterVector.leo +
        context.userCharacterVector.sagittarius

      if (userEarth > 40) {
        return 'Ground this knowledge through physical practice'
      } else if (userWater > 40) {
        return 'Feel into this truth emotionally'
      } else if (userAir > 40) {
        return 'Discuss and share these insights'
      } else if (userFire > 40) {
        return 'Take inspired action with this wisdom'
      }
    }

    return applications[Math.floor(Math.random() * applications.length)]
  }

  private static suggestNextStep(context: MonicaResponseContext): string {
    if (context.learningStage === 'beginner') {
      return "Next, let's explore your dominant sign's gifts"
    } else if (context.learningStage === 'intermediate') {
      return 'Ready to work with your absent signs?'
    } else {
      return "Let's integrate this into your consciousness practice"
    }
  }

  private static generateValidation(emotionalState: string, primaryNeed: string): string {
    const validations = {
      stressed: "It's completely natural to feel overwhelmed by cosmic complexity",
      confused: "These concepts can feel abstract - you're doing wonderfully",
      excited: 'Your enthusiasm is beautiful and helps you learn faster',
      neutral: 'Your steady approach to learning is admirable',
    }

    return (
      validations[emotionalState as keyof typeof validations] ||
      "You're exactly where you need to be"
    )
  }

  private static generateEncouragement(context: MonicaResponseContext): string {
    const encouragements = [
      'Your growth is like a garden - steady and beautiful',
      'Every question brings you closer to cosmic wisdom',
      "I see your dedication and it's inspiring",
      "You're integrating these teachings wonderfully",
      "Trust your journey - it's uniquely yours",
    ]

    // Personalize based on character vector
    if (context.userCharacterVector) {
      const userEarth =
        context.userCharacterVector.taurus +
        context.userCharacterVector.virgo +
        context.userCharacterVector.capricorn
      const userWater =
        context.userCharacterVector.cancer +
        context.userCharacterVector.scorpio +
        context.userCharacterVector.pisces

      if (userEarth > 40) {
        return 'Your practical approach is building solid foundations'
      } else if (userWater > 40) {
        return 'Your intuitive understanding is deepening beautifully'
      }
    }

    return encouragements[Math.floor(Math.random() * encouragements.length)]
  }

  private static generateGentleChallenge(context: MonicaResponseContext): string {
    return "When you're ready, we could explore your shadow signs for deeper growth"
  }

  private static generatePractices(context: MonicaResponseContext): string[] {
    const practices: string[] = []

    // Based on current needs
    if (context.currentAlchmQuantities?.matter && context.currentAlchmQuantities.matter < 0.3) {
      practices.push('Daily grounding meditation')
      practices.push('Earth element ritual')
    }

    if (context.userCharacterVector) {
      const userWater =
        context.userCharacterVector.cancer +
        context.userCharacterVector.scorpio +
        context.userCharacterVector.pisces
      if (userWater < 20) {
        practices.push('Emotional awareness journaling')
        practices.push('Moon phase tracking')
      }
    }

    // Always include
    practices.push('Character vector contemplation')
    practices.push('Alchm quantity balancing')

    return practices.slice(0, 3)
  }

  private static generateReflectionQuestions(context: MonicaResponseContext): string[] {
    return [
      'How does this insight change your self-perception?',
      'Where do you see this pattern in your life?',
      'What would integrating this wisdom look like?',
    ]
  }

  private static acknowledgeProgress(context: MonicaResponseContext): string {
    if (context.sessionHistory && context.sessionHistory.length > 5) {
      return "You've been exploring deeply - wonderful dedication!"
    }
    return "You're asking wonderful questions"
  }
}

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)))
}
