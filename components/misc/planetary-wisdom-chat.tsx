'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sun,
  Moon,
  Zap,
  Clock,
  Eye,
  RefreshCw,
  AlertCircle,
  Star,
  Globe,
  Activity,
  Sparkles,
  Crown,
  Users,
} from 'lucide-react'

import UnifiedMultiAgentChat from './unified-multi-agent-chat'
import type { ChatSession } from '@/lib/unified-agent-types'
import {
  createDefaultPlanetaryConfigs,
  updatePlanetaryConfigWithLiveSky,
  type PlanetaryConfig,
} from '@/lib/planetary-config-helper'
import {
  PLANETARY_COUNCIL_PRESETS,
  getOptimalMonicaRole,
  type PlanetaryCouncilPreset,
} from '@/lib/council-presets'
import { usePlanetaryPositions, type PlanetaryPosition } from '@/hooks/usePlanetaryPositions'

const SIGN_ORDER = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
]

const SIGN_ELEMENTS: Record<string, 'Fire' | 'Earth' | 'Air' | 'Water'> = {
  Aries: 'Fire',
  Leo: 'Fire',
  Sagittarius: 'Fire',
  Taurus: 'Earth',
  Virgo: 'Earth',
  Capricorn: 'Earth',
  Gemini: 'Air',
  Libra: 'Air',
  Aquarius: 'Air',
  Cancer: 'Water',
  Scorpio: 'Water',
  Pisces: 'Water',
}

const MAJOR_ASPECTS = [
  { type: 'Conjunction', angle: 0, orb: 8 },
  { type: 'Sextile', angle: 60, orb: 5 },
  { type: 'Square', angle: 90, orb: 6 },
  { type: 'Trine', angle: 120, orb: 6 },
  { type: 'Opposition', angle: 180, orb: 8 },
]

function getPlanetLongitude(position: PlanetaryPosition) {
  const signIndex = SIGN_ORDER.findIndex(sign => sign.toLowerCase() === position.sign.toLowerCase())
  return (Math.max(signIndex, 0) * 30 + position.degree + 360) % 360
}

function getAngularDistance(a: number, b: number) {
  const diff = Math.abs(a - b) % 360
  return diff > 180 ? 360 - diff : diff
}

function calculateCurrentAspects(positions: PlanetaryPosition[]) {
  const aspects: Array<{
    planetA: string
    planetB: string
    type: string
    orb: number
    angle: number
  }> = []

  for (let i = 0; i < positions.length; i++) {
    for (let j = i + 1; j < positions.length; j++) {
      const first = positions[i]
      const second = positions[j]
      const distance = getAngularDistance(getPlanetLongitude(first), getPlanetLongitude(second))

      for (const aspect of MAJOR_ASPECTS) {
        const orb = Math.abs(distance - aspect.angle)
        if (orb <= aspect.orb) {
          aspects.push({
            planetA: first.planet,
            planetB: second.planet,
            type: aspect.type,
            orb,
            angle: Math.round(distance),
          })
          break
        }
      }
    }
  }

  return aspects.sort((a, b) => a.orb - b.orb)
}

function calculateDominantElement(positions: PlanetaryPosition[]) {
  const scores = { Fire: 0, Earth: 0, Air: 0, Water: 0 }

  for (const position of positions) {
    const canonicalSign = SIGN_ORDER.find(
      sign => sign.toLowerCase() === position.sign.toLowerCase()
    )
    const element = canonicalSign ? SIGN_ELEMENTS[canonicalSign] : null
    if (element) scores[element] += 1
  }

  return Object.entries(scores).sort(([, a], [, b]) => b - a)[0][0]
}

function calculateLunarPhase(positions: PlanetaryPosition[]) {
  const sun = positions.find(position => position.planet.toLowerCase() === 'sun')
  const moon = positions.find(position => position.planet.toLowerCase() === 'moon')

  if (!sun || !moon) return 'Unknown'

  const angle = (getPlanetLongitude(moon) - getPlanetLongitude(sun) + 360) % 360
  const phaseIndex = Math.round(angle / 45) % 8

  return [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ][phaseIndex]
}

interface PlanetaryWisdomChatProps {
  // Core functionality
  isOpen: boolean
  onClose: () => void

  // Initial setup
  defaultActivePlanets?: string[]
  initialPreset?: string

  // Live sky features
  enableAutoSync?: boolean
  syncInterval?: number
  showCurrentSkyChart?: boolean
  enableTransitAlerts?: boolean
  planetaryHourNotifications?: boolean

  // Configuration
  title?: string
  maxAgents?: number
  allowMonica?: boolean

  // Callbacks
  onSessionUpdate?: (session: ChatSession) => void
  onAgentEvolution?: (agentId: string, evolution: any) => void
}

