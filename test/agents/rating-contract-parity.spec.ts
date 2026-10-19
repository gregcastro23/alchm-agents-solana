/** @vitest-environment node */
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import { HISTORICAL_AGENTS, getHistoricalAgent } from '@/lib/agents/historical'
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'
import * as barrel from '@/lib/agents/rating'
import type { LiveSky } from '@/lib/agents/rating/live-sky'
import {
  CORE_STAT_KEYS,
  RATING_CEILING,
  RATING_FLOOR,
  VESSEL_RATING_SCALE,
  rateAgent,
  rateStats,
  toRating,
  type CoreStats,
} from '@/lib/agents/rating/ovr-archetype'
import * as contest from '@/lib/agents/rating/pentacle-contest'
import {
  CELESTIAL_MIN_NATAL_AFFINITY,
  DEFAULT_SURGE_CALIBRATION,
  ESMS_TOKENS,
  HARMONY_MAX_OFFSET,
  SEAL_CATALOG,
  SEAL_TIERS,
  SEAL_TIER_REQUIREMENTS,
  calculateResonanceSurge,
  computeMeanAlignedRating,
  earnedSeals,
  elementalHarmony,
  evaluateSeals,
  natalAffinity,
  type NatalChartInput,
  type SealProgress,
  type SurgeCalibration,
} from '@/lib/agents/rating/seals-surge'
import * as sealsModule from '@/lib/agents/rating/seals-surge'
import {
  FACTION_NAMES,
  VESSEL_ALIASES,
  asContractPayload,
  buildRatedAgentPayload,
  ratableFromForgedRow,
  ratableFromRoster,
  resolveVesselAlias,
  summarizeVessel,
  type RatedVesselPayload,
} from '@/lib/agents/rating/vessel-payload'
import * as contract from '@/lib/agents/rating-contract'
import type {
  AlchemicalSeal,
  EsmsBalances,
  EsmsKey,
  RatedAgentPayload,
  SacredStatKey,
  SealTier,
} from '@/lib/agents/rating-contract'
import {
  CANONICAL_ROSTER_71,
  resolveAgentAppearance,
} from '@/lib/agents/vessel-appearance-manifest'

/**
 * Parity between ASOL's rating modules and the Pentacles rating contract
 * (`lib/agents/rating-contract.ts`, ratified in #65).
 *
 * The contract owns every formula and constant that decides what a number MEANS; the modules
 * under `lib/agents/rating/` feed it live inputs. This file is the guard that keeps it that way:
 *
 *   1. vocabulary  - the modules re-export and import the contract's tiers, gates, catalog and
 *                    ESMS keys and carry no copy of them (identity, AST and source checks);
 *   2. ratings     - `rateStats` is the contract's own functions on `round(25 + 0.74 * stat)`;
 *   3. seals       - `evaluateSeals` equals the contract's `evaluateSealTier`, differing only by
 *                    ASOL's Celestial rule, and `earnedSeals` is `buildCanonicalSeal`;
 *   4. surge       - `calculateResonanceSurge` is the contract's `evaluateSurgeState` plus a meter;
 *   5. payload     - the four contract pilots go through the real path and the result has the
 *                    contract's shape, is assignable to `RatedAgentPayload` and publishes on the
 *                    real feed bus;
 *   6. diagnostics - what is known NOT to match (the contract's pinned roster numbers, and a few
 *                    inconsistencies inside the contract's own fixtures) as `it.fails`, so each
 *                    flips red the day it is fixed.
 *
 * Where the contract IS the oracle (tier, OVR, advantage, archetype, surge state, seal shape) the
 * contract's function is the expected value. Everything ASOL adds on top has its expected value
 * written out here, independently of the code under test.
 */

// ─── Pins and helpers shared by every section ────────────────────────────────

const ROOT = join(__dirname, '..', '..')
const RATING_DIR = join(ROOT, 'lib/agents/rating')
const ROUTE_FILE = join(ROOT, 'app/api/agents/rating/route.ts')

const TIERS = ['Copper', 'Silver', 'Gold', 'Astral', 'Celestial'] as const
const STAT_ORDER = [
  'power',
  'resonance',
  'wisdom',
  'charisma',
  'intuition',
  'adaptability',
  'vitality',
] as const satisfies readonly SacredStatKey[]
const ESMS_ORDER = [
  'spirit',
  'essence',
  'matter',
  'substance',
] as const satisfies readonly EsmsKey[]

/** The seven Seals as the contract defines them: stat -> [name, ESMS token]. */
const CATALOG_PIN: Record<SacredStatKey, readonly [string, EsmsKey]> = {
  power: ['Crucible Finisher', 'substance'],
  resonance: ['Tidal Chorus', 'essence'],
  wisdom: ["Philosopher's Stone", 'matter'],
  charisma: ['Harmonic Sovereign', 'essence'],
  intuition: ['Astral Vision', 'spirit'],
  adaptability: ['Quicksilver Pivot', 'spirit'],
  vitality: ['Immovable Foundation', 'matter'],
}

const rankOf = (tier: SealTier | null): number => (tier === null ? -1 : TIERS.indexOf(tier))

/** A seeded PRNG (mulberry32): the same sequence on every machine and in every order. */
function seeded(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const pick = <T>(rand: () => number, items: readonly T[]): T =>
  items[Math.min(items.length - 1, Math.floor(rand() * items.length))]

const statsFrom = (fn: (stat: SacredStatKey, index: number) => number): CoreStats => {
  const out = {} as Record<SacredStatKey, number>
  STAT_ORDER.forEach((stat, i) => {
    out[stat] = fn(stat, i)
  })
  return out as CoreStats
}

const uniformStats = (value: number): CoreStats => statsFrom(() => value)

/** What ASOL documents for a 0-100 stat: `round(25 + 0.74 * stat)`. */
const expectedRating = (stat: number): number =>
  Math.round(25 + 0.74 * Math.min(100, Math.max(0, stat)))

// The element of each zodiac sign, written out here rather than read from lib/staking.
type ElementName = 'Fire' | 'Earth' | 'Air' | 'Water'
const SIGNS_OF: Record<ElementName, readonly string[]> = {
  Fire: ['Aries', 'Leo', 'Sagittarius'],
  Earth: ['Taurus', 'Virgo', 'Capricorn'],
  Air: ['Gemini', 'Libra', 'Aquarius'],
  Water: ['Cancer', 'Scorpio', 'Pisces'],
}
const ELEMENT_OF_SIGN: Record<string, ElementName> = {}
for (const element of Object.keys(SIGNS_OF) as ElementName[]) {
  for (const sign of SIGNS_OF[element]) ELEMENT_OF_SIGN[sign] = element
}
/** Fire -> Spirit, Water -> Essence, Earth -> Matter, Air -> Substance. */
const TOKEN_ELEMENT: Record<EsmsKey, ElementName> = {
  spirit: 'Fire',
  essence: 'Water',
  matter: 'Earth',
  substance: 'Air',
}
const BODIES = [
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
] as const

type ChartProvenance = NonNullable<NatalChartInput['provenance']>

/** A chart whose ten bodies sit in the given signs (body i in `signs[i % signs.length]`). */
function chartOfSigns(signs: readonly string[], provenance?: ChartProvenance): NatalChartInput {
  const planets: Record<string, { sign: string }> = {}
  BODIES.forEach((body, i) => {
    planets[body] = { sign: signs[i % signs.length] }
  })
  return provenance === undefined ? { planets } : { planets, provenance }
}

/** `count` bodies in `element`, the rest in `filler`'s element (default: the opposite one). */
function chartWith(
  element: ElementName,
  count: number,
  provenance?: ChartProvenance,
  filler: ElementName = element === 'Fire' ? 'Water' : 'Fire'
): NatalChartInput {
  const planets: Record<string, { sign: string }> = {}
  BODIES.forEach((body, i) => {
    const pool = i < count ? SIGNS_OF[element] : SIGNS_OF[filler]
    planets[body] = { sign: pool[i % pool.length] }
  })
  return provenance === undefined ? { planets } : { planets, provenance }
}

/** Independent expectation of `natalAffinity`: usable charts only, ten classical bodies. */
function affinityOracle(chart: NatalChartInput | null | undefined, token: EsmsKey): number | null {
  if (!chart) return null
  if (chart.provenance === 'placeholder' || chart.provenance === 'unattributed') return null
  let count = 0
  for (const body of BODIES) {
    const sign = chart.planets[body]?.sign
    if (sign !== undefined && ELEMENT_OF_SIGN[sign] === TOKEN_ELEMENT[token]) count++
  }
  return count
}

// ─── 1. Vocabulary ───────────────────────────────────────────────────────────

describe('vocabulary: the modules use the contract, they do not copy it', () => {
  it('speaks the contract tier vocabulary, in the contract order', () => {
    expect([...contract.SEAL_TIERS]).toEqual(TIERS)
    expect([...SEAL_TIERS]).toEqual(TIERS)
    expect([...barrel.SEAL_TIERS]).toEqual(TIERS)
  })

  it('re-exports the contract by identity (a copy would be a different array)', () => {
    expect(SEAL_TIERS).toBe(contract.SEAL_TIERS)
    expect(barrel.SEAL_TIERS).toBe(contract.SEAL_TIERS)
    expect(ESMS_TOKENS).toBe(contract.ESMS_KEYS)
    expect(CORE_STAT_KEYS).toBe(contract.SACRED_STAT_KEYS)
    expect(computeMeanAlignedRating).toBe(contract.computeMeanAlignedRating)
    expect(contest.SEAL_TIER_MULTIPLIERS).toBe(contract.SEAL_TIER_MULTIPLIERS)
  })

  it('keeps the stat and ESMS orders the contract defines', () => {
    expect([...contract.SACRED_STAT_KEYS]).toEqual(STAT_ORDER)
    expect([...CORE_STAT_KEYS]).toEqual(STAT_ORDER)
    expect([...contract.ESMS_KEYS]).toEqual(ESMS_ORDER)
    expect([...ESMS_TOKENS]).toEqual(ESMS_ORDER)
  })

  it('pins the contract numbers this PR was conformed to (a change here means: re-check the modules)', () => {
    expect(contract.SEAL_STAT_GATES).toEqual({
      Copper: 74,
      Silver: 80,
      Gold: 86,
      Astral: 91,
      Celestial: 96,
    })
    expect(contract.SEAL_ESMS_GATES).toEqual({
      Copper: 0.5,
      Silver: 2,
      Gold: 10,
      Astral: 50,
      Celestial: 250,
    })
    expect(contract.SEAL_TIER_MULTIPLIERS).toEqual({
      Copper: 1.05,
      Silver: 1.1,
      Gold: 1.18,
      Astral: 1.28,
      Celestial: 1.4,
    })
    for (const stat of STAT_ORDER) {
      const [name, category] = CATALOG_PIN[stat]
      expect(contract.CANONICAL_SEAL_CATALOG[stat]).toMatchObject({ name, category })
    }
  })

  it('derives SEAL_TIER_REQUIREMENTS from the contract gates, tier by tier', () => {
    expect(Object.keys(SEAL_TIER_REQUIREMENTS)).toEqual([...TIERS])
    for (const tier of TIERS) {
      expect(SEAL_TIER_REQUIREMENTS[tier]).toEqual({
        minRating: contract.SEAL_STAT_GATES[tier],
        minBalance: contract.SEAL_ESMS_GATES[tier],
      })
    }
    expect(SEAL_TIER_REQUIREMENTS.Astral).toEqual({ minRating: 91, minBalance: 50 })
  })

  it('builds SEAL_CATALOG from the contract catalog: one Seal per stat, in contract order', () => {
    expect(SEAL_CATALOG.map(seal => seal.stat)).toEqual(STAT_ORDER)
    for (const stat of STAT_ORDER) {
      const entry = SEAL_CATALOG.find(seal => seal.stat === stat)
      expect(entry).toEqual({
        id: `seal-${stat}`,
        name: contract.CANONICAL_SEAL_CATALOG[stat].name,
        token: contract.CANONICAL_SEAL_CATALOG[stat].category,
        stat,
      })
      expect([entry?.name, entry?.token]).toEqual([...CATALOG_PIN[stat]])
    }
  })

  it('has retired the old registry and the exports that duplicated the contract', () => {
    expect(existsSync(join(RATING_DIR, 'vessel-appearance.ts'))).toBe(false)
    const retired = [
      'SURGE_ACTIVE_AT',
      'MAX_SURGE_BOOST',
      'classifyMonica',
      'applyStatBoosts',
      'STAT_BASELINES',
      'OVR_RANK_WEIGHTS',
      'archetypeTitle',
      'components',
      'getVesselAppearance',
      'deriveVesselAppearance',
      'appearanceFromSeed',
    ]
    for (const name of retired) expect(barrel).not.toHaveProperty(name)
    // The multipliers are the contract's, reachable through the contest module only.
    expect(sealsModule).not.toHaveProperty('SEAL_TIER_MULTIPLIERS')
    // The scale a payload advertises is the contract's clamp.
    expect(VESSEL_RATING_SCALE).toEqual({
      name: 'Pentacle Vessel Rating Scale',
      floor: contract.clampStat(-1e9),
      ceiling: contract.clampStat(1e9),
    })
    expect([RATING_FLOOR, RATING_CEILING]).toEqual([25, 99])
  })
})

// ── Source checks: the rating modules import the contract and hold no copy of it ──

const RATING_SOURCES: string[] = [
  ...readdirSync(RATING_DIR)
    .filter(name => name.endsWith('.ts'))
    .sort()
    .map(name => join(RATING_DIR, name)),
  ROUTE_FILE,
]

const parseSource = (text: string, name = 'fixture.ts'): ts.SourceFile =>
  ts.createSourceFile(name, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)

/** Numbers that exist only to be the contract's: stat gates, multipliers and fractional means. */
const CONTRACT_NUMBERS = new Set([
  74, 80, 86, 91, 96, 1.05, 1.1, 1.18, 1.28, 1.4, 76.5, 64.5, 68.5, 67.5,
])
/** Names the contract owns; declaring one locally is a copy. */
const CONTRACT_NAMES = new Set([
  'ARCHETYPE_TITLE_MATRIX',
  'CANONICAL_SEAL_CATALOG',
  'ESMS_KEYS',
  'GLOBAL_ROSTER_MEAN',
  'ROSTER_BASELINE_RATINGS',
  'SACRED_STAT_KEYS',
  'SEAL_ESMS_GATES',
  'SEAL_STAT_GATES',
  'SEAL_TIERS',
  'SEAL_TIER_MULTIPLIERS',
  'buildCanonicalSeal',
  'clampStat',
  'computeMeanAlignedRating',
  'computeOvr',
  'computeRelativeAdvantage',
  'determineMonicaState',
  'evaluateSealTier',
  'evaluateSurgeState',
  'resolveArchetype',
])
/** Strings that are the contract's content: Seal names and archetype titles. */
const CONTRACT_STRINGS = new Set([
  ...Object.values(CATALOG_PIN).map(([name]) => name),
  'Dominant Commander',
  'Juggernaut Anchor',
  'Illuminated Sage',
  'Reclusive Visionary',
  'Polymath Craftsman',
])

/** Every way a source file can carry its own copy of the contract. Comments are not code. */
function findContractCopies(sf: ts.SourceFile): string[] {
  const hits: string[] = []
  const at = (node: ts.Node): number => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const nameOf = (name: ts.PropertyName | ts.BindingName): string | undefined =>
    ts.isIdentifier(name) || ts.isStringLiteral(name) ? name.text : undefined

  const visit = (node: ts.Node): void => {
    if (ts.isNumericLiteral(node) && CONTRACT_NUMBERS.has(Number(node.text))) {
      hits.push(`${at(node)}: numeric literal ${node.text}`)
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      CONTRACT_STRINGS.has(node.text)
    ) {
      hits.push(`${at(node)}: string "${node.text}" copied from the contract`)
    }
    if (ts.isObjectLiteralExpression(node)) {
      const tierKeys = node.properties.filter(
        p => p.name !== undefined && (TIERS as readonly string[]).includes(nameOf(p.name) ?? '')
      )
      if (tierKeys.length >= 3) hits.push(`${at(node)}: a table keyed by seal tier`)
    }
    if (
      ts.isPropertyAssignment(node) &&
      ['baseline', 'mean'].includes(nameOf(node.name) ?? '') &&
      ts.isNumericLiteral(node.initializer)
    ) {
      hits.push(`${at(node)}: a literal ${nameOf(node.name)}`)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) {
      if (CONTRACT_NAMES.has(node.name.text)) hits.push(`${at(node)}: declares ${node.name.text}`)
    }
    if (ts.isFunctionDeclaration(node) && node.name && CONTRACT_NAMES.has(node.name.text)) {
      hits.push(`${at(node)}: declares ${node.name.text}`)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return hits
}

/** Identifiers called as `name(...)`, and identifiers referenced outside import declarations. */
function usage(sf: ts.SourceFile): { calls: Set<string>; refs: Set<string> } {
  const calls = new Set<string>()
  const refs = new Set<string>()
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)) return
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression))
      calls.add(node.expression.text)
    if (ts.isIdentifier(node)) refs.add(node.text)
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { calls, refs }
}

