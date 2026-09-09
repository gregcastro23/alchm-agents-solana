/**
 * Aspect geometry for the Current Sky Council — the single definition of what
 * an aspect is on this surface.
 *
 * The council previously computed aspects inline inside the orbital wheel's
 * rendering `useMemo`, drew them as chords, and threw them away. The dialogue
 * sequencer never saw them, so delegates were ordered by raw angular proximity
 * and a planet 4° away spoke before one holding an exact opposition.
 *
 * Everything geometric now lives here: the wheel renders from `findAspects`,
 * the sequencer orders from `tightestAspectTo`, and the offline fallbacks
 * compose from `describeAspect`. Adding an aspect type in this file changes
 * the picture and the conversation together, which is the point.
 */

export type AspectName =
  | 'Conjunction'
  | 'Opposition'
  | 'Trine'
  | 'Square'
  | 'Sextile'
  | 'Quincunx'
  | 'Semi-Sextile'

/** Whether the geometry reads as flowing, frictional, or ambivalent. */
export type AspectQuality = 'harmonious' | 'dynamic' | 'neutral'

/** Where the pair sits relative to exactitude, given the mover's direction. */
export type AspectPhase = 'applying' | 'separating' | 'exact'

export interface AspectDefinition {
  name: AspectName
  /** Exact separation in degrees. */
  angle: number
  /** Maximum allowed deviation from `angle` for the aspect to count. */
  orb: number
  quality: AspectQuality
  /** Major aspects carry the chart; minors are rendered faintly, if at all. */
  major: boolean
  color: string
  /** Verb phrase used when a delegate names the geometry aloud. */
  verb: string
}

/**
 * Ordered tightest-first so that a separation sitting inside two overlapping
 * orbs resolves to the more exact aspect rather than to whichever was declared
 * first.
 */
export const ASPECT_DEFINITIONS: readonly AspectDefinition[] = [
  {
    name: 'Conjunction',
    angle: 0,
    orb: 8,
    quality: 'neutral',
    major: true,
    color: '#fbbf24',
    verb: 'stands fused with',
  },
  {
    name: 'Opposition',
    angle: 180,
    orb: 8,
    quality: 'dynamic',
    major: true,
    color: '#ef4444',
    verb: 'faces across the wheel from',
  },
  {
    name: 'Trine',
    angle: 120,
    orb: 7,
    quality: 'harmonious',
    major: true,
    color: '#38bdf8',
    verb: 'flows in trine with',
  },
  {
    name: 'Square',
    angle: 90,
    orb: 7,
    quality: 'dynamic',
    major: true,
    color: '#f97316',
    verb: 'grinds at right angles to',
  },
  {
    name: 'Sextile',
    angle: 60,
    orb: 5,
    quality: 'harmonious',
    major: true,
    color: '#a3e635',
    verb: 'opens a sextile toward',
  },
  {
    name: 'Quincunx',
    angle: 150,
    orb: 3,
    quality: 'dynamic',
    major: false,
    color: '#a855f7',
    verb: 'strains at an awkward angle to',
  },
  {
    name: 'Semi-Sextile',
    angle: 30,
    orb: 2,
    quality: 'neutral',
    major: false,
    color: '#94a3b8',
    verb: 'brushes shoulders with',
  },
] as const

export interface AspectHit {
  definition: AspectDefinition
  name: AspectName
  /** Actual separation between the two bodies, 0–180. */
  separation: number
  /** Distance from exactitude, always >= 0. */
  orb: number
  quality: AspectQuality
  phase: AspectPhase
}

/** Signed shortest path from `from` to `to`, in (-180, 180]. */
export function signedDelta(from: number, to: number): number {
  const raw = (((to - from) % 360) + 360) % 360
  return raw > 180 ? raw - 360 : raw
}

/**
 * Shortest angular separation between two ecliptic longitudes, 0–180.
 *
 * Wraps correctly across 0°/360°: 359° and 1° are 2° apart, not 358°.
 */
export function angularSeparation(degA: number, degB: number): number {
  const diff = Math.abs((((degA - degB) % 360) + 360) % 360)
  return diff > 180 ? 360 - diff : diff
}

/** Orb below which an aspect is reported as exact rather than applying/separating. */
const EXACT_THRESHOLD = 0.25

