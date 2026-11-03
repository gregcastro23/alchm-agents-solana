import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { cache } from 'react'
import { ArrowLeft, Heart, MessageCircle, Sparkles, Stars, Swords, UserRound } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HISTORICAL_AGENTS } from '@/lib/agents/historical'
import { resolveAnyAgent } from '@/lib/agents/resolve-any-agent'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import {
  rateStats,
  evaluateSeals,
  earnedSeals,
  computeZoneSynergies,
  bestZoneId,
  type CoreStats,
} from '@/lib/agents/rating'
import {
  VesselRatingRibbon,
  AlchemicalSealsCodex,
  PentacleZoneSynergyPanel,
} from '@/components/vessel/pentacle-rating-display'

// Pre-render the known historical set and resolve the thousands of planetary,
// lunar, and DB-backed crafted agents on demand.
export const dynamicParams = true
export const revalidate = 3600

const getSynastryAgent = cache((agentId: string) => resolveAnyAgent(agentId))

type SynastryAgentPageProps = {
  params: Promise<{ agent: string }>
}

export async function generateStaticParams() {
  return HISTORICAL_AGENTS.map(agent => ({ agent: agent.id }))
}

export async function generateMetadata({ params }: SynastryAgentPageProps): Promise<Metadata> {
  const { agent: agentId } = await params
  const agent = await getSynastryAgent(agentId)

  if (!agent) {
    return {
      title: 'Synastry agent not found',
    }
  }

  return {
    title: `${agent.name} Synastry`,
    description: `Explore compatibility, resonance, and chart comparison with ${agent.name}.`,
    alternates: {
      canonical: `/synastry/${encodeURIComponent(agent.id)}`,
    },
  }
}

function percent(value?: number) {
  if (typeof value !== 'number' || Number.isNaN(value)) return '0%'
  const normalized = value <= 1 ? value * 100 : value
  return `${Math.round(normalized)}%`
}

