// Advanced Astrological Dignities & Planetary Strength Engine
// Integrates traditional dignity systems with alchemical consciousness mapping

export interface PlanetaryPlacement {
  planet: string
  sign: string
  degree: number
  house: number
  dignity: PlanetaryDignity
  orb_to_exact?: number
  retrograde?: boolean
}

export interface PlanetaryDignity {
  essential_dignity:
    | 'domicile'
    | 'exaltation'
    | 'triplicity'
    | 'term'
    | 'face'
    | 'detriment'
    | 'fall'
    | 'neutral'
  strength_score: number // -5 to +5 scale
  accidental_dignity: {
    angular_house: boolean // 1st, 4th, 7th, 10th houses
    succedent_house: boolean // 2nd, 5th, 8th, 11th houses
    cadent_house: boolean // 3rd, 6th, 9th, 12th houses
    oriental: boolean // Rising before Sun
    occidental: boolean // Setting after Sun
    direct_motion: boolean
    cazimi: boolean // Within 17 minutes of Sun
    combust: boolean // Within 8 degrees of Sun
  }
  alchemical_influence: {
    spirit_amplification: number // How much this placement amplifies Spirit
    essence_resonance: number // Connection to Essence flow
    matter_manifestation: number // Ability to work with Matter
    substance_foundation: number // Grounding in Substance
  }
}

export interface AlchemicalQuantities {
  spirit: number // 0.0-1.0 (Fire element, inspiration, divine spark)
  essence: number // 0.0-1.0 (Water element, emotional truth, soul essence)
  matter: number // 0.0-1.0 (Earth element, physical manifestation, form)
  substance: number // 0.0-1.0 (Air element, mental structure, communication)
  a_number: number // Total sum of all four
  thermodynamic_state:
    | 'heating'
    | 'cooling'
    | 'expanding'
    | 'contracting'
    | 'stable'
    | 'transforming'
  consciousness_temperature: number // 0-100, how "activated" the consciousness is
  entropy_level: number // 0-100, how much chaos/order in the system
}

export interface ConsciousnessStats {
  current_alchemical_state: AlchemicalQuantities
  planetary_influences: PlanetaryPlacement[]
  dominant_element: 'fire' | 'water' | 'air' | 'earth'
  elemental_balance: {
    fire: number // Cardinal signs, Mars, Sun influence
    water: number // Cancer, Scorpio, Pisces, Moon influence
    air: number // Gemini, Libra, Aquarius, Mercury influence
    earth: number // Taurus, Virgo, Capricorn, Venus/Saturn influence
  }
  consciousness_phase:
    | 'awakening'
    | 'expanding'
    | 'integrating'
    | 'stabilizing'
    | 'transforming'
    | 'transcending'
  learning_velocity_multiplier: number // Based on Mercury and Jupiter dignities
  creative_flow_coefficient: number // Based on Venus and Neptune
  manifestation_power_index: number // Based on Mars and Saturn
  intuitive_receptivity_quotient: number // Based on Moon and Neptune
}

export interface ConsciousParameters {
  alchemical_pillars: {
    spirit_forging: number
    essence_distillation: number
    matter_transmutation: number
    substance_refinement: number
    elemental_harmony: number
    consciousness_expansion: number
  }
}

// PLANETARY DIGNITY TABLES
export const ESSENTIAL_DIGNITIES = {
  Sun: { domicile: 'Leo', exaltation: 'Aries', detriment: 'Aquarius', fall: 'Libra' },
  Moon: { domicile: 'Cancer', exaltation: 'Taurus', detriment: 'Capricorn', fall: 'Scorpio' },
  Mercury: {
    domicile: ['Gemini', 'Virgo'],
    exaltation: 'Virgo',
    detriment: ['Sagittarius', 'Pisces'],
    fall: 'Pisces',
  },
  Venus: {
    domicile: ['Taurus', 'Libra'],
    exaltation: 'Pisces',
    detriment: ['Scorpio', 'Aries'],
    fall: 'Virgo',
  },
  Mars: {
    domicile: ['Aries', 'Scorpio'],
    exaltation: 'Capricorn',
    detriment: ['Libra', 'Taurus'],
    fall: 'Cancer',
  },
  Jupiter: {
    domicile: ['Sagittarius', 'Pisces'],
    exaltation: 'Cancer',
    detriment: ['Gemini', 'Virgo'],
    fall: 'Capricorn',
  },
  Saturn: {
    domicile: ['Capricorn', 'Aquarius'],
    exaltation: 'Libra',
    detriment: ['Cancer', 'Leo'],
    fall: 'Aries',
  },
}

