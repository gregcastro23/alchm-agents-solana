'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { identifyPlanetaryThemes } from '@/lib/transit-patterns'
import { findLastOccurrence, findNextOccurrence } from '@/lib/historical-transits'
import sunData from '@/lib/planets/sun'
import { Sun, Calendar, History, TrendingUp, Info } from 'lucide-react'

const FALLBACK_SUN_POSITION = { sign: 'Libra', degree: '23.4', house: null as any }

interface SunPlanetClientProps {
  initialSunPosition: { sign: string; degree: string } | null
}

export default function SunPlanetClient({ initialSunPosition }: SunPlanetClientProps) {
  const [selectedSign, setSelectedSign] = useState(initialSunPosition?.sign || 'Leo')
  const [selectedDegree, setSelectedDegree] = useState(
    initialSunPosition ? Math.floor(parseFloat(initialSunPosition.degree)) : 15
  )
  // currentPosition is static — no setter needed
  const currentPosition = initialSunPosition

  const signs = [
    'Aries',
    'Taurus',
    'Gemini',
    'Cancer',
    'Leo',
    'Virgo',
    'Libra',
    'Scorpio',
    'Sagittarius',
    'Capricorn',
    'Aquarius',
    'Pisces',
  ]

  // Synchronous computations — no useEffect needed
  const themes = useMemo(() => identifyPlanetaryThemes('Sun', selectedSign), [selectedSign])
  const lastOccurrence = useMemo(
    () => findLastOccurrence('Sun', selectedSign, selectedDegree),
    [selectedSign, selectedDegree]
  )
  const nextOccurrence = useMemo(
    () => findNextOccurrence('Sun', selectedSign, selectedDegree),
    [selectedSign, selectedDegree]
  )

  const formatDate = (date: Date | undefined) => {
    if (!date) return 'Unknown'
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const getSunKeywords = () => sunData.AstrologicalProperties?.Keywords || []
  const getSunColors = () => sunData.AstrologicalProperties?.Colors || []

  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-yellow-500/20 rounded-full">
          <Sun className="h-8 w-8 text-yellow-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold">The Sun</h1>
          <p className="text-muted-foreground">Solar Consciousness & Life Force</p>
        </div>
      </div>

      {currentPosition && (
        <Card className="mb-6 border-yellow-500/20 bg-yellow-50/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Current Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-lg py-1 px-3">
                {currentPosition.sign} {currentPosition.degree}°
              </Badge>
              <span className="text-sm text-muted-foreground">
                The Sun illuminates {currentPosition.sign} at {currentPosition.degree} degrees
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="historical">Historical</TabsTrigger>
          <TabsTrigger value="cycles">Cycles</TabsTrigger>
          <TabsTrigger value="explorer">Explorer</TabsTrigger>
          <TabsTrigger value="agent">Agent Chat</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Solar Essence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Core Identity</h4>
                  <p className="text-sm text-muted-foreground">
                    The Sun represents your core self, ego, and life purpose. It illuminates your
                    path and shows where you shine brightest.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {getSunKeywords().map((keyword: string) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Solar Colors</h4>
                  <div className="flex gap-2">
                    {getSunColors().map((color: string) => (
                      <div
                        key={color}
                        className="w-8 h-8 rounded-full border-2 border-gray-300"
                        style={{ backgroundColor: color.toLowerCase().replace(' ', '') }}
                        title={color}
                      />
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Astronomical Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="text-muted-foreground">Distance from Earth:</span>
                  <span>{sunData.AstronomicalData?.DistanceFromEarth?.Minimum}</span>

                  <span className="text-muted-foreground">Diameter:</span>
                  <span>{sunData.AstronomicalData?.Diameter}</span>

                  <span className="text-muted-foreground">Surface Temperature:</span>
                  <span>{sunData.AstronomicalData?.SurfaceTemperature}</span>

                  <span className="text-muted-foreground">Rotation Period:</span>
                  <span>{sunData.AstronomicalData?.RotationPeriod}</span>

                  <span className="text-muted-foreground">Orbit Period:</span>
                  <span>{sunData.AstronomicalData?.OrbitPeriod}</span>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Dignities & Rulerships</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Domicile</p>
                  <Badge variant="default">Leo</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Exaltation</p>
                  <Badge variant="secondary">Aries</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Detriment</p>
                  <Badge variant="destructive">Aquarius</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fall</p>
                  <Badge variant="outline">Libra</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historical" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Historical Context for {selectedSign}
              </CardTitle>
              <CardDescription>Explore when the Sun was last in this position</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4">
                <Select value={selectedSign} onValueChange={setSelectedSign}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {signs.map(sign => (
                      <SelectItem key={sign} value={sign}>
                        {sign}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={selectedDegree.toString()}
                  onValueChange={v => setSelectedDegree(parseInt(v))}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map(deg => (
                      <SelectItem key={deg} value={deg.toString()}>
                        {deg}°
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {themes && (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-semibold mb-2">Themes for Sun in {selectedSign}</h4>
                    <div className="flex flex-wrap gap-2">
                      {themes.themes?.map((theme: string) => (
                        <Badge key={theme} variant="outline">
                          {theme}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold mb-2">Archetypal Expressions</h4>
                    <div className="flex flex-wrap gap-2">
                      {themes.archetypes?.map((archetype: string) => (
                        <Badge key={archetype} variant="secondary">
                          {archetype}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Last Occurrence</p>
                  <p className="font-semibold">{formatDate(lastOccurrence?.date)}</p>
                  {lastOccurrence?.historicalContext && (
                    <p className="text-sm mt-1">{lastOccurrence.historicalContext}</p>
                  )}
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">Next Occurrence</p>
                  <p className="font-semibold">{formatDate(nextOccurrence?.date)}</p>
                  {nextOccurrence?.historicalContext && (
                    <p className="text-sm mt-1">{nextOccurrence.historicalContext}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Solar Cycles
              </CardTitle>
              <CardDescription>Understanding the Sun's annual journey</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-yellow-50/50 dark:bg-yellow-900/20 rounded-lg">
                <h4 className="font-semibold mb-2">Annual Solar Return</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The Sun returns to its natal position once per year, marking your birthday and a
                  new solar year.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Cycle Length:</span>
                    <span className="ml-2 font-semibold">365.25 days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Degrees per Day:</span>
                    <span className="ml-2 font-semibold">~0.986°</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Seasonal Markers</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Spring Equinox</p>
                    <p className="text-sm text-muted-foreground">Sun enters Aries (0°)</p>
                    <p className="text-xs mt-1">~March 20</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Summer Solstice</p>
                    <p className="text-sm text-muted-foreground">Sun enters Cancer (0°)</p>
                    <p className="text-xs mt-1">~June 21</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Autumn Equinox</p>
                    <p className="text-sm text-muted-foreground">Sun enters Libra (0°)</p>
                    <p className="text-xs mt-1">~September 23</p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Winter Solstice</p>
                    <p className="text-sm text-muted-foreground">Sun enters Capricorn (0°)</p>
                    <p className="text-xs mt-1">~December 21</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="explorer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solar Position Explorer</CardTitle>
              <CardDescription>
                Explore the Sun's influence through different signs and degrees
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                    <h4 className="font-semibold text-amber-900 dark:text-amber-100 mb-2">
                      Current Position
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Zodiac Sign:</span>
                        <span className="font-medium">
                          {(currentPosition || FALLBACK_SUN_POSITION).sign}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Degree:</span>
                        <span className="font-medium">
                          {(currentPosition || FALLBACK_SUN_POSITION).degree}°
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">House:</span>
                        <span className="font-medium">
                          {(currentPosition as any)?.house ||
                            FALLBACK_SUN_POSITION.house ||
                            'Varies by location'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <h4 className="font-semibold text-orange-900 dark:text-orange-100 mb-2">
                      Solar Energy
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Spirit Essence:</span>
                        <span className="font-medium">Pure (10/10)</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Life Force:</span>
                        <span className="font-medium">Maximum</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expression:</span>
                        <span className="font-medium">Yang/Active</span>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  The Sun moves approximately 1° per day through the zodiac, completing its journey
                  through all 12 signs in one year.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Solar Agent Consultation</CardTitle>
              <CardDescription>
                Connect with the Sun's wisdom for your current position
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  Consult with the Solar consciousness agent
                </p>
                <Button
                  onClick={() =>
                    (window.location.href = `/agents/Sun/${encodeURIComponent(selectedSign)}/${selectedDegree}`)
                  }
                >
                  Start Solar Consultation
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