/** Names value-imported from `specifier` (type-only imports do not call anything). */
function valueImports(sf: ts.SourceFile, specifier: string): Set<string> {
  const names = new Set<string>()
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement)) continue
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue
    if (statement.moduleSpecifier.text !== specifier) continue
    const clause = statement.importClause
    if (!clause || clause.isTypeOnly) continue
    if (clause.name) names.add(clause.name.text)
    const bindings = clause.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) names.add(element.name.text)
      }
    }
  }
  return names
}

describe('vocabulary: sources', () => {
  const rel = (path: string): string => relative(ROOT, path)

  it('scans every rating module and the route', () => {
    const scanned = RATING_SOURCES.map(rel)
    for (const expected of [
      'lib/agents/rating/index.ts',
      'lib/agents/rating/ovr-archetype.ts',
      'lib/agents/rating/seals-surge.ts',
      'lib/agents/rating/pentacle-contest.ts',
      'lib/agents/rating/vessel-payload.ts',
      'lib/agents/rating/esms-balance-resolver.ts',
      'lib/agents/rating/live-sky.ts',
      'app/api/agents/rating/route.ts',
    ]) {
      expect(scanned).toContain(expected)
    }
  })

  it('does not contain the retired tier word anywhere', () => {
    const retired = new RegExp(`\\b${['ae', 'ther'].join('')}\\b`, 'i')
    const hits: string[] = []
    for (const file of RATING_SOURCES) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (retired.test(line)) hits.push(`${rel(file)}:${i + 1}`)
        })
    }
    expect(hits).toEqual([])
    // Whole word, any case - and not a longer word that merely contains it.
    expect(retired.test(`the ${['AE', 'THER'].join('')} tier`)).toBe(true)
    expect(retired.test(`${['ae', 'ther'].join('')}ial`)).toBe(false)
  })

  it('holds no local gate, multiplier, baseline, catalog or title table', () => {
    const copies = RATING_SOURCES.flatMap(file =>
      findContractCopies(parseSource(readFileSync(file, 'utf8'), file)).map(
        hit => `${rel(file)}:${hit}`
      )
    )
    expect(copies).toEqual([])
  })

  describe('the scanner is not blind', () => {
    const flagged = (code: string): string[] => findContractCopies(parseSource(code))

    it('finds the contract itself, which is all copies by definition', () => {
      const contractFile = join(ROOT, 'lib/agents/rating-contract.ts')
      expect(
        findContractCopies(parseSource(readFileSync(contractFile, 'utf8'))).length
      ).toBeGreaterThan(20)
    })

    it.each([
      [
        'a stat-gate table',
        'const GATES = { Copper: 74, Silver: 80, Gold: 86, Astral: 91, Celestial: 96 }',
      ],
      ['a gate array', 'const GATES = [74, 80, 86, 91, 96]'],
      ['a multiplier array', 'const M = [1.05, 1.1, 1.18, 1.28, 1.4]'],
      ['one multiplier inline', 'const x = (rating: number) => rating * 1.28'],
      ['a baseline table', 'const B = { power: { mean: 76.5, baseline: 63 } }'],
      ['a tier table of other values', "const T = { Copper: 'a', Silver: 'b', Gold: 'c' }"],
      ['a local contract name', 'const SEAL_TIERS = ["a"]'],
      ['a local contract function', 'function computeOvr() { return 1 }'],
      ['a local contract arrow', 'const evaluateSealTier = () => null'],
      ['a copied seal name', "const n = 'Crucible Finisher'"],
      ['a copied title', 'const t = `Dominant Commander`'],
    ])('flags %s', (_label, code) => {
      expect(flagged(code).length).toBeGreaterThan(0)
    })

    it('leaves comments, ordinary numbers and a normal import alone', () => {
      const clean = [
        '// gates are 74 / 80 / 86 / 91 / 96 and multipliers 1.05 .. 1.4',
        "import { evaluateSealTier } from '../rating-contract'",
        'const HEAT_WEIGHT = 0.5',
        'const percent = { power: 25, vitality: 35 }',
        'export const tier = evaluateSealTier("power", 70, 1)',
      ].join('\n')
      expect(flagged(clean)).toEqual([])
    })
  })

  describe('each module calls the contract', () => {
    const wiring: Record<string, { calls: string[]; refs: string[] }> = {
      'ovr-archetype.ts': {
        calls: ['clampStat', 'computeOvr', 'computeRelativeAdvantage', 'resolveArchetype'],
        refs: ['SACRED_STAT_KEYS'],
      },
      'seals-surge.ts': {
        calls: [
          'buildCanonicalSeal',
          'computeMeanAlignedRating',
          'evaluateSealTier',
          'evaluateSurgeState',
        ],
        refs: [
          'CANONICAL_SEAL_CATALOG',
          'ESMS_KEYS',
          'SACRED_STAT_KEYS',
          'SEAL_ESMS_GATES',
          'SEAL_STAT_GATES',
          'SEAL_TIERS',
        ],
      },
      'pentacle-contest.ts': {
        calls: ['clampStat'],
        refs: ['SEAL_TIERS', 'SEAL_TIER_MULTIPLIERS'],
      },
      'vessel-payload.ts': { calls: [], refs: ['FIXTURE_AGENTS'] },
    }

    it.each(Object.entries(wiring))(
      '%s imports from ../rating-contract and uses it',
      (file, expected) => {
        const sf = parseSource(readFileSync(join(RATING_DIR, file), 'utf8'), file)
        const imported = valueImports(sf, '../rating-contract')
        const { calls, refs } = usage(sf)
        for (const name of expected.calls) {
          expect(imported, `${file} imports ${name}`).toContain(name)
          expect(calls, `${file} calls ${name}`).toContain(name)
        }
        for (const name of expected.refs) {
          expect(imported, `${file} imports ${name}`).toContain(name)
          expect(refs, `${file} uses ${name}`).toContain(name)
        }
      }
    )

    it('vessel-payload reads the look and the roster factions from the contract manifest', () => {
      const sf = parseSource(readFileSync(join(RATING_DIR, 'vessel-payload.ts'), 'utf8'))
      const imported = valueImports(sf, '../vessel-appearance-manifest')
      const { calls, refs } = usage(sf)
      expect(imported).toContain('resolveAgentAppearance')
      expect(calls).toContain('resolveAgentAppearance')
      expect(imported).toContain('CANONICAL_ROSTER_71')
      expect(refs).toContain('CANONICAL_ROSTER_71')
    })

    it('no module imports a registry of its own', () => {
      for (const file of RATING_SOURCES) {
        expect(readFileSync(file, 'utf8')).not.toMatch(/from\s+['"]\.\/vessel-appearance['"]/)
      }
    })
  })
})

// ─── 2. Ratings: rateStats is the contract's functions on the 25-99 scale ────

const ROSTER_RATED = HISTORICAL_AGENTS.map(agent => ({
  agent,
  stats: deriveSacredStats(agent) as unknown as CoreStats,
}))

function randomStatVectors(count: number, seed: number): CoreStats[] {
  const rand = seeded(seed)
  const coarse = [0, 12.5, 25, 37.5, 50, 62.5, 75, 87.5, 100]
  const out: CoreStats[] = []
  for (let i = 0; i < count; i++) {
    // Two thirds continuous, one third on a coarse grid so that ratings tie and the
    // archetype tie-break (stat order) is exercised.
    out.push(
      i % 3 === 2
        ? statsFrom(() => pick(rand, coarse))
        : statsFrom(() => Math.round(rand() * 10000) / 100)
    )
  }
  return out
}

