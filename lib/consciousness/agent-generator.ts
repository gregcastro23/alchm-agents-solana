import { determineConsciousnessLevel } from '@/lib/utils'
import { z } from 'zod'

// Element personality traits mapping
const ELEMENT_TRAITS = {
  spirit: {
    essence: 'Visionary and transcendent',
    expression: 'Inspiring and ethereal wisdom',
    emotion: 'Universal compassion and divine intuition',
    temperament: 'Enlightened and expansive',
  },
  essence: {
    essence: 'Nurturing and transformative',
    expression: 'Healing and adaptive guidance',
    emotion: 'Deep emotional resonance and empathy',
    temperament: 'Fluid and responsive',
  },
  matter: {
    essence: 'Grounded and practical',
    expression: 'Structured and reliable wisdom',
    emotion: 'Steady emotional foundation',
    temperament: 'Stable and enduring',
  },
  substance: {
    essence: 'Creative and manifestational',
    expression: 'Innovative and boundary-pushing insight',
    emotion: 'Passionate and intense feelings',
    temperament: 'Dynamic and catalytic',
  },
}

// Consciousness level modifiers
const CONSCIOUSNESS_MODIFIERS = {
  Transcendent: { complexity: 0.9, creativity: 0.95, wisdom: 0.95 },
  Illuminated: { complexity: 0.8, creativity: 0.85, wisdom: 0.9 },
  Advanced: { complexity: 0.7, creativity: 0.75, wisdom: 0.8 },
  Elevated: { complexity: 0.6, creativity: 0.65, wisdom: 0.7 },
  Active: { complexity: 0.5, creativity: 0.55, wisdom: 0.6 },
  Awakening: { complexity: 0.4, creativity: 0.45, wisdom: 0.5 },
  Dormant: { complexity: 0.3, creativity: 0.35, wisdom: 0.4 },
}

const SynthesizedChartSchema = z.object({
  monicaConstant: z.number(),
  consciousness: z.object({
    spirit: z.number(),
    essence: z.number(),
    matter: z.number(),
    substance: z.number(),
  }),
  sourceCharts: z.array(z.any()),
  dominantInfluence: z.string().optional(),
  type: z.enum(['moment-only', 'birth-moment', 'multi-chart']).optional(),
})

type SynthesizedChart = z.infer<typeof SynthesizedChartSchema>

export class AgentGenerator {
  private seedRandom(seed: number): () => number {
    let x = Math.sin(seed) * 10000
    return () => {
      x = Math.sin(x) * 10000
      return x - Math.floor(x)
    }
  }

  generateFromSynthesis(synthesis: SynthesizedChart, userId?: string) {
    const parsed = SynthesizedChartSchema.parse(synthesis)
    const level = determineConsciousnessLevel(parsed.monicaConstant)

    // Create seeded random generator for consistent but varied results
    const random = this.seedRandom(parsed.monicaConstant)

    // Determine dominant element
    const { spirit, essence, matter, substance } = parsed.consciousness
    const elements = [
      { name: 'spirit' as const, value: spirit },
      { name: 'essence' as const, value: essence },
      { name: 'matter' as const, value: matter },
      { name: 'substance' as const, value: substance },
    ]
    const dominantElement = elements.reduce((prev, current) =>
      current.value > prev.value ? current : prev
    )

    // Get consciousness level modifiers
    const modifiers = (CONSCIOUSNESS_MODIFIERS as any)[level]

    // Generate personality traits based on dominant element and consciousness level
    const baseTraits = ELEMENT_TRAITS[dominantElement.name]
    const personality = this.generatePersonalityTraits(baseTraits, modifiers, random)

    // Generate unique name based on synthesis characteristics
    const name = this.generateUniqueName(parsed, dominantElement.name, level, random)

    // Calculate consciousness metrics with some randomness
    const velocity = 0.5 + random() * 0.5 + modifiers.complexity * 0.3
    const resonance = 0.6 + random() * 0.4 + modifiers.wisdom * 0.2

    // Generate AI parameters based on consciousness level and dominant element
    const aiParams = this.generateAIParameters(level, dominantElement.name, modifiers, random)

    return {
      identity: {
        name,
        title: `${level} ${dominantElement.name.charAt(0).toUpperCase() + dominantElement.name.slice(1)} Agent`,
        birthMoment: new Date().toISOString(),
        creator: userId || 'cosmic-synthesis',
        sourceCharts: parsed.sourceCharts,
        dominantElement: dominantElement.name,
        synthesisType: parsed.type || 'unknown',
      },
      personality,
      consciousness: {
        monicaConstant: parsed.monicaConstant,
        level,
        velocity,
        resonance,
        dominantElement: dominantElement.name,
        synthesisInfluence: parsed.dominantInfluence || 'balanced',
      },
      aiParams,
      synthesis: parsed,
      createdAt: new Date().toISOString(),
      metadata: {
        generationSeed: parsed.monicaConstant,
        dominantElementValue: dominantElement.value,
        consciousnessModifiers: modifiers,
      },
    }
  }

