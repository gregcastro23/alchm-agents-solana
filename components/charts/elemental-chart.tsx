'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'

type ElementalChartProps = {
  birthInfo?: {
    date: string
    time: string
    location: {
      latitude: number
      longitude: number
    }
  }
  planets?: Record<string, string>
}

type PlanetaryElement = {
  planet: string
  sign: string
  signElement: string
  planetElement: string
  affinity: number
}

export default function ElementalChart({ birthInfo, planets }: ElementalChartProps) {
  const [elementalData, setElementalData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Default birth info if none provided
  const defaultBirthInfo = useMemo(
    () => ({
      date: '2000-01-01',
      time: '12:00',
      location: {
        latitude: 40.7128,
        longitude: -74.006,
      },
    }),
    []
  )

  // Default planets if none provided
  const defaultPlanets = useMemo(
    () => ({
      sunSign: 'Leo',
      moonSign: 'Cancer',
      mercurySign: 'Virgo',
      venusSign: 'Libra',
      marsSign: 'Aries',
      jupiterSign: 'Sagittarius',
      saturnSign: 'Capricorn',
      uranusSign: 'Aquarius',
      neptuneSign: 'Pisces',
      plutoSign: 'Scorpio',
      ascendantSign: 'Aries',
    }),
    []
  )

  useEffect(() => {
    async function fetchElementalData() {
      setLoading(true)
      setError(null)

      try {
        const response = await fetch('/api/elemental-info', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            birthInfo: birthInfo || defaultBirthInfo,
            planets: planets || defaultPlanets,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to fetch elemental data')
        }

        const data = await response.json()
        setElementalData(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An unknown error occurred')
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    fetchElementalData()
  }, [birthInfo, planets, defaultBirthInfo, defaultPlanets])

  // Get color for element
  const getElementColor = (element: string) => {
    switch (element) {
      case 'Fire':
        return 'bg-red-500 hover:bg-red-600'
      case 'Water':
        return 'bg-blue-500 hover:bg-blue-600'
      case 'Air':
        return 'bg-yellow-500 hover:bg-yellow-600'
      case 'Earth':
        return 'bg-green-500 hover:bg-green-600'
      default:
        return 'bg-gray-500 hover:bg-gray-600'
    }
  }

  // Get background color for element
  const getElementBgColor = (element: string) => {
    switch (element) {
      case 'Fire':
        return 'bg-red-100 dark:bg-red-950'
      case 'Water':
        return 'bg-blue-100 dark:bg-blue-950'
      case 'Air':
        return 'bg-yellow-100 dark:bg-yellow-950'
      case 'Earth':
        return 'bg-green-100 dark:bg-green-950'
      default:
        return 'bg-gray-100 dark:bg-gray-950'
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Loading Elemental Data...</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center items-center h-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-center">Error</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!elementalData) {
    return null
  }

  const { elementalTotals, dominantElement, alchemicalInfo, isDiurnal, planetaryElements } =
    elementalData

  // Get the total value to calculate percentages
  const totalElementValue = Object.values(elementalTotals as Record<string, number>).reduce(
    (acc: number, val: number) => acc + val,
    0
  ) as number

  // Calculate percentages for each element
  const elementPercentages = {
    Fire: Math.round((elementalTotals.Fire / totalElementValue) * 100),
    Water: Math.round((elementalTotals.Water / totalElementValue) * 100),
    Air: Math.round((elementalTotals.Air / totalElementValue) * 100),
    Earth: Math.round((elementalTotals.Earth / totalElementValue) * 100),
  }

  return (
    <div className="space-y-6">
      <Card className={getElementBgColor(dominantElement)}>
        <CardHeader>
          <CardTitle className="text-center">Elemental Profile</CardTitle>
          <div className="flex justify-center mt-2">
            <Badge className={getElementColor(dominantElement)}>{dominantElement} Dominant</Badge>
            <Badge variant="outline" className="ml-2">
              {isDiurnal ? 'Day' : 'Night'} Chart
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Fire</span>
                <span>{elementPercentages.Fire}%</span>
              </div>
              <Progress
                value={elementPercentages.Fire}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              >
                <div
                  className="h-full bg-red-500"
                  style={{ width: `${elementPercentages.Fire}%` }}
                />
              </Progress>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Water</span>
                <span>{elementPercentages.Water}%</span>
              </div>
              <Progress
                value={elementPercentages.Water}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              >
                <div
                  className="h-full bg-blue-500"
                  style={{ width: `${elementPercentages.Water}%` }}
                />
              </Progress>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Air</span>
                <span>{elementPercentages.Air}%</span>
              </div>
              <Progress value={elementPercentages.Air} className="h-2 bg-gray-200 dark:bg-gray-700">
                <div
                  className="h-full bg-yellow-500"
                  style={{ width: `${elementPercentages.Air}%` }}
                />
              </Progress>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span>Earth</span>
                <span>{elementPercentages.Earth}%</span>
              </div>
              <Progress
                value={elementPercentages.Earth}
                className="h-2 bg-gray-200 dark:bg-gray-700"
              >
                <div
                  className="h-full bg-green-500"
                  style={{ width: `${elementPercentages.Earth}%` }}
                />
              </Progress>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-center">Planetary Elements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {planetaryElements.map((planetInfo: PlanetaryElement) => (
              <div
                key={planetInfo.planet}
                className="flex items-center justify-between p-2 border rounded-md"
              >
                <div>
                  <span className="font-semibold">{planetInfo.planet}</span> in {planetInfo.sign}
                </div>
                <div className="flex gap-2">
                  <Badge className={getElementColor(planetInfo.signElement)}>
                    {planetInfo.signElement}
                  </Badge>
                  <Badge className={getElementColor(planetInfo.planetElement)}>
                    {planetInfo.planetElement}
                  </Badge>
                  <Badge variant="outline">{planetInfo.affinity}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-center">Alchemical Properties</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center">
              <span className="text-lg font-semibold">
                {Math.round(alchemicalInfo.heat * 100) / 100}
              </span>
              <span className="text-sm text-muted-foreground">Heat</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-semibold">
                {Math.round(alchemicalInfo.entropy * 100) / 100}
              </span>
              <span className="text-sm text-muted-foreground">Entropy</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-semibold">
                {Math.round(alchemicalInfo.reactivity * 100) / 100}
              </span>
              <span className="text-sm text-muted-foreground">Reactivity</span>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-lg font-semibold">
                {Math.round(alchemicalInfo.energy * 100) / 100}
              </span>
              <span className="text-sm text-muted-foreground">Energy</span>
            </div>
          </div>

          {/* A-Number Display */}
          {alchemicalInfo.aNumber !== undefined && (
            <div className="mt-4 p-3 bg-indigo-50 dark:bg-indigo-950 rounded-lg border border-indigo-200 dark:border-indigo-800">
              <div className="text-center">
                <div className="text-2xl font-bold text-indigo-800 dark:text-indigo-200">
                  A-Number: {Math.round(alchemicalInfo.aNumber * 100) / 100}
                </div>
                <div className="text-sm text-indigo-600 dark:text-indigo-400 mt-1">
                  Total Alchemical Energy
                </div>
                {alchemicalInfo.alchemicalProperties && (
                  <div className="text-xs text-indigo-500 dark:text-indigo-500 mt-2">
                    Spirit: {Math.round(alchemicalInfo.alchemicalProperties.spirit * 100) / 100} +
                    Essence: {Math.round(alchemicalInfo.alchemicalProperties.essence * 100) / 100} +
                    Matter: {Math.round(alchemicalInfo.alchemicalProperties.matter * 100) / 100} +
                    Substance:{' '}
                    {Math.round(alchemicalInfo.alchemicalProperties.substance * 100) / 100}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 text-center">
            <div>
              <span className="font-semibold">Sun Sign:</span> {alchemicalInfo.sunSign}
            </div>
            <div>
              <span className="font-semibold">Chart Ruler:</span> {alchemicalInfo.chartRuler}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
