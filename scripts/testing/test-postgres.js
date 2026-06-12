#!/usr/bin/env node

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function testConnection() {
  try {
    console.log('🔍 Testing PostgreSQL connection...')

    // Test basic connection
    const userCount = await prisma.user.count()
    console.log(`✅ Connected! Found ${userCount} users`)

    // Test data integrity
    const users = await prisma.user.findMany({ take: 3 })
    console.log(
      '📋 Sample users:',
      users.map(u => ({ id: u.id, email: u.email }))
    )

    const profileCount = await prisma.profile.count()
    console.log(`✅ Found ${profileCount} profiles`)

    console.log('🎉 PostgreSQL migration successful!')
  } catch (error) {
    console.error('❌ Connection test failed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

testConnection()
