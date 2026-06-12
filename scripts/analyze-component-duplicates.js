#!/usr/bin/env node

const fs = require('fs')
const path = require('path')

/**
 * Analyze component duplicates and suggest organization
 */

const componentsDir = path.join(__dirname, '..', 'components')

function getComponentFiles() {
  const files = []

  function scanDir(dir, relativePath = '') {
    const items = fs.readdirSync(dir)

    for (const item of items) {
      const fullPath = path.join(dir, item)
      const stat = fs.statSync(fullPath)

      if (stat.isDirectory()) {
        scanDir(fullPath, path.join(relativePath, item))
      } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
        files.push({
          name: item,
          fullPath,
          relativePath,
          size: stat.size,
          category: categorizeComponent(item, relativePath),
        })
      }
    }
  }

  scanDir(componentsDir)
  return files
}

function categorizeComponent(filename, relativePath) {
  const name = filename.toLowerCase()

  // UI components
  if (
    name.includes('button') ||
    name.includes('input') ||
    name.includes('card') ||
    name.includes('modal') ||
    name.includes('dialog') ||
    name.includes('alert') ||
    name.includes('badge') ||
    name.includes('progress') ||
    name.includes('tabs') ||
    name.includes('slider') ||
    name.includes('select') ||
    relativePath === 'ui'
  ) {
    return 'ui'
  }

  // Agent components
  if (name.includes('agent') || name.includes('consciousness') || name.includes('personality')) {
    return 'agents'
  }

  // Chart/Astrology components
  if (
    name.includes('chart') ||
    name.includes('natal') ||
    name.includes('horoscope') ||
    name.includes('planetary') ||
    name.includes('aspect') ||
    name.includes('elemental') ||
    name.includes('sign') ||
    name.includes('house') ||
    name.includes('zodiac')
  ) {
    return 'charts'
  }

  // Tarot components
  if (name.includes('tarot') || name.includes('rune') || name.includes('oracle')) {
    return 'tarot'
  }

  // Temporal/Time components
  if (
    name.includes('temporal') ||
    name.includes('time') ||
    name.includes('moment') ||
    relativePath === 'temporal'
  ) {
    return 'temporal'
  }

  // Sigil components
  if (name.includes('sigil') || relativePath === 'sigil') {
    return 'sigil'
  }

  // Profile components
  if (name.includes('profile') || relativePath === 'profile') {
    return 'profile'
  }

  // Wizard/Creation components
  if (name.includes('wizard') || name.includes('creation') || name.includes('onboarding')) {
    return 'wizards'
  }

  // Dashboard components
  if (name.includes('dashboard') || name.includes('monitor')) {
    return 'dashboards'
  }

  // Default
  return 'misc'
}

function findDuplicates(files) {
  const nameMap = new Map()
  const duplicates = []

  for (const file of files) {
    const baseName = file.name.toLowerCase().replace(/[-_\.]/g, '')
    if (!nameMap.has(baseName)) {
      nameMap.set(baseName, [])
    }
    nameMap.get(baseName).push(file)
  }

  for (const [name, files] of nameMap.entries()) {
    if (files.length > 1) {
      duplicates.push({ name, files })
    }
  }

  return duplicates
}

function analyzeOrganization(files) {
  const categories = {}

  for (const file of files) {
    if (!categories[file.category]) {
      categories[file.category] = []
    }
    categories[file.category].push(file)
  }

  return categories
}

function generateReport() {
  const files = getComponentFiles()
  const duplicates = findDuplicates(files)
  const categories = analyzeOrganization(files)

  console.log('=== COMPONENT ANALYSIS REPORT ===\n')

  console.log(`Total component files: ${files.length}\n`)

  console.log('POTENTIAL DUPLICATES:')
  if (duplicates.length === 0) {
    console.log('No obvious duplicates found by name.')
  } else {
    for (const dup of duplicates) {
      console.log(`\n${dup.name}:`)
      for (const file of dup.files) {
        console.log(`  - ${file.relativePath}/${file.name} (${file.size} bytes)`)
      }
    }
  }

  console.log('\n\nCURRENT ORGANIZATION BY CATEGORY:')
  for (const [category, files] of Object.entries(categories)) {
    console.log(`\n${category.toUpperCase()} (${files.length} files):`)
    const sorted = files.sort((a, b) => a.name.localeCompare(b.name))
    for (const file of sorted) {
      console.log(`  ${file.relativePath}/${file.name}`)
    }
  }

  console.log('\n\nRECOMMENDED NEW STRUCTURE:')
  console.log('components/')
  for (const [category, files] of Object.entries(categories)) {
    if (files.length > 0) {
      console.log(`  ${category}/`)
      console.log(`    # ${files.length} components`)
    }
  }
}

generateReport()
