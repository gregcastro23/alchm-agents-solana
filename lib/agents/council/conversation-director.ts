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
  type CouncilContext,
  type CouncilContextAspect,
  type CelestialPlacement,
} from './council-context'
import { type BasketAgentKey, type SpeechAct } from './council-schema'
import { PLANETARY_VOICES, planetFromCouncilKey } from './planetary-personas'
import { detectAspect, signToLongitude } from './aspect-dialogue-engine'

export interface SelectedEvidenceItem {
  id: string
  label: string
  aspectName?: string
  orb?: number
  placement?: { planet: string; sign: string; dignity: string; retrograde: boolean }
  relationship?: { bodyA: string; bodyB: string; phase: string }
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
  career: ['saturn', 'mars', 'sun'],
  work: ['saturn', 'mercury', 'mars'],
  ambition: ['mars', 'sun', 'jupiter'],
  discipline: ['saturn', 'mars'],
  risk: ['mars', 'uranus', 'jupiter'],
  enterprise: ['saturn', 'jupiter', 'sun'],
  creative: ['venus', 'neptune', 'sun'],
  art: ['venus', 'neptune'],
  love: ['venus', 'moon'],
  relationship: ['venus', 'moon', 'jupiter'],
  crossroads: ['mercury', 'uranus', 'saturn'],
  decision: ['mercury', 'saturn', 'mars'],
  fear: ['saturn', 'pluto', 'moon'],
  shadow: ['pluto', 'saturn'],
  transformation: ['pluto', 'uranus'],
  breakthrough: ['uranus', 'jupiter'],
  money: ['venus', 'saturn', 'taurus' as any],
  wealth: ['jupiter', 'venus'],
  healing: ['moon', 'neptune', 'venus'],
  spirit: ['neptune', 'sun', 'jupiter'],
  growth: ['jupiter', 'sun'],
  purpose: ['sun', 'jupiter'],
  vision: ['jupiter', 'uranus', 'sun'],
  faith: ['jupiter', 'neptune'],
}

/**
 * Directs who should answer a Seeker inquiry, selecting a primary voice
 * and a complementary countervoice/synthesizer with idea-to-idea threading.
 */
export function directSeekerExchange(
  ctx: CouncilContext,
  inquiry: string,
  preferredSpeaker?: BasketAgentKey
): [TurnDirective, TurnDirective, TurnDirective] {
  const lowerInquiry = inquiry.toLowerCase()

  // 1. Identify primary candidate
  let primaryKey: BasketAgentKey = 'sun'
  if (preferredSpeaker && ctx.sky[preferredSpeaker]) {
    primaryKey = preferredSpeaker
  } else {
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
          if (scores[k] !== undefined) {
            scores[k] += 4 - idx
          }
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

    let highestScore = -1
    for (const [key, score] of Object.entries(scores) as [BasketAgentKey, number][]) {
      if (key === 'gregory') continue
      if (score > highestScore) {
        highestScore = score
        primaryKey = key
      }
    }
  }

  // Actual sky relationships lead the counter-perspective. A permanent rival
  // should not manufacture a disagreement on a day without that relationship.
  const partner = ctx.speakerAspects[primaryKey]?.find(aspect => aspect.major)
  const secondaryKey: BasketAgentKey = partner
    ? partner.bodyA === primaryKey
      ? partner.bodyB
      : partner.bodyA
    : primaryKey === 'sun'
      ? 'saturn'
      : 'sun'

  // 3. Build directives with idea-to-idea threading
  const turn1 = buildTurnDirective({
    ctx,
    speakerKey: primaryKey,
    speechAct: 'reframe',
    isSeekerTurn: true,
    directive: `Address the seeker's inquiry directly. Provide articulate, grounded orientation from your celestial seat. Do not recite your degree or dignity label aloud; embody your condition as posture.`,
  })

  // Inspect ctx.recentTurns to see if primaryKey has already spoken in this exchange
  const prevTurn = [...ctx.recentTurns].reverse().find(t => t.speakerKey === primaryKey)

  const turn2Claim = prevTurn?.claim || 'the first reading of the seeker’s question'
  const turn2TargetId = prevTurn?.turnId
  const turn2TargetSpeaker =
    prevTurn?.speakerName || ctx.sky[primaryKey]?.planet || 'First Delegate'

  const turn2 = buildTurnDirective({
    ctx,
    speakerKey: secondaryKey,
    speechAct: partner?.quality === 'dynamic' ? 'challenge' : 'qualify',
    isSeekerTurn: true,
    targetTurn: {
      turnId: turn2TargetId,
      speakerName: turn2TargetSpeaker,
      claim: turn2Claim,
    },
    directive: `Respond directly to ${turn2TargetSpeaker}'s actual claim: "${turn2Claim}". Explain one useful qualification or alternative from the supplied placement and sky relationship. Do not invent disagreement or give a guaranteed life outcome.`,
  })

  const last = ctx.recentTurns.at(-1)
  const turn3 = buildTurnDirective({
    ctx,
    speakerKey: 'gregory',
    speechAct: 'synthesize',
    isSeekerTurn: true,
    targetTurn: last
      ? { turnId: last.turnId, speakerName: last.speakerName, claim: last.claim || last.text }
      : undefined,
    directive: `Integrate the actual readings of the seeker's question. Explain how their current placements connect, preserve any unresolved tension, and offer a concrete reflective choice. Do not invent a personal transit, house, prediction, or biography.`,
  })
  return [turn1, turn2, turn3]
}

