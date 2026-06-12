import { ChromaClient } from 'chromadb'

async function checkChromaDB() {
  const client = new ChromaClient({ path: 'http://localhost:8001' })

  try {
    // Heartbeat check
    await client.heartbeat()
    console.log('✅ ChromaDB is running\n')

    // List collections
    const collections = await client.listCollections()
    console.log(`📚 Total Collections: ${collections.length}\n`)

    for (const col of collections) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
      console.log(`📦 Collection: ${col.name}`)
      const count = await col.count()
      console.log(`📊 Document Count: ${count}`)

      // Get sample data
      const peek = await col.peek({ limit: 5 })
      if (peek.ids && peek.ids.length > 0) {
        console.log(`🔍 Sample IDs (first 5):`)
        peek.ids.forEach((id, idx) => {
          console.log(`   ${idx + 1}. ${id}`)
        })
      }

      // Get metadata from first document
      const sample = await col.get({ limit: 1 })
      if (sample.metadatas && sample.metadatas[0]) {
        console.log(`📋 Metadata fields: ${Object.keys(sample.metadatas[0]).join(', ')}`)
        console.log(`📝 Sample metadata:`, JSON.stringify(sample.metadatas[0], null, 2))
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log('✅ ChromaDB check complete')
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

checkChromaDB()
