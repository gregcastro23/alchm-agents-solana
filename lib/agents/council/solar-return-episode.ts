import { z } from 'zod'
import { generateStructuredVoice } from '@/lib/agents/persona/voiced-generation'
import { composeCouncilPersona } from './council-persona'
import {
  COUNCIL_PLANETS,
  type CouncilPlanet,
  type CouncilSpeakerKey,
  type SolarReturnCouncilEdition,
  type SolarReturnCouncilTurn,
  type SolarReturnTurnRole,
  type SpeechAct,
  type YearOverYearTelemetry,
} from './solar-return-types'
import {
  SolarReturnCouncilEditionSchema,
  SolarReturnCouncilTurnSchema,
} from './solar-return-edition-schema'
import { inspectSolarReturnDialogue } from './solar-return-review'

export const SOLAR_RETURN_PROMPT_VERSION = 'solar-return-council-v1'

export interface SolarEpisodeBeat {
  id: string
  speakerKey: CouncilSpeakerKey
  speakerName: string
  role: SolarReturnTurnRole
  instruction: string
  evidenceIds: string[]
  coverageIds: string[]
  speechAct: SpeechAct
}

function formatPlanetSign(planet: CouncilPlanet, telemetry: YearOverYearTelemetry): string {
  const retSign = telemetry.returnSky.positions[planet]?.sign ?? 'Aries'
  const todaySign = telemetry.referenceSky.positions[planet]?.sign ?? 'Aries'
  if (retSign === todaySign) {
    return `${planet} held ${retSign} both then and now`
  }
  return `${planet} occupied ${retSign} one year ago compared to ${todaySign} today`
}

export function planSolarReturnEpisode(telemetry: YearOverYearTelemetry): SolarEpisodeBeat[] {
  return [
    {
      id: 'turn-1',
      speakerKey: 'gregory',
      speakerName: 'Gregory Castro',
      role: 'opening',
      instruction:
        'Open the Solar Return Historical Council. Disclose whether this is a verified astronomical return or approximate snapshot. State the exact solar degree alignment in plain language and introduce the theme of the 365-day cycle.',
      evidenceIds: ['solar-alignment', 'overview-year-over-year'],
      coverageIds: ['solar-alignment'],
      speechAct: 'inaugurate',
    },
    {
      id: 'turn-2',
      speakerKey: 'moon',
      speakerName: 'Moon',
      role: 'planetary-reading',
      instruction: `Teach the emotional tone and instinctual rhythm of the return sky (${formatPlanetSign('Moon', telemetry)}). Contrast with today's lunar posture with plain-language ease or friction.`,
      evidenceIds: ['placement-moon', 'lunar-shift'],
      coverageIds: ['placement-moon'],
      speechAct: 'support',
    },
    {
      id: 'turn-3',
      speakerKey: 'mercury',
      speakerName: 'Mercury',
      role: 'planetary-reading',
      instruction: `Teach the intellectual pace and communication style of the return sky (${formatPlanetSign('Mercury', telemetry)}). Contrast with today without raw numbers.`,
      evidenceIds: ['placement-mercury', 'mercury-shift'],
      coverageIds: ['placement-mercury'],
      speechAct: 'qualify',
    },
    {
      id: 'turn-4',
      speakerKey: 'venus',
      speakerName: 'Venus',
      role: 'planetary-reading',
      instruction: `Teach the relational values and harmonic coherence of the return epoch (${formatPlanetSign('Venus', telemetry)}). Contrast with today's relational currents.`,
      evidenceIds: ['placement-venus', 'venus-shift'],
      coverageIds: ['placement-venus'],
      speechAct: 'support',
    },
    {
      id: 'turn-5',
      speakerKey: 'mars',
      speakerName: 'Mars',
      role: 'planetary-reading',
      instruction: `Teach the martial agency, drive, and strategic impetus of the return sky (${formatPlanetSign('Mars', telemetry)}). Contrast with today's active drive.`,
      evidenceIds: ['placement-mars', 'mars-shift'],
      coverageIds: ['placement-mars'],
      speechAct: 'challenge',
    },
    {
      id: 'turn-6',
      speakerKey: 'gregory',
      speakerName: 'Gregory Castro',
      role: 'integration',
      instruction:
        'Bridge the inner personal planet readings (Moon, Mercury, Venus, Mars) into the social and collective planetary currents. Synthesize how instinct, thought, and agency converged.',
      evidenceIds: ['inner-planets-bridge', 'overview-year-over-year'],
      coverageIds: ['inner-planets-bridge'],
      speechAct: 'synthesize',
    },
    {
      id: 'turn-7',
      speakerKey: 'jupiter',
      speakerName: 'Jupiter',
      role: 'planetary-reading',
      instruction: `Teach the social expansion and philosophical faith of the return epoch (${formatPlanetSign('Jupiter', telemetry)}). Note Jupiter's movement across the year.`,
      evidenceIds: ['placement-jupiter', 'jupiter-shift'],
      coverageIds: ['placement-jupiter'],
      speechAct: 'support',
    },
    {
      id: 'turn-8',
      speakerKey: 'saturn',
      speakerName: 'Saturn',
      role: 'planetary-reading',
      instruction: `Teach the structural discipline, enduring boundaries, and time horizons of the return epoch (${formatPlanetSign('Saturn', telemetry)}).`,
      evidenceIds: ['placement-saturn'],
      coverageIds: ['placement-saturn'],
      speechAct: 'qualify',
    },
    {
      id: 'turn-9',
      speakerKey: 'pluto',
      speakerName: 'Pluto',
      role: 'planetary-reading',
      instruction: `Teach the collective evolutionary depth and generational transmutation of the return moment (${formatPlanetSign('Pluto', telemetry)}).`,
      evidenceIds: ['placement-pluto', 'collective-evolution'],
      coverageIds: ['placement-pluto'],
      speechAct: 'reframe',
    },
    {
      id: 'turn-10',
      speakerKey: 'gregory',
      speakerName: 'Gregory Castro',
      role: 'closing',
      instruction:
        'Close the council. Synthesize at least two distinct delegate claims. Contrast the historical epoch with today’s sky. Offer two practical year-over-year reflections for the reader.',
      evidenceIds: ['closing-synthesis', 'practical-applications'],
      coverageIds: ['closing-synthesis'],
      speechAct: 'synthesize',
    },
  ]
}