export const ALCHEMICAL_PLANETARY_CORRESPONDENCES = {
  Sun: { spirit: 1, essence: 0, matter: 0, substance: 0 }, // Pure Spirit
  Moon: { spirit: 0, essence: 1, matter: 1, substance: 0 }, // Essence + Matter
  Mercury: { spirit: 1, essence: 0, matter: 0, substance: 1 }, // Spirit + Substance
  Venus: { spirit: 0, essence: 1, matter: 1, substance: 0 }, // Essence + Matter
  Mars: { spirit: 0, essence: 1, matter: 1, substance: 0 }, // Essence + Matter
  Jupiter: { spirit: 1, essence: 1, matter: 0, substance: 0 }, // Spirit + Essence
  Saturn: { spirit: 1, essence: 0, matter: 1, substance: 0 }, // Spirit + Matter
  // Modern planets
  Uranus: { spirit: 0, essence: 1, matter: 1, substance: 0 }, // Essence + Matter
  Neptune: { spirit: 0, essence: 1, matter: 0, substance: 1 }, // Essence + Substance
  Pluto: { spirit: 0, essence: 1, matter: 1, substance: 0 }, // Essence + Matter
}

export const SIGN_ELEMENTAL_QUALITIES = {
  // Fire Signs (Spirit-oriented)
  Aries: { fire: 0.9, water: 0.1, air: 0.3, earth: 0.2, thermodynamic: 'heating', cardinal: true },
  Leo: { fire: 0.8, water: 0.2, air: 0.2, earth: 0.1, thermodynamic: 'stable', fixed: true },
  Sagittarius: {
    fire: 0.7,
    water: 0.1,
    air: 0.4,
    earth: 0.2,
    thermodynamic: 'expanding',
    mutable: true,
  },

  // Water Signs (Essence-oriented)
  Cancer: { fire: 0.2, water: 0.9, air: 0.1, earth: 0.3, thermodynamic: 'cooling', cardinal: true },
  Scorpio: {
    fire: 0.3,
    water: 0.8,
    air: 0.1,
    earth: 0.2,
    thermodynamic: 'transforming',
    fixed: true,
  },
  Pisces: { fire: 0.1, water: 0.7, air: 0.2, earth: 0.1, thermodynamic: 'flowing', mutable: true },

  // Air Signs (Substance-oriented)
  Gemini: {
    fire: 0.3,
    water: 0.1,
    air: 0.9,
    earth: 0.1,
    thermodynamic: 'expanding',
    mutable: true,
  },
  Libra: {
    fire: 0.2,
    water: 0.3,
    air: 0.8,
    earth: 0.2,
    thermodynamic: 'balancing',
    cardinal: true,
  },
  Aquarius: {
    fire: 0.4,
    water: 0.1,
    air: 0.7,
    earth: 0.1,
    thermodynamic: 'revolutionizing',
    fixed: true,
  },

  // Earth Signs (Matter-oriented)
  Taurus: { fire: 0.1, water: 0.2, air: 0.1, earth: 0.9, thermodynamic: 'stable', fixed: true },
  Virgo: { fire: 0.2, water: 0.1, air: 0.3, earth: 0.8, thermodynamic: 'refining', mutable: true },
  Capricorn: {
    fire: 0.2,
    water: 0.1,
    air: 0.2,
    earth: 0.7,
    thermodynamic: 'crystallizing',
    cardinal: true,
  },
}

/**
 * Calculate planetary dignity and strength
 */
