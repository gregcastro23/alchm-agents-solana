import { describe, it, expect } from 'vitest'
import {
  ASPECT_DEFINITIONS,
  addressPreviousSpeaker,
  angularSeparation,
  composeCouncilFallback,
  describeAspect,
  describeAspectPhrase,
  detectAspect,
  findAspects,
  formatAspectBadge,
  signedDelta,
  tightestAspectTo,
} from '@/lib/agents/council/aspect-dialogue-engine'
import {
  buildPlanetaryPersonaBlock,
  planetFromCouncilKey,
  PLANETARY_VOICES,
} from '@/lib/agents/council/planetary-personas'
import {
  generateIngressReactionFallback,
  generateSpontaneousCouncilResponse,
  lastSpeakerFrom,
  orderIngressSpeakers,
  recentTurnsFrom,
  signToLongitude,
  type BasketAgentConfig,
  type BasketAgentKey,
  type ChatMessage,
} from '@/components/landing/current-promotional-thread'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function agent(
  key: BasketAgentKey,
  planet: string,
  sign: string,
  degree: number,
  overrides: Partial<BasketAgentConfig> = {}
): BasketAgentConfig {
  return {
    key,
    name: `${planet} Agent`,
    title: planet,
    planet,
    sign,
    degree,
    degreeLabel: `${degree}°`,
    absoluteDegree: signToLongitude(sign, degree),
    dignity: 'neutral',
    retrograde: false,
    element: 'fire',
    glyph: '•',
    callSign: planet.toUpperCase(),
    color: '#fff',
    borderColor: '',
    bgGlow: '',
    avatarBg: '',
    forceVector: '',
    quote: '',
    ...overrides,
  }
}

function msg(senderName: string, content: string, extra: Partial<ChatMessage> = {}): ChatMessage {
  return { id: senderName, senderName, content, timestamp: '12:00 PM', ...extra }
}

// ---------------------------------------------------------------------------
// Aspect geometry
// ---------------------------------------------------------------------------

describe('angularSeparation', () => {
  it('wraps across the 0°/360° boundary', () => {
    expect(angularSeparation(359, 1)).toBe(2)
    expect(angularSeparation(1, 359)).toBe(2)
    expect(angularSeparation(350, 10)).toBe(20)
  })

  it('never exceeds 180°', () => {
    for (let a = 0; a < 360; a += 7) {
      for (let b = 0; b < 360; b += 11) {
        const sep = angularSeparation(a, b)
        expect(sep).toBeGreaterThanOrEqual(0)
        expect(sep).toBeLessThanOrEqual(180)
      }
    }
  })

  it('normalises negative and out-of-range longitudes', () => {
    expect(angularSeparation(-10, 10)).toBe(20)
    expect(angularSeparation(370, 10)).toBe(0)
  })
})

describe('signedDelta', () => {
  it('takes the short way round', () => {
    expect(signedDelta(359, 1)).toBe(2)
    expect(signedDelta(1, 359)).toBe(-2)
  })
})

