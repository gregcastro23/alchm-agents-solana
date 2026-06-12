#!/usr/bin/env node

/**
 * Logging Migration Script
 * ========================
 *
 * This script helps migrate from console.log/error to structured logging
 * throughout the Planetary Agents codebase.
 */

import fs from 'fs'
import path from 'path'
import { execSync } from 'child_process'

const IGNORED_DIRS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.vitest',
  'test-results',
]

const IGNORED_FILES = ['migrate-logging.js', 'yarn.lock', 'package-lock.json']

const FILE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

// Patterns to replace
const CONSOLE_PATTERNS = [
  // console.log patterns
  {
    pattern: /console\.log\(([^)]+)\)/g,
    replacement: (match, args) => {
      // Extract arguments and determine appropriate log level
      if (args.includes('error') || args.includes('Error') || args.includes('fail')) {
        return `logger.warn(${args})`
      } else if (args.includes('success') || args.includes('complete')) {
        return `logger.info(${args})`
      } else {
        return `logger.debug(${args})`
      }
    },
    type: 'log',
  },
  // console.error patterns
  {
    pattern: /console\.error\(([^)]+)\)/g,
    replacement: (match, args) => `logger.error(${args})`,
    type: 'error',
  },
  // console.warn patterns
  {
    pattern: /console\.warn\(([^)]+)\)/g,
    replacement: (match, args) => `logger.warn(${args})`,
    type: 'warn',
  },
]

function shouldProcessFile(filePath) {
  const ext = path.extname(filePath)
  const fileName = path.basename(filePath)

  return (
    FILE_EXTENSIONS.includes(ext) &&
    !IGNORED_FILES.includes(fileName) &&
    !IGNORED_DIRS.some(dir => filePath.includes(`/${dir}/`))
  )
}

function findFiles(dir, files = []) {
  const items = fs.readdirSync(dir)

  for (const item of items) {
    const fullPath = path.join(dir, item)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory() && !IGNORED_DIRS.includes(item)) {
      findFiles(fullPath, files)
    } else if (stat.isFile() && shouldProcessFile(fullPath)) {
      files.push(fullPath)
    }
  }

  return files
}

function analyzeFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const stats = {
    file: path.relative(process.cwd(), filePath),
    consoleLogs: 0,
    consoleErrors: 0,
    consoleWarns: 0,
    totalConsoleStatements: 0,
  }

  // Count console statements
  const logMatches = content.match(/console\.log\(/g) || []
  const errorMatches = content.match(/console\.error\(/g) || []
  const warnMatches = content.match(/console\.warn\(/g) || []

  stats.consoleLogs = logMatches.length
  stats.consoleErrors = errorMatches.length
  stats.consoleWarns = warnMatches.length
  stats.totalConsoleStatements = stats.consoleLogs + stats.consoleErrors + stats.consoleWarns

  return stats
}

function migrateFile(filePath, dryRun = true) {
  console.log(`\n📄 Processing: ${path.relative(process.cwd(), filePath)}`)

  let content = fs.readFileSync(filePath, 'utf8')
  let changes = 0
  let needsLoggerImport = false

  // Apply each pattern
  for (const { pattern, replacement, type } of CONSOLE_PATTERNS) {
    const matches = content.match(pattern)

    if (matches) {
      content = content.replace(pattern, (match, args) => {
        changes++
        needsLoggerImport = true

        if (type === 'error') {
          // For console.error, try to extract error object if present
          if (args.includes('new Error') || args.includes('Error(')) {
            return `logger.error(${args})`
          } else {
            // Convert to structured error logging
            return `logger.error(${args})`
          }
        }

        return replacement(match, args)
      })
    }
  }

  // Add logger import if needed
  if (needsLoggerImport && !content.includes('import { logger }')) {
    const importStatement = "import { logger } from '@/lib/structured-logger'\n"

    // Find the first import statement and add after it
    const importMatch = content.match(/^import.*from.*$/m)
    if (importMatch) {
      const insertIndex = importMatch.index + importMatch[0].length
      content = content.slice(0, insertIndex) + '\n' + importStatement + content.slice(insertIndex)
    } else {
      // Add at the top if no imports found
      content = importStatement + '\n' + content
    }
  }

  if (changes > 0) {
    if (dryRun) {
      console.log(`   ✨ Would migrate ${changes} console statements`)
    } else {
      fs.writeFileSync(filePath, content, 'utf8')
      console.log(`   ✅ Migrated ${changes} console statements`)
    }
  } else {
    console.log(`   ℹ️  No console statements to migrate`)
  }

  return changes
}

function generateReport(allStats) {
  console.log('\n📊 MIGRATION REPORT')
  console.log('='.repeat(50))

  const totalFiles = allStats.length
  const filesWithConsole = allStats.filter(s => s.totalConsoleStatements > 0).length
  const totalConsoleStatements = allStats.reduce((sum, s) => sum + s.totalConsoleStatements, 0)
  const totalLogs = allStats.reduce((sum, s) => sum + s.consoleLogs, 0)
  const totalErrors = allStats.reduce((sum, s) => sum + s.consoleErrors, 0)
  const totalWarns = allStats.reduce((sum, s) => sum + s.consoleWarns, 0)

  console.log(`📁 Total files analyzed: ${totalFiles}`)
  console.log(`🔍 Files with console statements: ${filesWithConsole}`)
  console.log(`📝 Total console statements: ${totalConsoleStatements}`)
  console.log(`   • console.log: ${totalLogs}`)
  console.log(`   • console.error: ${totalErrors}`)
  console.log(`   • console.warn: ${totalWarns}`)

  console.log('\n📋 TOP FILES BY CONSOLE STATEMENTS:')
  allStats
    .filter(s => s.totalConsoleStatements > 0)
    .sort((a, b) => b.totalConsoleStatements - a.totalConsoleStatements)
    .slice(0, 10)
    .forEach((stat, index) => {
      console.log(`   ${index + 1}. ${stat.file} (${stat.totalConsoleStatements})`)
    })
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--apply')
  const targetDir = args.find(arg => !arg.startsWith('--')) || process.cwd()

  console.log('🔄 PLANETARY AGENTS LOGGING MIGRATION')
  console.log('='.repeat(50))
  console.log(`Mode: ${dryRun ? 'DRY RUN (use --apply to make changes)' : 'APPLY CHANGES'}`)
  console.log(`Target: ${targetDir}`)
  console.log('')

  // Find all relevant files
  console.log('🔍 Finding files to process...')
  const files = findFiles(targetDir)
  console.log(`Found ${files.length} files to analyze`)

  // Analyze all files first
  console.log('\n📊 Analyzing console usage...')
  const allStats = files.map(analyzeFile).filter(stat => stat.totalConsoleStatements > 0)

  // Generate report
  generateReport(allStats)

  // Process files for migration (dry run or actual)
  console.log(`\n${dryRun ? '🔍 DRY RUN' : '🔄 MIGRATING'} CONSOLE STATEMENTS...`)

  let totalChanges = 0
  for (const stat of allStats.slice(0, 5)) {
    // Process top 5 files first
    const changes = migrateFile(stat.file, dryRun)
    totalChanges += changes
  }

  console.log(`\n🎯 ${dryRun ? 'Would migrate' : 'Migrated'} ${totalChanges} console statements`)
  console.log('\n💡 TIP: Run with --apply to actually make the changes')
  console.log('💡 TIP: Start with the top files listed in the report')

  if (!dryRun) {
    console.log('\n⚠️  Remember to run your tests after migration!')
    console.log('⚠️  Check that all imports are correct!')
  }
}

// Run the script
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { migrateFile, analyzeFile, findFiles }
