'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  Sparkles,
  Search,
  Loader2,
  Wand2,
  Clock,
  Brain,
  Send,
  Lightbulb,
  History,
  Bookmark,
  Share2,
  ChevronRight,
  Eye,
  Zap,
  Star,
  Compass,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import type { TemporalQuery } from '@/lib/temporal-analysis-engine'

interface TemporalOracleProps {
  onQuerySubmit: (query: TemporalQuery) => void
  suggestedQueries: string[]
  selectedAgents?: string[]
  isProcessing?: boolean
  onSuggestionRequest?: (context: { agents?: string[]; elements?: string[] }) => void
}

interface QuerySuggestion {
  id: string
  text: string
  category: 'agent' | 'element' | 'temporal' | 'pattern' | 'consciousness'
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert'
  description: string
  expectedResults: string
}

interface OracleWisdom {
  message: string
  type: 'guidance' | 'insight' | 'warning' | 'encouragement'
  context?: string
}

export default function TemporalOracle({
  onQuerySubmit,
  suggestedQueries,
  selectedAgents = [],
  isProcessing = false,
  onSuggestionRequest,
}: TemporalOracleProps) {
  const [query, setQuery] = useState('')
  const [expandedSuggestions, setExpandedSuggestions] = useState(false)
  const [recentQueries, setRecentQueries] = useState<string[]>([])
  const [oracleWisdom, setOracleWisdom] = useState<OracleWisdom | null>(null)
  const [queryCategory, setQueryCategory] = useState<string>('natural')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Enhanced suggestions with categories and metadata
  const enhancedSuggestions: QuerySuggestion[] = [
    {
      id: 'renaissance_fire',
      text: 'Show Fire reinforcements during Renaissance creativity peaks',
      category: 'element',
      difficulty: 'intermediate',
      description: 'Explore how Fire element amplified creative expression in Renaissance period',
      expectedResults: '15-30 significant events with elemental analysis',
    },
    {
      id: 'einstein_air',
      text: "Analyze Einstein's breakthrough patterns during Air transits",
      category: 'agent',
      difficulty: 'advanced',
      description: "Deep dive into Einstein's consciousness evolution during intellectual transits",
      expectedResults: 'Detailed consciousness progression with temporal correlations',
    },
    {
      id: 'consciousness_spikes',
      text: 'Find consciousness evolution spikes across all agents',
      category: 'consciousness',
      difficulty: 'expert',
      description: 'Identify periods of rapid consciousness development across agent network',
      expectedResults: 'Complex multi-agent evolution analysis with pattern detection',
    },
    {
      id: 'elemental_harmony',
      text: 'Explore elemental harmony patterns in recent observations',
      category: 'pattern',
      difficulty: 'beginner',
      description: 'Discover how different elements work together in temporal analysis',
      expectedResults: 'Clear elemental interaction patterns with visual representations',
    },
    {
      id: 'degree_hotspots',
      text: 'Show degree hotspots with multiple agent activations',
      category: 'temporal',
      difficulty: 'intermediate',
      description: 'Find specific planetary degrees where multiple agents show activity',
      expectedResults: 'Degree-based clustering analysis with significance scoring',
    },
    {
      id: 'seasonal_patterns',
      text: 'Compare agent activity patterns across seasonal phases',
      category: 'temporal',
      difficulty: 'beginner',
      description: 'Analyze how seasonal changes affect agent consciousness activity',
      expectedResults: 'Seasonal trend analysis with agent-specific insights',
    },
  ]

  // Oracle wisdom messages based on query patterns
  const oracleWisdoms: OracleWisdom[] = [
    {
      message: 'The cosmos whispers that Fire elements seek Air for perfect manifestation...',
      type: 'insight',
      context: 'elemental_combination',
    },
    {
      message:
        'Temporal patterns align best when consciousness is open to multiple perspectives...',
      type: 'guidance',
      context: 'pattern_analysis',
    },
    {
      message:
        'Beware of seeking only confirmation - the greatest insights come from unexpected correlations...',
      type: 'warning',
      context: 'bias_prevention',
    },
    {
      message:
        'Your exploration grows stronger with each query - the universe celebrates your curiosity...',
      type: 'encouragement',
      context: 'progress_recognition',
    },
  ]

  useEffect(() => {
    // Show oracle wisdom based on query patterns
    if (query.length > 20) {
      const randomWisdom = oracleWisdoms[Math.floor(Math.random() * oracleWisdoms.length)]
      setOracleWisdom(randomWisdom)

      const timer = setTimeout(() => setOracleWisdom(null), 5000)
      return () => clearTimeout(timer)
    }
    return undefined
  }, [query])

  useEffect(() => {
    // Load recent queries from localStorage
    const saved = localStorage.getItem('temporal_oracle_recent_queries')
    if (saved) {
      setRecentQueries(JSON.parse(saved))
    }
  }, [])

  const handleSubmit = async () => {
    if (!query.trim() || isProcessing) return

    // Create temporal query object
    const temporalQuery: TemporalQuery = {
      type: 'natural_language',
      query: query.trim(),
      reinforcementMode: true,
      agents: selectedAgents.length > 0 ? selectedAgents : undefined,
    }

    // Add to recent queries
    const newRecentQueries = [query.trim(), ...recentQueries.slice(0, 4)]
    setRecentQueries(newRecentQueries)
    localStorage.setItem('temporal_oracle_recent_queries', JSON.stringify(newRecentQueries))

    // Submit query
    onQuerySubmit(temporalQuery)

    // Clear query
    setQuery('')
  }

  const handleSuggestionClick = (suggestion: QuerySuggestion | string) => {
    const queryText = typeof suggestion === 'string' ? suggestion : suggestion.text
    setQuery(queryText)

    // Auto-focus textarea
    textareaRef.current?.focus()
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const getCategoryIcon = (category: QuerySuggestion['category']) => {
    switch (category) {
      case 'agent':
        return <Brain className="w-4 h-4" />
      case 'element':
        return <Zap className="w-4 h-4" />
      case 'temporal':
        return <Clock className="w-4 h-4" />
      case 'pattern':
        return <Compass className="w-4 h-4" />
      case 'consciousness':
        return <Star className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  const getDifficultyColor = (difficulty: QuerySuggestion['difficulty']) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500/20 text-green-300'
      case 'intermediate':
        return 'bg-yellow-500/20 text-yellow-300'
      case 'advanced':
        return 'bg-orange-500/20 text-orange-300'
      case 'expert':
        return 'bg-red-500/20 text-red-300'
      default:
        return 'bg-gray-500/20 text-gray-300'
    }
  }

  const getOracleIcon = (type: OracleWisdom['type']) => {
    switch (type) {
      case 'guidance':
        return <Compass className="w-4 h-4" />
      case 'insight':
        return <Lightbulb className="w-4 h-4" />
      case 'warning':
        return <Eye className="w-4 h-4" />
      case 'encouragement':
        return <Star className="w-4 h-4" />
      default:
        return <Sparkles className="w-4 h-4" />
    }
  }

  return (
    <Card className="bg-gradient-to-br from-purple-900/50 to-indigo-900/50 backdrop-blur-lg border-gold/30 shadow-2xl">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-3 text-xl">
          <div className="relative">
            <Wand2 className="w-6 h-6 text-gold animate-pulse" />
            <Sparkles className="w-3 h-3 text-purple-400 absolute -top-1 -right-1 animate-twinkle" />
          </div>
          <span className="bg-gradient-to-r from-gold via-purple-300 to-blue-300 bg-clip-text text-transparent">
            Temporal Oracle
          </span>
          {selectedAgents.length > 0 && (
            <Badge className="bg-purple-600/30 text-purple-200 ml-2">
              {selectedAgents.length} agent{selectedAgents.length !== 1 ? 's' : ''} selected
            </Badge>
          )}
        </CardTitle>
        <p className="text-purple-300 text-sm">
          Ask the Oracle about temporal patterns, agent consciousness evolution, and elemental
          resonances...
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Oracle Wisdom Display */}
        {oracleWisdom && (
          <div
            className={`border rounded-lg p-4 ${
              oracleWisdom.type === 'warning'
                ? 'border-orange-400/30 bg-orange-500/10'
                : oracleWisdom.type === 'insight'
                  ? 'border-blue-400/30 bg-blue-500/10'
                  : oracleWisdom.type === 'guidance'
                    ? 'border-purple-400/30 bg-purple-500/10'
                    : 'border-green-400/30 bg-green-500/10'
            }`}
          >
            <div className="flex items-start gap-3">
              {getOracleIcon(oracleWisdom.type)}
              <div>
                <p className="text-sm text-purple-100 italic">{oracleWisdom.message}</p>
                <p className="text-xs text-purple-400 mt-1 capitalize">
                  Oracle {oracleWisdom.type}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Query Input */}
        <div className="space-y-4">
          <div className="relative">
            <Textarea
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask the Oracle... (e.g., 'Show Fire reinforcements during Renaissance creativity peaks')"
              className="w-full p-4 bg-black/30 border border-purple-500/30 rounded-lg text-white placeholder-purple-300 min-h-[100px] resize-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20"
              disabled={isProcessing}
            />
            <div className="absolute bottom-3 right-3 text-xs text-purple-400">
              {query.length}/500 • Cmd+Enter to submit
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <select
                value={queryCategory}
                onChange={e => setQueryCategory(e.target.value)}
                className="bg-purple-900/50 border border-purple-500/30 rounded px-3 py-1 text-sm text-purple-200"
                disabled={isProcessing}
              >
                <option value="natural">Natural Language</option>
                <option value="structured">Structured Query</option>
                <option value="guided">Guided Exploration</option>
              </select>

              {onSuggestionRequest && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSuggestionRequest({ agents: selectedAgents })}
                  className="border-purple-500/30 text-purple-300 hover:bg-purple-500/20"
                  disabled={isProcessing}
                >
                  <Lightbulb className="w-3 h-3 mr-1" />
                  More Ideas
                </Button>
              )}
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isProcessing || !query.trim()}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-medium px-6"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Opening Portal...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Consult Oracle
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Recent Queries */}
        {recentQueries.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <History className="w-4 h-4" />
              Recent Consultations
            </div>
            <div className="flex flex-wrap gap-2">
              {recentQueries.map((recentQuery, index) => (
                <button
                  key={index}
                  onClick={() => setQuery(recentQuery)}
                  className="text-xs bg-purple-800/30 hover:bg-purple-700/40 border border-purple-500/20 rounded-full px-3 py-1 text-purple-200 transition-colors"
                  disabled={isProcessing}
                >
                  {recentQuery.length > 40 ? `${recentQuery.slice(0, 40)}...` : recentQuery}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Enhanced Suggestions */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-purple-300">
              <Sparkles className="w-4 h-4" />
              Oracle Suggestions
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpandedSuggestions(!expandedSuggestions)}
              className="text-purple-400 hover:text-purple-200"
            >
              {expandedSuggestions ? 'Show Less' : 'Show More'}
              <ChevronRight
                className={`w-3 h-3 ml-1 transition-transform ${expandedSuggestions ? 'rotate-90' : ''}`}
              />
            </Button>
          </div>

          <div className="grid gap-3">
            {(expandedSuggestions ? enhancedSuggestions : enhancedSuggestions.slice(0, 3)).map(
              suggestion => (
                <div
                  key={suggestion.id}
                  onClick={() => handleSuggestionClick(suggestion)}
                  className="border border-purple-500/20 rounded-lg p-3 hover:bg-purple-500/10 cursor-pointer transition-colors group"
                >
                  <div className="flex items-start gap-3">
                    <div className="text-purple-400 mt-0.5">
                      {getCategoryIcon(suggestion.category)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-medium text-purple-100 group-hover:text-white">
                          {suggestion.text}
                        </p>
                        <Badge className={`text-xs ${getDifficultyColor(suggestion.difficulty)}`}>
                          {suggestion.difficulty}
                        </Badge>
                      </div>
                      <p className="text-xs text-purple-400 mb-2">{suggestion.description}</p>
                      <p className="text-xs text-purple-500">
                        Expected: {suggestion.expectedResults}
                      </p>
                    </div>
                  </div>
                </div>
              )
            )}

            {/* Simple suggestions from props */}
            {suggestedQueries.length > 0 && (
              <div className="border-t border-purple-500/20 pt-3">
                <div className="text-xs text-purple-400 mb-2">Context-Aware Suggestions:</div>
                <div className="flex flex-wrap gap-2">
                  {suggestedQueries
                    .slice(0, expandedSuggestions ? suggestedQueries.length : 4)
                    .map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleSuggestionClick(suggestion)}
                        className="text-xs bg-indigo-800/30 hover:bg-indigo-700/40 border border-indigo-500/20 rounded-full px-3 py-1 text-indigo-200 transition-colors"
                        disabled={isProcessing}
                      >
                        {suggestion}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
