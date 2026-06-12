import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSemanticSearchService } from './lib/llamaindex/semantic-search'
import { ingestAllAgents } from './lib/llamaindex/ingestion-pipeline'

async function testSemanticSearch() {
  console.log('\n=== Initializing Vector Store ===\n')

  // Ingest all agents first
  await ingestAllAgents()

  const service = getSemanticSearchService()

  console.log('\n=== Testing Semantic Search ===\n')

  // Test 1: General wisdom query
  console.log('Test 1: Search for "philosophy and wisdom"')
  const results1 = await service.search('philosophy and wisdom', {
    topK: 3,
    minSimilarity: 0.6,
  })
  console.log(`Found ${results1.length} results:`)
  results1.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.agentName} (Similarity: ${r.similarity.toFixed(3)})`)
    console.log(`     ${r.content.substring(0, 80)}...`)
  })

  // Test 2: Find agents by concept
  console.log('\n\nTest 2: Find agents for concept "art and creativity"')
  const agentResults = await service.findAgentsByConcept('art and creativity', {
    topK: 3,
    minRelevance: 0.6,
  })
  console.log(`Found ${agentResults.length} agents:`)
  agentResults.forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.agent.name} (Relevance: ${r.relevanceScore.toFixed(3)})`)
    console.log(`     Specialty: ${r.agent.abilities.specialty}`)
  })

  // Test 3: Get relevant knowledge for RAG
  console.log('\n\nTest 3: Get relevant knowledge for RAG')
  const knowledge = await service.getRelevantKnowledge(
    'Tell me about consciousness and enlightenment',
    'leonardo-da-vinci',
    { maxChunks: 3 }
  )
  console.log(`Retrieved ${knowledge.length} knowledge chunks:`)
  knowledge.forEach((chunk, i) => {
    console.log(`  ${i + 1}. ${chunk.substring(0, 80)}...`)
  })

  console.log('\n=== All Tests Completed Successfully ===\n')
}

testSemanticSearch().catch(console.error)
