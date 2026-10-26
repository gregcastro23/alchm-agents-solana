// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  FORGED_CRAFTED_BY,
  PUBLIC_AURA_KEYS,
  PUBLIC_PERSONALITY_CORE_KEYS,
  extractLocationName,
  extractSunSign,
  isSyntheticAgentId,
  isUserCreatedAgentRow,
  projectNumberRecord,
  projectPublicAura,
  projectPublicBirthData,
  projectPublicNatalChart,
  projectPublicPersonalityCore,
  projectStringList,
  toPersistedAura,
} from '@/lib/agents/forged-privacy'
import { isPublicRosterId } from '@/lib/agents/public-roster'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'

describe('isUserCreatedAgentRow', () => {
  it('recognises each marker a person-written row can carry', () => {
    expect(isUserCreatedAgentRow({ historicalEra: 'user_created' })).toBe(true)
    expect(isUserCreatedAgentRow({ historicalEra: 'MONICA_SPECIAL' })).toBe(true)
    expect(isUserCreatedAgentRow({ craftedBy: FORGED_CRAFTED_BY })).toBe(true)
    expect(isUserCreatedAgentRow({ isUserCreated: true })).toBe(true)
  })

  it('does not call a public figure or a sky agent a person', () => {
    expect(isUserCreatedAgentRow({})).toBe(false)
    expect(
      isUserCreatedAgentRow({ historicalEra: 'Antiquity', craftedBy: 'philosopher-stone' })
    ).toBe(false)
    expect(isUserCreatedAgentRow({ isUserCreated: false })).toBe(false)
  })
})

describe('isSyntheticAgentId / isPublicRosterId', () => {
  it('knows the sky-generated id prefixes, case-insensitively', () => {
    for (const id of [
      'planetary-sun-1',
      'moon-phase-3',
      'moon-agent-9',
      'planetary_mars',
      ' Planetary-Venus',
    ]) {
      expect(isSyntheticAgentId(id)).toBe(true)
    }
    for (const id of ['', 'agent-planetary-x-1', 'isaac-newton', 'moon', 'moon-x']) {
      expect(isSyntheticAgentId(id)).toBe(false)
    }
  })

  it('treats exactly the canonical roster and sky agents as public', () => {
    expect(isPublicRosterId(HISTORICAL_AGENTS[0].id)).toBe(true)
    expect(isPublicRosterId('moon-agent-77')).toBe(true)
    expect(isPublicRosterId('agent-verdant-wren-1792901795839-pcd3lflr4')).toBe(false)
    expect(isPublicRosterId(undefined)).toBe(false)
    expect(isPublicRosterId(42)).toBe(false)
  })
})

describe('extractLocationName', () => {
  it('reads a string, a name, or a city, and nothing else', () => {
    expect(extractLocationName('  Lisbon  ')).toBe('Lisbon')
    expect(extractLocationName({ name: ' Seattle, WA ', lat: 1, lon: 2 })).toBe('Seattle, WA')
    expect(extractLocationName({ city: 'Rome', lat: 1 })).toBe('Rome')
    expect(extractLocationName({ lat: 1, lon: 2 })).toBeNull()
    expect(extractLocationName({ name: 7 })).toBeNull()
    expect(extractLocationName(null)).toBeNull()
    expect(extractLocationName('   ')).toBeNull()
    expect(extractLocationName(['Rome'])).toBeNull()
  })

  it('projectPublicBirthData keeps the place name only and says Unknown otherwise', () => {
    expect(projectPublicBirthData({ name: 'Reykjavik', lat: 64.1, lon: -21.9 })).toEqual({
      location: { name: 'Reykjavik' },
    })
    expect(projectPublicBirthData({ lat: 64.1, lon: -21.9 })).toEqual({
      location: { name: 'Unknown' },
    })
    expect(projectPublicBirthData(undefined)).toEqual({ location: { name: 'Unknown' } })
  })
})

