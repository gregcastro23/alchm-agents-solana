'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Star } from 'lucide-react'
import type { SurveyQuestion } from '@/lib/types/consciousness-survey'

interface SurveyQuestionComponentProps {
  question: SurveyQuestion
  value?: string | number | string[]
  confidence?: number
  onChange: (value: string | number | string[], confidence?: number) => void
}

export function SurveyQuestionComponent({
  question,
  value,
  confidence,
  onChange,
}: SurveyQuestionComponentProps) {
  const [localConfidence, setLocalConfidence] = useState<number>(confidence || 3)

  const handleValueChange = (newValue: string | number | string[]) => {
    onChange(newValue, localConfidence)
  }

  const handleConfidenceChange = (newConfidence: number) => {
    setLocalConfidence(newConfidence)
    onChange(value || '', newConfidence)
  }

  // Scale Question (1-7 Likert scale)
  if (question.type === 'scale') {
    const scaleValue = typeof value === 'number' ? value : question.min || 1

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{getScaleLabel(question.id, 'min')}</span>
            <span>{getScaleLabel(question.id, 'max')}</span>
          </div>

          <div className="px-4">
            <Slider
              value={[scaleValue]}
              onValueChange={values => handleValueChange(values[0])}
              min={question.min || 1}
              max={question.max || 7}
              step={1}
              className="w-full"
            />
          </div>

          <div className="flex justify-between text-xs text-muted-foreground">
            {Array.from({ length: (question.max || 7) - (question.min || 1) + 1 }, (_, i) => (
              <span key={i} className="text-center">
                {(question.min || 1) + i}
              </span>
            ))}
          </div>

          <div className="text-center">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {scaleValue}
            </Badge>
          </div>
        </div>

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  // Choice Question (Single selection)
  if (question.type === 'choice' && question.options) {
    return (
      <div className="space-y-6">
        <RadioGroup
          value={typeof value === 'string' ? value : ''}
          onValueChange={handleValueChange}
          className="space-y-3"
        >
          {question.options.map((option, index) => (
            <div key={index} className="flex items-start space-x-3">
              <RadioGroupItem value={option} id={`option-${index}`} className="mt-1" />
              <Label
                htmlFor={`option-${index}`}
                className="flex-1 text-sm leading-relaxed cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </RadioGroup>

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  // Multi-select Question
  if (question.type === 'multi' && question.options) {
    const selectedValues = Array.isArray(value) ? value : []

    const handleMultiChange = (option: string, checked: boolean) => {
      let newValues = [...selectedValues]
      if (checked) {
        if (!newValues.includes(option)) {
          newValues.push(option)
        }
      } else {
        newValues = newValues.filter(v => v !== option)
      }
      handleValueChange(newValues)
    }

    return (
      <div className="space-y-6">
        <div className="grid gap-3">
          {question.options.map((option, index) => (
            <div key={index} className="flex items-start space-x-3">
              <Checkbox
                id={`multi-option-${index}`}
                checked={selectedValues.includes(option)}
                onCheckedChange={checked => handleMultiChange(option, !!checked)}
              />
              <Label
                htmlFor={`multi-option-${index}`}
                className="flex-1 text-sm leading-relaxed cursor-pointer"
              >
                {option}
              </Label>
            </div>
          ))}
        </div>

        {selectedValues.length > 0 && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <div className="text-sm font-medium mb-2">Selected ({selectedValues.length}):</div>
            <div className="flex flex-wrap gap-1">
              {selectedValues.map((selected, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {selected}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  // Text Question
  if (question.type === 'text') {
    const currentLength = typeof value === 'string' ? value.length : 0
    const maxLength = question.maxLength || 1000

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <Textarea
            placeholder="Share your thoughts..."
            value={typeof value === 'string' ? value : ''}
            onChange={e => {
              if (e.target.value.length <= maxLength) {
                handleValueChange(e.target.value)
              }
            }}
            rows={4}
            className="resize-none"
            maxLength={maxLength}
          />
          <div className="text-xs text-muted-foreground text-right">
            {currentLength}/{maxLength} characters
          </div>
        </div>

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  // Rank Question
  if (question.type === 'rank' && question.options) {
    const currentRanking = Array.isArray(value) ? value : []
    const unrankedOptions =
      question.options?.filter(option => !currentRanking.includes(option)) || []

    const handleRankSelection = (option: string, rank: number) => {
      const newRanking = [...currentRanking]
      // Remove option from any existing position
      const existingIndex = newRanking.indexOf(option)
      if (existingIndex > -1) {
        newRanking.splice(existingIndex, 1)
      }
      // Insert at new position (rank - 1 since we're 0-indexed)
      newRanking.splice(rank - 1, 0, option)
      // Trim to max options length
      const finalRanking = newRanking.slice(0, question.options?.length || 0)
      handleValueChange(finalRanking)
    }

    const removeFromRanking = (option: string) => {
      const newRanking = currentRanking.filter(item => item !== option)
      handleValueChange(newRanking)
    }

    return (
      <div className="space-y-6">
        <div className="text-sm text-muted-foreground mb-4">
          Click on items below to rank them in order of preference (most important first):
        </div>

        {/* Current Ranking */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium">Your Ranking:</h4>
          {currentRanking.map((option, index) => (
            <Card key={`ranked-${index}`} className="p-3 bg-primary/5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Badge variant="default" className="w-8 h-8 flex items-center justify-center">
                    {index + 1}
                  </Badge>
                  <span className="flex-1 text-sm">{option}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromRanking(option)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  Remove
                </Button>
              </div>
            </Card>
          ))}
          {currentRanking.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-sm border-2 border-dashed rounded-lg">
              No items ranked yet. Click items below to add them.
            </div>
          )}
        </div>

        {/* Available Options */}
        {unrankedOptions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium">Available Options:</h4>
            <div className="grid gap-2">
              {unrankedOptions.map((option, index) => (
                <Card key={`available-${index}`} className="p-3 hover:bg-muted/50 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <span className="flex-1 text-sm">{option}</span>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].slice(0, question.options?.length || 0).map(rank => (
                        <Button
                          key={rank}
                          variant="outline"
                          size="sm"
                          onClick={() => handleRankSelection(option, rank)}
                          disabled={
                            currentRanking.length >= rank && currentRanking[rank - 1] !== undefined
                          }
                          className="w-8 h-8 p-0"
                        >
                          {rank}
                        </Button>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  // Slider Question (0-100)
  if (question.type === 'slider') {
    const sliderValue = typeof value === 'number' ? value : 50

    return (
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="px-4">
            <Slider
              value={[sliderValue]}
              onValueChange={values => handleValueChange(values[0])}
              min={0}
              max={100}
              step={1}
              className="w-full"
            />
          </div>

          <div className="text-center">
            <Badge variant="outline" className="text-lg px-4 py-2">
              {sliderValue}%
            </Badge>
          </div>
        </div>

        <ConfidenceRating value={localConfidence} onChange={handleConfidenceChange} />
      </div>
    )
  }

  return (
    <Card className="p-4">
      <CardContent className="text-center text-muted-foreground">
        <div className="flex flex-col items-center space-y-2">
          <Star className="w-6 h-6 opacity-50" />
          <p>Advanced question type: {question.type}</p>
          <p className="text-sm">This question format will be available in future updates</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onChange('', localConfidence)}
            className="mt-3"
          >
            Skip for now
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Confidence Rating Component
function ConfidenceRating({
  value,
  onChange,
}: {
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="border-t pt-4 space-y-3">
      <div className="text-sm font-medium text-muted-foreground">
        How confident are you in this response?
      </div>
      <div className="flex justify-center space-x-1">
        {[1, 2, 3, 4, 5].map(rating => (
          <Button
            key={rating}
            variant="ghost"
            size="sm"
            onClick={() => onChange(rating)}
            className="p-1"
          >
            <Star
              className={`w-5 h-5 ${
                rating <= value ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground'
              }`}
            />
          </Button>
        ))}
      </div>
      <div className="text-xs text-center text-muted-foreground">{getConfidenceLabel(value)}</div>
    </div>
  )
}

// Helper functions
function getScaleLabel(questionId: string, type: 'min' | 'max'): string {
  const labels: Record<string, { min: string; max: string }> = {
    comm_directness: { min: 'Indirect & gentle', max: 'Very direct' },
    comm_detail_level: { min: 'Brief summaries', max: 'Detailed explanations' },
    comm_emotional_expression: { min: 'Logical/factual', max: 'Emotional depth' },
    think_analytical_intuitive: { min: 'Pure analysis', max: 'Pure intuition' },
    think_detail_big_picture: { min: 'Details first', max: 'Big picture first' },
    emotion_stability: { min: 'Very sensitive', max: 'Very steady' },
    social_energy: { min: 'Solitude', max: 'Social interaction' },
    learn_depth_breadth: { min: 'Deep expertise', max: 'Broad knowledge' },
    values_achievement: { min: 'Achievement crucial', max: 'Harmony crucial' },
    values_security: { min: 'Security & stability', max: 'Adventure & novelty' },
    behavior_routine: { min: 'Love routine', max: 'Love spontaneity' },
    behavior_risk: { min: 'Very cautious', max: 'Love taking risks' },
    creative_approach: { min: 'Perfect existing', max: 'Create original' },
    decision_logic_emotion: { min: 'Pure logic', max: 'Pure emotions' },
    decision_independence: { min: 'Always alone', max: 'Always with others' },
    philosophy_optimism: { min: 'Very pessimistic', max: 'Very optimistic' },
    meta_self_awareness: { min: 'Still figuring out', max: 'Very self-aware' },
    meta_growth_mindset: { min: 'Fixed abilities', max: 'Always can grow' },
  }

  return labels[questionId]?.[type] || (type === 'min' ? 'Strongly disagree' : 'Strongly agree')
}

function getConfidenceLabel(confidence: number): string {
  const labels = {
    1: 'Not very confident',
    2: 'Somewhat confident',
    3: 'Moderately confident',
    4: 'Quite confident',
    5: 'Very confident',
  }
  return labels[confidence as keyof typeof labels] || 'Moderately confident'
}
