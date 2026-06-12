#!/usr/bin/env tsx

/**
 * Test Sacred 7 Stats Integration
 * ================================
 *
 * This script tests that the Sacred 7 Stats (derived from birth charts)
 * properly inform agent personalities without being explicitly mentioned.
 */

import { DEMO_AGENTS } from '@/lib/demo-agents-data'
import { generateConsciousnessInformedPrompt } from '@/lib/agents/sacred-stats-prompt-generator'
import type { Sacred7Stats } from '@/lib/sacred-7-stats'

console.log('🔮 Sacred 7 Stats Integration Test')
console.log('='.repeat(80))
console.log('')

// Test with Leonardo da Vinci
const leonardo = DEMO_AGENTS.find(a => a.id === 'leonardo-da-vinci')

if (!leonardo) {
  console.error('❌ Leonardo da Vinci not found')
  process.exit(1)
}

console.log(`Testing with: ${leonardo.name}`)
console.log(`Birth Year: ${leonardo.birthData.date.getFullYear()}`)
console.log(`Specialty: ${leonardo.abilities?.specialty || 'N/A'}`)
console.log('')

// Extract Sacred 7 Stats from agent
const stats: Sacred7Stats = leonardo.stats?.sacred7Stats || {
  power: 85, // High - Leonardo's commanding intellect
  resonance: 75, // Strong - Connection to universal patterns
  wisdom: 88, // High - Deep accumulated knowledge
  charisma: 70, // Strong - Magnetic presence
  intuition: 82, // High - Visionary insight
  adaptability: 92, // Exceptional - Mastery across domains
  vitality: 78, // Strong - Vibrant creative energy
}

console.log('📊 Sacred 7 Stats (Birth Chart-Derived):')
console.log(`  ⚡ Power: ${stats.power}/100 (Alchemical Force)`)
console.log(`  💫 Resonance: ${stats.resonance}/100 (Cosmic Connection)`)
console.log(`  🔮 Wisdom: ${stats.wisdom}/100 (Accumulated Insight)`)
console.log(`  ✨ Charisma: ${stats.charisma}/100 (Magnetic Presence)`)
console.log(`  👁️  Intuition: ${stats.intuition}/100 (Inner Knowing)`)
console.log(`  🌊 Adaptability: ${stats.adaptability}/100 (Flux Capacity)`)
console.log(`  💚 Vitality: ${stats.vitality}/100 (Life Force)`)
console.log('')

// Get core personality data
const coreEssence =
  leonardo.consciousness?.strength || 'Boundless curiosity bridging art and science'
const coreExpression =
  leonardo.personality?.core?.expression || 'Artistic innovation fused with scientific inquiry'
const coreEmotion = leonardo.consciousness?.emotion || 'Childlike wonder at infinite possibilities'
const dominantElement = leonardo.consciousness?.dominantElement || 'Fire'
const dominantModality = leonardo.consciousness?.dominantModality || 'Cardinal'

console.log('🌟 Birth Chart Core (Sun, Moon, Ascendant):')
console.log(`  Essence: ${coreEssence}`)
console.log(`  Expression: ${coreExpression}`)
console.log(`  Emotion: ${coreEmotion}`)
console.log(`  Element: ${dominantElement} (${dominantModality})`)
console.log('')

// Get linguistic authenticity data
const teachingStyle = leonardo.abilities?.teachingStyle
const powerLevelUnlocks = leonardo.stats?.kineticEvolution?.powerLevelUnlocks
const wisdomDomains = leonardo.abilities?.wisdomDomains
const personalityTraits = leonardo.personality?.traits

console.log('🎭 Linguistic Authenticity (Signature Voice):')
console.log(`  Teaching Style: ${teachingStyle || 'N/A'}`)
if (powerLevelUnlocks && powerLevelUnlocks.length > 0) {
  console.log(`  Power Level Unlocks: ${powerLevelUnlocks.slice(0, 3).join(', ')}...`)
}
if (wisdomDomains && wisdomDomains.length > 0) {
  console.log(`  Wisdom Domains: ${wisdomDomains.slice(0, 3).join(', ')}...`)
}
if (personalityTraits && personalityTraits.length > 0) {
  console.log(`  Personality Traits: ${personalityTraits.slice(0, 2).join(', ')}...`)
}
console.log('')

