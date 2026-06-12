'use client'

import type React from 'react'
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Slider } from '@/components/ui/slider'
import { usePlanetaryPositions } from '@/hooks/usePlanetaryPositions'
import {
  getPlanetaryDignity,
  getSignElement,
  getPlanetaryElement,
  calculateElementalAffinity,
} from '@/lib/astrological-data'
import {
  calculateMoonPhase,
  calculateMoonIllumination,
  getMoonDegree,
  getLunarDegreePersonality,
  getMoonPhaseEmoji,
  type MoonPhase,
} from '@/lib/moon-phase-calculator'

type Message = {
  role: 'user' | 'agent'
  content: string
  agent?: string // Which agent sent the message
  timestamp: Date
}

type AgentConfig = {
  planet: string
  sign: string
  degree: string
  active: boolean
  color: string
  symbol: string
  moonPhase?: MoonPhase
  moonPersonality?: string
  moonDegree?: number
}

interface AgentResponse {
  agent: string
  response: string
}

interface MultiAgentApiResponse {
  responses: AgentResponse[]
}

const PLANET_SYMBOLS: Record<string, string> = {
  Sun: '☉',
  Moon: '☽',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
}

const PLANET_COLORS: Record<string, string> = {
  Sun: 'bg-yellow-500',
  Moon: 'bg-gray-400',
  Mercury: 'bg-orange-500',
  Venus: 'bg-pink-500',
  Mars: 'bg-red-500',
  Jupiter: 'bg-purple-500',
  Saturn: 'bg-gray-600',
  Uranus: 'bg-cyan-500',
  Neptune: 'bg-blue-500',
  Pluto: 'bg-gray-800',
}

interface MultiAgentChatProps {
  defaultActivePlanets?: string[]
  defaultAutoSyncSky?: boolean
}

