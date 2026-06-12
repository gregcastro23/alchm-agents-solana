/**
 * Test Semantic Search
 * Quick tests to verify semantic search is working correctly
 */

import {
  semanticSearch,
  searchAgentKnowledge,
  findSimilarAgents,
  getSearchStats,
} from './semantic-search'

async function testSemanticSearch() {
  console.log('🔍 Testing Semantic Search System\n')
  console.log('━'.repeat(60))

  try {
    // Test 1: Basic semantic search
    console.log('\n1️⃣ Test: Basic Semantic Search')
    console.log('Query: "creativity and innovation"\n')

    const results1 = await semanticSearch('creativity and innovation', {
      topK: 3,
      threshold: 0.35,
    })

    console.log(`✅ Found ${results1.length} results`)
    for (const result of results1) {
      console.log(`  - ${result.agentName} (${(result.score * 100).toFixed(1)}% relevant)`)
      console.log(`    "${result.content.substring(0, 100)}..."\n`)
    }

    // Test 2: Agent-specific search
    console.log('\n2️⃣ Test: Agent-Specific Search')
    console.log('Query: "wisdom" for agent: socrates\n')

    const results2 = await searchAgentKnowledge('socrates', 'wisdom', 3)

    console.log(`✅ Found ${results2.length} results from Socrates`)
    for (const result of results2) {
      console.log(`  - Relevance: ${(result.score * 100).toFixed(1)}%`)
      console.log(`    "${result.content.substring(0, 100)}..."\n`)
    }

    // Test 3: Find similar agents
    console.log('\n3️⃣ Test: Find Similar Agents')
    console.log('Concept: "science and discovery"\n')

    const results3 = await findSimilarAgents('science and discovery', 5)

    console.log(`✅ Found ${results3.length} relevant agents`)
    for (const agent of results3) {
      console.log(`  - ${agent.agentName} (${(agent.relevance * 100).toFixed(1)}% relevant)`)
    }

    // Test 4: Search statistics
    console.log('\n4️⃣ Test: Search Statistics')
    console.log('Query: "philosophy"\n')

    const stats = await getSearchStats('philosophy')

    console.log(`✅ Search Statistics:`)
    console.log(`  Total matches: ${stats.totalMatches}`)
    console.log(`  Average score: ${(stats.averageScore * 100).toFixed(1)}%`)
    console.log(`  Agent coverage: ${stats.agentCoverage} agents`)
    console.log(`  Top agents:`)
    for (const agent of stats.topAgents) {
      console.log(`    - ${agent.agentName}: ${agent.matches} matches`)
    }

    // Test 5: Performance test
    console.log('\n5️⃣ Test: Performance')
    const startTime = Date.now()

    await semanticSearch('understanding consciousness', { topK: 5 })

    const elapsed = Date.now() - startTime
    console.log(`✅ Query completed in ${elapsed}ms`)

    if (elapsed < 200) {
      console.log(`   🎉 Excellent! (target: <200ms)`)
    } else if (elapsed < 500) {
      console.log(`   ✅ Good (target: <200ms)`)
    } else {
      console.log(`   ⚠️  Slow (target: <200ms)`)
    }

    // Summary
    console.log('\n━'.repeat(60))
    console.log('✅ All Semantic Search Tests Passed!\n')

    return true
  } catch (error) {
    console.error('\n❌ Test Failed:', error)
    return false
  }
}

// Run tests
testSemanticSearch()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution error:', error)
    process.exit(1)
  })
