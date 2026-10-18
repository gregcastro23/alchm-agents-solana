/** @vitest-environment node */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { builtinModules } from 'node:module'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { CraftedAgent, NatalChartProvenance } from '@/lib/agent-types'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { CORE_STAT_KEYS, rateAgent } from '@/lib/agents/rating/ovr-archetype'
import {
  ARCHETYPE_RELICS,
  COLLAR_STYLES,
  CROWN_STYLES,
  ERA_FIELD_HEX,
  ERA_STYLE_POOLS,
  MANTLE_STYLES,
  PILOT_RELICS,
  PLANET_PALETTES,
  SIGNATURE_RELICS,
  VESSEL_APPEARANCE_REGISTRY,
  VESSEL_ERAS,
  appearanceFromSeed,
  deriveVesselAppearance,
  eraForBirthYear,
  getVesselAppearance,
  paletteFamilyOf,
  renderPortraitSvg,
  toSvgDataUri,
  type PortraitInput,
  type VesselAppearanceProfile,
  type VesselEra,
} from '@/lib/agents/rating/vessel-appearance'

const ROOT = join(__dirname, '..', '..')
const MODULE_PATH = join(ROOT, 'lib/agents/rating/vessel-appearance.ts')
const DATA_URI_PREFIX = 'data:image/svg+xml;utf8,'
const HEX = /^#[0-9a-f]{6}$/

// The cross-repo contract, restated here on purpose: if the module's unions drift, this fails.
const CONTRACT_RELICS = [
  'prism-octahedron',
  'vitruvian-gyroscope',
  'herbarium-quill-lantern',
  'solar-astrolabe',
  'crucible-hammer',
  'tidal-tuning-fork',
  'philosophers-codex',
  'harmonic-signet',
  'scrying-lens',
  'quicksilver-caduceus',
  'verdant-thyrsus',
]
const PILOT_CROWNS = ['newton-curls', 'da-vinci-beret-beard', 'dickinson-parted-bun']
const PILOT_IDS = ['isaac-newton', 'leonardo-da-vinci', 'emily-dickinson', 'user-avatar-neo']
const PLANET_NAMES = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
]
/** Traditional-and-modern rulers: an independent copy of the table the module reads. */
const SIGN_RULERS: Record<string, string> = {
  Aries: 'Mars',
  Taurus: 'Venus',
  Gemini: 'Mercury',
  Cancer: 'Moon',
  Leo: 'Sun',
  Virgo: 'Mercury',
  Libra: 'Venus',
  Scorpio: 'Pluto',
  Sagittarius: 'Jupiter',
  Capricorn: 'Saturn',
  Aquarius: 'Uranus',
  Pisces: 'Neptune',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const agentById = (id: string): CraftedAgent => {
  const agent = HISTORICAL_AGENTS.find(candidate => candidate.id === id)
  if (!agent) throw new Error(`No historical agent ${id}`)
  return agent
}

/** An agent with a computed natal chart, so its derivation does not hinge on filler. */
const BASE = agentById('machiavelli')
const ROSTER_IDS = HISTORICAL_AGENTS.map(agent => agent.id)
const NON_PILOT_AGENTS = HISTORICAL_AGENTS.filter(agent => !PILOT_IDS.includes(agent.id))

function profileOf(id: string): VesselAppearanceProfile {
  const profile = getVesselAppearance(id)
  if (!profile) throw new Error(`No vessel appearance for ${id}`)
  return profile
}

function withSun(
  agent: CraftedAgent,
  sign: string,
  provenance: NatalChartProvenance | undefined
): CraftedAgent {
  const chart = agent.consciousness.natalChart
  return {
    ...agent,
    consciousness: {
      ...agent.consciousness,
      natalChart: {
        ...chart,
        provenance,
        planets: { ...chart.planets, Sun: { ...chart.planets.Sun, sign } },
      },
    },
  }
}

function withAvatar(agent: CraftedAgent, avatar: unknown): CraftedAgent {
  return { ...agent, appearance: { ...agent.appearance, avatar: avatar as string } }
}

function withBirth(agent: CraftedAgent, date: unknown, birthDate?: string): CraftedAgent {
  return {
    ...agent,
    birthData: { ...agent.birthData, date: date as Date },
    ...(birthDate === undefined ? {} : { birthDate }),
  }
}

const decodeSvg = (uri: string): string => decodeURIComponent(uri.slice(DATA_URI_PREFIX.length))

const fingerprint = (value: unknown): string =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex').slice(0, 16)

const share = (values: string[]): number => {
  const counts = new Map<string, number>()
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1)
  return Math.max(...counts.values()) / values.length
}

const stdev = (values: number[]): number => {
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  return Math.sqrt(values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length)
}

/** A portrait input from a profile, with overrides: the renderer's whole surface. */
function portraitInput(
  profile: VesselAppearanceProfile,
  patch: Partial<PortraitInput> = {}
): PortraitInput {
  return {
    era: profile.era,
    headSilhouette: profile.headSilhouette,
    garmentSilhouette: profile.garmentSilhouette,
    signatureRelic: profile.signatureRelic,
    paletteOverrides: profile.paletteOverrides,
    ...patch,
  }
}

