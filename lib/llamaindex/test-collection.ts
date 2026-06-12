/**
 * Test Collection Contents
 * Verify documents are stored and can be retrieved
 */

import { getOrCreateCollection, getCollectionCount, queryCollection } from './vector-store'
import { generateQueryEmbedding } from './embeddings-service'

async function testCollection() {
  console.log('📊 Testing ChromaDB Collection\n')
  console.log('━'.repeat(60))

  try {
    // Get collection
    const collection = await getOrCreateCollection('historical_agents')
    console.log('✅ Retrieved collection: historical_agents')

    // Get document count
    const count = await getCollectionCount(collection)
    console.log(`✅ Document count: ${count}`)

    if (count === 0) {
      console.log('❌ No documents in collection!')
      return false
    }

    // Try to peek at collection data
    console.log('\n📋 Checking collection data...')

    const result = await collection.get({
      limit: 3,
      include: ['documents', 'metadatas'],
    })

    console.log(`\nSample documents (${result.ids.length}):\n`)
    for (let i = 0; i < result.ids.length; i++) {
      console.log(`${i + 1}. ID: ${result.ids[i]}`)
      console.log(`   Agent: ${result.metadatas?.[i]?.agentName || 'unknown'}`)
      console.log(`   Content: "${result.documents?.[i]?.substring(0, 80)}..."\n`)
    }

    // Test query with low threshold
    console.log('\n🔍 Testing query with low threshold...')
    const queryEmbedding = await generateQueryEmbedding('test')

    const queryResults = await queryCollection(collection, queryEmbedding, {
      topK: 5,
      includeMetadata: true,
    })

    console.log(`✅ Query returned ${queryResults.length} results`)
    if (queryResults.length > 0) {
      console.log('\nTop result:')
      console.log(`  Agent: ${queryResults[0].metadata.agentName}`)
      console.log(`  Score: ${(queryResults[0].score * 100).toFixed(1)}%`)
      console.log(`  Distance: ${queryResults[0].distance.toFixed(4)}`)
    }

    // Test with actual semantic query
    console.log('\n🔍 Testing semantic query: "philosophy"...')
    const philosophyEmbedding = await generateQueryEmbedding('philosophy')

    const philosophyResults = await queryCollection(collection, philosophyEmbedding, {
      topK: 5,
      includeMetadata: true,
    })

    console.log(`✅ Found ${philosophyResults.length} results`)
    for (const result of philosophyResults) {
      console.log(
        `  - ${result.metadata.agentName}: ${(result.score * 100).toFixed(1)}% (distance: ${result.distance.toFixed(4)})`
      )
    }

    console.log('\n━'.repeat(60))
    console.log('✅ Collection test complete!\n')

    return true
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    return false
  }
}

testCollection()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution error:', error)
    process.exit(1)
  })