function composeBriefingText(
  beat: SolarEpisodeBeat,
  telemetry: YearOverYearTelemetry
): {
  text: string
  newClaim: string
} {
  const { returnSky, referenceSky, solarAlignment, shiftedRulers } = telemetry
  const sign = solarAlignment.sign
  const deg = solarAlignment.degree
  const qualityDisclose =
    returnSky.quality === 'verified'
      ? 'verified astronomical return calculation'
      : 'approximate return snapshot'

  switch (beat.role) {
    case 'opening':
      return {
        text: `Welcome to the Solar Return Conclave. Through ${qualityDisclose}, we assemble at the precise instant the Sun crosses its exact annual coordinate in ${sign}. One full tropical cycle ago, the celestial sphere held a distinct equilibrium. Today we bring our historical positions into dialogue with the living sky, illuminating what has grown, what has dissolved, and what requires renewal.`,
        newClaim: `The solar return degree in ${sign} anchors our annual benchmark for celestial and personal evolution.`,
      }

    case 'integration': {
      const moonShift = shiftedRulers.find(r => r.planet === 'Moon')
      const marsShift = shiftedRulers.find(r => r.planet === 'Mars')
      const mText = moonShift?.shifted
        ? `the Moon has transitioned from ${moonShift.fromSign} into ${moonShift.toSign}`
        : 'the lunar light remained steadfast'
      const aText = marsShift?.shifted
        ? `Mars pivoted from ${marsShift.fromSign} toward ${marsShift.toSign}`
        : 'martial impetus preserved its direction'
      return {
        text: `We pause here at the midpoint of our circle. The personal councils show us that while ${mText}, ${aText}. Our inner architecture of feeling, intellect, and agency carries the imprint of that earlier chapter. Now we open our ears to the outer council—Jupiter, Saturn, and the deep transformers—to see what collective tide carried that personal work forward.`,
        newClaim: `Personal planetary transitions between the return chart and today build the foundation for collective growth.`,
      }
    }

    case 'closing': {
      const retElements = returnSky.elements
      const refElements = referenceSky.elements
      const retDom =
        retElements.percentages.water > retElements.percentages.fire ? 'Water' : 'Earth'
      const refDom = refElements.percentages.fire > refElements.percentages.water ? 'Fire' : 'Air'
      return {
        text: `Synthesizing our delegates' testimonies: the Moon reminded us of emotional endurance while Mars illuminated how strategic patience prepared the ground for present action. Looking across the 365-day arc, our return sky was deeply concentrated in ${retDom}, contrasting with today's dynamic surge in ${refDom}. First, look back at the seeds you planted when the Sun stood here last autumn and acknowledge what matured in silence. Second, use today's shifting elemental heat not to abandon past structures, but to animate them with fresh conviction.`,
        newClaim: `Integrating the return chart's reflective stillness with today's expressive momentum yields sustainable personal mastery.`,
      }
    }

    case 'planetary-reading': {
      const planet =
        beat.speakerKey === 'gregory'
          ? 'Sun'
          : (COUNCIL_PLANETS.find(p => p.toLowerCase() === beat.speakerKey) ?? 'Sun')
      const pos = returnSky.positions[planet]
      const cur = referenceSky.positions[planet]
      const shiftNotice =
        pos.sign !== cur.sign
          ? `While today I stand in ${cur.sign}, in this historical return sky I spoke through ${pos.sign}`
          : `I maintain my continuous station in ${pos.sign}`

      return {
        text: `Speaking from my return station, ${shiftNotice}. In ${pos.sign}, my planetary function operates with distinct symbolic depth, asking for patience and purposeful alignment with cosmic law. When we contrast that past moment against the current sky, we recognize how every cycle prepares the heart for its subsequent awakening.`,
        newClaim: `${planet} in ${pos.sign} highlights the essential virtues of its return placement before shifting forward.`,
      }
    }
  }
}

