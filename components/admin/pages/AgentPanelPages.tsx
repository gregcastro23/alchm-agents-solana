'use client'

/**
 * The Agents group's pages built on the older panels: councils, leveling,
 * arenas and RAG. Each owns its fetch and has a URL an alert can link to.
 */

import { useState } from 'react'
import { z } from 'zod'
import CosmicLevelingPanel from '@/components/admin/panels/CosmicLevelingPanel'
import GroupChatSessionsPanel from '@/components/admin/panels/GroupChatSessionsPanel'
import JingArenaPanel from '@/components/admin/panels/JingArenaPanel'
import JingDuelModal from '@/components/admin/panels/JingDuelModal'
import RagKnowledgePanel from '@/components/admin/panels/RagKnowledgePanel'
import ScrabbleLeaguePanel from '@/components/admin/panels/ScrabbleLeaguePanel'
import type { AdminJingDuel } from '@/types/admin'
import { AdminFrame } from './AdminFrame'
import { readAt, useDashboard } from './hooks'
import { LoadState, Read, useValidatedPoll } from './primitives'

export function CouncilsPage() {
  const { loaded, refresh, data } = useDashboard()
  return (
    <AdminFrame
      title="Council convenings"
      description="Group-chat sessions: how many, where they started, and the latest convenings."
      updated={readAt(data?.generatedAt)}
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {data && <Read section={data.groupChats}>{v => <GroupChatSessionsPanel data={v} />}</Read>}
    </AdminFrame>
  )
}

const LevelingSchema = z.object({ success: z.literal(true) }).passthrough()

export function LevelingPage() {
  const { loaded, refresh } = useValidatedPoll(
    '/api/admin/leveling-summary',
    LevelingSchema,
    300_000
  )
  return (
    <AdminFrame
      title="Cosmic leveling"
      description="Agent levels, EV training and who is training with whom."
    >
      <LoadState loaded={loaded} onRetry={refresh} />
      {loaded.state !== 'error' && (
        <CosmicLevelingPanel
          leveling={loaded.state === 'ok' ? (loaded.data as never) : null}
          loading={loaded.state === 'loading'}
        />
      )}
    </AdminFrame>
  )
}

const ScrabbleSchema = z
  .object({ success: z.literal(true), available: z.boolean(), reason: z.string().optional() })
  .passthrough()

export function ArenasPage() {
  const dashboard = useDashboard()
  const scrabble = useValidatedPoll('/api/admin/scrabble-standings', ScrabbleSchema, 300_000)
  const [selected, setSelected] = useState<AdminJingDuel | null>(null)
  const data = dashboard.data
  return (
    <AdminFrame
      title="Arenas"
      description="Jing duels (elemental casts and counters, with the synastry behind each) and the agent Scrabble league."
      updated={readAt(data?.generatedAt)}
    >
      <LoadState loaded={dashboard.loaded} onRetry={dashboard.refresh} />
      {data && (
        <Read section={data.jing}>
          {v => <JingArenaPanel data={v} onSelectDuel={setSelected} />}
        </Read>
      )}
      <LoadState loaded={scrabble.loaded} onRetry={scrabble.refresh} />
      {scrabble.loaded.state !== 'error' && (
        <ScrabbleLeaguePanel
          data={scrabble.loaded.state === 'ok' ? (scrabble.loaded.data as never) : null}
          loading={scrabble.loaded.state === 'loading'}
        />
      )}
      {selected && <JingDuelModal duel={selected} onClose={() => setSelected(null)} />}
    </AdminFrame>
  )
}

export function RagPage() {
  return (
    <AdminFrame
      title="RAG & knowledge"
      description="Retrieval that augments each persona: vector-store health and the analytics page."
    >
      <RagKnowledgePanel productionUrl="" />
    </AdminFrame>
  )
}
