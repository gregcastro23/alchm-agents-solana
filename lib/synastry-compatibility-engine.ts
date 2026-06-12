// Synastry and Compatibility Analysis Engine
// Advanced relationship dynamics through astrological chart comparison

import type { PlanetaryPlacement } from './astrological-dignities-engine'
import type { BirthChartFeature } from './astrological-education-engine'

export interface SynastryChart {
  person1: {
    name: string
    birth_data: {
      date: string
      time: string | null
      location: string
    }
    chart_features: BirthChartFeature[]
    planetary_placements: PlanetaryPlacement[]
    elemental_emphasis: ElementalProfile
    modal_emphasis: ModalProfile
  }
  person2: {
    name: string
    birth_data: {
      date: string
      time: string | null
      location: string
    }
    chart_features: BirthChartFeature[]
    planetary_placements: PlanetaryPlacement[]
    elemental_emphasis: ElementalProfile
    modal_emphasis: ModalProfile
  }
}

export interface ElementalProfile {
  fire: number // 0-100 percentage
  earth: number // 0-100 percentage
  air: number // 0-100 percentage
  water: number // 0-100 percentage
  dominant_element: string
  secondary_element: string
}

export interface ModalProfile {
  cardinal: number // 0-100 percentage
  fixed: number // 0-100 percentage
  mutable: number // 0-100 percentage
  dominant_mode: string
}

export interface SynastryAspect {
  id: string
  planet1: string
  planet2: string
  person1: string
  person2: string
  aspect_type: 'conjunction' | 'opposition' | 'trine' | 'square' | 'sextile' | 'quincunx'
  orb: number
  exact_degrees: number
  aspect_strength: number // 0-100
  harmony_rating: number // 0-100
  growth_potential: number // 0-100
  description: string
  relationship_themes: string[]
  consciousness_lessons: string[]
}

export interface CompositeChart {
  midpoint_placements: PlanetaryPlacement[]
  relationship_purpose: string
  collective_strengths: string[]
  shared_challenges: string[]
  growth_opportunities: string[]
  elemental_balance: ElementalProfile
  modal_balance: ModalProfile
  consciousness_evolution_theme: string
}

export interface CompatibilityAnalysis {
  overall_compatibility: number // 0-100
  elemental_harmony: number // 0-100
  modal_compatibility: number // 0-100
  communication_style_match: number // 0-100
  emotional_compatibility: number // 0-100
  values_alignment: number // 0-100
  growth_catalyst_potential: number // 0-100

  strengths: RelationshipStrength[]
  challenges: RelationshipChallenge[]
  recommendations: RelationshipRecommendation[]
  consciousness_development_areas: string[]
  universal_lesson: string
}

export interface RelationshipStrength {
  area: string
  description: string
  astrological_basis: string[]
  manifestation_examples: string[]
  enhancement_suggestions: string[]
}

export interface RelationshipChallenge {
  area: string
  description: string
  astrological_basis: string[]
  growth_opportunities: string[]
  integration_practices: string[]
  conscious_awareness_points: string[]
}

export interface RelationshipRecommendation {
  category: 'communication' | 'emotional' | 'spiritual' | 'practical' | 'creative'
  title: string
  description: string
  specific_practices: string[]
  astrological_timing: string
  success_indicators: string[]
}

export interface SynastryReport {
  synastry_chart: SynastryChart
  major_aspects: SynastryAspect[]
  composite_chart: CompositeChart
  compatibility_analysis: CompatibilityAnalysis
  relationship_timeline: RelationshipPhase[]
  consciousness_evolution_map: ConsciousnessEvolutionStage[]
  practical_guidance: PracticalRelationshipGuidance
}

export interface RelationshipPhase {
  phase_name: string
  timeframe: string
  key_themes: string[]
  astrological_influences: string[]
  consciousness_focus: string
  recommended_practices: string[]
  potential_challenges: string[]
  growth_opportunities: string[]
}

export interface ConsciousnessEvolutionStage {
  stage_name: string
  description: string
  individual_growth_person1: string[]
  individual_growth_person2: string[]
  collective_evolution: string[]
  universal_principle: string
  integration_practices: string[]
}

