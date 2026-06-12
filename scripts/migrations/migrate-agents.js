import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Source files to extract agents from
const sourceFiles = [
  'lib/agents/ancient-agents.ts',
  'lib/agents/medieval-agents.ts',
  'lib/agents/enlightenment-agents.ts',
  'lib/agents/modern-agents.ts',
]

// Extract and create individual agent files
for (const sourceFile of sourceFiles) {
  const fullPath = path.join(__dirname, sourceFile)
  if (!fs.existsSync(fullPath)) continue

  console.log(`Processing ${sourceFile}...`)
  const content = fs.readFileSync(fullPath, 'utf8')

  // Extract agent objects (this is a simplified approach)
  const agentRegex = /\{\s*id: '([^']+)',\s*name: '([^']+)',\s*title: '([^']+)'/g
  let match

  while ((match = agentRegex.exec(content)) !== null) {
    const agentId = match[1]
    const agentName = match[2]

    // Create filename from agent name
    const filename = agentName
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
    const filePath = path.join(__dirname, 'lib/agents/historical', `${filename}.ts`)

    // Skip if file already exists (we already created Socrates and Leonardo)
    if (fs.existsSync(filePath)) {
      console.log(`Skipping ${filename} (already exists)`)
      continue
    }

    // For now, just log what we found
    console.log(`Found agent: ${agentName} (${agentId}) -> ${filename}.ts`)
  }
}

console.log('Migration analysis complete. Ready to create individual agent files.')
