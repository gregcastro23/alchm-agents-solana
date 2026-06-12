/**
 * Backfill user_profiles.bio from historical_agents.monicaCreationStory
 *
 * Links via email convention: users.email = agentId + '@agentic.alchm.kitchen'
 *
 * Usage:
 *   DATABASE_URL='prisma+postgres://...' DIRECT_URL='postgres://...' npx tsx scripts/backfill-agent-bios.ts
 *
 * Safe to re-run — skips rows where bio is already set.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const agents = await prisma.historical_agents.findMany({
    where: { isActive: true, monicaCreationStory: { not: null } },
    select: { agentId: true, name: true, monicaCreationStory: true },
  })

  console.log(`Found ${agents.length} agents with monicaCreationStory`)

  let updated = 0
  let skipped = 0

  for (const agent of agents) {
    const email = `${agent.agentId}@agentic.alchm.kitchen`

    const user = await prisma.users.findUnique({
      where: { email },
      select: { id: true, user_profiles: { select: { id: true, bio: true } } },
    })

    if (!user || !user.user_profiles) {
      console.log(`  ⊘ No user_profiles for ${agent.name} (${email})`)
      skipped++
      continue
    }

    if (user.user_profiles.bio) {
      console.log(`  ⊘ Bio already set for ${agent.name} — skipping`)
      skipped++
      continue
    }

    await prisma.$executeRawUnsafe(
      `UPDATE "user_profiles" SET "bio" = $1 WHERE "id" = $2`,
      agent.monicaCreationStory,
      user.user_profiles.id
    )

    console.log(`  ✓ Backfilled bio for ${agent.name}`)
    updated++
  }

  console.log(`\nDone — ${updated} updated, ${skipped} skipped`)
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
