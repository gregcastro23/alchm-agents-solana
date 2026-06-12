'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Clock,
  Users,
  Sparkles,
  Crown,
  BookOpen,
  Lightbulb,
  MessageCircle,
  ArrowRight,
  Calendar,
  Star,
} from 'lucide-react'

import UnifiedMultiAgentChat from './unified-multi-agent-chat'
import type { CraftedAgent } from '@/lib/agent-types'
import type { ChatSession } from '@/lib/unified-agent-types'
import {
  HISTORICAL_COUNCIL_PRESETS,
  getPresetsByDifficulty,
  getPresetsByTag,
  getOptimalMonicaRole,
  type HistoricalCouncilPreset,
} from '@/lib/council-presets'

interface HistoricalCouncilChatProps {
  // Core functionality
  isOpen: boolean
  onClose: () => void

  // Historical agents
  historicalAgents: CraftedAgent[]

  // Initial setup
  initialCouncil?: string // Preset ID
  initialAgents?: string[] // Agent IDs
  filterBySelectedAgents?: string[]

  // Customization
  title?: string
  maxAgents?: number
  allowMonica?: boolean

  // Features
  showAgentBiographies?: boolean
  enableTimelineView?: boolean
  enableEraFilters?: boolean
  enableSpecializationGroups?: boolean

  // Callbacks
  onSessionUpdate?: (session: ChatSession) => void
  onAgentEvolution?: (agentId: string, evolution: any) => void
}

