'use client'

import React, { useState, useEffect } from 'react'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Database, Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface RAGToggleProps {
  enabled: boolean
  onToggle: (enabled: boolean) => void
  showStatus?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function RAGToggle({ enabled, onToggle, showStatus = true, size = 'md' }: RAGToggleProps) {
  const [isEnabled, setIsEnabled] = useState(enabled)

  useEffect(() => {
    setIsEnabled(enabled)
  }, [enabled])

  const handleToggle = (checked: boolean) => {
    setIsEnabled(checked)
    onToggle(checked)

    // Store preference in localStorage
    if (typeof window !== 'undefined') {
      localStorage.setItem('rag-enabled', JSON.stringify(checked))
    }
  }

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  }

  return (
    <div className="flex items-center gap-3">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex items-center gap-2">
              <Switch
                id="rag-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                className="data-[state=checked]:bg-purple-600"
              />
              <Label
                htmlFor="rag-toggle"
                className={`${sizeClasses[size]} font-medium cursor-pointer flex items-center gap-1.5`}
              >
                <Database className="w-4 h-4" />
                RAG Mode
              </Label>
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <p className="text-sm">
              <strong>Retrieval-Augmented Generation (RAG)</strong>
            </p>
            <p className="text-xs mt-1 text-muted-foreground">
              When enabled, the AI retrieves relevant historical knowledge from agent biographies
              and writings to provide more accurate, source-backed responses.
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {showStatus && (
        <Badge
          variant={isEnabled ? 'default' : 'outline'}
          className={`${sizeClasses[size]} ${
            isEnabled ? 'bg-purple-600 text-white border-purple-700' : 'text-muted-foreground'
          }`}
        >
          {isEnabled ? (
            <>
              <Sparkles className="w-3 h-3 mr-1" />
              Enhanced
            </>
          ) : (
            <>
              <Info className="w-3 h-3 mr-1" />
              Standard
            </>
          )}
        </Badge>
      )}
    </div>
  )
}
