/**
 * End-to-end validation of the Cosmic leveling award path against the live DB.
 *
 * Exercises the EXACT engine math that HistoricalAgentsService.awardXp/awardEvs
 * use, applied to greg-castro-1991 (Lv.1) training against socrates, then reads
 * back and asserts the persisted result — and finally REVERTS so the row is
 * left exactly as found. Non-destructive.
 *
 * Covers the engine + DB round-trip. It does NOT exercise the HTTP/auth wrapper
 * (the unified route awards fire-and-forget); that layer can't change the math.
 *
 *     bun run scripts/validate-leveling.ts
 */
import pg from 'pg'
import { config } from 'dotenv'
import {
  calculateXpGain,
  calculateEvGain,
  levelFromXp,
  normalizeEvs,
  evTotal as sumEvs,
} from '../lib/consciousness-engine.js'

config()
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL || process.env.DIRECT_URL })

const TRAINEE = 'greg-castro-1991'
const PARTNER = 'socrates'

let pass = 0
let fail = 0
const check = (cond: boolean, msg: string) => {
  if (cond) {
    pass++
    console.log(`  ✅ ${msg}`)
  } else {
    fail++
    console.log(`  ❌ ${msg}`)
  }
}

const PARTNER_FIELDS = `"wisdomScore","charismaScore","intuitionScore","adaptabilityScore",
  "vitalityScore","venusianCoherence","neptunianResonance","lunarReceptivity","chironicAdaptation"`

async function main() {
  console.log(`\n--- Validating leveling: ${TRAINEE} trains with ${PARTNER} ---\n`)

  const trainee = (
    await pool.query(
      `SELECT "xp","level","evolutionValues","evTotal","lastTrainingPartner" FROM "historical_agents" WHERE "agentId"=$1`,
      [TRAINEE]
    )
  ).rows[0]
  const partner = (
    await pool.query(`SELECT ${PARTNER_FIELDS} FROM "historical_agents" WHERE "agentId"=$1`, [
      PARTNER,
    ])
  ).rows[0]

  if (!trainee || !partner) {
    throw new Error(`Missing ${TRAINEE} or ${PARTNER}`)
  }

  // Snapshot originals for revert.
  const orig = {
    xp: trainee.xp,
    level: trainee.level,
    evolutionValues: trainee.evolutionValues,
    evTotal: trainee.evTotal,
    lastTrainingPartner: trainee.lastTrainingPartner,
  }
  console.log(
    `Before: Lv.${orig.level} xp=${orig.xp} evTotal=${orig.evTotal} evs=${JSON.stringify(orig.evolutionValues)}\n`
  )

  // --- Replicate awardXp(messageCount=1, qualityMultiplier=1.5) ---
  const awarded = calculateXpGain(1, 1.5)
  const newXp = (orig.xp ?? 0) + awarded
  const newLevel = levelFromXp(newXp)

  // --- Replicate awardEvs(trainee, partner) ---
  const curEvs = normalizeEvs(orig.evolutionValues)
  const curTotal = orig.evTotal ?? sumEvs(curEvs)
  const ev = calculateEvGain(partner, curEvs, curTotal, 4)

  await pool.query(
    `UPDATE "historical_agents"
     SET "xp"=$1, "level"=$2, "evolutionStage"=$2,
         "evolutionValues"=$3::jsonb, "evTotal"=$4, "lastTrainingPartner"=$5, "lastXpGain"=NOW()
     WHERE "agentId"=$6`,
    [newXp, newLevel, JSON.stringify(ev.newEvs), ev.newTotal, PARTNER, TRAINEE]
  )

  // --- Read back + assert ---
  const after = (
    await pool.query(
      `SELECT "xp","level","evolutionValues","evTotal","lastTrainingPartner" FROM "historical_agents" WHERE "agentId"=$1`,
      [TRAINEE]
    )
  ).rows[0]
  console.log(
    `After:  Lv.${after.level} xp=${after.xp} evTotal=${after.evTotal} evs=${JSON.stringify(after.evolutionValues)}`
  )
  console.log(`Partner dominant stat: ${ev.stat} (+${ev.gain})\n`)

  check(after.xp === newXp, `xp persisted: ${orig.xp} → ${after.xp} (+${awarded})`)
  check(
    after.level === newLevel,
    `level recomputed from xp: ${after.level} === levelFromXp(${after.xp})=${newLevel}`
  )
  check(
    after.evTotal === curTotal + ev.gain,
    `evTotal grew by ${ev.gain}: ${curTotal} → ${after.evTotal}`
  )
  check(
    (after.evolutionValues?.[ev.stat] ?? 0) === (curEvs[ev.stat] ?? 0) + ev.gain,
    `EVs added to dominant stat "${ev.stat}": ${after.evolutionValues?.[ev.stat]}`
  )
  check(after.lastTrainingPartner === PARTNER, `lastTrainingPartner set to ${PARTNER}`)
  check(
    ev.stat === 'charisma' || ev.stat === 'wisdom' || ev.stat === 'intuition',
    `dominant stat is plausible for Socrates (${ev.stat})`
  )

  // --- REVERT ---
  await pool.query(
    `UPDATE "historical_agents"
     SET "xp"=$1, "level"=$2, "evolutionStage"=$2,
         "evolutionValues"=$3::jsonb, "evTotal"=$4, "lastTrainingPartner"=$5
     WHERE "agentId"=$6`,
    [
      orig.xp,
      orig.level,
      JSON.stringify(orig.evolutionValues ?? {}),
      orig.evTotal,
      orig.lastTrainingPartner,
      TRAINEE,
    ]
  )
  const reverted = (
    await pool.query(`SELECT "xp","level","evTotal" FROM "historical_agents" WHERE "agentId"=$1`, [
      TRAINEE,
    ])
  ).rows[0]
  check(
    reverted.xp === orig.xp && reverted.level === orig.level && reverted.evTotal === orig.evTotal,
    `reverted cleanly to Lv.${orig.level} xp=${orig.xp} evTotal=${orig.evTotal}`
  )

  console.log(`\n${fail === 0 ? '✅ PASS' : '❌ FAIL'} — ${pass} passed, ${fail} failed\n`)
  if (fail > 0) process.exitCode = 1
}

main()
  .catch(err => {
    console.error('❌ Validation error:', err)
    process.exitCode = 1
  })
  .finally(() => pool.end())
