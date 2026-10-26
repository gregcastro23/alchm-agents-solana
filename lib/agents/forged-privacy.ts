/**
 * Privacy contract for user-forged vessels ("forged vessels").
 *
 * A forged vessel is a `historical_agents` row written by `/api/create-agent`
 * (`craftedBy: 'philosopher-stone-user'`). It carries a PERSON's private data:
 * the birth date, time, coordinates and place, the whole natal chart (every
 * body's sign AND degree, the ascendant, the houses) and the free text the
 * owner typed (about-yourself, life story, poetry, values). Canonical
 * historical figures are public figures; none of this applies to them.
 *
 * Every function here is an ALLOW-LIST projection: it builds the public value
 * from named, type-checked keys and never copies the input object. A
 * deny-list ("strip sourceCharts") silently fails open the next time a writer
 * adds a key, which is how `aura.sourceCharts` and `personalityCore` leaked
 * past the first redaction.
 *
 * Public by design for a non-entitled caller: the vessel's name and title, its
 * place name, its Sun sign, and the display scalars (colour, avatar, symbol,
 * element, level). Everything else is private to the creator, an admin, or a
 * server holding INTERNAL_API_SECRET.
 *
 * Pure and dependency-free so it is safe to import from client-reachable code
 * (no `node:` imports, no `@/lib/db`). It decides nothing about WHO is
 * entitled; callers pass that in. The contract, the doors it closes and the
 * one-off data scrub: docs/integrations/FORGED_VESSEL_PRIVACY.md.
 */

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

/** The columns that mark a `historical_agents` row (or its Railway twin) as a person's vessel. */
export interface ForgedRowMarkers {
  agentId?: string | null
  historicalEra?: string | null
  craftedBy?: string | null
  isUserCreated?: boolean | null
}

/** `historical_agents.craftedBy` of every row `/api/create-agent` writes. */
export const FORGED_CRAFTED_BY = 'philosopher-stone-user'

/** True for a row written for a person (forge) rather than a public figure. */
export function isUserCreatedAgentRow(row: ForgedRowMarkers): boolean {
  return (
    row.historicalEra === 'user_created' ||
    row.craftedBy === FORGED_CRAFTED_BY ||
    row.historicalEra === 'MONICA_SPECIAL' ||
    row.isUserCreated === true
  )
}

/**
 * Synthetic agents (planetary degrees, moon phases) are generated from the
 * sky, not from a person. The one definition: `lib/historical-agents-db.ts`
 * delegates to it.
 */
export function isSyntheticAgentId(id: string): boolean {
  if (!id) return false
  const lower = id.toLowerCase().trim()
  return (
    lower.startsWith('planetary-') ||
    lower.startsWith('moon-phase-') ||
    lower.startsWith('moon-agent-') ||
    lower.startsWith('planetary_')
  )
}

/** Extracts the location name from whatever shape birthLocation holds. */
export function extractLocationName(rawLocation: unknown): string | null {
  if (!rawLocation) return null
  if (typeof rawLocation === 'string') return nonEmptyString(rawLocation)
  if (isRecord(rawLocation)) {
    return nonEmptyString(rawLocation.name) ?? nonEmptyString(rawLocation.city)
  }
  return null
}

/**
 * Extracts the Sun sign from either the roster/fixture shape
 * (`{ planets: { Sun: { sign } } }`) or the forge shape
 * (`{ tropical: { CelestialBodies: { all: [{ label: "Sun", Sign: { label } }] } } }`).
 */
export function extractSunSign(rawChart: unknown): string | null {
  if (!isRecord(rawChart)) return null
  const chart = rawChart

  // 1. planets object or array
  if (chart.planets && typeof chart.planets === 'object') {
    const planets = chart.planets as JsonRecord
    const sun = (planets.Sun ?? planets.sun) as unknown
    if (isRecord(sun)) {
      const sign = nonEmptyString(sun.sign)
      if (sign) return sign
    }
    if (Array.isArray(chart.planets)) {
      const entry = chart.planets.find(
        (p: unknown) =>
          isRecord(p) &&
          ((typeof p.name === 'string' && p.name.toLowerCase() === 'sun') ||
            (typeof p.label === 'string' && p.label.toLowerCase() === 'sun'))
      ) as JsonRecord | undefined
      const sign = entry ? nonEmptyString(entry.sign) : null
      if (sign) return sign
    }
  }

  // 2. Direct Sun property
  const directSun = (chart.Sun ?? chart.sun) as unknown
  if (isRecord(directSun)) {
    const sign = nonEmptyString(directSun.sign)
    if (sign) return sign
  }

  // 3. Forge output with tropical.CelestialBodies
  if (isRecord(chart.tropical) && isRecord(chart.tropical.CelestialBodies)) {
    const cb = chart.tropical.CelestialBodies
    if (Array.isArray(cb.all)) {
      const sun = cb.all.find(
        (entry: unknown) =>
          isRecord(entry) && typeof entry.label === 'string' && entry.label.toLowerCase() === 'sun'
      ) as JsonRecord | undefined
      const signLabel = isRecord(sun?.Sign) ? nonEmptyString(sun.Sign.label) : null
      if (signLabel) return signLabel
    }
    const directCbSun = (cb.Sun ?? cb.sun) as unknown
    const signLabel =
      isRecord(directCbSun) && isRecord(directCbSun.Sign)
        ? nonEmptyString(directCbSun.Sign.label)
        : null
    if (signLabel) return signLabel
  }

  return null
}

