/**
 * Canonical Historical Likeness & Vessel Appearance Registry for the Pentacle Vessel
 * Rating Scale.
 *
 * ASOL owns the canonical look of its ~72 historical agents so the Pentacles game does not
 * have to guess. This module turns an agent into a `VesselAppearanceProfile`: an era, a head
 * silhouette (crown style plus three face proportions), a garment silhouette (mantle plus
 * collar), one signature relic, a four-colour palette, and a self-contained "astral cameo"
 * portrait as an SVG data URI. The string unions below are a cross-repo contract; add to
 * them, never rename.
 *
 * ## Pure and isomorphic
 *
 * No Node built-ins, no random source, no clock: every value is a function of the agent's id
 * and a few stable agent fields, through a seeded integer hash (FNV-1a with a murmur finaliser).
 * The same input is therefore byte-identical on every machine, in a browser and on a server,
 * which is what makes the profile safe to pin on-chain or cache forever. The portrait is built
 * with `encodeURIComponent` only, and uses no trigonometry, so it cannot differ between engines.
 *
 * Importing this module pulls in `HISTORICAL_AGENTS` (the registry is built eagerly from the
 * roster). A client that only needs the pure helpers and wants a lighter bundle should split
 * the registry out; that is a packaging choice, not a change to any value here.
 *
 * ## Pilots win, everything else is derived
 *
 * Four profiles are hand-authored and pinned by tests: Isaac Newton, Leonardo da Vinci, Emily
 * Dickinson and `user-avatar-neo` (the default custom vessel). The registry uses them verbatim.
 * `deriveVesselAppearance` is the algorithm only and never consults them, so calling it on
 * Newton's agent object does NOT return the pilot; use `getVesselAppearance` for the canonical
 * look of a roster id. The three pilot-named crowns (`newton-curls`, `da-vinci-beret-beard`,
 * `dickinson-parted-bun`) are reserved for the pilots and are never picked by the derivation.
 *
 * ## How the derivation chooses
 *
 *   • era        — birth year: before 1300 `ancient` (medieval included), 1300–1599
 *                  `renaissance`, 1600–1789 `enlightenment`, 1790–1899 `romantic`, 1900 on
 *                  `modern`. An unknown birth year is `astral`: no era claim is made.
 *   • crown, mantle, collar — a seeded pick from an era-appropriate set (`ERA_STYLE_POOLS`),
 *                  each with its own hash stream so adding a field never reshuffles another.
 *   • relic      — `ARCHETYPE_RELICS[rateAgent(agent).archetype.primary]`.
 *   • face       — three seeded numbers in [0, 1] (3 dp).
 *   • palette    — see below.
 *
 * ## Palette: the "dominant planet" and its colour family
 *
 * The agent type stores no dominant planet. The one place the repo derives something of that
 * name (`deriveAgentPlayStyle`) is Sun for 44 of 72 agents, which would paint 61% of the roster
 * in one family, so it is not used. Here the palette planet is the **ruler of the natal Sun's
 * sign** (`getRulingPlanet`, the repo's single ruler table), which spreads the 72-agent roster
 * across all ten planets (largest family, Venus, 22%). A `placeholder` or `unattributed` chart is stacked or
 * unsourced filler, so it never colours a real person's vessel: that agent gets a planet picked
 * from the seeded hash instead (`PaletteFamily.basis`). Each planet maps to a garment colour
 * (jittered per id), a trim in its alchemical metal, and a cameo stone (`PLANET_PALETTES`):
 *
 *   Sun gold · Moon silver · Mercury quicksilver · Venus copper · Mars iron · Jupiter tin ·
 *   Saturn lead · Uranus platinum · Neptune aquamarine · Pluto garnet.
 *
 * `skinOrMaterialToneHex` is a carved-stone tone, never a skin colour guessed for a real
 * person: the vessel is a cameo, and a hash must not assign anyone a complexion. The three
 * authored pilots use stone-like ivories for the same reason.
 *
 * `portraitUrl` mirrors the agent's own declared `/avatars/*` image when it has one (the
 * spec checks each one exists under `public/`); it is never invented, and `avatarModelUrl` is
 * left undefined because the repo ships no 3D avatar model.
 */
import type { CraftedAgent } from '@/lib/agent-types'
import { CANONICAL_SIGNS, getRulingPlanet } from '@/lib/astrological-data'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { PLANETS, isPlanet, type Planet } from '@/lib/agents/planetary-traits'
import { CORE_STAT_KEYS, rateAgent, type SacredStatKey } from './ovr-archetype'

// ─── The contract: string unions ─────────────────────────────────────────────

export const VESSEL_ERAS = [
  'ancient',
  'renaissance',
  'enlightenment',
  'romantic',
  'modern',
  'astral',
] as const
export type VesselEra = (typeof VESSEL_ERAS)[number]

export const CROWN_STYLES = [
  'newton-curls',
  'da-vinci-beret-beard',
  'dickinson-parted-bun',
  'sovereign-crest',
  'laurel-wreath',
  'scholar-hood',
  'astral-helm',
] as const
export type CrownStyle = (typeof CROWN_STYLES)[number]

export const MANTLE_STYLES = [
  'enlightenment-coat',
  'renaissance-drape',
  'victorian-shawl',
  'alchemical-vestments',
  'scholar-robe',
] as const
export type MantleStyle = (typeof MANTLE_STYLES)[number]

