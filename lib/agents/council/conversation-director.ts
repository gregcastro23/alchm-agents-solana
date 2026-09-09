/**
 * Conversation Director
 *
 * Deterministic, heuristic turn-level orchestrator for the Current Sky Council.
 * Selects speakers, assigns discourse moves (support, challenge, qualify, reframe,
 * synthesize), selects 2-3 justifying chart signals, and sets length policies.
 *
 * Does NOT generate free-form text or make recursive LLM calls.
 */

import {
  type BasketAgentKey,
  type CouncilContext,
  type CouncilContextAspect,
} from './council-context'
import { PLANETARY_VOICES } from './planetary-personas'
import { planetFromCouncilKey } from './planetary-personas'

export type SpeechAct = 'support' | 'challenge' | 'qualify' | 'reframe' | 'synthesize'

export interface SelectedEvidenceItem {
  id: string
  label: string
  aspectName?: string
  orb?: number
}

export interface TurnDirective {
  speakerKey: BasketAgentKey
  speakerName: string
  targetTurnId?: string
  targetSpeakerName?: string
  targetClaim?: string
  speechAct: SpeechAct
  evidence:
    | [SelectedEvidenceItem, SelectedEvidenceItem]
    | [SelectedEvidenceItem, SelectedEvidenceItem, SelectedEvidenceItem]
  directive: string
  wordTarget: { min: number; max: number }
}

const TOPIC_KEYWORD_MAP: Record<string, BasketAgentKey[]> = {
  // Discipline & work
  discipline: ['saturn', 'mars'],
  career: ['saturn', 'sun', 'mars'],
  structure: ['saturn', 'mercury'],
  boundary: ['saturn', 'mars'],
  time: ['saturn', 'jupiter'],
  mastery: ['saturn', 'mars'],

  // Emotion & soul
  emotion: ['moon', 'venus', 'neptune'],
  feeling: ['moon', 'neptune'],
  grief: ['neptune', 'pluto', 'moon'],
  family: ['moon', 'saturn'],
  intuition: ['moon', 'neptune'],

  // Communication & intellect
  clarity: ['mercury', 'sun'],
  writing: ['mercury', 'uranus'],
  dilemma: ['mercury', 'saturn'],
  decision: ['mars', 'mercury'],
  truth: ['sun', 'pluto', 'mercury'],

  // Value & relationships
  relationship: ['venus', 'moon', 'mars'],
  love: ['venus', 'moon'],
  value: ['venus', 'jupiter'],
  harmony: ['venus', 'neptune'],
  money: ['venus', 'saturn', 'jupiter'],

  // Transformation & courage
  courage: ['mars', 'sun'],
  action: ['mars', 'sun'],
  fear: ['mars', 'pluto', 'saturn'],
  change: ['uranus', 'pluto'],
  breakthrough: ['uranus', 'mercury'],
  rebirth: ['pluto', 'mars'],
  shadow: ['pluto', 'moon'],

  // Expansion & vision
  growth: ['jupiter', 'sun'],
  purpose: ['sun', 'jupiter'],
  vision: ['jupiter', 'uranus', 'sun'],
  faith: ['jupiter', 'neptune'],
}

/**
 * Directs who should answer a Seeker inquiry, selecting a primary voice
 * and a complementary countervoice/synthesizer.
 */