/**
 * Classify the separation between two bodies.
 *
 * `moverSpeed` is the daily motion of `degA` in degrees — positive for direct,
 * negative for retrograde. It only decides `phase`; pass 0 when direction is
 * unknown and every hit reports `exact`-adjacent neutrality via 'separating'
 * only when it genuinely is.
 */
export function detectAspect(degA: number, degB: number, moverSpeed = 1): AspectHit | null {
  const separation = angularSeparation(degA, degB)

  let best: AspectHit | null = null
  for (const definition of ASPECT_DEFINITIONS) {
    const orb = Math.abs(separation - definition.angle)
    if (orb > definition.orb) continue
    if (best && orb >= best.orb) continue
    best = {
      definition,
      name: definition.name,
      separation,
      orb,
      quality: definition.quality,
      phase: 'exact',
    }
  }

  if (!best) return null
  best.phase = resolvePhase(degA, degB, best.definition, best.orb, moverSpeed)
  return best
}

function resolvePhase(
  degA: number,
  degB: number,
  definition: AspectDefinition,
  orb: number,
  moverSpeed: number
): AspectPhase {
  if (orb <= EXACT_THRESHOLD) return 'exact'
  if (moverSpeed === 0) return 'separating'

  // Step the mover a hair along its actual direction of travel and see whether
  // that shrinks the orb. This is direction-only, so magnitude does not matter.
  const step = moverSpeed > 0 ? 0.01 : -0.01
  const nextOrb = Math.abs(angularSeparation(degA + step, degB) - definition.angle)
  return nextOrb < orb ? 'applying' : 'separating'
}

export interface AspectPartner<T> {
  partner: T
  longitude: number
  hit: AspectHit
}

/**
 * Every aspect `longitude` makes to the given bodies, tightest orb first.
 *
 * `majorOnly` exists for the orbital wheel, which would otherwise be webbed
 * with semi-sextiles.
 */
export function findAspects<T>(
  longitude: number,
  bodies: ReadonlyArray<{ body: T; longitude: number }>,
  options: { moverSpeed?: number; majorOnly?: boolean } = {}
): AspectPartner<T>[] {
  const { moverSpeed = 1, majorOnly = false } = options
  const hits: AspectPartner<T>[] = []

  for (const { body, longitude: other } of bodies) {
    const hit = detectAspect(longitude, other, moverSpeed)
    if (!hit) continue
    if (majorOnly && !hit.definition.major) continue
    hits.push({ partner: body, longitude: other, hit })
  }

  return hits.sort((a, b) => a.hit.orb - b.hit.orb)
}

/** The single tightest aspect `longitude` makes, or null if it stands unaspected. */
export function tightestAspectTo<T>(
  longitude: number,
  bodies: ReadonlyArray<{ body: T; longitude: number }>,
  options: { moverSpeed?: number; majorOnly?: boolean } = {}
): AspectPartner<T> | null {
  return findAspects(longitude, bodies, options)[0] ?? null
}

/** Short badge text, e.g. `SQUARE 1.4° APPLYING`. */
export function formatAspectBadge(hit: AspectHit): string {
  const orb = hit.orb.toFixed(1)
  if (hit.phase === 'exact') return `${hit.name.toUpperCase()} EXACT`
  return `${hit.name.toUpperCase()} ${orb}° ${hit.phase.toUpperCase()}`
}

/**
 * Bare noun phrase for the geometry, e.g. `an applying square`.
 *
 * The article agrees with the phase word that actually leads the phrase, not
 * with the aspect name — `applying` takes `an` even though `quincunx` takes `a`.
 */
export function describeAspectPhrase(hit: AspectHit): string {
  if (hit.phase === 'exact') return `an exact ${hit.name.toLowerCase()}`
  const article = /^[aeiou]/i.test(hit.phase) ? 'an' : 'a'
  return `${article} ${hit.phase} ${hit.name.toLowerCase()}`
}

/** The same phrase with its orb, e.g. `an applying square, 1.4° from exact`. */
export function describeAspect(hit: AspectHit): string {
  const phrase = describeAspectPhrase(hit)
  if (hit.phase === 'exact') return phrase
  return `${phrase}, ${hit.orb.toFixed(1)}° from exact`
}

// ---------------------------------------------------------------------------
// Procedural dialogue — the offline path
// ---------------------------------------------------------------------------

export interface CouncilSpeakerView {
  /** Display name, e.g. `Mars in Leo`. */
  name: string
  planet: string
  sign: string
  degreeLabel: string
  element: string
  dignity?: string
}