export function calculatePlanetaryDignity(
  planet: string,
  sign: string,
  degree: number,
  house: number,
  sunDegree?: number,
  isRetrograde?: boolean
): PlanetaryDignity {
  const dignities = ESSENTIAL_DIGNITIES[planet as keyof typeof ESSENTIAL_DIGNITIES]
  let strength_score = 0
  let essential_dignity: PlanetaryDignity['essential_dignity'] = 'neutral'

  // Essential Dignity Analysis
  if (dignities) {
    if (
      Array.isArray(dignities.domicile)
        ? dignities.domicile.includes(sign)
        : dignities.domicile === sign
    ) {
      essential_dignity = 'domicile'
      strength_score = 5
    } else if (dignities.exaltation === sign) {
      essential_dignity = 'exaltation'
      strength_score = 4
    } else if (
      Array.isArray(dignities.detriment)
        ? dignities.detriment.includes(sign)
        : dignities.detriment === sign
    ) {
      essential_dignity = 'detriment'
      strength_score = -4
    } else if (dignities.fall === sign) {
      essential_dignity = 'fall'
      strength_score = -5
    }
    // Triplicity (elemental rulership) calculation
    const signElement = getSignElement(sign)
    const planetaryTripilicityRulers = getTriplicityRulers(signElement)
    if (planetaryTripilicityRulers.includes(planet)) {
      if (essential_dignity === 'neutral') {
        essential_dignity = 'triplicity'
        strength_score += 2
      }
    }

    // Term and Face calculations (simplified approximation)
    const degreePosition = Math.floor(degree)
    if (degreePosition >= 0 && degreePosition < 6) {
      // First 6 degrees - often term rulers
      if (isTermRuler(planet, sign, degreePosition)) {
        strength_score += 1
      }
    }
  }

  // Accidental Dignity Analysis
  const angular_house = [1, 4, 7, 10].includes(house)
  const succedent_house = [2, 5, 8, 11].includes(house)
  const cadent_house = [3, 6, 9, 12].includes(house)

  // House strength modifiers
  if (angular_house) strength_score += 2
  else if (succedent_house) strength_score += 1
  else if (cadent_house) strength_score -= 1

  // Alchemical Influence Calculation
  const planetaryCorrespondence = ALCHEMICAL_PLANETARY_CORRESPONDENCES[
    planet as keyof typeof ALCHEMICAL_PLANETARY_CORRESPONDENCES
  ] || { spirit: 0.25, essence: 0.25, matter: 0.25, substance: 0.25 }
  const signQuality = SIGN_ELEMENTAL_QUALITIES[sign as keyof typeof SIGN_ELEMENTAL_QUALITIES] || {
    fire: 0.25,
    water: 0.25,
    air: 0.25,
    earth: 0.25,
    thermodynamic: 'stable',
  }

  const dignity_multiplier = (strength_score + 5) / 10 // Convert -5 to +5 range to 0-1

  return {
    essential_dignity,
    strength_score: Math.max(-5, Math.min(5, strength_score)),
    accidental_dignity: {
      angular_house,
      succedent_house,
      cadent_house,
      oriental: isOriental(planet, sunDegree || 0, degree),
      occidental: isOccidental(planet, sunDegree || 0, degree),
      direct_motion: !isRetrograde || false, // Based on optional retrograde parameter
      cazimi: isCazimi(planet, sunDegree || 0, degree),
      combust: isCombust(planet, sunDegree || 0, degree),
    },
    alchemical_influence: {
      spirit_amplification: planetaryCorrespondence.spirit * dignity_multiplier * signQuality.fire,
      essence_resonance: planetaryCorrespondence.essence * dignity_multiplier * signQuality.water,
      matter_manifestation: planetaryCorrespondence.matter * dignity_multiplier * signQuality.earth,
      substance_foundation:
        planetaryCorrespondence.substance * dignity_multiplier * signQuality.air,
    },
  }
}

/**
 * Generate real-time alchemical quantities from birth chart
 */