export function HistoricalCouncilChat({
  isOpen,
  onClose,
  historicalAgents,
  initialCouncil,
  initialAgents = [],
  filterBySelectedAgents = [],
  title = 'Historical Council Chamber',
  maxAgents = 5,
  allowMonica = true,
  showAgentBiographies = true,
  enableTimelineView = true,
  enableEraFilters = true,
  enableSpecializationGroups = true,
  onSessionUpdate,
  onAgentEvolution,
}: HistoricalCouncilChatProps) {
  // State for council selection and customization
  const [selectedPreset, setSelectedPreset] = useState<HistoricalCouncilPreset | null>(
    initialCouncil ? HISTORICAL_COUNCIL_PRESETS.find(p => p.id === initialCouncil) || null : null
  )
  const [customAgents, setCustomAgents] = useState<string[]>(
    filterBySelectedAgents.length > 0 ? filterBySelectedAgents : initialAgents
  )
  const [showPresetSelection, setShowPresetSelection] = useState(() => {
    if (initialCouncil) {
      return !HISTORICAL_COUNCIL_PRESETS.some(p => p.id === initialCouncil)
    }
    return initialAgents.length === 0 && filterBySelectedAgents.length === 0
  })
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all')
  const [tagFilter, setTagFilter] = useState<string>('all')

  // Load selection from localStorage
  useEffect(() => {
    if (initialCouncil || initialAgents.length > 0 || filterBySelectedAgents.length > 0) return

    try {
      const stored = localStorage.getItem('historical-council-selection')
      if (stored) {
        const parsed = JSON.parse(stored)
        if (parsed.presetId) {
          const preset = HISTORICAL_COUNCIL_PRESETS.find(p => p.id === parsed.presetId)
          if (preset) {
            setSelectedPreset(preset)
            setCustomAgents(preset.historicalAgentIds)
            setShowPresetSelection(false)
          }
        } else if (parsed.customAgents && parsed.customAgents.length > 0) {
          setCustomAgents(parsed.customAgents)
          setShowPresetSelection(false)
        }
      }
    } catch (e) {
      console.warn('Failed to parse historical council selection from localStorage', e)
    }
  }, [initialCouncil, initialAgents, filterBySelectedAgents])

  // Save selection to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(
        'historical-council-selection',
        JSON.stringify({
          presetId: selectedPreset?.id || null,
          customAgents,
        })
      )
    } catch (e) {
      console.warn('Failed to save to localStorage', e)
    }
  }, [selectedPreset, customAgents])

  // Memoized filtered presets
  const filteredPresets = useMemo(() => {
    let presets = HISTORICAL_COUNCIL_PRESETS

    if (difficultyFilter !== 'all') {
      presets = getPresetsByDifficulty(difficultyFilter as any) as HistoricalCouncilPreset[]
    }

    if (tagFilter !== 'all') {
      presets = getPresetsByTag(tagFilter) as HistoricalCouncilPreset[]
    }

    return presets as HistoricalCouncilPreset[]
  }, [difficultyFilter, tagFilter])

  // Get unique tags and difficulties for filters
  const availableTags = useMemo(() => {
    const tags = new Set<string>()
    HISTORICAL_COUNCIL_PRESETS.forEach(preset => preset.tags.forEach(tag => tags.add(tag)))
    return Array.from(tags)
  }, [])

  const availableDifficulties = ['beginner', 'intermediate', 'advanced', 'expert']

  // Handle preset selection
  const handlePresetSelect = (preset: HistoricalCouncilPreset) => {
    setSelectedPreset(preset)
    setCustomAgents(preset.historicalAgentIds)
    setShowPresetSelection(false)
  }

  // Handle custom council creation
  const handleCreateCustomCouncil = () => {
    setSelectedPreset(null)
    setShowPresetSelection(false)
  }

  // Determine final agent selection
  const finalAgentIds = useMemo(() => {
    if (selectedPreset) {
      return selectedPreset.historicalAgentIds
    }
    return customAgents
  }, [selectedPreset, customAgents])

  // Filter to only include agents that exist in historicalAgents
  const validAgentIds = useMemo(() => {
    return finalAgentIds.filter(id => historicalAgents.some(agent => agent.id === id))
  }, [finalAgentIds, historicalAgents])

  // Get era information from selected agents
  const selectedAgentData = useMemo(() => {
    return validAgentIds
      .map(id => historicalAgents.find(agent => agent.id === id))
      .filter(Boolean) as CraftedAgent[]
  }, [validAgentIds, historicalAgents])

  const erasRepresented = useMemo(() => {
    const eras = new Set<string>()
    selectedAgentData.forEach(agent => {
      let year: number | null = null
      const d = agent.birthData?.date as any
      if (d instanceof Date) {
        year = d.getFullYear()
      } else if (typeof d === 'string') {
        const parsed = new Date(d)
        if (!isNaN(parsed.getTime())) year = parsed.getFullYear()
      }
      if (year == null) return
      if (year < 500) eras.add('Ancient')
      else if (year < 1000) eras.add('Classical')
      else if (year < 1400) eras.add('Medieval')
      else if (year < 1800) eras.add('Renaissance')
      else if (year < 1900) eras.add('Enlightenment')
      else eras.add('Modern')
    })
    return Array.from(eras)
  }, [selectedAgentData])

  // Render preset selection interface
  const renderPresetSelection = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose Your Historical Council</h2>
        <p className="text-muted-foreground">
          Select a curated council or create your own custom assembly
        </p>

        <div className="mt-4 flex justify-center">
          <Button
            onClick={() => handlePresetSelect(HISTORICAL_COUNCIL_PRESETS[0])}
            className="bg-primary/20 text-primary hover:bg-primary/30"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Quick Start: {HISTORICAL_COUNCIL_PRESETS[0]?.name || 'Default Council'}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 justify-center">
        <div className="flex items-center gap-2">
          <label htmlFor="difficulty-filter" className="text-sm font-medium">
            Difficulty:
          </label>
          <select
            id="difficulty-filter"
            value={difficultyFilter}
            onChange={e => setDifficultyFilter(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="all">All Levels</option>
            {availableDifficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>
                {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="tag-filter" className="text-sm font-medium">
            Focus:
          </label>
          <select
            id="tag-filter"
            value={tagFilter}
            onChange={e => setTagFilter(e.target.value)}
            className="px-3 py-1 border rounded text-sm"
          >
            <option value="all">All Topics</option>
            {availableTags.map(tag => (
              <option key={tag} value={tag}>
                {tag.charAt(0).toUpperCase() + tag.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Preset Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredPresets.map(preset => (
          <Card
            key={preset.id}
            className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
            onClick={() => handlePresetSelect(preset)}
            tabIndex={0}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handlePresetSelect(preset)
              }
            }}
          >
            {' '}
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg">{preset.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline">{preset.era}</Badge>
                    <Badge
                      variant={
                        preset.difficulty === 'beginner'
                          ? 'default'
                          : preset.difficulty === 'intermediate'
                            ? 'secondary'
                            : preset.difficulty === 'advanced'
                              ? 'destructive'
                              : 'outline'
                      }
                    >
                      {preset.difficulty}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Users className="w-4 h-4" />
                  <span className="text-sm">{preset.historicalAgentIds.length}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">{preset.description}</p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Specialization:</span>
                </div>
                <p className="text-sm text-muted-foreground ml-6">{preset.specialization}</p>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <Crown
                  className={`w-4 h-4 ${preset.includeMonica ? 'text-purple-500' : 'text-gray-300'}`}
                />
                <span className="text-sm">
                  {preset.includeMonica ? `Monica as ${preset.monicaRole}` : 'Independent council'}
                </span>
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {preset.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Custom Council Option */}
      <Card
        className="cursor-pointer transition-all hover:shadow-lg border-dashed border-2"
        onClick={handleCreateCustomCouncil}
      >
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Create Custom Council</h3>
            <p className="text-sm text-muted-foreground">
              Select your own combination of historical agents
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Render council info panel
  const renderCouncilInfo = () => {
    if (!selectedPreset && validAgentIds.length === 0) return null

    return (
      <Card className="mb-4">
        <CardHeader className="pb-3">
          <div className="flex justify-between items-center w-full">
            <div>
              <CardTitle className="text-lg">
                {selectedPreset ? selectedPreset.name : 'Custom Council'}
              </CardTitle>
              {selectedPreset && (
                <p className="text-sm text-muted-foreground mt-1">{selectedPreset.description}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setShowPresetSelection(true)}>
              Change Council
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Agents */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Users className="w-4 h-4" />
                <span className="font-medium">Council Members</span>
              </div>
              <div className="space-y-1">
                {selectedAgentData.map(agent => (
                  <div key={agent.id} className="text-sm flex items-center gap-2">
                    <span style={{ color: agent.appearance?.color || '#6366f1' }}>
                      {agent.appearance?.symbol || agent.name.charAt(0).toUpperCase()}
                    </span>
                    {agent.name}
                  </div>
                ))}
                {selectedPreset?.includeMonica && (
                  <div className="text-sm flex items-center gap-2">
                    <Crown className="w-3 h-3 text-purple-500" />
                    Monica ({selectedPreset.monicaRole})
                  </div>
                )}
              </div>
            </div>

            {/* Eras */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4" />
                <span className="font-medium">Historical Eras</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {erasRepresented.map(era => (
                  <Badge key={era} variant="outline" className="text-xs">
                    {era}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Specialization */}
            {selectedPreset && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-4 h-4" />
                  <span className="font-medium">Focus Areas</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedPreset.tags.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <>
      {/* Preset Selection Modal */}
      {showPresetSelection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Select Historical Council</h2>
                <Button variant="ghost" onClick={() => setShowPresetSelection(false)}>
                  ×
                </Button>
              </div>
              <ScrollArea className="max-h-[70vh]">{renderPresetSelection()}</ScrollArea>
            </div>
          </div>
        </div>
      )}

      {/* Main Chat Interface */}
      <UnifiedMultiAgentChat
        // Core configuration
        isOpen={isOpen && !showPresetSelection}
        onClose={onClose}
        title={title}
        variant="historical"
        // Agent configuration
        historicalAgents={historicalAgents}
        planetaryConfigs={[]}
        initialAgents={validAgentIds}
        maxAgents={maxAgents}
        allowMonica={selectedPreset?.includeMonica || allowMonica}
        // Historical-specific features
        enableGroupDynamics={true}
        enableExport={true}
        enablePresets={true}
        enableMemoryPersistence={true}
        // Callbacks
        onSessionUpdate={onSessionUpdate}
        onAgentEvolution={onAgentEvolution}
        // Custom header content
        customHeader={renderCouncilInfo()}
      />
    </>
  )
}

export default HistoricalCouncilChat