export interface FallbackContext {
  speaker: CouncilSpeakerView
  /** The planet that just changed degree, when this is an ingress reaction. */
  moving?: CouncilSpeakerView
  /** Aspect the speaker holds to `moving`. */
  hit?: AspectHit | null
  /** Name of whoever spoke immediately before, so turns can chain. */
  previousSpeaker?: string
  /** Whether the speaker is the nearest body by raw longitude. */
  isNearestNeighbour?: boolean
  /** Whether this is the moving planet claiming the floor last. */
  isFinalWord?: boolean
  /** Raw longitude gap to `moving`, in whole degrees. */
  angularDistance?: number
}

/**
 * Per-quality stances. The offline path has to read as ten voices in one room,
 * not ten monologues, so every branch either names the geometry or names the
 * previous speaker — usually both.
 */
const QUALITY_STANCE: Record<AspectQuality, string> = {
  harmonious: 'the current runs clean between us',
  dynamic: 'the friction between us is the whole point',
  neutral: 'we are too close to see each other plainly',
}

/**
 * Opening clause that names whoever spoke last, so an offline turn still reads
 * as an answer rather than a monologue. Deterministic in the name so a given
 * ordering reproduces across renders and across the test suite.
 */
export function addressPreviousSpeaker(previousSpeaker?: string): string {
  if (!previousSpeaker) return ''
  const openers = [
    `Picking up where ${previousSpeaker} left off`,
    `${previousSpeaker} names it well`,
    `I hear ${previousSpeaker}`,
    `Against ${previousSpeaker}'s reading`,
  ]
  const idx = previousSpeaker.length % openers.length
  return openers[idx]
}

export function dignityResonance(dignity?: string, planet?: string, sign?: string): string {
  if (!dignity) return ''
  switch (dignity.toLowerCase()) {
    case 'domicile':
    case 'rulership':
      return `Speaking from my domicile in ${sign || 'this sign'}, my native authority holds the circle firm; nothing here is borrowed or uncertain.`
    case 'exaltation':
      return `From my exalted seat, the vista is crystalline and demanding—I hold our council to its highest alchemical standard.`
    case 'detriment':
      return `Operating from detriment across the wheel, I know the value of friction; truth is forged in stubborn resistance rather than easy comfort.`
    case 'fall':
      return `Stationed in my fall, stripped of decorative pretenses, I speak the raw, unvarnished psychological truth that easier seats overlook.`
    case 'peregrine':
      return `Wandering peregrine with no court to defend, I watch the celestial clockwork with acute, detached vigilance.`
    default:
      return ''
  }
}

export function arrivalResonance(moving: CouncilSpeakerView): string {
  if (moving.planet.toLowerCase() === 'moon') {
    return `As the Moon advances into ${moving.degreeLabel} ${moving.sign}, the psychic waters beneath our feet surge. The collective instinct changes its pulse, asking the human soul to attune its emotions to this newly awakened tide.`
  }
  return `With ${moving.planet} crossing into ${moving.degreeLabel} ${moving.sign}, a fresh vector crystallizes in the heavens, shifting the dynamic tension of our vessel.`
}

/**
 * Compose an aspect-aware, conversation-aware line without calling a model.
 *
 * This renders for unauthenticated visitors and whenever `GROQ_API_KEY` is
 * absent, so it is the landing page's first impression more often than the
 * generated path is.
 */