/**
 * The public natal chart: the Sun sign and nothing else. Degrees, ascendant,
 * houses, aspects and every other body are private.
 */
export function projectPublicNatalChart(
  rawChart: unknown
): { planets: { Sun: { sign: string } } } | null {
  const sunSign = extractSunSign(rawChart)
  if (!sunSign) return null
  return { planets: { Sun: { sign: sunSign } } }
}

/** The public birth data: the place NAME only. No date, time, coordinates or country code. */
export function projectPublicBirthData(rawLocation: unknown): { location: { name: string } } {
  return { location: { name: extractLocationName(rawLocation) ?? 'Unknown' } }
}

/**
 * The keys of `personalityCore` a stranger may see. `essence` is the owner's
 * stated purpose (already the public title) or a generated element phrase;
 * `temperament` is the generated attunement style. `expression` and `emotion`
 * are deliberately NOT here: when the owner supplied personal context the
 * forge overwrites both with their raw about-yourself and values text, so a
 * stored value cannot be told apart from a generated one. `lifeStory`,
 * `poetry` and `userProvidedContext` are the owner's own words.
 */
export const PUBLIC_PERSONALITY_CORE_KEYS = ['essence', 'temperament'] as const

export function projectPublicPersonalityCore(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!isRecord(raw)) return out
  for (const key of PUBLIC_PERSONALITY_CORE_KEYS) {
    const value = raw[key]
    if (typeof value === 'string' && value.trim()) out[key] = value
  }
  return out
}

/**
 * The keys of `aura` the UI reads (`aura.color`, `aura.type`, `aura.intensity`).
 * Anything else is private: the forge used to persist the whole synthesis, so a
 * stored aura can hold `sourceCharts`, the owner's complete birth chart.
 */
export const PUBLIC_AURA_KEYS = ['type', 'color', 'intensity'] as const

export interface PublicAura {
  type?: string
  color?: string
  intensity?: number
}

/** `null` for a missing aura, an object holding only well-typed public keys otherwise. */
export function projectPublicAura(raw: unknown): PublicAura | null {
  if (!isRecord(raw)) return null
  const out: PublicAura = {}
  if (typeof raw.type === 'string') out.type = raw.type
  if (typeof raw.color === 'string') out.color = raw.color
  if (typeof raw.intensity === 'number' && Number.isFinite(raw.intensity)) {
    out.intensity = raw.intensity
  }
  return out
}

/**
 * What the forge may store in `historical_agents.aura`: scalars only. The
 * chart synthesis (`sourceCharts`, `dominantInfluence`, ...) stays out of the
 * row; the birth chart has its own column (`natalChart`), which is private.
 */
export interface PersistedAura {
  monicaConstant?: number
  consciousness?: { spirit: number; essence: number; matter: number; substance: number }
  color?: string
  intensity?: number
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

export function toPersistedAura(synthesis: unknown): PersistedAura {
  const out: PersistedAura = {}
  if (!isRecord(synthesis)) return out

  const monica = finiteNumber(synthesis.monicaConstant)
  if (monica !== null) out.monicaConstant = monica

  if (isRecord(synthesis.consciousness)) {
    const c = synthesis.consciousness
    const spirit = finiteNumber(c.spirit)
    const essence = finiteNumber(c.essence)
    const matter = finiteNumber(c.matter)
    const substance = finiteNumber(c.substance)
    if (spirit !== null && essence !== null && matter !== null && substance !== null) {
      out.consciousness = { spirit, essence, matter, substance }
    }
  }

  // `synthesis.type` is the chart-synthesis kind ('birth-moment', ...), not an aura style, so
  // it is not carried over; only a display colour and intensity are.
  if (typeof synthesis.color === 'string') out.color = synthesis.color
  const intensity = finiteNumber(synthesis.intensity)
  if (intensity !== null) out.intensity = intensity

  return out
}

/** A JSON column that should hold `{ [name]: number }` (evolution values, IV snapshot). */
export function projectNumberRecord(raw: unknown): Record<string, number> | null {
  if (!isRecord(raw)) return null
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw).slice(0, 64)) {
    const n = finiteNumber(value)
    if (n !== null && /^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) out[key] = n
  }
  return out
}

/** A JSON column that should hold a short list of labels (gifts, shadows, challenges, domains). */
export function projectStringList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((item): item is string => typeof item === 'string' && item.trim() !== '')
    .slice(0, 50)
    .map(item => item.slice(0, 200))
}
