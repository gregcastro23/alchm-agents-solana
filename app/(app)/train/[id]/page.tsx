import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, MessageCircle } from 'lucide-react'
import { AgentLevelPanel } from '@/components/misc/agent-level-panel'

// Any agent id renders on demand (canonical, planetary, or DB-only).
export const dynamicParams = true

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const name = id
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
  return { title: `Cosmic Training — ${name}` }
}

/**
 * Dedicated Cosmic Training surface for one agent. Foregrounds the Sacred-7
 * radar (IV blueprint + EV overlay), XP-to-next bar, EV total, the mentor
 * "Train" picker, and the ESMS "Reset EVs" button — all via the self-contained
 * AgentLevelPanel (which fetches /api/agents/[id]/leveling client-side).
 */
export default async function TrainPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  return (
    <div className="min-h-screen pb-24 text-white">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-6 flex items-end justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.35em] text-fuchsia-300/70">
              Cosmic Training
            </p>
            <h1 className="mt-1 bg-gradient-to-r from-amber-300 to-fuchsia-400 bg-clip-text text-3xl font-bold text-transparent">
              EV · IV · Level
            </h1>
            <p className="mt-1 text-sm text-white/50">
              Train this agent against a mentor to earn XP and Effort Values in their dominant
              Sacred-7 stat.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href={`/gallery/chat/${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-medium text-fuchsia-100 transition hover:bg-fuchsia-500/20"
            >
              <MessageCircle className="h-3.5 w-3.5" /> Chat
            </Link>
            <Link
              href={`/agent/${id}`}
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/5"
            >
              Profile
            </Link>
            <Link
              href="/gallery"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/5"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Gallery
            </Link>
          </div>
        </div>

        <AgentLevelPanel agentId={id} />
      </div>
    </div>
  )
}
