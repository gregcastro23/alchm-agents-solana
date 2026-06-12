import fs from 'fs'

// Read the enlightenment agents file
const enlightenmentContent = fs.readFileSync('lib/agents/enlightenment-agents.ts', 'utf-8')
const modernContent = fs.readFileSync('lib/agents/modern-agents.ts', 'utf-8')

// Helper to convert name to filename
function nameToFilename(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Helper to extract agents from array
function extractAgents(content) {
  const agents = []
  const regex = /{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',/g
  let match

  while ((match = regex.exec(content)) !== null) {
    // Skip location names by checking if name contains common location indicators
    if (!match[2].includes(',') && !match[2].includes('France') && !match[2].includes('England')) {
      agents.push({
        id: match[1],
        name: match[2],
        filename: nameToFilename(match[2]),
      })
    }
  }

  return agents
}

const enlightenmentAgents = extractAgents(enlightenmentContent)
const modernAgents = extractAgents(modernContent)

console.log('Enlightenment agents:', enlightenmentAgents.length)
enlightenmentAgents.forEach(a => console.log(`  - ${a.name} => ${a.filename}.ts`))

console.log('\nModern agents:', modernAgents.length)
modernAgents.forEach(a => console.log(`  - ${a.name} => ${a.filename}.ts`))
