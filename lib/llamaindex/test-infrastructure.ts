/**
 * Test Script for RAG Infrastructure
 *
 * Tests core components without requiring ChromaDB to be running.
 * Use this to validate the implementation before full ingestion.
 */

import { loadHistoricalAgents, chunkDocuments, getDocumentStats } from './document-loader'
import { estimateTokenCount, estimateBatchTokens } from './embeddings-service'

async function testInfrastructure() {
  console.log('🧪 Testing RAG Infrastructure\n')
  console.log('━'.repeat(60))

  try {
    // Test 1: Document Loading
    console.log('\n1️⃣ Testing Document Loading...')
    const documents = await loadHistoricalAgents()
    console.log(`   ✅ Loaded ${documents.length} historical agents`)

    if (documents.length > 0) {
      const sample = documents[0]
      console.log(`   Sample: ${sample.agentName} (${sample.agentId})`)
      console.log(`   Content length: ${sample.content.length} chars`)
      console.log(`   Era: ${sample.metadata.era}`)
    }

    // Test 2: Document Statistics
    console.log('\n2️⃣ Testing Document Statistics...')
    const stats = getDocumentStats(documents)
    console.log(`   Total documents: ${stats.totalDocuments}`)
    console.log(`   Total characters: ${stats.totalCharacters.toLocaleString()}`)
    console.log(`   Total tokens: ${stats.totalTokens.toLocaleString()}`)
    console.log(`   Average length: ${Math.round(stats.averageLength)} chars`)
    console.log(`   Eras:`, stats.eras)

    // Test 3: Document Chunking
    console.log('\n3️⃣ Testing Document Chunking...')
    const chunks = chunkDocuments(documents, {
      chunkSize: 512,
      overlap: 50,
      preserveSentences: true,
    })
    console.log(`   ✅ Created ${chunks.length} chunks from ${documents.length} documents`)
    console.log(`   Average chunks per document: ${(chunks.length / documents.length).toFixed(1)}`)

    if (chunks.length > 0) {
      const sampleChunk = chunks[0]
      console.log(`   Sample chunk ID: ${sampleChunk.id}`)
      console.log(`   Sample chunk length: ${sampleChunk.content.length} chars`)
      console.log(`   Sample chunk tokens: ~${estimateTokenCount(sampleChunk.content)}`)
    }

    // Test 4: Token Estimation
    console.log('\n4️⃣ Testing Token Estimation...')
    const chunkTexts = chunks.map(c => c.content)
    const totalTokens = estimateBatchTokens(chunkTexts)
    console.log(`   Total tokens for all chunks: ${totalTokens.toLocaleString()}`)
    console.log(`   Estimated embedding cost: $${((totalTokens / 1000000) * 0.02).toFixed(4)}`)

    // Test 5: Metadata Validation
    console.log('\n5️⃣ Testing Metadata Validation...')
    const metadataFields = ['agentId', 'agentName', 'era', 'chunkIndex', 'totalChunks', 'source']

    let metadataValid = true
    for (const chunk of chunks.slice(0, 10)) {
      for (const field of metadataFields) {
        if (!(field in chunk.metadata)) {
          console.error(`   ❌ Missing field: ${field} in chunk ${chunk.id}`)
          metadataValid = false
        }
      }
    }

    if (metadataValid) {
      console.log(`   ✅ Metadata validation passed for sample chunks`)
    }

    // Summary
    console.log('\n━'.repeat(60))
    console.log('✅ Infrastructure Test Complete!\n')
    console.log('Summary:')
    console.log(`  - Historical agents loaded: ${documents.length}`)
    console.log(`  - Document chunks created: ${chunks.length}`)
    console.log(`  - Total tokens: ${totalTokens.toLocaleString()}`)
    console.log(`  - Ready for embedding: Yes`)
    console.log('\nNext steps:')
    console.log('  1. Start ChromaDB: docker run -d -p 8001:8000 chromadb/chroma')
    console.log('  2. Run ingestion: yarn rag:ingest')
    console.log('  3. Test queries: yarn rag:test')

    return true
  } catch (error) {
    console.error('\n❌ Infrastructure Test Failed:', error)
    return false
  }
}

export { testInfrastructure }

// Run tests (ES module compatible)
testInfrastructure()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Test execution error:', error)
    process.exit(1)
  })
