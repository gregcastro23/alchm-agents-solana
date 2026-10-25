import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { isSyntheticAgentId } from '@/lib/agents/forged-privacy'

/**
 * The agents whose data is public by construction: the canonical roster (public figures,
 * `HISTORICAL_AGENTS`) and the sky-generated planetary / moon agents. A `historical_agents`
 * row outside both sets is someone's vessel until a writer proves otherwise, whatever era or
 * `craftedBy` it happens to be stamped with: a Railway row carries no `craftedBy`, and the
 * era a person's row gets from `POST /api/agents` is `modern_pre1950`.
 *
 * Server-side only by intent (it pulls in the whole roster); the pure projections it gates
 * live in `forged-privacy.ts`.
 */
export const CANONICAL_AGENT_IDS: ReadonlySet<string> = new Set(
  HISTORICAL_AGENTS.map(agent => agent.id)
)

export function isPublicRosterId(agentId: unknown): boolean {
  return (
    typeof agentId === 'string' && (CANONICAL_AGENT_IDS.has(agentId) || isSyntheticAgentId(agentId))
  )
}
