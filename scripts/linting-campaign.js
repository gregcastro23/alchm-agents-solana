#!/usr/bin/env node

/**
 * TypeScript Linting Campaign Utility
 * ===================================
 *
 * Systematic approach to resolving TypeScript compilation errors
 * in the planetary-agents codebase.
 */

import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

function runCommand(command) {
  try {
    return execSync(command, { encoding: 'utf8' })
  } catch (error) {
    return error.stdout || error.stderr || ''
  }
}

function getTypeScriptErrors() {
  const output = runCommand('yarn tsc --noEmit 2>&1')
  const lines = output.split('\n').filter(line => line.includes('error TS'))
  return lines
}

function categorizeErrors(errors) {
  const categories = {
    missingProperties: [],
    typeMismatches: [],
    importExport: [],
    methodImplementation: [],
    interfaceCompliance: [],
    other: [],
  }

  errors.forEach(error => {
    if (error.includes("Property '") && error.includes('does not exist')) {
      categories.missingProperties.push(error)
    } else if (error.includes('is not assignable to')) {
      categories.typeMismatches.push(error)
    } else if (error.includes('has no exported member') || error.includes('Cannot find name')) {
      categories.importExport.push(error)
    } else if (error.includes('must implement') || error.includes('is abstract')) {
      categories.methodImplementation.push(error)
    } else if (error.includes('missing the following properties')) {
      categories.interfaceCompliance.push(error)
    } else {
      categories.other.push(error)
    }
  })

  return categories
}

function getFilesByErrorCount() {
  const errors = getTypeScriptErrors()
  const fileCounts = {}

  errors.forEach(error => {
    const match = error.match(/^(.+?)\(\d+,\d+\):/)
    if (match) {
      const file = match[1]
      fileCounts[file] = (fileCounts[file] || 0) + 1
    }
  })

  return Object.entries(fileCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
}

function generateCampaignReport() {
  const errors = getTypeScriptErrors()
  const categories = categorizeErrors(errors)
  const topFiles = getFilesByErrorCount()

  console.log('🚀 TypeScript Error Resolution Campaign Report')
  console.log('==============================================')
  console.log('')
  console.log(`📊 Total Errors: ${errors.length}`)
  console.log(`🎯 Starting Errors: 1,065`)
  console.log(`✅ Resolved: ${1065 - errors.length}`)
  console.log(`📈 Progress: ${(((1065 - errors.length) / 1065) * 100).toFixed(1)}%`)
  console.log('')

  console.log('📂 Top 10 Files by Error Count:')
  topFiles.forEach(([file, count], index) => {
    console.log(`  ${index + 1}. ${file}: ${count} errors`)
  })
  console.log('')

  console.log('📋 Error Categories:')
  Object.entries(categories).forEach(([category, errors]) => {
    if (errors.length > 0) {
      console.log(`  🔸 ${category}: ${errors.length} errors`)
    }
  })
  console.log('')

  console.log('🎯 Priority Resolution Order:')
  console.log('  1. 🔄 Type Mismatches (highest impact)')
  console.log('  2. 🔍 Missing Properties (interface issues)')
  console.log('  3. 🔗 Import/Export (module issues)')
  console.log('  4. 🏗️ Interface Compliance (type contracts)')
  console.log('  5. ⚡ Method Implementation (abstract/virtual)')
  console.log('  6. ❓ Other (miscellaneous)')
  console.log('')

  console.log('🛠️ Available Commands:')
  console.log('  yarn linting-campaign:progress  # Show current progress')
  console.log('  yarn linting-campaign:summary   # Show error summary')
  console.log('  yarn linting-campaign:by-file   # Show errors by file')
  console.log('  yarn typecheck:missing-properties  # Focus on missing properties')
  console.log('  yarn typecheck:type-mismatches    # Focus on type mismatches')
}

function showErrorPatterns() {
  const errors = getTypeScriptErrors()
  const categories = categorizeErrors(errors)

  console.log('🔍 TypeScript Error Patterns Analysis')
  console.log('====================================')
  console.log('')

  if (categories.missingProperties.length > 0) {
    console.log('🔍 Missing Properties (Top 5):')
    categories.missingProperties.slice(0, 5).forEach(error => {
      console.log(`  ${error}`)
    })
    console.log('')
  }

  if (categories.typeMismatches.length > 0) {
    console.log('🔄 Type Mismatches (Top 5):')
    categories.typeMismatches.slice(0, 5).forEach(error => {
      console.log(`  ${error}`)
    })
    console.log('')
  }
}

// Main execution
const command = process.argv[2]

switch (command) {
  case 'report':
    generateCampaignReport()
    break
  case 'patterns':
    showErrorPatterns()
    break
  case 'help':
  default:
    console.log('TypeScript Linting Campaign Utility')
    console.log('===================================')
    console.log('')
    console.log('Usage:')
    console.log('  node scripts/linting-campaign.js report   # Generate full campaign report')
    console.log('  node scripts/linting-campaign.js patterns # Show error patterns analysis')
    console.log('')
    console.log('Available yarn commands:')
    console.log('  yarn linting-campaign:start      # Start campaign')
    console.log('  yarn linting-campaign:progress   # Show progress')
    console.log('  yarn linting-campaign:summary    # Error summary')
    console.log('  yarn linting-campaign:by-file    # Errors by file')
    console.log('  yarn typecheck:missing-properties # Missing properties')
    console.log('  yarn typecheck:type-mismatches   # Type mismatches')
    break
}