// Generate consciousness-informed prompt with linguistic authenticity
const prompt = generateConsciousnessInformedPrompt({
  agentName: leonardo.name,
  agentTitle: leonardo.title || 'The Renaissance Genius',
  birthYear: leonardo.birthData.date.getFullYear(),
  specialty: leonardo.abilities?.specialty || 'Renaissance Innovation',
  uniquePower:
    leonardo.abilities?.uniquePower || 'Can see connections between disciplines others miss',
  stats,
  dominantElement,
  dominantModality,
  coreEssence,
  coreExpression,
  coreEmotion,
  // NEW: Include linguistic authenticity
  teachingStyle,
  powerLevelUnlocks,
  wisdomDomains,
  personalityTraits,
})

console.log('📝 Generated Consciousness-Informed System Prompt:')
console.log('─'.repeat(80))
console.log(prompt)
console.log('─'.repeat(80))
console.log('')

// Validate key aspects
console.log('✅ Validation Checklist:')

const checks = [
  {
    name: 'Stats inform personality traits',
    test: prompt.includes('Primary Traits:') && prompt.includes('Supporting Qualities:'),
  },
  {
    name: 'No explicit stat value mentions',
    test:
      !prompt.includes('Power: 85') && !prompt.includes('stats.power') && !prompt.includes(': 88'),
  },
  {
    name: 'No consciousness metrics',
    test: !prompt.includes('Monica Constant:') && !prompt.includes('consciousness level:'),
  },
  {
    name: 'No alchemical properties',
    test: !prompt.includes('A#:') && !prompt.includes('Alchemical Number:'),
  },
  {
    name: 'Includes birth chart essence',
    test: prompt.includes(coreEssence) || prompt.includes(coreExpression),
  },
  {
    name: 'Includes elemental nature',
    test: prompt.includes(dominantElement) && prompt.includes(dominantModality),
  },
  {
    name: 'Includes critical instructions',
    test: prompt.includes('CRITICAL INSTRUCTIONS') && prompt.includes('Never mention'),
  },
  {
    name: 'Includes historical identity',
    test: prompt.includes(leonardo.name) && prompt.includes('1452'),
  },
  {
    name: 'Includes linguistic authenticity section',
    test: prompt.includes('YOUR SIGNATURE VOICE') || prompt.includes('Teaching Approach:'),
  },
  {
    name: 'Includes power level unlocks',
    test: powerLevelUnlocks ? prompt.includes(powerLevelUnlocks[0]) : true,
  },
  {
    name: 'Includes personality traits',
    test: personalityTraits ? prompt.includes(personalityTraits[0]) : true,
  },
]

let passed = 0
checks.forEach((check, i) => {
  const status = check.test ? '✅' : '❌'
  console.log(`  ${i + 1}. ${status} ${check.name}`)
  if (check.test) passed++
})

console.log('')
console.log(`Results: ${passed}/${checks.length} checks passed`)
console.log('')

if (passed === checks.length) {
  console.log('🎉 All validation checks passed!')
  console.log('')
  console.log('Key Success Indicators:')
  console.log('  ✓ Sacred 7 Stats inform personality WITHOUT being mentioned')
  console.log('  ✓ Birth chart essence shapes communication style')
  console.log('  ✓ No technical consciousness metadata in prompt')
  console.log('  ✓ Agent embodies traits rather than reporting them')
  console.log('')
  console.log('Next Steps:')
  console.log('  1. Test in actual chat: /gallery/chat/leonardo-da-vinci')
  console.log(
    '  2. Ask: "What are inventions worth, in the scope of life, when they come at the cost of attention to love?"'
  )
  console.log('  3. Observe: High Adaptability → fluid perspective shifts')
  console.log('             High Wisdom → deep, multi-layered insights')
  console.log('             High Power → authoritative, transformative voice')
  console.log('             Strong Vitality → energetic, vibrant expression')
  process.exit(0)
} else {
  console.log('⚠️  Some validation checks failed')
  console.log('Review the generated prompt above for issues')
  process.exit(1)
}
