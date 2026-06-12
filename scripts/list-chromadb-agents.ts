import { ChromaClient } from 'chromadb'

async function listAgents() {
  const client = new ChromaClient({ path: 'http://localhost:8001' })

  try {
    const collection = await client.getCollection({ name: 'historical_agents' })
    const count = await collection.count()
    console.log(`📊 Total documents in ChromaDB: ${count}\n`)

    // Get all documents
    const all = await collection.get({ limit: count })

    // Extract unique agents
    const agents = new Map<string, { name: string; chunks: number; era: string; level: string }>()

    if (all.metadatas) {
      all.metadatas.forEach((meta: any) => {
        const agentId = meta.agentId
        if (!agents.has(agentId)) {
          agents.set(agentId, {
            name: meta.agentName,
            chunks: 1,
            era: meta.era || 'Unknown',
            level: meta.consciousnessLevel || 'Unknown',
          })
        } else {
          const agent = agents.get(agentId)!
          agent.chunks++
        }
      })
    }

    // Sort by name
    const sortedAgents = Array.from(agents.entries()).sort((a, b) =>
      a[1].name.localeCompare(b[1].name)
    )

    console.log(`👥 Unique Agents Indexed: ${sortedAgents.length}\n`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    sortedAgents.forEach(([id, data], idx) => {
      console.log(
        `${(idx + 1).toString().padStart(2)}. ${data.name.padEnd(30)} | Chunks: ${data.chunks.toString().padStart(2)} | Era: ${data.era.padEnd(15)} | Level: ${data.level}`
      )
    })

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log(`\n📈 Summary:`)
    console.log(`   Total Agents: ${sortedAgents.length}`)
    console.log(`   Total Chunks: ${count}`)
    console.log(`   Avg Chunks per Agent: ${(count / sortedAgents.length).toFixed(1)}`)

    // Group by era
    const byEra = new Map<string, number>()
    sortedAgents.forEach(([_, data]) => {
      byEra.set(data.era, (byEra.get(data.era) || 0) + 1)
    })

    console.log(`\n📊 Agents by Era:`)
    Array.from(byEra.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([era, count]) => {
        console.log(`   ${era.padEnd(20)}: ${count}`)
      })
  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  }
}

listAgents()
