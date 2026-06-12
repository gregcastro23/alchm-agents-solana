'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, Sparkles } from 'lucide-react'

interface TarotChatProps {
  selectedCard?: string
  selectedSuit?: string
  readingType?: string
}

interface TarotResponse {
  response: string
  sessionId: string
  cardInfo?: {
    number?: number
    element?: string
    planet?: string
    chakra?: string
  }
  alchemicalProperties?: {
    spirit: number
    essence: number
    matter: number
    substance: number
  }
  readingType?: string
  error?: string
}

export function TarotAgentChat({
  selectedCard,
  selectedSuit,
  readingType = 'single',
}: TarotChatProps) {
  const [messages, setMessages] = useState<
    Array<{ type: 'user' | 'tarot'; content: string; cardInfo?: any }>
  >([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages(prev => [...prev, { type: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const response = await fetch('/api/tarot-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cardName: selectedCard,
          suit: selectedSuit,
          question: userMessage,
          readingType,
          sessionId,
        }),
      })

      const data: TarotResponse = await response.json()

      if (data.sessionId && !sessionId) {
        setSessionId(data.sessionId)
      }

      setMessages(prev => [
        ...prev,
        {
          type: 'tarot',
          content: data.response,
          cardInfo: data.cardInfo,
        },
      ])

      if (data.error) {
        console.error('Tarot agent error:', data.error)
      }
    } catch (error) {
      console.error('Failed to get tarot reading:', error)
      setMessages(prev => [
        ...prev,
        {
          type: 'tarot',
          content:
            "I apologize, but I'm having trouble connecting to the spiritual realm at the moment. Please try again.",
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const formatTarotResponse = (content: string) => {
    // Split by emoji headers for better formatting
    const sections = content.split(/(?=🔮|📊|🧪|✨)/)

    return sections.map((section, index) => {
      if (section.trim()) {
        const lines = section.trim().split('\n')
        const header = lines[0]
        const body = lines.slice(1).join('\n').trim()

        if (
          header.includes('🔮') ||
          header.includes('📊') ||
          header.includes('🧪') ||
          header.includes('✨')
        ) {
          return (
            <div key={index} className="mb-4">
              <div className="font-semibold text-purple-300 mb-2">{header}</div>
              <div className="text-gray-300 whitespace-pre-wrap">{body}</div>
            </div>
          )
        }

        return (
          <div key={index} className="text-gray-300 whitespace-pre-wrap mb-2">
            {section.trim()}
          </div>
        )
      }
      return null
    })
  }

  return (
    <Card className="w-full max-w-4xl mx-auto bg-gradient-to-br from-purple-900/20 to-indigo-900/20 border-purple-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-purple-300">
          <Sparkles className="h-5 w-5" />
          Tarot Wisdom
          {selectedCard && (
            <Badge variant="secondary" className="ml-2 bg-purple-700/50 text-purple-200">
              {selectedCard}
            </Badge>
          )}
          {selectedSuit && (
            <Badge variant="outline" className="ml-1 border-purple-400 text-purple-200">
              {selectedSuit}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-96 overflow-y-auto space-y-4 p-4 bg-black/20 rounded-lg border border-purple-500/20">
          {messages.length === 0 && (
            <div className="text-center text-purple-300/70 italic">
              {selectedCard
                ? `Ask about ${selectedCard} or request a reading...`
                : 'Ask for a tarot reading or card guidance...'}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  message.type === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-800 border border-purple-500/30'
                }`}
              >
                {message.type === 'tarot' ? (
                  <div>
                    {formatTarotResponse(message.content)}
                    {message.cardInfo && (
                      <div className="mt-3 pt-3 border-t border-purple-500/30 text-xs text-purple-300/70">
                        {message.cardInfo.element && `Element: ${message.cardInfo.element} • `}
                        {message.cardInfo.planet && `Planet: ${message.cardInfo.planet} • `}
                        {message.cardInfo.chakra && `Chakra: ${message.cardInfo.chakra}`}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 border border-purple-500/30 p-3 rounded-lg">
                <Loader2 className="h-4 w-4 animate-spin text-purple-300" />
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex gap-2">
          <Textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={
              selectedCard
                ? `Ask about ${selectedCard} or request guidance...`
                : 'Ask for a tarot reading...'
            }
            className="flex-1 bg-black/20 border-purple-500/30 text-white placeholder-purple-300/50 resize-none"
            rows={2}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                handleSubmit(e)
              }
            }}
          />
          <Button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6"
          >
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ask'}
          </Button>
        </form>

        {sessionId && (
          <div className="text-xs text-purple-300/50 text-center">
            Session: {sessionId.slice(-8)}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
