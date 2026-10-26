/**
 * Everything the public profile page (`app/(app)/agent/[id]/page.tsx`) knows about one agent, and
 * the decision about how much of it the viewer may be told.
 *
 * The page is a server component, and every prop it hands a client component is serialised into
 * the HTML and the RSC payload, so "hide it in the markup" is not a boundary. The boundary is
 * here: this module resolves the agent, decides on the server who is looking, and returns either
 * the whole agent (a public figure, the vessel's creator, an admin) or a projection of it built by
 * an allow-list (everybody else, for a vessel that is a person's private data). The page renders
 * what it is given and has no way to ask for more.
 *
 * Roster figures never call `auth()`: they are public, and the session read costs a cookie parse
 * and, for kitchen-bridged sessions, a network round trip.
 *
 * ## Chat logs are not a profile section
 *
 * `AgentConversation` rows are other people's conversations: the chatting user's id, their
 * message, the agent's reply, the session id and whatever `contextData` the client attached. The
 * bearer-gated `/api/agents/[slug]/{actions,interactions}` routes exist for service callers, and
 * `backend/chat_privacy.py` keeps a chat private unless its sender chose public visibility, which
 * nothing in the app sets. So no viewer of this page, the creator and admins included, is given
 * them: the creator of a vessel did not hold those conversations, and an admin who needs them has
 * `/admin/chats`. The page used to read them through the functions the gated routes use and
 * publish them to everyone, for the roster as well as for vessels.
 */
import 'server-only'

import {
  getAgentActions,
  getAgentArtifacts,
  getAgentBalances,
} from '@/lib/agents/activity-surfaces'
import type {
  AgentArtifact,
  AgentBalances,
  AgentAction as ServerAgentAction,
} from '@/lib/agents/activity-surfaces'
import {
  isEntitledToForgedVessel,
  isRestrictedProfileRow,
  projectForgedAgentForPublic,
  projectProgressionForPublic,
} from '@/lib/agents/forged-privacy-profile'
import { resolveForgedViewer } from '@/lib/agents/forged-privacy.server'
import {
  computeAgentProgression,
  type AgentProgressionProfile,
} from '@/lib/agents/leveling-service'
import { resolveAnyAgentRecord } from '@/lib/agents/resolve-any-agent'
import type { CraftedAgent } from '@/lib/agent-types'

/** How the viewer got what they are seeing. */
export type ProfileAccess =
  /** A roster figure or sky sprite: public, whole. */
  | 'public'
  /** The signed-in person who forged this vessel: whole. */
  | 'creator'
  /** A database-verified admin: whole. */
  | 'admin'
  /** A stranger looking at a vessel that is a person's private data: the projection. */
  | 'restricted'

/** An action as the page's client components receive it: what they render, nothing more. */
export interface PublicActivityAction {
  id: string
  type: string
  createdAt: string
  /** Always empty. The components read `type`, `createdAt` and `links.recipe`; the payload stays home. */
  metadata: Record<string, never>
  links: { recipe?: string }
}

export interface AgentProfileView {
  agent: CraftedAgent
  access: ProfileAccess
  /** True when `agent` is the allow-list projection. */
  restricted: boolean
  /** The viewer could not be established (a lookup threw), so they were treated as a stranger. */
  viewerDegraded: boolean
  progression: AgentProgressionProfile
  actions: PublicActivityAction[]
  artifacts: AgentArtifact[]
  /** An activity read failed, so an empty list above means "could not load", not "nothing yet". */
  activityDegraded: boolean
  balances: AgentBalances | null
}

/**
 * An action event reduced to what the page renders. Dropped: the metadata (an event payload is
 * whatever its writer put there, and the page never reads it), and the chat-thread link, which is
 * built from a session id.
 */
export function toPublicActivityAction(action: ServerAgentAction): PublicActivityAction {
  return {
    id: action.id,
    type: action.type,
    createdAt: action.createdAt,
    metadata: {},
    links: action.links.recipe ? { recipe: action.links.recipe } : {},
  }
}

export async function loadAgentProfile(id: string): Promise<AgentProfileView | null> {
  const record = await resolveAnyAgentRecord(id)
  if (!record) return null

  let agent = record.agent
  let access: ProfileAccess = 'public'
  let viewerDegraded = false

  if (record.row && isRestrictedProfileRow(record.row)) {
    const viewer = await resolveForgedViewer()
    viewerDegraded = viewer.degraded
    if (isEntitledToForgedVessel(record.row, viewer)) {
      access = viewer.isAdmin ? 'admin' : 'creator'
    } else {
      access = 'restricted'
      agent = projectForgedAgentForPublic(record.agent)
    }
  }
  const restricted = access === 'restricted'

  const progression = restricted
    ? projectProgressionForPublic(computeAgentProgression(agent))
    : computeAgentProgression(agent)

  // Activity surfaces, fetched server-side. A failed read leaves its list empty and says so
  // (`activityDegraded`) rather than reading as "nothing yet". Conversations are not read.
  let activityDegraded = false
  const degrade =
    <T>(label: string, empty: T) =>
    (err: unknown): T => {
      activityDegraded = true
      console.warn(`[agent-profile] ${label} unavailable:`, (err as Error)?.message)
      return empty
    }
  const noParams = new URLSearchParams()
  const [actionsRes, artifactsRes, balances] = await Promise.all([
    getAgentActions(agent.id, noParams, { includeConversations: false }).catch(
      degrade('actions', { actions: [] as ServerAgentAction[] })
    ),
    getAgentArtifacts(agent.id, noParams).catch(
      degrade('artifacts', { artifacts: [] as AgentArtifact[] })
    ),
    getAgentBalances(agent.id).catch(() => null),
  ])

  return {
    agent,
    access,
    restricted,
    viewerDegraded,
    progression,
    actions: (actionsRes.actions ?? []).map(toPublicActivityAction),
    artifacts: artifactsRes.artifacts ?? [],
    activityDegraded,
    balances,
  }
}

/**
 * Title and description for `generateMetadata`. Never viewer-dependent, so a link preview of a
 * vessel is the same for the creator and a stranger, and never built from `personality.core`
 * (where a forged vessel keeps the owner's own words) when the subject is a person's vessel.
 */
export async function loadAgentProfileMetadata(
  id: string
): Promise<{ title: string; description: string } | null> {
  const record = await resolveAnyAgentRecord(id)
  if (!record) return null

  if (record.row && isRestrictedProfileRow(record.row)) {
    const agent = projectForgedAgentForPublic(record.agent)
    return {
      title: `${agent.name} — ${agent.title}`,
      description: `${agent.name}: ${agent.abilities?.specialty || 'Forged vessel'}`,
    }
  }

  const agent = record.agent
  return {
    title: `${agent.name} — ${agent.title}`,
    description:
      agent.personality?.core?.essence ||
      agent.synthesis ||
      `${agent.name}: ${agent.specialization ?? agent.era ?? 'Historical agent'}`,
  }
}
