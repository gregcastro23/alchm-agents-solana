'use client'

import { useState } from 'react'
import { ThumbsUp, ThumbsDown, Star, MessageSquare, Send, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

export interface RAGFeedbackWidgetProps {
  queryId: string
  agentId: string
  agentName: string
  sessionId: string
  sourcesCount: number
  compact?: boolean
  className?: string
}

export function RAGFeedbackWidget({
  queryId,
  agentId,
  agentName,
  sessionId,
  sourcesCount,
  compact = true,
  className,
}: RAGFeedbackWidgetProps) {
  const [expanded, setExpanded] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [thumbsUp, setThumbsUp] = useState<boolean | null>(null)
  const [starRating, setStarRating] = useState<number>(0)
  const [sourcesHelpful, setSourcesHelpful] = useState(false)
  const [comment, setComment] = useState('')

  const handleThumbsClick = async (isPositive: boolean) => {
    setThumbsUp(isPositive)

    // If thumbs down, auto-expand to get more feedback
    if (!isPositive) {
      setExpanded(true)
    }

    // If thumbs up and compact mode, submit immediately
    if (isPositive && compact && !expanded) {
      await submitFeedback(isPositive, null, false, '')
    }
  }

  const handleStarClick = (rating: number) => {
    setStarRating(rating)
  }

  const submitFeedback = async (
    thumbs: boolean | null = thumbsUp,
    rating: number | null = starRating || null,
    helpful: boolean = sourcesHelpful,
    commentText: string = comment
  ) => {
    setIsSubmitting(true)

    try {
      const response = await fetch('/api/rag/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryId,
          agentId,
          sessionId,
          thumbsUp: thumbs,
          starRating: rating,
          sourcesHelpful: helpful,
          comment: commentText.trim() || null,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      setSubmitted(true)

      // Auto-collapse after 2 seconds
      setTimeout(() => {
        setExpanded(false)
      }, 2000)
    } catch (error) {
      console.error('[RAGFeedback] Error submitting feedback:', error)
      // Optionally show error toast
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    submitFeedback()
  }

  if (submitted) {
    return (
      <div
        className={cn(
          'flex items-center gap-2 text-sm text-green-600 dark:text-green-400',
          className
        )}
      >
        <Check className="w-4 h-4" />
        <span>Thank you for your feedback!</span>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Quick Feedback: Thumbs Up/Down */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">Was this helpful?</span>
        <div className="flex items-center gap-1">
          <Button
            variant={thumbsUp === true ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleThumbsClick(true)}
            disabled={isSubmitting}
            className="h-7 px-2"
          >
            <ThumbsUp className={cn('w-3.5 h-3.5', thumbsUp === true && 'fill-current')} />
          </Button>
          <Button
            variant={thumbsUp === false ? 'destructive' : 'ghost'}
            size="sm"
            onClick={() => handleThumbsClick(false)}
            disabled={isSubmitting}
            className="h-7 px-2"
          >
            <ThumbsDown className={cn('w-3.5 h-3.5', thumbsUp === false && 'fill-current')} />
          </Button>
        </div>

        {/* Expand button */}
        {!expanded && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(true)}
            className="h-7 px-2 text-xs"
          >
            <MessageSquare className="w-3.5 h-3.5 mr-1" />
            More feedback
          </Button>
        )}
      </div>

      {/* Expanded Feedback Form */}
      {expanded && (
        <div className="space-y-3 p-3 bg-muted/30 rounded-lg border border-border">
          {/* Star Rating */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Rate the response quality (1-5 stars)
            </label>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map(rating => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleStarClick(rating)}
                  disabled={isSubmitting}
                  className="focus:outline-none focus:ring-2 focus:ring-primary rounded"
                >
                  <Star
                    className={cn(
                      'w-5 h-5 transition-colors',
                      rating <= starRating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-muted-foreground hover:text-yellow-400'
                    )}
                  />
                </button>
              ))}
              {starRating > 0 && (
                <span className="ml-2 text-xs text-muted-foreground">
                  {starRating} star{starRating !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* Sources Helpful Checkbox */}
          {sourcesCount > 0 && (
            <div className="flex items-center gap-2">
              <Checkbox
                id={`sources-helpful-${queryId}`}
                checked={sourcesHelpful}
                onCheckedChange={checked => setSourcesHelpful(checked as boolean)}
                disabled={isSubmitting}
              />
              <label
                htmlFor={`sources-helpful-${queryId}`}
                className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                The {sourcesCount} source{sourcesCount !== 1 ? 's' : ''}{' '}
                {sourcesCount !== 1 ? 'were' : 'was'} helpful
              </label>
            </div>
          )}

          {/* Comment Field */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">
              Additional feedback (optional)
            </label>
            <Textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={`Tell us what you think about ${agentName}'s response...`}
              disabled={isSubmitting}
              className="min-h-[60px] text-sm resize-none"
              maxLength={500}
            />
            {comment.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">{comment.length}/500</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? (
                <>Submitting...</>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5 mr-1" />
                  Submit Feedback
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