export interface PracticalRelationshipGuidance {
  daily_practices: string[]
  communication_strategies: string[]
  conflict_resolution_approaches: string[]
  intimacy_enhancement: string[]
  shared_goal_setting: string[]
  spiritual_practices: string[]
  creative_collaboration_ideas: string[]
}

// SYNASTRY ANALYSIS ENGINE
export class SynastryAnalysisEngine {
  static generateSynastryReport(synastryChart: SynastryChart): SynastryReport {
    const aspects = this.calculateMajorAspects(synastryChart)
    const composite = this.generateCompositeChart(synastryChart)
    const compatibility = this.analyzeCompatibility(synastryChart, aspects)
    const timeline = this.generateRelationshipTimeline(synastryChart)
    const evolutionMap = this.createConsciousnessEvolutionMap(synastryChart, compatibility)
    const guidance = this.generatePracticalGuidance(synastryChart, compatibility)

    return {
      synastry_chart: synastryChart,
      major_aspects: aspects,
      composite_chart: composite,
      compatibility_analysis: compatibility,
      relationship_timeline: timeline,
      consciousness_evolution_map: evolutionMap,
      practical_guidance: guidance,
    }
  }

  static calculateMajorAspects(synastryChart: SynastryChart): SynastryAspect[] {
    const aspects: SynastryAspect[] = []

    // Key synastry aspects to analyze
    const importantPlanets = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter']

    for (const planet1 of importantPlanets) {
      for (const planet2 of importantPlanets) {
        // Cross-aspects between the two charts
        const aspect = this.calculatePlanetaryAspect(
          planet1,
          planet2,
          synastryChart.person1.name,
          synastryChart.person2.name
        )
        if (aspect) {
          aspects.push(aspect)
        }
      }
    }

    return aspects.sort((a, b) => b.aspect_strength - a.aspect_strength)
  }

  private static calculatePlanetaryAspect(
    planet1: string,
    planet2: string,
    person1: string,
    person2: string
  ): SynastryAspect | null {
    // This would normally calculate actual degrees and aspects
    // For demonstration, we'll create example aspects

    const aspectExamples: Record<string, Partial<SynastryAspect>> = {
      sun_moon: {
        aspect_type: 'trine',
        harmony_rating: 90,
        growth_potential: 85,
        description: 'Beautiful harmony between conscious identity and emotional nature',
        relationship_themes: [
          'Emotional understanding',
          'Natural compatibility',
          'Supportive energy',
        ],
        consciousness_lessons: [
          'Integration of masculine/feminine principles',
          'Balance of expression and reception',
        ],
      },
      venus_mars: {
        aspect_type: 'conjunction',
        harmony_rating: 85,
        growth_potential: 80,
        description: 'Strong romantic and sexual attraction with dynamic creative energy',
        relationship_themes: ['Passionate attraction', 'Creative collaboration', 'Dynamic tension'],
        consciousness_lessons: [
          'Balance of giving and receiving',
          'Integration of love and desire',
        ],
      },
      mercury_mercury: {
        aspect_type: 'sextile',
        harmony_rating: 75,
        growth_potential: 70,
        description: 'Easy communication and intellectual compatibility',
        relationship_themes: ['Mental stimulation', 'Shared interests', 'Clear communication'],
        consciousness_lessons: ['Learning through dialogue', 'Expanding perspectives together'],
      },
    }

    const key = `${planet1}_${planet2}`
    const template = aspectExamples[key]

    if (!template) return null

    return {
      id: `${person1}_${planet1}_${person2}_${planet2}`,
      planet1,
      planet2,
      person1,
      person2,
      orb: 3.5,
      exact_degrees: 120,
      aspect_strength: 85,
      ...template,
    } as SynastryAspect
  }

  static generateCompositeChart(synastryChart: SynastryChart): CompositeChart {
    // Calculate midpoints between planetary positions
    // This would involve complex astronomical calculations

    return {
      midpoint_placements: [], // Would be calculated from actual chart data
      relationship_purpose: this.determineRelationshipPurpose(synastryChart),
      collective_strengths: this.identifyCollectiveStrengths(synastryChart),
      shared_challenges: this.identifySharedChallenges(synastryChart),
      growth_opportunities: this.identifyGrowthOpportunities(synastryChart),
      elemental_balance: this.calculateCompositeElementalBalance(synastryChart),
      modal_balance: this.calculateCompositeModalBalance(synastryChart),
      consciousness_evolution_theme: this.determineEvolutionTheme(synastryChart),
    }
  }

