/** Offline by default. --live explicitly enables bounded provider generation. No database writes. */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { getCurrentPlanetaryPositions } from '@/lib/calculate-transits'
import { buildDailySkyBrief, utcCouncilDay } from '@/lib/agents/council/daily-sky'
import {
  generateDailyEdition,
  type DailyGenerationDiagnostic,
} from '@/lib/agents/council/daily-episode'
import { DailyCouncilEditionSchema } from '@/lib/agents/council/daily-edition-schema'

const args = process.argv.slice(2)
const dateArg = args.find(arg => arg.startsWith('--date='))?.slice(7)
const outputArg = args.find(arg => arg.startsWith('--output='))?.slice(9)
const day = utcCouncilDay(dateArg ? new Date(`${dateArg}T00:00:00.000Z`) : new Date())
const live = args.includes('--live')
const brief = buildDailySkyBrief({
  date: day.start,
  positions: getCurrentPlanetaryPositions(day.start, { requireComplete: true }),
  source: 'vsop87-approximation',
})
const diagnostics: DailyGenerationDiagnostic[] = []
const edition = await generateDailyEdition(brief, {
  generate: live,
  deadlineMs: Date.now() + 150_000,
  onDiagnostic: event => diagnostics.push(event),
})
const parsed = DailyCouncilEditionSchema.safeParse(edition)
if (!parsed.success)
  throw new Error(
    `Edition contract failed: ${parsed.error.issues.map(issue => issue.message).join('; ')}`
  )
const words = edition.turns.reduce((total, turn) => total + turn.text.split(/\s+/).length, 0)
const modelTurns = edition.turns.filter(turn => turn.provenance.source === 'model').length
const report = [
  `# Daily planetary council evaluation · ${day.date}`,
  '',
  `Mode: ${live ? 'opt-in model generation' : 'offline deterministic briefing'}. Sky: explicitly approximate local Keplerian positions at ${brief.asOf}; no verified event timing. This sample is not a verified ephemeris reading.`,
  '',
  `Contract: passed. Turns: ${edition.turns.length}. Model turns: ${modelTurns}. Factual fallback turns: ${edition.turns.length - modelTurns}. Words: ${words}. Required topics covered: ${brief.requiredCoverage.length}/${brief.requiredCoverage.length}.`,
  `Generation diagnostics: ${JSON.stringify(Object.fromEntries([...new Set(diagnostics.map(event => `${event.phase}:${event.outcome}:${event.reason}`))].map(key => [key, diagnostics.filter(event => `${event.phase}:${event.outcome}:${event.reason}` === key).length])))}`,
  '',
  'Human review rubric: factual fidelity to the supplied snapshot; distinct planetary voices; understandable sign/aspect explanations; meaningful responses to earlier claims; Greg’s curiosity and synthesis; specific everyday applications; repetition and reading length. Passing the contract does not establish these subjective qualities.',
  '',
  ...edition.turns.flatMap(turn => [
    `## ${turn.speakerName} · ${turn.provenance.source}`,
    '',
    turn.text,
    '',
  ]),
].join('\n')
const output = path.resolve(
  outputArg || `/private/tmp/daily-council-${day.date}${live ? '-live' : ''}.md`
)
await mkdir(path.dirname(output), { recursive: true })
await writeFile(output, report)
await writeFile(output.replace(/\.md$/, '') + '.json', JSON.stringify(edition, null, 2))
console.log(
  JSON.stringify({
    output,
    generation: edition.generation,
    modelTurns,
    turns: edition.turns.length,
    words,
    valid: true,
    diagnostics,
  })
)