/**
 * Deterministic, verified briefing edition.
 * Guarantees zero latency and 100% schema validity even in offline environments.
 */
export function createSolarReturnBriefingEdition(
  telemetry: YearOverYearTelemetry,
  date: string
): SolarReturnCouncilEdition {
  const beats = planSolarReturnEpisode(telemetry)
  const turns: SolarReturnCouncilTurn[] = []

  for (const beat of beats) {
    const { text, newClaim } = composeBriefingText(beat, telemetry)
    turns.push({
      id: beat.id,
      speakerKey: beat.speakerKey,
      speakerName: beat.speakerName,
      role: beat.role,
      text,
      newClaim,
      speechAct: beat.speechAct,
      usedEvidenceIds: [...beat.evidenceIds],
      coverageIds: [...beat.coverageIds],
      provenance: { source: 'grounded_briefing' },
    })
  }

  const coveredTopics = Array.from(new Set(turns.flatMap(t => t.coverageIds)))
  const title = `Solar Return Conclave · ${telemetry.solarAlignment.sign} ${telemetry.solarAlignment.degree}° Alignment`
  const summary = `Historical Planetary Council convening Gregory Castro and the ten planetary delegates to debate the celestial state from exactly one tropical year ago, contrasting historical balance with today.`

  const rawEdition: SolarReturnCouncilEdition = {
    schemaVersion: 1,
    id: `solar-return-council-v1:${date}`,
    date,
    timeZone: 'UTC',
    title,
    summary,
    returnIso: telemetry.returnSky.iso,
    referenceIso: telemetry.referenceSky.iso,
    quality: telemetry.returnSky.quality,
    source: telemetry.returnSky.source,
    telemetry,
    turns,
    coveredTopics,
    generatedAt: new Date().toISOString(),
    promptVersion: SOLAR_RETURN_PROMPT_VERSION,
  }

  const parsed = SolarReturnCouncilEditionSchema.parse(rawEdition)
  return parsed
}

/**
 * Full episode generator with LLM voice synthesis and bounded editorial repair pass.
 */