  private static determineRelationshipPurpose(synastryChart: SynastryChart): string {
    const person1Elements = synastryChart.person1.elemental_emphasis
    const person2Elements = synastryChart.person2.elemental_emphasis

    if (
      person1Elements.dominant_element === 'fire' &&
      person2Elements.dominant_element === 'water'
    ) {
      return 'To create passionate emotional depth and learn the dance between action and feeling'
    }
    if (
      person1Elements.dominant_element === 'air' &&
      person2Elements.dominant_element === 'earth'
    ) {
      return 'To manifest visionary ideas into practical reality and bridge heaven and earth'
    }

    return "To support each other's unique expression while growing in universal consciousness"
  }

  private static identifyCollectiveStrengths(_synastryChart: SynastryChart): string[] {
    return [
      'Complementary elemental energies create dynamic balance',
      'Shared commitment to personal and spiritual growth',
      "Natural ability to support each other's authentic expression",
      'Strong foundation for creative collaboration',
    ]
  }

  private static identifySharedChallenges(_synastryChart: SynastryChart): string[] {
    return [
      'Learning to honor different pacing and processing styles',
      'Balancing individual needs with relationship harmony',
      'Integrating different approaches to decision-making',
      'Navigating intensity without losing individual identity',
    ]
  }

  private static identifyGrowthOpportunities(_synastryChart: SynastryChart): string[] {
    return [
      'Developing greater emotional intelligence through relationship',
      'Learning to communicate across different elemental languages',
      "Expanding comfort zones through partner's influence",
      'Creating something greater than either could achieve alone',
    ]
  }

  private static calculateCompositeElementalBalance(
    synastryChart: SynastryChart
  ): ElementalProfile {
    const p1 = synastryChart.person1.elemental_emphasis
    const p2 = synastryChart.person2.elemental_emphasis

    return {
      fire: (p1.fire + p2.fire) / 2,
      earth: (p1.earth + p2.earth) / 2,
      air: (p1.air + p2.air) / 2,
      water: (p1.water + p2.water) / 2,
      dominant_element: 'balanced',
      secondary_element: 'integrated',
    }
  }

  private static calculateCompositeModalBalance(synastryChart: SynastryChart): ModalProfile {
    const p1 = synastryChart.person1.modal_emphasis
    const p2 = synastryChart.person2.modal_emphasis

    return {
      cardinal: (p1.cardinal + p2.cardinal) / 2,
      fixed: (p1.fixed + p2.fixed) / 2,
      mutable: (p1.mutable + p2.mutable) / 2,
      dominant_mode: 'balanced',
    }
  }

  private static determineEvolutionTheme(_synastryChart: SynastryChart): string {
    return 'Learning to love unconditionally while maintaining authentic self-expression'
  }

  static analyzeCompatibility(
    synastryChart: SynastryChart,
    aspects: SynastryAspect[]
  ): CompatibilityAnalysis {
    const elementalHarmony = this.calculateElementalHarmony(synastryChart)
    const modalCompatibility = this.calculateModalCompatibility(synastryChart)
    const aspectHarmony =
      aspects.reduce((sum, aspect) => sum + aspect.harmony_rating, 0) / aspects.length

    const overallCompatibility = (elementalHarmony + modalCompatibility + aspectHarmony) / 3

    return {
      overall_compatibility: overallCompatibility,
      elemental_harmony: elementalHarmony,
      modal_compatibility: modalCompatibility,
      communication_style_match: 78,
      emotional_compatibility: 82,
      values_alignment: 75,
      growth_catalyst_potential: 90,

      strengths: this.identifyRelationshipStrengths(synastryChart, aspects),
      challenges: this.identifyRelationshipChallenges(synastryChart, aspects),
      recommendations: this.generateRecommendations(synastryChart, aspects),
      consciousness_development_areas: [
        'Integration of opposing yet complementary energies',
        'Development of unconditional love and acceptance',
        'Learning to see the divine in another person',
        'Balancing individual growth with relationship evolution',
      ],
      universal_lesson:
        'Through loving another, we learn to love ourselves and understand the interconnectedness of all beings',
    }
  }