describe('extractSunSign / projectPublicNatalChart', () => {
  it('reads the roster/fixture shape, an array of planets, a direct Sun and the forge shape', () => {
    expect(extractSunSign({ planets: { Sun: { sign: 'Pisces', degree: 23.45 } } })).toBe('Pisces')
    expect(extractSunSign({ planets: { sun: { sign: ' Leo ' } } })).toBe('Leo')
    expect(
      extractSunSign({
        planets: [
          { name: 'Moon', sign: 'Aries' },
          { name: 'Sun', sign: 'Taurus' },
        ],
      })
    ).toBe('Taurus')
    expect(extractSunSign({ planets: [{ label: 'SUN', sign: 'Gemini' }] })).toBe('Gemini')
    expect(extractSunSign({ Sun: { sign: 'Cancer' } })).toBe('Cancer')
    expect(
      extractSunSign({
        tropical: {
          CelestialBodies: {
            all: [
              { label: 'Moon', Sign: { label: 'Aries' } },
              { label: 'Sun', Sign: { label: 'Virgo' } },
            ],
          },
        },
      })
    ).toBe('Virgo')
    expect(
      extractSunSign({ tropical: { CelestialBodies: { Sun: { Sign: { label: 'Libra' } } } } })
    ).toBe('Libra')
  })

  it('reads nothing from a chart that does not name a Sun sign', () => {
    for (const chart of [
      null,
      undefined,
      'Cancer',
      5,
      [],
      {},
      { planets: {} },
      { planets: { Sun: {} } },
      { planets: { Sun: { sign: '  ' } } },
      { tropical: {} },
      { tropical: { CelestialBodies: { all: [] } } },
    ]) {
      expect(extractSunSign(chart)).toBeNull()
    }
  })

  it('projects to the Sun sign alone: no degree, ascendant, house, aspect or other body survives', () => {
    const chart = {
      planets: { Sun: { sign: 'Pisces', degree: 23.45 }, Moon: { sign: 'Cancer', degree: 12.1 } },
      ascendant: 62.4,
      houses: { ASC: 62.4 },
      aspects: [{ planet1: 'Sun', planet2: 'Moon' }],
      tropical: { Ascendant: { degrees: 1 } },
    }
    expect(projectPublicNatalChart(chart)).toEqual({ planets: { Sun: { sign: 'Pisces' } } })
    expect(projectPublicNatalChart({})).toBeNull()
  })
})

describe('projectPublicPersonalityCore', () => {
  const stored = {
    essence: 'Garden alchemy',
    expression: 'I am Dana Whitfield, a nurse in Seattle',
    emotion: 'honesty, patience',
    temperament: 'steady',
    lifeStory: 'Born in a small hospital',
    poetry: 'salt on the windowsill',
    userProvidedContext: { aboutYourself: 'x' },
    somethingAddedByAFutureWriter: 'private',
  }

  it('is an allow-list: only essence and temperament, and a future key is private by default', () => {
    expect(projectPublicPersonalityCore(stored)).toEqual({
      essence: 'Garden alchemy',
      temperament: 'steady',
    })
    expect([...PUBLIC_PERSONALITY_CORE_KEYS]).toEqual(['essence', 'temperament'])
  })

  it('keeps only non-blank strings', () => {
    expect(projectPublicPersonalityCore({ essence: '  ', temperament: 5 })).toEqual({})
    expect(projectPublicPersonalityCore({ essence: { nested: 'Garden' } })).toEqual({})
    expect(projectPublicPersonalityCore(null)).toEqual({})
    expect(projectPublicPersonalityCore('Garden alchemy')).toEqual({})
    expect(projectPublicPersonalityCore(['essence'])).toEqual({})
  })
})

