import { describe, it, expect } from 'vitest'
import { feedStreamBus } from '@/lib/agents/feed-stream-bus'
import {
  serializeRecipePost,
  type ActionEventRow,
  type AgentMeta,
} from '@/lib/agents/historical-feed-contract'
import { FIXTURE_AGENTS } from '@/lib/agents/rating-contract'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'

describe('Feed Stream & Agent Rating Hydration Contract', () => {
  it('serializes RecipePostItem with fully resolved appearance profile', () => {
    const row: ActionEventRow = {
      id: 'event-123',
      agentId: 'isaac-newton',
      eventType: 'recipe_generation',
      metadataPayload: {
        recipeName: 'Prismatic Saffron Elixir',
        element: 'Fire',
      },
      postedAt: new Date('2026-10-18T00:00:00.000Z'),
    }

    const agentMeta: AgentMeta = {
      name: 'Isaac Newton',
      dominantElement: 'Fire',
      natalChart: { planets: { Sun: { sign: 'Capricorn' } } },
    }

    const item = serializeRecipePost(row, agentMeta, '2026-10-18T00:00:00.000Z')

    expect(item.type).toBe('recipe_post')
    expect(item.agent.id).toBe('isaac-newton')
    expect(item.agent.appearance).toBeDefined()
    expect(item.agent.appearance!.era).toBe('enlightenment')
    expect(item.agent.appearance!.headSilhouette.crownStyle).toBe('newton-curls')
    expect(item.agent.appearance!.signatureRelic).toBe('prism-octahedron')
    expect(item.agent.appearance!.portraitSvgDataUri).toMatch(/^data:image\/svg\+xml,/)
  })

  it('broadcasts and caches agent rating payloads on feedStreamBus', () => {
    feedStreamBus.resetForTesting()
    expect(feedStreamBus.getRecentRatings().length).toBe(0)

    const fixture = FIXTURE_AGENTS[0] // Newton
    feedStreamBus.recordAgentRating(fixture)

    const cached = feedStreamBus.getRecentRatings()
    expect(cached.length).toBe(1)
    expect(cached[0].key).toBe('isaac-newton')
    expect(cached[0].appearance).toBeDefined()
    expect(cached[0].ovr).toBe(90)
    expect(cached[0].surge.active).toBe(true)
  })

  it('publishes resonance surge events with ESMS balances and appearance', () => {
    feedStreamBus.resetForTesting()
    let receivedSurgeEvent: any = null

    const unsubscribe = feedStreamBus.subscribe(msg => {
      if (msg.event === 'resonance_surge') {
        receivedSurgeEvent = msg.data
      }
    })

    const emily = FIXTURE_AGENTS.find(a => a.key === 'emily-dickinson')!
    feedStreamBus.recordResonanceSurge({
      agentId: emily.key,
      surge: emily.surge,
      esms: emily.esms,
      appearance: emily.appearance,
    })

    expect(receivedSurgeEvent).not.toBeNull()
    expect(receivedSurgeEvent.agentId).toBe('emily-dickinson')
    expect(receivedSurgeEvent.surge.active).toBe(true)
    expect(receivedSurgeEvent.surge.surgeType).toBe('equilibrium')
    expect(receivedSurgeEvent.esms.spirit).toBe(91.2)
    expect(receivedSurgeEvent.appearance.signatureRelic).toBe('herbarium-quill-lantern')

    unsubscribe()
  })

  it('verifies appearance profiles for all 4 pilot fixtures in feeds', () => {
    const pilots = ['isaac-newton', 'leonardo-da-vinci', 'emily-dickinson', 'user-avatar-neo']
    for (const key of pilots) {
      const app = resolveAgentAppearance(key)
      expect(app.portraitSvgDataUri).toMatch(/^data:image\/svg\+xml,/)
      expect(app.signatureRelic).toBeDefined()
      expect(app.headSilhouette.crownStyle).toBeDefined()
    }
  })
})