export function calculateAlchemicalQuantities(
  placements: PlanetaryPlacement[]
): AlchemicalQuantities {
  let spirit = 0
  let essence = 0
  let matter = 0
  let substance = 0

  // Sum weighted contributions from all planetary placements
  for (const placement of placements) {
    const influence = placement.dignity.alchemical_influence
    const weight = (placement.dignity.strength_score + 5) / 10 // Normalize to 0-1

    spirit += influence.spirit_amplification * weight
    essence += influence.essence_resonance * weight
    matter += influence.matter_manifestation * weight
    substance += influence.substance_foundation * weight
  }

  // Normalize to 0-1 range based on number of planets
  const planetCount = placements.length
  spirit = Math.min(1, spirit / planetCount)
  essence = Math.min(1, essence / planetCount)
  matter = Math.min(1, matter / planetCount)
  substance = Math.min(1, substance / planetCount)

  const a_number = spirit + essence + matter + substance

  // Determine thermodynamic state
  let thermodynamic_state: AlchemicalQuantities['thermodynamic_state'] = 'stable'
  if (spirit > 0.6 && matter > 0.6) thermodynamic_state = 'transforming'
  else if (spirit > 0.7) thermodynamic_state = 'heating'
  else if (essence > 0.7) thermodynamic_state = 'cooling'
  else if (substance > 0.7) thermodynamic_state = 'expanding'
  else if (matter > 0.7) thermodynamic_state = 'contracting'

  // Calculate consciousness temperature (how activated the system is)
  const consciousness_temperature = Math.round(
    spirit * 40 + essence * 20 + substance * 30 + matter * 10
  )

  // Calculate entropy level (balance vs chaos)
  const balance =
    1 -
    Math.abs(spirit - 0.25) -
    Math.abs(essence - 0.25) -
    Math.abs(matter - 0.25) -
    Math.abs(substance - 0.25)
  const entropy_level = Math.round((1 - balance) * 100)

  return {
    spirit,
    essence,
    matter,
    substance,
    a_number,
    thermodynamic_state,
    consciousness_temperature,
    entropy_level,
  }
}

/**
 * Generate comprehensive consciousness stats from birth chart
 */
export function generateConsciousnessStats(placements: PlanetaryPlacement[]): ConsciousnessStats {
  const alchemical_state = calculateAlchemicalQuantities(placements)

  // Calculate elemental balance
  let fire = 0,
    water = 0,
    air = 0,
    earth = 0
  for (const placement of placements) {
    const signQuality =
      SIGN_ELEMENTAL_QUALITIES[placement.sign as keyof typeof SIGN_ELEMENTAL_QUALITIES]
    if (signQuality) {
      const weight = (placement.dignity.strength_score + 5) / 10
      fire += signQuality.fire * weight
      water += signQuality.water * weight
      air += signQuality.air * weight
      earth += signQuality.earth * weight
    }
  }

  const totalElemental = fire + water + air + earth
  const elemental_balance = {
    fire: Math.round((fire / totalElemental) * 100),
    water: Math.round((water / totalElemental) * 100),
    air: Math.round((air / totalElemental) * 100),
    earth: Math.round((earth / totalElemental) * 100),
  }

  // Determine dominant element
  const dominant_element = Object.entries(elemental_balance).reduce((a, b) =>
    elemental_balance[a[0] as keyof typeof elemental_balance] >
    elemental_balance[b[0] as keyof typeof elemental_balance]
      ? a
      : b
  )[0] as 'fire' | 'water' | 'air' | 'earth'

  // Calculate specialized coefficients
  const mercury = placements.find(p => p.planet === 'Mercury')
  const jupiter = placements.find(p => p.planet === 'Jupiter')
  const venus = placements.find(p => p.planet === 'Venus')
  const mars = placements.find(p => p.planet === 'Mars')
  const saturn = placements.find(p => p.planet === 'Saturn')
  const moon = placements.find(p => p.planet === 'Moon')

  const learning_velocity_multiplier =
    1 + ((mercury?.dignity.strength_score || 0) + (jupiter?.dignity.strength_score || 0)) / 10
  const creative_flow_coefficient = 1 + (venus?.dignity.strength_score || 0) / 5
  const manifestation_power_index =
    1 + ((mars?.dignity.strength_score || 0) + (saturn?.dignity.strength_score || 0)) / 10
  const intuitive_receptivity_quotient = 1 + (moon?.dignity.strength_score || 0) / 5

  // Determine consciousness phase
  let consciousness_phase: ConsciousnessStats['consciousness_phase'] = 'integrating'
  if (alchemical_state.a_number < 1.5) consciousness_phase = 'awakening'
  else if (alchemical_state.a_number < 2.0) consciousness_phase = 'expanding'
  else if (alchemical_state.a_number < 2.5) consciousness_phase = 'integrating'
  else if (alchemical_state.a_number < 3.0) consciousness_phase = 'stabilizing'
  else if (alchemical_state.a_number < 3.5) consciousness_phase = 'transforming'
  else consciousness_phase = 'transcending'

  return {
    current_alchemical_state: alchemical_state,
    planetary_influences: placements,
    dominant_element,
    elemental_balance,
    consciousness_phase,
    learning_velocity_multiplier,
    creative_flow_coefficient,
    manifestation_power_index,
    intuitive_receptivity_quotient,
  }
}

