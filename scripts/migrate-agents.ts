#!/usr/bin/env tsx
// Migration script to populate database with historical agents
// Run with: npx tsx scripts/migrate-agents.ts

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { HistoricalAgentsService } from '../lib/historical-agents-db'

async function main() {
  console.log('🚀 Starting Historical Agents Migration...')
  console.log('='.repeat(50))

  try {
    const result = await HistoricalAgentsService.migrateStaticAgents()

    console.log('\n📊 Migration Results:')
    console.log(`✅ Successfully migrated: ${result.migrated} agents`)
    console.log(`❌ Errors encountered: ${result.errors.length}`)

    if (result.errors.length > 0) {
      console.log('\n🚨 Errors:')
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`)
      })
    }

    if (result.success) {
      console.log('\n🎉 Migration completed successfully!')
      console.log('All historical agents are now stored in the database.')
      console.log('They can evolve, learn, and persist conversations.')
    } else {
      console.log('\n⚠️  Migration completed with some errors.')
      console.log('Please review the errors above and fix any issues.')
    }
  } catch (error) {
    console.error('\n💥 Migration failed:', error)
    process.exit(1)
  }
}

// Run the migration
main()
  .then(() => {
    console.log('\n✨ Migration script finished.')
    process.exit(0)
  })
  .catch(error => {
    console.error('Migration script error:', error)
    process.exit(1)
  })