describe('projectPublicAura', () => {
  it('keeps type, colour and intensity, and drops a chart however it is nested', () => {
    expect(
      projectPublicAura({
        type: 'radiant',
        color: '#A78BFA',
        intensity: 0.7,
        monicaConstant: 1.04,
        consciousness: { spirit: 2 },
        sourceCharts: [{ tropical: { Ascendant: { degrees: 18.5 } } }],
        extra: 'x',
      })
    ).toEqual({ type: 'radiant', color: '#A78BFA', intensity: 0.7 })
    expect([...PUBLIC_AURA_KEYS]).toEqual(['type', 'color', 'intensity'])
  })

  it('checks the types: a colour that is an object, a non-finite intensity are dropped', () => {
    expect(projectPublicAura({ type: 1, color: { hex: '#fff' }, intensity: '0.7' })).toEqual({})
    expect(projectPublicAura({ intensity: Number.NaN })).toEqual({})
    expect(projectPublicAura({ intensity: Number.POSITIVE_INFINITY })).toEqual({})
    expect(projectPublicAura({ intensity: 0 })).toEqual({ intensity: 0 })
  })

  it('is null for a missing aura and for a non-object', () => {
    for (const aura of [null, undefined, 'radiant', 3, ['sourceCharts']]) {
      expect(projectPublicAura(aura)).toBeNull()
    }
  })
})

describe('toPersistedAura (what the forge may store)', () => {
  const synthesis = {
    monicaConstant: 1.043,
    consciousness: { spirit: 2, essence: 2.5, matter: 3, substance: 1.5 },
    sourceCharts: [{ tropical: { Ascendant: { degrees: 18.5 } } }],
    dominantInfluence: 'birth',
    type: 'birth-moment',
  }

  it('stores the scalars and never a chart', () => {
    expect(toPersistedAura(synthesis)).toEqual({
      monicaConstant: 1.043,
      consciousness: { spirit: 2, essence: 2.5, matter: 3, substance: 1.5 },
    })
  })

  it('carries a colour and an intensity if the synthesis ever sets them, but not the synthesis kind', () => {
    expect(toPersistedAura({ ...synthesis, color: '#8B5CF6', intensity: 0.4 })).toEqual({
      monicaConstant: 1.043,
      consciousness: { spirit: 2, essence: 2.5, matter: 3, substance: 1.5 },
      color: '#8B5CF6',
      intensity: 0.4,
    })
  })

  it('drops anything that is not a finite number, and a partial consciousness', () => {
    expect(
      toPersistedAura({
        monicaConstant: Number.NaN,
        consciousness: { spirit: 1, essence: 2, matter: 3 },
      })
    ).toEqual({})
    expect(
      toPersistedAura({
        monicaConstant: '1.2',
        consciousness: { spirit: 1, essence: 2, matter: 3, substance: 'x' },
      })
    ).toEqual({})
    expect(toPersistedAura(null)).toEqual({})
    expect(toPersistedAura('sourceCharts')).toEqual({})
  })
})

describe('projectNumberRecord / projectStringList', () => {
  it('keeps finite numbers under sane keys only', () => {
    expect(
      projectNumberRecord({
        hp: 31,
        atk: 12.5,
        nested: { a: 1 },
        bad: 'x',
        nan: Number.NaN,
        'with space': 1,
        '9lives': 1,
      })
    ).toEqual({
      hp: 31,
      atk: 12.5,
    })
    expect(projectNumberRecord(null)).toBeNull()
    expect(projectNumberRecord([1, 2])).toBeNull()
    expect(projectNumberRecord('hp')).toBeNull()
  })

  it('caps how many entries it reads', () => {
    const wide = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`k${i}`, i]))
    expect(Object.keys(projectNumberRecord(wide) ?? {})).toHaveLength(64)
  })

  it('keeps short strings only, never an object that could carry the owner text', () => {
    expect(
      projectStringList([
        'Alchemy',
        '  ',
        3,
        { type: 'Insight', description: 'my mother left' },
        null,
        'Tarot',
      ])
    ).toEqual(['Alchemy', 'Tarot'])
    expect(projectStringList('Alchemy')).toEqual([])
    expect(projectStringList(undefined)).toEqual([])
    expect(projectStringList(['x'.repeat(500)])[0]).toHaveLength(200)
    expect(projectStringList(Array.from({ length: 80 }, (_, i) => `d${i}`))).toHaveLength(50)
  })
})