export default async function SynastryAgentPage({ params }: SynastryAgentPageProps) {
  const { agent: agentId } = await params
  const agent = await getSynastryAgent(agentId)

  if (!agent) notFound()

  const accent = agent.appearance?.color || '#7c3aed'
  const encodedAgentId = encodeURIComponent(agent.id)
  const agentFirstName = agent.name.split(' ')[0] || agent.name
  const wisdomDomains = agent.abilities?.wisdomDomains?.slice(0, 4) ?? []
  const resonanceScore = agent.stats?.resonanceScore
  const monicaConstant = agent.consciousness?.monicaConstant

  const highlights = [
    {
      label: 'Resonance Type',
      value: agent.abilities?.resonanceType || 'Compatibility mapping',
    },
    {
      label: 'Teaching Style',
      value: agent.abilities?.teachingStyle || 'Reflective guidance',
    },
    {
      label: 'Core Essence',
      value: agent.personality?.core?.essence || agent.synthesis || 'Agent-specific insight',
    },
  ]

  const sunPos =
    agent.consciousness?.natalChart?.planets?.Sun ?? agent.consciousness?.natalChart?.planets?.sun
  const fallbackStats = getPlanetaryAgentStats(
    'Sun',
    sunPos?.sign || 'Leo',
    Math.round(sunPos?.degree ?? 15)
  )
  const sacredStats: CoreStats = agent.sacredStats
    ? {
        power: agent.sacredStats.power ?? fallbackStats.power,
        resonance: agent.sacredStats.resonance ?? fallbackStats.resonance,
        wisdom: agent.sacredStats.wisdom ?? fallbackStats.wisdom,
        charisma: agent.sacredStats.charisma ?? fallbackStats.charisma,
        intuition: agent.sacredStats.intuition ?? fallbackStats.intuition,
        adaptability: agent.sacredStats.adaptability ?? fallbackStats.adaptability,
        vitality: agent.sacredStats.vitality ?? fallbackStats.vitality,
      }
    : fallbackStats

  const el = agent.consciousness?.alchemicalElements
  const esmsBalances = {
    spirit: Math.round((el?.spirit ?? 0.3) * 200),
    essence: Math.round((el?.essence ?? 0.3) * 200),
    matter: Math.round((el?.matter ?? 0.25) * 200),
    substance: Math.round((el?.substance ?? 0.25) * 200),
  }
  const rated = rateStats(sacredStats)
  const sealProgress = evaluateSeals({ stats: sacredStats, esmsBalances })
  const seals = earnedSeals(sealProgress)
  const zoneSynergies = computeZoneSynergies({ ratings: rated.ratings, seals })
  const peakZoneId = bestZoneId({ ratings: rated.ratings, seals })

  return (
    <main className="min-h-screen bg-background">
      <section className="border-b border-white/10 bg-[#0d1020]/70">
        <div className="container py-10">
          <Button variant="ghost" size="sm" asChild className="mb-6">
            <Link href="/gallery">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Gallery
            </Link>
          </Button>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="space-y-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">Synastry</Badge>
                {agent.consciousness?.dominantElement && (
                  <Badge style={{ backgroundColor: accent, color: 'white' }}>
                    {agent.consciousness.dominantElement}
                  </Badge>
                )}
                {agent.consciousness?.dominantModality && (
                  <Badge variant="secondary">{agent.consciousness.dominantModality}</Badge>
                )}
              </div>

              <div>
                <h1 className="text-4xl font-bold tracking-tight md:text-5xl">
                  {agent.name} Synastry
                </h1>
                <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
                  Compare your chart with {agent.name} through compatibility patterns, elemental
                  resonance, and the agent&apos;s own interpretive style.
                </p>
              </div>

              <VesselRatingRibbon ovr={rated.ovr} archetype={rated.archetype} seals={seals} />

              <div className="flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link href={`/chart-interpreter?type=synastry&agent=${encodedAgentId}`}>
                    <Heart className="mr-2 h-4 w-4" />
                    Open Synastry Workspace
                  </Link>
                </Button>
                <Button
                  variant="outline"
                  asChild
                  size="lg"
                  className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
                >
                  <Link href="/arena">
                    <Swords className="mr-2 h-4 w-4" />
                    14-Pillar Synastry Arena
                  </Link>
                </Button>
                <Button variant="outline" asChild size="lg">
                  <Link href={`/gallery/chat/${encodedAgentId}`}>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Chat with {agentFirstName}
                  </Link>
                </Button>
                <Button variant="outline" asChild size="lg">
                  <Link href={`/agent/${encodedAgentId}`}>
                    <UserRound className="mr-2 h-4 w-4" />
                    Agent Profile
                  </Link>
                </Button>
              </div>
            </div>

            <Card className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Sparkles className="h-5 w-5" style={{ color: accent }} />
                  Agent Resonance
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Pentacle Vessel Rating</span>
                  <span className="font-mono font-bold text-amber-300">
                    {rated.ovr} PVR · {rated.archetype.title}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Resonance Score</span>
                  <span className="font-medium">{percent(resonanceScore)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Monica Constant</span>
                  <span className="font-mono font-medium">
                    {typeof monicaConstant === 'number'
                      ? monicaConstant.toFixed(3)
                      : 'not computed'}
                  </span>
                </div>
                {agent.specialization && (
                  <div>
                    <span className="text-muted-foreground">Specialization</span>
                    <p className="mt-1 font-medium">{agent.specialization}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section className="container py-8 space-y-6">
        <div className="grid gap-4 md:grid-cols-3">
          {highlights.map(item => (
            <Card key={item.label} className="border-white/10 bg-[#0d1020]/90">
              <CardHeader>
                <CardTitle className="text-base">{item.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{item.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AlchemicalSealsCodex sealProgress={sealProgress} />
          <PentacleZoneSynergyPanel zoneSynergies={zoneSynergies} bestZoneId={peakZoneId} />
        </div>

        {wisdomDomains.length > 0 && (
          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Stars className="h-5 w-5" style={{ color: accent }} />
                Compatibility Focus
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {wisdomDomains.map(domain => (
                  <Badge key={domain} variant="outline" className="border-white/15 bg-white/[0.03]">
                    {domain}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  )
}