export const COLLAR_STYLES = [
  'high-cravat',
  'renaissance-collar',
  'lace-tippet',
  'astral-gorget',
  'none',
] as const
export type CollarStyle = (typeof COLLAR_STYLES)[number]

/** The four relics hand-authored for the pilots. */
export const PILOT_RELICS = [
  'prism-octahedron',
  'vitruvian-gyroscope',
  'herbarium-quill-lantern',
  'solar-astrolabe',
] as const

/** One relic per Sacred 7 stat, named for the Alchemical Seal that stat earns. */
export type ArchetypeRelic =
  | 'crucible-hammer'
  | 'tidal-tuning-fork'
  | 'philosophers-codex'
  | 'harmonic-signet'
  | 'scrying-lens'
  | 'quicksilver-caduceus'
  | 'verdant-thyrsus'

export type SignatureRelic = (typeof PILOT_RELICS)[number] | ArchetypeRelic

/** The relic an agent carries when its primary archetype stat is `key`. */
export const ARCHETYPE_RELICS: Readonly<Record<SacredStatKey, SignatureRelic>> = Object.freeze({
  power: 'crucible-hammer',
  resonance: 'tidal-tuning-fork',
  wisdom: 'philosophers-codex',
  charisma: 'harmonic-signet',
  intuition: 'scrying-lens',
  adaptability: 'quicksilver-caduceus',
  vitality: 'verdant-thyrsus',
})

export const SIGNATURE_RELICS: readonly SignatureRelic[] = Object.freeze([
  ...PILOT_RELICS,
  ...CORE_STAT_KEYS.map(key => ARCHETYPE_RELICS[key]),
])

export interface VesselAppearanceProfile {
  agentId: string
  era: VesselEra
  headSilhouette: {
    crownStyle: CrownStyle
    /** Each in [0, 1]. */
    faceProportion: { jawWidth: number; browDepth: number; cranialHeight: number }
  }
  garmentSilhouette: { mantleStyle: MantleStyle; collarStyle: CollarStyle }
  signatureRelic: SignatureRelic
  /** Each `'#rrggbb'`, lowercase. */
  paletteOverrides: {
    primaryGarmentHex: string
    secondaryTrimHex: string
    hairOrCrownHex: string
    skinOrMaterialToneHex: string
  }
  /** `'data:image/svg+xml;utf8,' + encodeURIComponent(svg)`: self-contained, no network. */
  portraitSvgDataUri: string
  /** Site-relative path of a real image under `public/`; absent unless the agent has one. */
  portraitUrl?: string
  /** No 3D avatar model ships in this repo, so this is never set here. */
  avatarModelUrl?: string
}

export type VesselPalette = VesselAppearanceProfile['paletteOverrides']

/** Everything the portrait is drawn from: a profile minus its id and its own output. */
export type PortraitInput = Pick<
  VesselAppearanceProfile,
  'era' | 'headSilhouette' | 'garmentSilhouette' | 'signatureRelic' | 'paletteOverrides'
>

type ProfileCore = PortraitInput & Pick<VesselAppearanceProfile, 'agentId'>

// ─── Seeded hash ─────────────────────────────────────────────────────────────

