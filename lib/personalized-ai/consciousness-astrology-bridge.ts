// Consciousness ↔ Astrology correlation utilities
// Maps consciousness survey dimensions to elemental emphasis, modalities, signs, and planetary tendencies

import type { ConsciousnessProfile } from '../types/consciousness-survey'

export type CorrelatedAstrology = {
  dominant_element: 'Fire' | 'Earth' | 'Air' | 'Water'
  suggested_signs: string[]
  dominant_modality: 'Cardinal' | 'Fixed' | 'Mutable'
  planetary_tendencies: string[]
  explanation: string
}

export function correlateConsciousnessToAstrology(
  profile: ConsciousnessProfile
): CorrelatedAstrology {
  // Element scores derived from consciousness axes
  // Heuristic mapping:
  // - Extraversion, Assertiveness, Creativity -> Fire
  // - Intuition, Big-picture, Ideation -> Air
  // - Practicality, Conscientiousness, Structure -> Earth
  // - Emotional expression, Empathy, Sensitivity -> Water
  const d = profile.dimensions
  const comm = profile.communication
  const think = profile.thinking
  const values = profile.values
  const behavior = profile.behavior

  const fireScore = normalize(
    d.assertiveness +
      profile.creativity.writing_style.creativity_level +
      comm.directness +
      think.processing_speed ===
      'fast_decisive'
      ? 15
      : 0
  )
  const airScore = normalize(
    d.openness +
      comm.verbosity +
      think.detail_big_picture +
      think.analytical_intuitive +
      (values.tradition_innovation ? values.tradition_innovation : 0)
  )
  const earthScore = normalize(
    d.conscientiousness +
      comm.formality +
      (think.structured_flexible < 50 ? 100 - think.structured_flexible : 0) +
      (behavior.routine_spontaneous < 50 ? 100 - behavior.routine_spontaneous : 0)
  )
  const waterScore = normalize(
    comm.emotional_expression +
      (100 - d.emotional_stability) +
      (values.material_spiritual > 50 ? values.material_spiritual - 50 : 0) +
      (profile.creativity.writing_style?.tone ? 10 : 0)
  )

  const elementMap: Record<'Fire' | 'Earth' | 'Air' | 'Water', number> = {
    Fire: fireScore,
    Earth: earthScore,
    Air: airScore,
    Water: waterScore,
  }

  const dominant_element = Object.entries(elementMap).sort(
    (a, b) => b[1] - a[1]
  )[0][0] as CorrelatedAstrology['dominant_element']

  // Modality mapping from judging/perceiving and pacing
  // - Cardinal: decisive, initiating (assertiveness, fast_decisive, high judging)
  // - Fixed: steady, consistent (routine, patient, conscientiousness)
  // - Mutable: adaptive, flexible (structured_flexible high, breadth preference)
  const judging = d.conscientiousness
  const flexibility = think.structured_flexible
  const routine = behavior.routine_spontaneous
  let dominant_modality: CorrelatedAstrology['dominant_modality'] = 'Mutable'
  if (judging > 60 && (think.processing_speed === 'fast_decisive' || d.assertiveness > 60))
    dominant_modality = 'Cardinal'
  if ((routine < 45 && judging > 55) || routine < 40) dominant_modality = 'Fixed'
  if (flexibility > 60) dominant_modality = 'Mutable'

  // Suggested signs based on dominant element and tonal nuances
  const signsByElement: Record<'Fire' | 'Earth' | 'Air' | 'Water', string[]> = {
    Fire: ['Aries', 'Leo', 'Sagittarius'],
    Earth: ['Taurus', 'Virgo', 'Capricorn'],
    Air: ['Gemini', 'Libra', 'Aquarius'],
    Water: ['Cancer', 'Scorpio', 'Pisces'],
  }
  let suggested = signsByElement[dominant_element]

  // Nudge within element: communication style and values
  if (dominant_element === 'Fire') {
    if (comm.directness > 60) suggested = ['Aries', 'Leo', 'Sagittarius']
    else suggested = ['Leo', 'Sagittarius', 'Aries']
  } else if (dominant_element === 'Earth') {
    if (d.conscientiousness > 65) suggested = ['Virgo', 'Capricorn', 'Taurus']
    else suggested = ['Taurus', 'Virgo', 'Capricorn']
  } else if (dominant_element === 'Air') {
    if (comm.verbosity > 60) suggested = ['Gemini', 'Libra', 'Aquarius']
    else suggested = ['Libra', 'Aquarius', 'Gemini']
  } else if (dominant_element === 'Water') {
    if (comm.emotional_expression > 60) suggested = ['Cancer', 'Pisces', 'Scorpio']
    else suggested = ['Scorpio', 'Cancer', 'Pisces']
  }

  // Planetary tendencies from dimensions
  const planetary_tendencies: string[] = []
  if (d.assertiveness > 60) planetary_tendencies.push('Mars emphasis')
  if (d.agreeableness > 60) planetary_tendencies.push('Venus emphasis')
  if (d.conscientiousness > 60) planetary_tendencies.push('Saturn emphasis')
  if (d.openness > 60) planetary_tendencies.push('Jupiter/Neptune emphasis')
  if (comm.directness > 60 || think.analytical_intuitive < 50)
    planetary_tendencies.push('Mercury clarity')

  const explanation = `Mirrored consciousness → astrology: ${dominant_element} element, ${dominant_modality} modality, signs ${suggested.slice(0, 2).join('/')}. Derived from assertiveness (${d.assertiveness}), conscientiousness (${d.conscientiousness}), openness (${d.openness}), and communication style (directness ${comm.directness}, emotional ${comm.emotional_expression}).`

  return {
    dominant_element,
    suggested_signs: suggested,
    dominant_modality,
    planetary_tendencies,
    explanation,
  }
}

function normalize(val: number): number {
  return Math.max(0, Math.min(100, val))
}
