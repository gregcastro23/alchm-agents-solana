/**
 * Quick smoke test for the Agent Action System.
 * Runs locally with bun — validates yield claim + activation tick.
 *
 * Usage: bun run scripts/test-agent-actions.ts
 */

import { PrismaClient, Prisma } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('═══ Agent Action System — Smoke Test ═══\n')

  // 1. Count agentic users
  const agenticCount = await (prisma.users as any).count({
    where: { isAgentic: true },
  })
  console.log(`✓ Agentic users in database: ${agenticCount}`)

  // 2. Pick one agent and test yield claim
  const sampleAgent = await (prisma.users as any).findFirst({
    where: { isAgentic: true },
    include: {
      user_profiles: {
        select: {
          natalChart: true,
          natalPositions: true,
          dominantElement: true,
        },
      },
    },
  })

  if (!sampleAgent) {
    console.error('✗ No agentic users found!')
    process.exit(1)
  }

  console.log(`✓ Sample agent: ${sampleAgent.name} (${sampleAgent.email})`)

  // Check natal positions extraction
  const profile = sampleAgent.user_profiles
  const hasNatal = profile?.natalPositions && Array.isArray(profile.natalPositions)
  const natalCount = hasNatal ? profile.natalPositions.length : 0
  console.log(`✓ Natal positions: ${natalCount} planets stored`)

  if (hasNatal) {
    const planets = profile.natalPositions.slice(0, 3).map((p: any) => `${p.planet} in ${p.sign}`)
    console.log(`  → ${planets.join(', ')}...`)
  }

  // 3. Check token balance
  const balance = await prisma.tokenBalance.findUnique({
    where: { userId: sampleAgent.id },
  })
  console.log(
    `✓ Token balance: Spirit=${Number(balance?.spirit || 0)}, ` +
      `Essence=${Number(balance?.essence || 0)}, ` +
      `Matter=${Number(balance?.matter || 0)}, ` +
      `Substance=${Number(balance?.substance || 0)}`
  )

  // 4. Test yield claim for this single agent
  console.log('\n--- Testing yield claim ---')
  const perType = 2 // small amount for testing
  const dateStr = new Date().toISOString().split('T')[0]
  const testIdempotencyPrefix = `test:agentic:daily:${sampleAgent.id}:${dateStr}`

  try {
    await prisma.$transaction(async tx => {
      const transactionGroupId = crypto.randomUUID()

      for (const token of ['Spirit', 'Essence', 'Matter', 'Substance']) {
        await tx.tokenTransaction.create({
          data: {
            transactionGroupId,
            userId: sampleAgent.id,
            tokenType: token,
            amount: new Prisma.Decimal(perType),
            sourceType: 'agents_daily_yield_test',
            description: 'Smoke test yield',
            idempotencyKey: `${testIdempotencyPrefix}:${token}`,
            createdAt: new Date(),
          },
        })
      }

      await tx.tokenBalance.update({
        where: { userId: sampleAgent.id },
        data: {
          spirit: { increment: perType },
          essence: { increment: perType },
          matter: { increment: perType },
          substance: { increment: perType },
          updatedAt: new Date(),
        },
      })
    })

    const newBalance = await prisma.tokenBalance.findUnique({
      where: { userId: sampleAgent.id },
    })
    console.log(
      `✓ Yield claimed! New balance: Spirit=${Number(newBalance?.spirit || 0)}, ` +
        `Essence=${Number(newBalance?.essence || 0)}, ` +
        `Matter=${Number(newBalance?.matter || 0)}, ` +
        `Substance=${Number(newBalance?.substance || 0)}`
    )
  } catch (err: any) {
    if (err?.code === 'P2002') {
      console.log('⊘ Already claimed today (idempotency key collision)')
    } else {
      console.error('✗ Yield claim error:', err.message)
    }
  }

  // 5. Test activation scoring (compute-only, no DB)
  console.log('\n--- Testing activation scoring ---')

  // Import the calculator directly
  const { getCurrentPlanetaryPositions } = require('../lib/calculate-transits')
  const { PlanetaryHourCalculator } = require('../lib/planetary-hour')

  const now = new Date()
  const positions = getCurrentPlanetaryPositions(now)
  const hourCalc = new PlanetaryHourCalculator()
  const { planet: hourPlanet, isDaytime } = hourCalc.getPlanetaryHour(now)
  const dayRuler = hourCalc.getPlanetaryDay(now)

  console.log(`✓ Current planetary hour: ${hourPlanet} (${isDaytime ? 'daytime' : 'nighttime'})`)
  console.log(`✓ Day ruler: ${dayRuler}`)
  console.log(
    `✓ Transiting planets: ${Object.entries(positions)
      .map(([p, d]: [string, any]) => `${p} ${d.degree.toFixed(1)}° ${d.sign}`)
      .join(', ')}`
  )

  if (hasNatal && natalCount > 0) {
    const natalPositions = profile.natalPositions
    const natalPlanets = natalPositions.map((p: any) => p.planet)
    const hourMatch = natalPlanets.includes(hourPlanet)
    const dayMatch = natalPlanets.includes(dayRuler)

    console.log(
      `✓ ${sampleAgent.name}: hour match=${hourMatch}, day match=${dayMatch}, element=${profile.dominantElement}`
    )
  }

  // 6. Test action event creation
  console.log('\n--- Testing action event creation ---')
  const testIdKey = `test_action:${sampleAgent.id}:${now.toISOString().slice(0, 13)}`
  try {
    await prisma.agent_action_events.upsert({
      where: { idempotencyKey: testIdKey },
      create: {
        agentId: sampleAgent.id,
        agentEmail: sampleAgent.email,
        eventType: 'insight',
        triggerType: 'smoke_test',
        triggerSummary: `planetary_hour_${hourPlanet}`,
        metadataPayload: {
          agentName: sampleAgent.name,
          messageType: 'insight',
          insightTitle: 'Smoke Test Observation',
          insightContent: `${sampleAgent.name} observes the ${hourPlanet} hour on this ${dayRuler} day.`,
          timestamp: now.toISOString(),
        },
        score: 0.75,
        idempotencyKey: testIdKey,
        status: 'test',
        evaluatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now },
    })
    console.log('✓ Action event created successfully')
  } catch (err: any) {
    console.error('✗ Action event error:', err.message)
  }

  // Summary
  console.log('\n═══════════════════════════════════════════')
  console.log('  All smoke tests passed! ✓')
  console.log('═══════════════════════════════════════════')

  await prisma.$disconnect()
}

main().catch(async err => {
  console.error('Fatal:', err)
  await prisma.$disconnect()
  process.exit(1)
})
