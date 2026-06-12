#!/usr/bin/env node

/**
 * Database Migration Script: SQLite to PostgreSQL
 *
 * This script migrates all data from the SQLite database to PostgreSQL
 * while preserving relationships and data integrity.
 */

import { PrismaClient } from '@prisma/client'

// SQLite client - create a separate client with explicit SQLite URL
const sqliteClient = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db',
    },
  },
})

// PostgreSQL client - use the environment variable
const postgresClient = new PrismaClient()

async function migrateData() {
  console.log('🚀 Starting database migration from SQLite to PostgreSQL...')

  try {
    // Migrate users table
    console.log('📋 Migrating users...')
    const users = await sqliteClient.user.findMany()
    console.log(`Found ${users.length} users`)

    for (const user of users) {
      await postgresClient.user.create({ data: user })
    }
    console.log('✅ Users migrated')

    // Migrate profiles table
    console.log('📋 Migrating profiles...')
    const profiles = await sqliteClient.profile.findMany()
    console.log(`Found ${profiles.length} profiles`)

    for (const profile of profiles) {
      await postgresClient.profile.create({ data: profile })
    }
    console.log('✅ Profiles migrated')

    // Migrate user profiles
    console.log('📋 Migrating user profiles...')
    const userProfiles = await sqliteClient.userProfile.findMany()
    console.log(`Found ${userProfiles.length} user profiles`)

    for (const userProfile of userProfiles) {
      await postgresClient.userProfile.create({ data: userProfile })
    }
    console.log('✅ User profiles migrated')

    // Migrate historical agents
    console.log('📋 Migrating historical agents...')
    const historicalAgents = await sqliteClient.historicalAgent.findMany()
    console.log(`Found ${historicalAgents.length} historical agents`)

    for (const agent of historicalAgents) {
      await postgresClient.historicalAgent.create({ data: agent })
    }
    console.log('✅ Historical agents migrated')

    // Migrate AI personalities (if any)
    console.log('📋 Migrating AI personalities...')
    const aiPersonalities = await sqliteClient.aIPersonality.findMany()
    console.log(`Found ${aiPersonalities.length} AI personalities`)

    for (const personality of aiPersonalities) {
      await postgresClient.aIPersonality.create({ data: personality })
    }
    console.log('✅ AI personalities migrated')

    // Migrate agent conversations
    console.log('📋 Migrating agent conversations...')
    const agentConversations = await sqliteClient.agentConversation.findMany()
    console.log(`Found ${agentConversations.length} agent conversations`)

    for (const conversation of agentConversations) {
      await postgresClient.agentConversation.create({ data: conversation })
    }
    console.log('✅ Agent conversations migrated')

    // Continue with other tables...
    console.log('📋 Migrating training interactions...')
    const trainingInteractions = await sqliteClient.trainingInteraction.findMany()
    console.log(`Found ${trainingInteractions.length} training interactions`)

    for (const interaction of trainingInteractions) {
      await postgresClient.trainingInteraction.create({ data: interaction })
    }
    console.log('✅ Training interactions migrated')

    // Migrate achievements
    console.log('📋 Migrating achievements...')
    const achievements = await sqliteClient.achievement.findMany()
    console.log(`Found ${achievements.length} achievements`)

    for (const achievement of achievements) {
      await postgresClient.achievement.create({ data: achievement })
    }
    console.log('✅ Achievements migrated')

    console.log('🎉 Migration completed successfully!')
    console.log('\n📊 Migration Summary:')
    console.log(`   • Users: ${users.length}`)
    console.log(`   • Profiles: ${profiles.length}`)
    console.log(`   • User Profiles: ${userProfiles.length}`)
    console.log(`   • Historical Agents: ${historicalAgents.length}`)
    console.log(`   • AI Personalities: ${aiPersonalities.length}`)
    console.log(`   • Agent Conversations: ${agentConversations.length}`)
    console.log(`   • Training Interactions: ${trainingInteractions.length}`)
    console.log(`   • Achievements: ${achievements.length}`)
  } catch (error) {
    console.error('❌ Migration failed:', error)
    process.exit(1)
  } finally {
    await sqliteClient.$disconnect()
    await postgresClient.$disconnect()
  }
}

// Run migration
migrateData()