/** FNV-1a over UTF-16 code units. */
function fnv1a32(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

/** murmur3 finaliser: FNV alone leaves similar ids too correlated in their low bits. */
function mix32(value: number): number {
  let h = value
  h ^= h >>> 16
  h = Math.imul(h, 0x85ebca6b)
  h ^= h >>> 13
  h = Math.imul(h, 0xc2b2ae35)
  h ^= h >>> 16
  return h >>> 0
}

/** An independent 32-bit stream per (id, salt). The NUL keeps `a`+`bc` apart from `ab`+`c`. */
function seed32(id: string, salt: string): number {
  return mix32(fnv1a32(`${id}\u0000${salt}`))
}

/** A float in [0, 1). */
function unit(id: string, salt: string): number {
  return seed32(id, salt) / 0x100000000
}

/** A float in [−amplitude, +amplitude). */
function jitter(id: string, salt: string, amplitude: number): number {
  return (unit(id, salt) * 2 - 1) * amplitude
}

function pick<T>(list: readonly T[], id: string, salt: string): T {
  return list[seed32(id, salt) % list.length]
}

const round3 = (value: number): number => Math.round(value * 1000) / 1000

// ─── Colour ──────────────────────────────────────────────────────────────────

interface Hsl {
  h: number
  s: number
  l: number
}

const HEX = /^#[0-9a-f]{6}$/

const clamp = (value: number, low: number, high: number): number =>
  Math.min(high, Math.max(low, value))

function hslToHex({ h, s, l }: Hsl): string {
  const hue = ((h % 360) + 360) % 360
  const sat = clamp(s, 0, 100) / 100
  const lig = clamp(l, 0, 100) / 100
  const chroma = (1 - Math.abs(2 * lig - 1)) * sat
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const offset = lig - chroma / 2
  const sector = Math.floor(hue / 60)
  const [r, g, b] = (
    [
      [chroma, second, 0],
      [second, chroma, 0],
      [0, chroma, second],
      [0, second, chroma],
      [second, 0, chroma],
      [chroma, 0, second],
    ] as const
  )[sector % 6]
  const channel = (value: number): string =>
    clamp(Math.round((value + offset) * 255), 0, 255)
      .toString(16)
      .padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export interface PlanetPalette {
  /** A short family name, unique per planet. */
  family: string
  /** Base garment colour; each agent's own garment is this plus a seeded jitter. */
  garment: Hsl
  /** The planet's alchemical metal, used for trim and the frame. */
  trim: string
  /** The planet's cameo stone, used for the face and neck. */
  stone: string
}

/**
 * Planet → colour family. Metals follow the classical correspondences; the three outer
 * planets take a modern stand-in. Stones are mid-to-light so a face reads on every era field.
 */
export const PLANET_PALETTES: Readonly<Record<Planet, PlanetPalette>> = Object.freeze({
  Sun: {
    family: 'gold-saffron',
    garment: { h: 36, s: 62, l: 38 },
    trim: '#d4af37',
    stone: '#e6c98f',
  },
  Moon: {
    family: 'silver-pearl',
    garment: { h: 220, s: 22, l: 44 },
    trim: '#c0c8d4',
    stone: '#dfe6ee',
  },
  Mercury: {
    family: 'quicksilver-teal',
    garment: { h: 184, s: 38, l: 34 },
    trim: '#a9b7c6',
    stone: '#cfe0e0',
  },
  Venus: {
    family: 'copper-rose',
    garment: { h: 342, s: 40, l: 40 },
    trim: '#b87333',
    stone: '#efc9cf',
  },
  Mars: {
    family: 'iron-crimson',
    garment: { h: 4, s: 58, l: 36 },
    trim: '#8a8f98',
    stone: '#d9906f',
  },
  Jupiter: {
    family: 'tin-violet',
    garment: { h: 268, s: 38, l: 36 },
    trim: '#b9bec7',
    stone: '#cdb8e6',
  },
  Saturn: {
    family: 'lead-indigo',
    garment: { h: 228, s: 30, l: 28 },
    trim: '#6f7785',
    stone: '#b9a99a',
  },
  Uranus: {
    family: 'platinum-electric',
    garment: { h: 168, s: 44, l: 32 },
    trim: '#d9dde3',
    stone: '#a8dccb',
  },
  Neptune: {
    family: 'aquamarine-deep',
    garment: { h: 204, s: 52, l: 30 },
    trim: '#8fd0d6',
    stone: '#a9d3e6',
  },
  Pluto: {
    family: 'garnet-obsidian',
    garment: { h: 318, s: 34, l: 24 },
    trim: '#b0566f',
    stone: '#d8b4c0',
  },
})

/** The cameo's field colour per era. */
export const ERA_FIELD_HEX: Readonly<Record<VesselEra, string>> = Object.freeze({
  ancient: '#3a2e28',
  renaissance: '#40242a',
  enlightenment: '#1d2a45',
  romantic: '#35304a',
  modern: '#1f3b3c',
  astral: '#0f0d2b',
})

/** Lightness shift applied to the garment: pale linens early, dark broadcloth later. */
const ERA_LIGHTNESS: Readonly<Record<VesselEra, number>> = {
  ancient: 4,
  renaissance: 0,
  enlightenment: -4,
  romantic: -1,
  modern: 3,
  astral: -6,
}

/** Hair or crown colour per style; `garment` is the agent's own garment, `j` is in [−1, 1). */
const CROWN_COLOR: Readonly<Record<CrownStyle, (garment: Hsl, j: number) => Hsl>> = {
  'newton-curls': (_garment, j) => ({ h: 40 + j * 4, s: 12, l: 78 + j * 3 }),
  'da-vinci-beret-beard': (_garment, j) => ({ h: 18 + j * 4, s: 34, l: 24 + j * 3 }),
  'dickinson-parted-bun': (_garment, j) => ({ h: 22 + j * 4, s: 36, l: 25 + j * 3 }),
  'sovereign-crest': (garment, j) => ({
    h: garment.h + 10,
    s: Math.min(garment.s, 45),
    l: 62 + j * 4,
  }),
  'laurel-wreath': (_garment, j) => ({ h: 112 + j * 16, s: 38, l: 34 + j * 3 }),
  'scholar-hood': garment => ({ h: garment.h, s: garment.s, l: Math.max(8, garment.l - 10) }),
  'astral-helm': (_garment, j) => ({ h: 232 + j * 10, s: 30, l: 78 + j * 3 }),
}

function derivePalette(
  id: string,
  planet: Planet,
  era: VesselEra,
  crown: CrownStyle
): VesselPalette {
  const family = PLANET_PALETTES[planet]
  const garment: Hsl = {
    h: family.garment.h + jitter(id, 'garment-hue', 7),
    s: clamp(family.garment.s + jitter(id, 'garment-sat', 8), 12, 90),
    l: clamp(family.garment.l + ERA_LIGHTNESS[era] + jitter(id, 'garment-light', 4), 14, 66),
  }
  return {
    primaryGarmentHex: hslToHex(garment),
    secondaryTrimHex: family.trim,
    hairOrCrownHex: hslToHex(CROWN_COLOR[crown](garment, jitter(id, 'crown-tone', 1))),
    skinOrMaterialToneHex: family.stone,
  }
}

// ─── Era ─────────────────────────────────────────────────────────────────────

/**
 * Era from a birth year. Total over the integers (BCE included); a fractional year is floored.
 * `undefined`, `null` and non-finite input are `astral`: with no birth year there is no era to
 * claim, and a made-up one would be a made-up fact.
 */
export function eraForBirthYear(year: number | undefined): VesselEra {
  if (year === undefined || !Number.isFinite(year)) return 'astral'
  const whole = Math.floor(year)
  if (whole < 1300) return 'ancient'
  if (whole < 1600) return 'renaissance'
  if (whole < 1790) return 'enlightenment'
  if (whole < 1900) return 'romantic'
  return 'modern'
}

/** The year of an ISO-8601 prefix (`0069-…`, `-000287-…`, `+001643-…`), read as text. */
function yearFromIsoPrefix(text: string): number | undefined {
  const match = /^\s*([+-]?\d{4,6})-/.exec(text)
  return match ? Number(match[1]) : undefined
}

/**
 * The agent's birth year. A `Date` is read in local time, which is how the roster's
 * `new Date('1643-01-04T01:38:00')` literals were written (and what `derived-stats.ts`
 * does), so the year always matches the source text. Strings are read from their ISO prefix
 * rather than parsed, so a date-only string cannot slide a year across a time zone.
 */
function birthYearOf(agent: CraftedAgent): number | undefined {
  const raw: unknown = agent.birthData?.date
  if (raw instanceof Date) {
    const year = raw.getFullYear()
    if (Number.isFinite(year)) return year
  } else if (typeof raw === 'string') {
    const year = yearFromIsoPrefix(raw)
    if (year !== undefined) return year
  }
  return typeof agent.birthDate === 'string' ? yearFromIsoPrefix(agent.birthDate) : undefined
}

// ─── Era-appropriate style sets ──────────────────────────────────────────────

interface StylePool {
  crowns: readonly CrownStyle[]
  mantles: readonly MantleStyle[]
  collars: readonly CollarStyle[]
}

/**
 * What the derivation may pick from per era. The pilot-named crowns are absent on purpose.
 * `ancient` covers the medieval too, so it keeps to unstructured collars.
 */
export const ERA_STYLE_POOLS: Readonly<Record<VesselEra, StylePool>> = {
  ancient: {
    crowns: ['laurel-wreath', 'sovereign-crest', 'scholar-hood'],
    mantles: ['renaissance-drape', 'scholar-robe', 'alchemical-vestments'],
    collars: ['none'],
  },
  renaissance: {
    crowns: ['scholar-hood', 'laurel-wreath', 'sovereign-crest'],
    mantles: ['renaissance-drape', 'scholar-robe', 'alchemical-vestments'],
    collars: ['renaissance-collar', 'lace-tippet'],
  },
  enlightenment: {
    crowns: ['sovereign-crest', 'scholar-hood', 'laurel-wreath'],
    mantles: ['enlightenment-coat', 'scholar-robe', 'alchemical-vestments'],
    collars: ['high-cravat', 'lace-tippet'],
  },
  romantic: {
    crowns: ['sovereign-crest', 'scholar-hood', 'laurel-wreath'],
    mantles: ['victorian-shawl', 'enlightenment-coat', 'scholar-robe'],
    collars: ['high-cravat', 'lace-tippet', 'none'],
  },
  modern: {
    crowns: ['sovereign-crest', 'laurel-wreath', 'astral-helm'],
    mantles: ['enlightenment-coat', 'scholar-robe', 'alchemical-vestments'],
    collars: ['none', 'high-cravat', 'astral-gorget'],
  },
  astral: {
    crowns: ['astral-helm', 'sovereign-crest', 'laurel-wreath'],
    mantles: ['alchemical-vestments', 'scholar-robe'],
    collars: ['astral-gorget', 'none'],
  },
}

// ─── Validation ──────────────────────────────────────────────────────────────

const hasOwn = (object: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(object, key)

function isOneOf<T extends string>(list: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (list as readonly string[]).includes(value)
}

function assertId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || id.trim() === '') {
    throw new TypeError(`A vessel appearance needs a non-empty agent id, got ${String(id)}`)
  }
}

function assertPrimary(primary: unknown): asserts primary is SacredStatKey {
  if (!isOneOf(CORE_STAT_KEYS, primary)) {
    throw new RangeError(`Unknown Sacred 7 stat: ${String(primary)}`)
  }
}

function assertEra(era: unknown): asserts era is VesselEra {
  if (!isOneOf(VESSEL_ERAS, era)) throw new RangeError(`Unknown vessel era: ${String(era)}`)
}

/** Everything interpolated into the SVG is checked here, so a bad profile cannot inject markup. */
function validatePortraitInput(input: PortraitInput): void {
  assertEra(input.era)
  const { crownStyle, faceProportion } = input.headSilhouette
  if (!isOneOf(CROWN_STYLES, crownStyle)) throw new RangeError(`Unknown crown: ${crownStyle}`)
  const { mantleStyle, collarStyle } = input.garmentSilhouette
  if (!isOneOf(MANTLE_STYLES, mantleStyle)) throw new RangeError(`Unknown mantle: ${mantleStyle}`)
  if (!isOneOf(COLLAR_STYLES, collarStyle)) throw new RangeError(`Unknown collar: ${collarStyle}`)
  if (!isOneOf(SIGNATURE_RELICS, input.signatureRelic)) {
    throw new RangeError(`Unknown relic: ${input.signatureRelic}`)
  }
  for (const [name, value] of Object.entries(faceProportion)) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new RangeError(`Face proportion ${name} must be in [0, 1], got ${String(value)}`)
    }
  }
  for (const [name, value] of Object.entries(input.paletteOverrides)) {
    if (typeof value !== 'string' || !HEX.test(value)) {
      throw new RangeError(
        `Palette ${name} must be a lowercase #rrggbb colour, got ${String(value)}`
      )
    }
  }
}

