'use client'

import type React from 'react'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getPlanetaryDignity } from '@/lib/astrological-data'
import { Badge } from '@/components/ui/badge'

type Message = {
  role: 'user' | 'agent'
  content: string
}

export default function GalileoAgentPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [planet, setPlanet] = useState('Sun')
  const [sign, setSign] = useState('Aries')
  const [degree, setDegree] = useState('1')
  const [modelStatus, setModelStatus] = useState<'ready' | 'loading' | 'error'>('ready')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const planets = [
    'Sun',
    'Moon',
    'Mercury',
    'Venus',
    'Mars',
    'Jupiter',
    'Saturn',
    'Uranus',
    'Neptune',
    'Pluto',
  ]
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
  const degrees = Array.from({ length: 30 }, (_, i) => (i + 1).toString())

  // Get the dignity of the current planet in the selected sign
  const dignity = getPlanetaryDignity(planet, sign)

  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // When planet or sign changes, check if we have a model for it
  useEffect(() => {
    const checkModelAvailability = async () => {
      setModelStatus('loading')
      try {
        // This would be a real API call to check if the model exists
        // For now, we'll simulate with a timeout
        await new Promise(resolve => setTimeout(resolve, 500))
        setModelStatus('ready')
      } catch (error) {
        console.error('Error checking model availability:', error)
        setModelStatus('error')
      }
    }

    checkModelAvailability()
  }, [planet, sign])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || loading) return

    const userMessage: Message = { role: 'user', content: input }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await fetch('/api/planetary-agent-galileo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planet, sign, degree, question: input }),
      })

      const data = await response.json()

      if (response.ok) {
        const agentMessage: Message = { role: 'agent', content: data.response }
        setMessages(prev => [...prev, agentMessage])
      } else {
        throw new Error(data.error || 'Failed to get response')
      }
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: Message = {
        role: 'agent',
        content: 'Sorry, I encountered an error while processing your request.',
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  // Get background color based on dignity
  const getDignityColor = () => {
    switch (dignity) {
      case 'domicile':
        return 'bg-green-50 dark:bg-green-950'
      case 'exaltation':
        return 'bg-blue-50 dark:bg-blue-950'
      case 'detriment':
        return 'bg-red-50 dark:bg-red-950'
      case 'fall':
        return 'bg-orange-50 dark:bg-orange-950'
      default:
        return 'bg-gray-50 dark:bg-gray-900'
    }
  }

  // Get text for dignity status
  const getDignityText = () => {
    switch (dignity) {
      case 'domicile':
        return 'In Domicile (Strong)'
      case 'exaltation':
        return 'Exalted (Very Strong)'
      case 'detriment':
        return 'In Detriment (Challenged)'
      case 'fall':
        return 'In Fall (Very Challenged)'
      default:
        return 'Peregrine (Neutral)'
    }
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-center mb-2">Galileo Planetary Agents</h1>
      <p className="text-center mb-8 max-w-2xl mx-auto">
        Consult with specialized astrological agents powered by Galileo AI models trained on
        planetary dignities
      </p>

      <Tabs defaultValue="chat" className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="chat">Chat Interface</TabsTrigger>
          <TabsTrigger value="about">About Galileo Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <Card className={`w-full ${getDignityColor()} transition-colors duration-500`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>
                  {planet} in {sign} {degree}°
                </CardTitle>
                <Badge
                  variant={
                    modelStatus === 'ready'
                      ? 'default'
                      : modelStatus === 'loading'
                        ? 'outline'
                        : 'destructive'
                  }
                >
                  {modelStatus === 'ready'
                    ? 'Model Ready'
                    : modelStatus === 'loading'
                      ? 'Loading Model...'
                      : 'Model Unavailable'}
                </Badge>
              </div>
              <div className="text-sm font-medium">{getDignityText()}</div>
              <div className="flex flex-wrap gap-2 mt-4">
                <Select value={planet} onValueChange={(value: string) => setPlanet(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Planet" />
                  </SelectTrigger>
                  <SelectContent>
                    {planets.map(p => (
                      <SelectItem key={p} value={p}>
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sign} onValueChange={(value: string) => setSign(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Sign" />
                  </SelectTrigger>
                  <SelectContent>
                    {signs.map(s => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={degree} onValueChange={(value: string) => setDegree(value)}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Degree" />
                  </SelectTrigger>
                  <SelectContent>
                    {degrees.map(d => (
                      <SelectItem key={d} value={d}>
                        {d}°
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent className="h-[400px] overflow-y-auto border rounded-md p-4 mb-4 bg-white dark:bg-gray-950">
              {messages.length === 0 ? (
                <div className="text-center text-muted-foreground h-full flex items-center justify-center">
                  Ask the {planet} in {sign} for guidance
                </div>
              ) : (
                <>
                  {messages.map((msg, i) => (
                    <div
                      key={i}
                      className={`mb-4 p-3 rounded-lg ${
                        msg.role === 'user'
                          ? 'bg-primary/10 ml-auto max-w-[80%]'
                          : 'bg-secondary/10 mr-auto max-w-[80%]'
                      }`}
                    >
                      {msg.content}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </CardContent>

            <CardFooter>
              <form onSubmit={handleSubmit} className="w-full flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  placeholder="Ask your question..."
                  disabled={loading || modelStatus !== 'ready'}
                  className="flex-1"
                />
                <Button type="submit" disabled={loading || modelStatus !== 'ready'}>
                  {loading ? 'Consulting...' : 'Send'}
                </Button>
              </form>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About Galileo Planetary Agents</CardTitle>
            </CardHeader>
            <CardContent className="prose dark:prose-invert max-w-none">
              <h3>Specialized Astrological Models</h3>
              <p>
                Our Galileo Planetary Agents are specialized AI models trained on the specific
                qualities and dignities of each planet in every zodiac sign. Unlike general AI
                models, these agents embody the unique astrological wisdom of each planetary
                placement.
              </p>

              <h3>Training Methodology</h3>
              <p>Each model has been trained on:</p>
              <ul>
                <li>Classical astrological texts from Ptolemy to Lilly</li>
                <li>Modern interpretations from respected astrologers</li>
                <li>The specific dignity of each planet in each sign</li>
                <li>Degree-specific meanings and decanate influences</li>
              </ul>

              <h3>Available Models</h3>
              <p>
                We currently offer models for the 10 planets (including Sun and Moon) in all 12
                zodiac signs, with specific training for each degree. This creates a comprehensive
                system of 3,600 specialized astrological agents (10 planets × 12 signs × 30
                degrees).
              </p>

              <h3>Usage Guidelines</h3>
              <p>For best results:</p>
              <ul>
                <li>Be specific in your questions</li>
                <li>Consider the traditional dignity of the planet in your chosen sign</li>
                <li>Experiment with different degrees for nuanced insights</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
