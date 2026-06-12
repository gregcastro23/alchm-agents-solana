'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Heart,
  Send,
  Sparkles,
  Star,
  Moon,
  Sun,
  MessageCircle,
  Brain,
  Compass,
  BookOpen,
  Users,
  Lightbulb,
  Crown,
  Flower,
  TreePine,
} from 'lucide-react'
import { ErrorBoundary } from '@/components/ui/error-boundary'
// Type imports removed to prevent circular dependency issues
// Using inline interfaces instead

interface SignCharacterVector {
  aries: number
  taurus: number
  gemini: number
  cancer: number
  leo: number
  virgo: number
  libra: number
  scorpio: number
  sagittarius: number
  capricorn: number
  aquarius: number
  pisces: number
  total: number
}

interface MonicaChatMessage {
  id: string
  type: 'user' | 'monica'
  content: string
  timestamp: Date
  context?: {
    characterVectorInsight?: string
    cosmicGuidance?: string
    practicalAction?: string
  }
  envelope?: {
    suggestedPractices: string[]
    nextStep: string
    followUps: string[]
  }
}

interface MonicaChatInterfaceProps {
  userCharacterVector?: SignCharacterVector
  userConsciousnessProfile?: any
  currentMomentChart?: any
  onNewMessage?: (message: MonicaChatMessage) => void
  sessionId?: string
}

