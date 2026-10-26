import 'server-only'

import { getHistoricalAgent } from '@/lib/agents/historical'
import { HistoricalAgentsService, dbAgentToCraftedAgent } from '@/lib/historical-agents-db'
import { agentRowFacts, type AgentRowFacts } from '@/lib/agents/forged-privacy-profile'
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
import { deriveSacredStats } from '@/lib/agents/persona/derive-sacred-stats'

/**
 * A resolved agent plus where it came from. `row` carries the handful of columns that decide
 * whether the agent is a person's private data (see `forged-privacy-profile.ts`); it is `null` for the
 * canonical in-memory figures, which are public. The chart and birth data are in `agent`, not in
 * `row`: the verdict can travel without them.
 */
export interface ResolvedAgentRecord {
  agent: CraftedAgent
  origin: 'canonical' | 'database'
  row: AgentRowFacts | null
}

export async function resolveAnyAgentRecord(id: string): Promise<ResolvedAgentRecord | null> {
  if (!id || !id.trim()) return null

  let agent: CraftedAgent | null = null
  let row: AgentRowFacts | null = null

  // 1. Canonical fast path (no DB).
  const canonical = getHistoricalAgent(id)
  if (canonical) {
    agent = canonical
  } else {
    // 2. DB-backed agents (planetary / moon / crafted), same slug as the feed.
    try {
      let dbRow = await HistoricalAgentsService.getAgent(id)

      if (!dbRow) {
        const lower = id.trim().toLowerCase()
        if (lower !== id) {
          dbRow = await HistoricalAgentsService.getAgent(lower)
        }
        // 3. A feed link may carry an email-derived slug missing the `planetary-`
        //    prefix (e.g. `mars-aries-12` instead of `planetary-mars-aries-12`).
        if (!dbRow && !lower.startsWith('planetary-')) {
          dbRow = await HistoricalAgentsService.getAgent(`planetary-${lower}`)
        }
      }

      if (dbRow) {
        agent = dbAgentToCraftedAgent(dbRow as any)
        row = agentRowFacts(dbRow as unknown as Record<string, unknown>)
      }
    } catch (err) {
      console.error(`[resolveAnyAgent] DB lookup failed for "${id}":`, err)
    }
  }

  if (agent) {
    if (!agent.sacredStats && agent.consciousness?.natalChart?.planets) {
      try {
        agent.sacredStats = deriveSacredStats(agent)
      } catch (err) {
        console.warn(`[resolveAnyAgent] Failed to derive sacred stats for "${id}":`, err)
      }
    }
    return { agent, origin: row ? 'database' : 'canonical', row }
  }

  return null
}

export async function resolveAnyAgent(id: string): Promise<CraftedAgent | null> {
  return (await resolveAnyAgentRecord(id))?.agent ?? null
}
