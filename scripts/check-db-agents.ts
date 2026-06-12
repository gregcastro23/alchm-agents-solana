import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function checkAgents() {
  try {
    const agents = await prisma.historical_agents.findMany({
      where: { isActive: true },
      select: {
        agentId: true,
        name: true,
        historicalEra: true,
        consciousnessLevel: true,
        monicaConstant: true,
      },
      orderBy: { name: 'asc' },
    })

    console.log(`\n📊 Active Historical Agents in Database: ${agents.length}\n`)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    agents.forEach((agent, idx) => {
      console.log(
        `${(idx + 1).toString().padStart(2)}. ${agent.name.padEnd(30)} | Era: ${agent.historicalEra.padEnd(15)} | Level: ${agent.consciousnessLevel.padEnd(12)} | MC: ${agent.monicaConstant.toFixed(2)}`
      )
    })

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    // Group by era
    const byEra = agents.reduce(
      (acc, agent) => {
        acc[agent.historicalEra] = (acc[agent.historicalEra] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    console.log(`\n📈 Agents by Era:`)
    Object.entries(byEra)
      .sort((a, b) => b[1] - a[1])
      .forEach(([era, count]) => {
        console.log(`   ${era.padEnd(20)}: ${count}`)
      })

    await prisma.$disconnect()
  } catch (error) {
    console.error('❌ Error:', error)
    await prisma.$disconnect()
    process.exit(1)
  }
}

checkAgents()