export async function generateSolarReturnEdition(
  telemetry: YearOverYearTelemetry,
  date: string,
  options?: {
    deadlineMs?: number
    generate?: boolean
  }
): Promise<SolarReturnCouncilEdition> {
  if (options?.generate === false) {
    return createSolarReturnBriefingEdition(telemetry, date)
  }

  const deadline = Math.min(options?.deadlineMs ?? Date.now() + 180_000, Date.now() + 200_000)
  const beats = planSolarReturnEpisode(telemetry)
  const turns: SolarReturnCouncilTurn[] = []

  for (const beat of beats) {
    const remainingMs = deadline - Date.now()
    if (remainingMs < 5_000) {
      // Time exhausted: fill remaining turns with verified briefing prose
      const { text, newClaim } = composeBriefingText(beat, telemetry)
      turns.push({
        id: beat.id,
        speakerKey: beat.speakerKey,
        speakerName: beat.speakerName,
        role: beat.role,
        text,
        newClaim,
        speechAct: beat.speechAct,
        usedEvidenceIds: [...beat.evidenceIds],
        coverageIds: [...beat.coverageIds],
        provenance: { source: 'grounded_briefing' },
      })
      continue
    }

    const abort = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined
    const timeoutPromise = new Promise<null>(resolve => {
      timer = setTimeout(
        () => {
          abort.abort()
          resolve(null)
        },
        Math.min(15_000, remainingMs)
      )
    })

    const planet =
      beat.speakerKey === 'gregory'
        ? undefined
        : telemetry.returnSky.positions[
            COUNCIL_PLANETS.find(p => p.toLowerCase() === beat.speakerKey) ?? 'Sun'
          ]

    const systemPrompt = composeCouncilPersona(beat.speakerKey, {
      placement: planet,
      theme: beat.instruction,
    })

    const prompt = JSON.stringify({
      councilSession: 'Solar Return Historical Conclave (1 Year Ago)',
      role: beat.role,
      speaker: beat.speakerName,
      instruction: beat.instruction,
      returnPlacement: planet,
      priorTurns: turns.slice(-2).map(t => ({ speaker: t.speakerName, claim: t.newClaim })),
      requiredEvidence: beat.evidenceIds,
    })

    try {
      const generated = await Promise.race([
        generateStructuredVoice(
          z.object({
            text: z.string().min(50).max(2500),
            newClaim: z.string().min(10).max(500),
          }),
          {
            systemPrompt,
            prompt,
            tier: beat.speakerKey === 'gregory' ? 'expert' : 'ambient',
            maxTokens: 900,
            abortSignal: abort.signal,
          }
        ),
        timeoutPromise,
      ])

      if (generated?.source === 'model' && generated.object) {
        const candidateTurn: SolarReturnCouncilTurn = {
          id: beat.id,
          speakerKey: beat.speakerKey,
          speakerName: beat.speakerName,
          role: beat.role,
          text: generated.object.text,
          newClaim: generated.object.newClaim,
          speechAct: beat.speechAct,
          usedEvidenceIds: [...beat.evidenceIds],
          coverageIds: [...beat.coverageIds],
          provenance: { source: 'model' },
        }
        const validated = SolarReturnCouncilTurnSchema.safeParse(candidateTurn)
        if (validated.success) {
          turns.push(validated.data)
          continue
        }
      }
    } catch {
      // Degrade gracefully to briefing prose
    } finally {
      if (timer) clearTimeout(timer)
    }

    // Fallback for this beat
    const { text, newClaim } = composeBriefingText(beat, telemetry)
    turns.push({
      id: beat.id,
      speakerKey: beat.speakerKey,
      speakerName: beat.speakerName,
      role: beat.role,
      text,
      newClaim,
      speechAct: beat.speechAct,
      usedEvidenceIds: [...beat.evidenceIds],
      coverageIds: [...beat.coverageIds],
      provenance: { source: 'grounded_briefing' },
    })
  }

  // Editorial review pass
  const review = await inspectSolarReturnDialogue(telemetry, turns, deadline)
  if (!review.acceptable && review.issues.length > 0) {
    // Perform single bounded repair pass on flagged turns
    for (const issue of review.issues) {
      const turnIndex = turns.findIndex(t => t.id === issue.turnId)
      if (turnIndex >= 0) {
        const beat = beats[turnIndex]
        const { text, newClaim } = composeBriefingText(beat, telemetry)
        turns[turnIndex] = {
          ...turns[turnIndex],
          text,
          newClaim,
          provenance: { source: 'grounded_briefing' },
        }
      }
    }
  }

  const coveredTopics = Array.from(new Set(turns.flatMap(t => t.coverageIds)))
  const title = `Solar Return Conclave · ${telemetry.solarAlignment.sign} ${telemetry.solarAlignment.degree}° Alignment`
  const summary = `Historical Planetary Council convening Gregory Castro and the ten planetary delegates to debate the celestial state from exactly one tropical year ago, contrasting historical balance with today.`

  const rawEdition: SolarReturnCouncilEdition = {
    schemaVersion: 1,
    id: `solar-return-council-v1:${date}`,
    date,
    timeZone: 'UTC',
    title,
    summary,
    returnIso: telemetry.returnSky.iso,
    referenceIso: telemetry.referenceSky.iso,
    quality: telemetry.returnSky.quality,
    source: telemetry.returnSky.source,
    telemetry,
    turns,
    coveredTopics,
    generatedAt: new Date().toISOString(),
    promptVersion: SOLAR_RETURN_PROMPT_VERSION,
  }

  return SolarReturnCouncilEditionSchema.parse(rawEdition)
}
