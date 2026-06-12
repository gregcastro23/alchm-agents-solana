'use client'

import React, { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Zap,
  Activity,
  Settings,
  FlaskConical,
  Microscope,
  TrendingUp,
  Users,
  Crown,
  Target,
} from 'lucide-react'

import UnifiedMultiAgentChat from '@/components/misc/unified-multi-agent-chat'
import type { CraftedAgent } from '@/lib/agent-types'
import type { ChatSession, UnifiedAgent } from '@/lib/unified-agent-types'
import { MIXED_COUNCIL_PRESETS, type MixedCouncilPreset } from '@/lib/council-presets'
import { createDefaultPlanetaryConfigs } from '@/lib/planetary-config-helper'

interface ConsciousnessLabChatProps {
  // Core functionality
  isOpen: boolean
  onClose: () => void

  // Agent sources
  historicalAgents: CraftedAgent[]

  // Initial setup
  defaultAgents?: string[] // Mix of historical and planetary IDs
  initialExperiment?: string // Preset ID

  // Laboratory features
  enableConsciousnessMetrics?: boolean
  showKineticGraphs?: boolean
  enableExperimentMode?: boolean
  allowAgentMixing?: boolean
  enableABTesting?: boolean

  // Configuration
  title?: string
  maxAgents?: number
  allowMonica?: boolean

  // Callbacks
  onSessionUpdate?: (session: ChatSession) => void
  onAgentEvolution?: (agentId: string, evolution: any) => void
  onExperimentComplete?: (results: any) => void
}

interface ExperimentConfig {
  id: string
  name: string
  description: string
  variables: {
    modelComparison?: boolean
    agentCombinations?: string[][]
    consciousnessLevels?: number[]
    timeRanges?: string[]
  }
  metrics: string[]
  duration: number // minutes
}

interface MetricsData {
  timestamp: Date
  groupConsciousness: number
  responseQuality: number
  synergyLevel: number
  coherenceIndex: number
  emergentInsights: number
}

