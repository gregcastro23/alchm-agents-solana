import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { getSemanticSearchService } from './lib/llamaindex/semantic-search'

async function testLoadFromPersistence() {
  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  Testing Load from Persisted Storage')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')

  console.log('Note: This test loads from .cache/llamaindex/')
  console.log('Make sure you ran: yarn rag:ingest first\n')

  const service = getSemanticSearchService()

  // Test 1: Philosophy search
  console.log('Test 1: Searching for "philosophy and wisdom"...')
  const results1 = await service.search('philosophy and wisdom', {
    topK: 5,
    minSimilarity: 0.4,
  })
  console.log(`✓ Found ${results1.length} results:`)
  results1.forEach((r, i) => {
    console.log(
      `  ${i + 1}. ${r.agentName} - ${r.metadata.documentType} (${r.similarity.toFixed(3)})`
    )
  })

  // Test 2: Agent concept search
  console.log('\n\nTest 2: Finding agents for "art and creativity"...')
  const agents = await service.findAgentsByConcept('art and creativity', {
    topK: 5,
    minRelevance: 0.35,
  })
  console.log(`✓ Found ${agents.length} agents:`)
  agents.forEach((a, i) => {
    console.log(`  ${i + 1}. ${a.agent.name} (${a.relevanceScore.toFixed(3)})`)
    console.log(`     Specialty: ${a.agent.abilities.specialty}`)
  })

  // Test 3: Knowledge retrieval
  console.log('\n\nTest 3: Getting knowledge for "scientific discovery"...')
  const knowledge = await service.getRelevantKnowledge(
    'scientific discoveries and innovation',
    'leonardo-da-vinci',
    { maxChunks: 3, minSimilarity: 0.35 }
  )
  console.log(`✓ Retrieved ${knowledge.length} knowledge chunks:`)
  knowledge.forEach((k, i) => {
    const preview = k.substring(0, 100).replace(/\n/g, ' ')
    console.log(`  ${i + 1}. ${preview}...`)
  })

  // Test 4: Similar agents
  console.log('\n\nTest 4: Finding agents similar to Leonardo da Vinci...')
  const similar = await service.findSimilarAgents('leonardo-da-vinci', { topK: 3 })
  console.log(`✓ Found ${similar.length} similar agents:`)
  similar.forEach((s, i) => {
    console.log(`  ${i + 1}. ${s.agent.name} (${s.relevanceScore.toFixed(3)})`)
  })

  console.log('\n')
  console.log('═══════════════════════════════════════════════════════')
  console.log('  ✓ All Persistence Load Tests Passed!')
  console.log('═══════════════════════════════════════════════════════')
  console.log('\n')
}

testLoadFromPersistence().catch(error => {
  console.error('\n❌ Test failed:', error)
  process.exit(1)
})
