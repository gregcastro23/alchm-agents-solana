import { DEMO_AGENTS } from './lib/demo-agents-data.js'

console.log('🔍 AGENT CONFIGURATION VERIFICATION\n')
console.log('Total agents:', DEMO_AGENTS.length)

let incompleteAgents = []
let missingFields = {}

DEMO_AGENTS.forEach((agent, index) => {
  const issues = []

  // Check basic stats structure
  if (!agent.stats) {
    issues.push('missing stats object')
  } else {
    // Check consciousness evolution data
    if (!agent.stats.kineticEvolution) {
      issues.push('missing kineticEvolution')
    } else {
      const ke = agent.stats.kineticEvolution

      // Required kinetic evolution fields
      const requiredFields = [
        'consciousnessVelocity',
        'interactionMomentum',
        'evolutionTrajectory',
        'powerLevelUnlocks',
        'optimalInteractionHours',
        'aspectSensitivityGrowth',
        'memoryPersistence',
        'lastKineticUpdate',
      ]

      requiredFields.forEach(field => {
        if (ke[field] === undefined || ke[field] === null) {
          issues.push(`missing kineticEvolution.${field}`)
          missingFields[field] = (missingFields[field] || 0) + 1
        }
      })

      // Check optimalInteractionHours format
      if (ke.optimalInteractionHours && !Array.isArray(ke.optimalInteractionHours)) {
        issues.push('optimalInteractionHours not array')
      }
    }
  }

  if (issues.length > 0) {
    incompleteAgents.push({
      index: index + 1,
      name: agent.name,
      issues,
    })
  }
})

console.log('✅ Complete agents:', DEMO_AGENTS.length - incompleteAgents.length)
console.log('❌ Incomplete agents:', incompleteAgents.length)

if (incompleteAgents.length > 0) {
  console.log('\n🔧 AGENTS NEEDING FIXES:')
  incompleteAgents.forEach(agent => {
    console.log(`  ${agent.index}. ${agent.name}: ${agent.issues.join(', ')}`)
  })

  console.log('\n📊 MISSING FIELDS SUMMARY:')
  Object.entries(missingFields).forEach(([field, count]) => {
    console.log(`  ${field}: ${count} agents missing`)
  })
} else {
  console.log('\n🎉 ALL AGENTS PROPERLY CONFIGURED!')
}
