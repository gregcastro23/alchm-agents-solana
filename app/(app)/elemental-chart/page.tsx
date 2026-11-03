'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'

const ElementalChart = dynamic(() => import('@/components/charts/elemental-chart'), { ssr: false })
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { LocationSearch, type LocationData } from '@/components/onboarding/LocationSearch'
import { getPlanetaryAgentStats } from '@/lib/agents/planetary-agent-stats'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'

export default function ElementalChartPage() {
  const [birthInfo, setBirthInfo] = useState({
    date: '2000-01-01',
    time: '12:00',
    location: {
      latitude: 40.7128,
      longitude: -74.006,
    },
  })

  const [planets, setPlanets] = useState({
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
  })

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

  const handlePlanetChange = (planet: string, sign: string) => {
    setPlanets(prev => ({
      ...prev,
      [`${planet.toLowerCase()}Sign`]: sign,
    }))
  }

  const handleBirthInfoChange = (field: string, value: string) => {
    if (field === 'latitude' || field === 'longitude') {
      setBirthInfo(prev => ({
        ...prev,
        location: {
          ...prev.location,
          [field]: parseFloat(value) || 0,
        },
      }))
    } else {
      setBirthInfo(prev => ({
        ...prev,
        [field]: value,
      }))
    }
  }

  const { compositeRating, planetPvrs } = useMemo(() => {
    const entries: Array<{ planet: string; sign: string }> = [
      { planet: 'Sun', sign: planets.sunSign },
      { planet: 'Moon', sign: planets.moonSign },
      { planet: 'Mercury', sign: planets.mercurySign },
      { planet: 'Venus', sign: planets.venusSign },
      { planet: 'Mars', sign: planets.marsSign },
      { planet: 'Jupiter', sign: planets.jupiterSign },
      { planet: 'Saturn', sign: planets.saturnSign },
      { planet: 'Uranus', sign: planets.uranusSign },
      { planet: 'Neptune', sign: planets.neptuneSign },
      { planet: 'Pluto', sign: planets.plutoSign },
      { planet: 'Ascendant', sign: planets.ascendantSign },
    ]

    const pvrs: Record<string, number> = {}
    const statsList: CoreStats[] = entries.map(({ planet, sign }) => {
      const body = planet === 'Ascendant' ? 'Sun' : planet
      const stats = getPlanetaryAgentStats(body, sign, 15)
      pvrs[planet] = rateStats(stats).ovr
      return stats
    })

    const count = statsList.length
    const compositeStats = statsList.reduce<CoreStats>(
      (acc, s) => ({
        power: acc.power + s.power / count,
        resonance: acc.resonance + s.resonance / count,
        wisdom: acc.wisdom + s.wisdom / count,
        charisma: acc.charisma + s.charisma / count,
        intuition: acc.intuition + s.intuition / count,
        adaptability: acc.adaptability + s.adaptability / count,
        vitality: acc.vitality + s.vitality / count,
      }),
      {
        power: 0,
        resonance: 0,
        wisdom: 0,
        charisma: 0,
        intuition: 0,
        adaptability: 0,
        vitality: 0,
      }
    )

    const rated = rateStats(compositeStats)
    const seals = earnedSeals(
      evaluateSeals({
        stats: compositeStats,
        esmsBalances: { spirit: 85, essence: 80, matter: 65, substance: 70 },
      })
    )

    return {
      compositeRating: {
        ovr: rated.ovr,
        archetype: rated.archetype,
        seals,
      },
      planetPvrs: pvrs,
    }
  }, [planets])

  return (
    <div className="container py-12 px-4 mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Elemental Chart Analysis</h1>
          <p className="text-sm text-muted-foreground">
            Interactive 11-body elemental distribution &amp; Pentacle Vessel Rating preview
          </p>
        </div>
        <Button
          asChild
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
        >
          <Link href="/forge">Forge Custom Vessel →</Link>
        </Button>
      </div>

      <VesselRatingRibbon
        ovr={compositeRating.ovr}
        archetype={compositeRating.archetype}
        seals={compositeRating.seals}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card className="mb-8 border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle>Birth Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date">Birth Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={birthInfo.date}
                      onChange={e => handleBirthInfoChange('date', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="time">Birth Time</Label>
                    <Input
                      id="time"
                      type="time"
                      value={birthInfo.time}
                      onChange={e => handleBirthInfoChange('time', e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <LocationSearch
                    label="Birth Location"
                    defaultLatitude={birthInfo.location.latitude}
                    defaultLongitude={birthInfo.location.longitude}
                    onLocationSelect={(loc: LocationData) => {
                      setBirthInfo(prev => ({
                        ...prev,
                        location: {
                          latitude: loc.latitude,
                          longitude: loc.longitude,
                        },
                      }))
                    }}
                    placeholder="Search birth city (e.g. Chicago, IL, London, Tokyo)..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-white/10 bg-[#0d1020]/90">
            <CardHeader>
              <CardTitle>Planetary Positions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
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
                  'Ascendant',
                ].map(planet => (
                  <div key={planet} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor={planet.toLowerCase()}>{planet}</Label>
                      {planetPvrs[planet] && (
                        <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                          PVR {planetPvrs[planet]}
                        </span>
                      )}
                    </div>
                    <Select
                      value={planets[`${planet.toLowerCase()}Sign` as keyof typeof planets]}
                      onValueChange={value => handlePlanetChange(planet, value)}
                    >
                      <SelectTrigger id={planet.toLowerCase()}>
                        <SelectValue placeholder="Select sign" />
                      </SelectTrigger>
                      <SelectContent>
                        {signs.map(sign => (
                          <SelectItem key={sign} value={sign}>
                            {sign}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div>
          <ElementalChart birthInfo={birthInfo} planets={planets} />
        </div>
      </div>
    </div>
  )
}