  private static calculateElementalHarmony(synastryChart: SynastryChart): number {
    const p1 = synastryChart.person1.elemental_emphasis
    const p2 = synastryChart.person2.elemental_emphasis

    // Elemental Logic Principles:
    // - Same element has highest compatibility (0.9 → 90)
    // - All different element combinations have good compatibility (0.7 → 70)
    // - No opposing/balancing pairs logic
    const sameElement = p1.dominant_element === p2.dominant_element
    return sameElement ? 90 : 70
  }

  private static calculateModalCompatibility(_synastryChart: SynastryChart): number {
    // This would analyze cardinal/fixed/mutable compatibility
    return 75
  }

  private static identifyRelationshipStrengths(
    _synastryChart: SynastryChart,
    _aspects: SynastryAspect[]
  ): RelationshipStrength[] {
    return [
      {
        area: 'Emotional Connection',
        description: "Deep emotional understanding and natural empathy for each other's feelings",
        astrological_basis: ['Moon-Sun harmony', 'Water element emphasis'],
        manifestation_examples: [
          'Intuitive understanding of moods and needs',
          'Comfortable emotional expression and sharing',
          'Natural ability to provide comfort and support',
        ],
        enhancement_suggestions: [
          'Create regular emotional check-ins',
          'Practice active listening and emotional validation',
          "Honor each other's emotional rhythms and needs",
        ],
      },
      {
        area: 'Creative Collaboration',
        description: 'Strong potential for joint creative projects and artistic expression',
        astrological_basis: ['Venus-Mars aspects', 'Fire element synergy'],
        manifestation_examples: [
          'Inspiring each other to new creative heights',
          'Complementary creative skills and approaches',
          'Shared aesthetic sense and artistic vision',
        ],
        enhancement_suggestions: [
          'Engage in regular creative projects together',
          "Support each other's individual creative expression",
          'Create beautiful shared spaces and experiences',
        ],
      },
    ]
  }

  private static identifyRelationshipChallenges(
    _synastryChart: SynastryChart,
    _aspects: SynastryAspect[]
  ): RelationshipChallenge[] {
    return [
      {
        area: 'Communication Styles',
        description: 'Different approaches to processing and expressing thoughts and ideas',
        astrological_basis: ['Mercury placements', 'Air-Earth element tension'],
        growth_opportunities: [
          'Learning to appreciate different communication styles',
          'Developing patience for different processing speeds',
          'Finding common language for important discussions',
        ],
        integration_practices: [
          'Practice active listening without judgment',
          'Ask clarifying questions instead of making assumptions',
          "Honor each other's need for processing time",
        ],
        conscious_awareness_points: [
          'Notice when communication breaks down and why',
          'Recognize projection and take responsibility for your own reactions',
          "Appreciate the wisdom in your partner's different perspective",
        ],
      },
    ]
  }

  private static generateRecommendations(
    _synastryChart: SynastryChart,
    _aspects: SynastryAspect[]
  ): RelationshipRecommendation[] {
    return [
      {
        category: 'communication',
        title: 'Daily Connection Ritual',
        description: 'Establish a daily practice of meaningful connection and communication',
        specific_practices: [
          'Share daily appreciations and gratitudes',
          'Check in about emotional states and needs',
          'Discuss dreams, goals, and inspirations',
          'Practice eye contact and present-moment awareness',
        ],
        astrological_timing:
          'Best practiced during Venus hours or when the Moon is in harmonious aspect',
        success_indicators: [
          'Increased feeling of emotional intimacy',
          'Reduced misunderstandings and conflicts',
          'Greater sense of being seen and understood',
        ],
      },
      {
        category: 'spiritual',
        title: 'Conscious Relationship Practice',
        description:
          'Use the relationship as a vehicle for spiritual growth and consciousness development',
        specific_practices: [
          'Practice seeing the divine in your partner',
          'Use conflicts as opportunities for shadow work',
          'Meditate together on love and compassion',
          'Study spiritual teachings about love and relationships',
        ],
        astrological_timing: 'Particularly powerful during Jupiter transits and New Moon periods',
        success_indicators: [
          'Increased compassion and understanding',
          'Greater ability to love unconditionally',
          'Feeling of the relationship serving something greater than yourselves',
        ],
      },
    ]
  }

