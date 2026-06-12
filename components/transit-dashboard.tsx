'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Slider } from '@/components/ui/slider'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Calendar,
  Clock,
  Download,
  Filter,
  Search,
  Star,
  AlertTriangle,
  Zap,
  Check,
  Eye,
  Bell,
  BellOff,
  Share,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Plus,
  Minus,
  Target,
  TrendingUp,
  BookOpen,
  MessageCircle,
} from 'lucide-react'
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  isToday,
  isFuture,
  isPast,
} from 'date-fns'
import { PlanetaryAgentDisplay } from './planetary-agent-display'

interface TransitData {
  transitDate: string
  transitDegree: number
  transitingPlanet: string
  natalPlanet: string
  natalDegree: number
  natalSign: string
  natalHouse?: number
  aspectType: string
  aspectOrb: number
  planetaryAgent: {
    ruler: string
    sign: string
    dignity: string
    element: string
    modality: string
    consciousnessLevel: string
    powerLevel: number
  }
  overallScore: number
  scores: {
    dignityScore: number
    elementalHarmonyScore: number
    aspectQualityScore: number
    personalRelevanceScore: number
  }
  elementalHarmony: {
    natalElement: string
    transitElement: string
    harmonic: boolean
    challenging: boolean
    neutral: boolean
  }
  interpretation: {
    transitThemes: string[]
    dignityInterpretation: string
    elementalInterpretation: string
    consciousnessThemes: string[]
  }
  recommendedActions: string[]
  recommendedQueries: string[]
  consciousnessWork: string[]
  activationStrength: number
}

interface TransitDashboardProps {
  userId: string
  chartId?: string
  initialDateRange?: { start: Date; end: Date }
  enableChat?: boolean
  onChatInitiate?: (planet: string, sign: string, degree: number, context: any) => void
}

