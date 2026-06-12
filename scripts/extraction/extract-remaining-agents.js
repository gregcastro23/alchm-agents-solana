import fs from 'fs'

// Read the demo agents data file
const content = fs.readFileSync('lib/demo-agents-data.ts', 'utf8')

// Find all agent comments and their positions
const commentRegex = /^(\s*)\/\/ (.*?) - .* \(Agent #\d+\)\s*$/gm
const comments = []
let match
while ((match = commentRegex.exec(content)) !== null) {
  comments.push({
    index: match.index,
    name: match[2],
    indent: match[1].length,
  })
}

console.log(`Found ${comments.length} agent comments in demo-agents-data.ts`)

// Get list of existing agent files
const existingFiles = fs
  .readdirSync('lib/agents/historical')
  .filter(f => f.endsWith('.ts') && !f.includes('index'))

console.log('Existing agent files:', existingFiles.length)

console.log('\nAll agents in demo-agents-data.ts:')
comments.forEach(comment => {
  // Convert comment name to filename format
  const fileName =
    comment.name
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-') + '.ts'

  const exists = existingFiles.includes(fileName)
  console.log(`${exists ? '✅' : '❌'} ${comment.name} -> ${fileName}`)
})
