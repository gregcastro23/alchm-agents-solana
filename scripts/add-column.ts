import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  try {
    console.log('Adding column last_daily_claim_agents_at...')
    await prisma.$executeRawUnsafe(`
      ALTER TABLE token_balances
      ADD COLUMN IF NOT EXISTS last_daily_claim_agents_at TIMESTAMPTZ;
    `)
    console.log('Successfully added column.')
  } catch (err) {
    console.error('Failed:', err)
  } finally {
    await prisma.$disconnect()
  }
}

main()
