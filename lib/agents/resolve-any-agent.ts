import 'server-only'

import { getHistoricalAgent } from '@/lib/agents/historical'
import { HistoricalAgentsService, dbAgentToCraftedAgent } from '@/lib/historical-agents-db'
import type { CraftedAgent } from '@/lib/agent-types'

/**
 * Resolve ANY agent id to a CraftedAgent for the profile page.
 *
 * The profile route used to call only getHistoricalAgent(), which knows just
 * the 71 canonical in-memory agents — so /agent/<id> 404'd for the ~3,637
 * planetary/moon agents and any DB-only crafted agent. Those agents are all
 * seeded into the historical_agents table under the SAME slug the council feed
 * uses (planetary-<planet>-<sign>-<degree>, moon-phase-<phase>-<deg>, …; see
 * backend/seed_3600_planetary_agents.py and scripts/seed-moon-agents.ts), so a
 * single DB lookup + dbAgentToCraftedAgent() covers them.
 *
 * Layered, cheapest-first:
 *   1. In-memory canonical 71 (getHistoricalAgent — also case/suffix tolerant). No DB hit.
 *   2. historical_agents DB row → dbAgentToCraftedAgent (planetary, moon, crafted).
 *   3. Defensive retries: lowercase, and a `planetary-` prefix in case a feed
 *      link dropped it (email-derived agentId vs the seeded slug).
 *
 * Returns null when nothing matches — the caller renders notFound().
 */
export async function resolveAnyAgent(id: string): Promise<CraftedAgent | null> {
  if (!id || !id.trim()) return null

  // 1. Canonical fast path (no DB).
  const canonical = getHistoricalAgent(id)
  if (canonical) return canonical

  // 2. DB-backed agents (planetary / moon / crafted), same slug as the feed.
  try {
    let row = await HistoricalAgentsService.getAgent(id)

    if (!row) {
      const lower = id.trim().toLowerCase()
      if (lower !== id) {
        row = await HistoricalAgentsService.getAgent(lower)
      }
      // 3. A feed link may carry an email-derived slug missing the `planetary-`
      //    prefix (e.g. `mars-aries-12` instead of `planetary-mars-aries-12`).
      if (!row && !lower.startsWith('planetary-')) {
        row = await HistoricalAgentsService.getAgent(`planetary-${lower}`)
      }
    }

    if (row) return dbAgentToCraftedAgent(row as any)
  } catch (err) {
    console.error(`[resolveAnyAgent] DB lookup failed for "${id}":`, err)
  }

  return null
}
