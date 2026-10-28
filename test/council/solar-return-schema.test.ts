import { describe, expect, it } from 'vitest'
import {
  parseSolarReturnCouncilEdition,
  SolarReturnCouncilEditionSchema,
} from '@/lib/agents/council/solar-return-edition-schema'
import type { SolarReturnCouncilEdition } from '@/lib/agents/council/solar-return-types'

function makeValidEdition(): SolarReturnCouncilEdition {
  return {
    schemaVersion: 1,
    id: 'solar-return-council-v1:2026-10-27',
    date: '2026-10-27',
    timeZone: 'UTC',
    title: 'Solar Return Conclave · Scorpio Alignment',
    summary: 'A year-over-year dialogue contrasting the sky of one tropical year ago with today.',
    returnIso: '2025-10-27T17:45:00.000Z',
    referenceIso: '2026-10-27T12:00:00.000Z',
    quality: 'verified',
    source: 'swiss-ephemeris',
    telemetry: {
      solarAlignment: {
        targetLongitude: 214.5,
        returnLongitude: 214.50001,
        deltaArcminutes: 0.0006,
        exactMatch: true,
        sign: 'Scorpio',
        degree: 4,
        minute: 30,
      },
      returnSky: {
        iso: '2025-10-27T17:45:00.000Z',
        timestamp: 1761587100000,
        source: 'swiss-ephemeris',
        quality: 'verified',
        positions: {
          Sun: {
            planet: 'Sun',
            sign: 'Scorpio',
            degree: 4.5,
            longitude: 214.5,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Moon: {
            planet: 'Moon',
            sign: 'Capricorn',
            degree: 15.0,
            longitude: 285.0,
            retrograde: false,
            dignity: 'Detriment',
            element: 'earth',
          },
          Mercury: {
            planet: 'Mercury',
            sign: 'Libra',
            degree: 29.0,
            longitude: 209.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'air',
          },
          Venus: {
            planet: 'Venus',
            sign: 'Virgo',
            degree: 19.0,
            longitude: 169.0,
            retrograde: false,
            dignity: 'Fall',
            element: 'earth',
          },
          Mars: {
            planet: 'Mars',
            sign: 'Scorpio',
            degree: 11.0,
            longitude: 221.0,
            retrograde: false,
            dignity: 'Domicile',
            element: 'water',
          },
          Jupiter: {
            planet: 'Jupiter',
            sign: 'Taurus',
            degree: 10.0,
            longitude: 40.0,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'earth',
          },
          Saturn: {
            planet: 'Saturn',
            sign: 'Pisces',
            degree: 0.5,
            longitude: 330.5,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'water',
          },
          Uranus: {
            planet: 'Uranus',
            sign: 'Taurus',
            degree: 21.0,
            longitude: 51.0,
            retrograde: true,
            dignity: 'Fall',
            element: 'earth',
          },
          Neptune: {
            planet: 'Neptune',
            sign: 'Pisces',
            degree: 25.0,
            longitude: 355.0,
            retrograde: true,
            dignity: 'Domicile',
            element: 'water',
          },
          Pluto: {
            planet: 'Pluto',
            sign: 'Capricorn',
            degree: 28.0,
            longitude: 298.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'earth',
          },
        },
        elements: {
          fire: 0,
          water: 4,
          earth: 5,
          air: 1,
          percentages: { fire: 0, water: 0.4, earth: 0.5, air: 0.1 },
        },
        esms: { spirit: 2.2, essence: 8.4, matter: 7.9, substance: 1.1 },
        thermodynamics: { heat: 0.35, reactivity: 0.88, entropy: 0.45, gregsEnergy: -0.04 },
      },
      referenceSky: {
        iso: '2026-10-27T12:00:00.000Z',
        timestamp: 1793102400000,
        source: 'swiss-ephemeris',
        quality: 'verified',
        positions: {
          Sun: {
            planet: 'Sun',
            sign: 'Scorpio',
            degree: 4.5,
            longitude: 214.5,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Moon: {
            planet: 'Moon',
            sign: 'Taurus',
            degree: 12.0,
            longitude: 42.0,
            retrograde: false,
            dignity: 'Exaltation',
            element: 'earth',
          },
          Mercury: {
            planet: 'Mercury',
            sign: 'Scorpio',
            degree: 18.0,
            longitude: 228.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'water',
          },
          Venus: {
            planet: 'Venus',
            sign: 'Sagittarius',
            degree: 2.0,
            longitude: 242.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'fire',
          },
          Mars: {
            planet: 'Mars',
            sign: 'Leo',
            degree: 28.0,
            longitude: 148.0,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'fire',
          },
          Jupiter: {
            planet: 'Jupiter',
            sign: 'Gemini',
            degree: 20.0,
            longitude: 80.0,
            retrograde: true,
            dignity: 'Detriment',
            element: 'air',
          },
          Saturn: {
            planet: 'Saturn',
            sign: 'Pisces',
            degree: 13.0,
            longitude: 343.0,
            retrograde: true,
            dignity: 'Peregrine',
            element: 'water',
          },
          Uranus: {
            planet: 'Uranus',
            sign: 'Taurus',
            degree: 26.0,
            longitude: 56.0,
            retrograde: true,
            dignity: 'Fall',
            element: 'earth',
          },
          Neptune: {
            planet: 'Neptune',
            sign: 'Pisces',
            degree: 27.0,
            longitude: 357.0,
            retrograde: true,
            dignity: 'Domicile',
            element: 'water',
          },
          Pluto: {
            planet: 'Pluto',
            sign: 'Aquarius',
            degree: 0.8,
            longitude: 300.8,
            retrograde: false,
            dignity: 'Peregrine',
            element: 'air',
          },
        },
        elements: {
          fire: 2,
          water: 4,
          earth: 2,
          air: 2,
          percentages: { fire: 0.2, water: 0.4, earth: 0.2, air: 0.2 },
        },
        esms: { spirit: 3.1, essence: 7.2, matter: 5.5, substance: 2.0 },
        thermodynamics: { heat: 0.52, reactivity: 0.65, entropy: 0.55, gregsEnergy: 0.16 },
      },
      shiftedRulers: [
        { planet: 'Moon', fromSign: 'Capricorn', toSign: 'Taurus', shifted: true },
        { planet: 'Mercury', fromSign: 'Libra', toSign: 'Scorpio', shifted: true },
        { planet: 'Venus', fromSign: 'Virgo', toSign: 'Sagittarius', shifted: true },
        { planet: 'Mars', fromSign: 'Scorpio', toSign: 'Leo', shifted: true },
        { planet: 'Jupiter', fromSign: 'Taurus', toSign: 'Gemini', shifted: true },
      ],
      elementalDeltas: { fire: -0.2, water: 0, earth: 0.3, air: -0.1 },
      esmsDeltas: { spirit: -0.9, essence: 1.2, matter: 2.4, substance: -0.9 },
      thermodynamicDeltas: { heat: -0.17, reactivity: 0.23 },
    },
    turns: [
      {
        id: 'turn-1',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'opening',
        text: 'Welcome back to the round table. Today we look through the telescope of time to exactly one tropical year ago, verified astronomical return confirmed.',
        newClaim: 'The solar return anchors our 365-day perspective.',
        speechAct: 'inaugurate',
        usedEvidenceIds: ['solar-alignment'],
        coverageIds: ['solar-alignment'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-2',
        speakerKey: 'moon',
        speakerName: 'Moon',
        role: 'planetary-reading',
        text: 'Speaking from my position in Capricorn one year ago, the emotional atmosphere was grounded in containment and endurance, contrasting with Taurus comfort.',
        newClaim: 'Capricorn containment asks for emotional discipline over comfort.',
        speechAct: 'support',
        usedEvidenceIds: ['placement-moon'],
        coverageIds: ['placement-moon'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-3',
        speakerKey: 'mercury',
        speakerName: 'Mercury',
        role: 'planetary-reading',
        text: 'In Libra last year, my thoughts sought reciprocal balance and fairness before plunging into current investigative depths.',
        newClaim: 'Libra thought values diplomatic synthesis above all.',
        speechAct: 'qualify',
        usedEvidenceIds: ['placement-mercury'],
        coverageIds: ['placement-mercury'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-4',
        speakerKey: 'venus',
        speakerName: 'Venus',
        role: 'planetary-reading',
        text: 'From analytical Virgo, devotion was expressed through practical service, craft, and discerning attention.',
        newClaim: 'Devotion in Virgo is refined through deliberate daily service.',
        speechAct: 'support',
        usedEvidenceIds: ['placement-venus'],
        coverageIds: ['placement-venus'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-5',
        speakerKey: 'mars',
        speakerName: 'Mars',
        role: 'planetary-reading',
        text: 'In my home water sign of Scorpio last cycle, will and strategic patience held silent power rather than outward fire.',
        newClaim: 'Strategic will gathers strength in focused stillness.',
        speechAct: 'challenge',
        usedEvidenceIds: ['placement-mars'],
        coverageIds: ['placement-mars'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-6',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'integration',
        text: 'We see how personal instinct, value, and action aligned during that return epoch. Now let us bridge to social and collective architecture.',
        newClaim: 'Personal currents lay the foundation for collective growth.',
        speechAct: 'synthesize',
        usedEvidenceIds: ['inner-bridge'],
        coverageIds: ['inner-bridge'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-7',
        speakerKey: 'jupiter',
        speakerName: 'Jupiter',
        role: 'planetary-reading',
        text: 'Rooted in Taurus one year back, growth was measured in physical cultivate and tangible resource development.',
        newClaim: 'Taurus expansion builds tangible sanctuaries of growth.',
        speechAct: 'support',
        usedEvidenceIds: ['placement-jupiter'],
        coverageIds: ['placement-jupiter'],
        provenance: { source: 'model' },
      },
      {
        id: 'turn-8',
        speakerKey: 'gregory',
        speakerName: 'Gregory Castro',
        role: 'closing',
        text: 'Synthesizing what Moon and Mars observed: one year ago emphasized strategic patience and emotional containment. Today, practice patience while honoring new initiatives.',
        newClaim: 'Year-over-year awareness transmutes past restraint into present mastery.',
        speechAct: 'synthesize',
        usedEvidenceIds: ['closing-summary'],
        coverageIds: ['closing-summary'],
        provenance: { source: 'model' },
      },
    ],
    coveredTopics: [
      'solar-alignment',
      'placement-moon',
      'placement-mercury',
      'placement-venus',
      'placement-mars',
      'inner-bridge',
      'placement-jupiter',
      'closing-summary',
    ],
    generatedAt: '2026-10-27T12:00:00.000Z',
    promptVersion: 'solar-return-council-v1',
  }
}

describe('SolarReturnCouncilEditionSchema', () => {
  it('validates a correct Solar Return edition', () => {
    const valid = makeValidEdition()
    const result = SolarReturnCouncilEditionSchema.safeParse(valid)
    expect(result.success).toBe(true)

    const parsed = parseSolarReturnCouncilEdition(valid)
    expect(parsed).not.toBeNull()
    expect(parsed?.id).toBe(valid.id)
  })

  it('rejects an edition where Gregory does not open', () => {
    const invalid = makeValidEdition()
    invalid.turns[0].speakerKey = 'moon'
    const result = SolarReturnCouncilEditionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects an edition where Gregory does not close', () => {
    const invalid = makeValidEdition()
    invalid.turns[invalid.turns.length - 1].speakerKey = 'mars'
    const result = SolarReturnCouncilEditionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects turns containing forbidden telemetry (e.g. raw degree numbers)', () => {
    const invalid = makeValidEdition()
    invalid.turns[1].text = 'The Moon was at 15.0° Capricorn yesterday.'
    const result = SolarReturnCouncilEditionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects editions with duplicate turn IDs', () => {
    const invalid = makeValidEdition()
    invalid.turns[1].id = invalid.turns[0].id
    const result = SolarReturnCouncilEditionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('rejects editions with fewer than 8 turns', () => {
    const invalid = makeValidEdition()
    invalid.turns = invalid.turns.slice(0, 5)
    const result = SolarReturnCouncilEditionSchema.safeParse(invalid)
    expect(result.success).toBe(false)
  })

  it('correctly deserializes from stringified JSON while preserving yearOverYearTelemetry', () => {
    const valid = makeValidEdition()
    const serialized = JSON.stringify(valid)
    const deserialized = parseSolarReturnCouncilEdition(serialized)
    expect(deserialized).not.toBeNull()
    expect(deserialized?.telemetry.solarAlignment.sign).toBe('Scorpio')
    expect(deserialized?.telemetry.shiftedRulers).toHaveLength(5)
  })

  it('rejects a daily council edition payload passed as solar return edition', () => {
    const dailyPayload = {
      schemaVersion: 1,
      id: 'daily-council-v3:2026-10-27',
      date: '2026-10-27',
      timeZone: 'UTC',
      title: 'Daily Council',
      summary: 'Daily summary',
      brief: { id: 'brief-1' },
      turns: [],
    }
    const deserialized = parseSolarReturnCouncilEdition(dailyPayload)
    expect(deserialized).toBeNull()
  })
})
