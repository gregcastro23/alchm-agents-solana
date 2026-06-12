'use client'

import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import {
  Plus,
  Trash2,
  Users,
  Heart,
  Briefcase,
  Home,
  Sparkles,
  Info,
  Calendar,
  MapPin,
  Clock,
} from 'lucide-react'

export interface ChartInput {
  id: string
  name: string
  birthDate: string
  birthTime: string
  birthLocation: string
  isValid: boolean
}

export interface MultiChartInputProps {
  onChartsChange: (charts: ChartInput[]) => void
  onRelationshipTypeChange: (type: string) => void
  onAnalyze: () => void
  isAnalyzing?: boolean
  maxCharts?: number
}

const RELATIONSHIP_TYPES = [
  { value: 'romantic', label: 'Romantic Partnership', icon: Heart, color: 'text-red-500' },
  { value: 'friendship', label: 'Friendship', icon: Users, color: 'text-blue-500' },
  { value: 'family', label: 'Family Bond', icon: Home, color: 'text-green-500' },
  { value: 'business', label: 'Business/Professional', icon: Briefcase, color: 'text-purple-500' },
  {
    value: 'spiritual',
    label: 'Spiritual/Consciousness Work',
    icon: Sparkles,
    color: 'text-amber-500',
  },
]

const COMMON_LOCATIONS = [
  'New York, NY, USA',
  'Los Angeles, CA, USA',
  'London, England, UK',
  'Paris, France',
  'Tokyo, Japan',
  'Sydney, Australia',
  'Toronto, Canada',
  'Berlin, Germany',
]

