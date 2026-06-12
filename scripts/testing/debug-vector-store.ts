import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { vectorStoreManager, initializeVectorStore } from './lib/llamaindex/vector-store'
import { getAgentDocumentLoader } from './lib/llamaindex/document-loader'

async function debug() {
  console.log('\n=== Debugging Vector Store ===\n')

  // Initialize
  await initializeVectorStore()
  console.log('✓ Vector store initialized')

  // Load documents
  const loader = getAgentDocumentLoader()
  const documents = await loader.loadAllAgents()
  console.log(`✓ Loaded ${documents.length} documents`)

  // Add first 10 documents
  console.log('\nAdding first 10 documents...')
  await vectorStoreManager.addDocuments(documents.slice(0, 10))

  // Check stats
  const stats = await vectorStoreManager.getStats()
  console.log('Stats:', stats)

  // Check if ready
  console.log('Is ready?', vectorStoreManager.isReady())

  // Try direct query
  console.log('\n=== Testing Query ===')
  try {
    const results = await vectorStoreManager.query('wisdom philosophy', {
      topK: 3,
    })
    console.log(`Found ${results.length} results`)

    results.forEach((result, i) => {
      console.log(`\n${i + 1}. Score: ${result.score.toFixed(4)}`)
      console.log(`   Text: ${result.node.text.substring(0, 100)}...`)
      console.log(`   Metadata:`, result.node.metadata)
    })
  } catch (error) {
    console.error('Query error:', error)
  }
}

debug().catch(console.error)