export function directSeekerExchange(
  ctx: CouncilContext,
  inquiry: string,
  preferredSpeaker?: BasketAgentKey
): [TurnDirective, TurnDirective] {
  const lowerInquiry = inquiry.toLowerCase()

  // 1. Identify primary candidate
  let primaryKey: BasketAgentKey = 'sun'
  if (preferredSpeaker && preferredSpeaker !== 'gregory') {
    primaryKey = preferredSpeaker
  } else {
    // Score all candidates by keyword relevance + active celestial aspects
    const scores: Record<BasketAgentKey, number> = {
      sun: 1,
      moon: 1,
      mercury: 1,
      venus: 1,
      mars: 1,
      jupiter: 1,
      saturn: 1,
      uranus: 1,
      neptune: 1,
      pluto: 1,
      gregory: 0,
    }

    for (const [kw, keys] of Object.entries(TOPIC_KEYWORD_MAP)) {
      if (lowerInquiry.includes(kw)) {
        keys.forEach((k, idx) => {
          scores[k] += 4 - idx
        })
      }
    }

    // Boost planets holding tight celestial aspects
    for (const aspect of ctx.aspects) {
      if (aspect.orb <= 2.5) {
        scores[aspect.bodyA] += 2
        scores[aspect.bodyB] += 2
      }
    }

    // Find highest scoring
    let highestScore = -1
    for (const [key, score] of Object.entries(scores) as [BasketAgentKey, number][]) {
      if (key === 'gregory') continue
      if (score > highestScore) {
        highestScore = score
        primaryKey = key
      }
    }
  }

  // 2. Select secondary responder: ideological tension partner, strong aspect partner, or host
  const primaryPlanet = planetFromCouncilKey(primaryKey)
  const voice = primaryPlanet ? PLANETARY_VOICES[primaryPlanet] : null
  let secondaryKey: BasketAgentKey = 'gregory'

  if (voice && voice.tensionWith.length > 0) {
    const tensionName = voice.tensionWith[0].toLowerCase() as BasketAgentKey
    if (tensionName !== primaryKey && tensionName !== 'gregory') {
      secondaryKey = tensionName
    }
  }

  // 3. Build directives for both turns
  const turn1 = buildTurnDirective({
    ctx,
    speakerKey: primaryKey,
    speechAct: 'reframe',
    isSeekerTurn: true,
    directive: `Address the seeker's inquiry directly. Provide articulate, grounded orientation from your celestial seat. Do not recite your degree or dignity label aloud; embody your condition as posture.`,
  })

  const turn2 = buildTurnDirective({
    ctx,
    speakerKey: secondaryKey,
    speechAct: secondaryKey === 'gregory' ? 'synthesize' : 'challenge',
    isSeekerTurn: true,
    targetTurn: {
      speakerName: ctx.sky[primaryKey]?.planet || 'First Delegate',
      claim: `Focus on the immediate alchemical vector`,
    },
    directive:
      secondaryKey === 'gregory'
        ? `Synthesize the primary delegate's reading, connecting the geometry directly to human agency and creative resolve.`
        : `Respond to ${ctx.sky[primaryKey]?.planet}'s reading. Add a distinct counter-perspective or necessary qualification.`,
  })

  return [turn1, turn2]
}

/**
 * Directs autonomous round-table turns. Evaluates celestial aspects to the last
 * speaker, archetypal tension/affinity, and recency decay.
 */
