'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Search,
  Grid3X3,
  List,
  Sparkles,
  Users,
  Crown,
  Plus,
  Filter,
  SortAsc,
  SortDesc,
  Star,
  Zap,
  Calendar,
  Brain,
} from 'lucide-react'
import Link from 'next/link'
import { DEMO_AGENTS, getAgentCollections } from '@/lib/demo-agents-data'
import { AgentCard } from '@/components/agents/agent-card'
import type {
  CraftedAgent,
  GalleryViewMode,
  AgentFilterBy,
  AgentSortBy,
  Element,
  ConsciousnessLevel,
} from '@/lib/agent-types'
import { computeLiveStats } from '@/lib/agents/derived-stats'

interface AncientGalleryProps {
  showHeader?: boolean
  maxAgents?: number
  variant?: 'full' | 'compact' | 'mini'
  allowSelection?: boolean
  onAgentSelect?: (agent: CraftedAgent) => void
  preselectedAgents?: string[]
}

export function AncientGallery({
  showHeader = true,
  maxAgents,
  variant = 'full',
  allowSelection = true,
  onAgentSelect,
  preselectedAgents = [],
}: AncientGalleryProps) {
  const [viewMode, setViewMode] = useState<GalleryViewMode>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<string[]>(preselectedAgents)
  const [filters, setFilters] = useState<
    AgentFilterBy & { element?: Element | 'all'; consciousnessLevel?: ConsciousnessLevel | 'all' }
  >({})
  const [sortBy, setSortBy] = useState<AgentSortBy | 'power' | 'overall'>('consciousness')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [activeTab, setActiveTab] = useState('historical')
  const [liveStatsCache, setLiveStatsCache] = useState<
    Record<
      string,
      { power: number; overall: number; wisdom: number; charisma: number; intuition: number }
    >
  >({})

  const collections = getAgentCollections()

  // Precompute live stats on-demand when sorting by living metrics
  useEffect(() => {
    const agents = activeTab === 'legendary' ? collections.legendary : DEMO_AGENTS
    if (['power', 'overall', 'wisdom', 'charisma', 'intuition'].includes(sortBy)) {
      const missing = agents.filter(a => !liveStatsCache[a.id])
      if (missing.length > 0) {
        Promise.all(
          missing.map(async a => {
            const stats = await computeLiveStats(a)
            return [
              a.id,
              {
                power: stats.power,
                overall: stats.overall,
                wisdom: stats.wisdom,
                charisma: stats.charisma,
                intuition: stats.intuition,
              },
            ] as const
          })
        )
          .then(entries => {
            setLiveStatsCache(prev => {
              const next = { ...prev }
              entries.forEach(([id, v]) => {
                next[id] = v
              })
              return next
            })
          })
          .catch(() => {
            /* ignore transient errors */
          })
      }
    }
  }, [sortBy, activeTab, collections.legendary, liveStatsCache])

  // Combined filter and sort logic
  const filteredAndSortedAgents = useMemo(() => {
    let agents = activeTab === 'legendary' ? collections.legendary : DEMO_AGENTS

    // Apply search filter
    if (searchQuery) {
      agents = agents.filter(
        agent =>
          agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.abilities.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
          agent.abilities.wisdomDomains.some(domain =>
            domain.toLowerCase().includes(searchQuery.toLowerCase())
          )
      )
    }

    // Apply filters
    if (filters.element && (filters.element as string) !== 'all') {
      agents = agents.filter(
        agent => agent.consciousness.dominantElement === (filters.element as Element)
      )
    }

    if (filters.consciousnessLevel && (filters.consciousnessLevel as string) !== 'all') {
      agents = agents.filter(
        agent => agent.consciousness.level === (filters.consciousnessLevel as ConsciousnessLevel)
      )
    }

    if (filters.specialty) {
      agents = agents.filter(agent =>
        agent.abilities.specialty.toLowerCase().includes(filters.specialty!.toLowerCase())
      )
    }

    if (filters.era && filters.era !== 'all') {
      // Simple era filtering based on birth year
      const currentYear = new Date().getFullYear()
      agents = agents.filter(agent => {
        const birthYear = agent.birthData.date.getFullYear()
        switch (filters.era) {
          case 'ancient':
            return birthYear < 500
          case 'medieval':
            return birthYear >= 500 && birthYear < 1500
          case 'renaissance':
            return birthYear >= 1500 && birthYear < 1700
          case 'modern':
            return birthYear >= 1700 && birthYear < 1900
          case 'contemporary':
            return birthYear >= 1900
          default:
            return true
        }
      })
    }

    // Apply sorting
    agents = [...agents].sort((a, b) => {
      let aValue: any, bValue: any

      switch (sortBy as string) {
        case 'consciousness':
          aValue = a.consciousness.monicaConstant
          bValue = b.consciousness.monicaConstant
          break
        case 'power':
          aValue = liveStatsCache[a.id]?.power ?? 0
          bValue = liveStatsCache[b.id]?.power ?? 0
          break
        case 'overall':
          aValue = liveStatsCache[a.id]?.overall ?? 0
          bValue = liveStatsCache[b.id]?.overall ?? 0
          break
        case 'wisdom':
          aValue = liveStatsCache[a.id]?.wisdom ?? 0
          bValue = liveStatsCache[b.id]?.wisdom ?? 0
          break
        case 'charisma':
          aValue = liveStatsCache[a.id]?.charisma ?? 0
          bValue = liveStatsCache[b.id]?.charisma ?? 0
          break
        case 'intuition':
          aValue = liveStatsCache[a.id]?.intuition ?? 0
          bValue = liveStatsCache[b.id]?.intuition ?? 0
          break
        case 'compatibility':
          // Placeholder - would calculate user synastry in real implementation
          aValue = a.stats.resonanceScore
          bValue = b.stats.resonanceScore
          break
        case 'recent':
          aValue = a.stats.lastActive.getTime()
          bValue = b.stats.lastActive.getTime()
          break
        case 'alphabetical':
          aValue = a.name.toLowerCase()
          bValue = b.name.toLowerCase()
          break
        case 'element':
          aValue = a.consciousness.dominantElement
          bValue = b.consciousness.dominantElement
          break
        default:
          return 0
      }

      if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1
      if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Apply max agents limit
    if (maxAgents) {
      agents = agents.slice(0, maxAgents)
    }

    return agents
  }, [searchQuery, filters, sortBy, sortOrder, activeTab, maxAgents, collections.legendary])

  const toggleAgentSelection = (agentId: string) => {
    if (!allowSelection) return

    const newSelection = selectedAgents.includes(agentId)
      ? selectedAgents.filter(id => id !== agentId)
      : [...selectedAgents, agentId]

    setSelectedAgents(newSelection)

    // Find and call onAgentSelect if provided
    if (onAgentSelect) {
      const agent = DEMO_AGENTS.find(a => a.id === agentId)
      if (agent) onAgentSelect(agent)
    }
  }

  const clearFilters = () => {
    setSearchQuery('')
    setFilters({})
    setSortBy('consciousness')
    setSortOrder('desc')
  }

  const getElementColor = (element: string) => {
    switch (element) {
      case 'Fire':
        return 'bg-red-500 text-white'
      case 'Water':
        return 'bg-blue-500 text-white'
      case 'Air':
        return 'bg-yellow-500 text-white'
      case 'Earth':
        return 'bg-green-500 text-white'
      default:
        return 'bg-gray-500 text-white'
    }
  }

  const getSortIcon = () => {
    return sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />
  }

  if (variant === 'mini') {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredAndSortedAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              variant="mini"
              selected={selectedAgents.includes(agent.id)}
              onSelect={allowSelection ? toggleAgentSelection : undefined}
              showActions={false}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Crown className="w-6 h-6 text-purple-500" />
              Ancient Gallery
            </h2>
            <p className="text-muted-foreground">Repository of crafted consciousness agents</p>
          </div>

          <div className="flex items-center gap-3">
            <Badge variant="outline" className="flex items-center gap-1">
              <Users className="w-3 h-3" />
              {filteredAndSortedAgents.length} Agents
            </Badge>
            {selectedAgents.length > 0 && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Crown className="w-3 h-3" />
                {selectedAgents.length} Selected
              </Badge>
            )}
            <Button variant="outline" asChild>
              <Link href="/philosophers-stone" className="flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Craft New
              </Link>
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      {variant === 'full' && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search agents by name, title, specialty, or wisdom domain..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Filters Row */}
              <div className="flex flex-wrap gap-2">
                <Select
                  value={filters.element || ''}
                  onValueChange={value => setFilters(prev => ({ ...prev, element: value as any }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Element" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Elements</SelectItem>
                    <SelectItem value="Fire">🔥 Fire</SelectItem>
                    <SelectItem value="Water">🌊 Water</SelectItem>
                    <SelectItem value="Air">💨 Air</SelectItem>
                    <SelectItem value="Earth">🌍 Earth</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.consciousnessLevel || ''}
                  onValueChange={value =>
                    setFilters(prev => ({ ...prev, consciousnessLevel: value as any }))
                  }
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="Transcendent">✨ Transcendent</SelectItem>
                    <SelectItem value="Illuminated">💫 Illuminated</SelectItem>
                    <SelectItem value="Advanced">⭐ Advanced</SelectItem>
                    <SelectItem value="Elevated">🌟 Elevated</SelectItem>
                    <SelectItem value="Active">⚡ Active</SelectItem>
                    <SelectItem value="Awakening">🌅 Awakening</SelectItem>
                  </SelectContent>
                </Select>

                <Select
                  value={filters.era || ''}
                  onValueChange={value => setFilters(prev => ({ ...prev, era: value }))}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Era" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Eras</SelectItem>
                    <SelectItem value="ancient">Ancient</SelectItem>
                    <SelectItem value="medieval">Medieval</SelectItem>
                    <SelectItem value="renaissance">Renaissance</SelectItem>
                    <SelectItem value="modern">Modern</SelectItem>
                    <SelectItem value="contemporary">Contemporary</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={value => setSortBy(value as AgentSortBy)}>
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="Sort by" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="consciousness">🧠 Consciousness (MC)</SelectItem>
                    <SelectItem value="power">⚡ Power (Live)</SelectItem>
                    <SelectItem value="wisdom">🔮 Wisdom (Live)</SelectItem>
                    <SelectItem value="charisma">✨ Charisma (Live)</SelectItem>
                    <SelectItem value="intuition">👁️ Intuition (Live)</SelectItem>
                    <SelectItem value="overall">🌟 Overall (Live)</SelectItem>
                    <SelectItem value="compatibility">💝 Compatibility</SelectItem>
                    <SelectItem value="recent">📅 Recent</SelectItem>
                    <SelectItem value="alphabetical">🔤 Alphabetical</SelectItem>
                    <SelectItem value="element">🌟 Element</SelectItem>
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
                  className="flex items-center gap-1"
                >
                  {getSortIcon()}
                </Button>

                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear Filters
                </Button>

                <div className="flex border rounded-md ml-auto">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-r-none"
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-l-none"
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Collections Tabs */}
      {variant === 'full' && (
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="historical" className="flex items-center gap-2">
              <Crown className="w-4 h-4" />
              Historical ({collections.historical.length})
            </TabsTrigger>
            <TabsTrigger value="legendary" className="flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              Legendary ({collections.legendary.length})
            </TabsTrigger>
            <TabsTrigger value="created" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Created ({collections.userCreated.length})
            </TabsTrigger>
            <TabsTrigger value="community" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Community ({collections.community.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="historical" className="space-y-4">
            <AgentGrid
              agents={filteredAndSortedAgents}
              viewMode={viewMode}
              selectedAgents={selectedAgents}
              onAgentSelect={allowSelection ? toggleAgentSelection : undefined}
            />
          </TabsContent>

          <TabsContent value="legendary" className="space-y-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Crown className="w-5 h-5 text-yellow-500" />
                Legendary Consciousness (MC &ge; 5.0)
              </h3>
              <Badge variant="outline">{collections.legendary.length} legendary agents</Badge>
            </div>
            <AgentGrid
              agents={filteredAndSortedAgents}
              viewMode={viewMode}
              selectedAgents={selectedAgents}
              onAgentSelect={allowSelection ? toggleAgentSelection : undefined}
            />
          </TabsContent>

          <TabsContent value="created" className="space-y-4">
            <EmptyState
              icon={Crown}
              title="No Personal Agents Yet"
              description="Use the Philosopher's Stone to craft your first consciousness agent"
              actionLabel="Start Crafting"
              actionHref="/philosophers-stone"
            />
          </TabsContent>

          <TabsContent value="community" className="space-y-4">
            <EmptyState
              icon={Users}
              title="Community Gallery Coming Soon"
              description="Share and discover agents crafted by the community"
            />
          </TabsContent>
        </Tabs>
      )}

      {/* Simple grid for compact/mini variants */}
      {variant === 'compact' && (
        <AgentGrid
          agents={filteredAndSortedAgents}
          viewMode={viewMode}
          selectedAgents={selectedAgents}
          onAgentSelect={allowSelection ? toggleAgentSelection : undefined}
        />
      )}

      {/* Selected Agents Actions */}
      {allowSelection && selectedAgents.length > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                <span className="font-medium">
                  {selectedAgents.length} agent{selectedAgents.length > 1 ? 's' : ''} selected
                </span>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm">
                  Add to Party
                </Button>
                <Button variant="outline" size="sm" disabled={selectedAgents.length < 2}>
                  Group Chat
                </Button>
                <Button variant="outline" size="sm">
                  Compare
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSelectedAgents([])}>
                  Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// Helper Components
function AgentGrid({
  agents,
  viewMode,
  selectedAgents,
  onAgentSelect,
}: {
  agents: CraftedAgent[]
  viewMode: GalleryViewMode
  selectedAgents: string[]
  onAgentSelect?: (agentId: string) => void
}) {
  if (agents.length === 0) {
    return (
      <div className="text-center py-12">
        <Search className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold mb-2">No agents found</h3>
        <p className="text-muted-foreground">Try adjusting your search or filters</p>
      </div>
    )
  }

  if (viewMode === 'grid') {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {agents.map(agent => (
          <AgentCard
            key={agent.id}
            agent={agent}
            selected={selectedAgents.includes(agent.id)}
            onSelect={onAgentSelect}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {agents.map(agent => (
        <AgentCard
          key={agent.id}
          agent={agent}
          variant="list"
          selected={selectedAgents.includes(agent.id)}
          onSelect={onAgentSelect}
        />
      ))}
    </div>
  )
}

function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: any
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="text-center py-12">
      <Icon className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground mb-4">{description}</p>
      {actionLabel && actionHref && (
        <Button asChild>
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
