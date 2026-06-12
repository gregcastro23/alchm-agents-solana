'use client'

import { useState } from 'react'
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

  return (
    <div className="container py-12 px-4 mx-auto">
      <h1 className="text-3xl font-bold text-center mb-8">Elemental Chart Analysis</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <Card className="mb-8">
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                      id="latitude"
                      type="number"
                      step="0.0001"
                      value={birthInfo.location.latitude}
                      onChange={e => handleBirthInfoChange('latitude', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                      id="longitude"
                      type="number"
                      step="0.0001"
                      value={birthInfo.location.longitude}
                      onChange={e => handleBirthInfoChange('longitude', e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
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
                    <Label htmlFor={planet.toLowerCase()}>{planet}</Label>
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
