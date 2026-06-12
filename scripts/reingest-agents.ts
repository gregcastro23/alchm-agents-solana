#!/usr/bin/env tsx

/**
 * Re-ingest Historical Agents with New Wisdom-Focused Format
 * This script forces a reindex of all agent knowledge with the updated document loader
 */

import { config } from 'dotenv'
import { resolve } from 'path'

// Load environment from .env.local
const envPath = resolve(process.cwd(), '.env.local')
config({ path: envPath })

// Ensure required env vars
if (!process.env.OPENAI_API_KEY) {
  console.error('❌ OPENAI_API_KEY not found in environment')
  process.exit(1)
}

if (!process.env.CHROMADB_URL) {
  console.warn('⚠️  CHROMADB_URL not set, defaulting to http://localhost:8001')
  process.env.CHROMADB_URL = 'http://localhost:8001'
}

console.log('✅ Environment loaded successfully')
console.log(`📍 ChromaDB URL: ${process.env.CHROMADB_URL}`)
console.log(`🔑 OpenAI API Key: ${process.env.OPENAI_API_KEY.substring(0, 10)}...`)
console.log('')

// Import and run ingestion pipeline
import('../lib/llamaindex/ingestion-pipeline').then(async module => {
  const { ingestAgentKnowledge } = module

  console.log('🚀 Starting agent knowledge re-ingestion...')
  console.log('📝 New format: Wisdom-focused, minimal metadata')
  console.log('')

  try {
    const result = await ingestAgentKnowledge({
      forceReindex: true,
      progressCallback: progress => {
        console.log(`[${progress.stage}] ${progress.message}`)
      },
    })

    console.log('')
    console.log('✅ Re-ingestion Complete!')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`Agents Processed: ${result.agentsProcessed}`)
    console.log(`Chunks Created: ${result.chunksCreated}`)
    console.log(`Embeddings Generated: ${result.embeddingsGenerated}`)
    console.log(`Documents Stored: ${result.documentsStored}`)
    console.log(`Time Elapsed: ${(result.timeElapsed / 1000).toFixed(2)}s`)
    console.log(`Collection Size: ${result.stats.collectionSize}`)

    if (result.errors.length > 0) {
      console.log('')
      console.log('⚠️  Errors encountered:')
      result.errors.forEach(error => console.log(`  - ${error}`))
    }

    console.log('')
    console.log('🎯 Next steps:')
    console.log('  1. Test agent chat at /gallery/chat/leonardo-da-vinci')
    console.log(
      '  2. Ask: "What are inventions worth, in the scope of life, when they come at the cost of attention to love?"'
    )
    console.log('  3. Verify the response is character-appropriate and uses wisdom, not metadata')

    process.exit(0)
  } catch (error) {
    console.error('❌ Re-ingestion failed:', error)
    process.exit(1)
  }
})