/** A strict-enough XML check for what the portrait emits: one root, nested tags, quoted attrs. */
function assertWellFormedXml(xml: string): void {
  const tag = /<(\/?)([A-Za-z][\w-]*)((?:\s+[A-Za-z][\w:-]*="[^"<&]*")*)\s*(\/?)>/y
  const stack: string[] = []
  let root: string | undefined
  let i = 0
  while (i < xml.length) {
    if (xml[i] !== '<') {
      const next = xml.indexOf('<', i)
      const text = xml.slice(i, next === -1 ? xml.length : next)
      if (text.includes('&') || text.includes('>')) throw new Error(`Bad text at ${i}: ${text}`)
      if (stack.length === 0) throw new Error(`Content outside the root at ${i}`)
      i += text.length
      continue
    }
    tag.lastIndex = i
    const match = tag.exec(xml)
    if (!match) throw new Error(`Malformed tag at ${i}: ${xml.slice(i, i + 40)}`)
    const [whole, closing, name, , selfClosing] = match
    if (closing) {
      if (selfClosing) throw new Error(`Bad closing tag ${whole}`)
      if (stack.pop() !== name) throw new Error(`Mismatched </${name}> at ${i}`)
    } else {
      if (stack.length === 0 && root !== undefined) throw new Error(`Second root <${name}>`)
      root ??= name
      if (!selfClosing) stack.push(name)
    }
    i += whole.length
    if (stack.length === 0 && i < xml.length) throw new Error(`Content after the root at ${i}`)
  }
  if (stack.length > 0) throw new Error(`Unclosed: ${stack.join(' > ')}`)
  if (root !== 'svg') throw new Error(`Root is <${String(root)}>, not <svg>`)
}

function expectCompleteProfile(profile: VesselAppearanceProfile, problems: string[]): void {
  const fail = (what: string): number => problems.push(`${profile.agentId}: ${what}`)
  if (typeof profile.agentId !== 'string' || profile.agentId === '') fail('agentId')
  if (!VESSEL_ERAS.includes(profile.era)) fail(`era ${profile.era}`)
  const { crownStyle, faceProportion } = profile.headSilhouette
  if (!CROWN_STYLES.includes(crownStyle)) fail(`crown ${crownStyle}`)
  for (const [name, value] of Object.entries(faceProportion)) {
    if (!(value >= 0 && value <= 1)) fail(`face ${name}=${value}`)
  }
  if (Object.keys(faceProportion).sort().join() !== 'browDepth,cranialHeight,jawWidth') {
    fail('face keys')
  }
  if (!MANTLE_STYLES.includes(profile.garmentSilhouette.mantleStyle)) fail('mantle')
  if (!COLLAR_STYLES.includes(profile.garmentSilhouette.collarStyle)) fail('collar')
  if (!CONTRACT_RELICS.includes(profile.signatureRelic)) fail(`relic ${profile.signatureRelic}`)
  const palette = profile.paletteOverrides
  if (
    Object.keys(palette).sort().join() !==
    'hairOrCrownHex,primaryGarmentHex,secondaryTrimHex,skinOrMaterialToneHex'
  ) {
    fail('palette keys')
  }
  for (const [name, value] of Object.entries(palette)) {
    if (!HEX.test(value)) fail(`palette ${name}=${value}`)
  }
  if (!profile.portraitSvgDataUri.startsWith(DATA_URI_PREFIX)) fail('data URI prefix')
  if (profile.avatarModelUrl !== undefined) fail('avatarModelUrl set')
}

afterEach(() => {
  vi.useRealTimers()
})

// ─── The contract ────────────────────────────────────────────────────────────

describe('the string-union contract', () => {
  it('exports the unions exactly as the cross-repo contract spells them', () => {
    expect([...VESSEL_ERAS]).toEqual([
      'ancient',
      'renaissance',
      'enlightenment',
      'romantic',
      'modern',
      'astral',
    ])
    expect([...CROWN_STYLES]).toEqual([
      ...PILOT_CROWNS,
      'sovereign-crest',
      'laurel-wreath',
      'scholar-hood',
      'astral-helm',
    ])
    expect([...MANTLE_STYLES]).toEqual([
      'enlightenment-coat',
      'renaissance-drape',
      'victorian-shawl',
      'alchemical-vestments',
      'scholar-robe',
    ])
    expect([...COLLAR_STYLES]).toEqual([
      'high-cravat',
      'renaissance-collar',
      'lace-tippet',
      'astral-gorget',
      'none',
    ])
    expect([...PILOT_RELICS]).toEqual(CONTRACT_RELICS.slice(0, 4))
  })

  it('gives each Sacred 7 stat exactly one distinct, kebab-case archetype relic', () => {
    expect(Object.keys(ARCHETYPE_RELICS).sort()).toEqual([...CORE_STAT_KEYS].sort())
    const relics = Object.values(ARCHETYPE_RELICS)
    expect(new Set(relics).size).toBe(7)
    for (const relic of relics) {
      expect(relic).toMatch(/^[a-z]+(-[a-z]+)*$/)
      expect(PILOT_RELICS as readonly string[]).not.toContain(relic)
    }
    expect([...SIGNATURE_RELICS].sort()).toEqual([...CONTRACT_RELICS].sort())
  })

  it('freezes the relic table so a caller cannot repoint a stat', () => {
    expect(Object.isFrozen(ARCHETYPE_RELICS)).toBe(true)
    expect(() => {
      ;(ARCHETYPE_RELICS as Record<string, string>).power = 'prism-octahedron'
    }).toThrow(TypeError)
  })
})

// ─── Era ─────────────────────────────────────────────────────────────────────

describe('eraForBirthYear', () => {
  it.each([
    [1299, 'ancient'],
    [1300, 'renaissance'],
    [1599, 'renaissance'],
    [1600, 'enlightenment'],
    [1789, 'enlightenment'],
    [1790, 'romantic'],
    [1899, 'romantic'],
    [1900, 'modern'],
    [2026, 'modern'],
    [4000, 'modern'],
    [121, 'ancient'],
    [69, 'ancient'],
    [0, 'ancient'],
    [-1, 'ancient'],
    [-287, 'ancient'],
    [-5000, 'ancient'],
  ] as const)('puts year %i in the %s era', (year, era) => {
    expect(eraForBirthYear(year)).toBe(era)
  })

  it('is astral when there is no usable birth year', () => {
    expect(eraForBirthYear(undefined)).toBe('astral')
    expect(eraForBirthYear(Number.NaN)).toBe('astral')
    expect(eraForBirthYear(Number.POSITIVE_INFINITY)).toBe('astral')
    expect(eraForBirthYear(Number.NEGATIVE_INFINITY)).toBe('astral')
    expect(eraForBirthYear(null as unknown as undefined)).toBe('astral')
  })

  it('floors a fractional year instead of rounding it across a boundary', () => {
    expect(eraForBirthYear(1299.99)).toBe('ancient')
    expect(eraForBirthYear(1599.99)).toBe('renaissance')
    expect(eraForBirthYear(1789.5)).toBe('enlightenment')
    expect(eraForBirthYear(1899.999)).toBe('romantic')
    expect(eraForBirthYear(-0.5)).toBe('ancient')
  })

  it('never moves backwards and changes era exactly at the four boundaries', () => {
    const order = ['ancient', 'renaissance', 'enlightenment', 'romantic', 'modern']
    let previous = -1
    const changedAt: number[] = []
    for (let year = -3000; year <= 2200; year++) {
      const index = order.indexOf(eraForBirthYear(year))
      expect(index).toBeGreaterThanOrEqual(previous)
      if (index !== previous && previous !== -1) changedAt.push(year)
      previous = index
    }
    expect(changedAt).toEqual([1300, 1600, 1790, 1900])
  })
})

describe('birth year → era for agents', () => {
  it('reads the era from the roster birth year, not from a remapped two-digit year', () => {
    expect(profileOf('cleopatra').era).toBe('ancient') // stored as 0069-01-01
    expect(profileOf('marcus-aurelius').era).toBe('ancient') // 121 CE
    expect(profileOf('archimedes').era).toBe('ancient') // BCE
    expect(profileOf('dante-alighieri').era).toBe('ancient') // medieval counts as ancient
    expect(profileOf('joan-of-arc').era).toBe('renaissance')
    expect(profileOf('johannes-kepler-1571').era).toBe('renaissance')
    expect(profileOf('isaac-newton').era).toBe('enlightenment')
    expect(profileOf('sojourner-truth').era).toBe('romantic') // 1797, just past 1790
    expect(profileOf('albert-einstein').era).toBe('romantic')
    expect(profileOf('frida-kahlo').era).toBe('modern')
  })

  it('matches eraForBirthYear for every derived agent', () => {
    const problems = NON_PILOT_AGENTS.flatMap(agent => {
      const expected = eraForBirthYear(agent.birthData.date.getFullYear())
      return profileOf(agent.id).era === expected ? [] : [agent.id]
    })
    expect(problems).toEqual([])
  })

  it.each([
    ['1299-12-31T12:00:00', 'ancient'],
    ['1299-12-31T23:59:00', 'ancient'],
    ['1300-01-01T00:01:00', 'renaissance'],
    ['1300-01-01T12:00:00', 'renaissance'],
    ['1599-12-31T12:00:00', 'renaissance'],
    ['1600-01-01T12:00:00', 'enlightenment'],
    ['1789-12-31T12:00:00', 'enlightenment'],
    ['1790-01-01T12:00:00', 'romantic'],
    ['1899-12-31T12:00:00', 'romantic'],
    ['1899-12-31T23:59:00', 'romantic'],
    ['1900-01-01T00:01:00', 'modern'],
    ['1900-01-01T12:00:00', 'modern'],
    ['-000287-06-15T12:00:00', 'ancient'],
  ] as const)('derives the %s boundary date as %s', (iso, era) => {
    expect(deriveVesselAppearance(withBirth(BASE, new Date(iso))).era).toBe(era)
  })

  it('reads an ISO string by its prefix, so a date-only string cannot slide a year', () => {
    expect(deriveVesselAppearance(withBirth(BASE, '1300-01-01')).era).toBe('renaissance')
    expect(deriveVesselAppearance(withBirth(BASE, '1299-12-31T23:59:59.000Z')).era).toBe('ancient')
    expect(deriveVesselAppearance(withBirth(BASE, '0069-01-01T12:00:00.000Z')).era).toBe('ancient')
    expect(deriveVesselAppearance(withBirth(BASE, '-000287-01-01T12:00:00.000Z')).era).toBe(
      'ancient'
    )
    expect(deriveVesselAppearance(withBirth(BASE, '+001643-01-04T01:38:00.000Z')).era).toBe(
      'enlightenment'
    )
  })

  it('falls back to birthDate, then to astral, when the birth Date is unusable', () => {
    expect(deriveVesselAppearance(withBirth(BASE, new Date('not a date'), '1650-03-02')).era).toBe(
      'enlightenment'
    )
    expect(deriveVesselAppearance(withBirth(BASE, undefined, '-000287-01-01')).era).toBe('ancient')
    expect(deriveVesselAppearance(withBirth(BASE, new Date('not a date'))).era).toBe('astral')
    expect(deriveVesselAppearance(withBirth(BASE, undefined)).era).toBe('astral')
    expect(deriveVesselAppearance(withBirth(BASE, 'sometime', 'also not a date')).era).toBe(
      'astral'
    )
  })
})

// ─── Pilots ──────────────────────────────────────────────────────────────────

describe('the four hand-authored pilots', () => {
  const PILOTS = [
    {
      id: 'isaac-newton',
      era: 'enlightenment',
      crown: 'newton-curls',
      mantle: 'enlightenment-coat',
      collar: 'high-cravat',
      relic: 'prism-octahedron',
      face: { jawWidth: 0.48, browDepth: 0.72, cranialHeight: 0.66 },
      palette: {
        primaryGarmentHex: '#2b2621',
        secondaryTrimHex: '#b5a642',
        hairOrCrownHex: '#d8d2c4',
        skinOrMaterialToneHex: '#e8d6b8',
      },
      portraitUrl: '/avatars/newton.png',
    },
    {
      id: 'leonardo-da-vinci',
      era: 'renaissance',
      crown: 'da-vinci-beret-beard',
      mantle: 'renaissance-drape',
      collar: 'renaissance-collar',
      relic: 'vitruvian-gyroscope',
      face: { jawWidth: 0.62, browDepth: 0.6, cranialHeight: 0.56 },
      palette: {
        primaryGarmentHex: '#8f2f2c',
        secondaryTrimHex: '#c8a165',
        hairOrCrownHex: '#4a3528',
        skinOrMaterialToneHex: '#e2c8a4',
      },
      portraitUrl: '/avatars/leonardo-da-vinci.png',
    },
    {
      id: 'emily-dickinson',
      era: 'romantic',
      crown: 'dickinson-parted-bun',
      mantle: 'victorian-shawl',
      collar: 'lace-tippet',
      relic: 'herbarium-quill-lantern',
      face: { jawWidth: 0.36, browDepth: 0.42, cranialHeight: 0.5 },
      palette: {
        primaryGarmentHex: '#f2ede0',
        secondaryTrimHex: '#9aa393',
        hairOrCrownHex: '#4d3a2e',
        skinOrMaterialToneHex: '#efdcc8',
      },
      portraitUrl: '/avatars/emily-dickinson.png',
    },
    {
      id: 'user-avatar-neo',
      era: 'astral',
      crown: 'astral-helm',
      mantle: 'alchemical-vestments',
      collar: 'astral-gorget',
      relic: 'solar-astrolabe',
      face: { jawWidth: 0.5, browDepth: 0.55, cranialHeight: 0.62 },
      palette: {
        primaryGarmentHex: '#1d1a55',
        secondaryTrimHex: '#d9a441',
        hairOrCrownHex: '#ecd593',
        skinOrMaterialToneHex: '#d6d2ee',
      },
      portraitUrl: undefined,
    },
  ] as const

  it.each(PILOTS)('pins $id exactly', pilot => {
    const profile = profileOf(pilot.id)
    expect(profile.agentId).toBe(pilot.id)
    expect(profile.era).toBe(pilot.era)
    expect(profile.headSilhouette).toEqual({ crownStyle: pilot.crown, faceProportion: pilot.face })
    expect(profile.garmentSilhouette).toEqual({
      mantleStyle: pilot.mantle,
      collarStyle: pilot.collar,
    })
    expect(profile.signatureRelic).toBe(pilot.relic)
    expect(profile.paletteOverrides).toEqual(pilot.palette)
    expect(profile.portraitUrl).toBe(pilot.portraitUrl)
    expect(Object.keys(profile)).not.toContain('avatarModelUrl')
    expect(profile.portraitSvgDataUri.startsWith(DATA_URI_PREFIX)).toBe(true)
  })

  it('gives user-avatar-neo no portrait file, since none exists', () => {
    const neo = profileOf('user-avatar-neo')
    expect(Object.keys(neo)).not.toContain('portraitUrl')
    expect(HISTORICAL_AGENTS.some(agent => agent.id === 'user-avatar-neo')).toBe(false)
  })

  it('makes the pilots visibly distinct from one another', () => {
    const profiles = PILOT_IDS.map(profileOf)
    for (const pick of [
      (p: VesselAppearanceProfile) => p.paletteOverrides.primaryGarmentHex,
      (p: VesselAppearanceProfile) => p.paletteOverrides.secondaryTrimHex,
      (p: VesselAppearanceProfile) => p.paletteOverrides.hairOrCrownHex,
      (p: VesselAppearanceProfile) => p.headSilhouette.crownStyle,
      (p: VesselAppearanceProfile) => p.signatureRelic,
      (p: VesselAppearanceProfile) => p.portraitSvgDataUri,
    ]) {
      expect(new Set(profiles.map(pick)).size).toBe(4)
    }
  })

  it('keeps the pilot palettes on theme', () => {
    // Newton: a dark coat with brass trim. Dickinson: ivory. Neo: deep indigo and aurum.
    const lightness = (hex: string): number =>
      (parseInt(hex.slice(1, 3), 16) +
        parseInt(hex.slice(3, 5), 16) +
        parseInt(hex.slice(5, 7), 16)) /
      3
    expect(lightness(profileOf('isaac-newton').paletteOverrides.primaryGarmentHex)).toBeLessThan(60)
    expect(
      lightness(profileOf('emily-dickinson').paletteOverrides.primaryGarmentHex)
    ).toBeGreaterThan(200)
    const neo = profileOf('user-avatar-neo').paletteOverrides
    expect(parseInt(neo.primaryGarmentHex.slice(5, 7), 16)).toBeGreaterThan(
      parseInt(neo.primaryGarmentHex.slice(1, 3), 16)
    ) // blue over red
    expect(parseInt(neo.secondaryTrimHex.slice(1, 3), 16)).toBeGreaterThan(
      parseInt(neo.secondaryTrimHex.slice(5, 7), 16)
    ) // gold: red over blue
  })

  it('beats the derivation in the registry, which never reaches for a pilot crown', () => {
    for (const id of ['isaac-newton', 'leonardo-da-vinci', 'emily-dickinson']) {
      const derived = deriveVesselAppearance(agentById(id))
      expect(derived).not.toEqual(profileOf(id))
      expect(PILOT_CROWNS).not.toContain(derived.headSilhouette.crownStyle)
      expect(ERA_STYLE_POOLS[derived.era].crowns).toContain(derived.headSilhouette.crownStyle)
    }
  })

  it('never hands a pilot-named crown to anyone else, however many ids are tried', () => {
    for (const agent of NON_PILOT_AGENTS) {
      expect(PILOT_CROWNS).not.toContain(profileOf(agent.id).headSilhouette.crownStyle)
    }
    for (const era of VESSEL_ERAS) {
      for (let i = 0; i < 120; i++) {
        const crown = appearanceFromSeed(`crown-sweep-${i}`, 'power', era).headSilhouette.crownStyle
        expect(PILOT_CROWNS).not.toContain(crown)
      }
    }
  })
})

// ─── The roster ──────────────────────────────────────────────────────────────

describe('the registry', () => {
  it('has unique roster ids and one entry each, plus user-avatar-neo', () => {
    expect(new Set(ROSTER_IDS).size).toBe(ROSTER_IDS.length)
    expect(ROSTER_IDS.length).toBeGreaterThanOrEqual(70)
    expect(Object.keys(VESSEL_APPEARANCE_REGISTRY).sort()).toEqual(
      [...ROSTER_IDS, 'user-avatar-neo'].sort()
    )
  })

  it('stores each profile under its own agent id', () => {
    const problems = Object.entries(VESSEL_APPEARANCE_REGISTRY)
      .filter(([key, profile]) => profile.agentId !== key)
      .map(([key]) => key)
    expect(problems).toEqual([])
  })

  it('has a complete, valid profile for every historical agent', () => {
    const problems: string[] = []
    for (const id of ROSTER_IDS) {
      const profile = getVesselAppearance(id)
      if (!profile) problems.push(`${id}: missing`)
      else expectCompleteProfile(profile, problems)
    }
    expect(problems).toEqual([])
  })

  it('is deep-frozen, so one consumer cannot repaint a vessel for everyone', () => {
    const profile = profileOf('plato')
    expect(Object.isFrozen(VESSEL_APPEARANCE_REGISTRY)).toBe(true)
    expect(Object.isFrozen(profile)).toBe(true)
    expect(Object.isFrozen(profile.headSilhouette.faceProportion)).toBe(true)
    expect(Object.isFrozen(profile.paletteOverrides)).toBe(true)
    expect(() => {
      ;(profile as { era: string }).era = 'modern'
    }).toThrow(TypeError)
    expect(() => {
      ;(profile.paletteOverrides as { primaryGarmentHex: string }).primaryGarmentHex = '#000000'
    }).toThrow(TypeError)
    expect(getVesselAppearance('plato')).toBe(profile)
  })
})

describe('registry construction', () => {
  type Module = typeof import('@/lib/agents/rating/vessel-appearance')

  /** Re-imports the module against a roster of our choosing. */
  async function registryFor(
    roster: CraftedAgent[]
  ): Promise<Module['VESSEL_APPEARANCE_REGISTRY']> {
    vi.resetModules()
    vi.doMock('@/lib/agents/historical', () => ({ HISTORICAL_AGENTS: roster }))
    const mod: Module = await import('@/lib/agents/rating/vessel-appearance')
    return mod.VESSEL_APPEARANCE_REGISTRY
  }

  afterEach(() => {
    vi.doUnmock('@/lib/agents/historical')
    vi.resetModules()
  })

  it('keeps the first of two agents that share an id', async () => {
    const impostor = withBirth(BASE, new Date('1999-01-01T12:00:00'))
    const registry = await registryFor([BASE, impostor])
    expect(registry.machiavelli).toEqual(deriveVesselAppearance(BASE))
    expect(registry.machiavelli.era).toBe('renaissance')
    expect(Object.keys(registry).sort()).toEqual([...PILOT_IDS, 'machiavelli'].sort())
  })

  it('lets a pilot id on the roster take the authored profile, not a derived one', async () => {
    const lookalike: CraftedAgent = { ...agentById('plato'), id: 'isaac-newton' }
    const registry = await registryFor([lookalike])
    expect(registry['isaac-newton']).toEqual(profileOf('isaac-newton'))
    expect(registry['isaac-newton'].headSilhouette.crownStyle).toBe('newton-curls')
  })

  it('always carries every pilot, even when the roster has none of them', async () => {
    const registry = await registryFor([])
    expect(Object.keys(registry).sort()).toEqual([...PILOT_IDS].sort())
    for (const id of PILOT_IDS) expect(registry[id]).toEqual(profileOf(id))
  })

  it('freezes whatever it builds', async () => {
    const registry = await registryFor([BASE])
    expect(Object.isFrozen(registry)).toBe(true)
    expect(Object.isFrozen(registry.machiavelli.headSilhouette)).toBe(true)
  })
})

describe('getVesselAppearance', () => {
  it('returns undefined for an unknown id', () => {
    expect(getVesselAppearance('nobody-at-all')).toBeUndefined()
    expect(getVesselAppearance('')).toBeUndefined()
  })

  it('matches an exact id only', () => {
    expect(getVesselAppearance('Isaac-Newton')).toBeUndefined()
    expect(getVesselAppearance(' isaac-newton')).toBeUndefined()
    expect(getVesselAppearance('rene-descartes')).toBeUndefined() // the roster id is rene-descartes-1596
    expect(getVesselAppearance('rene-descartes-1596')).toBeDefined()
  })

  it('never answers from the prototype chain', () => {
    for (const key of ['constructor', '__proto__', 'toString', 'hasOwnProperty', 'valueOf']) {
      expect(getVesselAppearance(key)).toBeUndefined()
    }
  })

  it('tolerates a non-string id from untyped callers', () => {
    for (const value of [undefined, null, 42, {}, ['isaac-newton']]) {
      expect(getVesselAppearance(value as unknown as string)).toBeUndefined()
    }
  })
})

// ─── Determinism ─────────────────────────────────────────────────────────────

describe('determinism', () => {
  it('derives the same profile twice, byte for byte, for every agent', () => {
    const problems = HISTORICAL_AGENTS.flatMap(agent => {
      const first = deriveVesselAppearance(agent)
      const second = deriveVesselAppearance({ ...agent })
      return JSON.stringify(first) === JSON.stringify(second) ? [] : [agent.id]
    })
    expect(problems).toEqual([])
    expect(deriveVesselAppearance(BASE)).toStrictEqual(deriveVesselAppearance(BASE))
  })

  it('serialises registry profiles in a fixed key order', () => {
    expect(Object.keys(profileOf('machiavelli'))).toEqual([
      'agentId',
      'era',
      'headSilhouette',
      'garmentSilhouette',
      'signatureRelic',
      'paletteOverrides',
      'portraitSvgDataUri',
      'portraitUrl',
    ])
  })

  it('pins a fingerprint of a derived profile so accidental changes are caught', () => {
    // Machiavelli carries a computed chart. If this moves, either the algorithm changed (re-pin
    // on purpose, and tell the Pentacles side) or his chart or stats did.
    expect(fingerprint(profileOf('machiavelli'))).toBe('478692f22f9602d7')
  })

  it('pins a fingerprint of a seed-only profile that no agent data can move', () => {
    expect(fingerprint(appearanceFromSeed('fingerprint-probe', 'wisdom', 'renaissance'))).toBe(
      'bc937f9d2f1a33fe'
    )
  })

  it('ignores everything on the agent except its id, birth, chart, stats and avatar', () => {
    const noisy: CraftedAgent = {
      ...BASE,
      name: 'Someone Else Entirely',
      title: 'Different',
      quotes: [],
      specialization: 'Nothing',
    }
    expect(deriveVesselAppearance(noisy)).toEqual(deriveVesselAppearance(BASE))
  })

  it('does not read the clock or a random source', () => {
    const random = vi.spyOn(Math, 'random')
    try {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2001-02-03T04:05:06Z'))
      const early = deriveVesselAppearance(BASE)
      const earlySeeded = appearanceFromSeed('clock-probe', 'power', 'modern')
      vi.setSystemTime(new Date('2088-09-08T07:06:05Z'))
      expect(deriveVesselAppearance(BASE)).toEqual(early)
      expect(appearanceFromSeed('clock-probe', 'power', 'modern')).toEqual(earlySeeded)
      expect(random).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
      random.mockRestore()
    }
  })

  it('moves the seeded features when the id moves, and nothing else', () => {
    const a = deriveVesselAppearance({ ...BASE, id: 'probe-agent-a' })
    const b = deriveVesselAppearance({ ...BASE, id: 'probe-agent-b' })
    expect(a.agentId).not.toBe(b.agentId)
    expect(a.headSilhouette.faceProportion).not.toEqual(b.headSilhouette.faceProportion)
    expect(a.paletteOverrides.primaryGarmentHex).not.toBe(b.paletteOverrides.primaryGarmentHex)
    expect(a.portraitSvgDataUri).not.toBe(b.portraitSvgDataUri)
    expect(a.era).toBe(b.era)
  })

  it('keeps shape and face independent of the chart, which only moves the palette family', () => {
    const aries = deriveVesselAppearance(withSun(BASE, 'Aries', 'authored'))
    const pisces = deriveVesselAppearance(withSun(BASE, 'Pisces', 'authored'))
    expect(aries.headSilhouette).toEqual(pisces.headSilhouette)
    expect(aries.garmentSilhouette).toEqual(pisces.garmentSilhouette)
    expect(aries.era).toBe(pisces.era)
    expect(aries.paletteOverrides.secondaryTrimHex).not.toBe(
      pisces.paletteOverrides.secondaryTrimHex
    )
  })

  it('draws crown, mantle and collar from independent streams', () => {
    const combos = new Set<string>()
    for (let i = 0; i < 400; i++) {
      const p = appearanceFromSeed(`stream-${i}`, 'power', 'enlightenment')
      combos.add(
        [
          p.headSilhouette.crownStyle,
          p.garmentSilhouette.mantleStyle,
          p.garmentSilhouette.collarStyle,
        ].join()
      )
    }
    const pool = ERA_STYLE_POOLS.enlightenment
    expect(combos.size).toBe(pool.crowns.length * pool.mantles.length * pool.collars.length)
  })

  it('spreads seeded picks and faces evenly, without modulo or low-bit bias', () => {
    const counts = new Map<string, number>()
    const faces = {
      jawWidth: [] as number[],
      browDepth: [] as number[],
      cranialHeight: [] as number[],
    }
    for (let i = 0; i < 900; i++) {
      const p = appearanceFromSeed(`spread-${i}`, 'wisdom', 'astral')
      const crown = p.headSilhouette.crownStyle
      counts.set(crown, (counts.get(crown) ?? 0) + 1)
      for (const key of Object.keys(faces) as Array<keyof typeof faces>) {
        faces[key].push(p.headSilhouette.faceProportion[key])
      }
    }
    for (const crown of ERA_STYLE_POOLS.astral.crowns) {
      expect(counts.get(crown) ?? 0).toBeGreaterThan(900 * 0.26)
    }
    for (const values of Object.values(faces)) {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length
      expect(mean).toBeGreaterThan(0.45)
      expect(mean).toBeLessThan(0.55)
      expect(Math.min(...values)).toBeLessThan(0.05)
      expect(Math.max(...values)).toBeGreaterThan(0.95)
      expect(stdev(values)).toBeGreaterThan(0.25)
    }
  })

  it('rounds face proportions to three decimals', () => {
    for (let i = 0; i < 100; i++) {
      const { faceProportion } = appearanceFromSeed(`round-${i}`, 'power').headSilhouette
      for (const value of Object.values(faceProportion)) {
        expect(Math.round(value * 1000) / 1000).toBe(value)
      }
    }
  })
})

// ─── Portraits ───────────────────────────────────────────────────────────────

describe('the astral cameo portrait', () => {
  const ALL = Object.values(VESSEL_APPEARANCE_REGISTRY)

  it('is a well-formed, namespaced, safe SVG under 6 KB for every vessel', () => {
    const problems: string[] = []
    for (const profile of ALL) {
      const svg = decodeSvg(profile.portraitSvgDataUri)
      try {
        assertWellFormedXml(svg)
      } catch (error) {
        problems.push(`${profile.agentId}: ${(error as Error).message}`)
      }
      if (!svg.startsWith('<svg ')) problems.push(`${profile.agentId}: does not open with <svg`)
      if (!svg.includes('xmlns="http://www.w3.org/2000/svg"'))
        problems.push(`${profile.agentId}: xmlns`)
      if (profile.portraitSvgDataUri.length >= 6 * 1024)
        problems.push(`${profile.agentId}: URI too big`)
      if (svg.length >= 4 * 1024) problems.push(`${profile.agentId}: SVG over ~4 KB`)
      if (/['<]script|href=|\son\w+=|javascript:|<image|<foreignObject/i.test(svg)) {
        problems.push(`${profile.agentId}: active or external content`)
      }
    }
    expect(problems).toEqual([])
  })

  it('is encoded as the contract says, and decodes back to the SVG it was drawn from', () => {
    for (const profile of ALL) {
      const svg = decodeSvg(profile.portraitSvgDataUri)
      expect(profile.portraitSvgDataUri).toBe(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`)
      expect(toSvgDataUri(renderPortraitSvg(portraitInput(profile)))).toBe(
        profile.portraitSvgDataUri
      )
    }
    expect(toSvgDataUri('<svg a="1"/>')).toBe('data:image/svg+xml;utf8,%3Csvg%20a%3D%221%22%2F%3E')
  })

  it('is drawn in the profile palette and its era field', () => {
    for (const profile of ALL) {
      const svg = decodeSvg(profile.portraitSvgDataUri)
      for (const hex of Object.values(profile.paletteOverrides)) expect(svg).toContain(hex)
      expect(svg).toContain(ERA_FIELD_HEX[profile.era])
    }
  })

  it('gives every vessel its own portrait', () => {
    expect(new Set(ALL.map(profile => profile.portraitSvgDataUri)).size).toBe(ALL.length)
  })

  it('keys the drawing to each crown, mantle, collar, relic and era', () => {
    const base = profileOf('plato')
    const drawn = (patch: Partial<PortraitInput>): string =>
      renderPortraitSvg(portraitInput(base, patch))
    const distinct = (variants: string[]): number => new Set(variants).size

    expect(
      distinct(
        CROWN_STYLES.map(crownStyle =>
          drawn({ headSilhouette: { ...base.headSilhouette, crownStyle } })
        )
      )
    ).toBe(CROWN_STYLES.length)
    expect(
      distinct(
        MANTLE_STYLES.map(mantleStyle =>
          drawn({ garmentSilhouette: { ...base.garmentSilhouette, mantleStyle } })
        )
      )
    ).toBe(MANTLE_STYLES.length)
    expect(
      distinct(
        COLLAR_STYLES.map(collarStyle =>
          drawn({ garmentSilhouette: { ...base.garmentSilhouette, collarStyle } })
        )
      )
    ).toBe(COLLAR_STYLES.length)
    expect(distinct(SIGNATURE_RELICS.map(signatureRelic => drawn({ signatureRelic })))).toBe(
      SIGNATURE_RELICS.length
    )
    expect(distinct(VESSEL_ERAS.map(era => drawn({ era })))).toBe(VESSEL_ERAS.length)
  })

  it('reshapes the head with the face proportions', () => {
    const base = profileOf('plato')
    const face = (jawWidth: number, browDepth: number, cranialHeight: number): string =>
      renderPortraitSvg(
        portraitInput(base, {
          headSilhouette: {
            ...base.headSilhouette,
            faceProportion: { jawWidth, browDepth, cranialHeight },
          },
        })
      )
    const outputs = [face(0, 0, 0), face(1, 0, 0), face(0, 1, 0), face(0, 0, 1), face(1, 1, 1)]
    expect(new Set(outputs).size).toBe(outputs.length)
  })

  it('refuses input that could inject markup or draw nonsense', () => {
    const base = profileOf('plato')
    const bad =
      (patch: unknown): (() => string) =>
      () =>
        renderPortraitSvg(portraitInput(base, patch as Partial<PortraitInput>))
    const palette = (key: string, value: string) => ({
      paletteOverrides: { ...base.paletteOverrides, [key]: value },
    })

    expect(bad(palette('primaryGarmentHex', '#000000" onload="alert(1)'))).toThrow(RangeError)
    expect(bad(palette('secondaryTrimHex', '#ABCDEF'))).toThrow(RangeError)
    expect(bad(palette('hairOrCrownHex', '#abc'))).toThrow(RangeError)
    expect(bad(palette('skinOrMaterialToneHex', 'red'))).toThrow(RangeError)
    expect(bad({ era: 'jurassic' })).toThrow(RangeError)
    expect(bad({ signatureRelic: 'cursed-idol' })).toThrow(RangeError)
    expect(bad({ headSilhouette: { ...base.headSilhouette, crownStyle: 'tinfoil-hat' } })).toThrow(
      RangeError
    )
    expect(bad({ garmentSilhouette: { ...base.garmentSilhouette, mantleStyle: 'cape' } })).toThrow(
      RangeError
    )
    expect(bad({ garmentSilhouette: { ...base.garmentSilhouette, collarStyle: 'ruff' } })).toThrow(
      RangeError
    )
    for (const jawWidth of [1.01, -0.01, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(
        bad({
          headSilhouette: {
            ...base.headSilhouette,
            faceProportion: { ...base.headSilhouette.faceProportion, jawWidth },
          },
        })
      ).toThrow(RangeError)
    }
  })

  it('has a well-formedness checker that can actually fail', () => {
    for (const broken of [
      '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"></g></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><path d=x/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"><path d="a<b"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg">a & b</svg>',
      '<svg xmlns="http://www.w3.org/2000/svg"/><svg xmlns="http://www.w3.org/2000/svg"/>',
      '<svg xmlns="http://www.w3.org/2000/svg"></svg>trailing',
      '<svg xmlns="http://www.w3.org/2000/svg"',
      '<div></div>',
    ]) {
      expect(() => assertWellFormedXml(broken), broken).toThrow()
    }
    expect(() =>
      assertWellFormedXml(
        '<svg xmlns="http://www.w3.org/2000/svg"><g a="1"><path d="M0 0"/></g></svg>'
      )
    ).not.toThrow()
  })
})

// ─── Variety ─────────────────────────────────────────────────────────────────

describe('how varied the roster is', () => {
  const profiles = ROSTER_IDS.map(profileOf)

  it('uses at least eight distinct crown and mantle combinations', () => {
    const combos = new Set(
      profiles.map(p => `${p.headSilhouette.crownStyle}/${p.garmentSilhouette.mantleStyle}`)
    )
    expect(combos.size).toBeGreaterThanOrEqual(8)
  })

  it('has every real era represented', () => {
    const eras = new Set(profiles.map(p => p.era))
    for (const era of [
      'ancient',
      'renaissance',
      'enlightenment',
      'romantic',
      'modern',
    ] as VesselEra[]) {
      expect(eras.has(era)).toBe(true)
    }
  })

  it('never lets more than 40% of the roster share one palette', () => {
    expect(share(profiles.map(p => Object.values(p.paletteOverrides).join()))).toBeLessThanOrEqual(
      0.4
    )
    expect(share(profiles.map(p => p.paletteOverrides.primaryGarmentHex))).toBeLessThanOrEqual(0.4)
  })

  it('never lets more than 40% share one planetary colour family, and uses most of them', () => {
    const families = HISTORICAL_AGENTS.map(agent => paletteFamilyOf(agent).planet)
    expect(share(families)).toBeLessThanOrEqual(0.4)
    expect(new Set(families).size).toBeGreaterThanOrEqual(8)
  })

  it('gives nearly every agent its own garment colour', () => {
    const garments = new Set(profiles.map(p => p.paletteOverrides.primaryGarmentHex))
    expect(garments.size).toBeGreaterThanOrEqual(Math.floor(profiles.length * 0.95))
  })

  it('spreads the face proportions across the unit range', () => {
    for (const key of ['jawWidth', 'browDepth', 'cranialHeight'] as const) {
      expect(stdev(profiles.map(p => p.headSilhouette.faceProportion[key]))).toBeGreaterThan(0.15)
    }
  })

  it('never repeats a full profile under two ids', () => {
    const signatures = profiles.map(p => JSON.stringify({ ...p, agentId: '', portraitUrl: '' }))
    expect(new Set(signatures).size).toBe(profiles.length)
  })
})

// ─── Palette families ────────────────────────────────────────────────────────

describe('planetary colour families', () => {
  it('covers all ten planets with distinct families, metals and stones', () => {
    expect(Object.keys(PLANET_PALETTES).sort()).toEqual([...PLANET_NAMES].sort())
    const entries = Object.values(PLANET_PALETTES)
    expect(new Set(entries.map(entry => entry.family)).size).toBe(10)
    expect(new Set(entries.map(entry => entry.trim)).size).toBe(10)
    expect(new Set(entries.map(entry => entry.stone)).size).toBe(10)
    for (const entry of entries) {
      expect(entry.trim).toMatch(HEX)
      expect(entry.stone).toMatch(HEX)
      expect(entry.garment.h).toBeGreaterThanOrEqual(0)
      expect(entry.garment.h).toBeLessThan(360)
      expect(entry.garment.s).toBeGreaterThan(10)
      expect(entry.garment.l).toBeGreaterThan(15)
      expect(entry.garment.l).toBeLessThan(55)
    }
  })

  it.each(Object.entries(SIGN_RULERS))('reads %s as ruled by %s', (sign, planet) => {
    expect(paletteFamilyOf(withSun(BASE, sign, 'authored'))).toEqual({
      planet,
      basis: 'sun-sign-ruler',
    })
  })

  it('reads a sign case- and space-insensitively, and a computed or absent provenance as usable', () => {
    expect(paletteFamilyOf(withSun(BASE, '  capricorn ', 'computed'))).toEqual({
      planet: 'Saturn',
      basis: 'sun-sign-ruler',
    })
    expect(paletteFamilyOf(withSun(BASE, 'LEO', undefined))).toEqual({
      planet: 'Sun',
      basis: 'sun-sign-ruler',
    })
  })

  it('ignores a placeholder or unattributed chart, as the Alchemical Seals do', () => {
    for (const provenance of ['placeholder', 'unattributed'] as const) {
      const scorpio = paletteFamilyOf(withSun(BASE, 'Scorpio', provenance))
      const taurus = paletteFamilyOf(withSun(BASE, 'Taurus', provenance))
      expect(scorpio.basis).toBe('seeded')
      expect(taurus).toEqual(scorpio) // the filler sign decides nothing
    }
    const plato = paletteFamilyOf(agentById('plato'))
    expect(plato.basis).toBe('seeded')
  })

  it('falls back to a seeded planet for a Sun sign it cannot read', () => {
    for (const sign of ['Ophiuchus', '', '   ']) {
      expect(paletteFamilyOf(withSun(BASE, sign, 'authored')).basis).toBe('seeded')
    }
    const noSun = withSun(BASE, 'Aries', 'authored')
    delete (noSun.consciousness.natalChart.planets as Record<string, unknown>).Sun
    expect(paletteFamilyOf(noSun).basis).toBe('seeded')
  })

  it('keeps a seeded planet stable per id, and varied across ids', () => {
    const planets = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const agent = withSun({ ...BASE, id: `seeded-${i}` }, 'Aries', 'placeholder')
      const planet = paletteFamilyOf(agent).planet
      expect(paletteFamilyOf(agent).planet).toBe(planet)
      planets.add(planet)
    }
    expect(planets.size).toBe(10)
  })

  it('wears the planet metal as trim and the planet stone as the face', () => {
    for (const agent of NON_PILOT_AGENTS) {
      const family = PLANET_PALETTES[paletteFamilyOf(agent).planet]
      const { paletteOverrides } = profileOf(agent.id)
      expect(paletteOverrides.secondaryTrimHex).toBe(family.trim)
      expect(paletteOverrides.skinOrMaterialToneHex).toBe(family.stone)
    }
  })
})

// ─── Relics ──────────────────────────────────────────────────────────────────

describe('signature relics', () => {
  it('follows the primary archetype stat for every derived agent', () => {
    const problems = NON_PILOT_AGENTS.flatMap(agent => {
      const expected = ARCHETYPE_RELICS[rateAgent(agent).archetype.primary]
      return profileOf(agent.id).signatureRelic === expected ? [] : [agent.id]
    })
    expect(problems).toEqual([])
  })

  it('uses every archetype relic somewhere on the roster', () => {
    const used = new Set(NON_PILOT_AGENTS.map(agent => profileOf(agent.id).signatureRelic))
    expect(used.size).toBe(7)
    for (const relic of Object.values(ARCHETYPE_RELICS)) expect(used.has(relic)).toBe(true)
  })

  it('keeps the four authored relics for the pilots alone', () => {
    for (const agent of NON_PILOT_AGENTS) {
      expect(PILOT_RELICS as readonly string[]).not.toContain(profileOf(agent.id).signatureRelic)
    }
  })

  it.each(CORE_STAT_KEYS.map(key => [key] as const))(
    'gives a seeded %s vessel its archetype relic',
    key => {
      expect(appearanceFromSeed('relic-probe', key).signatureRelic).toBe(ARCHETYPE_RELICS[key])
    }
  )
})

// ─── appearanceFromSeed ──────────────────────────────────────────────────────

describe('appearanceFromSeed', () => {
  it('is deterministic', () => {
    const a = appearanceFromSeed('created-agent-7', 'resonance', 'romantic')
    const b = appearanceFromSeed('created-agent-7', 'resonance', 'romantic')
    expect(a).toStrictEqual(b)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('defaults to the astral era, which has no birth year to claim', () => {
    expect(appearanceFromSeed('created-agent-7', 'power').era).toBe('astral')
    expect(appearanceFromSeed('created-agent-7', 'power')).toEqual(
      appearanceFromSeed('created-agent-7', 'power', 'astral')
    )
  })

  it('is era-aware: styles come from the era set, and every member gets used', () => {
    for (const era of VESSEL_ERAS) {
      const pool = ERA_STYLE_POOLS[era]
      const crowns = new Set<string>()
      const mantles = new Set<string>()
      const collars = new Set<string>()
      for (let i = 0; i < 150; i++) {
        const profile = appearanceFromSeed(`era-probe-${i}`, 'charisma', era)
        expect(profile.era).toBe(era)
        expect(pool.crowns).toContain(profile.headSilhouette.crownStyle)
        expect(pool.mantles).toContain(profile.garmentSilhouette.mantleStyle)
        expect(pool.collars).toContain(profile.garmentSilhouette.collarStyle)
        expect(decodeSvg(profile.portraitSvgDataUri)).toContain(ERA_FIELD_HEX[era])
        crowns.add(profile.headSilhouette.crownStyle)
        mantles.add(profile.garmentSilhouette.mantleStyle)
        collars.add(profile.garmentSilhouette.collarStyle)
      }
      expect([...crowns].sort()).toEqual([...pool.crowns].sort())
      expect([...mantles].sort()).toEqual([...pool.mantles].sort())
      expect([...collars].sort()).toEqual([...pool.collars].sort())
    }
  })

  it('keeps each era to the clothes of its time', () => {
    expect(ERA_STYLE_POOLS.ancient.collars).toEqual(['none'])
    for (const era of ['ancient', 'renaissance'] as const) {
      expect(ERA_STYLE_POOLS[era].mantles).not.toContain('victorian-shawl')
      expect(ERA_STYLE_POOLS[era].mantles).not.toContain('enlightenment-coat')
      expect(ERA_STYLE_POOLS[era].collars).not.toContain('high-cravat')
    }
    expect(ERA_STYLE_POOLS.enlightenment.collars).not.toContain('astral-gorget')
    expect(ERA_STYLE_POOLS.romantic.mantles).toContain('victorian-shawl')
    expect(ERA_STYLE_POOLS.renaissance.collars).toContain('renaissance-collar')
    for (const era of VESSEL_ERAS) {
      const pool = ERA_STYLE_POOLS[era]
      expect(pool.crowns.length).toBeGreaterThan(0)
      expect(pool.mantles.length).toBeGreaterThan(0)
      expect(pool.collars.length).toBeGreaterThan(0)
    }
  })

  it('changes with the id and with the era', () => {
    const base = appearanceFromSeed('created-agent-7', 'power', 'modern')
    expect(appearanceFromSeed('created-agent-8', 'power', 'modern').portraitSvgDataUri).not.toBe(
      base.portraitSvgDataUri
    )
    expect(appearanceFromSeed('created-agent-7', 'power', 'ancient').portraitSvgDataUri).not.toBe(
      base.portraitSvgDataUri
    )
    expect(appearanceFromSeed('created-agent-7', 'wisdom', 'modern').signatureRelic).not.toBe(
      base.signatureRelic
    )
  })

  it('always yields a complete valid profile, never a portrait file', () => {
    const problems: string[] = []
    for (let i = 0; i < 300; i++) {
      const key = CORE_STAT_KEYS[i % CORE_STAT_KEYS.length]
      const era = VESSEL_ERAS[i % VESSEL_ERAS.length]
      const profile = appearanceFromSeed(`valid-${i}`, key, era)
      expectCompleteProfile(profile, problems)
      if ('portraitUrl' in profile) problems.push(`${profile.agentId}: portraitUrl`)
    }
    expect(problems).toEqual([])
  })

  it('rejects an id, stat or era it cannot place', () => {
    expect(() => appearanceFromSeed('', 'power')).toThrow(TypeError)
    expect(() => appearanceFromSeed('   ', 'power')).toThrow(TypeError)
    expect(() => appearanceFromSeed(undefined as unknown as string, 'power')).toThrow(TypeError)
    expect(() => appearanceFromSeed(42 as unknown as string, 'power')).toThrow(TypeError)
    expect(() => appearanceFromSeed('x', 'luck' as unknown as 'power')).toThrow(RangeError)
    expect(() => appearanceFromSeed('x', 'toString' as unknown as 'power')).toThrow(RangeError)
    expect(() => appearanceFromSeed('x', 'power', 'jurassic' as unknown as 'modern')).toThrow(
      RangeError
    )
  })

  it('handles ids with markup, quotes and non-Latin text without breaking the SVG', () => {
    for (const id of ['<script>', 'a"b\'c', 'x&y', 'アルケミスト', '🜂-fire', 'a'.repeat(5000)]) {
      const profile = appearanceFromSeed(id, 'power')
      const svg = decodeSvg(profile.portraitSvgDataUri)
      expect(() => assertWellFormedXml(svg)).not.toThrow()
      expect(svg).not.toContain(id.length < 20 ? id : '\u0000')
      expect(profile.portraitSvgDataUri.length).toBeLessThan(6 * 1024)
      expect(profile.agentId).toBe(id)
    }
  })
})

// ─── Assets ──────────────────────────────────────────────────────────────────

describe('portrait files', () => {
  it('only ever names a file that exists under public/', () => {
    const missing = Object.values(VESSEL_APPEARANCE_REGISTRY)
      .filter(profile => profile.portraitUrl !== undefined)
      .filter(profile => !existsSync(join(ROOT, 'public', profile.portraitUrl as string)))
      .map(profile => `${profile.agentId}: ${profile.portraitUrl}`)
    expect(missing).toEqual([])
  })

  it('mirrors the avatar each agent already declares, and nothing it invented', () => {
    for (const agent of NON_PILOT_AGENTS) {
      expect(profileOf(agent.id).portraitUrl).toBe(agent.appearance.avatar)
    }
    expect(
      Object.values(VESSEL_APPEARANCE_REGISTRY).filter(profile => profile.portraitUrl !== undefined)
        .length
    ).toBeGreaterThanOrEqual(70)
  })

  it('never sets a 3D avatar model, since none ships in the repo', () => {
    for (const profile of Object.values(VESSEL_APPEARANCE_REGISTRY)) {
      expect(Object.keys(profile)).not.toContain('avatarModelUrl')
    }
    expect(existsSync(join(ROOT, 'public', 'avatars'))).toBe(true)
  })

  it('mirrors only a same-origin /avatars file name, never a URL or a path trick', () => {
    for (const avatar of [
      'https://example.com/a.png',
      'https://avatars/a.png',
      '//avatars/a.png',
      '//evil.example/a.png',
      'data:image/png;base64,AAAA',
      'javascript:alert(1)',
      '/avatars/../secret.png',
      '/avatars/sub/dir.png',
      '/avatars/UPPER.png',
      '/avatars/no-extension',
      '/avatars/script.js',
      '/other/a.png',
      'avatars/a.png',
      '',
      undefined,
      null,
      42,
    ]) {
      const profile = deriveVesselAppearance(withAvatar(BASE, avatar))
      expect(Object.keys(profile), String(avatar)).not.toContain('portraitUrl')
    }
    expect(deriveVesselAppearance(withAvatar(BASE, '/avatars/ok-name_1.webp')).portraitUrl).toBe(
      '/avatars/ok-name_1.webp'
    )
  })
})

// ─── Purity of the module itself ─────────────────────────────────────────────

describe('module purity', () => {
  /** Lists every way the source could pick up Node, a clock or randomness. */
  function impurities(source: string): string[] {
    const found: string[] = []
    const specifiers = [...source.matchAll(/(?:from|import)\s*['"]([^'"]+)['"]/g)].map(
      match => match[1]
    )
    for (const specifier of specifiers) {
      const bare = specifier.replace(/^node:/, '')
      if (specifier.startsWith('node:') || builtinModules.includes(bare)) {
        found.push(`import of ${specifier}`)
      }
    }
    const banned: Array<[RegExp, string]> = [
      [/node:/, 'a node: specifier'],
      [/Math\.random/, 'Math.random'],
      [/Date\.now/, 'Date.now'],
      [/new Date\(\s*\)/, 'new Date() with no argument'],
      [/performance\.now/, 'performance.now'],
      [/crypto\.(?:getRandomValues|randomUUID|randomBytes)/, 'a crypto random source'],
      [/\bBuffer\b/, 'Buffer'],
      [/\b(?:btoa|atob)\b/, 'base64 helpers'],
      [/\brequire\s*\(/, 'require()'],
      [/\bprocess\./, 'process'],
      [/\bfetch\s*\(/, 'fetch()'],
    ]
    for (const [pattern, label] of banned) if (pattern.test(source)) found.push(label)
    return found
  }

  it('imports no Node built-in and uses no clock, random source or network', () => {
    expect(impurities(readFileSync(MODULE_PATH, 'utf8'))).toEqual([])
  })

  it('has a purity scan that can actually fail', () => {
    expect(impurities("import { readFileSync } from 'node:fs'")).toContain('import of node:fs')
    expect(impurities("import fs from 'fs'")).toContain('import of fs')
    expect(impurities("import crypto from 'crypto'")).toContain('import of crypto')
    expect(impurities('const r = Math.random()')).toContain('Math.random')
    expect(impurities('const t = Date.now()')).toContain('Date.now')
    expect(impurities('const d = new Date()')).toContain('new Date() with no argument')
    expect(impurities('Buffer.from("x").toString("base64")')).toContain('Buffer')
    expect(impurities("import { a } from './sibling'\nconst d = new Date(0)")).toEqual([])
  })

  it('imports only its sanctioned dependencies', () => {
    const source = readFileSync(MODULE_PATH, 'utf8')
    const specifiers = [...source.matchAll(/from\s*['"]([^'"]+)['"]/g)]
      .map(match => match[1])
      .sort()
    expect(specifiers).toEqual(
      [
        '@/lib/agent-types',
        '@/lib/agents/historical',
        '@/lib/agents/planetary-traits',
        '@/lib/astrological-data',
        './ovr-archetype',
      ].sort()
    )
  })
})
