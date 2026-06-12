'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Calendar, Clock, TrendingUp, Users, Lightbulb, ArrowRight } from 'lucide-react'
import { TransitRecord } from '@/lib/historical-transit-data'

interface HistoricalTransitCardProps {
  transit: TransitRecord
  showProgress?: boolean
  showEvents?: boolean
  showThemes?: boolean
  compact?: boolean
  onExplore?: (transit: TransitRecord) => void
}

export function HistoricalTransitCard({
  transit,
  showProgress = true,
  showEvents = true,
  showThemes = true,
  compact = false,
  onExplore,
}: HistoricalTransitCardProps) {
  const startDate = new Date(transit.startDate)
  const endDate = new Date(transit.endDate)
  const currentDate = new Date()

  const totalDuration = endDate.getTime() - startDate.getTime()
  const elapsed = Math.max(0, Math.min(currentDate.getTime() - startDate.getTime(), totalDuration))
  const progressPercentage = totalDuration > 0 ? (elapsed / totalDuration) * 100 : 0

  const isActive = currentDate >= startDate && currentDate <= endDate
  const isPast = currentDate > endDate
  const isFuture = currentDate < startDate

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const getDurationText = () => {
    const days = Math.ceil(totalDuration / (1000 * 60 * 60 * 24))
    const years = days / 365.25

    if (years >= 1) {
      return `${years.toFixed(1)} years`
    }
    return `${days} days`
  }

  const getStatusBadge = () => {
    if (isActive) {
      return (
        <Badge variant="default" className="bg-green-500">
          Active
        </Badge>
      )
    }
    if (isPast) {
      return <Badge variant="secondary">Completed</Badge>
    }
    return <Badge variant="outline">Future</Badge>
  }

  const getPlanetEmoji = (planet: string) => {
    const emojis: Record<string, string> = {
      Sun: '☉',
      Moon: '☽',
      Mercury: '☿',
      Venus: '♀',
      Mars: '♂',
      Jupiter: '♃',
      Saturn: '♄',
      Uranus: '⛢',
      Neptune: '♆',
      Pluto: '♇',
    }
    return emojis[planet] || '●'
  }

  const getSignEmoji = (sign: string) => {
    const emojis: Record<string, string> = {
      Aries: '♈',
      Taurus: '♉',
      Gemini: '♊',
      Cancer: '♋',
      Leo: '♌',
      Virgo: '♍',
      Libra: '♎',
      Scorpio: '♏',
      Sagittarius: '♐',
      Capricorn: '♑',
      Aquarius: '♒',
      Pisces: '♓',
    }
    return emojis[sign] || '●'
  }

  if (compact) {
    return (
      <Card
        className={`cursor-pointer hover:shadow-md transition-shadow ${isActive ? 'ring-2 ring-blue-500' : ''}`}
      >
        <CardContent className="pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{getPlanetEmoji(transit.planet)}</span>
              <span className="text-lg">{getSignEmoji(transit.sign)}</span>
              <span className="font-semibold">
                {transit.planet} in {transit.sign}
              </span>
              {getStatusBadge()}
            </div>
            <div className="text-sm text-muted-foreground">
              {formatDate(startDate)} - {formatDate(endDate)}
            </div>
          </div>

          {showProgress && isActive && (
            <div className="mt-3">
              <Progress value={progressPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground mt-1">
                {progressPercentage.toFixed(0)}% complete
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <Card
      className={`transition-all duration-200 hover:shadow-lg ${isActive ? 'ring-2 ring-blue-500 bg-blue-50/50' : ''}`}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-2xl">
              <span>{getPlanetEmoji(transit.planet)}</span>
              <span>{getSignEmoji(transit.sign)}</span>
            </div>
            <div>
              <CardTitle className="text-lg">
                {transit.planet} in {transit.sign}
                {transit.retrograde && (
                  <span className="ml-2 text-sm font-normal text-orange-600">℞</span>
                )}
              </CardTitle>
              <CardDescription>
                {formatDate(startDate)} - {formatDate(endDate)} • {getDurationText()}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">{getStatusBadge()}</div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {showProgress && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Progress
              </span>
              <span className="text-muted-foreground">
                {isActive
                  ? `${progressPercentage.toFixed(0)}% complete`
                  : isPast
                    ? 'Completed'
                    : 'Future transit'}
              </span>
            </div>
            {isActive && <Progress value={progressPercentage} className="h-2" />}
          </div>
        )}

        {showThemes && transit.themes && transit.themes.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-semibold">Key Themes</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {transit.themes.slice(0, 4).map((theme, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {theme}
                </Badge>
              ))}
              {transit.themes.length > 4 && (
                <Badge variant="outline" className="text-xs">
                  +{transit.themes.length - 4} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {showEvents && transit.historicalEvents && transit.historicalEvents.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4" />
              <span className="text-sm font-semibold">Historical Context</span>
            </div>
            <ul className="space-y-1">
              {transit.historicalEvents.slice(0, 3).map((event, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <Lightbulb className="h-3 w-3 mt-1 flex-shrink-0" />
                  {event}
                </li>
              ))}
            </ul>
          </div>
        )}

        {onExplore && (
          <div className="pt-2 border-t">
            <Button
              onClick={() => onExplore(transit)}
              variant="outline"
              size="sm"
              className="w-full"
            >
              Explore Details
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Component for displaying a list of historical transits
interface HistoricalTransitListProps {
  transits: TransitRecord[]
  title?: string
  showSearch?: boolean
  groupByPlanet?: boolean
  compact?: boolean
  onExplore?: (transit: TransitRecord) => void
}

export function HistoricalTransitList({
  transits,
  title = 'Historical Transits',
  showSearch = false,
  groupByPlanet = false,
  compact = false,
  onExplore,
}: HistoricalTransitListProps) {
  if (groupByPlanet) {
    const groupedTransits = transits.reduce(
      (groups, transit) => {
        const planet = transit.planet
        if (!groups[planet]) {
          groups[planet] = []
        }
        groups[planet].push(transit)
        return groups
      },
      {} as Record<string, TransitRecord[]>
    )

    return (
      <div className="space-y-6">
        {title && <h2 className="text-2xl font-bold">{title}</h2>}
        {Object.entries(groupedTransits).map(([planet, planetTransits]) => (
          <div key={planet}>
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <span className="text-xl">{getPlanetEmoji(planet)}</span>
              {planet} Transits
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {planetTransits.map((transit, index) => (
                <HistoricalTransitCard
                  key={index}
                  transit={transit}
                  compact={compact}
                  onExplore={onExplore}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {title && <h2 className="text-2xl font-bold">{title}</h2>}
      <div
        className={`grid gap-4 ${compact ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'}`}
      >
        {transits.map((transit, index) => (
          <HistoricalTransitCard
            key={index}
            transit={transit}
            compact={compact}
            onExplore={onExplore}
          />
        ))}
      </div>
    </div>
  )
}

// Helper function for planet emojis
function getPlanetEmoji(planet: string) {
  const emojis: Record<string, string> = {
    Sun: '☉',
    Moon: '☽',
    Mercury: '☿',
    Venus: '♀',
    Mars: '♂',
    Jupiter: '♃',
    Saturn: '♄',
    Uranus: '⛢',
    Neptune: '♆',
    Pluto: '♇',
  }
  return emojis[planet] || '●'
}