/**
 * Directs autonomous round-table turns. Evaluates celestial aspects to the last
 * speaker, archetypal tension/affinity, and recency decay.
 */
export function directAutonomousTurn(
  ctx: CouncilContext,
  lastSpeakerKey?: BasketAgentKey
): TurnDirective {
  const sinceHost = [...ctx.recentTurns].reverse().findIndex(turn => turn.speakerKey === 'gregory')
  if (!ctx.recentTurns.length || (sinceHost < 0 && ctx.recentTurns.length >= 3) || sinceHost >= 3) {
    const last = ctx.recentTurns.at(-1)
    return buildTurnDirective({
      ctx,
      speakerKey: 'gregory',
      speechAct: 'synthesize',
      isSeekerTurn: false,
      targetTurn: last
        ? { turnId: last.turnId, speakerName: last.speakerName, claim: last.claim || last.text }
        : undefined,
      directive:
        'Host the conversation: connect the actual previous readings to the current sky, explain one term for a beginner, and invite a relevant next question. Do not recite the full chart.',
    })
  }
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

  let chosenSpeaker: BasketAgentKey = candidates[0]
  let bestScore = -1
  let chosenSpeechAct: SpeechAct = 'qualify'

  const lastPlanet = lastSpeakerKey ? planetFromCouncilKey(lastSpeakerKey) : null
  const lastVoice = lastPlanet ? PLANETARY_VOICES[lastPlanet] : null

  for (const candidate of candidates) {
    let score =
      1 - ctx.recentTurns.slice(-4).filter(turn => turn.speakerKey === candidate).length * 3
    let candidateSpeechAct: SpeechAct = 'qualify'
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
          candidateSpeechAct = 'challenge'
        } else if (aspectWithLast.quality === 'harmonious') {
          score += 4
          candidateSpeechAct = 'support'
        } else {
          score += 3
          candidateSpeechAct = 'qualify'
        }
      }

      // Check archetypal tension
      if (lastVoice && candidatePlanet && lastVoice.tensionWith.includes(candidatePlanet)) {
        score += 4
        candidateSpeechAct = 'challenge'
      }
      if (candidateVoice && lastPlanet && candidateVoice.tensionWith.includes(lastPlanet)) {
        score += 3
        candidateSpeechAct = 'challenge'
      }
    }

    if (score > bestScore) {
      bestScore = score
      chosenSpeaker = candidate
      chosenSpeechAct = candidateSpeechAct
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
          turnId: lastTurn.turnId,
          speakerName: lastTurn.speakerName,
          claim: lastTurn.claim || '',
        }
      : undefined,
    directive: `Respond directly to ${
      lastTurn?.speakerName || 'the chamber'
    }. Introduce a fresh proposition that has not already been stated. Do not say "names it well" or recite your degree.`,
  })
}

/**
 * Directs an individual Ingress turn (0 through 3), ensuring that each turn
 * dynamically threads to the preceding turn's claim.
 */
