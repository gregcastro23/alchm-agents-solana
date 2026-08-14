'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LocationSearch, type LocationData } from '@/components/onboarding/LocationSearch'

export interface NatalChartData {
  chartName: string
  description?: string
  birthDate: string // YYYY-MM-DD
  birthTime: string // HH:MM or "unknown"
  birthLocation: {
    name: string
    lat: number
    lon: number
    timezone?: string
  }
}

interface NatalChartInputProps {
  onSubmit: (data: NatalChartData) => Promise<void>
  onCancel?: () => void
  initialData?: Partial<NatalChartData>
  isLoading?: boolean
}

export function NatalChartInput({
  onSubmit,
  onCancel,
  initialData,
  isLoading = false,
}: NatalChartInputProps) {
  const [formData, setFormData] = useState<NatalChartData>({
    chartName: initialData?.chartName || '',
    description: initialData?.description || '',
    birthDate: initialData?.birthDate || '',
    birthTime: initialData?.birthTime || '',
    birthLocation: initialData?.birthLocation || {
      name: '',
      lat: 0,
      lon: 0,
      timezone: 'UTC',
    },
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleLocationSelect = (location: LocationData) => {
    setFormData({
      ...formData,
      birthLocation: {
        name: location.displayName,
        lat: location.latitude,
        lon: location.longitude,
        timezone: location.timezone || 'UTC',
      },
    })
    setErrors(prev => {
      const next = { ...prev }
      delete next.location
      return next
    })
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!formData.chartName.trim()) {
      newErrors.chartName = 'Chart name is required'
    }

    if (!formData.birthDate) {
      newErrors.birthDate = 'Birth date is required'
    } else {
      // Validate date format
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/
      if (!dateRegex.test(formData.birthDate)) {
        newErrors.birthDate = 'Invalid date format (YYYY-MM-DD)'
      }
    }

    if (formData.birthTime && formData.birthTime !== 'unknown') {
      const timeRegex = /^\d{2}:\d{2}$/
      if (!timeRegex.test(formData.birthTime)) {
        newErrors.birthTime = 'Invalid time format (HH:MM)'
      }
    }

    if (!formData.birthLocation.name) {
      newErrors.location = 'Birth location is required'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) return

    try {
      await onSubmit(formData)
    } catch (error) {
      console.error('Form submission failed:', error)
      setErrors({ ...errors, submit: 'Failed to save natal chart. Please try again.' })
    }
  }

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>{initialData ? 'Edit Natal Chart' : 'Create Natal Chart'}</CardTitle>
        <CardDescription>
          Enter birth information to generate your natal chart for personalized transit analysis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Chart Name */}
          <div className="space-y-2">
            <Label htmlFor="chartName">Chart Name *</Label>
            <Input
              id="chartName"
              placeholder="My Birth Chart"
              value={formData.chartName}
              onChange={e => setFormData({ ...formData, chartName: e.target.value })}
              disabled={isLoading}
            />
            {errors.chartName && <p className="text-sm text-red-500">{errors.chartName}</p>}
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Personal birth chart for transit tracking..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
              disabled={isLoading}
              rows={2}
            />
          </div>

          {/* Birth Date */}
          <div className="space-y-2">
            <Label htmlFor="birthDate">Birth Date *</Label>
            <Input
              id="birthDate"
              type="date"
              value={formData.birthDate}
              onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
              disabled={isLoading}
            />
            {errors.birthDate && <p className="text-sm text-red-500">{errors.birthDate}</p>}
          </div>

          {/* Birth Time */}
          <div className="space-y-2">
            <Label htmlFor="birthTime">Birth Time</Label>
            <div className="flex gap-2">
              <Input
                id="birthTime"
                type="time"
                placeholder="14:30"
                value={formData.birthTime === 'unknown' ? '' : formData.birthTime}
                onChange={e => setFormData({ ...formData, birthTime: e.target.value })}
                disabled={isLoading || formData.birthTime === 'unknown'}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() =>
                  setFormData({
                    ...formData,
                    birthTime: formData.birthTime === 'unknown' ? '' : 'unknown',
                  })
                }
                disabled={isLoading}
              >
                {formData.birthTime === 'unknown' ? 'Enter Time' : 'Unknown'}
              </Button>
            </div>
            {errors.birthTime && <p className="text-sm text-red-500">{errors.birthTime}</p>}
            <p className="text-sm text-muted-foreground">
              Enter birth time if known, or mark as unknown for a solar chart
            </p>
          </div>

          {/* Birth Location */}
          <div className="space-y-2">
            <LocationSearch
              label="Birth Location"
              defaultValue={formData.birthLocation.name}
              defaultLatitude={formData.birthLocation.lat || undefined}
              defaultLongitude={formData.birthLocation.lon || undefined}
              onLocationSelect={handleLocationSelect}
              placeholder="Search for birth city (e.g. Chicago, IL, London, Tokyo)..."
              disabled={isLoading}
              required
            />
            {errors.location && <p className="text-sm text-red-500">{errors.location}</p>}
          </div>

          {/* Form Errors */}
          {errors.submit && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : initialData ? 'Update Chart' : 'Create Chart'}
            </Button>
            {onCancel && (
              <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
                Cancel
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