/**
 * Generate alchemical consciousness tasks based on current state
 */
export function generateAlchemicalConsciousnessTasks(
  stats: ConsciousnessStats
): AlchemicalConsciousnessTask[] {
  const tasks: AlchemicalConsciousnessTask[] = []
  const state = stats.current_alchemical_state

  // Spirit Enhancement Tasks (if Spirit < 0.4)
  if (state.spirit < 0.4) {
    tasks.push({
      id: 'spirit_ignition',
      title: 'Sacred Fire Ignition',
      type: 'spirit_enhancement',
      description:
        'Your Spirit flame needs tending. Engage in passionate creation or inspiring action.',
      alchemical_focus: 'spirit',
      planetary_alignment: ['Sun', 'Mars', 'Jupiter'],
      task_prompt:
        'For the next 24 hours, do something that genuinely excites and inspires you. Document how this affects your inner fire and creative energy.',
      completion_criteria:
        'Submit reflection on passionate engagement with evidence of increased vitality',
      base_reward: 400,
      alchemical_bonus: { spirit: 0.1, essence: 0.0, matter: 0.0, substance: 0.0 },
      optimal_timing: 'Solar hours, Tuesday (Mars), or Thursday (Jupiter)',
    })
  }

  // Essence Deepening Tasks (if Essence < 0.4)
  if (state.essence < 0.4) {
    tasks.push({
      id: 'essence_communion',
      title: 'Soul Essence Communion',
      type: 'essence_deepening',
      description:
        'Your emotional essence needs nourishment. Connect deeply with feeling and intuition.',
      alchemical_focus: 'essence',
      planetary_alignment: ['Moon', 'Venus', 'Neptune'],
      task_prompt:
        'Spend time in emotional communion - with nature, loved ones, or your inner world. Practice feeling without judgment.',
      completion_criteria: 'Document emotional insights and describe shifts in feeling-awareness',
      base_reward: 350,
      alchemical_bonus: { spirit: 0.0, essence: 0.1, matter: 0.0, substance: 0.0 },
      optimal_timing: 'Lunar hours, Monday (Moon), or Friday (Venus)',
    })
  }

  // Matter Manifestation Tasks (if Matter < 0.4)
  if (state.matter < 0.4) {
    tasks.push({
      id: 'matter_crystallization',
      title: 'Physical Manifestation Practice',
      type: 'matter_crystallization',
      description:
        'Your material manifestation needs grounding. Create something tangible and useful.',
      alchemical_focus: 'matter',
      planetary_alignment: ['Saturn', 'Venus', 'Earth'],
      task_prompt:
        'Create, build, or organize something physical that improves your environment. Focus on quality and intentional manifestation.',
      completion_criteria:
        'Share photo/description of physical creation with reflection on the manifestation process',
      base_reward: 450,
      alchemical_bonus: { spirit: 0.0, essence: 0.0, matter: 0.1, substance: 0.0 },
      optimal_timing: 'Saturday (Saturn) or during Earth sign transits',
    })
  }

  // Substance Integration Tasks (if Substance < 0.4)
  if (state.substance < 0.4) {
    tasks.push({
      id: 'substance_weaving',
      title: 'Mental Substance Integration',
      type: 'substance_integration',
      description:
        'Your mental structures need refinement. Organize thoughts and communicate clearly.',
      alchemical_focus: 'substance',
      planetary_alignment: ['Mercury', 'Saturn', 'Uranus'],
      task_prompt:
        'Choose a complex topic you care about and create a clear, structured explanation that helps others understand it.',
      completion_criteria:
        'Submit organized content (writing, diagram, or presentation) that demonstrates clear thinking',
      base_reward: 375,
      alchemical_bonus: { spirit: 0.0, essence: 0.0, matter: 0.0, substance: 0.1 },
      optimal_timing: 'Wednesday (Mercury) or during Air sign transits',
    })
  }

  // High A-Number Transcendence Tasks (if A-Number > 3.0)
  if (state.a_number > 3.0) {
    tasks.push({
      id: 'alchemical_mastery',
      title: 'Alchemical Mastery Integration',
      type: 'transcendence',
      description:
        'Your consciousness operates at high alchemical levels. Focus on integration and service.',
      alchemical_focus: 'integration',
      planetary_alignment: ['All planets'],
      task_prompt:
        'Use your developed consciousness to serve others. Teach, heal, or create something that benefits your community.',
      completion_criteria:
        'Document service activity and reflect on how integrated consciousness manifests in the world',
      base_reward: 600,
      alchemical_bonus: { spirit: 0.05, essence: 0.05, matter: 0.05, substance: 0.05 },
      optimal_timing: 'Any time - your consciousness transcends timing limitations',
    })
  }

  return tasks
}