describe('rateStats equals the contract applied to the same ratings', () => {
  const vectors: CoreStats[] = [
    ...ROSTER_RATED.map(r => r.stats),
    ...randomStatVectors(500, 0xa501),
    uniformStats(0),
    uniformStats(100),
    uniformStats(25),
    uniformStats(75),
    uniformStats(50),
  ]

  it('covers the whole roster and 500 seeded random vectors', () => {
    expect(ROSTER_RATED.length).toBeGreaterThanOrEqual(70)
    expect(vectors.length).toBe(ROSTER_RATED.length + 505)
  })

  it('rates a stat as round(25 + 0.74 * stat), an integer on 25-99', () => {
    const bad: string[] = []
    for (const stats of vectors) {
      const { ratings } = rateStats(stats)
      for (const stat of STAT_ORDER) {
        const want = expectedRating(stats[stat])
        if (ratings[stat] !== want)
          bad.push(`${stat} ${stats[stat]} -> ${ratings[stat]} want ${want}`)
        if (!Number.isInteger(ratings[stat]) || ratings[stat] < 25 || ratings[stat] > 99) {
          bad.push(`${stat} ${ratings[stat]} off the scale`)
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
  })

  it('anchors the scale: 0 -> 25, 100 -> 99, and the exact half-points round up', () => {
    expect(toRating(0)).toBe(25)
    expect(toRating(100)).toBe(99)
    expect(toRating(25)).toBe(44) // 43.5
    expect(toRating(75)).toBe(81) // 80.5
    expect(toRating(50)).toBe(62)
    expect(rateStats(uniformStats(0)).ratings).toEqual(uniformStats(25))
  })

  it('returns the contract ovr, relativeAdvantage and archetype for those ratings', () => {
    const bad: string[] = []
    vectors.forEach((stats, i) => {
      const got = rateStats(stats)
      const advantage = contract.computeRelativeAdvantage(got.ratings)
      if (got.ovr !== contract.computeOvr(got.ratings)) bad.push(`#${i} ovr`)
      if (JSON.stringify(got.relativeAdvantage) !== JSON.stringify(advantage))
        bad.push(`#${i} advantage`)
      if (JSON.stringify(got.archetype) !== JSON.stringify(contract.resolveArchetype(advantage))) {
        bad.push(`#${i} archetype`)
      }
    })
    expect(bad.slice(0, 5)).toEqual([])
  })

  it('also equals the contract applied to ratings the spec rounds itself', () => {
    for (const stats of vectors) {
      const ratings = statsFrom(stat => contract.clampStat(expectedRating(stats[stat])))
      const advantage = contract.computeRelativeAdvantage(ratings)
      expect(rateStats(stats)).toEqual({
        ratings,
        ovr: contract.computeOvr(ratings),
        relativeAdvantage: advantage,
        archetype: contract.resolveArchetype(advantage),
      })
    }
  })

  it('has exactly the contract-shaped keys: no spread, no kind, no z-scores', () => {
    expect(Object.keys(rateStats(uniformStats(50))).sort()).toEqual(
      ['archetype', 'ovr', 'ratings', 'relativeAdvantage'].sort()
    )
  })

  it('rates a flat vessel at its own rating, whatever the weights', () => {
    for (const stat of [0, 10, 33.3, 50, 80, 100]) {
      const want = expectedRating(stat)
      expect(rateStats(uniformStats(stat)).ovr).toBe(want)
    }
  })

  it('subtracts the contract baseline from the rating, not from the 0-100 stat', () => {
    const { ratings, relativeAdvantage } = rateStats(uniformStats(80))
    for (const stat of STAT_ORDER) {
      expect(relativeAdvantage[stat]).toBe(
        Math.round((ratings[stat] - contract.ROSTER_BASELINE_RATINGS[stat].baseline) * 10) / 10
      )
    }
  })

  it('breaks an advantage tie by the contract stat order and names the contract title', () => {
    // Equal ratings on all but one stat: the archetype is decided by baselines and then order.
    const flat = rateStats(uniformStats(60))
    const expected = contract.resolveArchetype(contract.computeRelativeAdvantage(flat.ratings))
    expect(flat.archetype).toEqual(expected)
    expect(expected.title).toBe(
      contract.resolveArchetype(contract.computeRelativeAdvantage(flat.ratings)).title
    )
    expect(flat.archetype.primary).not.toBe(flat.archetype.secondary)
  })

  it('rateAgent is rateStats on the derived Sacred 7, for every roster agent', () => {
    for (const { agent, stats } of ROSTER_RATED) {
      expect(rateAgent(agent), agent.id).toEqual(rateStats(stats))
    }
  })

  it('exports the same function from the module and the barrel', () => {
    expect(barrel.rateStats).toBe(rateStats)
    expect(barrel.rateAgent).toBe(rateAgent)
  })

  it('clamps an out-of-range stat and refuses a non-finite one', () => {
    expect(toRating(-40)).toBe(25)
    expect(toRating(400)).toBe(99)
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() => toRating(bad, 'wisdom')).toThrow(RangeError)
      expect(() => rateStats({ ...uniformStats(50), wisdom: bad })).toThrow(/wisdom/)
    }
  })
})

// ─── 3. Seals ────────────────────────────────────────────────────────────────

/** Balances around every ESMS gate: just under, exactly on, and far over. */
const BALANCE_GRID = [0, 0.49, 0.5, 1.99, 2, 9.99, 10, 49.99, 50, 249.99, 250, 5000]

const CHART_VARIANTS: Array<[label: string, chart: NatalChartInput | null | undefined]> = [
  ['no chart (undefined)', undefined],
  ['no chart (null)', null],
  ['an empty chart', { planets: {} }],
  ['unknown signs only', chartOfSigns(['Ophiuchus'], 'computed')],
  ['placeholder, all Fire', chartWith('Fire', 10, 'placeholder')],
  ['unattributed, all Water', chartWith('Water', 10, 'unattributed')],
  ['placeholder, all Earth', chartWith('Earth', 10, 'placeholder')],
  ['unattributed, all Air', chartWith('Air', 10, 'unattributed')],
  ...(['Fire', 'Water', 'Earth', 'Air'] as const).flatMap(
    (element): Array<[string, NatalChartInput]> => [
      [`3 ${element} (one short of the bar)`, chartWith(element, 3, 'authored')],
      [`4 ${element} (exactly the bar)`, chartWith(element, 4, 'computed')],
      [`5 ${element}, no provenance`, chartWith(element, 5)],
      [`10 ${element}, computed`, chartWith(element, 10, 'computed')],
    ]
  ),
]

interface SealCase {
  label: string
  stats: CoreStats
  balances: EsmsBalances
  chart: NatalChartInput | null | undefined
}

/** The charts the dense grid rotates through: the bar's edges for all four elements, and the ignored ones. */
const DENSE_CHARTS = CHART_VARIANTS.filter(([label]) =>
  [
    'no chart (undefined)',
    'placeholder, all Fire',
    '3 Fire (one short of the bar)',
    '4 Fire (exactly the bar)',
    '4 Water (exactly the bar)',
    '4 Earth (exactly the bar)',
    '4 Air (exactly the bar)',
  ].includes(label)
)

function sealCases(): SealCase[] {
  const cases: SealCase[] = []
  // Dense: every integer stat 0-100 with a rotating balance per token, under six charts.
  const dense = DENSE_CHARTS
  for (let value = 0; value <= 100; value++) {
    for (let offset = 0; offset < BALANCE_GRID.length; offset++) {
      const balances = {
        spirit: BALANCE_GRID[offset % BALANCE_GRID.length],
        essence: BALANCE_GRID[(offset + 3) % BALANCE_GRID.length],
        matter: BALANCE_GRID[(offset + 6) % BALANCE_GRID.length],
        substance: BALANCE_GRID[(offset + 9) % BALANCE_GRID.length],
      }
      const [label, chart] = dense[(value + offset) % dense.length]
      cases.push({
        label: `dense ${value}/${offset}/${label}`,
        stats: uniformStats(value),
        balances,
        chart,
      })
    }
  }
  // Random: a different stat per seal, a different balance per token, any chart.
  const rand = seeded(0x5ea1)
  for (let i = 0; i < 6000; i++) {
    const [label, chart] = pick(rand, CHART_VARIANTS)
    cases.push({
      label: `random #${i}/${label}`,
      stats: statsFrom(() => Math.round(rand() * 100)),
      balances: {
        spirit: pick(rand, BALANCE_GRID),
        essence: pick(rand, BALANCE_GRID),
        matter: pick(rand, BALANCE_GRID),
        substance: pick(rand, BALANCE_GRID),
      },
      chart,
    })
  }
  return cases
}

/** The full expected `SealProgress` for one case, from the contract plus the documented ASOL rules. */
function expectedProgress(
  stat: SacredStatKey,
  statValue: number,
  balance: number,
  chart: NatalChartInput | null | undefined
): SealProgress {
  const [name, token] = CATALOG_PIN[stat]
  const rating = expectedRating(statValue)
  const aligned = contract.computeMeanAlignedRating(stat, rating)
  const affinity = affinityOracle(chart, token)
  const allowed = affinity !== null && affinity >= 4
  const tier = contract.evaluateSealTier(stat, rating, balance, !allowed)

  const ceiling = contract.computeMeanAlignedRating(stat, 99)
  let maxIndex = 0
  TIERS.forEach((candidate, i) => {
    if (contract.SEAL_STAT_GATES[candidate] <= ceiling) maxIndex = i
  })
  const nextIndex = rankOf(tier) + 1
  const nextTier = nextIndex <= maxIndex ? TIERS[nextIndex] : null
  const blockedBy: SealProgress['blockedBy'] = []
  if (nextTier !== null) {
    if (aligned < contract.SEAL_STAT_GATES[nextTier]) blockedBy.push('stat')
    if (balance < contract.SEAL_ESMS_GATES[nextTier]) blockedBy.push('esms')
    if (nextTier === 'Celestial' && !allowed) blockedBy.push('natal')
  }
  return {
    id: `seal-${stat}`,
    name,
    token,
    stat,
    tier,
    nextTier,
    blockedBy,
    maxTier: TIERS[maxIndex],
    statRating: rating,
    alignedRating: Math.round(aligned * 100) / 100,
    balance,
    natalAffinity: affinity,
  }
}

describe('evaluateSeals equals the contract tier, plus ASOL Celestial rule', () => {
  const cases = sealCases()

  it('evaluates the whole catalog in contract order, every time', () => {
    for (const c of cases.slice(0, 300)) {
      const progress = evaluateSeals({
        stats: c.stats,
        esmsBalances: c.balances,
        natalChart: c.chart,
      })
      expect(progress.map(p => p.stat)).toEqual(STAT_ORDER)
      expect(progress.map(p => p.id)).toEqual(STAT_ORDER.map(stat => `seal-${stat}`))
    }
  })

  it(`matches an independent oracle on every field, over ${cases.length} cases`, () => {
    const bad: string[] = []
    for (const c of cases) {
      const progress = evaluateSeals({
        stats: c.stats,
        esmsBalances: c.balances,
        natalChart: c.chart,
      })
      STAT_ORDER.forEach((stat, i) => {
        const want = expectedProgress(
          stat,
          c.stats[stat],
          c.balances[CATALOG_PIN[stat][1]],
          c.chart
        )
        if (JSON.stringify(progress[i]) !== JSON.stringify(want)) {
          bad.push(
            `${c.label} ${stat}: ${JSON.stringify(progress[i])} want ${JSON.stringify(want)}`
          )
        }
      })
    }
    expect(bad.slice(0, 3)).toEqual([])
  })

  it("passes the contract's evaluateSealTier its Celestial bar: open on 4+ bodies, closed otherwise", () => {
    let withBar = 0
    let withoutBar = 0
    const bad: string[] = []
    for (const c of cases) {
      const progress = evaluateSeals({
        stats: c.stats,
        esmsBalances: c.balances,
        natalChart: c.chart,
      })
      for (const p of progress) {
        const rating = expectedRating(c.stats[p.stat])
        const affinity = affinityOracle(c.chart, p.token)
        const open = affinity !== null && affinity >= 4
        const want = contract.evaluateSealTier(p.stat, rating, c.balances[p.token], !open)
        if (p.tier !== want) bad.push(`${c.label} ${p.stat}: ${p.tier} want ${want}`)
        if (open) withBar++
        else withoutBar++
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
    expect(withBar).toBeGreaterThan(1000)
    expect(withoutBar).toBeGreaterThan(1000)
  })

  it('never rates above the contract, and differs only where the contract says Celestial', () => {
    let divergences = 0
    let celestialAgreements = 0
    const bad: string[] = []
    for (const c of cases) {
      const progress = evaluateSeals({
        stats: c.stats,
        esmsBalances: c.balances,
        natalChart: c.chart,
      })
      for (const p of progress) {
        const rating = expectedRating(c.stats[p.stat])
        const balance = c.balances[p.token]
        const open = contract.evaluateSealTier(p.stat, rating, balance, false)
        const closed = contract.evaluateSealTier(p.stat, rating, balance, true)
        if (rankOf(p.tier) > rankOf(open)) bad.push(`${c.label} ${p.stat} above the contract`)
        if (p.tier !== open) {
          divergences++
          if (open !== 'Celestial' || p.tier !== closed)
            bad.push(`${c.label} ${p.stat} diverges below ${open}`)
        } else if (open === 'Celestial') celestialAgreements++
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
    // Not vacuous: the Celestial rule bites somewhere and lets Celestial through elsewhere.
    expect(divergences).toBeGreaterThan(50)
    expect(celestialAgreements).toBeGreaterThan(50)
  })

  it('agrees with the contract exactly with a 4+ body chart, and with isPlaceholder=true without one', () => {
    const stats = uniformStats(100)
    const balances: EsmsBalances = { spirit: 1000, essence: 1000, matter: 1000, substance: 1000 }
    const celestialOf = (chart: NatalChartInput | null | undefined) =>
      Object.fromEntries(
        evaluateSeals({ stats, esmsBalances: balances, natalChart: chart }).map(p => [
          p.stat,
          p.tier,
        ])
      )
    const contractTier = (stat: SacredStatKey, isPlaceholder: boolean) =>
      contract.evaluateSealTier(stat, 99, 1000, isPlaceholder)

    // A chart cannot have 4 bodies in every element, so open one token at a time.
    for (const stat of STAT_ORDER) {
      const element = TOKEN_ELEMENT[CATALOG_PIN[stat][1]]
      expect(celestialOf(chartWith(element, 4, 'computed'))[stat], stat).toBe(
        contractTier(stat, false)
      )
      expect(celestialOf(chartWith(element, 3, 'computed'))[stat], stat).toBe(
        contractTier(stat, true)
      )
      expect(celestialOf(chartWith(element, 10, 'placeholder'))[stat], stat).toBe(
        contractTier(stat, true)
      )
      expect(celestialOf(chartWith(element, 10, 'unattributed'))[stat], stat).toBe(
        contractTier(stat, true)
      )
      expect(celestialOf(null)[stat], stat).toBe(contractTier(stat, true))
      expect(celestialOf(undefined)[stat], stat).toBe(contractTier(stat, true))
    }
    expect(CELESTIAL_MIN_NATAL_AFFINITY).toBe(4)
  })

  it('stops Crucible Finisher at Gold: a perfect power aligns to 90.5, short of the Astral gate', () => {
    const balances: EsmsBalances = { spirit: 1e6, essence: 1e6, matter: 1e6, substance: 1e6 }
    const open = chartWith('Air', 10, 'computed') // substance is power's token
    const [power] = evaluateSeals({
      stats: uniformStats(100),
      esmsBalances: balances,
      natalChart: open,
    })
    expect(power).toMatchObject({
      stat: 'power',
      tier: 'Gold',
      alignedRating: 90.5,
      maxTier: 'Gold',
      nextTier: null,
      blockedBy: [],
      statRating: 99,
    })
    for (const seal of evaluateSeals({
      stats: uniformStats(100),
      esmsBalances: balances,
      natalChart: chartWith('Fire', 10, 'computed'),
    })) {
      if (seal.stat !== 'power') expect(seal.maxTier).toBe('Celestial')
    }
    expect(90.5).toBeLessThan(contract.SEAL_STAT_GATES.Astral)
  })

  it('reports alignedRating as the contract alignment of the rating, to 2 dp', () => {
    const stats = statsFrom((_, i) => 40 + i * 9)
    const progress = evaluateSeals({
      stats,
      esmsBalances: { spirit: 1, essence: 1, matter: 1, substance: 1 },
    })
    for (const p of progress) {
      expect(p.statRating).toBe(expectedRating(stats[p.stat]))
      expect(p.alignedRating).toBe(
        Math.round(contract.computeMeanAlignedRating(p.stat, p.statRating) * 100) / 100
      )
      expect(p.alignedRating).toBe(
        p.statRating - contract.ROSTER_BASELINE_RATINGS[p.stat].mean + contract.GLOBAL_ROSTER_MEAN
      )
    }
  })

  it('earnedSeals is the contract buildCanonicalSeal of every earned tier, in contract order', () => {
    const tiersSeen = new Set<SealTier>()
    const bad: string[] = []
    for (const c of cases) {
      const progress = evaluateSeals({
        stats: c.stats,
        esmsBalances: c.balances,
        natalChart: c.chart,
      })
      const want: AlchemicalSeal[] = []
      for (const stat of STAT_ORDER) {
        const p = progress[STAT_ORDER.indexOf(stat)]
        if (p.tier !== null) {
          want.push(contract.buildCanonicalSeal(stat, p.tier))
          tiersSeen.add(p.tier)
        }
      }
      const got = earnedSeals(progress)
      if (JSON.stringify(got) !== JSON.stringify(want)) bad.push(c.label)
      for (const seal of got) {
        if (seal.multiplier !== contract.SEAL_TIER_MULTIPLIERS[seal.tier])
          bad.push(`${c.label} multiplier`)
        if (seal.id !== `seal-${seal.statKey}`) bad.push(`${c.label} id`)
        if (seal.category !== CATALOG_PIN[seal.statKey as SacredStatKey][1])
          bad.push(`${c.label} category`)
        if (
          Object.keys(seal).sort().join() !== 'category,description,id,multiplier,name,statKey,tier'
        ) {
          bad.push(`${c.label} keys`)
        }
      }
    }
    expect(bad.slice(0, 5)).toEqual([])
    // Not vacuous: every tier the contract defines is earned somewhere in the grid.
    expect([...tiersSeen].sort()).toEqual([...TIERS].sort())
  })

  it('earnedSeals ignores an unearned Seal and returns nothing for nothing', () => {
    expect(earnedSeals([])).toEqual([])
    const none = evaluateSeals({
      stats: uniformStats(0),
      esmsBalances: { spirit: 0, essence: 0, matter: 0, substance: 0 },
    })
    expect(none.every(p => p.tier === null)).toBe(true)
    expect(earnedSeals(none)).toEqual([])
  })

  it('names the contract seal in the contract shape', () => {
    const [power] = earnedSeals(
      evaluateSeals({
        stats: statsFrom(stat => (stat === 'power' ? 100 : 0)),
        esmsBalances: { spirit: 0, essence: 0, matter: 0, substance: 5000 },
      })
    )
    expect(power).toEqual({
      id: 'seal-power',
      name: 'Crucible Finisher',
      category: 'substance',
      tier: 'Gold',
      description: 'Channels raw material pressure into irresistible decisive force.',
      statKey: 'power',
      multiplier: 1.18,
    })
  })

  it('counts only the ten classical bodies in the token element, from usable charts', () => {
    expect(natalAffinity(chartWith('Fire', 10, 'computed'), 'spirit')).toBe(10)
    expect(natalAffinity(chartWith('Fire', 10, 'computed'), 'essence')).toBe(0)
    expect(natalAffinity(chartWith('Water', 7, 'authored'), 'essence')).toBe(7)
    expect(natalAffinity(chartWith('Earth', 4), 'matter')).toBe(4)
    expect(natalAffinity(chartWith('Air', 5, 'computed'), 'substance')).toBe(5)
    expect(natalAffinity(chartWith('Fire', 10, 'placeholder'), 'spirit')).toBeNull()
    expect(natalAffinity(chartWith('Fire', 10, 'unattributed'), 'spirit')).toBeNull()
    expect(natalAffinity(null, 'spirit')).toBeNull()
    expect(natalAffinity(undefined, 'matter')).toBeNull()
    // Bodies outside the ten (a node, an asteroid) never count.
    const extras: NatalChartInput = {
      planets: { Chiron: { sign: 'Aries' }, Lilith: { sign: 'Leo' }, Sun: { sign: 'Aries' } },
    }
    expect(natalAffinity(extras, 'spirit')).toBe(1)
    for (const token of ESMS_ORDER) {
      expect(natalAffinity(chartWith(TOKEN_ELEMENT[token], 10, 'computed'), token)).toBe(10)
    }
  })

  it('refuses a corrupt balance or stat instead of reading it as nothing earned', () => {
    const ok: EsmsBalances = { spirit: 1, essence: 1, matter: 1, substance: 1 }
    for (const token of ESMS_ORDER) {
      for (const bad of [-0.001, Number.NaN, Number.POSITIVE_INFINITY]) {
        expect(() =>
          evaluateSeals({ stats: uniformStats(50), esmsBalances: { ...ok, [token]: bad } })
        ).toThrow(new RegExp(`${token}`))
      }
    }
    expect(() =>
      evaluateSeals({ stats: { ...uniformStats(50), charisma: Number.NaN }, esmsBalances: ok })
    ).toThrow(RangeError)
    // Zero is a real balance, not a corrupt one.
    expect(() =>
      evaluateSeals({ stats: uniformStats(50), esmsBalances: { ...ok, spirit: 0 } })
    ).not.toThrow()
  })
})

// ─── 3b. The contest rates the contract's ratings, seals and surge ──────────

describe('pentacle-contest consumes the contract multipliers, clamp and surge shape', () => {
  const round2 = (value: number): number => Math.round(value * 100) / 100
  const ratings = statsFrom((_, i) => 58 + i * 6)
  const sealOf = (token: EsmsKey, tier: SealTier): AlchemicalSeal =>
    contract.buildCanonicalSeal(
      STAT_ORDER.find(stat => CATALOG_PIN[stat][1] === token) as SacredStatKey,
      tier
    )
  const weighted = (zone: contest.ZoneProfile, by: Record<SacredStatKey, number>): number =>
    STAT_ORDER.reduce((sum, stat) => sum + zone.weights[stat] * by[stat], 0)

  it('has the zones to test with', () => {
    expect(contest.ZONE_PROFILES).toHaveLength(11)
    expect(new Set(contest.ZONE_PROFILES.map(zone => zone.esmsToken))).toEqual(new Set(ESMS_ORDER))
  })

  it('multiplies a zone by the contract multiplier of the best matching Seal tier', () => {
    const bad: string[] = []
    for (const zone of contest.ZONE_PROFILES) {
      const base = weighted(zone, ratings)
      const elsewhere = ESMS_ORDER.find(token => token !== zone.esmsToken) as EsmsKey
      for (const tier of TIERS) {
        const matching = contest.effectiveContestRating(
          { ratings, seals: [sealOf(zone.esmsToken, tier)] },
          zone.zoneId
        )
        const want = round2(base * contract.SEAL_TIER_MULTIPLIERS[tier])
        if (matching !== want) bad.push(`zone ${zone.zoneId} ${tier}: ${matching} want ${want}`)
        const other = contest.effectiveContestRating(
          { ratings, seals: [sealOf(elsewhere, tier)] },
          zone.zoneId
        )
        if (other !== round2(base)) bad.push(`zone ${zone.zoneId} ${tier} elsewhere: ${other}`)
      }
      const best = contest.effectiveContestRating(
        {
          ratings,
          seals: [
            sealOf(zone.esmsToken, 'Silver'),
            sealOf(zone.esmsToken, 'Astral'),
            sealOf(zone.esmsToken, 'Copper'),
          ],
        },
        zone.zoneId
      )
      if (best !== round2(base * 1.28)) bad.push(`zone ${zone.zoneId} best of three: ${best}`)
      const general = contest.effectiveContestRating(
        { ratings, seals: [{ ...sealOf(zone.esmsToken, 'Celestial'), category: 'general' }] },
        zone.zoneId
      )
      if (general !== round2(base)) bad.push(`zone ${zone.zoneId} general: ${general}`)
    }
    expect(bad.slice(0, 5)).toEqual([])
  })

  it('adds the contract surge boosts while active, through the contract clamp, and never while calm', () => {
    const high = uniformStats(0) as unknown as Record<SacredStatKey, number>
    for (const stat of STAT_ORDER) high[stat] = 96
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const active = contract.evaluateSurgeState(90, 0.9, 0.5, archetype.primary, archetype.secondary)
    const calm = contract.evaluateSurgeState(40, 0.9, 0.5, archetype.primary, archetype.secondary)
    expect(active.active).toBe(true)
    expect(calm.active).toBe(false)
    const boosted = statsFrom(stat => contract.clampStat(96 + (active.statBoosts[stat] ?? 0)))
    expect(boosted.power).toBe(99) // 96 + 12 is clamped to the contract ceiling
    expect(boosted.vitality).toBe(99) // 96 + 4 too
    const lowered = statsFrom(stat => contract.clampStat(30 + (active.statBoosts[stat] ?? 0)))
    const low = statsFrom(() => 30) as unknown as Record<SacredStatKey, number>
    for (const zone of contest.ZONE_PROFILES) {
      const id = zone.zoneId
      expect(contest.effectiveContestRating({ ratings: high, seals: [], surge: active }, id)).toBe(
        round2(weighted(zone, boosted))
      )
      expect(contest.effectiveContestRating({ ratings: low, seals: [], surge: active }, id)).toBe(
        round2(weighted(zone, lowered))
      )
      expect(contest.effectiveContestRating({ ratings: high, seals: [], surge: calm }, id)).toBe(
        round2(weighted(zone, high))
      )
      expect(contest.effectiveContestRating({ ratings: high, seals: [] }, id)).toBe(
        round2(weighted(zone, high))
      )
      // An inactive surge carrying boosts (a stale or hand-built one) still adds nothing.
      expect(
        contest.effectiveContestRating(
          { ratings: low, seals: [], surge: { active: false, statBoosts: active.statBoosts } },
          id
        )
      ).toBe(round2(weighted(zone, low)))
    }
  })
})

// ─── 4. Surge ────────────────────────────────────────────────────────────────

/** The documented calibration, written out: heat 0.0184-0.1154, reactivity 0.561-3.586. */
const CAL = {
  heat: { low: 0.0184, high: 0.1154 },
  reactivity: { low: 0.561, high: 3.586 },
}
const ramp = (value: number, { low, high }: { low: number; high: number }): number =>
  Math.min(1, Math.max(0, (value - low) / (high - low)))

const RELATION: Record<string, number> = {
  'Air+Fire': 0.5,
  'Earth+Water': 0.5,
  'Fire+Water': -1,
  'Air+Earth': -1,
}
/** Independent expectation of the natal-vs-sky harmony offset, in meter points (2 dp). */
function harmonyOffsetOracle(
  natal: NatalChartInput | null | undefined,
  sky: Record<string, { sign: string }> | null | undefined
): number {
  if (!natal || !sky) return 0
  if (natal.provenance === 'placeholder' || natal.provenance === 'unattributed') return 0
  let total = 0
  let counted = 0
  for (const body of BODIES) {
    const a = ELEMENT_OF_SIGN[natal.planets[body]?.sign ?? '']
    const b = ELEMENT_OF_SIGN[sky[body]?.sign ?? '']
    if (a === undefined || b === undefined) continue
    total += a === b ? 1 : (RELATION[[a, b].sort().join('+')] ?? 0)
    counted++
  }
  return counted === 0 ? 0 : Math.round((total / counted) * 12 * 100) / 100
}

const skyOf = (element: ElementName): Record<string, { sign: string }> =>
  chartWith(element, 10).planets

const BOOST = {
  heatOrTempest: { primary: 12, secondary: 8, rest: 4 },
  equilibrium: { primary: 16, secondary: 12, rest: 8 },
}
function boostsFor(
  primary: SacredStatKey,
  secondary: SacredStatKey,
  amounts: { primary: number; secondary: number; rest: number }
): Record<SacredStatKey, number> {
  return statsFrom(stat =>
    stat === primary ? amounts.primary : stat === secondary ? amounts.secondary : amounts.rest
  ) as unknown as Record<SacredStatKey, number>
}

describe('calculateResonanceSurge equals the contract evaluateSurgeState plus a meter', () => {
  const HEATS = [-1, 0, 0.0184, 0.04, 0.0669, 0.09, 0.1154, 0.5]
  const REACTIVITIES = [-3, 0, 0.561, 1, 2, 3.2, 3.586, 40]
  const MONICAS: Array<number | null | undefined> = [
    null,
    undefined,
    1.618,
    1.6175,
    1.6185,
    1.6171,
    1.6169,
    1.5,
    0.3,
    0.0001,
    0,
    -0.5,
    7,
  ]
  const ARCHETYPES: Array<{ primary: SacredStatKey; secondary: SacredStatKey }> = [
    { primary: 'power', secondary: 'charisma' },
    { primary: 'wisdom', secondary: 'intuition' },
    { primary: 'vitality', secondary: 'power' },
    { primary: 'adaptability', secondary: 'resonance' },
  ]
  const HARMONY_SETUPS: Array<
    [
      string,
      NatalChartInput | null | undefined,
      Record<string, { sign: string }> | null | undefined,
    ]
  > = [
    ['no chart, no sky', undefined, undefined],
    ['chart without sky', chartWith('Fire', 10, 'computed'), null],
    ['sky without chart', null, skyOf('Fire')],
    ['Fire vs Fire', chartWith('Fire', 10, 'computed'), skyOf('Fire')],
    ['Fire vs Water', chartWith('Fire', 10, 'authored'), skyOf('Water')],
    ['Fire vs Air', chartWith('Fire', 10, 'computed'), skyOf('Air')],
    ['Earth vs Water', chartWith('Earth', 10, 'computed'), skyOf('Water')],
    ['Earth vs Air', chartWith('Earth', 10), skyOf('Air')],
    ['Fire vs Earth', chartWith('Fire', 10, 'computed'), skyOf('Earth')],
    ['placeholder chart is ignored', chartWith('Fire', 10, 'placeholder'), skyOf('Fire')],
    ['unattributed chart is ignored', chartWith('Fire', 10, 'unattributed'), skyOf('Water')],
    [
      'mixed chart, mixed sky',
      chartWith('Water', 6, 'computed', 'Air'),
      chartWith('Earth', 4, undefined, 'Fire').planets,
    ],
    [
      'a sky that names no classical body',
      chartWith('Fire', 10, 'computed'),
      { Chiron: { sign: 'Aries' } },
    ],
    [
      'a sky of five bodies, all matching',
      chartWith('Fire', 10, 'computed'),
      Object.fromEntries(BODIES.slice(0, 5).map(body => [body, { sign: 'Aries' }])),
    ],
    [
      'a chart of two bodies against a full sky',
      { planets: { Sun: { sign: 'Aries' }, Moon: { sign: 'Leo' } }, provenance: 'computed' },
      skyOf('Water'),
    ],
    [
      'a chart with an unknown sign',
      chartOfSigns(['Aries', 'Ophiuchus'], 'computed'),
      skyOf('Fire'),
    ],
  ]

  it('hands the contract the same meter, shares, archetype and Monica, over the whole grid', () => {
    const bad: string[] = []
    let active = 0
    const types = new Set<string>()
    for (const heat of HEATS) {
      for (const reactivity of REACTIVITIES) {
        for (const monica of MONICAS) {
          for (const archetype of ARCHETYPES) {
            for (const [label, natalChart, sky] of HARMONY_SETUPS) {
              const heatShare = ramp(heat, CAL.heat)
              const reactivityShare = ramp(reactivity, CAL.reactivity)
              const where = `${heat}/${reactivity}/${String(monica)}/${archetype.primary}/${label}`
              const result = calculateResonanceSurge({
                thermodynamics: { heat, reactivity },
                monica,
                archetype,
                natalChart,
                sky,
              })
              const { skyMeter, harmonyOffset, ...state } = result
              const meter = Math.min(100, Math.max(0, skyMeter + harmonyOffset))
              const want = contract.evaluateSurgeState(
                meter,
                heatShare,
                reactivityShare,
                archetype.primary,
                archetype.secondary,
                monica ?? null
              )
              if (JSON.stringify(state) !== JSON.stringify(want)) {
                bad.push(`${where}: ${JSON.stringify(state)} want ${JSON.stringify(want)}`)
              }
              if (Math.abs(skyMeter - 100 * (0.5 * heatShare + 0.5 * reactivityShare)) > 1e-9) {
                bad.push(`${where}: skyMeter ${skyMeter}`)
              }
              if (harmonyOffset !== harmonyOffsetOracle(natalChart, sky)) {
                bad.push(`${where}: harmonyOffset ${harmonyOffset}`)
              }
              if (state.active) active++
              types.add(state.surgeType)
            }
          }
        }
      }
    }
    expect(bad.slice(0, 3)).toEqual([])
    expect(active).toBeGreaterThan(500)
    expect([...types].sort()).toEqual(['equilibrium', 'inferno', 'tempest'])
  })

  it('carries exactly the contract state keys plus skyMeter and harmonyOffset', () => {
    const result = calculateResonanceSurge({
      thermodynamics: { heat: 0.05, reactivity: 1 },
      archetype: { primary: 'power', secondary: 'wisdom' },
    })
    const stateKeys = Object.keys(contract.evaluateSurgeState(0, 0, 0, 'power', 'wisdom'))
    expect(Object.keys(result).sort()).toEqual([...stateKeys, 'harmonyOffset', 'skyMeter'].sort())
  })

  it('reads the documented calibration', () => {
    expect(DEFAULT_SURGE_CALIBRATION).toEqual(CAL)
    expect(HARMONY_MAX_OFFSET).toBe(12)
  })

  it('boosts all seven stats +12 / +8 / +4 for inferno and tempest, +16 / +12 / +8 for equilibrium', () => {
    const archetype = { primary: 'wisdom', secondary: 'charisma' } as const
    // Custom unit ramps make heat and reactivity shares exactly the numbers passed in.
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const run = (heat: number, reactivity: number, monica: number | null) =>
      calculateResonanceSurge({ thermodynamics: { heat, reactivity }, monica, archetype }, unit)

    const inferno = run(1, 0.8, 1.2)
    expect(inferno).toMatchObject({ active: true, surgeType: 'inferno', monicaState: 'convergent' })
    expect(inferno.statBoosts).toEqual(boostsFor('wisdom', 'charisma', BOOST.heatOrTempest))
    expect(inferno.statBoosts).toEqual({
      power: 4,
      resonance: 4,
      wisdom: 12,
      charisma: 8,
      intuition: 4,
      adaptability: 4,
      vitality: 4,
    })

    const tempest = run(0.5, 1, 1.2)
    expect(tempest).toMatchObject({ active: true, surgeType: 'tempest', meter: 75 })
    expect(tempest.statBoosts).toEqual(boostsFor('wisdom', 'charisma', BOOST.heatOrTempest))

    const equilibrium = run(1, 0.8, 1.618)
    expect(equilibrium).toMatchObject({
      active: true,
      surgeType: 'equilibrium',
      monicaState: 'equilibrium',
    })
    expect(equilibrium.statBoosts).toEqual(boostsFor('wisdom', 'charisma', BOOST.equilibrium))
    expect(equilibrium.statBoosts).toEqual({
      power: 8,
      resonance: 8,
      wisdom: 16,
      charisma: 12,
      intuition: 8,
      adaptability: 8,
      vitality: 8,
    })
  })

  it('swaps the primary and secondary boost when the archetype swaps them', () => {
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const a = calculateResonanceSurge(
      {
        thermodynamics: { heat: 1, reactivity: 1 },
        archetype: { primary: 'power', secondary: 'vitality' },
      },
      unit
    )
    const b = calculateResonanceSurge(
      {
        thermodynamics: { heat: 1, reactivity: 1 },
        archetype: { primary: 'vitality', secondary: 'power' },
      },
      unit
    )
    expect([a.statBoosts.power, a.statBoosts.vitality]).toEqual([12, 8])
    expect([b.statBoosts.power, b.statBoosts.vitality]).toEqual([8, 12])
  })

  it('ignites at a rounded meter of 70: 69.4 is calm, 69.6 is active', () => {
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    // reactivity share 1 and heat share h gives a meter of 50 + 50 h.
    const calm = calculateResonanceSurge(
      { thermodynamics: { heat: 0.388, reactivity: 1 }, archetype },
      unit
    )
    const lit = calculateResonanceSurge(
      { thermodynamics: { heat: 0.392, reactivity: 1 }, archetype },
      unit
    )
    expect(calm).toMatchObject({ meter: 69, active: false, statBoosts: {} })
    expect(lit).toMatchObject({ meter: 70, active: true })
    expect(Object.keys(lit.statBoosts)).toHaveLength(7)
    expect(calm.skyMeter).toBeCloseTo(69.4, 9)
    expect(lit.skyMeter).toBeCloseTo(69.6, 9)
  })

  it('reports ramp positions, not raw thermodynamics, in heat and reactivity', () => {
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const state = calculateResonanceSurge(
      {
        thermodynamics: { heat: 0.25, reactivity: 0.75 },
        archetype: { primary: 'power', secondary: 'wisdom' },
      },
      unit
    )
    expect(state).toMatchObject({ heat: 0.25, reactivity: 0.75, meter: 50, skyMeter: 50 })
    const raw = calculateResonanceSurge({
      thermodynamics: { heat: 0.0669, reactivity: 2 },
      archetype: { primary: 'power', secondary: 'wisdom' },
    })
    expect(raw.heat).toBeCloseTo((0.0669 - 0.0184) / (0.1154 - 0.0184), 12)
    expect(raw.reactivity).toBeCloseTo((2 - 0.561) / (3.586 - 0.561), 12)
    expect(raw.heat).toBeLessThanOrEqual(1)
  })

  it('classifies Monica with the contract: ABSENT, equilibrium within 0.001, convergent, divergent', () => {
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const monicaOf = (monica: number | null | undefined) =>
      calculateResonanceSurge({ thermodynamics: { heat: 0.05, reactivity: 1 }, monica, archetype })
    for (const monica of [
      null,
      undefined,
      1.618,
      1.6175,
      1.6185,
      1.6169,
      1.6191,
      1.0,
      0.5,
      0,
      -0.5,
      -7,
      100,
    ]) {
      expect(monicaOf(monica).monicaState, String(monica)).toBe(
        contract.determineMonicaState(monica)
      )
    }
    expect(monicaOf(null).monicaState).toBe('absent')
    expect(monicaOf(undefined)).toMatchObject({ monica: null, monicaState: 'absent' })
    expect(monicaOf(1.618).monicaState).toBe('equilibrium')
    expect(monicaOf(1.6175).monicaState).toBe('equilibrium')
    expect(monicaOf(1.6169).monicaState).toBe('convergent')
    expect(monicaOf(0).monicaState).toBe('divergent')
    expect(monicaOf(-3).monicaState).toBe('divergent')
    expect(monicaOf(1.618).monica).toBe(1.618)
  })

  it('never lets Monica move the meter, and upgrades only an active surge to equilibrium', () => {
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const hot = { heat: 0.1154, reactivity: 3.586 }
    const cool = { heat: 0.0184, reactivity: 0.561 }
    const metersHot = [null, 1.618, 0.3, -2].map(
      monica => calculateResonanceSurge({ thermodynamics: hot, monica, archetype }).meter
    )
    expect(new Set(metersHot)).toEqual(new Set([100]))
    const hotEq = calculateResonanceSurge({ thermodynamics: hot, monica: 1.618, archetype })
    expect(hotEq).toMatchObject({ active: true, surgeType: 'equilibrium' })
    const coolEq = calculateResonanceSurge({ thermodynamics: cool, monica: 1.618, archetype })
    expect(coolEq).toMatchObject({ active: false, monicaState: 'equilibrium', statBoosts: {} })
    expect(coolEq.surgeType).not.toBe('equilibrium')
  })

  it('chooses inferno when heat is at least reactivity (both as ramp positions), else tempest', () => {
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const type = (heat: number, reactivity: number) =>
      calculateResonanceSurge({ thermodynamics: { heat, reactivity }, archetype }, unit).surgeType
    expect(type(0.5, 0.5)).toBe('inferno')
    expect(type(0.6, 0.5)).toBe('inferno')
    expect(type(0.4, 0.5)).toBe('tempest')
    // On the default ramps the comparison is between ramp positions, not raw numbers (a raw heat
    // is always far below a raw reactivity): heat 0.1 sits at 0.84, reactivity 3 at 0.81, 3.4 at 0.94.
    const raw = (heat: number, reactivity: number) =>
      calculateResonanceSurge({ thermodynamics: { heat, reactivity }, archetype }).surgeType
    expect(raw(0.1, 3)).toBe('inferno')
    expect(raw(0.1, 3.4)).toBe('tempest')
  })

  it('moves the meter by the natal harmony offset, clamped to 0-100', () => {
    const unit: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const at = (heat: number, reactivity: number, natal: ElementName, sky: ElementName) =>
      calculateResonanceSurge(
        {
          thermodynamics: { heat, reactivity },
          archetype,
          natalChart: chartWith(natal, 10, 'computed'),
          sky: skyOf(sky),
        },
        unit
      )
    expect(at(0.5, 0.5, 'Fire', 'Fire')).toMatchObject({
      skyMeter: 50,
      harmonyOffset: 12,
      meter: 62,
    })
    expect(at(0.5, 0.5, 'Fire', 'Water')).toMatchObject({ harmonyOffset: -12, meter: 38 })
    expect(at(0.5, 0.5, 'Fire', 'Air')).toMatchObject({ harmonyOffset: 6, meter: 56 })
    expect(at(0.5, 0.5, 'Fire', 'Earth')).toMatchObject({ harmonyOffset: 0, meter: 50 })
    expect(at(0.5, 0.5, 'Earth', 'Air')).toMatchObject({ harmonyOffset: -12 })
    expect(at(1, 1, 'Fire', 'Fire')).toMatchObject({ skyMeter: 100, harmonyOffset: 12, meter: 100 })
    expect(at(0, 0, 'Fire', 'Water')).toMatchObject({ skyMeter: 0, harmonyOffset: -12, meter: 0 })
    expect(elementalHarmony(chartWith('Fire', 10, 'computed'), skyOf('Fire'))).toBe(1)
    expect(elementalHarmony(chartWith('Fire', 10, 'computed'), skyOf('Water'))).toBe(-1)
    expect(elementalHarmony(chartWith('Fire', 10, 'placeholder'), skyOf('Fire'))).toBeNull()
    expect(elementalHarmony(null, skyOf('Fire'))).toBeNull()
  })

  it('refuses a broken read: non-finite thermodynamics or Monica, or an unusable calibration', () => {
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const good = { heat: 0.05, reactivity: 1 }
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(() =>
        calculateResonanceSurge({ thermodynamics: { ...good, heat: bad }, archetype })
      ).toThrow(RangeError)
      expect(() =>
        calculateResonanceSurge({ thermodynamics: { ...good, reactivity: bad }, archetype })
      ).toThrow(RangeError)
      expect(() =>
        calculateResonanceSurge({ thermodynamics: good, monica: bad, archetype })
      ).toThrow(RangeError)
    }
    const flat: SurgeCalibration[] = [
      { heat: { low: 1, high: 1 }, reactivity: CAL.reactivity },
      { heat: { low: 2, high: 1 }, reactivity: CAL.reactivity },
      { heat: CAL.heat, reactivity: { low: 3, high: 3 } },
      { heat: { low: Number.NaN, high: 1 }, reactivity: CAL.reactivity },
      { heat: CAL.heat, reactivity: { low: 0, high: Number.POSITIVE_INFINITY } },
    ]
    for (const calibration of flat) {
      expect(() =>
        calculateResonanceSurge({ thermodynamics: good, archetype }, calibration)
      ).toThrow(RangeError)
    }
  })

  it('uses a calibration passed in instead of the default', () => {
    const archetype = { primary: 'power', secondary: 'wisdom' } as const
    const wide: SurgeCalibration = { heat: { low: 0, high: 10 }, reactivity: { low: 0, high: 100 } }
    const a = calculateResonanceSurge(
      { thermodynamics: { heat: 0.1154, reactivity: 3.586 }, archetype },
      wide
    )
    expect(a.heat).toBeCloseTo(0.01154, 12)
    expect(a.reactivity).toBeCloseTo(0.03586, 12)
    expect(a.active).toBe(false)
  })
})

// ─── 5. The payload, through the real path ───────────────────────────────────

const PILOTS = ['isaac-newton', 'leonardo-da-vinci', 'emily-dickinson', 'user-avatar-neo'] as const

const skyAt = (
  heat: number,
  reactivity: number,
  monica: number | null,
  sign = 'Libra'
): LiveSky => ({
  source: 'swiss-ephemeris',
  at: '2026-10-15T05:43:00.000Z',
  thermodynamics: { heat, entropy: 0.5, reactivity, gregsEnergy: 0.1 },
  kalchm: 1.1,
  monica,
  bodies: Object.fromEntries(BODIES.map(body => [body, { sign }])),
})

/** An active, Monica-equilibrium surge: the richest state to compare. */
const SKY_ACTIVE = skyAt(0.1154, 3, 1.618)
/** A calm sky: nothing ignites. */
const SKY_CALM = skyAt(0.03, 0.9, 0.7)

function pilotVessel(key: (typeof PILOTS)[number]) {
  const rosterId = resolveVesselAlias(key) ?? key
  const agent = getHistoricalAgent(rosterId)
  if (!agent) throw new Error(`roster agent ${rosterId} is missing`)
  return ratableFromRoster(agent, key)
}

const fixtureOf = (key: string): RatedAgentPayload => {
  const found = contract.FIXTURE_AGENTS.find(f => f.key === key)
  if (!found) throw new Error(`no contract fixture for ${key}`)
  return found
}

function pilotPayload(key: (typeof PILOTS)[number], sky: LiveSky | null = SKY_ACTIVE) {
  const vessel = pilotVessel(key)
  const esms = fixtureOf(key).esms
  const payload = buildRatedAgentPayload({
    vessel,
    balances: { agentId: key, balances: esms, esmsSource: 'database' },
    sky,
  })
  return { vessel, payload, esms }
}

/** The keys a contract payload carries (the fixture's keys minus its portraitUrl). */
const CONTRACT_KEYS = Object.keys(contract.FIXTURE_AGENTS[0]).filter(key => key !== 'portraitUrl')
const EXTENSION_KEYS = ['bestZoneId', 'esmsSource', 'scale', 'sealProgress', 'sky', 'zoneSynergies']

/** Compile-time: the contract's own payload type, as a consumer such as the feed bus sees it. */
const acceptsContractPayload = (payload: RatedAgentPayload): string => payload.key

describe('the payload is the contract payload, for the four contract pilots', () => {
  afterEach(() => feedStreamBus.resetForTesting())

  it.each(PILOTS)('%s: has every key of its contract fixture except portraitUrl', key => {
    const { payload } = pilotPayload(key)
    const fixture = fixtureOf(key)
    expect(CONTRACT_KEYS).toContain('ratings')
    expect(CONTRACT_KEYS.length).toBeGreaterThanOrEqual(13)
    for (const name of Object.keys(fixture).filter(k => k !== 'portraitUrl')) {
      expect(payload, name).toHaveProperty(name)
    }
    expect(payload).not.toHaveProperty('portraitUrl')
    const optional = ['avatarModelUrl', 'headMeshUrl', 'degraded']
    expect(
      Object.keys(payload)
        .filter(k => !optional.includes(k))
        .sort()
    ).toEqual([...CONTRACT_KEYS, ...EXTENSION_KEYS].sort())
    for (const retired of ['agentId', 'name', 'esmsBalances', 'spread']) {
      expect(payload).not.toHaveProperty(retired)
    }
  })

  it.each(PILOTS)('%s: takes its faction and look from the contract', key => {
    const { payload } = pilotPayload(key)
    const fixture = fixtureOf(key)
    expect(payload.key).toBe(key)
    expect(payload.faction).toBe(fixture.faction)
    expect(payload.factionName).toBe(fixture.factionName)
    expect(FACTION_NAMES[payload.faction]).toBe(payload.factionName)
    expect(payload.appearance).toEqual(resolveAgentAppearance(key))
    expect(payload.appearance).toEqual(fixture.appearance)
    expect(payload.isPlaceholder).toBe(false)
  })

  it.each(PILOTS)(
    '%s: ratings, ovr, advantage and archetype are the contract on the payload ratings',
    key => {
      const { payload, vessel } = pilotPayload(key)
      expect(payload.ratings).toEqual(rateStats(vessel.stats).ratings)
      for (const stat of STAT_ORDER) {
        expect(payload.ratings[stat]).toBe(expectedRating(vessel.stats[stat]))
      }
      expect(payload.ovr).toBe(contract.computeOvr(payload.ratings))
      expect(payload.relativeAdvantage).toEqual(contract.computeRelativeAdvantage(payload.ratings))
      expect(payload.archetype).toEqual(contract.resolveArchetype(payload.relativeAdvantage))
      expect(payload.handle).toBe(vessel.name)
    }
  )

  it.each(PILOTS)('%s: seals are the contract seal shape, earned from the pilot ESMS', key => {
    const { payload, vessel, esms } = pilotPayload(key)
    const fixture = fixtureOf(key)
    expect(payload.esms).toEqual(esms)

    const want: AlchemicalSeal[] = []
    for (const stat of STAT_ORDER) {
      const token = CATALOG_PIN[stat][1]
      const affinity = affinityOracle(vessel.natalChart, token)
      const allowed = affinity !== null && affinity >= 4
      const tier = contract.evaluateSealTier(stat, payload.ratings[stat], esms[token], !allowed)
      if (tier !== null) want.push(contract.buildCanonicalSeal(stat, tier))
    }
    expect(payload.seals).toEqual(want)

    const fixtureShape = Object.keys(fixture.seals[0]).sort()
    for (const seal of payload.seals) {
      expect(Object.keys(seal).sort()).toEqual(fixtureShape)
      expect(seal.multiplier).toBe(contract.SEAL_TIER_MULTIPLIERS[seal.tier])
    }
    expect(payload.sealProgress.map(p => p.id)).toEqual(STAT_ORDER.map(s => `seal-${s}`))
    expect(earnedSeals(payload.sealProgress)).toEqual(payload.seals)
  })

  it.each(PILOTS)(
    '%s: the surge is the contract state of the live sky, with the archetype boosted',
    key => {
      const { payload, vessel } = pilotPayload(key)
      expect(payload.surge).not.toBeNull()
      const surge = payload.surge as NonNullable<RatedVesselPayload['surge']>
      const heatShare = ramp(SKY_ACTIVE.thermodynamics.heat, CAL.heat)
      const reactivityShare = ramp(SKY_ACTIVE.thermodynamics.reactivity, CAL.reactivity)
      const offset = harmonyOffsetOracle(vessel.natalChart, SKY_ACTIVE.bodies)
      const skyMeter = 100 * (0.5 * heatShare + 0.5 * reactivityShare)
      const { skyMeter: gotSky, harmonyOffset, ...state } = surge
      expect(gotSky).toBeCloseTo(skyMeter, 9)
      expect(harmonyOffset).toBe(offset)
      expect(state).toEqual(
        contract.evaluateSurgeState(
          Math.min(100, Math.max(0, skyMeter + offset)),
          heatShare,
          reactivityShare,
          payload.archetype.primary,
          payload.archetype.secondary,
          SKY_ACTIVE.monica
        )
      )
      // The sky's raw numbers ride along; the surge carries their ramp positions.
      expect(payload.sky).toEqual({
        source: 'swiss-ephemeris',
        at: '2026-10-15T05:43:00.000Z',
        heat: 0.1154,
        reactivity: 3,
        monica: 1.618,
      })
      expect(surge.heat).toBeCloseTo(heatShare, 12)
      expect(surge.monica).toBe(1.618)
      expect(surge.monicaState).toBe('equilibrium')
    }
  )

  it.each(PILOTS)(
    '%s: is assignable to the contract RatedAgentPayload and round-trips as JSON',
    key => {
      const { payload } = pilotPayload(key)
      const asContract = asContractPayload(payload)
      expect(asContract).not.toBeNull()
      const contractPayload = asContract as RatedAgentPayload
      // Compile-time: tsc fails this call if the payload stops being assignable to the contract.
      expect(acceptsContractPayload(contractPayload)).toBe(key)
      // ...and the unwrapped payload, whose surge may be null, is NOT assignable.
      // @ts-expect-error a payload whose surge can be null is not a RatedAgentPayload
      acceptsContractPayload(payload)
      expect(JSON.parse(JSON.stringify(contractPayload))).toEqual(contractPayload)
      // Every contract key survives untouched, extension keys ride along.
      for (const name of CONTRACT_KEYS) expect(contractPayload).toHaveProperty(name)
      expect(contractPayload).toHaveProperty('sealProgress')
    }
  )

  it.each(PILOTS)('%s: publishes on the real feed bus and reads back', key => {
    const { payload } = pilotPayload(key)
    const contractPayload = asContractPayload(payload) as RatedAgentPayload
    const heard: unknown[] = []
    const unsubscribe = feedStreamBus.subscribe(message => heard.push(message))
    feedStreamBus.recordAgentRating(contractPayload)
    unsubscribe()
    expect(heard).toEqual([{ event: 'agent_rating', data: contractPayload }])
    const stored = feedStreamBus.getRecentRatings().find(r => r.key === key)
    expect(stored).toBe(contractPayload)
    expect(stored?.surge.statBoosts).toEqual(payload.surge?.statBoosts)
    // Publishing the same vessel again replaces it rather than listing it twice.
    feedStreamBus.recordAgentRating(contractPayload)
    expect(feedStreamBus.getRecentRatings().filter(r => r.key === key)).toHaveLength(1)
  })

  it('hands back no contract payload when the live sky is unavailable, and says why', () => {
    const { payload } = pilotPayload('isaac-newton', null)
    expect(payload.surge).toBeNull()
    expect(payload.sky).toBeNull()
    expect(payload.degraded).toEqual({ sky: 'live sky unavailable' })
    expect(asContractPayload(payload)).toBeNull()
    // Everything that does not need a sky is still the contract's.
    expect(payload.ovr).toBe(contract.computeOvr(payload.ratings))
    expect(payload.seals.length).toBeGreaterThan(0)
    expect(payload.zoneSynergies).toEqual(
      contest.computeZoneSynergies({ ratings: payload.ratings, seals: payload.seals, surge: null })
    )
  })

  it('a calm sky leaves the contract payload with an inactive surge and no boosts', () => {
    const { payload } = pilotPayload('leonardo-da-vinci', SKY_CALM)
    const surge = payload.surge as NonNullable<RatedVesselPayload['surge']>
    expect(surge.active).toBe(false)
    expect(surge.statBoosts).toEqual({})
    expect(surge.monicaState).toBe(contract.determineMonicaState(0.7))
    expect(asContractPayload(payload)).not.toBeNull()
  })

  it('an active surge boosts the payload archetype stats, not a fixed pair', () => {
    for (const key of PILOTS) {
      const { payload } = pilotPayload(key)
      const surge = payload.surge as NonNullable<RatedVesselPayload['surge']>
      expect(surge.active).toBe(true)
      expect(surge.statBoosts).toEqual(
        boostsFor(payload.archetype.primary, payload.archetype.secondary, BOOST.equilibrium)
      )
    }
  })

  it.each(PILOTS)('%s: carries the extension fields the contract has no place for', key => {
    const { payload, vessel, esms } = pilotPayload(key)
    expect(payload.scale).toEqual({ name: 'Pentacle Vessel Rating Scale', floor: 25, ceiling: 99 })
    expect(payload.esmsSource).toBe('database')
    expect(payload.degraded).toBeUndefined()
    expect(payload.sealProgress).toEqual(
      evaluateSeals({ stats: vessel.stats, esmsBalances: esms, natalChart: vessel.natalChart })
    )
    // The zone synergies are the contest module's, fed this payload's ratings, seals and surge.
    const fed = { ratings: payload.ratings, seals: payload.seals, surge: payload.surge }
    expect(payload.zoneSynergies).toEqual(contest.computeZoneSynergies(fed))
    expect(payload.bestZoneId).toBe(contest.bestZoneId(fed))
    expect(payload.zoneSynergies).toHaveLength(11)
    // ...and they are not the synergies of a vessel with no Seals or no surge.
    if (payload.seals.length > 0) {
      expect(payload.zoneSynergies).not.toEqual(contest.computeZoneSynergies({ ...fed, seals: [] }))
    }
    expect(payload.zoneSynergies).not.toEqual(contest.computeZoneSynergies({ ...fed, surge: null }))
  })

  it('passes a model and head mesh through only when the vessel has them', () => {
    const base = pilotVessel('isaac-newton')
    const balances = {
      agentId: 'isaac-newton',
      balances: fixtureOf('isaac-newton').esms,
      esmsSource: 'database' as const,
    }
    const plain = buildRatedAgentPayload({ vessel: base, balances, sky: SKY_ACTIVE })
    expect(plain).not.toHaveProperty('avatarModelUrl')
    expect(plain).not.toHaveProperty('headMeshUrl')
    const withUrls = buildRatedAgentPayload({
      vessel: { ...base, avatarModelUrl: '/models/own.glb', headMeshUrl: '/heads/own.glb' },
      balances,
      sky: SKY_ACTIVE,
    })
    expect(withUrls).toMatchObject({
      avatarModelUrl: '/models/own.glb',
      headMeshUrl: '/heads/own.glb',
    })
    const modelOnly = buildRatedAgentPayload({
      vessel: { ...base, avatarModelUrl: '/models/own.glb' },
      balances,
      sky: SKY_ACTIVE,
    })
    expect(modelOnly).toHaveProperty('avatarModelUrl', '/models/own.glb')
    expect(modelOnly).not.toHaveProperty('headMeshUrl')
  })

  it('names the Sun for a faction outside the ten, never undefined', () => {
    const base = pilotVessel('isaac-newton')
    const balances = {
      agentId: 'isaac-newton',
      balances: fixtureOf('isaac-newton').esms,
      esmsSource: 'database' as const,
    }
    const off = { ...base, faction: 99 }
    expect(buildRatedAgentPayload({ vessel: off, balances, sky: SKY_ACTIVE }).factionName).toBe(
      'Sun'
    )
    expect(summarizeVessel(off).factionName).toBe('Sun')
    expect([...FACTION_NAMES]).toEqual([
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
    ])
  })

  it('reports every degraded read it was given, in its own words', () => {
    const vessel = pilotVessel('emily-dickinson')
    const both = buildRatedAgentPayload({
      vessel,
      balances: {
        agentId: 'emily-dickinson',
        balances: fixtureOf('emily-dickinson').esms,
        esmsSource: 'fallback',
        degraded: { reason: 'ledger unavailable' },
      },
      sky: null,
      skyError: 'No sky could be computed',
    })
    expect(both.degraded).toEqual({ esms: 'ledger unavailable', sky: 'No sky could be computed' })
    expect(both.esmsSource).toBe('fallback')
    expect(both.surge).toBeNull()
  })

  it('summarizes a vessel with the contract archetype and manifest look', () => {
    for (const key of PILOTS) {
      const vessel = pilotVessel(key)
      const rating = rateStats(vessel.stats)
      const look = resolveAgentAppearance(key)
      expect(summarizeVessel(vessel)).toEqual({
        key,
        handle: vessel.name,
        faction: fixtureOf(key).faction,
        factionName: fixtureOf(key).factionName,
        ovr: rating.ovr,
        archetype: rating.archetype,
        era: look.era,
        crownStyle: look.headSilhouette.crownStyle,
        signatureRelic: look.signatureRelic,
      })
    }
  })
})

describe('where the ASOL payload legitimately differs from the contract fixtures', () => {
  it('rates from the chart, so its numbers are not the fixture numbers (only the shape is shared)', () => {
    const { payload } = pilotPayload('isaac-newton')
    expect(payload.ratings).not.toEqual(fixtureOf('isaac-newton').ratings)
  })

  it('rates the Neo avatar as the roster agent it stands for, so its provenance is historical, not user', () => {
    expect(VESSEL_ALIASES).toEqual({ 'user-avatar-neo': 'greg-castro-1991' })
    expect(resolveVesselAlias('user-avatar-neo')).toBe('greg-castro-1991')
    expect(resolveVesselAlias('constructor')).toBeUndefined()
    expect(fixtureOf('user-avatar-neo').provenance).toBe('user')
    expect(pilotPayload('user-avatar-neo').payload.provenance).toBe('historical')
    expect(pilotPayload('user-avatar-neo').payload.key).toBe('user-avatar-neo')
  })

  it("prefers a contract pilot's own faction to the manifest roster's (Newton: Saturn, not the Moon)", () => {
    expect(ROSTER_FACTION.get('isaac-newton')).toBe(1)
    expect(fixtureOf('isaac-newton').faction).toBe(6)
    expect(pilotPayload('isaac-newton').payload.faction).toBe(6)
    expect(pilotPayload('isaac-newton').payload.factionName).toBe('Saturn')
  })

  it('takes every other roster agent faction from the manifest roster', () => {
    const bad: string[] = []
    let checked = 0
    for (const agent of HISTORICAL_AGENTS) {
      const key = agent.id.replace(/-\d+$/, '')
      const faction = ROSTER_FACTION.get(key)
      if (faction === undefined || PILOTS.includes(key as (typeof PILOTS)[number])) continue
      checked++
      const vessel = ratableFromRoster(agent)
      if (vessel.faction !== faction) bad.push(`${agent.id}: ${vessel.faction} want ${faction}`)
      if (summarizeVessel(vessel).factionName !== FACTION_NAMES[faction])
        bad.push(`${agent.id} name`)
    }
    expect(bad).toEqual([])
    expect(checked).toBeGreaterThan(40)
  })

  it('gives every roster agent the manifest look, and its own model urls first', () => {
    for (const agent of HISTORICAL_AGENTS) {
      const vessel = ratableFromRoster(agent)
      expect(vessel.appearance, agent.id).toEqual(resolveAgentAppearance(agent.id))
      expect(vessel.agentId).toBe(agent.id)
      expect(vessel.origin).toBe('roster')
    }
    // A roster agent whose id the manifest only derives (no pilot, no hand-authored entry) still
    // gets the manifest's roster look, not one re-derived from a faction of 0.
    const derived = HISTORICAL_AGENTS.filter(
      a => !(PILOTS as readonly string[]).includes(a.id) && ROSTER_FACTION.get(a.id) !== undefined
    )
    expect(derived.length).toBeGreaterThan(30)
    const some = derived.find(a => ROSTER_FACTION.get(a.id) !== 0) as (typeof derived)[number]
    expect(ratableFromRoster(some).appearance).not.toEqual(resolveAgentAppearance(some.id, 0))

    const newton = getHistoricalAgent('isaac-newton') as NonNullable<
      ReturnType<typeof getHistoricalAgent>
    >
    const own = ratableFromRoster({
      ...newton,
      avatarModelUrl: '/models/own.glb',
      headMeshUrl: '/heads/own.glb',
    })
    expect(own.avatarModelUrl).toBe('/models/own.glb')
    expect(own.headMeshUrl).toBe('/heads/own.glb')
    const plain = ratableFromRoster({
      ...newton,
      avatarModelUrl: undefined,
      headMeshUrl: undefined,
    })
    expect(plain.avatarModelUrl).toBe(resolveAgentAppearance('isaac-newton').avatarModelUrl)
    expect(plain.headMeshUrl).toBe(resolveAgentAppearance('isaac-newton').headMeshUrl)
  })

  it('rates a roster agent from its derived Sacred 7 and its own natal chart', () => {
    for (const { agent, stats } of ROSTER_RATED) {
      const vessel = ratableFromRoster(agent)
      for (const stat of STAT_ORDER)
        expect(vessel.stats[stat], `${agent.id} ${stat}`).toBe(stats[stat])
      expect(vessel.natalChart, agent.id).toBe(agent.consciousness?.natalChart ?? null)
      expect(vessel.name).toBe(agent.name)
    }
    const alias = ratableFromRoster(
      getHistoricalAgent('greg-castro-1991') as NonNullable<ReturnType<typeof getHistoricalAgent>>,
      'user-avatar-neo'
    )
    expect(alias.agentId).toBe('user-avatar-neo')
    expect(alias.stats).toEqual(pilotVessel('user-avatar-neo').stats)
  })

  describe('a manifest look that carries model urls', () => {
    afterEach(() => {
      vi.doUnmock('@/lib/agents/vessel-appearance-manifest')
      vi.resetModules()
    })

    it('hands them to the vessel; an agent own url wins; a forged vessel takes the manifest ones', async () => {
      vi.resetModules()
      vi.doMock('@/lib/agents/vessel-appearance-manifest', async importOriginal => {
        const real =
          await importOriginal<typeof import('@/lib/agents/vessel-appearance-manifest')>()
        return {
          ...real,
          resolveAgentAppearance: (...args: Parameters<typeof real.resolveAgentAppearance>) => ({
            ...real.resolveAgentAppearance(...args),
            avatarModelUrl: '/manifest/avatar.glb',
            headMeshUrl: '/manifest/head.glb',
          }),
        }
      })
      const mod = await import('@/lib/agents/rating/vessel-payload')
      const newton = getHistoricalAgent('isaac-newton') as NonNullable<
        ReturnType<typeof getHistoricalAgent>
      >

      const fromManifest = mod.ratableFromRoster(newton)
      expect(fromManifest).toMatchObject({
        avatarModelUrl: '/manifest/avatar.glb',
        headMeshUrl: '/manifest/head.glb',
      })
      const own = mod.ratableFromRoster({
        ...newton,
        avatarModelUrl: '/own/avatar.glb',
        headMeshUrl: '/own/head.glb',
      })
      expect(own).toMatchObject({ avatarModelUrl: '/own/avatar.glb', headMeshUrl: '/own/head.glb' })

      const forged = mod.ratableFromForgedRow(forgedRow('forged-urls-ab12', 'Aries'))
      expect(forged).toMatchObject({
        avatarModelUrl: '/manifest/avatar.glb',
        headMeshUrl: '/manifest/head.glb',
      })
    })
  })

  it('rates a forged row from its persisted Sacred 7, or derives them from its chart', () => {
    const persisted = ratableFromForgedRow(forgedRow('forged-cols-ab12', 'Aries'))
    expect(persisted?.stats).toEqual({
      power: 60,
      resonance: 70,
      wisdom: 65,
      charisma: 72,
      intuition: 68,
      adaptability: 55,
      vitality: 61,
    })
    expect(persisted?.natalChart).toEqual({
      planets: { Sun: { sign: 'Aries', degree: 12 }, Moon: { sign: 'Leo', degree: 3 } },
    })
    expect(persisted?.name).toBe('Forged forged-cols-ab12')
    expect(persisted?.agentId).toBe('forged-cols-ab12')

    // With the columns unset the stats come from the chart, as for a roster agent; the
    // monica constant enters clamped to 0-10.
    const unset = {
      powerScore: 0,
      resonanceScore7: 0,
      wisdomScore: 0,
      charismaScore: 0,
      intuitionScore: 0,
      adaptabilityScore: 0,
      vitalityScore: 0,
    }
    const deriveFrom = (monicaConstant: number) =>
      deriveSacredStats({
        consciousness: {
          natalChart: { planets: forgedRow('x', 'Aries').natalChart.planets },
          monicaConstant,
        },
      } as unknown as Parameters<typeof deriveSacredStats>[0])
    const monicas: Array<[unknown, number]> = [
      [1.2, 1.2],
      [50, 10],
      [-3, 0],
      [Number.NaN, 0],
      [null, 0],
    ]
    const seen = new Set<number>()
    for (const [given, used] of monicas) {
      const row = { ...forgedRow('forged-derive-ab12', 'Aries'), ...unset, monicaConstant: given }
      const vessel = ratableFromForgedRow(row as Parameters<typeof ratableFromForgedRow>[0])
      const want = deriveFrom(used)
      for (const stat of STAT_ORDER) {
        expect(vessel?.stats[stat], `${String(given)} ${stat}`).toBe(want[stat])
      }
      seen.add(want.power + want.wisdom)
    }
    // Not vacuous: the monica constant moves the derived stats.
    expect(seen.size).toBeGreaterThan(1)
    // No columns and no chart: nothing to rate.
    expect(
      ratableFromForgedRow({
        ...forgedRow('forged-empty-ab12', 'Aries'),
        ...unset,
        natalChart: null,
      })
    ).toBeNull()
  })

  it('does not rate a forged row whose stats or ascendant cannot be real', () => {
    const base = forgedRow('forged-bounds-ab12', 'Aries')
    const unset = {
      powerScore: 0,
      resonanceScore7: 0,
      wisdomScore: 0,
      charismaScore: 0,
      intuitionScore: 0,
      adaptabilityScore: 0,
      vitalityScore: 0,
    }
    const derived = deriveSacredStats({
      consciousness: { natalChart: { planets: base.natalChart.planets }, monicaConstant: 1.2 },
    } as unknown as Parameters<typeof deriveSacredStats>[0])
    // A persisted score above 100 is not a score: the stats come from the chart instead.
    for (const bad of [100.5, 101, 1e9, Number.NaN, -1]) {
      const vessel = ratableFromForgedRow({ ...base, powerScore: bad })
      for (const stat of STAT_ORDER)
        expect(vessel?.stats[stat], `${bad} ${stat}`).toBe(derived[stat])
    }
    expect(ratableFromForgedRow({ ...base, powerScore: 100 })?.stats.power).toBe(100)
    expect(ratableFromForgedRow({ ...base, powerScore: 0 })?.stats.power).toBe(0)
    // An ascendant outside the zodiac makes the chart no chart; one inside it is used.
    const withAscendant = (ascendant: number) => ({
      ...base,
      ...unset,
      natalChart: { planets: base.natalChart.planets, ascendant },
    })
    for (const bad of [360.5, 400, -1]) {
      expect(ratableFromForgedRow(withAscendant(bad)), String(bad)).toBeNull()
    }
    expect(ratableFromForgedRow(withAscendant(100))).not.toBeNull()
    expect(ratableFromForgedRow(withAscendant(360))).not.toBeNull()
    // A body whose degree is outside its sign makes the chart no chart.
    expect(
      ratableFromForgedRow({
        ...base,
        ...unset,
        natalChart: { planets: { Sun: { sign: 'Aries', degree: 31 } } },
      })
    ).toBeNull()
    // ...but the edges themselves are real positions: 0 and 30 degrees, and an ascendant of 0.
    for (const degree of [0, 30]) {
      expect(
        ratableFromForgedRow({
          ...base,
          ...unset,
          natalChart: { planets: { Sun: { sign: 'Aries', degree } } },
        }),
        `degree ${degree}`
      ).not.toBeNull()
    }
    expect(ratableFromForgedRow(withAscendant(0))).not.toBeNull()
  })

  it('reads the chart shape the forge persists (tropical bodies and ascendant) like the roster shape', () => {
    const unset = {
      powerScore: 0,
      resonanceScore7: 0,
      wisdomScore: 0,
      charismaScore: 0,
      intuitionScore: 0,
      adaptabilityScore: 0,
      vitalityScore: 0,
    }
    const bodies = {
      Sun: { sign: 'Aries', degree: 12 },
      Moon: { sign: 'Leo', degree: 3 },
      Mercury: { sign: 'Gemini', degree: 8 },
      Venus: { sign: 'Libra', degree: 20 },
      Mars: { sign: 'Scorpio', degree: 5 },
    }
    const base = forgedRow('forged-tropical-ab12', 'Aries')
    const tropical = (ascendantSign: string, degrees: number, firstBodyDegrees = 12) => ({
      tropical: {
        CelestialBodies: {
          all: Object.entries(bodies).map(([label, body], i) => ({
            label,
            Sign: { label: body.sign },
            degrees: i === 0 ? firstBodyDegrees : body.degree,
          })),
        },
        Ascendant: { Sign: { label: ascendantSign }, degrees },
      },
    })
    const flat = (ascendant: number) => ({ planets: bodies, ascendant })
    const rated = (natalChart: unknown) => ratableFromForgedRow({ ...base, ...unset, natalChart })

    // The bodies keep their names (which is how the chart is read) and their degrees.
    expect(rated(tropical('Gemini', 15))?.natalChart).toEqual({ planets: bodies })
    // Gemini is the third sign, so its 15th degree is the longitude 75; the degrees move the stats.
    expect(rated(tropical('Gemini', 15))?.stats).toEqual(rated(flat(75))?.stats)
    expect(rated(tropical('Gemini', 29))?.stats).toEqual(rated(flat(89))?.stats)
    expect(rated(tropical('Gemini', 0))?.stats).toEqual(rated(flat(60))?.stats)
    expect(rated(tropical('Gemini', 29))?.stats).not.toEqual(rated(tropical('Gemini', 0))?.stats)
    // An ascendant sign the zodiac does not know counts as no ascendant, not as a broken chart.
    expect(rated(tropical('Ophiuchus', 10))?.stats).toEqual(rated(flat(0))?.stats)
    // A degree outside its sign, on a body or on the ascendant, is not a chart.
    expect(rated(tropical('Gemini', 31))).toBeNull()
    expect(rated(tropical('Gemini', 15, 31))).toBeNull()
    expect(rated(tropical('Gemini', 15, 30))).not.toBeNull()
  })

  it('falls back to the ruler of the natal Sun sign for a forged vessel, else the Sun (0)', () => {
    const ruler: Record<string, number> = {
      Aries: 4,
      Taurus: 3,
      Gemini: 2,
      Cancer: 1,
      Leo: 0,
      Virgo: 2,
      Libra: 3,
      Scorpio: 9,
      Sagittarius: 5,
      Capricorn: 6,
      Aquarius: 7,
      Pisces: 8,
    }
    for (const [sign, faction] of Object.entries(ruler)) {
      const vessel = ratableFromForgedRow(forgedRow(`forged-${sign.toLowerCase()}-ab12`, sign))
      expect(vessel?.faction, sign).toBe(faction)
    }
    const noSun = ratableFromForgedRow({
      ...forgedRow('forged-nosun-ab12', 'Aries'),
      natalChart: { planets: { Moon: { sign: 'Leo', degree: 3 } } },
    })
    expect(noSun?.faction).toBe(0)
  })

  it('lets a roster key with a birth-year suffix and a pilot key win over the Sun sign', () => {
    // 'machiavelli' is Mars (4) in the manifest roster; his Sun here is Taurus (Venus, 3).
    expect(ratableFromForgedRow(forgedRow('machiavelli-1469', 'Taurus'))?.faction).toBe(4)
    // The pilot avatar is the Sun (0) however its chart reads.
    expect(ratableFromForgedRow(forgedRow('user-avatar-neo-2', 'Pisces'))?.faction).toBe(0)
    expect(ratableFromForgedRow(forgedRow('isaac-newton-1642', 'Aries'))?.faction).toBe(6)
    // The lookup normalises an id the way the manifest does: case and surrounding space.
    expect(ratableFromForgedRow(forgedRow('Machiavelli-1469', 'Taurus'))?.faction).toBe(4)
    expect(ratableFromForgedRow(forgedRow('  machiavelli-1469 ', 'Taurus'))?.faction).toBe(4)
    expect(ratableFromForgedRow(forgedRow('ISAAC-NEWTON', 'Aries'))?.faction).toBe(6)
  })

  it('looks a forged vessel up by its faction and its contract archetype', () => {
    const row = forgedRow('forged-moonwalker-ab12', 'Aries')
    const vessel = ratableFromForgedRow(row)
    expect(vessel).not.toBeNull()
    if (!vessel) return
    const rating = rateStats(vessel.stats)
    expect(vessel.provenance).toBe('user')
    expect(vessel.isPlaceholder).toBe(false)
    expect(vessel.origin).toBe('forged')
    expect(vessel.faction).toBe(4)
    expect(vessel.appearance).toEqual(resolveAgentAppearance(row.agentId, 4, rating.archetype))
    expect(vessel.appearance).not.toEqual(resolveAgentAppearance(row.agentId, 0, rating.archetype))
    expect(vessel.appearance).not.toEqual(resolveAgentAppearance(row.agentId))
    // A different archetype title would change the look.
    expect(vessel.appearance).not.toEqual(
      resolveAgentAppearance(row.agentId, 4, { title: 'Some Other Title' })
    )
  })

  it('marks a placeholder chart: provenance placeholder, no Celestial', () => {
    const agent = HISTORICAL_AGENTS.find(
      a => a.consciousness?.natalChart?.provenance === 'placeholder'
    )
    expect(agent).toBeDefined()
    if (!agent) return
    const vessel = ratableFromRoster(agent)
    expect(vessel.isPlaceholder).toBe(true)
    expect(vessel.provenance).toBe('placeholder')
    const payload = buildRatedAgentPayload({
      vessel,
      balances: {
        agentId: agent.id,
        balances: { spirit: 9999, essence: 9999, matter: 9999, substance: 9999 },
        esmsSource: 'fallback',
        degraded: { reason: 'baseline unavailable' },
      },
      sky: SKY_ACTIVE,
    })
    expect(payload.isPlaceholder).toBe(true)
    expect(payload.provenance).toBe('placeholder')
    expect(payload.seals.some(seal => seal.tier === 'Celestial')).toBe(false)
    expect(payload.sealProgress.every(p => p.natalAffinity === null)).toBe(true)
    expect(payload.degraded).toEqual({ esms: 'baseline unavailable' })
    expect(payload.esmsSource).toBe('fallback')
  })
})

/** The manifest's own roster table: key -> faction (the contract is the oracle for it). */
const ROSTER_FACTION: ReadonlyMap<string, number> = new Map(
  CANONICAL_ROSTER_71.map(entry => [entry.key, entry.faction])
)

function forgedRow(agentId: string, sunSign: string) {
  return {
    agentId,
    name: `Forged ${agentId}`,
    natalChart: {
      planets: { Sun: { sign: sunSign, degree: 12 }, Moon: { sign: 'Leo', degree: 3 } },
    },
    monicaConstant: 1.2,
    powerScore: 60,
    resonanceScore7: 70,
    wisdomScore: 65,
    charismaScore: 72,
    intuitionScore: 68,
    adaptabilityScore: 55,
    vitalityScore: 61,
  }
}

// ─── 5b. A stubbed contract moves every result ───────────────────────────────

type ContractModule = typeof import('@/lib/agents/rating-contract')

/**
 * The strongest proof that the modules CALL the contract and do not copy it: replace one of its
 * exports, re-import the modules, and the result is the replacement. A local copy of a gate, a
 * multiplier or a formula keeps answering with the old number; a call cannot.
 */
describe('stubbing the contract moves every result (the modules call it, they do not copy it)', () => {
  afterEach(() => {
    vi.doUnmock('@/lib/agents/rating-contract')
    vi.resetModules()
  })

  async function withContract(patch: (real: ContractModule) => Record<string, unknown>) {
    vi.resetModules()
    vi.doMock('@/lib/agents/rating-contract', async importOriginal => {
      const real = await importOriginal<ContractModule>()
      return { ...real, ...patch(real) }
    })
    return {
      ovr: await import('@/lib/agents/rating/ovr-archetype'),
      seals: await import('@/lib/agents/rating/seals-surge'),
      contest: await import('@/lib/agents/rating/pentacle-contest'),
      payload: await import('@/lib/agents/rating/vessel-payload'),
    }
  }

  const UNIT: SurgeCalibration = { heat: { low: 0, high: 1 }, reactivity: { low: 0, high: 1 } }
  const NO_BALANCES: EsmsBalances = { spirit: 0, essence: 0, matter: 0, substance: 0 }

  it('ovr-archetype: every rating is clampStat, and ovr, advantage and archetype chain through the contract', async () => {
    const seen = {
      clamp: [] as number[],
      ovr: [] as unknown[],
      advantage: [] as unknown[],
      archetype: [] as unknown[],
    }
    const ADVANTAGE = { stub: 'advantage' }
    const ARCHETYPE = { title: 'Stub Title', primary: 'vitality', secondary: 'power' }
    const { ovr } = await withContract(() => ({
      clampStat: (value: number) => {
        seen.clamp.push(value)
        return 61
      },
      computeOvr: (ratings: unknown) => {
        seen.ovr.push(ratings)
        return 77
      },
      computeRelativeAdvantage: (ratings: unknown) => {
        seen.advantage.push(ratings)
        return ADVANTAGE
      },
      resolveArchetype: (advantage: unknown) => {
        seen.archetype.push(advantage)
        return ARCHETYPE
      },
    }))

    const rated = ovr.rateStats(uniformStats(50))
    expect(rated.ratings).toEqual(uniformStats(61))
    expect(seen.clamp).toEqual(Array(7).fill(62)) // the linear mapping 25 + 0.5 * 74, un-rounded
    expect(rated.ovr).toBe(77)
    expect(rated.relativeAdvantage).toBe(ADVANTAGE)
    expect(rated.archetype).toBe(ARCHETYPE)
    // OVR and advantage are taken on the ratings; the archetype is resolved from the advantage.
    expect(seen.ovr).toEqual([rated.ratings])
    expect(seen.advantage).toEqual([rated.ratings])
    expect(seen.archetype).toEqual([ADVANTAGE])
    expect(seen.archetype[0]).toBe(ADVANTAGE)

    seen.clamp.length = 0
    ovr.toRating(33.3)
    expect(seen.clamp[0]).toBeCloseTo(25 + 0.333 * 74, 9)
  })

  it('seals-surge: asks the contract for each tier with the rating, the balance and the Celestial bar', async () => {
    const asked: unknown[][] = []
    const { seals } = await withContract(() => ({
      evaluateSealTier: (...args: unknown[]) => {
        asked.push(args)
        return 'Astral'
      },
    }))
    const stats = statsFrom((_, i) => 10 * i + 5)
    const balances: EsmsBalances = { spirit: 11, essence: 22, matter: 33, substance: 44 }
    // 4 Fire and 6 Earth: Spirit and Matter are blessed, Essence and Substance are not.
    const chart = chartWith('Fire', 4, 'computed', 'Earth')
    const progress = seals.evaluateSeals({ stats, esmsBalances: balances, natalChart: chart })

    expect(progress.map(p => p.tier)).toEqual(Array(7).fill('Astral'))
    const barred = { spirit: false, essence: true, matter: false, substance: true }
    expect(asked).toEqual(
      STAT_ORDER.map((stat, i) => {
        const token = CATALOG_PIN[stat][1]
        return [stat, expectedRating(10 * i + 5), balances[token], barred[token]]
      })
    )
    // With no chart every Seal is barred from Celestial, with a placeholder chart too.
    asked.length = 0
    seals.evaluateSeals({ stats, esmsBalances: balances })
    seals.evaluateSeals({
      stats,
      esmsBalances: balances,
      natalChart: chartWith('Fire', 10, 'placeholder'),
    })
    expect(asked).toHaveLength(14)
    expect(asked.every(args => args[3] === true)).toBe(true)
  })

  it('seals-surge: alignment, the ceiling and what blocks the next tier come from the contract alignment', async () => {
    const run = async (aligned: (rating: number) => number) => {
      const { seals } = await withContract(() => ({
        computeMeanAlignedRating: (_stat: string, rating: number) => aligned(rating),
      }))
      return seals.evaluateSeals({ stats: uniformStats(0), esmsBalances: NO_BALANCES })
    }

    // A ceiling that lands exactly on the Astral gate (91) reaches Astral and not Celestial.
    for (const p of await run(rating => (rating === 99 ? 91 : 50.5))) {
      expect(p).toMatchObject({
        tier: null,
        nextTier: 'Copper',
        maxTier: 'Astral',
        alignedRating: 50.5,
        blockedBy: ['stat', 'esms'],
      })
    }
    // A ceiling under the Copper gate still leaves Copper reachable.
    for (const p of await run(rating => (rating === 99 ? 50 : 50.5))) {
      expect(p).toMatchObject({ nextTier: 'Copper', maxTier: 'Copper' })
    }
    // An aligned rating exactly on the next tier's stat gate is not blocked by the stat.
    for (const p of await run(() => 74)) {
      expect(p.blockedBy).toEqual(['esms'])
      expect(p.alignedRating).toBe(74)
    }
    // ...and one a hair under it is.
    for (const p of await run(() => 73.99)) expect(p.blockedBy).toEqual(['stat', 'esms'])
    // The alignment is reported to 2 dp (the contract's own means only ever make .0 and .5).
    for (const p of await run(rating => (rating === 99 ? 91 : 55.126))) {
      expect(p.alignedRating).toBe(55.13)
    }
    for (const p of await run(rating => (rating === 99 ? 91 : 55.124))) {
      expect(p.alignedRating).toBe(55.12)
    }
  })

  it('seals-surge: the stat gates, ESMS gates and Seal catalog are read from the contract', async () => {
    const gates = { Copper: 1, Silver: 2, Gold: 3, Astral: 4, Celestial: 5 }
    const esmsGates = { Copper: 10, Silver: 20, Gold: 30, Astral: 40, Celestial: 50 }
    const { seals } = await withContract(real => ({
      SEAL_STAT_GATES: gates,
      SEAL_ESMS_GATES: esmsGates,
      CANONICAL_SEAL_CATALOG: {
        ...real.CANONICAL_SEAL_CATALOG,
        power: { name: 'Stub Seal', category: 'spirit', description: 'stub' },
      },
    }))
    expect(seals.SEAL_TIER_REQUIREMENTS).toEqual({
      Copper: { minRating: 1, minBalance: 10 },
      Silver: { minRating: 2, minBalance: 20 },
      Gold: { minRating: 3, minBalance: 30 },
      Astral: { minRating: 4, minBalance: 40 },
      Celestial: { minRating: 5, minBalance: 50 },
    })
    expect(seals.SEAL_CATALOG[0]).toEqual({
      id: 'seal-power',
      name: 'Stub Seal',
      token: 'spirit',
      stat: 'power',
    })
    expect(seals.SEAL_CATALOG[1]).toMatchObject({ stat: 'resonance', name: 'Tidal Chorus' })

    // What blocks the next tier is read from the same gates: the stat clears 1, the balance not 10.
    for (const p of seals.evaluateSeals({ stats: uniformStats(0), esmsBalances: NO_BALANCES })) {
      expect(p).toMatchObject({ tier: null, nextTier: 'Copper', maxTier: 'Celestial' })
      expect(p.blockedBy).toEqual(['esms'])
    }
    // A balance of 10 clears Copper's ESMS gate exactly.
    const exact = seals.evaluateSeals({
      stats: uniformStats(0),
      esmsBalances: { spirit: 10, essence: 10, matter: 10, substance: 10 },
    })
    for (const p of exact) expect(p.blockedBy).toEqual([])
  })

  it('seals-surge: earnedSeals builds each Seal with the contract builder, from the stat and tier', async () => {
    const asked: unknown[][] = []
    const { seals } = await withContract(() => ({
      buildCanonicalSeal: (...args: unknown[]) => {
        asked.push(args)
        return { stub: args.join(':') }
      },
    }))
    const base = {
      id: 'seal-x',
      name: 'x',
      token: 'spirit' as const,
      nextTier: null,
      blockedBy: [],
      maxTier: 'Celestial' as const,
      statRating: 50,
      alignedRating: 50,
      balance: 1,
      natalAffinity: null,
    }
    const earned = seals.earnedSeals([
      { ...base, stat: 'wisdom', tier: 'Gold' },
      { ...base, stat: 'power', tier: null },
      { ...base, stat: 'vitality', tier: 'Copper' },
    ])
    expect(earned).toEqual([{ stub: 'wisdom:Gold' }, { stub: 'vitality:Copper' }])
    expect(asked).toEqual([
      ['wisdom', 'Gold'],
      ['vitality', 'Copper'],
    ])
  })

  it('seals-surge: the surge is the contract state, handed the meter, the ramp shares, the archetype and Monica', async () => {
    const asked: unknown[][] = []
    const STATE = { stub: 'contract surge state' }
    const { seals } = await withContract(() => ({
      evaluateSurgeState: (...args: unknown[]) => {
        asked.push(args)
        return STATE
      },
    }))
    const archetype = { primary: 'wisdom', secondary: 'charisma' } as const
    const plain = seals.calculateResonanceSurge(
      { thermodynamics: { heat: 0.25, reactivity: 0.75 }, monica: 1.2, archetype },
      UNIT
    )
    expect(plain).toEqual({ ...STATE, skyMeter: 50, harmonyOffset: 0 })
    expect(asked).toEqual([[50, 0.25, 0.75, 'wisdom', 'charisma', 1.2]])

    // ABSENT Monica reaches the contract as null, not undefined.
    asked.length = 0
    seals.calculateResonanceSurge(
      { thermodynamics: { heat: 0.25, reactivity: 0.75 }, archetype },
      UNIT
    )
    seals.calculateResonanceSurge(
      { thermodynamics: { heat: 0.25, reactivity: 0.75 }, monica: null, archetype },
      UNIT
    )
    expect(asked.map(args => args[5])).toEqual([null, null])

    // The natal harmony offset moves the meter the contract is given, and the meter is clamped.
    asked.length = 0
    const natalChart = chartWith('Fire', 10, 'computed')
    const sky = skyOf('Fire')
    const warm = seals.calculateResonanceSurge(
      { thermodynamics: { heat: 0.5, reactivity: 0.5 }, archetype, natalChart, sky },
      UNIT
    )
    const hot = seals.calculateResonanceSurge(
      { thermodynamics: { heat: 1, reactivity: 1 }, archetype, natalChart, sky },
      UNIT
    )
    expect(asked.map(args => args[0])).toEqual([62, 100])
    expect(warm).toMatchObject({ skyMeter: 50, harmonyOffset: 12 })
    expect(hot).toMatchObject({ skyMeter: 100, harmonyOffset: 12 })
  })

  it('pentacle-contest: the multipliers and the clamp are the contract ones', async () => {
    const { contest: mod } = await withContract(() => ({
      SEAL_TIER_MULTIPLIERS: { Copper: 2, Silver: 3, Gold: 4, Astral: 5, Celestial: 6 },
    }))
    expect(mod.SEAL_TIER_MULTIPLIERS).toEqual({
      Copper: 2,
      Silver: 3,
      Gold: 4,
      Astral: 5,
      Celestial: 6,
    })
    const zone = mod.ZONE_PROFILES[0]
    const stat = STAT_ORDER.find(s => CATALOG_PIN[s][1] === zone.esmsToken) as SacredStatKey
    const seal = (tier: SealTier): AlchemicalSeal => ({
      ...contract.buildCanonicalSeal(stat, tier),
      multiplier: 1,
    })
    const flat = uniformStats(50) as unknown as Record<SacredStatKey, number>
    // The weights of a zone sum to 1, so a flat vessel rates 50 before its Seals.
    expect(mod.effectiveContestRating({ ratings: flat, seals: [] }, zone.zoneId)).toBe(50)
    expect(mod.effectiveContestRating({ ratings: flat, seals: [seal('Gold')] }, zone.zoneId)).toBe(
      200
    )
    expect(
      mod.effectiveContestRating(
        { ratings: flat, seals: [seal('Copper'), seal('Celestial')] },
        zone.zoneId
      )
    ).toBe(300)

    const { contest: clamped } = await withContract(() => ({ clampStat: () => 70 }))
    expect(
      clamped.effectiveContestRating({ ratings: flat, seals: [] }, clamped.ZONE_PROFILES[0].zoneId)
    ).toBe(70)
  })

  it('vessel-payload: the faction of a contract pilot is the contract fixture faction', async () => {
    const { payload: mod } = await withContract(real => ({
      FIXTURE_AGENTS: [{ ...real.FIXTURE_AGENTS[0], key: 'isaac-newton', faction: 9 }],
    }))
    const newton = getHistoricalAgent('isaac-newton') as NonNullable<
      ReturnType<typeof getHistoricalAgent>
    >
    expect(mod.ratableFromRoster(newton).faction).toBe(9)
    // An agent that is not a pilot still follows the manifest roster; the pilot list is the mock's.
    const other = HISTORICAL_AGENTS.find(a => {
      const key = a.id.replace(/-\d+$/, '')
      return ROSTER_FACTION.get(key) !== undefined && key !== 'isaac-newton'
    }) as (typeof HISTORICAL_AGENTS)[number]
    expect(mod.ratableFromRoster(other).faction).toBe(
      ROSTER_FACTION.get(other.id.replace(/-\d+$/, ''))
    )
  })

  it('vessel-payload: ovr, archetype, Seals and surge of a built payload are the contract functions', async () => {
    const { payload: mod } = await withContract(real => ({
      computeOvr: () => 11,
      resolveArchetype: () => ({ title: 'Stub Title', primary: 'vitality', secondary: 'power' }),
      buildCanonicalSeal: (stat: SacredStatKey, tier: SealTier) => ({
        ...real.buildCanonicalSeal(stat, tier),
        description: `stub ${stat} ${tier}`,
      }),
      evaluateSurgeState: (...args: Parameters<ContractModule['evaluateSurgeState']>) => ({
        ...real.evaluateSurgeState(...args),
        heat: -123,
      }),
    }))
    const vessel = mod.ratableFromRoster(
      getHistoricalAgent('isaac-newton') as NonNullable<ReturnType<typeof getHistoricalAgent>>
    )
    const built = mod.buildRatedAgentPayload({
      vessel,
      balances: {
        agentId: 'isaac-newton',
        balances: { spirit: 1e6, essence: 1e6, matter: 1e6, substance: 1e6 },
        esmsSource: 'database',
      },
      sky: SKY_ACTIVE,
    })
    expect(built.ovr).toBe(11)
    expect(built.archetype).toEqual({
      title: 'Stub Title',
      primary: 'vitality',
      secondary: 'power',
    })
    expect(built.seals.length).toBeGreaterThan(0)
    for (const seal of built.seals) expect(seal.description).toMatch(/^stub /)
    expect(built.surge?.heat).toBe(-123)
    // The surge boosts the archetype the contract named, not a fixed pair.
    expect(built.surge?.statBoosts.vitality).toBe(16)
    expect(built.surge?.statBoosts.power).toBe(12)
    expect(mod.summarizeVessel(vessel)).toMatchObject({
      ovr: 11,
      archetype: { title: 'Stub Title' },
    })
  })
})

// ─── 6. Calibration diagnostics ──────────────────────────────────────────────

/** Measured over the live roster: the mean rating of each stat and each stat's primary count. */
const LIVE = (() => {
  const means = {} as Record<SacredStatKey, number>
  const primaries = {} as Record<SacredStatKey, number>
  for (const stat of STAT_ORDER) {
    means[stat] =
      ROSTER_RATED.reduce((sum, r) => sum + toRating(r.stats[stat], stat), 0) / ROSTER_RATED.length
    primaries[stat] = 0
  }
  for (const { stats } of ROSTER_RATED) primaries[rateStats(stats).archetype.primary]++
  return { means, primaries, size: ROSTER_RATED.length }
})()

describe('calibration diagnostics: the contract pinned roster numbers vs the live roster', () => {
  it('measures what it says it measures', () => {
    expect(LIVE.size).toBeGreaterThanOrEqual(70)
    for (const stat of STAT_ORDER) {
      expect(LIVE.means[stat]).toBeGreaterThanOrEqual(25)
      expect(LIVE.means[stat]).toBeLessThanOrEqual(99)
    }
    const total = STAT_ORDER.reduce((sum, stat) => sum + LIVE.primaries[stat], 0)
    expect(total).toBe(LIVE.size)
  })

  it('GLOBAL_ROSTER_MEAN is the mean of the seven contract means', () => {
    const mean =
      STAT_ORDER.reduce((sum, stat) => sum + contract.ROSTER_BASELINE_RATINGS[stat].mean, 0) /
      STAT_ORDER.length
    expect(contract.GLOBAL_ROSTER_MEAN).toBeCloseTo(mean, 10)
  })

  // DIAGNOSTIC, expected to FAIL today: the contract's per-stat means (76.5 / 67.0 / ...) are not
  // the live roster's mean RATING on the 25-99 scale (power: 81.6 live, 76.5 pinned; every stat is
  // at least 5 off). They are being used as given. WHEN THIS STARTS FAILING, re-measured baselines
  // landed in rating-contract.ts: delete the `.fails`.
  it.fails('every contract stat mean is within 2 of the live roster mean rating', () => {
    const off = STAT_ORDER.filter(
      stat => Math.abs(contract.ROSTER_BASELINE_RATINGS[stat].mean - LIVE.means[stat]) > 2
    )
    expect(off).toEqual([])
  })

  // DIAGNOSTIC, expected to FAIL today: because of the numbers above, `power` is the archetype
  // primary of 46 of 72 agents (64%) and the roster shares 18 distinct titles. A baseline that is
  // the roster's own would spread the primaries. WHEN THIS STARTS FAILING, the baselines were
  // re-measured: delete the `.fails`.
  it.fails('no stat is the archetype primary of more than 40% of the roster', () => {
    const share = Math.max(...STAT_ORDER.map(stat => LIVE.primaries[stat])) / LIVE.size
    expect(share).toBeLessThanOrEqual(0.4)
  })
})

describe("contract self-consistency (about #65's fixtures, not about this PR)", () => {
  it("the fixtures' relativeAdvantage, ovr and archetype stats follow the contract functions", () => {
    for (const fixture of contract.FIXTURE_AGENTS) {
      const advantage = contract.computeRelativeAdvantage(fixture.ratings)
      expect(fixture.relativeAdvantage, fixture.key).toEqual(advantage)
      expect(fixture.ovr, fixture.key).toBe(contract.computeOvr(fixture.ratings))
      const archetype = contract.resolveArchetype(advantage)
      expect([fixture.archetype.primary, fixture.archetype.secondary], fixture.key).toEqual([
        archetype.primary,
        archetype.secondary,
      ])
      expect(fixture.surge, fixture.key).toEqual(
        contract.evaluateSurgeState(
          fixture.surge.meter,
          fixture.surge.heat,
          fixture.surge.reactivity,
          fixture.archetype.primary,
          fixture.archetype.secondary,
          fixture.surge.monica
        )
      )
    }
  })

  // DIAGNOSTIC, expected to FAIL today: Newton's fixture title is 'Celestial Mechanist' where
  // resolveArchetype names wisdom:intuition 'Illuminated Sage', and Neo's is 'Apex Sovereign'
  // where it names charisma:vitality 'Indomitable Leader'. WHEN THIS STARTS FAILING, the fixtures
  // were corrected in rating-contract.ts: delete the `.fails`.
  it.fails("the fixtures' archetype titles are the ones resolveArchetype returns", () => {
    const off = contract.FIXTURE_AGENTS.filter(
      f => f.archetype.title !== contract.resolveArchetype(f.relativeAdvantage).title
    ).map(f => f.key)
    expect(off).toEqual([])
  })

  // DIAGNOSTIC, expected to FAIL today: the fixtures hand Celestial Seals to vessels holding
  // 24-96 ESMS, far under the 250 gate, and give Neo's vitality Silver where its own numbers
  // earn Gold. WHEN THIS STARTS FAILING, the fixtures were corrected: delete the `.fails`.
  it.fails(
    "the fixtures' seal tiers are the ones evaluateSealTier returns for their own numbers",
    () => {
      const off: string[] = []
      for (const f of contract.FIXTURE_AGENTS) {
        for (const seal of f.seals) {
          const stat = seal.statKey as SacredStatKey
          const tier = contract.evaluateSealTier(
            stat,
            f.ratings[stat],
            f.esms[seal.category as EsmsKey],
            false
          )
          if (tier !== seal.tier) off.push(`${f.key}/${stat}`)
        }
      }
      expect(off).toEqual([])
    }
  )

  // DIAGNOSTIC, expected to FAIL today: the manifest roster files Newton under the Moon (1) while
  // his contract fixture is Saturn (6); ASOL follows the fixture. WHEN THIS STARTS FAILING, the
  // two tables agree: delete the `.fails`.
  it.fails("the manifest roster and the fixtures agree on every pilot's faction", () => {
    const off = contract.FIXTURE_AGENTS.filter(f => {
      const roster = ROSTER_FACTION.get(f.key)
      return roster !== undefined && roster !== f.faction
    }).map(f => f.key)
    expect(off).toEqual([])
  })
})
