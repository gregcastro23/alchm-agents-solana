#!/usr/bin/env node
/**
 * inject-diet-profiles.cjs
 * Reads diet data from JSON files and injects historicalDiet blocks into agent .ts files.
 */
const fs = require('fs')
const path = require('path')

const AGENTS_DIR = path.join(__dirname, '..', 'lib', 'agents', 'historical')
const SCRIPTS_DIR = __dirname

// Load all diet data
const data = Object.assign(
  {},
  JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'diet-data-part1.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'diet-data-part2.json'), 'utf8')),
  JSON.parse(fs.readFileSync(path.join(SCRIPTS_DIR, 'diet-data-part3.json'), 'utf8'))
)

let injected = 0,
  skipped = 0,
  errors = 0

for (const [agentId, diet] of Object.entries(data)) {
  const filePath = path.join(AGENTS_DIR, `${agentId}.ts`)
  if (!fs.existsSync(filePath)) {
    console.log(`SKIP: ${agentId}.ts not found`)
    skipped++
    continue
  }

  let content = fs.readFileSync(filePath, 'utf8')

  // Skip if already has historicalDiet
  if (content.includes('historicalDiet')) {
    console.log(`SKIP: ${agentId} already has historicalDiet`)
    skipped++
    continue
  }

  // Build the historicalDiet block
  const toTsArray = arr => arr.map(s => `'${s.replace(/'/g, "\\'")}'`).join(', ')
  const toTsStr = s => s.replace(/'/g, "\\'")

  let block = `  historicalDiet: {\n`
  block += `    staples: [${toTsArray(diet.staples)}],\n`
  block += `    favoriteFoods: [${toTsArray(diet.favoriteFoods)}],\n`
  block += `    avoidedFoods: [${toTsArray(diet.avoidedFoods)}],\n`
  block += `    dietaryPhilosophy: '${toTsStr(diet.dietaryPhilosophy)}',\n`
  block += `    culturalCuisine: '${toTsStr(diet.culturalCuisine)}',\n`
  block += `    beverages: [${toTsArray(diet.beverages)}],\n`
  if (diet.foodLore) {
    block += `    foodLore: '${toTsStr(diet.foodLore)}',\n`
  }
  block += `  },\n`

  // Insert before monicaCreationStory if it exists, else before final }
  if (content.includes('monicaCreationStory')) {
    // Find the line with monicaCreationStory and insert before it
    const lines = content.split('\n')
    const idx = lines.findIndex(l => l.includes('monicaCreationStory'))
    if (idx > 0) {
      lines.splice(idx, 0, block)
      content = lines.join('\n')
    }
  } else {
    // Insert before the final closing brace
    const lastBrace = content.lastIndexOf('}')
    if (lastBrace > 0) {
      content = content.slice(0, lastBrace) + block + content.slice(lastBrace)
    }
  }

  fs.writeFileSync(filePath, content, 'utf8')
  console.log(`OK: ${agentId}`)
  injected++
}

console.log(`\nDone: ${injected} injected, ${skipped} skipped, ${errors} errors`)
