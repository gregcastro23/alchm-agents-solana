/**
 * Verify ChromaDB is running and has data
 *
 * This script checks:
 * 1. ChromaDB heartbeat (is it running?)
 * 2. Collections list (are there any collections?)
 * 3. Document count per collection
 * 4. Test semantic search
 */

async function verifyChromaDB() {
  const CHROMA_URL = process.env.CHROMA_URL || process.env.CHROMADB_URL || 'http://localhost:8001'

  console.log('🔍 Verifying ChromaDB Connection...\n')
  console.log(`Connecting to: ${CHROMA_URL}\n`)

  try {
    // 1. Check heartbeat (try v2 API first, fallback to v1)
    console.log('1. Checking ChromaDB heartbeat...')
    let heartbeatData
    let apiVersion = 'v2'

    let heartbeat = await fetch(`${CHROMA_URL}/api/v2/heartbeat`)
    if (!heartbeat.ok || heartbeat.status === 410) {
      // Try v1 API
      apiVersion = 'v1'
      heartbeat = await fetch(`${CHROMA_URL}/api/v1/heartbeat`)
    }

    if (!heartbeat.ok) {
      throw new Error(`Heartbeat failed: ${heartbeat.status} ${heartbeat.statusText}`)
    }

    heartbeatData = await heartbeat.json()
    console.log(
      `   ✅ ChromaDB is running (API ${apiVersion}, heartbeat: ${heartbeatData['nanosecond heartbeat']})\n`
    )

    // 2. List collections
    console.log('2. Listing collections...')
    const collectionsRes = await fetch(`${CHROMA_URL}/api/${apiVersion}/collections`)
    if (!collectionsRes.ok) {
      throw new Error(`Collections list failed: ${collectionsRes.status}`)
    }
    const collections = await collectionsRes.json()
    console.log(`   ✅ Found ${collections.length} collection(s)\n`)

    if (collections.length === 0) {
      console.log('   ⚠️  No collections found!')
      console.log('   Run data ingestion: npx tsx lib/llamaindex/ingestion-pipeline.ts\n')
      return
    }

    // 3. Check each collection
    for (const collection of collections) {
      console.log(`3. Checking collection: ${collection.name}`)
      console.log(`   ID: ${collection.id}`)

      try {
        const countRes = await fetch(
          `${CHROMA_URL}/api/${apiVersion}/collections/${collection.id}/count`
        )
        if (countRes.ok) {
          const countData = await countRes.json()
          console.log(`   ✅ ${countData} document(s) in ${collection.name}`)
        } else {
          console.log(`   ⚠️  Could not get count (status: ${countRes.status})`)
        }
      } catch (error) {
        console.log(`   ⚠️  Error getting count: ${error}`)
      }
      console.log('')
    }

    // 4. Test search on first collection
    if (collections.length > 0) {
      console.log('4. Testing semantic search...')
      const testQuery = 'What is virtue?'
      console.log(`   Query: "${testQuery}"`)

      try {
        const searchRes = await fetch(
          `${CHROMA_URL}/api/${apiVersion}/collections/${collections[0].id}/query`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              query_texts: [testQuery],
              n_results: 3,
            }),
          }
        )

        if (searchRes.ok) {
          const searchResults = await searchRes.json()
          const resultCount = searchResults.documents?.[0]?.length || 0
          console.log(`   ✅ Search returned ${resultCount} result(s)`)

          if (resultCount > 0) {
            console.log(`   First result preview:`)
            const firstResult = searchResults.documents[0][0]
            console.log(`   "${firstResult.substring(0, 100)}..."\n`)
          }
        } else {
          console.log(`   ⚠️  Search failed (status: ${searchRes.status})`)
        }
      } catch (error) {
        console.log(`   ⚠️  Search error: ${error}`)
      }
    }

    console.log('='.repeat(60))
    console.log('✅ ChromaDB Verification Complete!\n')
    console.log('Next steps:')

    if (collections.length === 0) {
      console.log('  - Run data ingestion: npx tsx lib/llamaindex/ingestion-pipeline.ts')
    } else {
      console.log('  - ChromaDB is ready for RAG queries')
      console.log('  - Start dev server: npm run dev')
      console.log('  - Test end-to-end: npm run test-rag')
    }
  } catch (error) {
    console.error('\n❌ ChromaDB Verification Failed\n')
    console.error('Error:', error)
    console.log('\nTroubleshooting:')
    console.log('  1. Check ChromaDB is running:')
    console.log('     docker ps | grep chroma')
    console.log('     OR: curl http://localhost:8001/api/v1/heartbeat')
    console.log('')
    console.log('  2. Start ChromaDB if not running:')
    console.log('     docker run -d -p 8001:8000 chromadb/chroma')
    console.log('     OR: chroma run --host localhost --port 8001')
    console.log('')
    console.log('  3. Check CHROMA_URL in .env.local:')
    console.log('     CHROMA_URL=http://localhost:8001')
    console.log('')
    console.log('  4. Verify firewall allows port 8001')

    process.exit(1)
  }
}

// Run verification
verifyChromaDB().catch(console.error)
