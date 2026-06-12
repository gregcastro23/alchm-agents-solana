'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { BookOpen, ChevronDown, ChevronUp, FileText, Star } from 'lucide-react'

export interface RAGSource {
  id: string
  agentId: string
  agentName: string
  title: string
  content: string
  relevanceScore: number
  metadata?: {
    era?: string
    category?: string
    tags?: string[]
  }
}

interface SourceCitationsProps {
  sources: RAGSource[]
  retrievalTime?: number
  totalDocuments?: number
  variant?: 'compact' | 'detailed'
}

export function SourceCitations({
  sources,
  retrievalTime,
  totalDocuments,
  variant = 'detailed',
}: SourceCitationsProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set())

  const toggleSource = (sourceId: string) => {
    setExpandedSources(prev => {
      const next = new Set(prev)
      if (next.has(sourceId)) {
        next.delete(sourceId)
      } else {
        next.add(sourceId)
      }
      return next
    })
  }

  const formatRelevance = (score: number) => {
    const percentage = (score * 100).toFixed(1)
    return `${percentage}%`
  }

  const getRelevanceBadgeColor = (score: number) => {
    if (score >= 0.7) return 'bg-green-600 text-white'
    if (score >= 0.5) return 'bg-blue-600 text-white'
    if (score >= 0.35) return 'bg-yellow-600 text-white'
    return 'bg-gray-600 text-white'
  }

  if (sources.length === 0) {
    return null
  }

  if (variant === 'compact') {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <BookOpen className="w-3 h-3" />
        <span>
          {sources.length} source{sources.length !== 1 ? 's' : ''} retrieved
        </span>
        {retrievalTime && <span className="text-xs">• {retrievalTime}ms</span>}
      </div>
    )
  }

  return (
    <Card className="border-purple-200 bg-purple-50/50 dark:bg-purple-950/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <BookOpen className="w-4 h-4 text-purple-600" />
          Retrieved Knowledge Sources
          <Badge variant="outline" className="ml-auto">
            {sources.length} {sources.length === 1 ? 'source' : 'sources'}
          </Badge>
        </CardTitle>
        {retrievalTime && (
          <p className="text-xs text-muted-foreground">
            Retrieved in {retrievalTime}ms
            {totalDocuments && ` from ${totalDocuments} documents`}
          </p>
        )}
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-auto max-h-[400px]">
          <div className="space-y-3">
            {sources.map((source, index) => (
              <Collapsible
                key={source.id}
                open={expandedSources.has(source.id)}
                onOpenChange={() => toggleSource(source.id)}
              >
                <Card className="border-purple-200 hover:border-purple-300 transition-colors">
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      className="w-full justify-between p-4 h-auto hover:bg-purple-50/50"
                    >
                      <div className="flex items-start gap-3 text-left">
                        <div className="mt-1 flex items-center justify-center w-6 h-6 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <FileText className="w-3.5 h-3.5 text-purple-600 flex-shrink-0" />
                            <span className="font-medium text-sm truncate">{source.agentName}</span>
                          </div>
                          <p className="text-xs text-muted-foreground line-clamp-2">
                            {source.title}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            className={`${getRelevanceBadgeColor(source.relevanceScore)} text-xs`}
                          >
                            <Star className="w-2.5 h-2.5 mr-1" />
                            {formatRelevance(source.relevanceScore)}
                          </Badge>
                          {expandedSources.has(source.id) ? (
                            <ChevronUp className="w-4 h-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 pt-2 space-y-2">
                      <div className="text-sm text-muted-foreground bg-white dark:bg-gray-900 p-3 rounded-md border border-purple-100">
                        {source.content}
                      </div>
                      {source.metadata && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {source.metadata.era && (
                            <Badge variant="outline" className="text-xs">
                              {source.metadata.era}
                            </Badge>
                          )}
                          {source.metadata.category && (
                            <Badge variant="outline" className="text-xs">
                              {source.metadata.category}
                            </Badge>
                          )}
                          {source.metadata.tags?.map(tag => (
                            <Badge key={tag} variant="outline" className="text-xs bg-purple-50">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
