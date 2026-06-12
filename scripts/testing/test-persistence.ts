import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { vectorStoreManager, initializeVectorStore } from './lib/llamaindex/vector-store'
import { getAgentDocumentLoader } from './lib/llamaindex/document-loader'
import { getSemanticSearchService } from './lib/llamaindex/semantic-search'

async function testPersistence() {
  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Vector Store Persistence Test')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')

  const persistPath = '.cache/llamaindex-test'

  // Clean up previous test data
  console.log('Step 1: Cleaning up previous test data...')
  const fs = await import('fs/promises')
  try {
    await fs.rm(persistPath, { recursive: true })
    console.log('✓ Cleaned up previous data')
  } catch {
    console.log('✓ No previous data to clean')
  }

  // Test 1: Create and persist index
  console.log('\n\nStep 2: Creating and persisting index...')
  console.log('───────────────────────────────────────────────────────')

  await initializeVectorStore()
  console.log('✓ Initialized vector store')

  const loader = getAgentDocumentLoader()
  const allDocs = await loader.loadAllAgents()
  const testDocs = allDocs.slice(0, 20) // Use first 20 documents for testing
  console.log(`✓ Loaded ${testDocs.length} test documents`)

  await vectorStoreManager.addDocuments(testDocs)
  console.log('✓ Added documents to index')

  const stats1 = await vectorStoreManager.getStats()
  console.log(`✓ Index stats:`, stats1)

  // Persist the index
  await vectorStoreManager.persist(persistPath)
  console.log(`✓ Persisted index to ${persistPath}`)

  // Verify persisted files exist
  const files = await fs.readdir(persistPath)
  console.log(`✓ Persisted files:`, files)

  // Test search before reload
  console.log('\n\nStep 3: Testing search before reload...')
  console.log('───────────────────────────────────────────────────────')

  const service1 = getSemanticSearchService()
  const results1 = await service1.search('philosophy wisdom', {
    topK: 3,
    minSimilarity: 0.4,
  })
  console.log(`✓ Found ${results1.length} results before reload`)
  results1.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.agentName} - ${r.metadata.documentType} (${r.similarity.toFixed(3)})`
    )
  })

  // Test 2: Clear and reload from persistence
  console.log('\n\nStep 4: Simulating fresh load from persistence...')
  console.log('───────────────────────────────────────────────────────')

  // Create a new instance by resetting the singleton
  const VectorStoreManagerClass = (vectorStoreManager as any).constructor
  VectorStoreManagerClass.instance = null

  // Import again to get fresh instance
  const { vectorStoreManager: freshManager, initializeVectorStore: freshInit } = await import(
    './lib/llamaindex/vector-store.js?t=' + Date.now()
  )

  await freshInit()
  console.log('✓ Initialized fresh vector store instance')

  const stats2 = await freshManager.getStats()
  console.log(`✓ Stats after reload:`, stats2)

  // Test search after reload
  console.log('\n\nStep 5: Testing search after reload...')
  console.log('───────────────────────────────────────────────────────')

  const { getSemanticSearchService: freshSearchService } = await import(
    './lib/llamaindex/semantic-search.js?t=' + Date.now()
  )
  const service2 = freshSearchService()
  const results2 = await service2.search('philosophy wisdom', {
    topK: 3,
    minSimilarity: 0.4,
  })
  console.log(`✓ Found ${results2.length} results after reload`)
  results2.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.agentName} - ${r.metadata.documentType} (${r.similarity.toFixed(3)})`
    )
  })

  // Compare results
  console.log('\n\nStep 6: Validating persistence...')
  console.log('───────────────────────────────────────────────────────')

  if (stats2.documentCount === stats1.documentCount) {
    console.log(`✓ Document count matches: ${stats2.documentCount}`)
  } else {
    console.log(`✗ Document count mismatch: ${stats1.documentCount} → ${stats2.documentCount}`)
  }

  if (results2.length === results1.length) {
    console.log(`✓ Search results count matches: ${results2.length}`)
  } else {
    console.log(`✗ Search results mismatch: ${results1.length} → ${results2.length}`)
  }

  // Check if results are similar (top result should be same)
  if (results1.length > 0 && results2.length > 0) {
    if (results1[0].agentId === results2[0].agentId) {
      console.log(`✓ Top search result matches: ${results1[0].agentName}`)
    } else {
      console.log(`✗ Top result mismatch: ${results1[0].agentName} → ${results2[0].agentName}`)
    }
  }

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  ✓ Persistence Test Complete!')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')
}

testPersistence().catch(error => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})
