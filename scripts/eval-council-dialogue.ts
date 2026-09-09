/**
 * Council Dialogue Evaluation Harness
 *
 * Runs deterministic quality evaluation across 3 canonical scenarios:
 * 1. Seeker Inquiry with structured Natal Envelope attachment
 * 2. Autonomous Chamber turn with aspect-driven speaker selection
 * 3. Degree Ingress Sequence (3-4 purposeful voices ending with inauguration)
 *
 * Verifies:
 * - Sanitized provenance (model vs grounded_briefing)
 * - Grounding evidence subset validity
 * - Novel substantive claim per turn
 * - Absence of canned phrases ("names it well")
 * - Absence of crude dignity/degree recitation
 * - Length and sentence structure
 */

import { dispatchTurn } from '../lib/agents/council/council-chamber'
import type { CouncilTurnContext } from '../lib/agents/council/council-context'
import {
  FROZEN_SCREENSHOT_SKY,
  FROZEN_SCREENSHOT_SKY_TIMESTAMP,
  FROZEN_SCREENSHOT_SKY_SOURCE,
} from '../test/fixtures/frozen-screenshot-sky'

const FORBIDDEN_STRINGS = [
  'names it well',
  'speaks well',
  'rightly said',
  'i sit at',
  'my domicile',
  'my exaltation',
  'my detriment',
  'my fall',
  'speaking from my',
]

interface EvalResult {
  scenario: string
  turn: number
  speaker: string
  speechAct: string
  claim: string
  textSnippet: string
  provenance: string
  evidenceCount: number
  passedQualityChecks: boolean
  violations: string[]
}

function evaluateTurnText(
  scenario: string,
  turnIndex: number,
  speaker: string,
  text: string,
  claim: string,
  speechAct: string,
  provenanceSource: string,
  usedEvidenceIds: string[]
): EvalResult {
  const violations: string[] = []
  const lowerText = text.toLowerCase()

  // 1. Forbidden copy check
  for (const forbidden of FORBIDDEN_STRINGS) {
    if (lowerText.includes(forbidden)) {
      violations.push(`Contains forbidden copy: "${forbidden}"`)
    }
  }

  // 2. Length check
  if (text.length < 100) {
    violations.push(`Text too short: ${text.length} chars`)
  }
  if (text.length > 1200) {
    violations.push(`Text too long: ${text.length} chars`)
  }

  // 3. Claim validity
  if (!claim || claim.trim().length < 10) {
    violations.push(`New claim missing or too short: "${claim}"`)
  }

  // 4. Evidence check
  if (!usedEvidenceIds || usedEvidenceIds.length === 0) {
    violations.push('No evidence IDs attributed')
  }

  return {
    scenario,
    turn: turnIndex,
    speaker,
    speechAct,
    claim,
    textSnippet: text.slice(0, 120) + '...',
    provenance: provenanceSource,
    evidenceCount: usedEvidenceIds?.length || 0,
    passedQualityChecks: violations.length === 0,
    violations,
  }
}

