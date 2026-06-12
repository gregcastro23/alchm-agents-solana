/**
 * Add Consciousness Levels to Agents Missing Them
 *
 * This script adds the 'level' field to agents based on their Monica Constant
 */

import { readFileSync, writeFileSync } from 'fs'
import { glob } from 'glob'

// Consciousness level mapping
function getConsciousnessLevel(monicaConstant: number): string {
  if (monicaConstant >= 6.0) return 'Transcendent'
  if (monicaConstant >= 5.5) return 'Illuminated'
  if (monicaConstant >= 4.5) return 'Advanced'
  if (monicaConstant >= 3.5) return 'Elevated'
  if (monicaConstant >= 2.5) return 'Active'
  if (monicaConstant >= 1.5) return 'Awakening'
  return 'Dormant'
}

// Agent files to update
const agentFiles = [
  'lib/agents/historical/voltaire.ts',
  'lib/agents/historical/john-locke.ts',
  'lib/agents/historical/david-hume.ts',
  'lib/agents/historical/johannes-kepler.ts',
  'lib/agents/historical/immanuel-kant.ts',
  'lib/agents/historical/adam-smith.ts',
  'lib/agents/historical/jean-jacques-rousseau.ts',
  'lib/agents/historical/mary-wollstonecraft.ts',
  'lib/agents/historical/charles-dickens.ts',
  'lib/agents/historical/claude-monet.ts',
  'lib/agents/historical/nikola-tesla.ts',
  'lib/agents/historical/marie-curie.ts',
  'lib/agents/historical/sigmund-freud.ts',
  'lib/agents/historical/mark-twain.ts',
  'lib/agents/historical/vincent-van-gogh.ts',
  'lib/agents/historical/charles-darwin.ts',
  'lib/agents/historical/edgar-allan-poe.ts',
  'lib/agents/historical/isaac-asimov.ts',
]

console.log('🔧 Adding consciousness levels to agents...\n')

let updatedCount = 0

for (const filePath of agentFiles) {
  try {
    const content = readFileSync(filePath, 'utf-8')

    // Extract Monica Constant from file
    const monicaMatch = content.match(/monicaConstant:\s*([\d.]+)/)
    if (!monicaMatch) {
      console.log(`⚠️  Could not find monicaConstant in ${filePath}`)
      continue
    }

    const monicaConstant = parseFloat(monicaMatch[1])
    const level = getConsciousnessLevel(monicaConstant)

    // Check if level already exists
    if (content.includes("level: '")) {
      console.log(`⏭️  ${filePath} already has consciousness level`)
      continue
    }

    // Add level after monicaConstant
    const updated = content.replace(
      /monicaConstant: ([\d.]+),/,
      `monicaConstant: $1,\n    level: '${level}',`
    )

    if (updated === content) {
      console.log(`⚠️  No changes made to ${filePath}`)
      continue
    }

    writeFileSync(filePath, updated, 'utf-8')
    console.log(`✅ Updated ${filePath} with level: '${level}' (MC: ${monicaConstant})`)
    updatedCount++
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error)
  }
}

console.log(`\n🎉 Updated ${updatedCount} agent files with consciousness levels!`)
