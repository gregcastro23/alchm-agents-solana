import fs from 'fs'

// Read the enlightenment agents file
const content = fs.readFileSync('lib/agents/enlightenment-agents.ts', 'utf8')

// Find all agent comments and their positions
const commentRegex = /^(\s*)\/\/ (.*?) - .* \(\d{4}-\d{4}\)\s*$/gm
const comments = []
let match
while ((match = commentRegex.exec(content)) !== null) {
  comments.push({
    index: match.index,
    name: match[2],
    indent: match[1].length,
  })
}

console.log(`Found ${comments.length} agent comments`)

// Extract each agent
comments.forEach((comment, index) => {
  const startPos = comment.index
  const endPos = index < comments.length - 1 ? comments[index + 1].index : content.length

  // Extract the section from comment to next comment (or end)
  const section = content.substring(startPos, endPos)

  console.log(`Processing ${comment.name}`)

  // Find the agent object within this section - it starts right after the comment
  const objectStart = section.indexOf('{')
  const objectEnd = section.lastIndexOf('},') + 2 // Include the comma and newline

  if (objectStart !== -1 && objectEnd !== -1) {
    const agentObject = section.substring(objectStart, objectEnd)

    console.log(`Agent object preview: ${agentObject.substring(0, 100)}...`)

    // Extract the id
    const idMatch = agentObject.match(/id:\s*['"`](.*?)['"`]/)
    console.log(`ID match:`, idMatch)
    if (idMatch) {
      const agentId = idMatch[1]
      const constName = agentId
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('_')

      const fileName = comment.name
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')

      // Create the file content
      const fileContent = `import type { CraftedAgent, Element, Modality, ConsciousnessLevel } from '../../agent-types'

export const ${constName}: CraftedAgent = ${agentObject}

export default ${constName};
`

      // Write the file
      const filePath = `lib/agents/historical/${fileName}.ts`
      fs.writeFileSync(filePath, fileContent)
      console.log(`Created ${filePath}`)
    } else {
      console.log(`Could not extract ID for ${comment.name}`)
    }
  } else {
    console.log(`Could not find object for ${comment.name}`)
  }
})

console.log('Agent extraction complete!')