export default function MultiChartInput({
  onChartsChange,
  onRelationshipTypeChange,
  onAnalyze,
  isAnalyzing = false,
  maxCharts = 8,
}: MultiChartInputProps) {
  const [charts, setCharts] = useState<ChartInput[]>([])
  const [relationshipType, setRelationshipType] = useState<string>('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Add new chart
  const addChart = () => {
    if (charts.length >= maxCharts) return

    const newChart: ChartInput = {
      id: `chart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      name: '',
      birthDate: '',
      birthTime: '12:00',
      birthLocation: 'New York, NY, USA',
      isValid: false,
    }

    const updatedCharts = [...charts, newChart]
    setCharts(updatedCharts)
    onChartsChange(updatedCharts)
  }

  // Remove chart
  const removeChart = (chartId: string) => {
    const updatedCharts = charts.filter(c => c.id !== chartId)
    setCharts(updatedCharts)
    onChartsChange(updatedCharts)

    // Clear errors for removed chart
    const newErrors = { ...errors }
    delete newErrors[chartId]
    setErrors(newErrors)
  }

  // Update chart field
  const updateChart = (chartId: string, field: keyof ChartInput, value: string) => {
    const updatedCharts = charts.map(chart => {
      if (chart.id === chartId) {
        const updated = { ...chart, [field]: value }
        updated.isValid = validateChart(updated)
        return updated
      }
      return chart
    })

    setCharts(updatedCharts)
    onChartsChange(updatedCharts)

    // Clear field-specific error
    if (errors[`${chartId}_${field}`]) {
      const newErrors = { ...errors }
      delete newErrors[`${chartId}_${field}`]
      setErrors(newErrors)
    }
  }

  // Validate individual chart
  const validateChart = (chart: ChartInput): boolean => {
    if (!chart.name.trim()) return false
    if (!chart.birthDate) return false
    if (!chart.birthLocation.trim()) return false

    // Basic date validation
    const date = new Date(chart.birthDate)
    if (isNaN(date.getTime())) return false
    if (date > new Date()) return false // Future dates not allowed

    return true
  }

  // Validate all charts and show errors
  const validateAll = (): boolean => {
    const newErrors: Record<string, string> = {}
    let isValid = true

    if (charts.length === 0) {
      newErrors.general = 'At least one chart is required'
      isValid = false
    }

    charts.forEach(chart => {
      if (!chart.name.trim()) {
        newErrors[`${chart.id}_name`] = 'Name is required'
        isValid = false
      }

      if (!chart.birthDate) {
        newErrors[`${chart.id}_birthDate`] = 'Birth date is required'
        isValid = false
      } else {
        const date = new Date(chart.birthDate)
        if (isNaN(date.getTime())) {
          newErrors[`${chart.id}_birthDate`] = 'Invalid date format'
          isValid = false
        } else if (date > new Date()) {
          newErrors[`${chart.id}_birthDate`] = 'Birth date cannot be in the future'
          isValid = false
        }
      }

      if (!chart.birthLocation.trim()) {
        newErrors[`${chart.id}_birthLocation`] = 'Birth location is required'
        isValid = false
      }
    })

    if (charts.length > 1 && !relationshipType) {
      newErrors.relationship = 'Please select relationship type for multi-chart analysis'
      isValid = false
    }

    setErrors(newErrors)
    return isValid
  }

  // Handle analyze button
  const handleAnalyze = () => {
    if (validateAll()) {
      onAnalyze()
    }
  }

  // Handle relationship type change
  const handleRelationshipTypeChange = (type: string) => {
    setRelationshipType(type)
    onRelationshipTypeChange(type)

    if (errors.relationship) {
      const newErrors = { ...errors }
      delete newErrors.relationship
      setErrors(newErrors)
    }
  }

  // Get complexity info
  const getComplexityInfo = () => {
    const count = charts.length
    if (count === 0)
      return {
        name: 'Solo',
        description: 'Current cosmic moment only',
        color: 'bg-gray-100 text-gray-800',
      }
    if (count === 1)
      return {
        name: 'Dual',
        description: 'Current moment + birth chart',
        color: 'bg-blue-100 text-blue-800',
      }
    if (count === 2)
      return {
        name: 'Trinity',
        description: 'Three-chart synergy analysis',
        color: 'bg-purple-100 text-purple-800',
      }
    return {
      name: 'Collective',
      description: `${count + 1}-chart group consciousness`,
      color: 'bg-amber-100 text-amber-800',
    }
  }

  const complexity = getComplexityInfo()
  const validChartCount = charts.filter(c => c.isValid).length
  const totalChartCount = charts.length + 1 // +1 for current moment
  const progressPercentage = charts.length > 0 ? (validChartCount / charts.length) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-6 w-6 text-purple-500" />
            Multi-Chart Rune Analysis
          </CardTitle>
          <CardDescription>
            Combine multiple birth charts with the current cosmic moment to mint powerful
            consciousness runes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Badge className={complexity.color}>{complexity.name} Complexity</Badge>
            <span className="text-sm text-gray-600">{complexity.description}</span>
            <span className="text-sm font-medium">
              {totalChartCount} chart{totalChartCount !== 1 ? 's' : ''} total
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {charts.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Chart Completion</span>
                <span>
                  {validChartCount}/{charts.length} ready
                </span>
              </div>
              <Progress value={progressPercentage} className="h-2" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Relationship Type Selection */}
      {charts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Relationship Context</CardTitle>
            <CardDescription>
              Select the type of relationship to optimize rune recommendations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {RELATIONSHIP_TYPES.map(type => {
                const Icon = type.icon
                return (
                  <Button
                    key={type.value}
                    variant={relationshipType === type.value ? 'default' : 'outline'}
                    className="h-auto py-3 px-4 flex flex-col items-center gap-2"
                    onClick={() => handleRelationshipTypeChange(type.value)}
                  >
                    <Icon className={`h-5 w-5 ${type.color}`} />
                    <span className="text-xs text-center">{type.label}</span>
                  </Button>
                )
              })}
            </div>
            {errors.relationship && (
              <Alert className="mt-3">
                <Info className="h-4 w-4" />
                <AlertDescription>{errors.relationship}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Chart Inputs */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Birth Charts</h3>
          <Button
            onClick={addChart}
            disabled={charts.length >= maxCharts}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Chart ({charts.length}/{maxCharts})
          </Button>
        </div>

        {charts.map((chart, index) => (
          <Card
            key={chart.id}
            className={`border-l-4 ${chart.isValid ? 'border-l-green-500' : 'border-l-gray-300'}`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Chart {index + 1}
                  {chart.isValid && <span className="ml-2 text-green-500">✓</span>}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeChart(chart.id)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor={`name_${chart.id}`}>Name *</Label>
                <Input
                  id={`name_${chart.id}`}
                  value={chart.name}
                  onChange={e => updateChart(chart.id, 'name', e.target.value)}
                  placeholder="Enter person's name"
                  className={errors[`${chart.id}_name`] ? 'border-red-500' : ''}
                />
                {errors[`${chart.id}_name`] && (
                  <p className="text-sm text-red-500">{errors[`${chart.id}_name`]}</p>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Birth Date */}
                <div className="space-y-2">
                  <Label htmlFor={`date_${chart.id}`} className="flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    Birth Date *
                  </Label>
                  <Input
                    id={`date_${chart.id}`}
                    type="date"
                    value={chart.birthDate}
                    onChange={e => updateChart(chart.id, 'birthDate', e.target.value)}
                    className={errors[`${chart.id}_birthDate`] ? 'border-red-500' : ''}
                  />
                  {errors[`${chart.id}_birthDate`] && (
                    <p className="text-sm text-red-500">{errors[`${chart.id}_birthDate`]}</p>
                  )}
                </div>

                {/* Birth Time */}
                <div className="space-y-2">
                  <Label htmlFor={`time_${chart.id}`} className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Birth Time
                  </Label>
                  <Input
                    id={`time_${chart.id}`}
                    type="time"
                    value={chart.birthTime}
                    onChange={e => updateChart(chart.id, 'birthTime', e.target.value)}
                  />
                  <p className="text-xs text-gray-500">If unknown, noon is used as default</p>
                </div>
              </div>

              {/* Birth Location */}
              <div className="space-y-2">
                <Label htmlFor={`location_${chart.id}`} className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  Birth Location *
                </Label>
                <Select
                  value={chart.birthLocation}
                  onValueChange={value => updateChart(chart.id, 'birthLocation', value)}
                >
                  <SelectTrigger
                    className={errors[`${chart.id}_birthLocation`] ? 'border-red-500' : ''}
                  >
                    <SelectValue placeholder="Select birth location" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMMON_LOCATIONS.map(location => (
                      <SelectItem key={location} value={location}>
                        {location}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors[`${chart.id}_birthLocation`] && (
                  <p className="text-sm text-red-500">{errors[`${chart.id}_birthLocation`]}</p>
                )}
                <p className="text-xs text-gray-500">
                  Custom locations can be added in advanced mode
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Current Moment Card */}
      <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-full bg-blue-100">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h4 className="font-medium">Current Cosmic Moment</h4>
              <p className="text-sm text-gray-600">
                Automatically included as the base chart for all rune analysis
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* General Errors */}
      {errors.general && (
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>{errors.general}</AlertDescription>
        </Alert>
      )}

      {/* Analyze Button */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            <Button
              onClick={handleAnalyze}
              disabled={isAnalyzing || charts.length === 0}
              className="w-full h-12 text-lg"
              size="lg"
            >
              {isAnalyzing ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  Analyzing Charts...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Analyze {totalChartCount} Chart{totalChartCount !== 1 ? 's' : ''} for Rune Minting
                </div>
              )}
            </Button>

            <div className="text-center text-sm text-gray-600">
              This will combine your charts with the current cosmic moment to reveal available runes
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Info className="h-4 w-4" />
            How Multi-Chart Runes Work
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p>
            <strong>Solo Runes:</strong> Based on current cosmic moment alone
          </p>
          <p>
            <strong>Dual Runes:</strong> Your birth chart + current moment (enhanced personal power)
          </p>
          <p>
            <strong>Trinity Runes:</strong> Three charts create relationship synergy runes
          </p>
          <p>
            <strong>Collective Runes:</strong> 4+ charts unlock group consciousness tools
          </p>
          <p className="text-blue-700 mt-3">
            Higher complexity = more powerful runes, but requires better synergy between charts
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