export function PlanetaryWisdomChat({
  isOpen,
  onClose,
  defaultActivePlanets = ['Sun', 'Moon', 'Mercury'],
  initialPreset,
  enableAutoSync = true,
  syncInterval = 60000,
  showCurrentSkyChart = true,
  enableTransitAlerts = true,
  planetaryHourNotifications = true,
  title = 'Celestial Council',
  maxAgents = 7,
  allowMonica = true,
  onSessionUpdate,
  onAgentEvolution,
}: PlanetaryWisdomChatProps) {
  // State management
  const [selectedPreset, setSelectedPreset] = useState<PlanetaryCouncilPreset | null>(
    initialPreset ? PLANETARY_COUNCIL_PRESETS.find(p => p.id === initialPreset) || null : null
  )
  const [customPlanets, setCustomPlanets] = useState<string[]>(defaultActivePlanets)
  const [showPresetSelection, setShowPresetSelection] = useState(!selectedPreset)
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(enableAutoSync)
  const [lastSyncTime, setLastSyncTime] = useState<Date>(new Date())
  const [transitAlerts, setTransitAlerts] = useState<string[]>([])

  // Live planetary data
  const { planetaryPositions, loading: positionsLoading } = usePlanetaryPositions()

  // Base planetary configurations
  const [planetaryConfigs, setPlanetaryConfigs] = useState<PlanetaryConfig[]>(
    createDefaultPlanetaryConfigs()
  )

  // Update configurations with live sky data
  useEffect(() => {
    if (autoSyncEnabled && planetaryPositions) {
      const updatedConfigs = planetaryConfigs.map(config =>
        updatePlanetaryConfigWithLiveSky(config, planetaryPositions)
      )
      setPlanetaryConfigs(updatedConfigs)
      setLastSyncTime(new Date())
    }
  }, [planetaryPositions, autoSyncEnabled, planetaryConfigs])

  // Auto-sync interval
  useEffect(() => {
    if (!autoSyncEnabled) return

    const interval = setInterval(() => {
      // Trigger re-fetch of planetary positions
      setLastSyncTime(new Date())
    }, syncInterval)

    return () => clearInterval(interval)
  }, [autoSyncEnabled, syncInterval])

  // Active planetary agents based on preset or custom selection
  const activePlanetIds = useMemo(() => {
    if (selectedPreset) {
      return selectedPreset.planetaryAgentIds
    }
    return customPlanets
  }, [selectedPreset, customPlanets])

  // Filter planetary configs to active agents
  const activePlanetaryConfigs = useMemo(() => {
    return planetaryConfigs.filter(config => activePlanetIds.includes(config.planet))
  }, [planetaryConfigs, activePlanetIds])

  // Calculate current astrological information
  const currentAstroInfo = useMemo(() => {
    if (!planetaryPositions || planetaryPositions.length === 0) return null

    const aspects = calculateCurrentAspects(planetaryPositions)
    const retrogrades = planetaryPositions
      .filter(position => position.retrograde)
      .map(position => position.planet)

    return {
      dominantElement: calculateDominantElement(planetaryPositions),
      majorAspects: aspects,
      retrogradeCount: retrogrades.length,
      retrogradePlanets: retrogrades,
      lunarPhase: calculateLunarPhase(planetaryPositions),
    }
  }, [planetaryPositions])

  // Handle preset selection
  const handlePresetSelect = (preset: PlanetaryCouncilPreset) => {
    setSelectedPreset(preset)
    setCustomPlanets(preset.planetaryAgentIds)
    setShowPresetSelection(false)
  }

  // Handle custom selection
  const handleCreateCustomCouncil = () => {
    setSelectedPreset(null)
    setShowPresetSelection(false)
  }

  // Toggle auto-sync
  const handleAutoSyncToggle = (enabled: boolean) => {
    setAutoSyncEnabled(enabled)
    if (enabled) {
      setLastSyncTime(new Date())
    }
  }

  // Manual sync
  const handleManualSync = () => {
    setLastSyncTime(new Date())
    // Force refresh of planetary positions
  }

  // Render preset selection
  const renderPresetSelection = () => (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold mb-2">Choose Your Celestial Council</h2>
        <p className="text-muted-foreground">Select planetary agents for cosmic guidance</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PLANETARY_COUNCIL_PRESETS.map(preset => (
          <Card
            key={preset.id}
            className="cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] bg-black/40 backdrop-blur-md border-white/10 hover:border-purple-500/50 text-white"
            onClick={() => handlePresetSelect(preset)}
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
                  <span className="text-sm">{preset.planetaryAgentIds.length}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-purple-200/70 mb-3">{preset.description}</p>

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Star className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-medium">Focus:</span>
                </div>
                <p className="text-sm text-purple-200/70 ml-6">{preset.astrological_focus}</p>
              </div>

              <div className="flex flex-wrap gap-2 mt-3">
                {preset.planetCombination.map(planet => (
                  <Badge key={planet} variant="outline" className="text-xs">
                    {planet}
                  </Badge>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <Crown
                  className={`w-4 h-4 ${preset.includeMonica ? 'text-purple-500' : 'text-gray-300'}`}
                />
                <span className="text-sm">
                  {preset.includeMonica
                    ? `Monica as ${preset.monicaRole}`
                    : 'Pure planetary wisdom'}
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

      {/* Custom Council Option */}
      <Card
        className="cursor-pointer transition-all hover:shadow-[0_0_20px_rgba(139,92,246,0.2)] border-dashed border-2 bg-black/40 backdrop-blur-md border-white/20 hover:border-purple-500/50 text-white"
        onClick={handleCreateCustomCouncil}
      >
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Sparkles className="w-8 h-8 text-primary mx-auto mb-2" />
            <h3 className="font-semibold mb-1">Create Custom Council</h3>
            <p className="text-sm text-purple-200/70">Select your own planetary combination</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )

  // Render live sky status
  const renderLiveSkyStatus = () => (
    <Card className="mb-4 bg-black/40 backdrop-blur-md border-white/10 text-white shadow-[0_0_20px_rgba(139,92,246,0.05)]">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className={`w-5 h-5 ${autoSyncEnabled ? 'text-green-500' : 'text-gray-400'}`} />
            <CardTitle className="text-lg">Live Sky Connection</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={autoSyncEnabled} onCheckedChange={handleAutoSyncToggle} />
            <Button variant="ghost" size="sm" onClick={handleManualSync} disabled={autoSyncEnabled}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Sync Status */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Activity
                className={`w-4 h-4 ${autoSyncEnabled ? 'text-green-500' : 'text-gray-400'}`}
              />
              <span className="font-medium">Sync Status</span>
            </div>
            <div className="text-sm">
              <div className={autoSyncEnabled ? 'text-green-600' : 'text-gray-500'}>
                {autoSyncEnabled ? 'Live' : 'Manual'}
              </div>
              <div className="text-purple-300/70">Last: {lastSyncTime.toLocaleTimeString()}</div>
            </div>
          </div>

          {/* Current Astro Info */}
          {currentAstroInfo && (
            <>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Sun className="w-4 h-4 text-amber-500" />
                  <span className="font-medium">Dominant Element</span>
                </div>
                <Badge variant="outline">{currentAstroInfo.dominantElement}</Badge>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Moon className="w-4 h-4 text-blue-500" />
                  <span className="font-medium">Lunar Phase</span>
                </div>
                <div className="text-sm">{currentAstroInfo.lunarPhase}</div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="w-4 h-4 text-orange-500" />
                  <span className="font-medium">Retrogrades</span>
                </div>
                <div className="text-sm">
                  {currentAstroInfo.retrogradeCount === 0
                    ? 'None'
                    : `${currentAstroInfo.retrogradeCount} active`}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Active Council */}
        {activePlanetIds.length > 0 && (
          <div className="mt-4 pt-4 border-t border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4" />
              <span className="font-medium">Active Council</span>
              {selectedPreset && <Badge variant="outline">{selectedPreset.name}</Badge>}
            </div>
            <div className="flex flex-wrap gap-2">
              {activePlanetaryConfigs.map(config => (
                <div key={config.planet} className="flex items-center gap-1 text-sm">
                  <span style={{ color: config.color }}>{config.symbol}</span>
                  <span>{config.planet}</span>
                  <span className="text-purple-300/70">in {config.sign}</span>
                </div>
              ))}
              {selectedPreset?.includeMonica && (
                <div className="flex items-center gap-1 text-sm">
                  <Crown className="w-3 h-3 text-purple-500" />
                  <span>Monica ({selectedPreset.monicaRole})</span>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )

  return (
    <>
      {/* Preset Selection Modal */}
      {showPresetSelection && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-[#0c0319] border border-purple-500/30 shadow-[0_0_50px_rgba(139,92,246,0.15)] rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden text-white">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold">Select Planetary Council</h2>
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
        variant="planetary"
        // Agent configuration
        historicalAgents={[]}
        planetaryConfigs={activePlanetaryConfigs}
        initialAgents={activePlanetIds}
        maxAgents={maxAgents}
        allowMonica={selectedPreset?.includeMonica || allowMonica}
        enableAutoSync={autoSyncEnabled}
        // Planetary-specific features
        enableGroupDynamics={true}
        enableExport={true}
        enablePresets={true}
        enableMemoryPersistence={true}
        // Callbacks
        onSessionUpdate={onSessionUpdate}
        onAgentEvolution={onAgentEvolution}
        // Custom header content
        customHeader={renderLiveSkyStatus()}
      />
    </>
  )
}

export default PlanetaryWisdomChat
