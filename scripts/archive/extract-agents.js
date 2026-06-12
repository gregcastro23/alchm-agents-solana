import fs from 'fs'
import path from 'path'

// Read the large demo agents data file
const content = fs.readFileSync('lib/demo-agents-data.ts', 'utf8')

// Extract agent definitions by finding patterns like:
//   {
//     id: 'carl-jung',
//     name: 'Carl Jung',
// And ending with the next agent's id or the end of the array

const agentRegex =
  /{\s*id:\s*['"]([^'"]+)['"],\s*name:\s*['"]([^'"]+)['"],([\s\S]*?)(?={\s*id:\s*['"]|$)/g

let match
const agents = []

while ((match = agentRegex.exec(content)) !== null) {
  const [, id, name, agentContent] = match
  agents.push({ id, name, content: `{\n  id: '${id}',\n  name: '${name}',\n${agentContent}` })
}

console.log(`Found ${agents.length} agents:`)
agents.forEach(agent => {
  console.log(`- ${agent.name} (${agent.id})`)
})

// Extract and create files for each agent
agents.forEach(agent => {
  try {
    const fileName =
      agent.id
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, '-')
        .replace(/-+/g, '-') + '.ts'

    // Create the individual agent file
    const fileContent = `import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from '../../agent-types'

export const ${agent.id.toUpperCase().replace(/[^A-Z0-9]/g, '_')}: CraftedAgent = ${agent.content}`

    const filePath = path.join('lib/agents/historical', fileName)
    fs.writeFileSync(filePath, fileContent)

    console.log(`Created: ${filePath}`)
  } catch (error) {
    console.error(`Error creating file for ${agent.name}:`, error.message)
  }
})

console.log(`\nExtraction complete! Created ${agents.length} individual agent files.`)
