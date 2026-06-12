/**
 * RAG Performance Benchmark
 * Sends 10 test queries and measures performance
 */

const queries = [
  'What is virtue?',
  'How should I live?',
  'What is knowledge?',
  'What is justice?',
  'What is wisdom?',
  'What is the good life?',
  'What is truth?',
  'What is beauty?',
  'What is courage?',
  'What is friendship?',
]

async function benchmark() {
  console.log('🏃 RAG Performance Benchmark\n')
  console.log('Testing 10 queries with cache miss → cache hit pattern\n')

  const results: Array<{
    query: string
    cacheMiss: number
    cacheHit: number
    improvement: string
    sources: number
  }> = []

  for (let i = 0; i < queries.length; i++) {
    const query = queries[i]
    console.log(`[${i + 1}/10] Testing: "${query.slice(0, 40)}..."`)

    // First attempt (cache miss)
    const start1 = Date.now()
    const res1 = await fetch('http://localhost:3000/api/unified-multi-agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agents: [{ id: 'socrates', name: 'Socrates', type: 'historical' }],
        message: query,
        context: { enableRAG: true, sessionHistory: [] },
      }),
    })
    const time1 = Date.now() - start1

    if (!res1.ok) {
      console.log(`   ❌ Request failed: ${res1.status}`)
      continue
    }

    const data1 = await res1.json()

    // Small delay to ensure cache is written
    await new Promise(resolve => setTimeout(resolve, 100))

    // Second attempt (cache hit)
    const start2 = Date.now()
    const res2 = await fetch('http://localhost:3000/api/unified-multi-agent-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agents: [{ id: 'socrates', name: 'Socrates', type: 'historical' }],
        message: query,
        context: { enableRAG: true, sessionHistory: [] },
      }),
    })
    const time2 = Date.now() - start2

    const improvement = ((1 - time2 / time1) * 100).toFixed(0) + '%'
    const sources = data1.responses?.[0]?.ragMetadata?.retrievedDocs || 0

    results.push({
      query,
      cacheMiss: time1,
      cacheHit: time2,
      improvement,
      sources,
    })

    console.log(`   Cache miss: ${time1}ms, Cache hit: ${time2}ms (${improvement} faster)\n`)
  }

  console.log('='.repeat(70))
  console.log('📊 Performance Summary\n')

  const avgCacheMiss = Math.round(results.reduce((sum, r) => sum + r.cacheMiss, 0) / results.length)
  const avgCacheHit = Math.round(results.reduce((sum, r) => sum + r.cacheHit, 0) / results.length)
  const avgImprovement = Math.round(
    (results.reduce((sum, r) => sum + (1 - r.cacheHit / r.cacheMiss), 0) / results.length) * 100
  )
  const avgSources = Math.round(results.reduce((sum, r) => sum + r.sources, 0) / results.length)

  console.log('Queries tested:', results.length)
  console.log('Avg cache miss:', avgCacheMiss + 'ms')
  console.log('Avg cache hit:', avgCacheHit + 'ms')
  console.log('Avg improvement:', avgImprovement + '%')
  console.log('Avg sources retrieved:', avgSources)
  console.log('')

  console.log('Performance Targets:')
  console.log('  Cache miss: <1000ms', avgCacheMiss < 1000 ? '✅' : '❌')
  console.log('  Cache hit: <100ms', avgCacheHit < 100 ? '✅' : '❌')
  console.log('  Improvement: >80%', avgImprovement > 80 ? '✅' : '❌')
  console.log('  Sources: 3-5', avgSources >= 3 && avgSources <= 5 ? '✅' : '⚠️')
  console.log('')

  console.log('='.repeat(70))
  console.log('✅ Benchmark Complete!')
  console.log('')
  console.log('Next steps:')
  console.log('  - Check admin dashboard for updated metrics')
  console.log('  - Review cache hit rate at /admin/rag-analytics')
  console.log('  - Verify all 10 queries appear in query logs')
}

// Run benchmark
benchmark().catch(error => {
  console.error('\n❌ Benchmark failed:', error)
  console.log('\nMake sure:')
  console.log('  1. Dev server is running: yarn dev')
  console.log('  2. Database is connected')
  console.log('  3. ChromaDB is running')
  console.log('  4. USE_MOCK_GENERATION=true in .env.local')
  process.exit(1)
})
