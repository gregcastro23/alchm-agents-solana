// Astrological Chart Analysis Rules
// Based on current-moment-chart.ipynb and alchemizer v2.0 engine

export interface PlanetaryPosition {
  sign: string
  degree: number
  house?: string
  decan: string
  elementEffect: Record<string, number>
}

export interface ChartData {
  timestamp: string
  sunSign: string
  sunDegree: number
  chartRuler: string
  dominantElement: string
  dominantModality: string
  chartType: 'Diurnal' | 'Nocturnal'
  alchemyEffects: {
    spirit: number
    essence: number
    matter: number
    substance: number
    dayEssence: number
    nightEssence: number
    totalPower: number
  }
  elements: {
    Air: number
    Fire: number
    Water: number
    Earth: number
  }
  modalities: {
    Cardinal: number
    Fixed: number
    Mutable: number
  }
  chartMetrics: {
    heat: number
    entropy: number
    reactivity: number
    energy: number
  }
  kalchmConstant?: number
  monicaConstant?: number
}

export interface AspectPattern {
  type: 'Conjunction' | 'Opposition' | 'Trine' | 'Square' | 'Sextile'
  planets: string[]
  effects: Record<string, number>
  sign?: string
  orb?: number
}

/**
 * CRITICAL DEGREES AND TRANSITIONS
 * Based on astrological tradition and notebook analysis
 */
export class CriticalDegreeAnalyzer {
  static readonly CRITICAL_DEGREES = [0, 1, 13, 26, 29]
  static readonly ANARETIC_DEGREE = 29

  static isCriticalDegree(degree: number): boolean {
    return this.CRITICAL_DEGREES.includes(Math.floor(degree))
  }

  static isAnareticDegree(degree: number): boolean {
    return Math.floor(degree) === this.ANARETIC_DEGREE
  }

  static interpretCriticalDegree(degree: number, sign: string): string {
    const floorDegree = Math.floor(degree)

    if (floorDegree === 0) {
      return `New beginning energy in ${sign} - fresh start and initiative`
    } else if (floorDegree === 1) {
      return `Establishing energy in ${sign} - building foundation`
    } else if (floorDegree === 13) {
      return `Challenge and growth point in ${sign} - karmic lessons`
    } else if (floorDegree === 26) {
      return `Mastery and completion approaching in ${sign} - expertise development`
    } else if (floorDegree === 29) {
      return `ANARETIC: Final degree of ${sign} - completion, crisis, and transition to next sign`
    }

    return `Standard degree in ${sign}`
  }
}

/**
 * CHART TYPE DETERMINATION
 * Based on time of day and solar position
 */
export class ChartTypeAnalyzer {
  static determineChartType(hour: number, minute: number = 0): 'Diurnal' | 'Nocturnal' {
    const totalMinutes = hour * 60 + minute

    // Diurnal: 5:00 AM to 5:59 PM (sunrise to sunset approximation)
    const sunriseMinutes = 5 * 60 // 5:00 AM
    const sunsetMinutes = 18 * 60 // 6:00 PM

    if (totalMinutes >= sunriseMinutes && totalMinutes < sunsetMinutes) {
      return 'Diurnal'
    }
    return 'Nocturnal'
  }

  static getChartTypeInfluence(chartType: 'Diurnal' | 'Nocturnal'): {
    favoredActivities: string[]
    energyFocus: string
    elementalBonus: string
  } {
    if (chartType === 'Diurnal') {
      return {
        favoredActivities: [
          'External action and achievement',
          'Business and professional activities',
          'Public communication and networking',
          'Physical activities and exercise',
          'Goal-oriented planning',
        ],
        energyFocus: 'Outward expression and external manifestation',
        elementalBonus: 'Fire and Air elements enhanced',
      }
    } else {
      return {
        favoredActivities: [
          'Introspection and reflection',
          'Emotional processing and healing',
          'Dream work and intuition',
          'Spiritual practice and meditation',
          'Creative and artistic pursuits',
        ],
        energyFocus: 'Inner development and emotional attunement',
        elementalBonus: 'Water and Earth elements enhanced',
      }
    }
  }
}

/**
 * MODALITY ANALYSIS
 * Cardinal, Fixed, Mutable energy distribution
 */