export function directAutonomousTurn(
  ctx: CouncilContext,
  lastSpeakerKey?: BasketAgentKey
): TurnDirective {
  const candidates = (
    [
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
    ] as BasketAgentKey[]
  ).filter(k => k !== lastSpeakerKey)

  // Find candidate with strongest aspect or tension with last speaker
  let chosenSpeaker: BasketAgentKey = candidates[0]
  let bestScore = -1
  let chosenSpeechAct: SpeechAct = 'qualify'

  const lastPlanet = lastSpeakerKey ? planetFromCouncilKey(lastSpeakerKey) : null
  const lastVoice = lastPlanet ? PLANETARY_VOICES[lastPlanet] : null

  for (const candidate of candidates) {
    let score = 1
    const candidatePlanet = planetFromCouncilKey(candidate)
    const candidateVoice = candidatePlanet ? PLANETARY_VOICES[candidatePlanet] : null

    // Check aspect to last speaker
    if (lastSpeakerKey) {
      const aspectWithLast = ctx.speakerAspects[candidate]?.find(
        a => a.bodyA === lastSpeakerKey || a.bodyB === lastSpeakerKey
      )
      if (aspectWithLast) {
        if (aspectWithLast.quality === 'dynamic') {
          score += 5
          chosenSpeechAct = 'challenge'
        } else if (aspectWithLast.quality === 'harmonious') {
          score += 4
          chosenSpeechAct = 'support'
        } else {
          score += 3
          chosenSpeechAct = 'qualify'
        }
      }

      // Check archetypal tension
      if (lastVoice && candidatePlanet && lastVoice.tensionWith.includes(candidatePlanet)) {
        score += 4
        chosenSpeechAct = 'challenge'
      }
      if (candidateVoice && lastPlanet && candidateVoice.tensionWith.includes(lastPlanet)) {
        score += 3
        chosenSpeechAct = 'challenge'
      }
    }

    if (score > bestScore) {
      bestScore = score
      chosenSpeaker = candidate
    }
  }

  const lastTurn = ctx.recentTurns[ctx.recentTurns.length - 1]

  return buildTurnDirective({
    ctx,
    speakerKey: chosenSpeaker,
    speechAct: chosenSpeechAct,
    isSeekerTurn: false,
    targetTurn: lastTurn
      ? {
          speakerName: lastTurn.speakerName,
          claim: lastTurn.claim || lastTurn.text.slice(0, 80),
          turnId: lastTurn.turnId,
        }
      : undefined,
    directive: `Respond directly to ${
      lastTurn?.speakerName || 'the chamber'
    }. Introduce a fresh proposition that has not already been stated. Do not say "names it well" or recite your degree.`,
  })
}

/**
 * Directs an Ingress reaction sequence capped at 3 to 4 purposeful voices.
 */
export function directIngressSequence(
  ctx: CouncilContext,
  movingKey: BasketAgentKey,
  newSign: string,
  newDegree: number
): TurnDirective[] {
  const movingPlanet = planetFromCouncilKey(movingKey) || 'Moon'
  const movingCfg = ctx.sky[movingKey]
  const movingLong = movingCfg?.absoluteDegree ?? 0

  // 1. Nearest celestial body
  let nearestKey: BasketAgentKey = 'sun'
  let nearestDist = 360

  // 2. Strongest aspect partner
  let strongestAspectKey: BasketAgentKey | null = null
  let tightestOrb = 360

  for (const [key, body] of Object.entries(ctx.sky) as [BasketAgentKey, any][]) {
    if (key === movingKey || key === 'gregory') continue

    const dist = Math.abs(((((body.absoluteDegree - movingLong) % 360) + 540) % 360) - 180)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestKey = key
    }

    const aspect = ctx.speakerAspects[movingKey]?.find(a => a.bodyA === key || a.bodyB === key)
    if (aspect && aspect.major && aspect.orb < tightestOrb) {
      tightestOrb = aspect.orb
      strongestAspectKey = key
    }
  }

  // 3. Countervoice / ideological tension
  const voice = planetFromCouncilKey(movingKey)
    ? PLANETARY_VOICES[planetFromCouncilKey(movingKey)!]
    : null
  let counterKey: BasketAgentKey = 'gregory'
  if (voice && voice.tensionWith.length > 0) {
    const tKey = voice.tensionWith[0].toLowerCase() as BasketAgentKey
    if (tKey !== nearestKey && tKey !== strongestAspectKey && tKey !== movingKey) {
      counterKey = tKey
    }
  }

  const sequence: TurnDirective[] = []

  // Voice 1: Nearest body (spatial reaction)
  sequence.push(
    buildTurnDirective({
      ctx,
      speakerKey: nearestKey,
      speechAct: 'reframe',
      isSeekerTurn: false,
      directive: `${movingPlanet} has just entered ${newDegree}° ${newSign}. You sit nearest in the sky (${nearestDist.toFixed(
        1
      )}° away). Speak first: report what lands in your sector before anyone else frames it.`,
    })
  )

  // Voice 2: Strongest aspect partner (geometric reaction, if distinct)
  if (strongestAspectKey && strongestAspectKey !== nearestKey) {
    sequence.push(
      buildTurnDirective({
        ctx,
        speakerKey: strongestAspectKey,
        speechAct: 'challenge',
        isSeekerTurn: false,
        directive: `React to ${movingPlanet}'s arrival through your aspect relationship. Shape your claim to the geometry.`,
      })
    )
  }

  // Voice 3: Countervoice or Host Synthesis
  sequence.push(
    buildTurnDirective({
      ctx,
      speakerKey: counterKey,
      speechAct: counterKey === 'gregory' ? 'synthesize' : 'qualify',
      isSeekerTurn: false,
      directive:
        counterKey === 'gregory'
          ? `Host Gregory: Synthesize the shift of ${movingPlanet} into ${newDegree}° ${newSign} and connect it to creative agency.`
          : `Provide an ideological counter-weight to the prevailing reaction.`,
    })
  )

  // Voice 4: Moving body takes the floor last (Inauguration)
  sequence.push(
    buildTurnDirective({
      ctx,
      speakerKey: movingKey,
      speechAct: 'support',
      isSeekerTurn: false,
      directive: `You have arrived at ${newDegree}° ${newSign}. Answer the chamber's reactions and inaugurate your degree with decisive intent.`,
    })
  )

  return sequence
}

