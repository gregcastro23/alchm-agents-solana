import { ChromaClient } from 'chromadb'

async function verifyCollection() {
  try {
    const client = new ChromaClient({ path: 'http://localhost:8001' })
    const collection = await client.getCollection({ name: 'historical_agents' })
    const count = await collection.count()

    console.log(`✅ Collection 'historical_agents' found`)
    console.log(`📊 Document count: ${count}`)

    if (count > 0) {
      const results = await collection.peek({ limit: 5 })
      console.log('\n📝 Sample documents:')
      console.log(`  - IDs: ${results.ids.join(', ')}`)
      console.log(`  - Total documents: ${count}`)
    }
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

verifyCollection()
