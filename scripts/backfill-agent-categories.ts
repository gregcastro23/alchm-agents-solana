import { prisma } from '../lib/db'
import { isSyntheticDegreeAgentId } from '../lib/historical-agents-db'

async function backfillAgentCategories() {
  console.log('🔄 Starting backfill of agentCategory and hasBirthchart columns...')

  try {
    const agents = await prisma.historical_agents.findMany({
      select: {
        id: true,
        agentId: true,
        natalChart: true,
        agentCategory: true,
        hasBirthchart: true,
      },
    })

    console.log(`📊 Found ${agents.length} total agent records in database.`)

    let historicalCount = 0
    let planetaryCount = 0
    let moonPhaseCount = 0

    for (const agent of agents) {
      const id = agent.agentId.toLowerCase().trim()
      let category = 'historical'
      let hasChart = true

      if (id.startsWith('planetary-') || id.startsWith('planetary_')) {
        category = 'planetary'
        hasChart = false
        planetaryCount++
      } else if (id.startsWith('moon-phase-') || id.startsWith('moon-agent-')) {
        category = 'moon_phase'
        hasChart = false
        moonPhaseCount++
      } else {
        category = 'historical'
        hasChart = true
        historicalCount++
      }

      await prisma.historical_agents.update({
        where: { id: agent.id },
        data: {
          agentCategory: category,
          hasBirthchart: hasChart,
        },
      })
    }

    console.log('✅ Backfill Complete!')
    console.log(`   - Historical Agents (with charts): ${historicalCount}`)
    console.log(`   - Planetary Degree Agents: ${planetaryCount}`)
    console.log(`   - Moon Phase Agents: ${moonPhaseCount}`)
  } catch (error) {
    console.error('❌ Backfill failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

backfillAgentCategories()