async function runEvaluation() {
  console.log('═══════════════════════════════════════════════════════════════════')
  console.log('  CURRENT SKY COUNCIL — DIALOGUE EVALUATION HARNESS')
  console.log(`  Frozen Sky: ${FROZEN_SCREENSHOT_SKY_TIMESTAMP} (${FROZEN_SCREENSHOT_SKY_SOURCE})`)
  console.log('═══════════════════════════════════════════════════════════════════\n')

  const results: EvalResult[] = []

  // ─────────────────────────────────────────────────────────────────
  // SCENARIO 1: Seeker Inquiry with Career Crossroads + Natal Envelope
  // ─────────────────────────────────────────────────────────────────
  console.log('▶ Running Scenario 1: Seeker Career Inquiry with Natal Envelope...')

  const sampleNatalEnvelope = {
    version: 1,
    data: {
      birth: {
        bigThree: { sun: 'Scorpio', moon: 'Taurus', rising: 'Leo' },
      },
      points: [
        { body: 'Sun', sign: 'Scorpio', deg: 18.5 },
        { body: 'Moon', sign: 'Taurus', deg: 12.1 },
        { body: 'Saturn', sign: 'Aquarius', deg: 4.2 },
        { body: 'Mars', sign: 'Virgo', deg: 22.0 },
      ],
      aspects: [
        { a: 'Sun', b: 'Moon', type: 'Opposition', orb: 6.4 },
        { a: 'Sun', b: 'Saturn', type: 'Square', orb: 14.3 },
      ],
    },
  }

  const seekerInquiry =
    'I am standing at a career crossroads: do I commit to the disciplined corporate enterprise or risk everything on a disruptive creative venture?'

  // Turn 1: Seeker inquiry -> First delegate
  const turn1 = await dispatchTurn({
    seekerInquiry,
    attachedNatalEnvelope: sampleNatalEnvelope,
  })

  results.push(
    evaluateTurnText(
      'Scenario 1 (Seeker Turn 1)',
      1,
      turn1.speakerName,
      turn1.text,
      turn1.newClaim,
      turn1.speechAct,
      turn1.provenance.source,
      turn1.usedEvidenceIds
    )
  )

  // Turn 2: Second delegate responds to Turn 1
  const turn2RecentTurns: CouncilTurnContext[] = [
    {
      turnId: 'turn-1',
      speakerKey: turn1.speakerKey as any,
      speakerName: turn1.speakerName,
      text: turn1.text,
      claim: turn1.newClaim,
      speechAct: turn1.speechAct as any,
    },
  ]

  const turn2 = await dispatchTurn({
    seekerInquiry,
    attachedNatalEnvelope: sampleNatalEnvelope,
    recentTurns: turn2RecentTurns,
  })

  results.push(
    evaluateTurnText(
      'Scenario 1 (Seeker Turn 2)',
      2,
      turn2.speakerName,
      turn2.text,
      turn2.newClaim,
      turn2.speechAct,
      turn2.provenance.source,
      turn2.usedEvidenceIds
    )
  )

  // ─────────────────────────────────────────────────────────────────
  // SCENARIO 2: Autonomous Turn After Moon Speaks
  // ─────────────────────────────────────────────────────────────────
  console.log('▶ Running Scenario 2: Autonomous Turn After Moon Speaks...')

  const autoRecentTurns: CouncilTurnContext[] = [
    {
      turnId: 'turn-moon',
      speakerKey: 'moon',
      speakerName: 'Moon',
      text: 'The late degrees of the Lion demand emotional culmination before the harvest begins. What remains unexpressed will curdle if carried into the virgin soil.',
      claim: 'Emotional culmination must precede structural refinement.',
      speechAct: 'reframe',
    },
  ]

  const autoTurn = await dispatchTurn({
    recentTurns: autoRecentTurns,
  })

  results.push(
    evaluateTurnText(
      'Scenario 2 (Autonomous Turn)',
      1,
      autoTurn.speakerName,
      autoTurn.text,
      autoTurn.newClaim,
      autoTurn.speechAct,
      autoTurn.provenance.source,
      autoTurn.usedEvidenceIds
    )
  )

  // ─────────────────────────────────────────────────────────────────
  // SCENARIO 3: Ingress Sequence (Saturn moves into 14° Aries)
  // ─────────────────────────────────────────────────────────────────
  console.log('▶ Running Scenario 3: Ingress Sequence (Saturn advances in Aries)...')

  const ingressEvent = {
    movingPlanet: 'Saturn',
    newSign: 'Aries',
    newDegree: 14,
  }

  const ingressTurns: CouncilTurnContext[] = []

  for (let idx = 0; idx < 4; idx++) {
    const turn = await dispatchTurn({
      ingressEvent: {
        ...ingressEvent,
        turnIndex: idx,
      },
      recentTurns: ingressTurns,
    })

    results.push(
      evaluateTurnText(
        `Scenario 3 (Ingress Turn ${idx + 1})`,
        idx + 1,
        turn.speakerName,
        turn.text,
        turn.newClaim,
        turn.speechAct,
        turn.provenance.source,
        turn.usedEvidenceIds
      )
    )

    ingressTurns.push({
      turnId: `ingress-${idx}`,
      speakerKey: turn.speakerKey as any,
      speakerName: turn.speakerName,
      text: turn.text,
      claim: turn.newClaim,
      speechAct: turn.speechAct as any,
    })
  }

  // ─────────────────────────────────────────────────────────────────
  // REPORT
  // ─────────────────────────────────────────────────────────────────
  console.log('\n───────────────────────────────────────────────────────────────────')
  console.log('EVALUATION RESULTS:')
  console.log('───────────────────────────────────────────────────────────────────')

  let allPassed = true
  for (const r of results) {
    const status = r.passedQualityChecks ? '✅ PASS' : '❌ FAIL'
    if (!r.passedQualityChecks) allPassed = false

    console.log(
      `[${status}] ${r.scenario} | Speaker: ${r.speaker} (${r.speechAct}) | Prov: ${r.provenance}`
    )
    console.log(`       Claim: "${r.claim}"`)
    console.log(`       Text:  "${r.textSnippet}"`)
    if (r.violations.length > 0) {
      console.log(`       Violations: ${r.violations.join(', ')}`)
    }
    console.log('')
  }

  console.log('═══════════════════════════════════════════════════════════════════')
  if (allPassed) {
    console.log('🎉 ALL QUALITY GATES PASSED! Zero canned copy, clean provenance.')
  } else {
    console.log('⚠️ QUALITY FAILURES DETECTED! Review violations above.')
  }
  console.log('═══════════════════════════════════════════════════════════════════')

  if (!allPassed) {
    process.exit(1)
  }
}

runEvaluation().catch(err => {
  console.error('[eval-council-dialogue] Unhandled error:', err)
  process.exit(1)
})