describe('detectAspect', () => {
  it('recognises every declared aspect at exactitude', () => {
    for (const def of ASPECT_DEFINITIONS) {
      const hit = detectAspect(0, def.angle)
      expect(hit, `${def.name} at ${def.angle}°`).not.toBeNull()
      expect(hit!.name).toBe(def.name)
      expect(hit!.phase).toBe('exact')
    }
  })

  it('respects each aspect orb at its boundary', () => {
    for (const def of ASPECT_DEFINITIONS) {
      // Conjunction and opposition sit at the ends of the 0–180 range, so only
      // one side of the orb is reachable as a separation.
      const inside = detectAspect(
        0,
        def.angle === 180 ? 180 - def.orb + 0.1 : def.angle + def.orb - 0.1
      )
      expect(inside, `${def.name} inside orb`).not.toBeNull()

      const outsideAngle = def.angle === 180 ? 180 - def.orb - 1 : def.angle + def.orb + 1
      const outside = detectAspect(0, outsideAngle)
      expect(outside?.name, `${def.name} outside orb`).not.toBe(def.name)
    }
  })

  it('detects aspects across sign boundaries', () => {
    // 29° Pisces (359°) squares 29° Gemini (89°) — 90° apart across 0° Aries.
    const pisces = signToLongitude('Pisces', 29)
    const gemini = signToLongitude('Gemini', 29)
    const hit = detectAspect(pisces, gemini)
    expect(hit?.name).toBe('Square')
    expect(hit?.orb).toBeCloseTo(0, 5)
  })

  it('resolves overlapping orbs to the tighter aspect', () => {
    // 28° is inside the semi-sextile orb (30±2) and outside everything else.
    expect(detectAspect(0, 28)?.name).toBe('Semi-Sextile')
    // 8° is the conjunction boundary, not a semi-sextile.
    expect(detectAspect(0, 8)?.name).toBe('Conjunction')
  })

  it('returns null when no aspect is in orb', () => {
    expect(detectAspect(0, 45)).toBeNull()
    expect(detectAspect(0, 137)).toBeNull()
  })

  it('reads applying and separating from pair relative motion', () => {
    // Mover at 88° closing on a square to stationary 0°: direct motion tightens the orb.
    expect(detectAspect(88, 0, +1, 0)?.phase).toBe('applying')
    expect(detectAspect(88, 0, -1, 0)?.phase).toBe('separating')
    // Past exact, the directions swap.
    expect(detectAspect(92, 0, +1, 0)?.phase).toBe('separating')
    expect(detectAspect(92, 0, -1, 0)?.phase).toBe('applying')
  })

  it('guarantees relative-motion phase symmetry across body pairs', () => {
    // Testing pair symmetry: detectAspect(A, B, vA, vB).phase === detectAspect(B, A, vB, vA).phase
    const phaseAB = detectAspect(88, 0, +1.2, +0.3)?.phase
    const phaseBA = detectAspect(0, 88, +0.3, +1.2)?.phase
    expect(phaseAB).toBe(phaseBA)

    // Frozen sky Moon (149.12° @ +14.04°/d) and Saturn (13.22° @ -0.04°/d)
    const moonSaturn = detectAspect(149.12, 13.22, 14.04, -0.04)?.phase
    const saturnMoon = detectAspect(13.22, 149.12, -0.04, 14.04)?.phase
    expect(moonSaturn).toBe(saturnMoon)
  })

  it('reports unknown phase when velocities are undefined', () => {
    expect(detectAspect(88, 0)?.phase).toBe('unknown')
  })
})

describe('findAspects / tightestAspectTo', () => {
  const bodies = [
    { body: 'square-wide', longitude: 94 },
    { body: 'trine-tight', longitude: 120.5 },
    { body: 'semisextile-exact', longitude: 30 },
    { body: 'unaspected', longitude: 47 },
  ]

  it('sorts tightest orb first and drops unaspected bodies', () => {
    const hits = findAspects(0, bodies)
    expect(hits.map(h => h.partner)).toEqual(['semisextile-exact', 'trine-tight', 'square-wide'])
  })

  it('majorOnly excludes minor aspects', () => {
    const hits = findAspects(0, bodies, { majorOnly: true })
    expect(hits.map(h => h.partner)).toEqual(['trine-tight', 'square-wide'])
    expect(tightestAspectTo(0, bodies, { majorOnly: true })?.partner).toBe('trine-tight')
  })

  it('returns null when nothing is in orb', () => {
    expect(tightestAspectTo(0, [{ body: 'x', longitude: 47 }])).toBeNull()
  })
})