export class ModalityAnalyzer {
  static interpretModalityDistribution(modalities: ChartData['modalities']): {
    dominantModality: string
    interpretation: string
    recommendedActions: string[]
  } {
    const { Cardinal, Fixed, Mutable } = modalities

    let dominantModality: string
    let interpretation: string
    let recommendedActions: string[]

    if (Cardinal >= Fixed && Cardinal >= Mutable) {
      dominantModality = 'Cardinal'
      interpretation =
        'Strong initiative energy. Perfect for starting new projects and taking leadership roles.'
      recommendedActions = [
        'Launch new initiatives',
        'Take leadership in important situations',
        'Make decisive moves toward goals',
        'Start important conversations or negotiations',
        'Begin new chapters in life',
      ]
    } else if (Fixed >= Cardinal && Fixed >= Mutable) {
      dominantModality = 'Fixed'
      interpretation =
        'Stable, persistent energy. Excellent for maintaining progress and seeing projects through.'
      recommendedActions = [
        'Focus on existing projects and commitments',
        'Build upon established foundations',
        'Maintain consistent effort and discipline',
        'Strengthen existing relationships and structures',
        'Persevere through challenges',
      ]
    } else {
      dominantModality = 'Mutable'
      interpretation =
        'Adaptable, flexible energy. Ideal for making adjustments and going with the flow.'
      recommendedActions = [
        'Remain flexible and adaptable to changes',
        'Learn new skills and gather information',
        'Make necessary adjustments to plans',
        'Facilitate communication and connections',
        'Embrace variety and new experiences',
      ]
    }

    return { dominantModality, interpretation, recommendedActions }
  }
}

/**
 * ELEMENTAL BALANCE ANALYSIS
 * Fire, Water, Air, Earth distribution and implications
 */
export class ElementalAnalyzer {
  static analyzeElementalBalance(elements: ChartData['elements']): {
    dominantElement: string
    elementalProfile: string
    challenges: string[]
    strengths: string[]
    balancingRecommendations: string[]
  } {
    const { Air, Fire, Water, Earth } = elements

    // Find dominant element (highest value, can be negative)
    const elementEntries = Object.entries(elements)
    const dominantElement = elementEntries.reduce((max, current) =>
      current[1] > max[1] ? current : max
    )[0]

    let elementalProfile: string
    let challenges: string[] = []
    let strengths: string[] = []
    let balancingRecommendations: string[] = []

    // Analyze based on dominant element
    switch (dominantElement) {
      case 'Fire':
        elementalProfile = 'Dynamic, action-oriented energy with strong initiative and passion'
        strengths = [
          'Natural leadership and courage',
          'High energy and enthusiasm',
          'Ability to inspire and motivate others',
          'Quick decision-making capabilities',
        ]
        challenges = [
          'Potential for impatience and impulsiveness',
          'Risk of burnout from intense energy',
          'May overlook details in favor of action',
        ]
        balancingRecommendations = [
          'Include grounding Earth activities',
          'Practice patience and reflection',
          'Balance action with planning',
        ]
        break

      case 'Water':
        elementalProfile = 'Emotional, intuitive energy with deep feeling and empathy'
        strengths = [
          'Strong intuition and emotional intelligence',
          'Natural healing and nurturing abilities',
          'Deep empathy and understanding of others',
          'Creative and artistic talents',
        ]
        challenges = [
          'Potential for emotional overwhelm',
          "Tendency to absorb others' emotions",
          'May struggle with boundaries',
        ]
        balancingRecommendations = [
          'Include structured Air activities',
          'Practice emotional boundaries',
          'Balance feeling with thinking',
        ]
        break

      case 'Air':
        elementalProfile = 'Mental, communicative energy with focus on ideas and connections'
        strengths = [
          'Excellent communication abilities',
          'Strong analytical and strategic thinking',
          'Natural networking and social skills',
          'Adaptability and mental agility',
        ]
        challenges = [
          'Potential for overthinking and analysis paralysis',
          'May struggle with emotional depth',
          'Risk of scattered energy and lack of focus',
        ]
        balancingRecommendations = [
          'Include grounding Earth practices',
          'Balance thinking with feeling',
          'Focus energy on specific goals',
        ]
        break

      case 'Earth':
        elementalProfile = 'Practical, stable energy with focus on manifestation and structure'
        strengths = [
          'Strong organizational and practical skills',
          'Ability to manifest ideas into reality',
          'Natural discipline and persistence',
          'Grounded and reliable approach to life',
        ]
        challenges = [
          'Potential for rigidity and resistance to change',
          'May struggle with spontaneity',
          'Risk of becoming overly focused on material concerns',
        ]
        balancingRecommendations = [
          'Include creative Fire activities',
          'Practice flexibility and openness to change',
          'Balance structure with spontaneity',
        ]
        break

      default:
        elementalProfile = 'Balanced elemental distribution'
        strengths = ['Well-rounded approach to life challenges']
        challenges = ['May lack specialized elemental strengths']
        balancingRecommendations = ['Develop specific elemental skills as needed']
    }

    return {
      dominantElement,
      elementalProfile,
      challenges,
      strengths,
      balancingRecommendations,
    }
  }

