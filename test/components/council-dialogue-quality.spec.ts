import { describe, it, expect, vi } from 'vitest'
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
  lastSpeakerFrom,
  orderIngressSpeakers,
  recentTurnsFrom,
  signToLongitude,
  type BasketAgentConfig,
  type BasketAgentKey,
  type ChatMessage,
} from '@/components/landing/current-promotional-thread'
import { generateInterpretiveBriefing } from '@/lib/agents/council/grounded-briefing'
import { compileTurnBrief } from '@/lib/agents/council/turn-brief'
import {
  directSeekerExchange,
  directIngressSequence,
} from '@/lib/agents/council/conversation-director'
import { buildServerCouncilContext } from '@/lib/agents/council/council-context'
import { auditEvidence } from '@/lib/agents/council/council-chamber'
import { ExchangeStateMachine } from '@/lib/agents/council/exchange-state-machine'
import { parseNatalContext } from '@/lib/context-card/natal-parser'
import { FROZEN_SCREENSHOT_SKY } from '../fixtures/frozen-screenshot-sky'

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

describe('server dialogue engine and briefing generators', () => {
  const ctx = buildServerCouncilContext({
    positions: FROZEN_SCREENSHOT_SKY as any,
  })

  it('generateInterpretiveBriefing produces distinct, high-quality turns without reciting telemetry', () => {
    const [t0] = directSeekerExchange(
      ctx,
      'Should I take the leap into a creative venture or stay at my corporate job?',
      'mars'
    )
    const brief = compileTurnBrief(
      t0,
      'Should I take the leap into a creative venture or stay at my corporate job?'
    )
    const briefing = generateInterpretiveBriefing(brief, true)

    expect(briefing.newClaim.length).toBeGreaterThan(10)
    expect(briefing.text.length).toBeGreaterThan(80)
    expect(briefing.text).not.toContain('0°')
    expect(briefing.text.toLowerCase()).not.toContain('domicile')
    expect(briefing.text.toLowerCase()).not.toContain('fall')
    expect(briefing.text.toLowerCase()).not.toContain('detriment')
    expect(briefing.text).not.toMatch(/\d+%/)
    expect(briefing.text.toLowerCase()).not.toContain('monica constant')
  })

  it('directs 4 ingress turns with dynamic threading ending in inaugurate', () => {
    const sequence = directIngressSequence(ctx, 'saturn', 'Aries', 14)

    expect(sequence.length).toBe(4)
    expect(sequence[0].speechAct).toBe('reframe')
    expect(sequence[1].speechAct).toBe('challenge')
    expect(sequence[1].targetSpeakerName).toBe(sequence[0].speakerName)
    expect(sequence[2].speechAct).toBe('synthesize')
    expect(sequence[2].targetSpeakerName).toBe(sequence[1].speakerName)
    expect(sequence[3].speechAct).toBe('inaugurate')
    expect(sequence[3].targetSpeakerName).toBe(sequence[2].speakerName)
  })

  it('sequences seeker exchange independently of unrelated past turns', () => {
    const [t0, t1] = directSeekerExchange(ctx, 'Career crossroads', 'mars')
    expect(t0.speakerKey).toBe('mars')
    expect(t1.speakerKey).not.toBe('mars')
    expect(t1.targetSpeakerName).toBe(t0.speakerName)
  })

  it('evidence audit strictly rejects fabricated IDs and empty evidence', () => {
    const allowed = new Set(['ev-1', 'ev-2'])

    const validAudit = auditEvidence(['ev-1'], allowed)
    expect(validAudit.valid).toBe(true)

    const fabricatedAudit = auditEvidence(['ev-fake'], allowed)
    expect(fabricatedAudit.valid).toBe(false)

    const emptyAudit = auditEvidence([], allowed)
    expect(emptyAudit.valid).toBe(false)
  })

  it('ExchangeStateMachine.cancel() resets typing state and cancels in-flight turn', () => {
    const machine = new ExchangeStateMachine()
    const events: any[] = []
    machine.subscribe(e => events.push(e))

    // Mock fetch that doesn't return immediately
    const mockFetch = vi.fn().mockImplementation(() => new Promise(() => {}))
    machine.startExchange({
      seekerInquiry: 'Test prompt',
      fetchFn: mockFetch as any,
    })

    expect(machine.isActive()).toBe(true)
    machine.cancel()
    expect(machine.isActive()).toBe(false)

    const typingEvents = events.filter(e => e.type === 'TYPING_CHANGE')
    expect(typingEvents.length).toBeGreaterThanOrEqual(2)
    expect(typingEvents[typingEvents.length - 1].isTyping).toBe(false)
  })

  it('parseNatalContext strictly enforces version: 1, bounds coordinates, and retains houses', () => {
    const validEnvelope = {
      version: 1,
      data: {
        points: [
          { body: 'Sun', sign: 'Leo', deg: 15.5 },
          { body: 'Moon', sign: 'Cancer', deg: 3.2 },
        ],
        houses: [{ house: 1, sign: 'Aries', deg: 0.0 }],
      },
    }

    const parsed = parseNatalContext(validEnvelope)
    expect(parsed).not.toBeNull()
    expect(parsed?.placements.length).toBe(2)
    expect(parsed?.houses?.length).toBe(1)
    expect(parsed?.houses?.[0].house).toBe(1)

    // Rejects invalid version
    expect(parseNatalContext({ version: 2, data: validEnvelope.data })).toBeNull()

    // Rejects coordinate >= 30
    const outOfBoundsEnvelope = {
      version: 1,
      data: {
        points: [{ body: 'Sun', sign: 'Leo', deg: 30.0 }],
      },
    }
    expect(parseNatalContext(outOfBoundsEnvelope)).toBeNull()

    // Rejects missing degree
    const missingDegEnvelope = {
      version: 1,
      data: {
        points: [{ body: 'Sun', sign: 'Leo' }],
      },
    }
    expect(parseNatalContext(missingDegEnvelope)).toBeNull()
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
