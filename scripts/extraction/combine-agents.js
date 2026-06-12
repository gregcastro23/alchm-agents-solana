import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Files to combine
const agentFiles = [
  'lib/demo-agents-data.ts',
  'lib/agents/ancient-agents.ts',
  'lib/agents/medieval-agents.ts',
  'lib/agents/enlightenment-agents.ts',
  'lib/agents/modern-agents.ts',
]

let allAgents = []

// Extract agents from each file
for (const filePath of agentFiles) {
  const fullPath = path.join(__dirname, filePath)
  if (!fs.existsSync(fullPath)) continue

  const content = fs.readFileSync(fullPath, 'utf8')
  console.log(`Processing ${filePath}...`)

  // Look for agent arrays
  const arrayMatches = content.match(/export const \w+_AGENTS: CraftedAgent\[\] = \[([\s\S]*?)\];/g)
  if (arrayMatches) {
    for (const match of arrayMatches) {
      const agentsContent = match
        .replace(/export const \w+_AGENTS: CraftedAgent\[\] = /, '')
        .replace(/;$/, '')
      try {
        // This is tricky because we need to parse JavaScript, but let's try a simpler approach
        const agentObjects = agentsContent.match(
          /\{\s*id: '[^']+',\s*name: '[^']+',\s*title: '[^']+',[\s\S]*?\},?/g
        )
        if (agentObjects) {
          for (const agent of agentObjects) {
            if (agent.trim()) {
              allAgents.push(agent.trim().replace(/,$/, ''))
            }
          }
        }
      } catch (e) {
        console.log(`Error parsing ${filePath}:`, e.message)
      }
    }
  }

  // Look for individual agent exports
  const individualMatches = content.match(
    /export const [A-Z_]+_AS_CRAFTED_AGENT: CraftedAgent = \{[\s\S]*?\};/g
  )
  if (individualMatches) {
    for (const match of individualMatches) {
      const agentContent = match
        .replace(/export const [A-Z_]+_AS_CRAFTED_AGENT: CraftedAgent = /, '')
        .replace(/;$/, '')
      allAgents.push(agentContent)
    }
  }
}

console.log(`Found ${allAgents.length} agents total`)

// Now create the consolidated file
const consolidatedContent = `// Demo Agents - Streamlined Historical Consciousness Showcase
// The Philosopher's Stone - Consciousness Crafting Demonstrations
// Consolidated from time-period based categorization for simplicity

import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from './agent-types'

// Consolidated array of all demo agents without time period categorization
export const DEMO_AGENTS: CraftedAgent[] = [
${allAgents.join(',\n\n  ')}
]

// Export individual agents for backward compatibility
export const MONICA_AS_CRAFTED_AGENT = DEMO_AGENTS.find(agent => agent.id === 'monica-001')!

// Legacy exports for backward compatibility
export const getDemoAgent = (id: string): CraftedAgent | undefined => {
  return DEMO_AGENTS.find(agent => agent.id === id)
}

export const getAllDemoAgents = (): CraftedAgent[] => {
  return DEMO_AGENTS
}

// Export Monica for special cases
export const getMonicaAgent = (): CraftedAgent => {
  return MONICA_AS_CRAFTED_AGENT
}
`

fs.writeFileSync(path.join(__dirname, 'lib/demo-agents.ts'), consolidatedContent)
console.log('Created consolidated demo-agents.ts file')
