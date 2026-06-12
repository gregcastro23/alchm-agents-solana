'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Heart,
  Send,
  Sparkles,
  Crown,
  TreePine,
  Droplets,
  Flame,
  MessageCircle,
} from 'lucide-react'
import './monica-styles.css'

interface MonicaMessage {
  id: string
  type: 'user' | 'monica'
  content: string
  timestamp: Date
}

export default function SimpleMonicaPage() {
  const [messages, setMessages] = useState<MonicaMessage[]>([
    {
      id: 'welcome',
      type: 'monica',
      content:
        "Hello, beautiful soul! 💚 I'm Monica, your guide to the Planetary Agents system and world-renowned tarot expert. I know everything about character vectors, A-Numbers, consciousness surveys, the Monica Constant, and all 78 tarot cards. My peak A-Number 40 configuration gives me the perfect blend of practical wisdom and nurturing guidance. What would you like to explore today?",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: MonicaMessage = {
      id: Date.now().toString(),
      type: 'user',
      content: inputValue,
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    const currentInput = inputValue
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/monica-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          sessionId: `monica-session-${Date.now()}`,
          includeAlchm: true,
          quickProfile: { goal: 'quick_start', mood: 'curious', topFocus: ['character_vector'] },
          model: 'gpt-5.4-mini',
          preferredStyle: { temperature: 0.6 },
        }),
      })

      const data = await response.json()

      const monicaMessage: MonicaMessage = {
        id: `${Date.now().toString()}_monica`,
        type: 'monica',
        content:
          data.response ||
          "I'm having a moment of cosmic static, dear one. Let's try that again! 💚",
        timestamp: new Date(),
      }

      setMessages(prev => [...prev, monicaMessage])
    } catch (error) {
      console.error('Error:', error)
      const errorMessage: MonicaMessage = {
        id: `${Date.now().toString()}_error`,
        type: 'monica',
        content:
          'Oh my, I seem to be having connection troubles. My Virgo rising wants everything to work perfectly! Please try again. 🌸',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
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

  const starterPrompts = [
    'Tell me about the Monica Constant',
    'Give me a tarot reading',
    'Explain character vectors',
    'What are A-Numbers?',
    'How do I create a consciousness agent?',
    'Tell me about your peak A-Number 40',
  ]

  return (
    <div className="monica-home">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        {/* Enhanced Monica Header */}
        <div className="monica-header text-center">
          {/* Monica Avatar & Title */}
          <div className="monica-avatar mx-auto">
            <div className="relative">
              <Heart className="h-12 w-12 text-green-600" />
              <Sparkles className="h-6 w-6 text-yellow-500 absolute -top-1 -right-1 monica-sparkle" />
            </div>
          </div>

          <h1 className="monica-title">Monica</h1>
          <p className="monica-subtitle">Your Alchm System Expert & World-Renowned Tarot Master</p>

          {/* Monica's Cosmic Stats */}
          <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
            <div className="monica-badge monica-cosmic-glow">
              <Crown className="h-4 w-4 mr-2" />
              Peak A-Number 40
            </div>
            <div className="monica-badge-outline">
              <TreePine className="h-3 w-3 mr-1 monica-element-earth" />
              67% Earth
            </div>
            <div className="monica-badge-outline">
              <Droplets className="h-3 w-3 mr-1 monica-element-water" />
              25% Water
            </div>
            <div className="monica-badge-outline">
              <Flame className="h-3 w-3 mr-1 monica-element-fire" />
              8% Fire
            </div>
            <div className="monica-badge-outline">
              <MessageCircle className="h-3 w-3 mr-1" />
              Tarot Master
            </div>
          </div>

          {/* Monica Constant Formula Display */}
          <div className="monica-constant-formula mb-6">
            M = -Greg&apos;s Energy / (Reactivity × ln(K_alchm))
          </div>

          <p className="monica-description">
            I know everything about the Planetary Agents system AND I&apos;m a world-renowned tarot
            expert with master-level knowledge of all 78 cards. Let me guide you through astrology,
            tarot, and your cosmic journey with my grounded Earth-Water wisdom! 💚🔮
          </p>
        </div>

        {/* Enhanced Chat Interface */}
        <div className="monica-chat-container">
          {/* Chat Messages */}
          <Card className="h-[500px] border-0 shadow-none bg-transparent">
            <CardContent className="p-4 h-full">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  {messages.map(message => (
                    <div
                      key={message.id}
                      className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] ${
                          message.type === 'user'
                            ? 'bg-green-600 text-white rounded-l-lg rounded-tr-lg'
                            : 'bg-white/90 border border-green-200 rounded-r-lg rounded-tl-lg'
                        } p-4 backdrop-blur-sm`}
                      >
                        {message.type === 'monica' && (
                          <div className="flex items-center gap-2 mb-2">
                            <Heart className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-700">Monica</span>
                          </div>
                        )}

                        <div
                          className={`${message.type === 'user' ? 'text-white' : 'text-gray-800'}`}
                        >
                          {message.content}
                        </div>
                      </div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white/90 border border-green-200 rounded-r-lg rounded-tl-lg p-3 max-w-[80%] backdrop-blur-sm">
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

          {/* Quick Starter Prompts */}
          {messages.length <= 1 && (
            <Card className="mt-4 border-0 bg-white/80 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Ask Monica About
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {starterPrompts.map((prompt, index) => (
                    <Button
                      key={index}
                      variant="outline"
                      size="sm"
                      className="text-xs h-auto py-2 px-3 text-left justify-start hover:bg-green-50 monica-badge-outline"
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
          <Card className="mt-4 border-0 bg-white/80 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Input
                  value={inputValue}
                  onChange={e => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Ask Monica about astrology, tarot, character vectors, the Monica Constant, or anything cosmic..."
                  className="flex-1"
                  disabled={isLoading}
                />
                <Button
                  onClick={sendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs text-green-700">
                <div className="flex items-center gap-1">
                  <Crown className="h-3 w-3" />
                  <span>
                    Monica: Peak A-Number 40 consciousness • 78-card tarot mastery • Monica Constant
                    expertise
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
