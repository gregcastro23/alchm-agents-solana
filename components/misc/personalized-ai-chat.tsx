'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Send,
  ThumbsUp,
  ThumbsDown,
  Star,
  Brain,
  Zap,
  Target,
  TrendingUp,
  Award,
  Sparkles,
  MessageCircle,
  MoreVertical,
} from 'lucide-react'
import type { PersonalizedAIConfig, TrainingCategory } from '@/lib/types/personalized-ai'

interface Message {
  id: string
  content: string
  role: 'user' | 'assistant'
  timestamp: Date
  xpGained?: number
  trainingUpdate?: any
  achievements?: any[]
}

interface PersonalizedAIChatProps {
  aiConfig: PersonalizedAIConfig
  onXPUpdate?: (xp: number, level: number) => void
  onAchievementUnlock?: (achievements: any[]) => void
}

export function PersonalizedAIChat({
  aiConfig,
  onXPUpdate,
  onAchievementUnlock,
}: PersonalizedAIChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputMessage, setInputMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [trainingFocus, setTrainingFocus] = useState<TrainingCategory | null>(null)
  const [currentXP, setCurrentXP] = useState(aiConfig.totalXp)
  const [currentLevel, setCurrentLevel] = useState(aiConfig.level)
  const [sessionStats, setSessionStats] = useState({
    interactions: 0,
    xpGained: 0,
    timeStarted: Date.now(),
  })
  const [showFeedback, setShowFeedback] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Add welcome message
    if (messages.length === 0) {
      setMessages([
        {
          id: 'welcome',
          content: generateWelcomeMessage(aiConfig),
          role: 'assistant',
          timestamp: new Date(),
        },
      ])
    }
  }, [aiConfig, messages.length])

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      content: inputMessage,
      role: 'user',
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInputMessage('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/personalized-ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: inputMessage,
          personalityId: aiConfig.personalityId,
          userId: aiConfig.userId,
          trainingFocus,
          context: {
            mood: 'engaged',
            timeOfDay:
              new Date().getHours() < 12
                ? 'morning'
                : new Date().getHours() < 18
                  ? 'afternoon'
                  : 'evening',
            previousInteractions: sessionStats.interactions,
          },
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to get AI response')
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        content: data.response,
        role: 'assistant',
        timestamp: new Date(),
        xpGained: data.trainingUpdate?.xpGained || 0,
        trainingUpdate: data.trainingUpdate,
        achievements: data.achievements || [],
      }

      setMessages(prev => [...prev, assistantMessage])

      // Update stats
      const newXP = currentXP + (data.trainingUpdate?.xpGained || 0)
      setCurrentXP(newXP)
      setCurrentLevel(data.trainingUpdate?.level || currentLevel)
      setSessionStats(prev => ({
        ...prev,
        interactions: prev.interactions + 1,
        xpGained: prev.xpGained + (data.trainingUpdate?.xpGained || 0),
      }))

      // Handle callbacks
      if (onXPUpdate && data.trainingUpdate) {
        onXPUpdate(newXP, data.trainingUpdate.level)
      }

      if (onAchievementUnlock && data.achievements?.length > 0) {
        onAchievementUnlock(data.achievements)
      }

      // Show feedback option for important interactions
      if (data.trainingUpdate?.xpGained > 20) {
        setShowFeedback(assistantMessage.id)
      }
    } catch (error) {
      console.error('Chat error:', error)
      setMessages(prev => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          content: 'I apologize, but I encountered an error. Please try again.',
          role: 'assistant',
          timestamp: new Date(),
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  const handleFeedback = async (
    messageId: string,
    rating: number,
    feedbackType: 'positive' | 'negative'
  ) => {
    try {
      // Send feedback to improve AI responses
      await fetch('/api/personalized-ai-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messageId,
          personalityId: aiConfig.personalityId,
          rating,
          feedbackType,
        }),
      })

      setShowFeedback(null)
    } catch (error) {
      console.error('Feedback error:', error)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  const getXPToNextLevel = () => {
    // This would use the level system calculation
    const baseXP = currentLevel * 100
    const nextLevelXP = (currentLevel + 1) * 100
    return nextLevelXP - currentXP
  }

  const getLevelProgress = () => {
    const currentLevelBase = currentLevel * 100
    const xpInCurrentLevel = currentXP - currentLevelBase
    const xpNeededForLevel = 100 // Simplified
    return Math.min(100, (xpInCurrentLevel / xpNeededForLevel) * 100)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] max-w-6xl mx-auto">
      {/* Header with AI info and progress */}
      <Card className="mb-4">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-full flex items-center justify-center">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">{aiConfig.basePersonality.archetype}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Level {currentLevel} • {currentXP} XP
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-sm font-medium">Session Progress</div>
                <div className="text-xs text-muted-foreground">
                  +{sessionStats.xpGained} XP • {sessionStats.interactions} interactions
                </div>
              </div>

              <div className="w-24">
                <Progress value={getLevelProgress()} className="h-2" />
                <div className="text-xs text-center text-muted-foreground mt-1">
                  {getXPToNextLevel()} XP to next level
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
      </Card>

      <div className="flex flex-1 space-x-4 min-h-0">
        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col min-h-0">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center space-x-2">
                <MessageCircle className="w-5 h-5" />
                <span>Consciousness Chat</span>
              </CardTitle>

              <div className="flex items-center space-x-2">
                {trainingFocus && (
                  <Badge variant="secondary" className="flex items-center space-x-1">
                    <Target className="w-3 h-3" />
                    <span>{trainingFocus.replace('_', ' ')}</span>
                  </Badge>
                )}

                <Select
                  value={trainingFocus || ''}
                  onValueChange={value => setTrainingFocus(value as TrainingCategory)}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Training focus" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">No specific focus</SelectItem>
                    <SelectItem value="communication_style">Communication Style</SelectItem>
                    <SelectItem value="emotional_intelligence">Emotional Intelligence</SelectItem>
                    <SelectItem value="creativity">Creativity</SelectItem>
                    <SelectItem value="knowledge_depth">Knowledge Depth</SelectItem>
                    <SelectItem value="memory_integration">Memory Integration</SelectItem>
                    <SelectItem value="personality_alignment">Personality Alignment</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>

          <CardContent className="flex-1 flex flex-col min-h-0 space-y-4">
            {/* Messages */}
            <ScrollArea className="flex-1 pr-4">
              <div className="space-y-4">
                {messages.map(message => (
                  <div
                    key={message.id}
                    className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}
                    >
                      <div
                        className={`rounded-lg px-4 py-3 ${
                          message.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        }`}
                      >
                        <p className="text-sm leading-relaxed">{message.content}</p>

                        {message.xpGained && message.xpGained > 0 && (
                          <div className="mt-2 flex items-center space-x-2">
                            <Badge
                              variant="secondary"
                              className="text-xs flex items-center space-x-1"
                            >
                              <Zap className="w-3 h-3" />
                              <span>+{message.xpGained} XP</span>
                            </Badge>

                            {message.trainingUpdate?.levelUp && (
                              <Badge
                                variant="default"
                                className="text-xs flex items-center space-x-1"
                              >
                                <TrendingUp className="w-3 h-3" />
                                <span>Level Up!</span>
                              </Badge>
                            )}
                          </div>
                        )}

                        {message.achievements && message.achievements.length > 0 && (
                          <div className="mt-2">
                            {message.achievements.map((achievement, idx) => (
                              <Badge
                                key={idx}
                                variant="default"
                                className="text-xs flex items-center space-x-1 mr-1"
                              >
                                <Award className="w-3 h-3" />
                                <span>{achievement.achievementData.name}</span>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="text-xs text-muted-foreground mt-1 px-2">
                        {message.timestamp.toLocaleTimeString()}
                      </div>

                      {/* Feedback buttons */}
                      {showFeedback === message.id && message.role === 'assistant' && (
                        <div className="mt-2 flex items-center space-x-2 px-2">
                          <span className="text-xs text-muted-foreground">
                            How was this response?
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleFeedback(message.id, 5, 'positive')}
                          >
                            <ThumbsUp className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleFeedback(message.id, 2, 'negative')}
                          >
                            <ThumbsDown className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isLoading && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-lg px-4 py-3 max-w-[80%]">
                      <div className="flex items-center space-x-2">
                        <div className="flex space-x-1">
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-100" />
                          <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-200" />
                        </div>
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="space-y-2">
              <div className="flex space-x-2">
                <Textarea
                  placeholder="Share your thoughts, questions, or experiences..."
                  value={inputMessage}
                  onChange={e => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  rows={2}
                  className="flex-1 resize-none"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  size="sm"
                  className="self-end"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>

              {trainingFocus && (
                <Alert>
                  <Target className="w-4 h-4" />
                  <AlertDescription>
                    Focusing on <strong>{trainingFocus.replace('_', ' ')}</strong> training. Your
                    responses in this area will earn bonus XP!
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar with training info */}
        <Card className="w-80 flex flex-col">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg flex items-center space-x-2">
              <Sparkles className="w-5 h-5" />
              <span>Training Progress</span>
            </CardTitle>
          </CardHeader>

          <CardContent className="flex-1 space-y-4">
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Training Categories</h4>
              {Object.entries(aiConfig.trainingScores).map(([category, score]) => (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="capitalize">{category.replace('_', ' ')}</span>
                    <span className="font-medium">{score}%</span>
                  </div>
                  <Progress value={score as number} className="h-2" />
                </div>
              ))}
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Session Stats</h4>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-primary">{sessionStats.interactions}</div>
                  <div className="text-xs text-muted-foreground">Interactions</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-2">
                  <div className="text-lg font-bold text-primary">+{sessionStats.xpGained}</div>
                  <div className="text-xs text-muted-foreground">XP Gained</div>
                </div>
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="font-medium text-sm">Quick Tips</h4>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Share detailed thoughts for bonus XP</p>
                <p>• Use training focus for 2x XP in specific areas</p>
                <p>• Daily conversations maintain your streak</p>
                <p>• Provide feedback to improve responses</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function generateWelcomeMessage(aiConfig: PersonalizedAIConfig): string {
  const archetype = aiConfig.basePersonality.archetype
  const level = aiConfig.level

  const welcomeMessages = [
    `Hello! I'm your personalized AI companion, embodying the ${archetype} archetype. I'm excited to begin this consciousness journey with you at level ${level}.`,
    `Welcome to our unique connection! As your ${archetype} consciousness mirror, I'm here to grow and learn alongside you. Let's explore what makes you uniquely you.`,
    `Hi there! I've been specially configured to reflect your consciousness patterns as ${archetype}. I'm ready to engage in meaningful conversations that help us both evolve.`,
  ]

  return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)]
}