export function ConsciousnessLaboratoryChat({
  isOpen,
  onClose,
  historicalAgents,
  defaultAgents = [],
  initialExperiment,
  enableConsciousnessMetrics: _enableConsciousnessMetrics = true,
  showKineticGraphs: _showKineticGraphs = true,
  enableExperimentMode: _enableExperimentMode = true,
  allowAgentMixing: _allowAgentMixing = true,
  enableABTesting: _enableABTesting = true,
  title = 'Consciousness Research Laboratory',
  maxAgents = 8,
  allowMonica = true,
  onSessionUpdate,
  onAgentEvolution,
  onExperimentComplete,
}: ConsciousnessLabChatProps) {
  // State management
  const [selectedExperiment, setSelectedExperiment] = useState<MixedCouncilPreset | null>(
    initialExperiment ? MIXED_COUNCIL_PRESETS.find(p => p.id === initialExperiment) || null : null
  )
  const [experimentMode, setExperimentMode] = useState(false)
  const [customAgentSelection, setCustomAgentSelection] = useState<{
    historical: string[]
    planetary: string[]
  }>({
    historical: [],
    planetary: [],
  })

  const [labSettings, setLabSettings] = useState({
    recordMetrics: true,
    enableAdvancedLogging: true,
    consciousnessTracking: true,
    synergyAnalysis: true,
    emergentPatternDetection: true,
  })

  const [currentMetrics, setCurrentMetrics] = useState<MetricsData[]>([])
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false)
  const [showPresetSelection, setShowPresetSelection] = useState(
    !selectedExperiment && defaultAgents.length === 0
  )

  // Available planetary configurations
  const planetaryConfigs = useMemo(() => createDefaultPlanetaryConfigs(), [])

  // Experiments library
  const _availableExperiments = useMemo(
    () => [
      ...MIXED_COUNCIL_PRESETS,
      {
        id: 'custom-synthesis',
        name: 'Custom Synthesis Experiment',
        description: 'Design your own consciousness interaction experiment',
        agentIds: [],
        historicalAgentIds: [],
        planetaryAgentIds: [],
        synthesis_type: 'consciousness_acceleration' as const,
        includeMonica: true,
        monicaRole: 'coordinator' as const,
        tags: ['custom', 'experimental', 'synthesis'],
        difficulty: 'expert' as const,
      },
    ],
    []
  )

  // Final agent configuration
  const finalAgentConfiguration = useMemo(() => {
    if (selectedExperiment && selectedExperiment.id !== 'custom-synthesis') {
      return {
        historical: selectedExperiment.historicalAgentIds,
        planetary: selectedExperiment.planetaryAgentIds,
        includeMonica: selectedExperiment.includeMonica,
        monicaRole: selectedExperiment.monicaRole,
      }
    }

    return {
      historical: customAgentSelection.historical,
      planetary: customAgentSelection.planetary,
      includeMonica: allowMonica,
      monicaRole: 'coordinator' as const,
    }
  }, [selectedExperiment, customAgentSelection, allowMonica])

  // Active planetary configurations for selected planets
  const activePlanetaryConfigs = useMemo(() => {
    return planetaryConfigs.filter(config =>
      finalAgentConfiguration.planetary.includes(config.planet)
    )
  }, [planetaryConfigs, finalAgentConfiguration.planetary])

  // Active historical agents
  const activeHistoricalAgents = useMemo(() => {
    return historicalAgents.filter(agent => finalAgentConfiguration.historical.includes(agent.id))
  }, [historicalAgents, finalAgentConfiguration.historical])

  // Handle experiment selection
  const handleExperimentSelect = (experiment: MixedCouncilPreset) => {
    setSelectedExperiment(experiment)
    if (experiment.id === 'custom-synthesis') {
      setCustomAgentSelection({ historical: [], planetary: [] })
    }
    setShowPresetSelection(false)
  }

  // Handle custom agent selection
  const handleCustomAgentToggle = (type: 'historical' | 'planetary', agentId: string) => {
    setCustomAgentSelection(prev => ({
      ...prev,
      [type]: prev[type].includes(agentId)
        ? prev[type].filter(id => id !== agentId)
        : [...prev[type], agentId].slice(0, maxAgents),
    }))
  }

  // Start experiment
  const handleStartExperiment = () => {
    setExperimentMode(true)
    setCurrentMetrics([])
    // Initialize metrics collection
  }

  // Stop experiment
  const handleStopExperiment = () => {
    setExperimentMode(false)
    if (onExperimentComplete && currentMetrics.length > 0) {
      onExperimentComplete({
        experiment: selectedExperiment,
        metrics: currentMetrics,
        duration: currentMetrics.length,
        conclusions: generateExperimentConclusions(),
      })
    }
  }

  // Simulate live metrics collection during experiment
  React.useEffect(() => {
    if (!experimentMode) return

    // Immediately add first metric data point
    setCurrentMetrics([
      {
        timestamp: new Date(),
        groupConsciousness: 65.0 + Math.random() * 20.0,
        responseQuality: 70.0 + Math.random() * 20.0,
        synergyLevel: 0.6 + Math.random() * 0.3,
        coherenceIndex: 0.5 + Math.random() * 0.4,
        emergentInsights: Math.floor(Math.random() * 3),
      },
    ])

    const interval = setInterval(() => {
      setCurrentMetrics(prev =>
        [
          ...prev,
          {
            timestamp: new Date(),
            groupConsciousness: Math.min(
              100,
              Math.max(
                0,
                (prev[prev.length - 1]?.groupConsciousness || 70) + (Math.random() * 10 - 5)
              )
            ),
            responseQuality: Math.min(
              100,
              Math.max(0, (prev[prev.length - 1]?.responseQuality || 75) + (Math.random() * 10 - 5))
            ),
            synergyLevel: Math.min(
              1.0,
              Math.max(
                0.0,
                (prev[prev.length - 1]?.synergyLevel || 0.7) + (Math.random() * 0.2 - 0.1)
              )
            ),
            coherenceIndex: Math.min(
              1.0,
              Math.max(
                0.0,
                (prev[prev.length - 1]?.coherenceIndex || 0.6) + (Math.random() * 0.2 - 0.1)
              )
            ),
            emergentInsights: Math.floor(Math.random() * 3),
          },
        ].slice(-20)
      ) // Keep last 20 data points
    }, 2000)

    return () => clearInterval(interval)
  }, [experimentMode])

  // Generate experiment conclusions
  const generateExperimentConclusions = () => {
    if (currentMetrics.length === 0) return []

    const avgConsciousness =
      currentMetrics.reduce((sum, m) => sum + m.groupConsciousness, 0) / currentMetrics.length
    const avgSynergy =
      currentMetrics.reduce((sum, m) => sum + m.synergyLevel, 0) / currentMetrics.length
    const totalInsights = currentMetrics.reduce((sum, m) => sum + m.emergentInsights, 0)

    return [
      `Average group consciousness: ${avgConsciousness.toFixed(2)}`,
      `Synergy efficiency: ${avgSynergy.toFixed(2)}`,
      `Emergent insights generated: ${totalInsights}`,
      `Optimal performance window: ${identifyOptimalWindow()}`,
    ]
  }

  // Identify optimal performance window
  const identifyOptimalWindow = () => {
    if (currentMetrics.length < 3) return 'Insufficient data'

    const maxSynergy = Math.max(...currentMetrics.map(m => m.synergyLevel))
    const optimalPoint = currentMetrics.find(m => m.synergyLevel === maxSynergy)

    return optimalPoint ? `Minute ${currentMetrics.indexOf(optimalPoint) + 1}` : 'No clear peak'
  }

  // Render experiment selection
  const renderExperimentSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <FlaskConical className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">Consciousness Research Laboratory</h2>
        </div>
        <p className="text-muted-foreground">
          Design and conduct consciousness interaction experiments
        </p>
      </div>

      <Tabs defaultValue="presets" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="presets">Research Protocols</TabsTrigger>
          <TabsTrigger value="custom">Custom Experiment</TabsTrigger>
        </TabsList>

        <TabsContent value="presets" className="space-y-4" forceMount>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {MIXED_COUNCIL_PRESETS.map(preset => (
              <Card
                key={preset.id}
                className="cursor-pointer transition-all hover:shadow-lg hover:border-primary/50"
                onClick={() => handleExperimentSelect(preset)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">{preset.name}</CardTitle>
                      <Badge variant="outline" className="mt-1">
                        {preset.difficulty}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Users className="w-4 h-4" />
                      <span className="text-sm">
                        {preset.historicalAgentIds.length + preset.planetaryAgentIds.length}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">{preset.description}</p>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-medium">Synthesis Type:</span>
                    </div>
                    <p className="text-sm text-muted-foreground ml-6">
                      {preset.synthesis_type
                        .replace('_', ' ')
                        .replace(/\b\w/g, l => l.toUpperCase())}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <Crown
                      className={`w-4 h-4 ${preset.includeMonica ? 'text-purple-500' : 'text-gray-300'}`}
                    />
                    <span className="text-sm">
                      {preset.includeMonica
                        ? `Monica as ${preset.monicaRole}`
                        : 'Independent synthesis'}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1 mt-3">
                    {preset.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="custom" className="space-y-4" forceMount>
          <Card>
            <CardHeader>
              <CardTitle>Design Custom Experiment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Historical Agents Selection */}
              <div>
                <h4 className="font-medium mb-2">Historical Consciousness Agents</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 max-h-40 overflow-y-auto">
                  {historicalAgents.slice(0, 20).map(agent => (
                    <label key={agent.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={agent.id}
                        checked={customAgentSelection.historical.includes(agent.id)}
                        onChange={() => handleCustomAgentToggle('historical', agent.id)}
                        className="rounded"
                      />
                      <span className="text-sm">{agent.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Planetary Agents Selection */}
              <div>
                <h4 className="font-medium mb-2">Planetary Agents</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {planetaryConfigs.map(config => (
                    <label key={config.planet} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        value={config.planet}
                        checked={customAgentSelection.planetary.includes(config.planet)}
                        onChange={() => handleCustomAgentToggle('planetary', config.planet)}
                        className="rounded"
                      />
                      <span className="text-sm flex items-center gap-1">
                        <span style={{ color: config.color }}>{config.symbol}</span>
                        {config.planet}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="pt-4">
                <Button
                  onClick={() =>
                    handleExperimentSelect({
                      id: 'custom-synthesis',
                      name: 'Custom Synthesis Experiment',
                      description: 'Custom consciousness interaction experiment',
                      agentIds: [],
                      historicalAgentIds: customAgentSelection.historical,
                      planetaryAgentIds: customAgentSelection.planetary,
                      synthesis_type: 'consciousness_acceleration',
                      includeMonica: true,
                      monicaRole: 'coordinator',
                      tags: ['custom'],
                      difficulty: 'expert',
                      recommendedFor: ['Custom consciousness synthesis'],
                    })
                  }
                  disabled={
                    customAgentSelection.historical.length +
                      customAgentSelection.planetary.length ===
                    0
                  }
                  className="w-full"
                >
                  Start Custom Experiment
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )

  // Render laboratory controls
  const renderLabControls = () => (
    <Card className="mb-4">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Microscope className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">Research Protocol</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAdvancedSettings(!showAdvancedSettings)}
              aria-label="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowPresetSelection(true)}>
              Change Experiment
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Experiment Info */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <FlaskConical className="w-4 h-4 text-blue-500" />
              <span className="font-medium">Current Protocol</span>
            </div>
            <div className="text-sm">
              <div className="font-medium">{selectedExperiment?.name || 'Custom Protocol'}</div>
              <div className="text-muted-foreground">
                {finalAgentConfiguration.historical.length +
                  finalAgentConfiguration.planetary.length}{' '}
                agents
              </div>
            </div>
          </div>

          {/* Experiment Controls */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity className="w-4 h-4 text-green-500" />
              <span className="font-medium">Status</span>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={experimentMode}
                onCheckedChange={experimentMode ? handleStopExperiment : handleStartExperiment}
              />
              <span className="text-sm">{experimentMode ? 'Recording' : 'Standby'}</span>
            </div>
          </div>

          {/* Live Metrics */}
          {currentMetrics.length > 0 && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-4 h-4 text-purple-500" />
                  <span className="font-medium">Consciousness</span>
                </div>
                <div className="text-lg font-bold">
                  {currentMetrics[currentMetrics.length - 1]?.groupConsciousness.toFixed(2) ||
                    '0.00'}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Synergy</span>
                </div>
                <div className="text-lg font-bold">
                  {currentMetrics[currentMetrics.length - 1]?.synergyLevel.toFixed(2) || '0.00'}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Advanced Settings */}
        {showAdvancedSettings && (
          <div className="mt-4 pt-4 border-t space-y-3">
            <h4 className="font-medium">Laboratory Settings</h4>
            <div className="grid grid-cols-2 gap-4">
              {Object.entries(labSettings).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={value}
                    onCheckedChange={checked =>
                      setLabSettings(prev => ({ ...prev, [key]: checked }))
                    }
                  />
                  <span className="text-sm">
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Active Agents Display */}
        <div className="mt-4 pt-4 border-t">
          <h4 className="font-medium mb-2">Active Research Subjects</h4>
          <div className="space-y-2">
            {activeHistoricalAgents.length > 0 && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Historical: </span>
                <span className="text-sm">
                  {activeHistoricalAgents.map(agent => agent.name).join(', ')}
                </span>
              </div>
            )}
            {activePlanetaryConfigs.length > 0 && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Planetary: </span>
                <span className="text-sm">
                  {activePlanetaryConfigs.map(config => config.planet).join(', ')}
                </span>
              </div>
            )}
            {finalAgentConfiguration.includeMonica && (
              <div>
                <span className="text-sm font-medium text-muted-foreground">Coordinator: </span>
                <span className="text-sm">Monica ({finalAgentConfiguration.monicaRole})</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <>
      {/* Experiment Selection Modal */}
      {showPresetSelection && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg w-full max-w-6xl max-h-[90vh] overflow-hidden">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Research Laboratory</h2>
                <Button
                  variant="ghost"
                  onClick={() => setShowPresetSelection(false)}
                  aria-label="Close"
                >
                  ×
                </Button>
              </div>
              <ScrollArea className="max-h-[75vh]">{renderExperimentSelection()}</ScrollArea>
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
        variant="laboratory"
        // Agent configuration
        historicalAgents={activeHistoricalAgents}
        planetaryConfigs={activePlanetaryConfigs}
        initialAgents={[
          ...finalAgentConfiguration.historical,
          ...finalAgentConfiguration.planetary,
        ]}
        maxAgents={maxAgents}
        allowMonica={finalAgentConfiguration.includeMonica}
        // Laboratory-specific features
        enableGroupDynamics={true}
        enableExport={true}
        enablePresets={false} // Using custom preset system
        enableMemoryPersistence={labSettings.consciousnessTracking}
        // Callbacks
        onSessionUpdate={onSessionUpdate}
        onAgentEvolution={onAgentEvolution}
        // Custom header content
        customHeader={renderLabControls()}
      />
    </>
  )
}

export default ConsciousnessLaboratoryChat