// ─── Portrait: the astral cameo ──────────────────────────────────────────────

interface HeadShape {
  rx: number
  ry: number
  left: number
  right: number
  top: number
  bottom: number
}

const HEAD_CENTER_Y = 58

/** One decimal, no trailing zero: keeps the SVG short and identical on every engine. */
const r1 = (value: number): string => String(Math.round(value * 10) / 10)

const MANTLES: Readonly<Record<MantleStyle, (garment: string, trim: string) => string>> = {
  'enlightenment-coat': (g, t) =>
    `<path d="M8 128L16 104Q28 90 48 88L64 104L80 88Q100 90 112 104L120 128Z" fill="${g}"/>` +
    `<path d="M48 88L64 104L80 88M64 104V128" fill="none" stroke="${t}" stroke-width="2" stroke-dasharray="4 3"/>`,
  'renaissance-drape': (g, t) =>
    `<path d="M4 128Q6 100 36 92Q64 108 92 92Q122 100 124 128Z" fill="${g}"/>` +
    `<path d="M22 128L60 102" stroke="${t}" stroke-width="3"/>`,
  'victorian-shawl': (g, t) =>
    `<path d="M6 128L26 96Q64 120 102 96L122 128Z" fill="${g}"/>` +
    `<path d="M26 96Q64 120 102 96" fill="none" stroke="${t}" stroke-width="3" stroke-dasharray="2 3"/>`,
  'alchemical-vestments': (g, t) =>
    `<path d="M10 128Q12 98 44 90L64 100L84 90Q116 98 118 128Z" fill="${g}"/>` +
    `<path d="M56 100H72V128H56Z" fill="${t}"/><circle cx="64" cy="114" r="4" fill="${g}" stroke="${t}"/>`,
  'scholar-robe': (g, t) =>
    `<path d="M14 128L22 98Q38 86 64 92Q90 86 106 98L114 128Z" fill="${g}"/>` +
    `<path d="M64 92V128M16 122H112" stroke="${t}" stroke-width="2"/>`,
}

