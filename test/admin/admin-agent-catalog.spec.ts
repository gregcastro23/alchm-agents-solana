// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import { codeRoster } from '@/lib/admin/agents'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { FACTION_NAMES, ratableFromRoster } from '@/lib/agents/rating/vessel-payload'
import { rateStats } from '@/lib/agents/rating/ovr-archetype'

describe('admin Vessel catalog', () => {
  it('uses shared Vessel identity and likeness without serializing charts or implying live ratings', async () => {
    const roster = await codeRoster()
    expect(roster).toHaveLength(HISTORICAL_AGENTS.length)
    for (const agent of HISTORICAL_AGENTS) {
      const row = roster.find(entry => entry.agentId === agent.id)!
      const vessel = ratableFromRoster(agent)
      expect(row.vessel).toEqual({
        faction: FACTION_NAMES[vessel.faction],
        era: vessel.appearance.era,
        archetype:
          agent.consciousness?.natalChart &&
          agent.consciousness.natalChart.provenance !== 'placeholder'
            ? rateStats(vessel.stats).archetype.title
            : null,
        provenance: vessel.provenance,
        likeness: vessel.appearance.portraitUrl ? 'painted' : 'procedural',
        hasModel: Boolean(vessel.avatarModelUrl || vessel.headMeshUrl),
      })
      expect(Object.keys(row).sort()).toEqual(['agentId', 'chart', 'name', 'vessel'])
    }
    expect(roster.some(row => row.vessel?.likeness === 'painted')).toBe(true)
    expect(roster.some(row => row.vessel?.likeness === 'procedural')).toBe(true)
  })
})
