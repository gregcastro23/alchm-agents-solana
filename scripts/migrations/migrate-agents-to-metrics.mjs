#!/usr/bin/env node
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const AGENT_DIR = path.join(__dirname, 'lib/agents/historical')

// Helper to create metrics from monica constant and interaction count
function createMetricsFunction() {
  return `
/**
 * Helper to create objective consciousness metrics
 */
function createMetrics(interactionCount: number, monicaConstant: number) {
  return {
    interactionCount,
    chatQuality: Math.min(1, monicaConstant / 7),
    momentResonance: Math.min(1, (monicaConstant * 0.15) + 0.3),
    alchemicalCoherence: Math.min(1, (monicaConstant / 6) * 0.9),
  }
}
`
}

// Process a single agent file
function processAgentFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf-8')

  // Skip if already migrated
  if (content.includes('ConsciousnessMetrics') || content.includes('createMetrics')) {
    console.log(`⏭️  Skipping ${path.basename(filePath)} (already migrated)`)
    return false
  }

  // Skip if no level property found
  if (!content.includes("level: '")) {
    console.log(`⏭️  Skipping ${path.basename(filePath)} (no level property)`)
    return false
  }

  console.log(`🔄 Processing ${path.basename(filePath)}...`)

  // 1. Update imports
  content = content.replace(
    /import type { CraftedAgent, Element, Modality, ConsciousnessLevel }/g,
    'import type { CraftedAgent, Element, Modality, ConsciousnessMetrics }'
  )

  // 2. Add createMetrics helper after imports
  const importEndIndex = content.lastIndexOf('\nimport')
  if (importEndIndex !== -1) {
    const afterImports = content.indexOf('\n', importEndIndex + 1)
    content = content.slice(0, afterImports) + createMetricsFunction() + content.slice(afterImports)
  }

  // 3. Extract stats.conversations value to use in createMetrics
  const conversationsMatch = content.match(/conversations:\s*(\d+)/)
  const interactionCount = conversationsMatch ? conversationsMatch[1] : '1000'

  // 4. Replace level with metrics
  // Find monicaConstant and level on consecutive lines
  const mcLevelRegex =
    /monicaConstant:\s*([\d.]+),?\s*\/\/[^\n]*\n\s*level:\s*'[^']+'\s*as\s*ConsciousnessLevel,?/g

  content = content.replace(mcLevelRegex, (match, mc) => {
    return `monicaConstant: ${mc},\n      metrics: createMetrics(${interactionCount}, ${mc}),`
  })

  // Write back
  fs.writeFileSync(filePath, content, 'utf-8')
  console.log(`✅ Updated ${path.basename(filePath)}`)
  return true
}

// Main execution
console.log('🚀 Starting agent migration to metrics system...\n')

const files = fs
  .readdirSync(AGENT_DIR)
  .filter(f => f.endsWith('.ts') && !f.includes('.backup'))
  .map(f => path.join(AGENT_DIR, f))

let updatedCount = 0
files.forEach(file => {
  if (processAgentFile(file)) {
    updatedCount++
  }
})

console.log(`\n✨ Migration complete! Updated ${updatedCount} files.`)
