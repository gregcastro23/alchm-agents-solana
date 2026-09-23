import { NextRequest, NextResponse } from 'next/server'
import { pastBudget } from '@/lib/cron/registry'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { POST as generatePOST } from '@/app/api/menu-planner/generate/route'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'

export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  return handleCron(request)
}

export async function GET(request: Request) {
  return handleCron(request)
}

async function handleCron(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/agents/weekly-menu')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('agents/weekly-menu', async ({ deadlineMs }) => {
    console.log(
      `[cron/agents/weekly-menu] Starting weekly menu generation for ${HISTORICAL_AGENTS.length} agents...`
    )

    // Helper to chunk the agents
    const batchSize = 5
    const results: any[] = []

    const chunk = <T>(arr: T[], size: number): T[][] =>
      Array.from({ length: Math.ceil(arr.length / size) }, (v, i) =>
        arr.slice(i * size, i * size + size)
      )

    const batches = chunk(HISTORICAL_AGENTS, batchSize)

    let skippedForBudget = 0
    for (let i = 0; i < batches.length; i++) {
      // Each menu is a model call; stop starting batches before the deadline.
      if (pastBudget(deadlineMs)) {
        skippedForBudget = batches.slice(i).reduce((n, b) => n + b.length, 0)
        break
      }
      const batch = batches[i]
      console.log(`[cron/agents/weekly-menu] Processing batch ${i + 1}/${batches.length}...`)

      const batchPromises = batch.map(async agent => {
        try {
          const req = new NextRequest(new URL('http://localhost/api/menu-planner/generate'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              agentId: agent.id,
              regenerate: false, // Don't replace existing unless requested
              status: 'completed',
              shareToFeed: true,
            }),
          })
          const res = await generatePOST(req)
          const data = await res.json()
          return {
            agentId: agent.id,
            success: data.success === true,
            menuId: data.menu?.id || null,
            reused: data.reused === true,
            error: data.error || null,
          }
        } catch (err: any) {
          console.error(`[cron/agents/weekly-menu] Failed for agent ${agent.id}:`, err)
          return {
            agentId: agent.id,
            success: false,
            error: err.message || String(err),
          }
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add a small delay between batches to reduce pressure on API rates / DB pools
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const total = results.length
    const successful = results.filter(r => r.success).length
    const failed = total - successful

    console.log(
      `[cron/agents/weekly-menu] Finished. Successful: ${successful}, Failed: ${failed}, Total: ${total}`
    )

    return NextResponse.json(
      {
        success: failed === 0,
        total,
        successful,
        failed,
        skippedForBudget,
        results,
        timestamp: new Date().toISOString(),
      },
      { status: failed === 0 ? 200 : 207 }
    )
  })
}