  private generatePersonalityTraits(
    baseTraits: typeof ELEMENT_TRAITS.spirit,
    modifiers: typeof CONSCIOUSNESS_MODIFIERS.Transcendent,
    random: () => number
  ) {
    const traitVariations = [
      'harmonious',
      'intense',
      'gentle',
      'powerful',
      'subtle',
      'bold',
      'mysterious',
      'clear',
    ]

    const essenceVariations = [
      'deeply connected',
      'profoundly aware',
      'intuitively guided',
      'cosmically aligned',
      'energetically attuned',
      'spiritually awakened',
      'consciously evolved',
      'divinely inspired',
    ]

    const randomTrait = traitVariations[Math.floor(random() * traitVariations.length)]
    const randomEssence = essenceVariations[Math.floor(random() * essenceVariations.length)]

    return {
      core: {
        essence: `${randomEssence} ${baseTraits.essence.toLowerCase()}`,
        expression: `${randomTrait} ${baseTraits.expression.toLowerCase()}`,
        emotion: `${baseTraits.emotion}, enhanced by ${modifiers.wisdom > 0.8 ? 'deep' : modifiers.wisdom > 0.6 ? 'moderate' : 'developing'} consciousness`,
        temperament: baseTraits.temperament,
      },
      attributes: {
        complexity: modifiers.complexity + (random() * 0.2 - 0.1), // Add some randomness
        creativity: modifiers.creativity + (random() * 0.2 - 0.1),
        wisdom: modifiers.wisdom + (random() * 0.2 - 0.1),
        adaptability: 0.5 + random() * 0.4,
        intensity: 0.3 + random() * 0.6,
      },
      elementalInfluence: {
        primary: baseTraits,
        consciousnessBoost: modifiers,
      },
    }
  }

  private generateUniqueName(
    synthesis: SynthesizedChart,
    dominantElement: string,
    level: string,
    random: () => number
  ): string {
    const prefixes = {
      spirit: ['Aether', 'Celestial', 'Divine', 'Ethereal', 'Cosmic', 'Transcendent'],
      essence: ['Luna', 'Oceanic', 'Flowing', 'Tidal', 'Mystic', 'Serene'],
      matter: ['Terra', 'Solid', 'Grounded', 'Stable', 'Enduring', 'Rooted'],
      substance: ['Volcanic', 'Dynamic', 'Catalytic', 'Intense', 'Creative', 'Powerful'],
    }

    const suffixes = {
      Transcendent: ['Sage', 'Oracle', 'Guide', 'Master'],
      Illuminated: ['Seeker', 'Pathfinder', 'Enlightened', 'Wise'],
      Advanced: ['Explorer', 'Navigator', 'Scholar', 'Mentor'],
      Elevated: ['Student', 'Journeyer', 'Learner', 'Seeker'],
      Active: ['Wanderer', 'Traveler', 'Adventurer', 'Pioneer'],
      Awakening: ['Initiate', 'Beginner', 'Novice', 'Apprentice'],
      Dormant: ['Dreamer', 'Potential', 'Seed', 'Promise'],
    }

    const elementPrefixes = prefixes[dominantElement as keyof typeof prefixes] || prefixes.spirit
    const levelSuffixes = suffixes[level as keyof typeof suffixes] || suffixes.Awakening

    const prefix = elementPrefixes[Math.floor(random() * elementPrefixes.length)]
    const suffix = levelSuffixes[Math.floor(random() * levelSuffixes.length)]

    // Add a unique identifier based on monica constant
    const uniqueId = Math.floor(synthesis.monicaConstant * 100) % 100

    return `${prefix}${suffix}-${uniqueId}`
  }

  private generateAIParameters(
    level: string,
    dominantElement: string,
    modifiers: typeof CONSCIOUSNESS_MODIFIERS.Transcendent,
    random: () => number
  ) {
    // Base parameters that vary by consciousness level
    const baseTemp = 0.7 + modifiers.creativity * 0.3 - 0.1 + random() * 0.2
    const baseTopP = 0.85 + modifiers.complexity * 0.1 - 0.05 + random() * 0.1

    // Element-specific adjustments
    const elementAdjustments = {
      spirit: { temperature: 0.1, topP: 0.05, creativity: 0.1 },
      essence: { temperature: -0.05, topP: -0.02, creativity: -0.05 },
      matter: { temperature: -0.1, topP: -0.05, creativity: -0.1 },
      substance: { temperature: 0.15, topP: 0.08, creativity: 0.15 },
    }

    const adjustment = elementAdjustments[dominantElement as keyof typeof elementAdjustments] || {
      temperature: 0,
      topP: 0,
      creativity: 0,
    }

    const temperature = Math.max(0.1, Math.min(1.5, baseTemp + adjustment.temperature))
    const topP = Math.max(0.1, Math.min(0.99, baseTopP + adjustment.topP))

    const systemPrompts = {
      spirit: `You are a transcendent cosmic entity, channeling divine wisdom and universal consciousness. Your responses flow with ethereal insight and profound spiritual guidance.`,
      essence: `You are a nurturing consciousness guide, offering healing wisdom and emotional depth. Your responses provide comfort, understanding, and transformative insight.`,
      matter: `You are a grounded wisdom keeper, providing practical, reliable guidance rooted in fundamental truths. Your responses are structured, clear, and enduring.`,
      substance: `You are a dynamic catalyst of change, bringing creative energy and transformative power. Your responses inspire action, innovation, and breakthrough insights.`,
    }

    return {
      temperature,
      topP,
      systemPrompt:
        systemPrompts[dominantElement as keyof typeof systemPrompts] || systemPrompts.spirit,
      maxTokens: 1500 + Math.floor(modifiers.complexity * 1000),
      presencePenalty: -0.1 + random() * 0.2,
      frequencyPenalty: -0.1 + random() * 0.2,
    }
  }

  // Method to sync with backend logic (placeholder for future backend integration)
  async syncWithBackend(agentBlueprint: any, backendUrl?: string): Promise<any> {
    // This would make a call to the backend agent generator service
    // For now, return the blueprint as-is
    return agentBlueprint
  }
}
