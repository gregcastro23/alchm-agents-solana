import type { Metadata } from 'next'
import CosmicMenuAlchemist from '@/components/culinary/CosmicMenuAlchemist'
import type { EsmsToken } from '@/lib/agents/rating'
import type { CulinarySurgeMode } from '@/lib/culinary/sanctum-catalog'

export const metadata: Metadata = {
  title: 'Culinary Alchemy Sanctum & Live Sky Menu Lab | Alchm Agents',
  description:
    'Explore WTEN 1,000-recipe agent alterations filtered by dominant ESMS element, active Sky-to-Plate Resonance Surge, and 25–99 Pentacle Vessel Rating (PVR).',
}

interface CulinarySanctumPageProps {
  searchParams?: Promise<{
    agent?: string
    element?: string
    surge?: string
  }>
}

export default async function CulinarySanctumPage({ searchParams }: CulinarySanctumPageProps) {
  const resolved = (await searchParams) ?? {}
  const agentParam = typeof resolved.agent === 'string' ? resolved.agent.trim() : null

  const rawElement = typeof resolved.element === 'string' ? resolved.element.toLowerCase() : ''
  const initialEsmsFilter: EsmsToken | 'ALL' =
    rawElement === 'spirit' || rawElement === 'fire'
      ? 'spirit'
      : rawElement === 'essence' || rawElement === 'water'
        ? 'essence'
        : rawElement === 'matter' || rawElement === 'earth'
          ? 'matter'
          : rawElement === 'substance' || rawElement === 'air'
            ? 'substance'
            : 'ALL'

  const rawSurge = typeof resolved.surge === 'string' ? resolved.surge : ''
  const initialSurgeFilter: CulinarySurgeMode | 'ALL' =
    rawSurge === 'Inferno' || rawSurge === 'Tempest' || rawSurge === 'Equilibrium'
      ? rawSurge
      : 'ALL'

  return (
    <main className="min-h-screen bg-[#060810] text-slate-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_18%_0%,rgba(245,158,11,0.12),transparent_36%),radial-gradient(circle_at_84%_16%,rgba(139,92,246,0.14),transparent_32%)]" />
      <div className="relative mx-auto max-w-[1440px] px-4 pb-24 pt-8 sm:px-6 lg:px-10">
        <CosmicMenuAlchemist
          initialAgentFilter={agentParam}
          initialEsmsFilter={initialEsmsFilter}
          initialSurgeFilter={initialSurgeFilter}
        />
      </div>
    </main>
  )
}
