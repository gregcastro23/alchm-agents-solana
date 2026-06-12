/**
 * Automated System Sync Tool
 *
 * This script automates the synchronization of all agent data across systems:
 * 1. TypeScript definitions → Neon PostgreSQL
 * 2. Neon PostgreSQL → ChromaDB vector store
 * 3. Validates consistency across all systems
 *
 * Usage:
 *   npx tsx scripts/sync-all-systems.ts [--force] [--skip-validation]
 *
 * Options:
 *   --force            Force rebuild of ChromaDB collection
 *   --skip-validation  Skip final validation step
 *   --dry-run          Show what would be done without making changes
 */

import { execSync } from 'child_process'
import { PrismaClient } from '@prisma/client'
import { HISTORICAL_AGENTS } from '../lib/agents/historical/index'

const prisma = new PrismaClient()

interface SyncOptions {
  force?: boolean
  skipValidation?: boolean
  dryRun?: boolean
}

interface SyncResult {
  success: boolean
  steps: {
    database: { success: boolean; message: string }
    chromadb: { success: boolean; message: string }
    validation?: { success: boolean; message: string }
  }
  errors: string[]
  duration: number
}

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2)
  return {
    force: args.includes('--force'),
    skipValidation: args.includes('--skip-validation'),
    dryRun: args.includes('--dry-run'),
  }
}

function execCommand(command: string, description: string): { success: boolean; output: string } {
  console.log(`\n   Running: ${description}...`)
  try {
    const output = execSync(command, { encoding: 'utf-8', stdio: 'pipe' })
    console.log(`   ✓ ${description} completed`)
    return { success: true, output }
  } catch (error) {
    const errorOutput = error instanceof Error ? error.message : String(error)
    console.error(`   ✗ ${description} failed:`, errorOutput)
    return { success: false, output: errorOutput }
  }
}

async function syncAllSystems(options: SyncOptions = {}): Promise<SyncResult> {
  const startTime = Date.now()
  const errors: string[] = []

  console.log('\n🔄 Automated System Sync\n')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  if (options.dryRun) {
    console.log('⚠️  DRY RUN MODE - No changes will be made\n')
  }

  const result: SyncResult = {
    success: false,
    steps: {
      database: { success: false, message: '' },
      chromadb: { success: false, message: '' },
    },
    errors: [],
    duration: 0,
  }

  // Step 1: Check Prerequisites
  console.log('📋 Step 1: Checking Prerequisites\n')

  // Check if ChromaDB is running
  try {
    const healthCheck = execCommand(
      'curl -s http://localhost:8001/api/v1/heartbeat',
      'Check ChromaDB health'
    )

    if (!healthCheck.success) {
      errors.push('ChromaDB is not running on port 8001')
      console.error('\n❌ ChromaDB is not running. Please start it with:')
      console.error('   docker start planetary-chroma\n')
      result.errors = errors
      result.duration = Date.now() - startTime
      return result
    }
  } catch (error) {
    errors.push(
      `ChromaDB health check failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  // Check OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    errors.push('OPENAI_API_KEY environment variable not set')
    console.error('\n❌ OPENAI_API_KEY not found. Please set it in .env.local\n')
    result.errors = errors
    result.duration = Date.now() - startTime
    return result
  }

  console.log('   ✓ ChromaDB is running')
  console.log('   ✓ OpenAI API key is set')
  console.log(`   ✓ Found ${HISTORICAL_AGENTS.length} agent definitions\n`)

  // Step 2: Sync to Database
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📁 Step 2: Syncing TypeScript → Neon Database\n')

  if (options.dryRun) {
    console.log('   [DRY RUN] Would run: npx tsx scripts/seed-historical-agents.ts\n')
    result.steps.database = { success: true, message: 'Dry run - no changes made' }
  } else {
    const dbSync = execCommand('npx tsx scripts/seed-historical-agents.ts', 'Seed Neon database')

    result.steps.database = {
      success: dbSync.success,
      message: dbSync.success
        ? `Successfully synced ${HISTORICAL_AGENTS.length} agents to database`
        : 'Failed to sync to database',
    }

    if (!dbSync.success) {
      errors.push('Database sync failed')
    }
  }

  // Step 3: Sync to ChromaDB
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('🔮 Step 3: Syncing Neon Database → ChromaDB\n')

  if (options.dryRun) {
    console.log('   [DRY RUN] Would run: ChromaDB ingestion pipeline\n')
    result.steps.chromadb = { success: true, message: 'Dry run - no changes made' }
  } else {
    const forceFlag = options.force ? '--force' : ''
    const chromaSync = execCommand(
      `OPENAI_API_KEY="${process.env.OPENAI_API_KEY}" CHROMADB_URL=http://localhost:8001 npx tsx lib/llamaindex/ingestion-pipeline.ts ${forceFlag}`,
      'Ingest to ChromaDB'
    )

    result.steps.chromadb = {
      success: chromaSync.success,
      message: chromaSync.success
        ? 'Successfully synced to ChromaDB'
        : 'Failed to sync to ChromaDB',
    }

    if (!chromaSync.success) {
      errors.push('ChromaDB sync failed')
    }
  }

  // Step 4: Validation
  if (!options.skipValidation) {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
    console.log('🔍 Step 4: Validating System Consistency\n')

    if (options.dryRun) {
      console.log('   [DRY RUN] Would run: validation script\n')
      result.steps.validation = { success: true, message: 'Dry run - skipped validation' }
    } else {
      const validation = execCommand('npx tsx scripts/validate-agent-sync.ts', 'Validate sync')

      result.steps.validation = {
        success: validation.success,
        message: validation.success
          ? 'All systems are in sync'
          : 'Validation found inconsistencies',
      }

      if (!validation.success) {
        errors.push('Validation failed')
      }
    }
  }

  // Final Summary
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')
  console.log('📊 Sync Summary:\n')

  const allStepsSucceeded = Object.values(result.steps).every(step => step.success)
  result.success = allStepsSucceeded && errors.length === 0
  result.errors = errors
  result.duration = Date.now() - startTime

  console.log(
    `   Database Sync:  ${result.steps.database.success ? '✅' : '❌'} ${result.steps.database.message}`
  )
  console.log(
    `   ChromaDB Sync:  ${result.steps.chromadb.success ? '✅' : '❌'} ${result.steps.chromadb.message}`
  )

  if (result.steps.validation) {
    console.log(
      `   Validation:     ${result.steps.validation.success ? '✅' : '❌'} ${result.steps.validation.message}`
    )
  }

  console.log(`\n   Duration: ${(result.duration / 1000).toFixed(2)}s`)

  if (result.success) {
    console.log('\n✅ All systems successfully synchronized!\n')
  } else {
    console.log('\n❌ Sync completed with errors:\n')
    errors.forEach(err => console.log(`   - ${err}`))
    console.log()
  }

  await prisma.$disconnect()
  return result
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseArgs()

  syncAllSystems(options)
    .then(result => {
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error('\n❌ Fatal error:', error)
      process.exit(1)
    })
}

export { syncAllSystems, type SyncOptions, type SyncResult }
