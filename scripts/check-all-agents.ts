import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAllAgents() {
  try {
    // Check all agents
    const allAgents = await prisma.historical_agents.count()
    const activeAgents = await prisma.historical_agents.count({ where: { isActive: true } })
    const inactiveAgents = await prisma.historical_agents.count({ where: { isActive: false } })

    console.log(`\n📊 Historical Agents Count:`)
    console.log(`   Total: ${allAgents}`)
    console.log(`   Active (isActive=true): ${activeAgents}`)
    console.log(`   Inactive (isActive=false): ${inactiveAgents}\n`)

    if (allAgents === 0) {
      console.log('⚠️  No agents found in database!')
      console.log('   The historical_agents table appears to be empty.')
      console.log('   This is likely the issue - ChromaDB has 57 agents but the database has 0.')
    } else {
      // Get sample agents
      const sample = await prisma.historical_agents.findMany({
        take: 10,
        select: {
          agentId: true,
          name: true,
          isActive: true,
          historicalEra: true,
        },
      })

      console.log('📋 Sample agents:')
      sample.forEach((agent, idx) => {
        console.log(`   ${idx + 1}. ${agent.name} (${agent.agentId}) - Active: ${agent.isActive}`)
      })
    }

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkAllAgents()