  static interpretNegativeElements(elements: ChartData['elements']): {
    clearingNeeded: string[]
    supportiveActivities: string[]
    avoidActivities: string[]
  } {
    const negativeElements = Object.entries(elements).filter(([_, value]) => value < 0)
    const clearingNeeded: string[] = []
    const supportiveActivities: string[] = []
    const avoidActivities: string[] = []

    negativeElements.forEach(([element, value]) => {
      clearingNeeded.push(`${element} element clearing needed (${value})`)

      switch (element) {
        case 'Fire':
          supportiveActivities.push('Gentle movement, light exercise, warm foods')
          avoidActivities.push('High-intensity activities, spicy foods, aggressive actions')
          break
        case 'Water':
          supportiveActivities.push('Hydration, gentle emotions, flowing activities')
          avoidActivities.push('Emotional overwhelm, water retention foods, excess dairy')
          break
        case 'Air':
          supportiveActivities.push('Deep breathing, light communication, mental rest')
          avoidActivities.push('Overthinking, excessive planning, windy environments')
          break
        case 'Earth':
          supportiveActivities.push('Grounding activities, stable routines, root vegetables')
          avoidActivities.push('Heavy foods, excessive structure, materialistic focus')
          break
      }
    })

    return { clearingNeeded, supportiveActivities, avoidActivities }
  }
}

/**
 * ASPECT PATTERN ANALYZER
 * Interprets major planetary aspects and their effects
 */
export class AspectAnalyzer {
  static interpretAspectPattern(aspect: AspectPattern): {
    interpretation: string
    energyType: 'Harmonious' | 'Challenging' | 'Dynamic'
    recommendations: string[]
  } {
    const { type, planets } = aspect

    let interpretation: string
    let energyType: 'Harmonious' | 'Challenging' | 'Dynamic'
    let recommendations: string[] = []

    switch (type) {
      case 'Conjunction':
        interpretation = `${planets.join(' and ')} unite their energies, creating powerful combined influence`
        energyType = 'Dynamic'
        recommendations = [
          'Focus on activities that combine both planetary energies',
          'Use this concentrated energy for significant initiatives',
          'Be mindful of potential intensity or overwhelm',
        ]
        break

      case 'Opposition':
        interpretation = `${planets.join(' and ')} create tension requiring balance and integration`
        energyType = 'Challenging'
        recommendations = [
          'Seek balance between opposing forces',
          'Use tension as motivation for growth',
          'Avoid either/or thinking - find the middle path',
        ]
        break

      case 'Trine':
        interpretation = `${planets.join(' and ')} flow harmoniously, supporting easy expression`
        energyType = 'Harmonious'
        recommendations = [
          'Take advantage of this supportive energy',
          'Move forward with confidence in related areas',
          'Share talents and abilities with others',
        ]
        break

      case 'Square':
        interpretation = `${planets.join(' and ')} create dynamic tension driving action and growth`
        energyType = 'Challenging'
        recommendations = [
          'Use tension as fuel for positive change',
          'Take action to resolve conflicts',
          'Learn important lessons through challenges',
        ]
        break

      case 'Sextile':
        interpretation = `${planets.join(' and ')} offer opportunities for positive development`
        energyType = 'Harmonious'
        recommendations = [
          'Actively pursue opportunities presented',
          'Collaborate with others for mutual benefit',
          'Develop skills in related areas',
        ]
        break
    }

    return { interpretation, energyType, recommendations }
  }
}

/**
 * COMPREHENSIVE CHART ANALYZER
 * Integrates all analysis components
 */
