#!/usr/bin/env node

import { Database } from 'bun:sqlite'
import pkg from 'pg'
const { Client } = pkg

async function migrateData() {
  console.log('🚀 Starting simple database migration...')

  // Connect to SQLite
  const sqliteDb = new Database('./dev.db')

  // Connect to PostgreSQL
  const pgClient = new Client({
    host: 'localhost',
    port: 5433,
    database: 'planetary_agents_dev',
    user: 'planetary',
    password: 'consciousness',
  })

  await pgClient.connect()

  try {
    // Migrate users
    console.log('📋 Migrating users...')
    const users = sqliteDb.query('SELECT * FROM users').all()
    console.log(`Found ${users.length} users`)

    for (const user of users) {
      // Convert Unix timestamp to ISO string
      const createdAt = user.createdAt ? new Date(parseInt(user.createdAt)).toISOString() : null
      const lastLogin = user.lastLogin ? new Date(parseInt(user.lastLogin)).toISOString() : null

      await pgClient.query(
        'INSERT INTO users (id, email, "passwordHash", name, provider, verified, "createdAt", "lastLogin") VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
        [
          user.id,
          user.email,
          user.passwordHash,
          user.name,
          user.provider,
          user.verified,
          createdAt,
          lastLogin,
        ]
      )
    }

    // Migrate profiles
    console.log('📋 Migrating profiles...')
    const profiles = sqliteDb.query('SELECT * FROM profiles').all()
    console.log(`Found ${profiles.length} profiles`)

    for (const profile of profiles) {
      // Convert Unix timestamp to ISO string
      const createdAt = profile.createdAt
        ? new Date(parseInt(profile.createdAt)).toISOString()
        : null
      const updatedAt = profile.updatedAt
        ? new Date(parseInt(profile.updatedAt)).toISOString()
        : null

      await pgClient.query(
        'INSERT INTO profiles (id, "userId", name, "avatarUrl", "birthInfo", "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $5, $6, $7)',
        [
          profile.id,
          profile.userId,
          profile.name,
          profile.avatarUrl,
          profile.birthInfo,
          createdAt,
          updatedAt,
        ]
      )
    }

    // Skip historical agents for now - complex table with many columns
    console.log('⏭️ Skipping historical agents migration (complex table, will handle separately)')

    console.log('🎉 Migration completed successfully!')
  } catch (error) {
    console.error('❌ Migration failed:', error)
  } finally {
    sqliteDb.close()
    await pgClient.end()
  }
}

migrateData()