export function directIngressTurn(
  ctx: CouncilContext,
  movingKey: BasketAgentKey,
  newSign: string,
  newDegree: number,
  turnIndex: number
): TurnDirective {
  const movingPlanet = planetFromCouncilKey(movingKey) || 'Moon'
  const newLongitude = signToLongitude(newSign, newDegree)

  // 1. Nearest celestial body from the NEW ingress longitude
  let nearestKey: BasketAgentKey = 'sun'
  let nearestDist = 360

  // 2. Strongest aspect partner from the NEW ingress longitude
  let strongestAspectKey: BasketAgentKey | null = null
  let tightestOrb = 360

  for (const [key, body] of Object.entries(ctx.sky) as [BasketAgentKey, CelestialPlacement][]) {
    if (key === movingKey || key === 'gregory') continue

    const dist = Math.abs(((((body.absoluteDegree - newLongitude) % 360) + 540) % 360) - 180)
    if (dist < nearestDist) {
      nearestDist = dist
      nearestKey = key
    }

    const aspect = detectAspect(newLongitude, body.absoluteDegree)
    if (aspect && aspect.definition.major && aspect.orb < tightestOrb) {
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

  const secondKey =
    strongestAspectKey && strongestAspectKey !== nearestKey ? strongestAspectKey : counterKey
  const thirdKey = counterKey !== secondKey && counterKey !== nearestKey ? counterKey : 'gregory'

  const lastTurn = ctx.recentTurns[ctx.recentTurns.length - 1]

  if (turnIndex === 0) {
    // Voice 1 (turnIndex 0): Nearest body (spatial reaction)
    return buildTurnDirective({
      ctx,
      speakerKey: nearestKey,
      speechAct: 'reframe',
      isSeekerTurn: false,
      directive: `${movingPlanet} has just entered ${newDegree}° ${newSign}. You sit nearest in the sky (${nearestDist.toFixed(
        1
      )}° away). Speak first: report what lands in your sector before anyone else frames it.`,
    })
  }

  if (turnIndex === 1) {
    // Voice 2 (turnIndex 1): Strongest aspect partner or distinct countervoice, answering Voice 1
    const targetTurn = lastTurn
      ? { turnId: lastTurn.turnId, speakerName: lastTurn.speakerName, claim: lastTurn.claim || '' }
      : {
          speakerName: planetFromCouncilKey(nearestKey) || 'Nearest Delegate',
          claim: 'the immediate vector',
        }
    return buildTurnDirective({
      ctx,
      speakerKey: secondKey,
      speechAct: secondKey === strongestAspectKey ? 'challenge' : 'qualify',
      isSeekerTurn: false,
      targetTurn,
      directive: `React directly to ${
        targetTurn.speakerName
      }'s claim ("${targetTurn.claim}"). Shape your claim to the new celestial geometry.`,
    })
  }

  if (turnIndex === 2) {
    // Voice 3 (turnIndex 2): Countervoice or Host Gregory synthesizing the dialogue so far
    const targetTurn = lastTurn
      ? { turnId: lastTurn.turnId, speakerName: lastTurn.speakerName, claim: lastTurn.claim || '' }
      : {
          speakerName: planetFromCouncilKey(secondKey) || 'Second Delegate',
          claim: 'the prevailing reaction',
        }
    return buildTurnDirective({
      ctx,
      speakerKey: thirdKey,
      speechAct: thirdKey === 'gregory' ? 'synthesize' : 'qualify',
      isSeekerTurn: false,
      targetTurn,
      directive:
        thirdKey === 'gregory'
          ? `Host Gregory: Synthesize the dialogue between the chamber delegates, specifically addressing ${
              targetTurn.speakerName
            }'s assertion ("${
              targetTurn.claim
            }"). Weave the shift of ${movingPlanet} into ${newDegree}° ${newSign} into practical human agency.`
          : `Provide an ideological counter-weight to the prevailing reaction, specifically answering: "${targetTurn.claim}".`,
    })
  }

  // Voice 4 (turnIndex 3): Moving body takes the floor last (Inauguration)
  const targetTurn = lastTurn
    ? { turnId: lastTurn.turnId, speakerName: lastTurn.speakerName, claim: lastTurn.claim || '' }
    : {
        speakerName: planetFromCouncilKey(thirdKey) || 'Chamber Anchor',
        claim: 'the synthesis',
      }
  return buildTurnDirective({
    ctx,
    speakerKey: movingKey,
    speechAct: 'inaugurate',
    isSeekerTurn: false,
    targetTurn,
    directive: `You have arrived in ${newDegree}° ${newSign}. Answer the chamber's reactions (specifically addressing ${
      targetTurn.speakerName
    }'s claim: "${targetTurn.claim}") and inaugurate your station with decisive intent.`,
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
  const directives: TurnDirective[] = []
  const workingRecentTurns = [...ctx.recentTurns]

  for (let i = 0; i < 4; i++) {
    const turnCtx = {
      ...ctx,
      recentTurns: workingRecentTurns,
    }
    const dir = directIngressTurn(turnCtx, movingKey, newSign, newDegree, i)
    directives.push(dir)
    workingRecentTurns.push({
      turnId: `ingress-seq-${i}`,
      speakerKey: dir.speakerKey,
      speakerName: dir.speakerName,
      text: dir.directive,
      claim: dir.directive,
      speechAct: dir.speechAct,
    })
  }

  return directives
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
  const speakerName = speakerKey === 'gregory' ? 'Gregory Castro' : speaker?.planet || 'Delegate'

  // Extract 2 or 3 salient evidence items
  const evidenceItems: SelectedEvidenceItem[] = []

  if (speakerKey === 'gregory') {
    const placements = Object.values(ctx.sky).filter(body => body.key !== 'gregory')
    evidenceItems.push({
      id: 'host-sky-overview',
      label: placements
        .map(body => `${body.planet} in ${body.sign}${body.retrograde ? ' retrograde' : ''}`)
        .join('; '),
    })
    const actualClaims = ctx.recentTurns
      .slice(-4)
      .map(turn => `${turn.speakerName}: ${turn.claim || turn.text}`)
      .join('; ')
    evidenceItems.push({
      id: 'host-prior-claims',
      label:
        actualClaims ||
        'No prior generated readings; orient the reader using the supplied placements.',
    })
    const top = [...ctx.aspects].filter(aspect => aspect.major).sort((a, b) => a.orb - b.orb)[0]
    if (top)
      evidenceItems.push({
        id: `aspect-${top.bodyA}-${top.bodyB}`,
        label: `${ctx.sky[top.bodyA].planet} ${top.aspectName} ${ctx.sky[top.bodyB].planet} (${top.phase})`,
        aspectName: top.aspectName,
        relationship: {
          bodyA: ctx.sky[top.bodyA].planet,
          bodyB: ctx.sky[top.bodyB].planet,
          phase: top.phase,
        },
      })
    return {
      speakerKey,
      speakerName,
      targetTurnId: targetTurn?.turnId,
      targetSpeakerName: targetTurn?.speakerName,
      targetClaim: targetTurn?.claim,
      speechAct,
      evidence: evidenceItems as TurnDirective['evidence'],
      directive,
      wordTarget: { min: 70, max: 120 },
    }
  }

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
      relationship: { bodyA: speakerName, bodyB: otherName, phase: topAspect.phase },
    })
  } else {
    evidenceItems.push({
      id: `seat-${speakerKey}`,
      label: `${speakerName} in ${speaker.sign} (${speaker.degreeLabel})`,
      placement: {
        planet: speakerName,
        sign: speaker.sign,
        dignity: speaker.dignity,
        retrograde: speaker.retrograde,
      },
    })
  }

  // Evidence 2: Dignity posture
  evidenceItems.push({
    id: `dignity-${speakerKey}`,
    label: `${speakerName} in ${speaker.sign} ${speaker.dignity} posture`,
    placement: {
      planet: speakerName,
      sign: speaker.sign,
      dignity: speaker.dignity,
      retrograde: speaker.retrograde,
    },
  })

  // Evidence 3: Transit contact with seeker natal chart ONLY if an actual aspect exists within orb
  if (ctx.attachedNatalChart && ctx.attachedNatalChart.placements.length > 0) {
    let bestNatalAspect: { placement: any; aspect: any } | null = null
    let minOrb = 4.5

    for (const np of ctx.attachedNatalChart.placements) {
      const natalLong = signToLongitude(np.sign, np.deg)
      const hit = detectAspect(speaker.absoluteDegree, natalLong)
      if (hit && hit.orb < minOrb) {
        minOrb = hit.orb
        bestNatalAspect = { placement: np, aspect: hit }
      }
    }

    if (bestNatalAspect) {
      const { placement, aspect } = bestNatalAspect
      evidenceItems.push({
        id: `ev-natal-${speakerKey}-${placement.body.toLowerCase()}`,
        label: `Transit ${speakerName} at ${speaker.degreeLabel} ${speaker.sign} ${aspect.name.toLowerCase()} seeker's natal ${placement.body} at ${Math.round(placement.deg)}° ${placement.sign} (orb ${aspect.orb.toFixed(1)}°)`,
        aspectName: aspect.name,
        orb: aspect.orb,
      })
    }
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
    wordTarget: isSeekerTurn ? { min: 60, max: 110 } : { min: 45, max: 80 },
  }
}