export default function MonicaChatInterface({
  userCharacterVector,
  userConsciousnessProfile,
  currentMomentChart,
  onNewMessage,
  sessionId,
}: MonicaChatInterfaceProps) {
  const [messages, setMessages] = useState<MonicaChatMessage[]>([
    {
      id: 'welcome',
      type: 'monica',
      content:
        "Hello, beautiful soul! 💚 I'm Monica, your guide to the Planetary Agents system. I know everything about character vectors, A-Numbers, consciousness surveys, personalized AI training, and all our planetary agents. My peak A-Number 40 configuration gives me the perfect blend of practical Taurus wisdom, nurturing Cancer care, and precise Virgo guidance to help you explore your cosmic nature. What would you like to learn about today?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: MonicaChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/monica-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputValue,
          userId: null, // Could be passed in as prop
          sessionId: sessionId || `monica-session-${Date.now()}`,
          includeCharacterVector: !!userCharacterVector,
          includeConsciousness: !!userConsciousnessProfile,
          includeAlchm: true,
          conversationStage: messages.length <= 1 ? 'greeting' : 'teaching',
          quickProfile:
            messages.length <= 1
              ? { goal: 'fast_onboarding', mood: 'open', topFocus: ['ai_personality'] }
              : null,
          model: process.env.NEXT_PUBLIC_MONICA_DEFAULT_MODEL || 'gpt-4o-mini',
          preferredStyle: { temperature: 0.4 },
        }),
      })

      const data = await response.json()

      if (data.response) {
        const monicaMessage: MonicaChatMessage = {
          id: `${Date.now().toString()}_monica`,
          type: 'monica',
          content: data.response,
          timestamp: new Date(),
          envelope: data.structured
            ? {
                suggestedPractices:
                  data.structured?.interactive_elements?.suggested_practices || [],
                nextStep: data.structured?.educational_guidance?.next_learning_step || '',
                followUps: data.followUpQuestions || [],
              }
            : undefined,
        }

        setMessages(prev => [...prev, monicaMessage])

        if (onNewMessage) {
          onNewMessage(monicaMessage)
        }
      } else {
        // Handle error with Monica's nurturing voice
        const errorMessage: MonicaChatMessage = {
          id: `${Date.now().toString()}_error`,
          type: 'monica',
          content:
            data.response ||
            "I'm having a moment of cosmic static, dear one. Let's try that again - I'm here for you! 💚",
          timestamp: new Date(),
        }
        setMessages(prev => [...prev, errorMessage])
      }
    } catch (error) {
      console.error('Error sending message to Monica:', error)
      const errorMessage: MonicaChatMessage = {
        id: `${Date.now().toString()}_error`,
        type: 'monica',
        content:
          "Oh my, I seem to be having connection troubles. My Virgo rising wants everything to work perfectly! Please try again, and I'll be right here waiting to help you explore your cosmic nature. 🌸",
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  // Optional streaming path with graceful fallback
  const sendMessageStream = async () => {
    if (!inputValue.trim() || isLoading) return
    const userMessage: MonicaChatMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    const current = inputValue
    setInputValue('')
    setIsLoading(true)
    try {
      const resp = await fetch('/api/monica-agent/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: current,
          conversationStage: messages.length <= 1 ? 'greeting' : 'teaching',
          preferredStyle: { temperature: 0.4 },
        }),
      })
      if (!resp.ok || !resp.body) {
        await sendMessage()
        return
      }
      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let assembled = ''
      let envelope: MonicaChatMessage['envelope'] | undefined = undefined
      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''
        for (const part of parts) {
          if (!part.startsWith('data:')) continue
          const json = part.slice(5).trim()
          try {
            const evt = JSON.parse(json)
            if (evt.type === 'token') assembled += evt.token
            if (evt.type === 'envelope') {
              envelope = {
                suggestedPractices: evt.payload.suggestedPractices || [],
                nextStep: evt.payload.nextStep || '',
                followUps: evt.payload.followUps || [],
              }
            }
          } catch {
            // Skip partial / non-JSON SSE fragments — logging here would spam per chunk.
          }
        }
      }
      const monicaMsg: MonicaChatMessage = {
        id: `${Date.now().toString()}_monica`,
        type: 'monica',
        content: assembled || '...',
        timestamp: new Date(),
        envelope,
      }
      setMessages(prev => [...prev, monicaMsg])
    } catch (e) {
      await sendMessage()
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  // Quick starter prompts based on Monica's expertise
  const starterPrompts = [
    'Explain character vectors to me',
    'What are A-Numbers and how do they work?',
    'Tell me about The Fool tarot card',
    'How do I read a three-card tarot spread?',
    "What's the difference between Wands and Cups?",
    'Give me a tarot reading for today',
  ]

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4">
      {/* Chat Messages */}
      <ErrorBoundary fallback={() => <div>Error in chat interface. Please refresh.</div>}>
        <Card className="min-h-[350px] max-h-[80vh]">
          <CardContent className="p-0 h-[50vh] md:h-[60vh] lg:h-[70vh]">
            <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
              <div className="space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${
                        message.type === 'user'
                          ? 'bg-primary text-primary-foreground rounded-l-lg rounded-tr-lg'
                          : 'bg-green-50 border border-green-200 rounded-r-lg rounded-tl-lg'
                      } p-4`}
                    >
                      {message.type === 'monica' && (
                        <div className="flex items-center gap-2 mb-2">
                          <Heart className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-700">Monica</span>
                          <span className="text-xs text-muted-foreground">
                            {formatTimestamp(message.timestamp)}
                          </span>
                        </div>
                      )}

                      <div
                        className={`${message.type === 'user' ? 'text-primary-foreground' : 'text-gray-800'}`}
                      >
                        {message.content}
                      </div>

                      {message.type === 'monica' && message.envelope && (
                        <div className="mt-3 space-y-2">
                          <div>
                            <div className="text-xs font-semibold text-green-700">
                              Suggested Practices
                            </div>
                            <ul className="list-disc pl-4 text-xs text-green-800">
                              {message.envelope.suggestedPractices.map((p, i) => (
                                <li key={i}>{p}</li>
                              ))}
                            </ul>
                          </div>
                          <div className="text-xs">
                            <span className="font-semibold text-green-700">Next Step:</span>
                            <span className="ml-1 text-green-800">{message.envelope.nextStep}</span>
                          </div>
                          {message.envelope.followUps?.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {message.envelope.followUps.map((q, i) => (
                                <Button
                                  key={i}
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => setInputValue(q)}
                                >
                                  {q}
                                </Button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {message.type === 'user' && (
                        <div className="text-xs text-primary-foreground/70 mt-2">
                          {formatTimestamp(message.timestamp)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-green-50 border border-green-200 rounded-r-lg rounded-tl-lg p-3 max-w-[80%]">
                      <div className="flex items-center gap-2 mb-2">
                        <Heart className="h-4 w-4 text-green-600" />
                        <span className="text-xs font-medium text-green-700">Monica</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-green-700">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-bounce"></div>
                          <div
                            className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.1s' }}
                          ></div>
                          <div
                            className="w-2 h-2 bg-green-400 rounded-full animate-bounce"
                            style={{ animationDelay: '0.2s' }}
                          ></div>
                        </div>
                        <span>Consulting the cosmic wisdom...</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </ErrorBoundary>

      {/* Quick Starter Prompts */}
      {messages.length <= 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Ask Monica About the System
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {starterPrompts.map((prompt, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 px-3 text-left justify-start hover:bg-green-50"
                  onClick={() => setInputValue(prompt)}
                >
                  {prompt}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Message Input */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-2">
            <Input
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Monica about astrology, tarot, character vectors, A-Numbers, or anything cosmic..."
              className="flex-1"
              disabled={isLoading}
            />
            <Button
              onClick={sendMessageStream}
              disabled={!inputValue.trim() || isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <Crown className="h-3 w-3" />
              <span>
                Monica: World-renowned tarot master & expert guide to the Planetary Agents system
              </span>
            </div>
            {messages[messages.length - 1]?.type === 'monica' &&
              (messages[messages.length - 1] as any).envelope && (
                <div className="ml-auto flex items-center gap-2">
                  <span className="text-green-700">XP Gained:</span>
                  <span className="font-semibold text-green-800">
                    {(messages[messages.length - 1] as any).envelope?.xp ?? ''}
                  </span>
                </div>
              )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