export default function MultiAgentChat({
  defaultActivePlanets = ['Sun', 'Moon', 'Mercury'],
  defaultAutoSyncSky = true,
}: MultiAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [currentMoonPhase, setCurrentMoonPhase] = useState<MoonPhase>('New Moon')
  const [currentMoonDegree, setCurrentMoonDegree] = useState<number>(0)
  const [autoSyncSky, setAutoSyncSky] = useState<boolean>(defaultAutoSyncSky)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Calculate current moon phase on component mount
  useEffect(() => {
    const now = new Date()
    const phase = calculateMoonPhase(now)
    const degree = getMoonDegree(now)
    setCurrentMoonPhase(phase)
    setCurrentMoonDegree(degree)
  }, [])

  // Default agent configurations
  const [agents, setAgents] = useState<AgentConfig[]>([
    {
      planet: 'Sun',
      sign: 'Leo',
      degree: '15',
      active: false,
      color: PLANET_COLORS.Sun,
      symbol: PLANET_SYMBOLS.Sun,
    },
    {
      planet: 'Moon',
      sign: 'Cancer',
      degree: '10',
      active: false,
      color: PLANET_COLORS.Moon,
      symbol: PLANET_SYMBOLS.Moon,
      moonPhase: currentMoonPhase,
      moonDegree: currentMoonDegree,
    },
    {
      planet: 'Mercury',
      sign: 'Gemini',
      degree: '20',
      active: false,
      color: PLANET_COLORS.Mercury,
      symbol: PLANET_SYMBOLS.Mercury,
    },
    {
      planet: 'Venus',
      sign: 'Taurus',
      degree: '12',
      active: false,
      color: PLANET_COLORS.Venus,
      symbol: PLANET_SYMBOLS.Venus,
    },
    {
      planet: 'Mars',
      sign: 'Aries',
      degree: '25',
      active: false,
      color: PLANET_COLORS.Mars,
      symbol: PLANET_SYMBOLS.Mars,
    },
    {
      planet: 'Jupiter',
      sign: 'Sagittarius',
      degree: '5',
      active: false,
      color: PLANET_COLORS.Jupiter,
      symbol: PLANET_SYMBOLS.Jupiter,
    },
    {
      planet: 'Saturn',
      sign: 'Capricorn',
      degree: '18',
      active: false,
      color: PLANET_COLORS.Saturn,
      symbol: PLANET_SYMBOLS.Saturn,
    },
    {
      planet: 'Uranus',
      sign: 'Aquarius',
      degree: '8',
      active: false,
      color: PLANET_COLORS.Uranus,
      symbol: PLANET_SYMBOLS.Uranus,
    },
    {
      planet: 'Neptune',
      sign: 'Pisces',
      degree: '22',
      active: false,
      color: PLANET_COLORS.Neptune,
      symbol: PLANET_SYMBOLS.Neptune,
    },
    {
      planet: 'Pluto',
      sign: 'Scorpio',
      degree: '14',
      active: false,
      color: PLANET_COLORS.Pluto,
      symbol: PLANET_SYMBOLS.Pluto,
    },
  ])

  // Live planetary positions (current sky)
  const {
    planetaryPositions,
    lastUpdated,
    loading: positionsLoading,
    error: positionsError,
    refresh: refreshPositions,
  } = usePlanetaryPositions({ refreshInterval: 60000 })

  // Sync agent sign/degree to current sky positions
  useEffect(() => {
    if (!autoSyncSky) return
    if (!planetaryPositions || planetaryPositions.length === 0) return

    setAgents(prev =>
      prev.map(agent => {
        const match = planetaryPositions.find(p => p.planet === agent.planet)
        if (!match) return agent
        // Degree 0-29; ensure string form
        const degreeStr = String(Math.floor(match.degree))
        return {
          ...agent,
          sign: match.sign,
          degree: degreeStr,
          // update moon extras if applicable
          ...(agent.planet === 'Moon'
            ? { moonDegree: currentMoonDegree, moonPhase: currentMoonPhase }
            : {}),
        }
      })
    )
  }, [planetaryPositions, autoSyncSky, currentMoonDegree, currentMoonPhase])

  // Preselect default active planets on mount
  useEffect(() => {
    if (!defaultActivePlanets || defaultActivePlanets.length === 0) return
    setAgents(prev =>
      prev.map(a => ({
        ...a,
        active: defaultActivePlanets.includes(a.planet) ? true : a.active,
      }))
    )
  }, [defaultActivePlanets])

  const signs = [
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

  // Get active agents
  const activeAgents = agents.filter(a => a.active)

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Toggle agent active status
  const toggleAgent = (index: number) => {
    setAgents(prev =>
      prev.map((agent, i) => (i === index ? { ...agent, active: !agent.active } : agent))
    )
  }

  // Update agent configuration
  const updateAgent = (index: number, field: keyof AgentConfig, value: string) => {
    setAgents(prev => prev.map((agent, i) => (i === index ? { ...agent, [field]: value } : agent)))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || activeAgents.length === 0) return

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agents: activeAgents.map(a => ({
            planet: a.planet,
            sign: a.sign,
            degree: a.degree,
            moonPhase: a.moonPhase,
            moonPersonality: a.moonPersonality,
            moonDegree: a.moonDegree,
          })),
          question: input,
          sessionId,
          planetaryContext: {
            timestamp: new Date().toISOString(),
            positions: planetaryPositions || [],
          },
        }),
      })

      const data = await response.json()

      if (response.ok) {
        // Add responses from each agent
        if (data.responses && Array.isArray(data.responses)) {
          const agentMessages = data.responses.map((resp: AgentResponse) => ({
            role: 'agent' as const,
            content: resp.response,
            agent: resp.agent,
            timestamp: new Date(),
          }))
          setMessages(prev => [...prev, ...agentMessages])
        }

        // Store session ID for subsequent requests
        if (data.sessionId && !sessionId) {
          setSessionId(data.sessionId)
        }
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'agent',
        content: 'Sorry, I encountered an error while processing your request.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Get agent avatar color
  const getAgentColor = (agentName?: string) => {
    if (!agentName) return 'bg-gray-500'
    const agent = agents.find(a => a.planet === agentName)
    return agent?.color || 'bg-gray-500'
  }

  // Get agent symbol
  const getAgentSymbol = (agentName?: string) => {
    if (!agentName) return '?'
    const agent = agents.find(a => a.planet === agentName)
    return agent?.symbol || agentName[0]
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="text-center text-2xl">Multi-Agent Planetary Council</CardTitle>
          <p className="text-center text-muted-foreground">
            Select multiple planetary agents to consult together
          </p>
          {/* Current sky sync banner */}
          <div className="mt-3 flex flex-col md:flex-row items-center justify-between gap-2 p-2 bg-blue-50 dark:bg-blue-950/20 rounded">
            <div className="text-xs md:text-sm text-blue-800 dark:text-blue-200">
              {positionsLoading
                ? 'Syncing with current sky…'
                : positionsError
                  ? 'Unable to load current positions'
                  : `Synced to current sky${lastUpdated ? ` as of ${lastUpdated.toLocaleTimeString()}` : ''}`}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-2 text-xs md:text-sm">
                <input
                  type="checkbox"
                  checked={autoSyncSky}
                  onChange={e => setAutoSyncSky(e.target.checked)}
                />
                Auto-sync to current sky
              </label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refreshPositions()}
                disabled={positionsLoading}
              >
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="chat" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chat">Chat</TabsTrigger>
              <TabsTrigger value="agents">Configure Agents</TabsTrigger>
            </TabsList>

            <TabsContent value="agents" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {agents.map((agent, index) => (
                  <Card key={agent.planet} className={agent.active ? 'border-primary' : ''}>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={agent.active}
                            onCheckedChange={() => toggleAgent(index)}
                          />
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className={agent.color}>{agent.symbol}</AvatarFallback>
                          </Avatar>
                          <span className="font-semibold">{agent.planet}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {autoSyncSky && (
                            <Badge variant="secondary" className="text-xxs md:text-xs">
                              Synced
                            </Badge>
                          )}
                          {agent.active && <Badge variant="default">Active</Badge>}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2">
                        <select
                          value={agent.sign}
                          onChange={e => updateAgent(index, 'sign', e.target.value)}
                          className="flex-1 px-2 py-1 border rounded text-sm"
                        >
                          {signs.map(sign => (
                            <option key={sign} value={sign}>
                              {sign}
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          value={agent.degree}
                          onChange={e => updateAgent(index, 'degree', e.target.value)}
                          min="0"
                          max="29"
                          className="w-16 px-2 py-1 border rounded text-sm"
                        />
                        <span className="self-center">°</span>
                      </div>

                      {/* Moon-specific phase controls */}
                      {agent.planet === 'Moon' && (
                        <div className="space-y-2 p-2 bg-blue-50 rounded">
                          <div className="flex items-center gap-2 text-sm">
                            <span>{getMoonPhaseEmoji(currentMoonPhase)}</span>
                            <span className="font-medium">Current: {currentMoonPhase}</span>
                            <Badge variant="outline" className="text-xs">
                              {Math.round(calculateMoonIllumination())}% lit
                            </Badge>
                          </div>
                          <div className="text-xs">
                            <label className="block mb-1">
                              Moon Degree: {agent.moonDegree || currentMoonDegree}°
                            </label>
                            <Slider
                              value={[agent.moonDegree || currentMoonDegree]}
                              onValueChange={value => {
                                const newDegree = value[0]
                                const lunarPersonality = getLunarDegreePersonality(newDegree)
                                updateAgent(index, 'moonDegree', newDegree.toString())
                                updateAgent(index, 'moonPhase', lunarPersonality.phase)
                                updateAgent(index, 'moonPersonality', lunarPersonality.personality)
                              }}
                              max={359}
                              min={0}
                              step={1}
                              className="w-full"
                            />
                          </div>
                          {agent.moonPersonality && (
                            <div className="text-xs text-muted-foreground">
                              Lunar Personality: {agent.moonPersonality}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="text-xs text-muted-foreground">
                        Dignity: {getPlanetaryDignity(agent.planet, agent.sign)}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="chat" className="space-y-4">
              {/* Active agents display */}
              {activeAgents.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <span className="text-sm text-muted-foreground">Active Agents:</span>
                  {activeAgents.map(agent => (
                    <Badge key={agent.planet} className={agent.color}>
                      {agent.symbol} {agent.planet} in {agent.sign}{' '}
                      {Number.isFinite(Number(agent.degree)) ? `${agent.degree}°` : ''}
                      {agent.planet === 'Moon' && agent.moonPhase && (
                        <span className="ml-1">{getMoonPhaseEmoji(agent.moonPhase)}</span>
                      )}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Chat messages */}
              <ScrollArea className="h-[400px] border rounded-md p-4 bg-background">
                {messages.length === 0 ? (
                  <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                    {activeAgents.length === 0
                      ? 'Select at least one planetary agent to begin'
                      : 'Ask your question to the planetary council'}
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => (
                      <div
                        key={i}
                        className={`mb-4 ${msg.role === 'user' ? 'ml-auto max-w-[80%]' : 'mr-auto max-w-[85%]'}`}
                      >
                        <div className="flex items-start gap-2">
                          {msg.role === 'agent' && (
                            <Avatar className="h-8 w-8 mt-1">
                              <AvatarFallback className={getAgentColor(msg.agent)}>
                                {getAgentSymbol(msg.agent)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <div className="flex-1">
                            {msg.role === 'agent' && msg.agent && (
                              <div className="text-xs text-muted-foreground mb-1">
                                {msg.agent} responds:
                              </div>
                            )}
                            <div
                              className={`p-3 rounded-lg ${
                                msg.role === 'user' ? 'bg-primary/10' : 'bg-secondary/10'
                              }`}
                            >
                              {msg.content}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {msg.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter>
          <form onSubmit={handleSubmit} className="w-full flex gap-2">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={
                activeAgents.length === 0
                  ? 'Select agents first...'
                  : `Ask the ${activeAgents.map(a => a.planet).join(', ')}...`
              }
              disabled={loading || activeAgents.length === 0}
              className="flex-1"
            />
            <Button type="submit" disabled={loading || activeAgents.length === 0}>
              {loading ? 'Consulting...' : 'Send'}
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}
