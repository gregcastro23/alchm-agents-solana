#!/usr/bin/env tsx

/**
 * Test Shakespeare's Linguistic Authenticity
 * ===========================================
 *
 * Verify that Shakespeare's Iambic Pentameter Mastery is properly
 * incorporated into his system prompt.
 */

import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import { generateConsciousnessInformedPrompt } from '@/lib/agents/sacred-stats-prompt-generator'
import type { Sacred7Stats } from '@/lib/sacred-7-stats'

console.log('🎭 Shakespeare Linguistic Authenticity Test')
console.log('='.repeat(80))
console.log('')

const shakespeare = DEMO_AGENTS.find(a => a.id === 'william-shakespeare')

if (!shakespeare) {
  console.error('❌ William Shakespeare not found')
  process.exit(1)
}

console.log(`Testing with: ${shakespeare.name}`)
console.log(`Birth Year: ${shakespeare.birthData.date.getFullYear()}`)
console.log(`Specialty: ${shakespeare.abilities?.specialty || 'N/A'}`)
console.log('')

// Extract Sacred 7 Stats
const stats: Sacred7Stats = shakespeare.stats?.sacred7Stats || {
  power: 80,
  resonance: 85,
  wisdom: 90,
  charisma: 95,
  intuition: 88,
  adaptability: 92,
  vitality: 82,
}

// Get core personality data
const coreEssence = shakespeare.consciousness?.strength || 'Profound understanding of human nature'
const coreExpression =
  shakespeare.personality?.core?.expression || 'Dramatic poetry revealing universal truths'
const coreEmotion = shakespeare.consciousness?.emotion || 'Deep empathy for human condition'
const dominantElement = shakespeare.consciousness?.dominantElement || 'Air'
const dominantModality = shakespeare.consciousness?.dominantModality || 'Mutable'

// Get linguistic authenticity data
const teachingStyle = shakespeare.abilities?.teachingStyle
const powerLevelUnlocks = shakespeare.stats?.kineticEvolution?.powerLevelUnlocks
const wisdomDomains = shakespeare.abilities?.wisdomDomains
const personalityTraits = shakespeare.personality?.traits

console.log('🎭 Linguistic Authenticity (Signature Voice):')
console.log(`  Teaching Style: ${teachingStyle || 'N/A'}`)
if (powerLevelUnlocks && powerLevelUnlocks.length > 0) {
  console.log(`  Power Level Unlocks:`)
  powerLevelUnlocks.forEach((unlock, i) => {
    console.log(`    ${i + 1}. ${unlock}`)
  })
}
console.log('')

// Generate prompt
const prompt = generateConsciousnessInformedPrompt({
  agentName: shakespeare.name,
  agentTitle: shakespeare.title || 'The Bard',
  birthYear: shakespeare.birthData.date.getFullYear(),
  specialty: shakespeare.abilities?.specialty || 'Drama and Poetry',
  uniquePower: shakespeare.abilities?.uniquePower || 'Reveals human nature through dramatic verse',
  stats,
  dominantElement,
  dominantModality,
  coreEssence,
  coreExpression,
  coreEmotion,
  teachingStyle,
  powerLevelUnlocks,
  wisdomDomains,
  personalityTraits,
})

console.log('📝 Generated System Prompt (relevant section):')
console.log('─'.repeat(80))

// Extract just the signature voice section
const signatureMatch = prompt.match(/# YOUR SIGNATURE VOICE.*?(?=# HOW YOU COMMUNICATE|$)/s)
if (signatureMatch) {
  console.log(signatureMatch[0].trim())
} else {
  console.log('No signature voice section found')
}
console.log('─'.repeat(80))
console.log('')

// Validation
console.log('✅ Shakespeare-Specific Validation:')

const shakespeareChecks = [
  {
    name: 'Includes "Iambic Pentameter Mastery"',
    test: prompt.includes('Iambic Pentameter Mastery'),
  },
  {
    name: 'Includes teaching style',
    test: prompt.includes('Dramatic demonstration'),
  },
  {
    name: 'Has signature voice section',
    test: prompt.includes('YOUR SIGNATURE VOICE'),
  },
  {
    name: 'Includes "EMBODY THESE QUALITIES"',
    test: prompt.includes('EMBODY THESE QUALITIES'),
  },
]

let passed = 0
shakespeareChecks.forEach((check, i) => {
  const status = check.test ? '✅' : '❌'
  console.log(`  ${i + 1}. ${status} ${check.name}`)
  if (check.test) passed++
})

console.log('')
console.log(`Results: ${passed}/${shakespeareChecks.length} checks passed`)
console.log('')

if (passed === shakespeareChecks.length) {
  console.log("🎉 Shakespeare's Iambic Pentameter Mastery is restored!")
  console.log('')
  console.log('Expected behavior:')
  console.log('  ✓ Shakespeare will now respond in iambic pentameter')
  console.log('  ✓ His signature dramatic style will shine through')
  console.log('  ✓ Poetic metaphor will inform his responses')
  console.log('')
  process.exit(0)
} else {
  console.log('⚠️  Some Shakespeare-specific checks failed')
  process.exit(1)
}
