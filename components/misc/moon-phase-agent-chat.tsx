'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { MOON_PHASES, ZODIAC_SIGNS } from '@/lib/moon-phase-system'

interface MoonPhaseAgentChatProps {
  className?: string
}

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  moonPhase?: {
    name: string
    emoji: string
    zodiacSign: string
    zodiacDegree: number
  }
}

export function MoonPhaseAgentChat({ className }: MoonPhaseAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [currentMoonPhase, setCurrentMoonPhase] = useState<any>(null)
  const [selectedPhase, setSelectedPhase] = useState<string>('current')
  const [selectedSign, setSelectedSign] = useState<string>('Aries')
  const [selectedDegree, setSelectedDegree] = useState<number>(15)
  const [mode, setMode] = useState<'current' | 'custom'>('current')

  useEffect(() => {
    fetchCurrentMoonPhase()
  }, [])

  const fetchCurrentMoonPhase = async () => {
    try {
      const response = await fetch('/api/moon-phase-agent')
      const data = await response.json()
      if (data.success) {
        setCurrentMoonPhase(data.agent)
      }
    } catch (error) {
      console.error('Error fetching current moon phase:', error)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      const requestBody: any = {
        message: input,
      }

      if (mode === 'custom') {
        requestBody.phase = selectedPhase
        requestBody.sign = selectedSign
        requestBody.degree = selectedDegree
      }

      const response = await fetch('/api/moon-phase-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      const data = await response.json()

      if (data.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          moonPhase: data.agent.phase,
        }
        setMessages(prev => [...prev, assistantMessage])
      }
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const clearChat = () => {
    setMessages([])
  }

  const phaseOptions = Object.values(MOON_PHASES).map(phase => ({
    value: phase.name,
    label: `${phase.emoji} ${phase.name}`,
  }))

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">🌙 Moon Phase Agent Oracle</CardTitle>
        <CardDescription>
          Commune with the Moon through her many phases and zodiacal positions
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Tabs value={mode} onValueChange={v => setMode(v as 'current' | 'custom')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current Moon</TabsTrigger>
            <TabsTrigger value="custom">Custom Position</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-4">
            {currentMoonPhase && (
              <div className="p-4 bg-muted rounded-lg space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{currentMoonPhase.phase.emoji}</span>
                  <div>
                    <p className="font-semibold">{currentMoonPhase.phase.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {currentMoonPhase.phase.zodiacSign}{' '}
                      {Math.round(currentMoonPhase.phase.zodiacDegree)}°
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Badge variant="secondary">{currentMoonPhase.phase.element}</Badge>
                  <Badge variant="secondary">{currentMoonPhase.phase.modality}</Badge>
                  <Badge variant="outline">{currentMoonPhase.personality.archetype}</Badge>
                </div>
                <p className="text-sm italic text-muted-foreground">
                  "{currentMoonPhase.personality.spiritualFocus}"
                </p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="custom" className="space-y-4">
            <div className="grid gap-4">
              <div>
                <label className="text-sm font-medium">Moon Phase</label>
                <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a phase" />
                  </SelectTrigger>
                  <SelectContent>
                    {phaseOptions.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Zodiac Sign</label>
                <Select value={selectedSign} onValueChange={setSelectedSign}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a sign" />
                  </SelectTrigger>
                  <SelectContent>
                    {ZODIAC_SIGNS.map(sign => (
                      <SelectItem key={sign.name} value={sign.name}>
                        {sign.name} ({sign.element})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Degree in Sign: {selectedDegree}°</label>
                <Slider
                  value={[selectedDegree]}
                  onValueChange={v => setSelectedDegree(v[0])}
                  min={0}
                  max={29}
                  step={1}
                  className="mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>0° (Early)</span>
                  <span>15° (Middle)</span>
                  <span>29° (Late)</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <ScrollArea className="h-[400px] rounded-lg border p-4">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <p>No messages yet. Ask the Moon for guidance...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map(message => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg p-3 ${
                      message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}
                  >
                    {message.moonPhase && message.role === 'assistant' && (
                      <div className="mb-2 text-xs opacity-80">
                        {message.moonPhase.emoji} {message.moonPhase.name} in{' '}
                        {message.moonPhase.zodiacSign}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyPress={e => e.key === 'Enter' && sendMessage()}
            placeholder="Ask the Moon for guidance..."
            disabled={isLoading}
            className="flex-1"
          />
          <Button onClick={sendMessage} disabled={isLoading}>
            {isLoading ? 'Consulting...' : 'Send'}
          </Button>
          <Button onClick={clearChat} variant="outline">
            Clear
          </Button>
        </div>

        <div className="text-xs text-muted-foreground text-center">
          The Moon speaks through {Object.values(MOON_PHASES).length} primary phases across all 12
          zodiac signs, offering {12 * Object.values(MOON_PHASES).length * 30} unique perspectives
        </div>
      </CardContent>
    </Card>
  )
}
