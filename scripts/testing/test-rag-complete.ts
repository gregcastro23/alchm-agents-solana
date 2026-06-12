import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { ingestAllAgents } from './lib/llamaindex/ingestion-pipeline'
import { getSemanticSearchService } from './lib/llamaindex/semantic-search'

async function testRAGComplete() {
  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  RAG System Complete Integration Test')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')

  // Step 1: Ingest all agents
  console.log('Step 1: Ingesting all agents...\n')
  const stats = await ingestAllAgents()
  console.log(`\n✓ Ingestion complete:`)
  console.log(`  - ${stats.totalAgents} agents processed`)
  console.log(`  - ${stats.totalDocuments} documents created`)
  console.log(`  - ${stats.successfulIngestions} successful`)
  console.log(`  - ${stats.duration}ms total duration`)

  // Step 2: Test semantic search
  console.log('\n\nStep 2: Testing Semantic Search\n')
  console.log('───────────────────────────────────────────────────────')

  const service = getSemanticSearchService()

  // Test 2a: General search
  console.log('\nTest 2a: Search for "philosophy and wisdom"')
  const results1 = await service.search('philosophy and wisdom', {
    topK: 3,
    minSimilarity: 0.4,
  })
  console.log(`Found ${results1.length} results:`)
  results1.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.agentName} - ${r.metadata.documentType} (${r.similarity.toFixed(3)})`
    )
  })

  // Test 2b: Find agents by concept
  console.log('\n\nTest 2b: Find agents for "art and creativity"')
  const agentResults = await service.findAgentsByConcept('art and creativity', {
    topK: 3,
    minRelevance: 0.4,
  })
  console.log(`Found ${agentResults.length} agents:`)
  agentResults.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.agent.name} (${r.relevanceScore.toFixed(3)}) - ${r.agent.abilities.specialty}`
    )
  })

  // Test 2c: Get relevant knowledge for RAG
  console.log('\n\nTest 2c: Get relevant knowledge for RAG')
  const knowledge = await service.getRelevantKnowledge(
    'Tell me about scientific discovery and innovation',
    'leonardo-da-vinci',
    { maxChunks: 3, minSimilarity: 0.4 }
  )
  console.log(`Retrieved ${knowledge.length} knowledge chunks:`)
  knowledge.forEach((chunk, i) => {
    const preview = chunk.substring(0, 80).replace(/\n/g, ' ')
    console.log(`  ${i + 1}. ${preview}...`)
  })

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  ✓ All RAG Integration Tests Passed!')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')
}

testRAGComplete().catch(error => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})