const COLLARS: Readonly<Record<CollarStyle, (trim: string) => string>> = {
  'high-cravat': t => `<path d="M53 86L64 104L75 86L64 90Z" fill="${t}"/>`,
  'renaissance-collar': t => `<ellipse cx="64" cy="89" rx="22" ry="6" fill="${t}"/>`,
  'lace-tippet': t =>
    `<path d="M42 90Q64 110 86 90" fill="none" stroke="${t}" stroke-width="5" stroke-dasharray="2 3"/>`,
  'astral-gorget': t => `<path d="M44 87Q64 108 84 87L84 93Q64 114 44 93Z" fill="${t}"/>`,
  none: () => '',
}

/** Crowns split into what sits behind the head and what sits over it. */
const CROWNS: Readonly<
  Record<
    CrownStyle,
    (head: HeadShape, crown: string, trim: string) => { back: string; front: string }
  >
> = {
  'newton-curls': (h, c) => ({
    back:
      `<g fill="${c}">` +
      (
        [
          [h.left - 3, 50, 7],
          [h.left - 5, 64, 7],
          [h.left - 3, 78, 6],
          [h.right + 3, 50, 7],
          [h.right + 5, 64, 7],
          [h.right + 3, 78, 6],
          [h.left + 6, h.top + 3, 8],
          [64, h.top - 1, 9],
          [h.right - 6, h.top + 3, 8],
        ] as const
      )
        .map(([x, y, r]) => `<circle cx="${r1(x)}" cy="${r1(y)}" r="${r}"/>`)
        .join('') +
      '</g>',
    front: '',
  }),
  'da-vinci-beret-beard': (h, c) => ({
    back: '',
    front:
      `<g fill="${c}"><ellipse cx="66" cy="${r1(h.top + 3)}" rx="${r1(h.rx + 6)}" ry="8"/>` +
      `<circle cx="64" cy="${r1(h.top - 5)}" r="3"/>` +
      `<path d="M${r1(h.left)} 64Q${r1(h.left + 1)} ${r1(h.bottom + 14)} 64 ${r1(h.bottom + 16)}` +
      `Q${r1(h.right - 1)} ${r1(h.bottom + 14)} ${r1(h.right)} 64Q64 ${r1(h.bottom - 6)} ${r1(h.left)} 64Z"/></g>`,
  }),
  'dickinson-parted-bun': (h, c) => ({
    back: `<circle cx="${r1(h.right - 1)}" cy="${r1(h.bottom - 3)}" r="7" fill="${c}"/>`,
    front:
      `<path d="M${r1(h.left - 1)} 56Q${r1(h.left - 2)} ${r1(h.top - 3)} 64 ${r1(h.top - 3)}` +
      `Q${r1(h.right + 2)} ${r1(h.top - 3)} ${r1(h.right + 1)} 56Q64 ${r1(h.top + 9)} ${r1(h.left - 1)} 56Z" fill="${c}"/>` +
      `<path d="M64 ${r1(h.top - 2)}V${r1(h.top + 9)}" stroke="#000000" stroke-opacity="0.3"/>`,
  }),
  'sovereign-crest': (h, c) => ({
    back: '',
    front:
      `<path d="M${r1(h.left)} ${r1(h.top + 9)}L${r1(h.left + 5)} ${r1(h.top - 9)}L${r1(h.left + 13)} ${r1(h.top + 1)}` +
      `L64 ${r1(h.top - 15)}L${r1(h.right - 13)} ${r1(h.top + 1)}L${r1(h.right - 5)} ${r1(h.top - 9)}` +
      `L${r1(h.right)} ${r1(h.top + 9)}Z" fill="${c}"/>`,
  }),
  'laurel-wreath': (h, c) => ({
    back: '',
    front:
      `<path d="M${r1(h.left - 1)} 62Q${r1(h.left - 6)} ${r1(h.top + 2)} 64 ${r1(h.top - 4)}` +
      `M${r1(h.right + 1)} 62Q${r1(h.right + 6)} ${r1(h.top + 2)} 64 ${r1(h.top - 4)}" ` +
      `fill="none" stroke="${c}" stroke-width="5" stroke-dasharray="5 2"/>`,
  }),
  'scholar-hood': (h, c) => ({
    back:
      `<path d="M${r1(h.left - 7)} ${r1(h.bottom)}Q${r1(h.left - 9)} ${r1(h.top - 9)} 64 ${r1(h.top - 11)}` +
      `Q${r1(h.right + 9)} ${r1(h.top - 9)} ${r1(h.right + 7)} ${r1(h.bottom)}Z" fill="${c}"/>`,
    front: '',
  }),
  'astral-helm': (h, c, t) => ({
    back: '',
    front:
      `<path d="M${r1(h.left - 2)} 60Q${r1(h.left - 3)} ${r1(h.top - 8)} 64 ${r1(h.top - 9)}` +
      `Q${r1(h.right + 3)} ${r1(h.top - 8)} ${r1(h.right + 2)} 60L${r1(h.right - 2)} 54` +
      `Q64 ${r1(h.top + 12)} ${r1(h.left + 2)} 54Z" fill="${c}"/>` +
      `<circle cx="64" cy="${r1(h.top - 1)}" r="3" fill="${t}"/>`,
  }),
}