export class ComprehensiveChartAnalyzer {
  static analyzeChart(chartData: ChartData): {
    overallAssessment: string
    keyThemes: string[]
    optimalActivities: string[]
    cautionAreas: string[]
    timingRecommendations: {
      immediate: string[]
      shortTerm: string[]
      longTerm: string[]
    }
    foodRecommendations?: {
      favor: string[]
      avoid: string[]
      reasoning: string
    }
  } {
    // Analyze critical degrees
    const isCritical = CriticalDegreeAnalyzer.isCriticalDegree(chartData.sunDegree)
    const isAnaretic = CriticalDegreeAnalyzer.isAnareticDegree(chartData.sunDegree)

    // Analyze chart type
    const chartTypeInfluence = ChartTypeAnalyzer.getChartTypeInfluence(chartData.chartType)

    // Analyze modalities
    const modalityAnalysis = ModalityAnalyzer.interpretModalityDistribution(chartData.modalities)

    // Analyze elements
    const elementalAnalysis = ElementalAnalyzer.analyzeElementalBalance(chartData.elements)
    const negativeElementAnalysis = ElementalAnalyzer.interpretNegativeElements(chartData.elements)

    // Overall assessment
    let overallAssessment = `${chartData.sunSign} ${chartData.chartType} chart with ${modalityAnalysis.dominantModality} dominance`

    if (isAnaretic) {
      overallAssessment += ` - CRITICAL TRANSITION PERIOD (${chartData.sunDegree}°)`
    } else if (isCritical) {
      overallAssessment += ` - significant degree activation (${chartData.sunDegree}°)`
    }

    // Key themes
    const keyThemes: string[] = [
      modalityAnalysis.interpretation,
      elementalAnalysis.elementalProfile,
      chartTypeInfluence.energyFocus,
    ]

    if (chartData.alchemyEffects.totalPower < 0) {
      keyThemes.push('Major clearing and release period - focus on letting go')
    }

    // Optimal activities
    const optimalActivities = [
      ...modalityAnalysis.recommendedActions.slice(0, 3),
      ...chartTypeInfluence.favoredActivities.slice(0, 2),
    ]

    // Caution areas
    const cautionAreas = [
      ...elementalAnalysis.challenges,
      ...negativeElementAnalysis.clearingNeeded,
    ]

    // Timing recommendations
    const timingRecommendations = {
      immediate: isAnaretic
        ? [
            'Focus on completion and closure',
            'Prepare for major transitions',
            'Release what no longer serves',
          ]
        : [
            'Take advantage of current planetary influences',
            'Align actions with dominant modality energy',
          ],
      shortTerm: [
        'Continue working with chart themes',
        'Monitor elemental balance',
        'Adjust activities based on energy feedback',
      ],
      longTerm: [
        'Develop understanding of personal patterns',
        'Build on identified strengths',
        'Address elemental imbalances systematically',
      ],
    }

    // Food recommendations (if constants available)
    let foodRecommendations
    if (chartData.kalchmConstant !== undefined && chartData.monicaConstant !== undefined) {
      const isClearing = chartData.alchemyEffects.totalPower < 0

      foodRecommendations = {
        favor: isClearing
          ? [
              'Light, cleansing foods',
              'Fresh fruits and vegetables',
              'Herbal teas and clear broths',
              'Foods that support detoxification',
            ]
          : [
              'Nourishing, building foods',
              'Whole grains and proteins',
              'Foods that match dominant element',
            ],
        avoid: isClearing
          ? [
              'Heavy, dense foods',
              'Excessive proteins',
              'Processed foods',
              'Foods that create stagnation',
            ]
          : ['Foods that oppose dominant element', 'Overly stimulating substances'],
        reasoning: isClearing
          ? 'Negative alchemical values indicate need for clearing and lightness'
          : 'Positive values support building and nourishment',
      }
    }

    return {
      overallAssessment,
      keyThemes,
      optimalActivities,
      cautionAreas,
      timingRecommendations,
      foodRecommendations,
    }
  }
}

/**
 * PLANETARY POSITION ANALYZER
 * Analyzes individual planetary positions and their meanings
 */
export class PlanetaryPositionAnalyzer {
  static analyzePlanetaryPosition(
    planet: string,
    position: PlanetaryPosition
  ): {
    interpretation: string
    influence: string
    recommendations: string[]
  } {
    const { sign, degree, house, decan } = position
    const isCritical = CriticalDegreeAnalyzer.isCriticalDegree(degree)
    const isAnaretic = CriticalDegreeAnalyzer.isAnareticDegree(degree)

    let interpretation = `${planet} in ${sign}`
    if (house) interpretation += ` in ${house} house`
    if (isCritical) interpretation += ` at critical ${degree}°`

    let influence = `${planet} expresses through ${sign} qualities`
    if (isAnaretic) {
      influence += ` with urgent completion energy`
    }

    const recommendations: string[] = []

    // Add specific recommendations based on planet and conditions
    if (isAnaretic) {
      recommendations.push(`Focus on completing ${planet.toLowerCase()} matters`)
      recommendations.push('Prepare for changes in this area of life')
    }

    if (house) {
      recommendations.push(`Channel ${planet} energy into ${house.toLowerCase()} house themes`)
    }

    return { interpretation, influence, recommendations }
  }
}