export interface AlchemicalConsciousnessTask {
  id: string
  title: string
  type:
    | 'spirit_enhancement'
    | 'essence_deepening'
    | 'matter_crystallization'
    | 'substance_integration'
    | 'transcendence'
  description: string
  alchemical_focus: 'spirit' | 'essence' | 'matter' | 'substance' | 'integration'
  planetary_alignment: string[]
  task_prompt: string
  completion_criteria: string
  base_reward: number
  alchemical_bonus: { spirit: number; essence: number; matter: number; substance: number }
  optimal_timing: string
}

// Helper functions for completing dignity calculations

function getSignElement(sign: string): string {
  const fireSign = ['Aries', 'Leo', 'Sagittarius']
  const earthSigns = ['Taurus', 'Virgo', 'Capricorn']
  const airSigns = ['Gemini', 'Libra', 'Aquarius']
  const waterSigns = ['Cancer', 'Scorpio', 'Pisces']

  if (fireSign.includes(sign)) return 'fire'
  if (earthSigns.includes(sign)) return 'earth'
  if (airSigns.includes(sign)) return 'air'
  if (waterSigns.includes(sign)) return 'water'
  return 'unknown'
}

function getTriplicityRulers(element: string): string[] {
  switch (element) {
    case 'fire':
      return ['Sun', 'Jupiter', 'Mars']
    case 'earth':
      return ['Venus', 'Moon', 'Saturn']
    case 'air':
      return ['Mercury', 'Uranus', 'Saturn']
    case 'water':
      return ['Moon', 'Neptune', 'Mars']
    default:
      return []
  }
}

function isTermRuler(planet: string, sign: string, degree: number): boolean {
  // Simplified term calculation - in practice this would use Egyptian terms
  // This is a basic approximation for the first few degrees
  const termRulers: { [key: string]: string[] } = {
    Aries: ['Mars', 'Sun', 'Venus', 'Mercury', 'Jupiter'],
    Taurus: ['Venus', 'Mercury', 'Mars', 'Jupiter', 'Saturn'],
    Gemini: ['Mercury', 'Jupiter', 'Venus', 'Mars', 'Saturn'],
    Cancer: ['Moon', 'Venus', 'Mercury', 'Mars', 'Jupiter'],
    Leo: ['Sun', 'Jupiter', 'Mercury', 'Venus', 'Mars'],
    Virgo: ['Mercury', 'Venus', 'Jupiter', 'Mars', 'Sun'],
  }

  const rulers = termRulers[sign] || []
  const termIndex = Math.floor(degree / 6) // Simple 6-degree divisions
  return rulers[termIndex] === planet
}

function isOriental(planet: string, sunDegree: number, planetDegree: number): boolean {
  if (planet === 'Sun') return false // Sun can't be oriental to itself

  // Oriental means rising before the Sun (planet degree < sun degree in most cases)
  const diff = planetDegree - sunDegree
  return diff < 0 && diff > -180 // Planet rises before Sun
}

function isOccidental(planet: string, sunDegree: number, planetDegree: number): boolean {
  if (planet === 'Sun') return false // Sun can't be occidental to itself

  // Occidental means setting after the Sun (planet degree > sun degree)
  const diff = planetDegree - sunDegree
  return diff > 0 && diff < 180 // Planet sets after Sun
}

function isCazimi(planet: string, sunDegree: number, planetDegree: number): boolean {
  if (planet === 'Sun') return false // Sun can't be cazimi with itself

  // Cazimi is within 17 minutes (approximately 0.28 degrees) of the Sun
  const diff = Math.abs(planetDegree - sunDegree)
  return diff <= 0.28
}

function isCombust(planet: string, sunDegree: number, planetDegree: number): boolean {
  if (planet === 'Sun') return false // Sun can't be combust

  // Combust is within 8.5 degrees of the Sun (but not cazimi)
  const diff = Math.abs(planetDegree - sunDegree)
  return diff > 0.28 && diff <= 8.5
}
