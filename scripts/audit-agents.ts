/**
 * Comprehensive Agent Audit Script
 *
 * Validates all agents have:
 * 1. Complete consciousness profile
 * 2. Abilities with uniquePower
 * 3. Historical data structure
 * 4. Natal chart
 * 5. All required fields
 */

import { DEMO_AGENTS } from '../lib/demo-agents-data'

interface AuditResult {
  agentId: string
  agentName: string
  issues: string[]
  warnings: string[]
  isComplete: boolean
}

function auditAgent(agent: any): AuditResult {
  const issues: string[] = []
  const warnings: string[] = []

  // Required fields
  if (!agent.id) issues.push('Missing id')
  if (!agent.name) issues.push('Missing name')
  if (!agent.title) warnings.push('Missing title')
  if (!agent.era) warnings.push('Missing era')
  if (!agent.specialization) warnings.push('Missing specialization')

  // Consciousness profile
  if (!agent.consciousness) {
    issues.push('Missing consciousness object')
  } else {
    if (!agent.consciousness.monicaConstant) issues.push('Missing monicaConstant')
    if (!agent.consciousness.level) issues.push('Missing consciousness level')
    if (!agent.consciousness.strength) warnings.push('Missing consciousness strength')
    if (!agent.consciousness.emotion) warnings.push('Missing consciousness emotion')

    // Natal chart
    if (!agent.consciousness.natalChart) {
      issues.push('Missing natalChart')
    } else {
      const chart = agent.consciousness.natalChart
      // Check for nested planets structure (correct format)
      if (!chart.planets?.Sun && !chart.sun) issues.push('Missing natal chart sun')
      if (!chart.planets?.Moon && !chart.moon) issues.push('Missing natal chart moon')
      if (!chart.ascendant) warnings.push('Missing natal chart ascendant')
    }

    // Alchemical elements
    if (!agent.consciousness.alchemicalElements) {
      warnings.push('Missing alchemicalElements')
    } else {
      const elements = agent.consciousness.alchemicalElements
      if (elements.spirit === undefined) warnings.push('Missing spirit value')
      if (elements.essence === undefined) warnings.push('Missing essence value')
      if (elements.matter === undefined) warnings.push('Missing matter value')
      if (elements.substance === undefined) warnings.push('Missing substance value')
    }
  }

  // Abilities - CRITICAL for consciousness generator
  if (!agent.abilities) {
    issues.push('Missing abilities object - CRITICAL for response generation')
  } else {
    if (!agent.abilities.uniquePower) {
      issues.push('Missing abilities.uniquePower - CRITICAL for response generation')
    }
    if (!agent.abilities.specialty) warnings.push('Missing abilities.specialty')
    if (!agent.abilities.wisdomDomains || agent.abilities.wisdomDomains.length === 0) {
      warnings.push('Missing or empty abilities.wisdomDomains')
    }
  }

  // Historical data structure
  if (!agent.quotes || agent.quotes.length === 0) {
    warnings.push('Missing or empty quotes array')
  }

  if (!agent.coreBeliefs || agent.coreBeliefs.length === 0) {
    warnings.push('Missing or empty coreBeliefs array')
  }

  // Personality traits
  if (!agent.personality) {
    warnings.push('Missing personality object')
  } else {
    if (!agent.personality.traits || agent.personality.traits.length === 0) {
      warnings.push('Missing or empty personality.traits')
    }
  }

  // Shadows and gifts (optional but recommended)
  if (!agent.shadows || agent.shadows.length === 0) {
    warnings.push('Missing or empty shadows array')
  }

  if (!agent.gifts || agent.gifts.length === 0) {
    warnings.push('Missing or empty gifts array')
  }

  return {
    agentId: agent.id || 'UNKNOWN',
    agentName: agent.name || 'UNKNOWN',
    issues,
    warnings,
    isComplete: issues.length === 0,
  }
}

// Run audit
console.log('🔍 Starting comprehensive agent audit...\n')
console.log(`Total agents to audit: ${DEMO_AGENTS.length}\n`)

const results: AuditResult[] = []
let totalIssues = 0
let totalWarnings = 0
let completeAgents = 0

for (const agent of DEMO_AGENTS) {
  const result = auditAgent(agent)
  results.push(result)

  totalIssues += result.issues.length
  totalWarnings += result.warnings.length

  if (result.isComplete) {
    completeAgents++
  }
}

// Report results
console.log('='.repeat(80))
console.log('AUDIT SUMMARY')
console.log('='.repeat(80))
console.log(`Total Agents: ${DEMO_AGENTS.length}`)
console.log(`✅ Complete Agents: ${completeAgents}`)
console.log(`❌ Incomplete Agents: ${DEMO_AGENTS.length - completeAgents}`)
console.log(`🔴 Total Critical Issues: ${totalIssues}`)
console.log(`⚠️  Total Warnings: ${totalWarnings}`)
console.log('='.repeat(80))
console.log()

// Show agents with issues
const agentsWithIssues = results.filter(r => r.issues.length > 0)
if (agentsWithIssues.length > 0) {
  console.log('❌ AGENTS WITH CRITICAL ISSUES:\n')
  for (const result of agentsWithIssues) {
    console.log(`🔴 ${result.agentName} (${result.agentId})`)
    for (const issue of result.issues) {
      console.log(`   - ${issue}`)
    }
    console.log()
  }
}

// Show agents with warnings
const agentsWithWarnings = results.filter(r => r.warnings.length > 0 && r.issues.length === 0)
if (agentsWithWarnings.length > 0) {
  console.log('⚠️  AGENTS WITH WARNINGS (non-critical):\n')
  for (const result of agentsWithWarnings) {
    console.log(`⚠️  ${result.agentName} (${result.agentId})`)
    for (const warning of result.warnings) {
      console.log(`   - ${warning}`)
    }
    console.log()
  }
}

// Show complete agents
const completeAgentsList = results.filter(r => r.issues.length === 0 && r.warnings.length === 0)
if (completeAgentsList.length > 0) {
  console.log('✅ FULLY COMPLETE AGENTS (no issues or warnings):\n')
  for (const result of completeAgentsList) {
    console.log(`✅ ${result.agentName} (${result.agentId})`)
  }
  console.log()
}

// Final status
console.log('='.repeat(80))
if (totalIssues === 0) {
  console.log('✅ ALL AGENTS PASS CRITICAL CHECKS!')
  if (totalWarnings > 0) {
    console.log(`⚠️  There are ${totalWarnings} non-critical warnings to review.`)
  } else {
    console.log('🎉 ALL AGENTS ARE FULLY COMPLETE!')
  }
} else {
  console.log(`❌ AUDIT FAILED: ${totalIssues} critical issues found`)
  console.log('   Please fix critical issues before proceeding.')
}
console.log('='.repeat(80))

// Export results for further analysis
const auditReport = {
  timestamp: new Date().toISOString(),
  totalAgents: DEMO_AGENTS.length,
  completeAgents,
  incompleteAgents: DEMO_AGENTS.length - completeAgents,
  totalIssues,
  totalWarnings,
  results,
}

console.log('\n📝 Detailed results exported to: audit-report.json')
require('fs').writeFileSync('audit-report.json', JSON.stringify(auditReport, null, 2))