function buildTurnDirective(params: {
  ctx: CouncilContext
  speakerKey: BasketAgentKey
  speechAct: SpeechAct
  isSeekerTurn: boolean
  directive: string
  targetTurn?: { speakerName: string; claim: string; turnId?: string }
}): TurnDirective {
  const { ctx, speakerKey, speechAct, isSeekerTurn, directive, targetTurn } = params
  const speaker = ctx.sky[speakerKey]
  const speakerName = speaker?.planet || 'Delegate'

  // Extract 2 or 3 salient evidence items
  const evidenceItems: SelectedEvidenceItem[] = []

  // Evidence 1: The speaker's tightest aspect in the current sky
  const topAspect = ctx.speakerAspects[speakerKey]?.[0]
  if (topAspect) {
    const otherKey = topAspect.bodyA === speakerKey ? topAspect.bodyB : topAspect.bodyA
    const otherName = ctx.sky[otherKey]?.planet || otherKey
    evidenceItems.push({
      id: `aspect-${speakerKey}-${otherKey}`,
      label: `${speakerName} ${topAspect.aspectName} ${otherName} (${topAspect.orb.toFixed(
        1
      )}° ${topAspect.phase})`,
      aspectName: topAspect.aspectName,
      orb: topAspect.orb,
    })
  } else {
    evidenceItems.push({
      id: `seat-${speakerKey}`,
      label: `${speakerName} in ${speaker.sign} (${speaker.degreeLabel})`,
    })
  }

  // Evidence 2: Dignity posture
  evidenceItems.push({
    id: `dignity-${speakerKey}`,
    label: `${speakerName} in ${speaker.sign} ${speaker.dignity} posture`,
  })

  // Evidence 3: Transit contact with seeker natal chart if available
  if (ctx.attachedNatalChart && ctx.attachedNatalChart.placements.length > 0) {
    const contact = ctx.attachedNatalChart.placements[0]
    evidenceItems.push({
      id: `natal-contact-${contact.body.toLowerCase()}`,
      label: `Current ${speakerName} transiting seeker's natal ${contact.body} in ${contact.sign}`,
    })
  }

  // Ensure 2 or 3 items
  const evidenceTuple =
    evidenceItems.length >= 3
      ? ([evidenceItems[0], evidenceItems[1], evidenceItems[2]] as [
          SelectedEvidenceItem,
          SelectedEvidenceItem,
          SelectedEvidenceItem,
        ])
      : ([evidenceItems[0], evidenceItems[1]] as [SelectedEvidenceItem, SelectedEvidenceItem])

  return {
    speakerKey,
    speakerName,
    targetTurnId: targetTurn?.turnId,
    targetSpeakerName: targetTurn?.speakerName,
    targetClaim: targetTurn?.claim,
    speechAct,
    evidence: evidenceTuple,
    directive,
    wordTarget: isSeekerTurn ? { min: 50, max: 90 } : { min: 25, max: 45 },
  }
}