/** Glyphs sit in a ±10 box inside a badge: stroked in the trim colour, a few filled. */
const RELIC_GLYPHS: Readonly<Record<SignatureRelic, (trim: string) => string>> = {
  'prism-octahedron': () => '<path d="M0 -10L8 0L0 10L-8 0ZM-8 0H8"/>',
  'vitruvian-gyroscope': t =>
    `<circle r="8"/><path d="M-8 0H8M0 -8V8"/><circle r="3" fill="${t}"/>`,
  'herbarium-quill-lantern': () =>
    '<path d="M-8 8L6 -9"/><rect x="-1" y="1" width="8" height="8"/>',
  'solar-astrolabe': t =>
    `<circle r="6"/><circle r="2" fill="${t}"/><path d="M0 -11V-8M0 8V11M-11 0H-8M8 0H11"/>`,
  'crucible-hammer': t => `<path d="M-8 -7H2V-2H-8Z" fill="${t}"/><path d="M-3 -2V9"/>`,
  'tidal-tuning-fork': () => '<path d="M-4 -9V1Q-4 5 0 5Q4 5 4 1V-9M0 5V10"/>',
  'philosophers-codex': () =>
    '<rect x="-7" y="-8" width="14" height="16"/><path d="M-3 -4H3M-3 0H3M-3 4H3"/>',
  'harmonic-signet': t => `<circle r="7" cy="2"/><path d="M-3 -9H3L0 -5Z" fill="${t}"/>`,
  'scrying-lens': t => `<ellipse rx="9" ry="5"/><circle r="2.5" fill="${t}"/>`,
  'quicksilver-caduceus': () => '<path d="M0 -10V10M-8 -6Q0 -10 8 -6M-3 -2Q3 0 -3 3Q3 6 0 8"/>',
  'verdant-thyrsus': t => `<path d="M0 10V-2"/><ellipse cy="-6" rx="3.5" ry="5" fill="${t}"/>`,
}

/**
 * The astral cameo as SVG source: a circular frame in the trim metal, an era-coloured field, a
 * garment, neck, collar, head and crown drawn from the profile, and the relic in a badge.
 * About 2 KB of markup. Validates its input first, because the palette is interpolated verbatim.
 */