describe('formatAspectBadge / describeAspect', () => {
  it('renders an orb and phase', () => {
    const hit = detectAspect(88, 0, +1, 0)!
    expect(formatAspectBadge(hit)).toBe('SQUARE 2.0° APPLYING')
    expect(describeAspect(hit)).toContain('applying square')
  })

  it('renders exactitude without an orb', () => {
    const hit = detectAspect(120, 0)!
    expect(formatAspectBadge(hit)).toBe('TRINE EXACT')
    expect(describeAspect(hit)).toBe('an exact trine')
    expect(describeAspectPhrase(hit)).toBe('an exact trine')
  })

  it('renders badge without phase when velocity is unknown', () => {
    const hit = detectAspect(88, 0)!
    expect(formatAspectBadge(hit)).toBe('SQUARE 2.0°')
    expect(describeAspectPhrase(hit)).toBe('a square')
  })

  it('agrees the article with the phase, not the aspect name', () => {
    // `applying quincunx` leads with a vowel even though `quincunx` does not.
    const applying = detectAspect(148, 0, +1, 0)!
    expect(applying.name).toBe('Quincunx')
    expect(describeAspectPhrase(applying)).toBe('an applying quincunx')

    const separating = detectAspect(152, 0, +1, 0)!
    expect(describeAspectPhrase(separating)).toBe('a separating quincunx')

    // And never the other way round.
    for (const deg of [88, 92, 118, 122, 2, 178]) {
      for (const speed of [+1, -1]) {
        const hit = detectAspect(deg, 0, speed, 0)
        if (!hit) continue
        expect(describeAspectPhrase(hit), `${deg}° @ ${speed}`).not.toMatch(/^a applying/)
        expect(describeAspectPhrase(hit), `${deg}° @ ${speed}`).not.toMatch(/^an separating/)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Speaker ordering
// ---------------------------------------------------------------------------

describe('orderIngressSpeakers', () => {
  // Moon arrives at 0° Aries. Mars sits 4° away with no aspect; Saturn holds an
  // exact opposition. Proximity alone would let Mars speak second.
  const agents = {
    moon: agent('moon', 'Moon', 'Aries', 0),
    mars: agent('mars', 'Mars', 'Aries', 4),
    saturn: agent('saturn', 'Saturn', 'Libra', 0),
    venus: agent('venus', 'Venus', 'Leo', 0),
    jupiter: agent('jupiter', 'Jupiter', 'Taurus', 17),
  } as Record<BasketAgentKey, BasketAgentConfig>

  const keys: BasketAgentKey[] = ['moon', 'mars', 'saturn', 'venus', 'jupiter']

  it('seats the nearest body first and the tightest major aspect second', () => {
    const order = orderIngressSpeakers('moon', signToLongitude('Aries', 0), agents, keys)
    expect(order[0].key).toBe('mars')
    expect(order[0].role).toBe('nearest')
    expect(order[1].key).toBe('saturn')
    expect(order[1].role).toBe('aspect')
    expect(order[1].hit?.name).toBe('Opposition')
  })

  it('excludes the moving planet from its own reaction', () => {
    const order = orderIngressSpeakers('moon', signToLongitude('Aries', 0), agents, keys)
    expect(order.map(o => o.key)).not.toContain('moon')
    expect(order).toHaveLength(4)
  })

  it('orders the remaining delegates by orb, then by proximity', () => {
    const order = orderIngressSpeakers('moon', signToLongitude('Aries', 0), agents, keys)
    const rest = order.slice(2)
    // Venus holds an exact trine; Jupiter is unaspected.
    expect(rest[0].key).toBe('venus')
    expect(rest[0].hit?.name).toBe('Trine')
    expect(rest[rest.length - 1].hit).toBeNull()
  })

  it('still produces an order when nothing aspects the mover', () => {
    const lonely = {
      moon: agent('moon', 'Moon', 'Aries', 0),
      mars: agent('mars', 'Mars', 'Taurus', 17),
      venus: agent('venus', 'Venus', 'Gemini', 17),
    } as Record<BasketAgentKey, BasketAgentConfig>
    const order = orderIngressSpeakers('moon', signToLongitude('Aries', 0), lonely, [
      'moon',
      'mars',
      'venus',
    ])
    expect(order).toHaveLength(2)
    expect(order[0].role).toBe('nearest')
    expect(order.every(o => o.hit === null)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Transcript threading
// ---------------------------------------------------------------------------

describe('recentTurnsFrom / lastSpeakerFrom', () => {
  const history = [
    msg('Sun Agent', 'one'),
    msg('Cosmic Transit Engine', 'SKY SHIFT', { isIngressAlert: true }),
    msg('Moon Agent', 'two'),
    msg('You (Seeker)', 'three', { isUser: true }),
    msg('Mars Agent', 'four'),
  ]

  it('keeps only the last three speaking turns', () => {
    const turns = recentTurnsFrom(history)
    expect(turns).toHaveLength(3)
    expect(turns.map(t => t.text)).toEqual(['two', 'three', 'four'])
  })

  it('drops machine ingress alerts', () => {
    expect(recentTurnsFrom(history).map(t => t.speaker)).not.toContain('Cosmic Transit Engine')
  })

  it('labels the user rather than echoing their display name', () => {
    expect(recentTurnsFrom(history)[1].speaker).toBe('The seeker')
  })

  it('reports the most recent speaker', () => {
    expect(lastSpeakerFrom(history)).toBe('Mars Agent')
    expect(lastSpeakerFrom([])).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// Offline dialogue quality — the path unauthenticated visitors actually see
// ---------------------------------------------------------------------------

describe('addressPreviousSpeaker', () => {
  it('is empty with no prior speaker', () => {
    expect(addressPreviousSpeaker()).toBe('')
  })

  it('names the previous speaker and is deterministic', () => {
    const first = addressPreviousSpeaker('Saturn Agent')
    expect(first).toContain('Saturn Agent')
    expect(addressPreviousSpeaker('Saturn Agent')).toBe(first)
  })
})

describe('composeCouncilFallback', () => {
  const speaker = {
    name: 'Saturn Agent',
    planet: 'Saturn',
    sign: 'Libra',
    degreeLabel: '0°',
    element: 'earth',
  }
  const moving = {
    name: 'Moon Agent',
    planet: 'Moon',
    sign: 'Aries',
    degreeLabel: '0°',
    element: 'fire',
  }

  it('names the geometry and the previous speaker', () => {
    const hit = detectAspect(signToLongitude('Aries', 0), signToLongitude('Libra', 0))!
    const line = composeCouncilFallback({
      speaker,
      moving,
      hit,
      previousSpeaker: 'Mars Agent',
    })
    expect(line).toContain('Mars Agent')
    expect(line.toLowerCase()).toContain('opposition')
    expect(line).toContain('Moon into 0° Aries')
  })

  it('distinguishes a square from a trine', () => {
    const square = detectAspect(0, 90)!
    const trine = detectAspect(0, 120)!
    const a = composeCouncilFallback({ speaker, moving, hit: square })
    const b = composeCouncilFallback({ speaker, moving, hit: trine })
    expect(a).not.toBe(b)
    expect(a).toContain('friction')
    expect(b).toContain('runs clean')
  })

  it('says so plainly when proximity is not relationship', () => {
    const line = composeCouncilFallback({
      speaker,
      moving,
      hit: null,
      isNearestNeighbour: true,
      angularDistance: 4,
    })
    expect(line).toContain('4°')
    expect(line).toContain('Proximity is not relationship')
  })

  it('gives the moving planet a closing line that answers the room', () => {
    const line = composeCouncilFallback({
      speaker: moving,
      moving,
      isFinalWord: true,
      previousSpeaker: 'Pluto Agent',
    })
    expect(line).toContain('Pluto Agent')
    expect(line).toContain('0° Aries')
  })
})

describe('component fallback generators', () => {
  const agents = {
    mars: agent('mars', 'Mars', 'Aries', 4),
    saturn: agent('saturn', 'Saturn', 'Libra', 0),
    moon: agent('moon', 'Moon', 'Aries', 0),
  } as Record<BasketAgentKey, BasketAgentConfig>

  it('cites the previous speaker in a spontaneous turn', () => {
    const line = generateSpontaneousCouncilResponse('mars', agents, undefined, 'Venus Agent')
    expect(line).toContain('Venus Agent')
  })

  it('omits the citation when nobody has spoken', () => {
    const line = generateSpontaneousCouncilResponse('mars', agents)
    expect(line).not.toContain('undefined')
    expect(line.length).toBeGreaterThan(20)
  })

  it('carries the aspect into the ingress reaction', () => {
    const hit = detectAspect(signToLongitude('Aries', 0), signToLongitude('Libra', 0))
    const line = generateIngressReactionFallback(
      'saturn',
      'moon',
      agents,
      false,
      180,
      false,
      hit,
      'Mars Agent'
    )
    expect(line.toLowerCase()).toContain('opposition')
    expect(line).toContain('Mars Agent')
  })

  it('reacts to where the mover arrived, not where it left', () => {
    // `agents` still holds the Moon at its pre-ingress seat when the council
    // reacts, so the new position has to be passed in explicitly.
    const line = generateIngressReactionFallback(
      'saturn',
      'moon',
      agents,
      false,
      180,
      false,
      null,
      undefined,
      { sign: 'Virgo', degreeLabel: '1°' }
    )
    expect(line).toContain('1° Virgo')
    expect(line).not.toContain('0° Aries')
  })

  it('gives the moving planet its new seat in the final word', () => {
    const line = generateIngressReactionFallback(
      'moon',
      'moon',
      agents,
      false,
      0,
      true,
      null,
      'Saturn Agent',
      { sign: 'Virgo', degreeLabel: '1°' }
    )
    expect(line).toContain('1° Virgo')
    expect(line).toContain('Saturn Agent')
    expect(line).not.toContain('0° Aries')
  })

  it('never emits a bare fallback string for a known delegate', () => {
    for (const key of ['mars', 'saturn', 'moon'] as BasketAgentKey[]) {
      const line = generateSpontaneousCouncilResponse(key, agents)
      expect(line).not.toBe('The celestial current moves in living harmony.')
    }
  })

  it('generates calibrated claims of slightly increased length (2-3 sentences) for all delegates and host', () => {
    const allKeys: BasketAgentKey[] = [
      'sun',
      'moon',
      'mercury',
      'venus',
      'mars',
      'jupiter',
      'saturn',
      'uranus',
      'neptune',
      'pluto',
      'gregory',
    ]
    const fullAgents = Object.fromEntries(
      allKeys.map(k => [k, agent(k, k.toUpperCase(), 'Aries', 15)])
    ) as Record<BasketAgentKey, BasketAgentConfig>

    for (const key of allKeys) {
      const spontaneous = generateSpontaneousCouncilResponse(key, fullAgents)
      expect(spontaneous.length, `${key} spontaneous length`).toBeGreaterThan(90)
      expect(spontaneous.length, `${key} spontaneous length max`).toBeLessThan(350)

      const answered = generateSpontaneousCouncilResponse(
        key,
        fullAgents,
        'How does the current degree influence my work?'
      )
      expect(answered.length, `${key} answered length`).toBeGreaterThan(90)
      expect(answered.length, `${key} answered length max`).toBeLessThan(350)
    }
  })

  it('incorporates dignity posture without reciting labels into prose', () => {
    const testAgents = {
      mars: agent('mars', 'Mars', 'Aries', 4, { dignity: 'domicile' }),
      saturn: agent('saturn', 'Saturn', 'Aries', 10, { dignity: 'fall' }),
      venus: agent('venus', 'Venus', 'Aries', 20, { dignity: 'detriment' }),
    } as Record<BasketAgentKey, BasketAgentConfig>

    const marsLine = generateSpontaneousCouncilResponse('mars', testAgents)
    expect(marsLine).toContain('native authority')
    expect(marsLine).not.toContain('domicile')

    const saturnLine = generateSpontaneousCouncilResponse('saturn', testAgents)
    expect(saturnLine).toContain('superficial comfort')
    expect(saturnLine).not.toContain('fall')

    const venusLine = generateSpontaneousCouncilResponse('venus', testAgents)
    expect(venusLine).toContain('generative friction')
    expect(venusLine).not.toContain('detriment')
  })

  it('delivers poised, articulate host voice for Gregory Castro without poem insertions', () => {
    const hostAgent = {
      gregory: agent('gregory', 'Gregory Castro', 'Leo', 19),
    } as Record<BasketAgentKey, BasketAgentConfig>

    const line = generateSpontaneousCouncilResponse('gregory', hostAgent)
    expect(line).toContain('living balance')
    expect(line).toContain('Moon')
    expect(line).not.toContain('psalm')
    expect(line).not.toContain('poem')
  })
})

// ---------------------------------------------------------------------------
// Persona blocks — the reason the council stopped sounding like one voice
// ---------------------------------------------------------------------------

describe('buildPlanetaryPersonaBlock', () => {
  const keys = [
    'sun',
    'moon',
    'mercury',
    'venus',
    'mars',
    'jupiter',
    'saturn',
    'uranus',
    'neptune',
    'pluto',
  ]

  it('resolves all ten council keys', () => {
    for (const key of keys) {
      expect(planetFromCouncilKey(key), key).not.toBeNull()
      expect(buildPlanetaryPersonaBlock(key), key).toBeTruthy()
    }
  })

  it('returns null for the host, who has a real agent record', () => {
    expect(planetFromCouncilKey('gregory')).toBeNull()
    expect(buildPlanetaryPersonaBlock('gregory')).toBeNull()
    expect(buildPlanetaryPersonaBlock('')).toBeNull()
  })

  it('produces ten distinct blocks', () => {
    const blocks = keys.map(k => buildPlanetaryPersonaBlock(k)!)
    expect(new Set(blocks).size).toBe(10)
  })

  it('names the planet as an identity, not a subject', () => {
    const mars = buildPlanetaryPersonaBlock('mars')!
    expect(mars).toContain('You are Mars')
    expect(mars).toContain('you are Mars')
  })

  it('folds in the live seat when one is supplied', () => {
    const block = buildPlanetaryPersonaBlock('venus', {
      sign: 'Taurus',
      degreeLabel: '17°',
      dignity: 'rulership',
      retrograde: true,
    })!
    expect(block).toContain('17° Taurus')
    expect(block).toContain('rulership dignity')
    expect(block).toContain('retrograde')
  })

  it('forbids the terminology the closing rule bans everywhere else', () => {
    for (const key of keys) {
      const block = buildPlanetaryPersonaBlock(key)!
      expect(block, key).toContain('Never mention model names')
      expect(block, key).toContain('Sacred stats')
    }
  })

  it('gives every delegate something to contest, so debate has friction', () => {
    for (const voice of Object.values(PLANETARY_VOICES)) {
      expect(voice.contests.length).toBeGreaterThan(20)
      expect(voice.tensionWith.length).toBeGreaterThan(0)
      expect(voice.affinityWith.length).toBeGreaterThan(0)
    }
  })

  it('enforces well-developed paragraph and dignity awareness without reciting labels', () => {
    for (const key of keys) {
      const block = buildPlanetaryPersonaBlock(key)!
      expect(block, key).toContain('well-developed paragraph')
      expect(block, key).toContain('Embody your dignity')
      expect(block, key).toContain('Do NOT recite your dignity label')
      expect(block, key).toContain('When the Moon or another body shifts degrees')
    }

    const seatedBlock = buildPlanetaryPersonaBlock('mars', { dignity: 'domicile' })!
    expect(seatedBlock).toContain('### Dignity Stance')
    expect(seatedBlock).toContain('You sit in your domicile')
  })
})
