/**
 * Clear ChromaDB Collection
 *
 * This script deletes the historical_agents collection from ChromaDB
 * to prepare for a fresh re-ingestion from the database.
 *
 * Usage:
 *   npx tsx scripts/clear-chromadb.ts
 */

import { ChromaClient } from 'chromadb'

const chromaUrl = process.env.CHROMADB_URL || 'http://localhost:8001'

async function clearCollection() {
  console.log(`\n🗑️  Clearing ChromaDB Collection\n`)
  console.log(`   URL: ${chromaUrl}`)
  console.log(`   Collection: historical_agents\n`)

  const client = new ChromaClient({ path: chromaUrl })

  try {
    // Check if collection exists first
    try {
      const collection = await client.getCollection({ name: 'historical_agents' })
      const count = await collection.count()
      console.log(`   Found collection with ${count} documents\n`)
    } catch (error) {
      console.log(`   ⚠️  Collection does not exist\n`)
      return
    }

    // Delete the collection
    await client.deleteCollection({ name: 'historical_agents' })
    console.log(`✅ Collection "historical_agents" deleted successfully\n`)
  } catch (error) {
    console.error(`\n❌ Error:`, error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}

clearCollection()