export function renderPortraitSvg(input: PortraitInput): string {
  validatePortraitInput(input)
  const { era, headSilhouette, garmentSilhouette, signatureRelic, paletteOverrides: p } = input
  const { jawWidth, browDepth, cranialHeight } = headSilhouette.faceProportion

  const rx = 14 + jawWidth * 9
  const ry = 18 + cranialHeight * 9
  const head: HeadShape = {
    rx,
    ry,
    left: 64 - rx,
    right: 64 + rx,
    top: HEAD_CENTER_Y - ry,
    bottom: HEAD_CENTER_Y + ry,
  }
  const crown = CROWNS[headSilhouette.crownStyle](head, p.hairOrCrownHex, p.secondaryTrimHex)
  const neckTop = head.bottom - 6
  const field = ERA_FIELD_HEX[era]
  const trim = p.secondaryTrimHex

  const figure =
    MANTLES[garmentSilhouette.mantleStyle](p.primaryGarmentHex, trim) +
    crown.back +
    `<rect x="57" y="${r1(neckTop)}" width="14" height="${r1(96 - neckTop)}" fill="${p.skinOrMaterialToneHex}"/>` +
    COLLARS[garmentSilhouette.collarStyle](trim) +
    `<ellipse cx="64" cy="${HEAD_CENTER_Y}" rx="${r1(rx)}" ry="${r1(ry)}" fill="${p.skinOrMaterialToneHex}"/>` +
    `<path d="M${r1(head.left + 3)} ${r1(HEAD_CENTER_Y - ry * 0.18)}H${r1(head.right - 3)}" ` +
    `stroke="#000000" stroke-opacity="0.25" stroke-width="${r1(1 + browDepth * 3)}"/>` +
    crown.front

  const badge =
    `<g transform="translate(98 98)"><circle r="14" fill="${field}" stroke="${trim}" stroke-width="2"/>` +
    `<g fill="none" stroke="${trim}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `${RELIC_GLYPHS[signatureRelic](trim)}</g></g>`

  return (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128" ' +
    'role="img" aria-label="Astral cameo portrait">' +
    '<defs><clipPath id="c"><circle cx="64" cy="64" r="60"/></clipPath></defs>' +
    `<circle cx="64" cy="64" r="62" fill="${field}" stroke="${trim}" stroke-width="3"/>` +
    `<g clip-path="url(#c)">${figure}</g>${badge}</svg>`
  )
}

/** SVG source → `data:image/svg+xml;utf8,…`. Needs no Node built-in or base64 helper, so it runs anywhere. */
export function toSvgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

// ─── Building profiles ───────────────────────────────────────────────────────

/** Validate, draw and assemble in a fixed key order, so serialised profiles are stable. */
function assemble(
  core: ProfileCore,
  assets: { portraitUrl?: string; avatarModelUrl?: string } = {}
): VesselAppearanceProfile {
  assertId(core.agentId)
  const { agentId, era, headSilhouette, garmentSilhouette, signatureRelic, paletteOverrides } = core
  const profile: VesselAppearanceProfile = {
    agentId,
    era,
    headSilhouette,
    garmentSilhouette,
    signatureRelic,
    paletteOverrides,
    portraitSvgDataUri: toSvgDataUri(renderPortraitSvg(core)),
  }
  if (assets.portraitUrl !== undefined) profile.portraitUrl = assets.portraitUrl
  if (assets.avatarModelUrl !== undefined) profile.avatarModelUrl = assets.avatarModelUrl
  return profile
}

interface DerivationInput {
  agentId: string
  era: VesselEra
  primary: SacredStatKey
  planet: Planet
  portraitUrl?: string
}

function compose({
  agentId,
  era,
  primary,
  planet,
  portraitUrl,
}: DerivationInput): VesselAppearanceProfile {
  const pool = ERA_STYLE_POOLS[era]
  const crownStyle = pick(pool.crowns, agentId, 'crown')
  return assemble(
    {
      agentId,
      era,
      headSilhouette: {
        crownStyle,
        faceProportion: {
          jawWidth: round3(unit(agentId, 'face-jaw')),
          browDepth: round3(unit(agentId, 'face-brow')),
          cranialHeight: round3(unit(agentId, 'face-cranial')),
        },
      },
      garmentSilhouette: {
        mantleStyle: pick(pool.mantles, agentId, 'mantle'),
        collarStyle: pick(pool.collars, agentId, 'collar'),
      },
      signatureRelic: ARCHETYPE_RELICS[primary],
      paletteOverrides: derivePalette(agentId, planet, era, crownStyle),
    },
    { portraitUrl }
  )
}

export interface PaletteFamily {
  planet: Planet
  /** `sun-sign-ruler` from a usable natal chart; `seeded` when there was none to read. */
  basis: 'sun-sign-ruler' | 'seeded'
}

/**
 * Which planet's colour family an agent wears. A chart that is `placeholder` or `unattributed`
 * is filler and is ignored, exactly as the Alchemical Seals ignore it; so is a Sun whose sign
 * is missing or unrecognised.
 */
export function paletteFamilyOf(agent: CraftedAgent): PaletteFamily {
  assertId(agent.id)
  const chart = agent.consciousness?.natalChart
  const usable = chart && chart.provenance !== 'placeholder' && chart.provenance !== 'unattributed'
  const rawSign: unknown = usable ? chart.planets?.Sun?.sign : undefined
  const sign =
    typeof rawSign === 'string'
      ? CANONICAL_SIGNS.find(candidate => candidate.toLowerCase() === rawSign.trim().toLowerCase())
      : undefined
  if (sign) {
    const ruler = getRulingPlanet(sign)
    if (isPlanet(ruler)) return { planet: ruler, basis: 'sun-sign-ruler' }
  }
  return { planet: pick(PLANETS, agent.id, 'palette-planet'), basis: 'seeded' }
}

/** Only a same-origin `/avatars/<file>` path is mirrored; a URL, data URI or other path is not. */
const AVATAR_PATH = /^\/avatars\/[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp|svg)$/

function portraitUrlOf(agent: CraftedAgent): string | undefined {
  const avatar: unknown = agent.appearance?.avatar
  return typeof avatar === 'string' && AVATAR_PATH.test(avatar) ? avatar : undefined
}

/**
 * The algorithmic profile for an agent: deterministic, and never one of the pilots (see the
 * module header). Throws if the agent has no id or its stats cannot be rated.
 */
export function deriveVesselAppearance(agent: CraftedAgent): VesselAppearanceProfile {
  assertId(agent.id)
  return compose({
    agentId: agent.id,
    era: eraForBirthYear(birthYearOf(agent)),
    primary: rateAgent(agent).archetype.primary,
    planet: paletteFamilyOf(agent).planet,
    portraitUrl: portraitUrlOf(agent),
  })
}

/**
 * A profile for an agent with no registry entry and no chart to read (a created or user agent):
 * everything but the relic is seeded from the id, and the relic follows `primary`. `era` defaults
 * to `astral`, since such an agent has no birth year to place it. Never sets `portraitUrl`.
 */
export function appearanceFromSeed(
  agentId: string,
  primary: SacredStatKey,
  era: VesselEra = 'astral'
): VesselAppearanceProfile {
  assertId(agentId)
  assertPrimary(primary)
  assertEra(era)
  return compose({ agentId, era, primary, planet: pick(PLANETS, agentId, 'palette-planet') })
}

// ─── Pilots ──────────────────────────────────────────────────────────────────

const PILOT_CORES: readonly (ProfileCore & { portraitUrl?: string })[] = [
  {
    agentId: 'isaac-newton',
    era: 'enlightenment',
    headSilhouette: {
      crownStyle: 'newton-curls',
      faceProportion: { jawWidth: 0.48, browDepth: 0.72, cranialHeight: 0.66 },
    },
    garmentSilhouette: { mantleStyle: 'enlightenment-coat', collarStyle: 'high-cravat' },
    signatureRelic: 'prism-octahedron',
    // A dark broadcloth coat with brass trim, powdered-curl grey, ivory cameo stone.
    paletteOverrides: {
      primaryGarmentHex: '#2b2621',
      secondaryTrimHex: '#b5a642',
      hairOrCrownHex: '#d8d2c4',
      skinOrMaterialToneHex: '#e8d6b8',
    },
    portraitUrl: '/avatars/newton.png',
  },
  {
    agentId: 'leonardo-da-vinci',
    era: 'renaissance',
    headSilhouette: {
      crownStyle: 'da-vinci-beret-beard',
      faceProportion: { jawWidth: 0.62, browDepth: 0.6, cranialHeight: 0.56 },
    },
    garmentSilhouette: { mantleStyle: 'renaissance-drape', collarStyle: 'renaissance-collar' },
    signatureRelic: 'vitruvian-gyroscope',
    // Madder red drape, parchment-ochre trim, umber beret.
    paletteOverrides: {
      primaryGarmentHex: '#8f2f2c',
      secondaryTrimHex: '#c8a165',
      hairOrCrownHex: '#4a3528',
      skinOrMaterialToneHex: '#e2c8a4',
    },
    portraitUrl: '/avatars/leonardo-da-vinci.png',
  },
  {
    agentId: 'emily-dickinson',
    era: 'romantic',
    headSilhouette: {
      crownStyle: 'dickinson-parted-bun',
      faceProportion: { jawWidth: 0.36, browDepth: 0.42, cranialHeight: 0.5 },
    },
    garmentSilhouette: { mantleStyle: 'victorian-shawl', collarStyle: 'lace-tippet' },
    signatureRelic: 'herbarium-quill-lantern',
    // The white dress, muted sage trim, chestnut hair.
    paletteOverrides: {
      primaryGarmentHex: '#f2ede0',
      secondaryTrimHex: '#9aa393',
      hairOrCrownHex: '#4d3a2e',
      skinOrMaterialToneHex: '#efdcc8',
    },
    portraitUrl: '/avatars/emily-dickinson.png',
  },
  {
    // The default custom vessel: not a historical figure, so no portrait file and an astral era.
    agentId: 'user-avatar-neo',
    era: 'astral',
    headSilhouette: {
      crownStyle: 'astral-helm',
      faceProportion: { jawWidth: 0.5, browDepth: 0.55, cranialHeight: 0.62 },
    },
    garmentSilhouette: { mantleStyle: 'alchemical-vestments', collarStyle: 'astral-gorget' },
    signatureRelic: 'solar-astrolabe',
    // Deep indigo and aurum, an opal-pale cameo.
    paletteOverrides: {
      primaryGarmentHex: '#1d1a55',
      secondaryTrimHex: '#d9a441',
      hairOrCrownHex: '#ecd593',
      skinOrMaterialToneHex: '#d6d2ee',
    },
  },
]

// ─── The registry ────────────────────────────────────────────────────────────

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const child of Object.values(value)) deepFreeze(child)
  }
  return value
}

function buildRegistry(): Readonly<Record<string, VesselAppearanceProfile>> {
  const pilots: Record<string, VesselAppearanceProfile> = {}
  for (const { portraitUrl, ...core } of PILOT_CORES) {
    pilots[core.agentId] = assemble(core, { portraitUrl })
  }
  const registry: Record<string, VesselAppearanceProfile> = {}
  for (const agent of HISTORICAL_AGENTS) {
    if (hasOwn(registry, agent.id)) continue // first wins; the spec fails on a duplicate id
    registry[agent.id] = hasOwn(pilots, agent.id) ? pilots[agent.id] : deriveVesselAppearance(agent)
  }
  for (const id of Object.keys(pilots)) {
    if (!hasOwn(registry, id)) registry[id] = pilots[id]
  }
  return deepFreeze(registry)
}

/**
 * Every historical agent plus `user-avatar-neo`, deep-frozen. Look ids up with
 * `getVesselAppearance`: a bare index like `registry['constructor']` reaches the prototype.
 */
export const VESSEL_APPEARANCE_REGISTRY: Readonly<Record<string, VesselAppearanceProfile>> =
  buildRegistry()

/** The canonical profile for an exact agent id, or `undefined`. Never a prototype member. */
export function getVesselAppearance(agentId: string): VesselAppearanceProfile | undefined {
  return typeof agentId === 'string' && hasOwn(VESSEL_APPEARANCE_REGISTRY, agentId)
    ? VESSEL_APPEARANCE_REGISTRY[agentId]
    : undefined
}
