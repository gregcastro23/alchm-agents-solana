import { NextResponse } from 'next/server'
import { resolveWeeklyFeature } from '@/lib/agents/weekly-feature-rotation'
import { feedPusherService } from '@/lib/agents/feed-pusher'
import { authorizeCron } from '@/lib/security/cron-auth'
import { runCronJob } from '@/lib/cron/heartbeat'

/**
 * GET/POST /api/cron/agents/announce-weekly-feature
 *
 * Weekly cron: announces the new best-dignity free rotation to the community
 * feed (posted as the week's lead guide). Idempotent per week. Protected by
 * CRON_SECRET in production.
 *
 * Vercel Cron schedule: `22 0 * * 1` (Mondays 00:22 UTC, staggered off WTEN's minutes).
 */
export async function POST(request: Request) {
  return handleAnnounce(request)
}

export async function GET(request: Request) {
  return handleAnnounce(request)
}

const AGENTIC_DOMAIN = '@agentic.alchm.kitchen'
const cap = (s: string): string => (s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase() : s)

async function handleAnnounce(request: Request) {
  const cronAuth = authorizeCron(request, 'cron/agents/announce-weekly-feature')
  if (!cronAuth.ok) return cronAuth.response

  return runCronJob('agents/announce-weekly-feature', async () => {
    const feature = await resolveWeeklyFeature()

    // Resolve guide names for the announcement copy.
    const names = new Map<string, string>()
    try {
      const mod: any = await import('@/lib/agents/historical')
      for (const a of (mod.HISTORICAL_AGENTS ?? []) as any[]) names.set(a.id, a.name)
    } catch {
      /* names best-effort */
    }
    const guideNames = feature.featuredGuideIds.map(id => names.get(id) ?? id)
    const leadGuideId = feature.featuredGuideIds[0]

    const top = feature.topPlanets[0]
    const topStr = top ? `${cap(top.planet)} in ${cap(top.sign)} (${top.tier})` : 'the current sky'
    const aspectStr = feature.activeAspects
      .slice(0, 3)
      .map(a => `${cap(a.a)} ${a.aspect} ${cap(a.b)}`)
      .join(', ')

    const insightTitle = `🌟 This week's free attunement circle`
    const insightContent =
      `Strongest dignity this week: ${topStr}. ` +
      (guideNames.length ? `Free guides: ${guideNames.join(', ')}. ` : '') +
      (aspectStr ? `Active aspects: ${aspectStr}. ` : '') +
      `Join the circle to attune with this week's degree agents and earn ESMS — free to chat all week.`

    let pushed = false
    let pushError: string | undefined
    if (leadGuideId) {
      try {
        await feedPusherService.pushActions([
          {
            agentEmail: `${leadGuideId}${AGENTIC_DOMAIN}`,
            eventType: 'insight',
            idempotencyKey: `weekly-feature:${feature.weekKey}`,
            metadataPayload: {
              insightTitle,
              insightContent,
              message: insightContent,
              weeklyFeature: {
                weekStart: feature.weekStart,
                topPlanets: feature.topPlanets.map(
                  p => `${cap(p.planet)} ${cap(p.sign)} (${p.tier})`
                ),
                freeAgentIds: feature.freeAgentIds,
              },
            },
          } as any,
        ])
        pushed = true
      } catch (err: any) {
        pushError = err?.message ?? String(err)
        console.warn('[cron/agents/announce-weekly-feature] feed push failed:', pushError)
      }
    }

    return NextResponse.json({
      success: true,
      weekKey: feature.weekKey,
      guides: feature.featuredGuideIds,
      pushed,
      pushError,
      timestamp: new Date().toISOString(),
    })
  })
}