  static generateRelationshipTimeline(_synastryChart: SynastryChart): RelationshipPhase[] {
    return [
      {
        phase_name: 'Attraction and Discovery',
        timeframe: 'First 6 months',
        key_themes: ['Initial attraction', 'Discovering compatibility', 'Sharing personal stories'],
        astrological_influences: ['Venus-Mars aspects', 'Moon phases', 'Mercury connections'],
        consciousness_focus: 'Opening to love and allowing yourself to be known',
        recommended_practices: [
          'Share your authentic self gradually',
          'Practice curiosity about your partner',
          'Notice projections and fantasy vs reality',
        ],
        potential_challenges: [
          'Idealizing the partner',
          'Fear of vulnerability',
          'Comparing to past relationships',
        ],
        growth_opportunities: [
          'Learning to love without possessing',
          'Developing emotional intelligence',
          'Practicing presence and appreciation',
        ],
      },
      {
        phase_name: 'Integration and Commitment',
        timeframe: '6 months - 2 years',
        key_themes: ['Deeper commitment', 'Navigating differences', 'Building shared life'],
        astrological_influences: ['Saturn aspects', 'Progressed Moon', 'Jupiter cycles'],
        consciousness_focus: 'Choosing love through challenges and integrating differences',
        recommended_practices: [
          'Practice conscious communication',
          'Work through conflicts with compassion',
          'Create shared goals and vision',
        ],
        potential_challenges: [
          'Power struggles',
          "Triggering each other's wounds",
          'Balancing independence and togetherness',
        ],
        growth_opportunities: [
          'Healing personal wounds through love',
          'Learning unconditional acceptance',
          'Developing emotional maturity',
        ],
      },
      {
        phase_name: 'Co-Creation and Service',
        timeframe: '2+ years',
        key_themes: ['Creating together', 'Serving something greater', 'Mature love'],
        astrological_influences: ['Outer planet transits', 'Lunar nodes', 'Eclipse cycles'],
        consciousness_focus:
          'Using the relationship to serve love, growth, and universal consciousness',
        recommended_practices: [
          'Engage in service or creative projects together',
          "Support each other's highest expression",
          'Practice gratitude and celebration',
        ],
        potential_challenges: [
          'Taking each other for granted',
          'Growing in different directions',
          'External pressures and responsibilities',
        ],
        growth_opportunities: [
          'Embodying unconditional love',
          'Creating a legacy of love',
          'Becoming wisdom teachers for others',
        ],
      },
    ]
  }

  static createConsciousnessEvolutionMap(
    _synastryChart: SynastryChart,
    _compatibility: CompatibilityAnalysis
  ): ConsciousnessEvolutionStage[] {
    return [
      {
        stage_name: 'Individual Awakening Through Relationship',
        description: 'The relationship serves as a mirror for personal growth and self-discovery',
        individual_growth_person1: [
          "Discovering hidden aspects of self through partner's reflection",
          'Healing childhood wounds through love and acceptance',
          'Developing emotional intelligence and communication skills',
        ],
        individual_growth_person2: [
          'Learning to balance independence with intimacy',
          'Expanding capacity for vulnerability and trust',
          'Integrating masculine and feminine energies within',
        ],
        collective_evolution: [
          'Creating safe space for authentic expression',
          'Practicing unconditional love and acceptance',
          "Supporting each other's highest potential",
        ],
        universal_principle: 'Love is the force that transforms and heals all wounds',
        integration_practices: [
          'Daily appreciation and gratitude practices',
          'Conscious communication and conflict resolution',
          'Individual therapy or personal development work',
        ],
      },
      {
        stage_name: 'Sacred Union and Co-Creation',
        description:
          'The relationship becomes a vehicle for service and creative expression in the world',
        individual_growth_person1: [
          'Embodying divine masculine/feminine principles',
          'Using relationship challenges as spiritual practice',
          'Developing wisdom and compassion through love',
        ],
        individual_growth_person2: [
          'Mastering the art of loving without attachment',
          "Becoming a catalyst for others' growth and healing",
          'Integrating spiritual insights into daily life',
        ],
        collective_evolution: [
          'Creating work or projects that serve humanity',
          'Modeling conscious relationship for others',
          'Contributing to the evolution of love on Earth',
        ],
        universal_principle:
          'Two beings united in love become a force for positive change in the world',
        integration_practices: [
          'Joint meditation and spiritual practices',
          'Collaborative creative or service projects',
          'Teaching or mentoring other couples',
        ],
      },
    ]
  }

