// Simple migration script to populate database with historical agents
const { PrismaClient } = require('./lib/generated/prisma')
const { DEMO_AGENTS } = require('./lib/demo-agents-data')

const prisma = new PrismaClient()

async function migrateAgents() {
  console.log('🚀 Starting Historical Agents Migration...')
  console.log('Migrating', DEMO_AGENTS.length, 'agents...')

  let migrated = 0
  let errors = []

  for (const agent of DEMO_AGENTS) {
    try {
      // Check if agent already exists
      const existing = await prisma.historicalAgent.findUnique({
        where: { agentId: agent.id },
      })

      if (existing) {
        console.log(`Agent ${agent.name} already exists, skipping...`)
        continue
      }

      // Create agent
      await prisma.historicalAgent.create({
        data: {
          agentId: agent.id,
          name: agent.name,
          title: agent.title,

          // Birth data
          birthDate: new Date(agent.birthData.date),
          birthTime: agent.birthData.time,
          birthLocation: agent.birthData.location,

          // Consciousness profile
          consciousnessLevel: agent.consciousness.level,
          monicaConstant: agent.consciousness.monicaConstant,
          dominantElement: agent.consciousness.dominantElement,
          dominantModality: agent.consciousness.dominantModality || null,
          signature: agent.consciousness.signature,

          // Personality data
          personalityCore: agent.personality.core,
          personalityShadows: agent.personality.shadows,
          personalityGifts: agent.personality.gifts,
          personalityChallenges: agent.personality.challenges,
          currentMood: agent.personality.currentMood,
          evolutionStage: agent.personality.evolutionStage || 0,

          // Abilities
          specialty: agent.abilities.specialty,
          wisdomDomains: agent.abilities.wisdomDomains,
          skills: agent.abilities.skills || [],
          teachingStyle: agent.abilities.teachingStyle,
          resonanceType: agent.abilities.resonanceType,
          uniquePower: agent.abilities.uniquePower,

          // Appearance
          avatar: agent.appearance.avatar || null,
          color: agent.appearance.color,
          symbol: agent.appearance.symbol,
          aura: agent.appearance.aura || null,

          // Birth chart
          natalChart: agent.consciousness.natalChart,

          // Traits
          traits: agent.personality.traits || {},

          // Statistics
          conversations: agent.stats?.conversations || 0,
          wisdomShared: agent.stats?.wisdomShared || 0,
          resonanceScore: agent.stats?.resonanceScore || 0.5,
          evolutionPoints: agent.stats?.evolutionPoints || 0,
          lastActive: agent.stats?.lastActive || new Date(),
        },
      })

      migrated++
      console.log(`✓ Migrated ${agent.name}`)
    } catch (error) {
      const errorMsg = `Failed to migrate ${agent.name}: ${error.message}`
      errors.push(errorMsg)
      console.error('✗', errorMsg)
    }
  }

  console.log(`\n📊 Migration complete: ${migrated} agents migrated, ${errors.length} errors`)

  await prisma.$disconnect()

  if (errors.length === 0) {
    console.log('🎉 All agents migrated successfully!')
  } else {
    console.log('⚠️  Some errors occurred during migration')
    errors.forEach(error => console.error(error))
  }
}

migrateAgents().catch(console.error)
