import { PrismaClient } from '@prisma/client'
import { syncCreditToAlchm } from '../lib/alchm-credit-sync'

const prisma = new PrismaClient()

async function main() {
  const agents = await prisma.historical_agents.findMany({
    select: {
      name: true,
      agentId: true,
    },
  })

  console.log(`Found ${agents.length} agents. Initializing balances on alchm.kitchen...`)

  for (const agent of agents) {
    const email = `${agent.agentId}@agentic.alchm.kitchen`
    console.log(`Crediting ${agent.name} (${email})...`)

    const result = await syncCreditToAlchm({
      userEmail: email,
      amounts: {
        spirit: '10.0000',
        essence: '10.0000',
        matter: '10.0000',
        substance: '10.0000',
      },
      source: 'initial_grant',
      idempotencyKey: `init_grant_v3_${agent.agentId}`,
    })

    if (result.ok) {
      console.log(`  ✓ Success!`)
    } else {
      console.error(`  ✗ Failed: ${result.error}`)
    }
  }
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