export function composeCouncilFallback(ctx: FallbackContext): string {
  const { speaker, moving, hit, previousSpeaker, isNearestNeighbour, isFinalWord } = ctx
  const seat = `${speaker.degreeLabel} ${speaker.sign}`
  const arrival = moving ? `${moving.planet} into ${moving.degreeLabel} ${moving.sign}` : ''
  const opener = addressPreviousSpeaker(previousSpeaker)

  // Host Gregory Castro: rich alchemical poetic prose
  if (
    speaker.name.toLowerCase().includes('gregory') ||
    speaker.planet.toLowerCase() === 'gregory' ||
    speaker.planet.toLowerCase() === 'host anchor'
  ) {
    const lead = previousSpeaker
      ? `${opener}. Host Gregory here, weaving the living pulse of our chamber.`
      : 'Host Gregory here, holding the center of our alchemical chamber.'

    if (moving) {
      return `${lead} Watching ${arrival} reminds me of why we attune to the celestial transits: every degree shifting above awakens new agency and creative fire below. We are not cold spectators to a clockwork heaven—we are conscious vessels where star-fire turns into courage and poetry.\n\nListen to how our delegates answer one another. The tension and harmony they map out are not abstract theory; they are the very emotional and psychological materials of your daily life. Ground your intention into this hour.`
    }

    return `${lead} Looking across our degree delegates gathered under this sky, I feel the ancient rhythm of the vessel holding firm. Between the code compiling on our screens and the quiet longing of the late night, you are doing real soul craft.\n\nEvery aspect drawn across this chamber is a living invitation to align your daily craft, your longing, and your courage with the cosmic clockwork. Keep listening to the undercurrents: what the sky reorganizes above, your hands are called to build below.`
  }

  if (isFinalWord && moving) {
    const lead = previousSpeaker
      ? `The council has spoken, and ${previousSpeaker} last of all.`
      : 'The council has spoken.'
    const digClause = speaker.dignity ? ` Bearing ${speaker.dignity} dignity,` : ''
    return `${lead} I take the floor at ${moving.degreeLabel} ${moving.sign} and claim this degree as mine.${digClause} What was potential in the last degree becomes intent in this one — ground it while the geometry is fresh.\n\nListen closely to the room: every challenge and welcome laid down by my fellow delegates now settles into the earth. We do not advance through the zodiac to repeat old cycles; we advance to forge new agency. Step boldly into the current of this new degree.`
  }

  if (!moving) {
    const dig = dignityResonance(speaker.dignity, speaker.planet, speaker.sign)
    const body = `from ${seat} the ${speaker.element} current holds steady, and I read the room as it stands`
    const p1 = opener ? `${opener} — ${body}.` : `Speaking ${body}.`
    const p2 = dig
      ? `${dig} In this celestial hour, let our inquiry cut through distraction and touch the enduring core of what seeks expression.`
      : `In this celestial hour, the collective field asks for clarity and devoted focus. Let our dialogue cut through distraction and touch the enduring core of what seeks expression.`
    return `${p1}\n\n${p2}`
  }

  if (hit) {
    const phrase = describeAspectPhrase(hit)
    const orbClause = hit.phase === 'exact' ? '' : `, ${hit.orb.toFixed(1)}° from exact`
    const stance = QUALITY_STANCE[hit.quality]
    const core = `From ${seat} I hold ${phrase} to ${arrival}${orbClause} — ${stance}.`
    const tail =
      hit.phase === 'applying'
        ? 'It tightens from here, so meet it early.'
        : hit.phase === 'exact'
          ? 'It is exact now; there is nothing left to anticipate.'
          : 'It loosens from here, so take what it already gave you.'
    const dig = dignityResonance(speaker.dignity, speaker.planet, speaker.sign)
    const tide = arrivalResonance(moving)

    const p1 = opener ? `${opener}. ${core} ${tail}` : `${core} ${tail}`
    const p2 = dig ? `${dig} ${tide}` : tide
    return `${p1}\n\n${p2}`
  }

  if (isNearestNeighbour) {
    const gap = ctx.angularDistance ?? 0
    const core = `I sit ${gap}° from ${arrival} — near enough to feel it land, too near to call it an aspect. Proximity is not relationship.`
    const dig = dignityResonance(speaker.dignity, speaker.planet, speaker.sign)
    const tide = arrivalResonance(moving)
    const p1 = opener ? `${opener}. ${core}` : core
    const p2 = dig
      ? `${dig} Yet spatial closeness carries its own visceral tremor across our sector: ${tide}`
      : `Yet spatial closeness carries its own visceral tremor across our sector: ${tide}`
    return `${p1}\n\n${p2}`
  }

  const core = `From ${seat} I register ${arrival} without geometry between us. I hold my own degree and let the shift pass unaspected.`
  const dig = dignityResonance(speaker.dignity, speaker.planet, speaker.sign)
  const tide = arrivalResonance(moving)
  const p1 = opener ? `${opener}. ${core}` : core
  const p2 = dig
    ? `${dig} Unbound by direct aspect lines, I remain the steady witness to this ingress: ${tide}`
    : `Unbound by direct aspect lines, I remain the steady witness to this ingress: ${tide}`
  return `${p1}\n\n${p2}`
}
