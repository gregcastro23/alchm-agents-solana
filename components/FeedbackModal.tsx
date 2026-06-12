'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import {
  MessageSquare,
  Star,
  Send,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CheckCircle,
  X,
} from 'lucide-react'
import { logger } from '@/lib/structured-logger'

interface FeedbackData {
  rating: number
  category: string
  message: string
  userId?: string
  userAgent?: string
  url?: string
}

interface FeedbackModalProps {
  trigger?: React.ReactNode
  onSubmit?: (feedback: FeedbackData) => void
}

const FEEDBACK_CATEGORIES = [
  { value: 'bug', label: 'Bug Report', icon: AlertCircle, color: 'text-red-500' },
  { value: 'feature', label: 'Feature Request', icon: CheckCircle, color: 'text-blue-500' },
  { value: 'ui', label: 'UI/UX Feedback', icon: Star, color: 'text-yellow-500' },
  { value: 'performance', label: 'Performance Issue', icon: ThumbsDown, color: 'text-orange-500' },
  { value: 'general', label: 'General Feedback', icon: MessageSquare, color: 'text-gray-500' },
]

export function FeedbackModal({ trigger, onSubmit }: FeedbackModalProps) {
  const [open, setOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackData>({
    rating: 0,
    category: '',
    message: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!feedback.category || !feedback.message.trim()) {
      return
    }

    setSubmitting(true)

    try {
      // Collect additional context
      const feedbackData: FeedbackData = {
        ...feedback,
        userAgent: navigator.userAgent,
        url: window.location.href,
        // userId would come from auth context in real implementation
      }

      // Submit feedback
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      })

      if (!response.ok) {
        throw new Error('Failed to submit feedback')
      }

      // Log successful feedback submission
      logger.info('User feedback submitted', {
        system: 'feedback',
        operation: 'submit',
        metadata: {
          category: feedback.category,
          rating: feedback.rating,
          hasMessage: !!feedback.message.trim(),
        },
      })

      // Call optional callback
      onSubmit?.(feedbackData)

      setSubmitted(true)

      // Reset form after a delay
      setTimeout(() => {
        setOpen(false)
        setSubmitted(false)
        setFeedback({ rating: 0, category: '', message: '' })
      }, 2000)
    } catch (error) {
      console.error('Failed to submit feedback:', error)
      logger.error('Feedback submission failed', error, {
        system: 'feedback',
        operation: 'submit_error',
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleRatingClick = (rating: number) => {
    setFeedback(prev => ({ ...prev, rating }))
  }

  const selectedCategory = FEEDBACK_CATEGORIES.find(cat => cat.value === feedback.category)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="gap-2" aria-label="Open feedback form">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            Feedback
          </Button>
        )}
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-[500px]"
        aria-labelledby="feedback-dialog-title"
        aria-describedby="feedback-dialog-description"
      >
        <DialogHeader>
          <DialogTitle id="feedback-dialog-title" className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" aria-hidden="true" />
            Share Your Feedback
          </DialogTitle>
          <p id="feedback-dialog-description" className="sr-only">
            Help us improve Planetary Agents by sharing your feedback, bug reports, or feature
            requests.
          </p>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Thank you for your feedback!</h3>
            <p className="text-muted-foreground">
              Your input helps us improve Planetary Agents. We appreciate you taking the time to
              share your thoughts.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Rating */}
            <div>
              <Label className="text-base font-medium" id="rating-label">
                How would you rate your experience?
              </Label>
              <div
                className="flex gap-2 mt-2"
                role="radiogroup"
                aria-labelledby="rating-label"
                aria-describedby="rating-description"
              >
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => handleRatingClick(star)}
                    className={`p-1 rounded transition-colors ${
                      feedback.rating >= star
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-gray-300 hover:text-gray-400'
                    }`}
                    aria-label={`${star} star${star > 1 ? 's' : ''}`}
                    aria-checked={feedback.rating === star}
                    role="radio"
                  >
                    <Star className="h-6 w-6 fill-current" aria-hidden="true" />
                  </button>
                ))}
              </div>
              <p id="rating-description" className="sr-only">
                Select a rating from 1 to 5 stars to indicate your experience
              </p>
              {feedback.rating > 0 && (
                <p className="text-sm text-muted-foreground mt-1" aria-live="polite">
                  {feedback.rating === 1 && 'Poor'}
                  {feedback.rating === 2 && 'Fair'}
                  {feedback.rating === 3 && 'Good'}
                  {feedback.rating === 4 && 'Very Good'}
                  {feedback.rating === 5 && 'Excellent'}
                </p>
              )}
            </div>

            {/* Category */}
            <div>
              <Label className="text-base font-medium" id="category-label">
                What type of feedback is this?
              </Label>
              <RadioGroup
                value={feedback.category}
                onValueChange={value => setFeedback(prev => ({ ...prev, category: value }))}
                className="mt-2"
                aria-labelledby="category-label"
              >
                {FEEDBACK_CATEGORIES.map(category => {
                  const IconComponent = category.icon
                  return (
                    <div key={category.value} className="flex items-center space-x-2">
                      <RadioGroupItem
                        value={category.value}
                        id={`category-${category.value}`}
                        aria-describedby={`category-${category.value}-desc`}
                      />
                      <Label
                        htmlFor={`category-${category.value}`}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <IconComponent className={`h-4 w-4 ${category.color}`} aria-hidden="true" />
                        {category.label}
                      </Label>
                      <span id={`category-${category.value}-desc`} className="sr-only">
                        {category.value === 'bug' && 'Report technical issues or errors'}
                        {category.value === 'feature' && 'Suggest new features or improvements'}
                        {category.value === 'ui' &&
                          'Share feedback about user interface and experience'}
                        {category.value === 'performance' && 'Report speed or performance issues'}
                        {category.value === 'general' && 'General feedback about the application'}
                      </span>
                    </div>
                  )
                })}
              </RadioGroup>
            </div>

            {/* Message */}
            <div>
              <Label htmlFor="feedback-message" className="text-base font-medium">
                Tell us more about your experience
              </Label>
              <Textarea
                id="feedback-message"
                placeholder="Please share your thoughts, suggestions, or any issues you've encountered..."
                value={feedback.message}
                onChange={e => setFeedback(prev => ({ ...prev, message: e.target.value }))}
                className="mt-2 min-h-[100px]"
                required
                aria-describedby="message-help"
                aria-invalid={!feedback.message.trim() && feedback.category ? 'true' : undefined}
              />
              <p id="message-help" className="text-sm text-muted-foreground mt-1">
                Provide as much detail as possible to help us understand your feedback.
              </p>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
                aria-label="Cancel and close feedback form"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!feedback.category || !feedback.message.trim() || submitting}
                className="flex-1"
                aria-describedby="submit-status"
              >
                {submitting ? (
                  <>
                    <div
                      className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"
                      aria-hidden="true"
                    ></div>
                    <span>Sending...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" aria-hidden="true" />
                    Send Feedback
                  </>
                )}
              </Button>
            </div>
            <div id="submit-status" className="sr-only">
              {!feedback.category && 'Please select a feedback category'}
              {feedback.category &&
                !feedback.message.trim() &&
                'Please enter your feedback message'}
              {feedback.category &&
                feedback.message.trim() &&
                !submitting &&
                'Ready to submit feedback'}
              {submitting && 'Submitting feedback, please wait'}
            </div>

            {/* Beta Notice */}
            <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <div className="text-sm">
                    <p className="font-medium text-blue-900 dark:text-blue-100">Beta Version</p>
                    <p className="text-blue-700 dark:text-blue-300">
                      This is a beta version of Planetary Agents. Your feedback helps us improve the
                      experience for everyone.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