  static generatePracticalGuidance(
    _synastryChart: SynastryChart,
    _compatibility: CompatibilityAnalysis
  ): PracticalRelationshipGuidance {
    return {
      daily_practices: [
        'Morning intention setting together',
        'Evening gratitude and appreciation sharing',
        'Mindful presence during conversations',
        'Physical affection and loving touch',
        'Shared meditation or prayer time',
      ],
      communication_strategies: [
        'Use "I" statements to express feelings and needs',
        'Practice active listening without planning your response',
        'Ask clarifying questions instead of making assumptions',
        'Take breaks during heated discussions to cool down',
        "Express appreciation for your partner's perspective",
      ],
      conflict_resolution_approaches: [
        'Address issues when both are calm and present',
        'Focus on the specific behavior, not character attacks',
        'Look for the underlying need behind each position',
        'Find win-win solutions that honor both perspectives',
        'Use conflicts as opportunities for deeper understanding',
      ],
      intimacy_enhancement: [
        'Create regular date nights and quality time',
        'Share your deepest dreams and fears with each other',
        'Practice vulnerability and emotional openness',
        'Engage in activities that create bonding and connection',
        'Honor physical and emotional boundaries',
      ],
      shared_goal_setting: [
        'Create a shared vision for your relationship and life together',
        'Set both individual and couple goals',
        'Review and adjust goals regularly',
        'Celebrate achievements and milestones together',
        "Support each other's personal growth and development",
      ],
      spiritual_practices: [
        'Meditate together in silence',
        'Study spiritual or relationship wisdom together',
        'Practice forgiveness and compassion exercises',
        'Engage in service or volunteer work together',
        'Create sacred rituals and ceremonies for your relationship',
      ],
      creative_collaboration_ideas: [
        'Take art, music, or dance classes together',
        'Write a book or blog about your relationship journey',
        'Create a beautiful home environment together',
        'Plan and take meaningful trips and adventures',
        'Start a business or project that reflects your shared values',
      ],
    }
  }
}

// COMPATIBILITY RATING SYSTEM
export const COMPATIBILITY_INTERPRETATIONS = {
  excellent: {
    range: [90, 100],
    description: 'Exceptional compatibility with natural harmony and mutual support',
    keywords: ['Soulmate connection', 'Natural understanding', 'Effortless harmony'],
  },
  very_good: {
    range: [80, 89],
    description: 'Strong compatibility with great potential for lasting happiness',
    keywords: ['Strong foundation', 'Complementary energies', 'Growth potential'],
  },
  good: {
    range: [70, 79],
    description: 'Good compatibility requiring conscious effort and communication',
    keywords: ['Workable differences', 'Learning opportunities', 'Conscious growth'],
  },
  challenging: {
    range: [60, 69],
    description: 'Significant challenges requiring commitment to conscious relationship work',
    keywords: ['Growth catalyst', 'Requires dedication', 'Transformative potential'],
  },
  difficult: {
    range: [0, 59],
    description: 'Major incompatibilities requiring extensive personal work and spiritual practice',
    keywords: ['Spiritual test', 'Deep healing needed', 'Soul lesson relationship'],
  },
}

export function getCompatibilityInterpretation(
  score: number
): (typeof COMPATIBILITY_INTERPRETATIONS)[keyof typeof COMPATIBILITY_INTERPRETATIONS] {
  for (const [_key, interpretation] of Object.entries(COMPATIBILITY_INTERPRETATIONS)) {
    const [min, max] = interpretation.range
    if (score >= min && score <= max) {
      return interpretation
    }
  }
  return COMPATIBILITY_INTERPRETATIONS.difficult
}