export function TransitDashboard({
  userId,
  chartId,
  initialDateRange,
  enableChat = false,
  onChatInitiate,
}: TransitDashboardProps) {
  // State management
  const [transits, setTransits] = useState<TransitData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransit, setSelectedTransit] = useState<TransitData | null>(null)
  const [currentMonth, setCurrentMonth] = useState(new Date())

  // Filter state
  const [significanceThreshold, setSignificanceThreshold] = useState([0.5])
  const [selectedPlanets, setSelectedPlanets] = useState<string[]>([])
  const [selectedElements, setSelectedElements] = useState<string[]>([])
  const [selectedModalities, setSelectedModalities] = useState<string[]>([])
  const [selectedAspects, setSelectedAspects] = useState<string[]>([])
  const [viewMode, setViewMode] = useState<'calendar' | 'timeline' | 'list'>('calendar')
  const [dateRange, setDateRange] = useState(
    initialDateRange || { start: new Date(), end: addMonths(new Date(), 1) }
  )

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportFormat, setExportFormat] = useState<'pdf' | 'html' | 'json'>('pdf')

  // Notification tracking
  const [trackedTransits, setTrackedTransits] = useState<Set<string>>(new Set())
  const [notifications, setNotifications] = useState<Set<string>>(new Set())

  // Load transits data
  const loadTransits = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        userId,
        startDate: dateRange.start.toISOString(),
        endDate: dateRange.end.toISOString(),
        significanceThreshold: significanceThreshold[0].toString(),
      })

      if (chartId) params.set('chartId', chartId)
      if (selectedPlanets.length > 0) params.set('planets', selectedPlanets.join(','))
      if (selectedElements.length > 0) params.set('elements', selectedElements.join(','))
      if (selectedModalities.length > 0) params.set('modalities', selectedModalities.join(','))
      if (selectedAspects.length > 0) params.set('aspects', selectedAspects.join(','))

      const response = await fetch(`/api/personalized-planetary-transits?${params}`)
      if (!response.ok) throw new Error('Failed to load transits')

      const data = await response.json()
      setTransits(data.transits?.all || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transits')
    } finally {
      setLoading(false)
    }
  }, [
    userId,
    chartId,
    dateRange,
    significanceThreshold,
    selectedPlanets,
    selectedElements,
    selectedModalities,
    selectedAspects,
  ])

  useEffect(() => {
    loadTransits()
  }, [loadTransits])

  // Filter transits based on current filters
  const filteredTransits = transits.filter(transit => {
    if (transit.overallScore < significanceThreshold[0]) return false
    if (selectedPlanets.length > 0 && !selectedPlanets.includes(transit.transitingPlanet))
      return false
    if (selectedElements.length > 0 && !selectedElements.includes(transit.planetaryAgent.element))
      return false
    if (
      selectedModalities.length > 0 &&
      !selectedModalities.includes(transit.planetaryAgent.modality)
    )
      return false
    if (selectedAspects.length > 0 && !selectedAspects.includes(transit.aspectType)) return false
    return true
  })

  // Get significance color
  const getSignificanceColor = (score: number) => {
    if (score >= 0.8) return 'text-red-500 bg-red-50 border-red-200'
    if (score >= 0.6) return 'text-orange-500 bg-orange-50 border-orange-200'
    return 'text-green-500 bg-green-50 border-green-200'
  }

  // Get significance label
  const getSignificanceLabel = (score: number) => {
    if (score >= 0.8) return 'Critical'
    if (score >= 0.6) return 'High'
    return 'Medium'
  }

  // Toggle tracking for transit
  const toggleTracking = (transitId: string) => {
    setTrackedTransits(prev => {
      const newSet = new Set(prev)
      if (newSet.has(transitId)) {
        newSet.delete(transitId)
      } else {
        newSet.add(transitId)
      }
      return newSet
    })
  }

  // Toggle notification for transit
  const toggleNotification = (transitId: string) => {
    setNotifications(prev => {
      const newSet = new Set(prev)
      if (newSet.has(transitId)) {
        newSet.delete(transitId)
      } else {
        newSet.add(transitId)
      }
      return newSet
    })
  }

  // Export transits
  const handleExport = async () => {
    try {
      setExporting(true)

      if (exportFormat === 'json') {
        const dataStr = JSON.stringify(filteredTransits, null, 2)
        const dataBlob = new Blob([dataStr], { type: 'application/json' })
        const url = URL.createObjectURL(dataBlob)
        const link = document.createElement('a')
        link.href = url
        link.download = `transits-export-${format(new Date(), 'yyyy-MM-dd')}.json`
        link.click()
        URL.revokeObjectURL(url)
      } else {
        // For PDF/HTML, we'll implement a simple HTML export for now
        const htmlContent = generateHtmlExport()
        const blob = new Blob([htmlContent], { type: 'text/html' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `transits-export-${format(new Date(), 'yyyy-MM-dd')}.html`
        link.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      console.error('Export failed:', err)
    } finally {
      setExporting(false)
    }
  }

  // Generate HTML export
  const generateHtmlExport = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Transit Forecast - ${format(dateRange.start, 'PPP')} to ${format(dateRange.end, 'PPP')}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 20px; }
            .transit { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 8px; }
            .critical { border-color: #ef4444; background: #fef2f2; }
            .high { border-color: #f97316; background: #fff7ed; }
            .medium { border-color: #22c55e; background: #f0fdf4; }
            .header { display: flex; justify-content: space-between; align-items: center; }
            .score { font-weight: bold; padding: 4px 8px; border-radius: 4px; }
          </style>
        </head>
        <body>
          <h1>Transit Forecast</h1>
          <p>Period: ${format(dateRange.start, 'PPP')} to ${format(dateRange.end, 'PPP')}</p>
          <p>Total Transits: ${filteredTransits.length}</p>

          ${filteredTransits
            .map(
              transit => `
            <div class="transit ${getSignificanceLabel(transit.overallScore).toLowerCase()}">
              <div class="header">
                <h3>${transit.transitingPlanet} ${transit.aspectType} Natal ${transit.natalPlanet}</h3>
                <span class="score" style="color: ${getSignificanceColor(transit.overallScore).split(' ')[0]}">
                  ${(transit.overallScore * 100).toFixed(0)}%
                </span>
              </div>
              <p><strong>Date:</strong> ${format(new Date(transit.transitDate), 'PPP')}</p>
              <p><strong>Planetary Agent:</strong> ${transit.planetaryAgent.ruler} in ${transit.planetaryAgent.sign}</p>
              <p><strong>Element:</strong> ${transit.planetaryAgent.element} • <strong>Modality:</strong> ${transit.planetaryAgent.modality}</p>
              <p><strong>Dignity:</strong> ${transit.planetaryAgent.dignity}</p>
              ${
                transit.interpretation.transitThemes.length > 0
                  ? `
                <p><strong>Themes:</strong> ${transit.interpretation.transitThemes.join(', ')}</p>
              `
                  : ''
              }
            </div>
          `
            )
            .join('')}
        </body>
      </html>
    `
  }

  // Calendar view component
  const CalendarView = () => {
    const monthStart = startOfMonth(currentMonth)
    const monthEnd = endOfMonth(currentMonth)
    const calendarDays = eachDayOfInterval({ start: monthStart, end: monthEnd })

    // Group transits by date
    const transitsByDate = filteredTransits.reduce(
      (acc, transit) => {
        const dateKey = format(new Date(transit.transitDate), 'yyyy-MM-dd')
        if (!acc[dateKey]) acc[dateKey] = []
        acc[dateKey].push(transit)
        return acc
      },
      {} as Record<string, TransitData[]>
    )

    return (
      <div className="space-y-4">
        {/* Calendar Header */}
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>

          <h3 className="text-lg font-semibold">{format(currentMonth, 'MMMM yyyy')}</h3>

          <Button variant="outline" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7 gap-1">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="p-2 text-center font-semibold text-sm">
              {day}
            </div>
          ))}

          {/* Calendar days */}
          {calendarDays.map(day => {
            const dateKey = format(day, 'yyyy-MM-dd')
            const dayTransits = transitsByDate[dateKey] || []
            const isCurrentMonth = isSameMonth(day, currentMonth)

            return (
              <div
                key={dateKey}
                className={`min-h-[100px] p-2 border border-gray-200 ${
                  !isCurrentMonth ? 'bg-gray-50 text-gray-400' : 'bg-white'
                } ${isToday(day) ? 'bg-blue-50 border-blue-300' : ''}`}
              >
                <div className="text-sm font-medium mb-1">{format(day, 'd')}</div>

                {/* Transit indicators */}
                <div className="space-y-1">
                  {dayTransits.slice(0, 3).map((transit, index) => (
                    <div
                      key={index}
                      className={`text-xs p-1 rounded cursor-pointer hover:opacity-80 ${getSignificanceColor(transit.overallScore)}`}
                      onClick={() => setSelectedTransit(transit)}
                    >
                      <div className="font-medium truncate">
                        {transit.transitingPlanet}→{transit.natalPlanet}
                      </div>
                      <div className="text-xs opacity-75">
                        {(transit.overallScore * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}

                  {dayTransits.length > 3 && (
                    <div className="text-xs text-gray-500">+{dayTransits.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // Timeline view component
  const TimelineView = () => {
    // Sort transits by date
    const sortedTransits = [...filteredTransits].sort(
      (a, b) => new Date(a.transitDate).getTime() - new Date(b.transitDate).getTime()
    )

    return (
      <div className="space-y-4">
        <div className="relative">
          {sortedTransits.map((transit, index) => {
            const transitDate = new Date(transit.transitDate)
            const isPastTransit = isPast(transitDate) && !isToday(transitDate)

            return (
              <div key={index} className="flex items-center mb-4">
                {/* Timeline line */}
                <div className="flex flex-col items-center mr-4">
                  <div
                    className={`w-3 h-3 rounded-full ${getSignificanceColor(transit.overallScore).split(' ')[0].replace('text-', 'bg-')}`}
                  />
                  {index < sortedTransits.length - 1 && (
                    <div className="w-0.5 h-16 bg-gray-300 mt-2" />
                  )}
                </div>

                {/* Transit card */}
                <Card
                  className={`flex-1 cursor-pointer hover:shadow-md transition-shadow ${isPastTransit ? 'opacity-60' : ''}`}
                  onClick={() => setSelectedTransit(transit)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2 h-2 rounded-full ${getSignificanceColor(transit.overallScore).split(' ')[0].replace('text-', 'bg-')}`}
                        />
                        <div>
                          <div className="font-semibold">
                            {transit.transitingPlanet} {transit.aspectType} {transit.natalPlanet}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(transitDate, 'PPP')} • Orb: {transit.aspectOrb.toFixed(2)}°
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge className={getSignificanceColor(transit.overallScore)}>
                          {(transit.overallScore * 100).toFixed(0)}%
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={e => {
                            e.stopPropagation()
                            toggleTracking(
                              `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                            )
                          }}
                        >
                          {trackedTransits.has(
                            `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                          ) ? (
                            <Check className="w-4 h-4 text-green-500" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center gap-4 text-sm">
                      <span>
                        Agent: {transit.planetaryAgent.ruler} in {transit.planetaryAgent.sign}
                      </span>
                      <span>Element: {transit.planetaryAgent.element}</span>
                      <span>Dignity: {transit.planetaryAgent.dignity}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // List view component
  const ListView = () => {
    return (
      <div className="space-y-4">
        {filteredTransits.map((transit, index) => (
          <Card key={index} className="cursor-pointer hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div
                    className={`w-3 h-3 rounded-full ${getSignificanceColor(transit.overallScore).split(' ')[0].replace('text-', 'bg-')}`}
                  />
                  <div>
                    <div className="font-semibold text-lg">
                      {transit.transitingPlanet} {transit.aspectType} Natal {transit.natalPlanet}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {format(new Date(transit.transitDate), 'PPP')} • {transit.natalSign}{' '}
                      {transit.natalDegree.toFixed(1)}°
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Badge className={getSignificanceColor(transit.overallScore)}>
                    {getSignificanceLabel(transit.overallScore)}
                  </Badge>
                  <Badge variant="outline">{(transit.overallScore * 100).toFixed(0)}%</Badge>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Agent:</span>
                  <div className="font-medium">
                    {transit.planetaryAgent.ruler} in {transit.planetaryAgent.sign}
                  </div>
                </div>
                <div>
                  <span className="text-muted-foreground">Element:</span>
                  <div className="font-medium">{transit.planetaryAgent.element}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Dignity:</span>
                  <div className="font-medium">{transit.planetaryAgent.dignity}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Orb:</span>
                  <div className="font-medium">{transit.aspectOrb.toFixed(2)}°</div>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => setSelectedTransit(transit)}>
                  <Eye className="w-4 h-4 mr-2" />
                  View Details
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleTracking(
                      `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                    )
                  }
                >
                  {trackedTransits.has(
                    `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                  ) ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Tracked
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4 mr-2" />
                      Track
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    toggleNotification(
                      `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                    )
                  }
                >
                  {notifications.has(
                    `${transit.transitingPlanet}-${transit.aspectType}-${transit.natalPlanet}-${transit.transitDate}`
                  ) ? (
                    <>
                      <BellOff className="w-4 h-4 mr-2" />
                      Unnotify
                    </>
                  ) : (
                    <>
                      <Bell className="w-4 h-4 mr-2" />
                      Notify
                    </>
                  )}
                </Button>

                {enableChat && onChatInitiate && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      onChatInitiate(
                        transit.planetaryAgent.ruler,
                        transit.planetaryAgent.sign,
                        transit.transitDegree,
                        {
                          transit: transit,
                          context: 'transit_dashboard',
                          significanceScore: transit.overallScore,
                        }
                      )
                    }
                  >
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Transit Dashboard</h2>
          <p className="text-muted-foreground">
            Comprehensive overview of upcoming planetary transits and their significance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={loadTransits} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Export Transit Data</DialogTitle>
                <DialogDescription>
                  Export your filtered transit data in various formats
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="export-format">Export Format</Label>
                  <Select
                    value={exportFormat}
                    onValueChange={(value: any) => setExportFormat(value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="html">HTML Report</SelectItem>
                      <SelectItem value="json">JSON Data</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button onClick={handleExport} disabled={exporting}>
                    {exporting ? 'Exporting...' : 'Export'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Significance Threshold */}
            <div className="space-y-2">
              <Label>Min Significance: {(significanceThreshold[0] * 100).toFixed(0)}%</Label>
              <Slider
                value={significanceThreshold}
                onValueChange={setSignificanceThreshold}
                max={1}
                min={0}
                step={0.1}
                className="w-full"
              />
            </div>

            {/* Planets Filter */}
            <div className="space-y-2">
              <Label>Transiting Planets</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  'Sun',
                  'Moon',
                  'Mercury',
                  'Venus',
                  'Mars',
                  'Jupiter',
                  'Saturn',
                  'Uranus',
                  'Neptune',
                  'Pluto',
                ].map(planet => (
                  <div key={planet} className="flex items-center space-x-2">
                    <Checkbox
                      id={`planet-${planet}`}
                      checked={selectedPlanets.includes(planet)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedPlanets(prev => [...prev, planet])
                        } else {
                          setSelectedPlanets(prev => prev.filter(p => p !== planet))
                        }
                      }}
                    />
                    <Label htmlFor={`planet-${planet}`} className="text-sm">
                      {planet}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Elements Filter */}
            <div className="space-y-2">
              <Label>Elements</Label>
              <div className="flex flex-wrap gap-2">
                {['Fire', 'Water', 'Air', 'Earth'].map(element => (
                  <div key={element} className="flex items-center space-x-2">
                    <Checkbox
                      id={`element-${element}`}
                      checked={selectedElements.includes(element)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedElements(prev => [...prev, element])
                        } else {
                          setSelectedElements(prev => prev.filter(e => e !== element))
                        }
                      }}
                    />
                    <Label htmlFor={`element-${element}`} className="text-sm">
                      {element}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            {/* Aspects Filter */}
            <div className="space-y-2">
              <Label>Aspect Types</Label>
              <div className="flex flex-wrap gap-2">
                {['Conjunction', 'Opposition', 'Trine', 'Square'].map(aspect => (
                  <div key={aspect} className="flex items-center space-x-2">
                    <Checkbox
                      id={`aspect-${aspect}`}
                      checked={selectedAspects.includes(aspect)}
                      onCheckedChange={checked => {
                        if (checked) {
                          setSelectedAspects(prev => [...prev, aspect])
                        } else {
                          setSelectedAspects(prev => prev.filter(a => a !== aspect))
                        }
                      }}
                    />
                    <Label htmlFor={`aspect-${aspect}`} className="text-sm">
                      {aspect}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-muted-foreground" />
              <div>
                <p className="text-2xl font-bold">{filteredTransits.length}</p>
                <p className="text-xs text-muted-foreground">Total Transits</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <div>
                <p className="text-2xl font-bold text-red-500">
                  {filteredTransits.filter(t => t.overallScore >= 0.8).length}
                </p>
                <p className="text-xs text-muted-foreground">Critical</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-orange-500" />
              <div>
                <p className="text-2xl font-bold text-orange-500">
                  {
                    filteredTransits.filter(t => t.overallScore >= 0.6 && t.overallScore < 0.8)
                      .length
                  }
                </p>
                <p className="text-xs text-muted-foreground">High</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-500" />
              <div>
                <p className="text-2xl font-bold text-green-500">
                  {
                    filteredTransits.filter(t => t.overallScore >= 0.5 && t.overallScore < 0.6)
                      .length
                  }
                </p>
                <p className="text-xs text-muted-foreground">Medium</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* View Tabs */}
      <Tabs value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="timeline">Timeline View</TabsTrigger>
          <TabsTrigger value="list">List View</TabsTrigger>
        </TabsList>

        <TabsContent value="calendar" className="mt-6">
          <CalendarView />
        </TabsContent>

        <TabsContent value="timeline" className="mt-6">
          <TimelineView />
        </TabsContent>

        <TabsContent value="list" className="mt-6">
          <ListView />
        </TabsContent>
      </Tabs>

      {/* Transit Detail Dialog */}
      {selectedTransit && (
        <Dialog open={!!selectedTransit} onOpenChange={() => setSelectedTransit(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Transit Details</DialogTitle>
              <DialogDescription>Detailed analysis of this planetary transit</DialogDescription>
            </DialogHeader>

            <PlanetaryAgentDisplay
              transit={selectedTransit}
              enableChat={enableChat}
              onChatInitiate={onChatInitiate}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="w-12 h-12 text-red-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">Error Loading Transits</h3>
            <p className="text-muted-foreground text-center mb-4">{error}</p>
            <Button onClick={loadTransits}>Try Again</Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && !error && filteredTransits.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Transits Found</h3>
            <p className="text-muted-foreground text-center">
              No significant transits match your current filters. Try adjusting the significance
              threshold or date range.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
