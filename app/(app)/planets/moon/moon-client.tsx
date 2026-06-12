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
import { Slider } from '@/components/ui/slider'
import { identifyPlanetaryThemes } from '@/lib/transit-patterns'
import { Moon, Calendar, TrendingUp, Info, Sparkles } from 'lucide-react'

interface MoonPlanetClientProps {
  initialMoonPosition: { sign: string; degree: string } | null
  initialMoonPhase: string
}

export default function MoonPlanetClient({
  initialMoonPosition,
  initialMoonPhase,
}: MoonPlanetClientProps) {
  const [selectedSign, setSelectedSign] = useState(initialMoonPosition?.sign || 'Cancer')
  const [selectedDegree, setSelectedDegree] = useState(
    initialMoonPosition ? Math.floor(parseFloat(initialMoonPosition.degree)) : 15
  )
  const [moonPhase, setMoonPhase] = useState(initialMoonPhase)
  const currentPosition = initialMoonPosition

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

  const moonPhases = [
    'New Moon',
    'Waxing Crescent',
    'First Quarter',
    'Waxing Gibbous',
    'Full Moon',
    'Waning Gibbous',
    'Last Quarter',
    'Waning Crescent',
  ]

  // Synchronous computation — no useEffect needed
  const themes = useMemo(() => identifyPlanetaryThemes('Moon', selectedSign), [selectedSign])

  const getPhaseEmoji = (phase: string): string => {
    const emojis: Record<string, string> = {
      'New Moon': '🌑',
      'Waxing Crescent': '🌒',
      'First Quarter': '🌓',
      'Waxing Gibbous': '🌔',
      'Full Moon': '🌕',
      'Waning Gibbous': '🌖',
      'Last Quarter': '🌗',
      'Waning Crescent': '🌘',
    }
    return emojis[phase] || '🌙'
  }

  const getMoonKeywords = () => [
    'Intuition',
    'Emotions',
    'Nurturing',
    'Memory',
    'Cycles',
    'Receptivity',
    'Comfort',
    'Home',
    'Family',
  ]

  const getMoonColors = () => ['Silver', 'White', 'Pearl', 'Pale Blue']

  const getLunarPersonality = (degree: number): string => {
    const personalities = [
      'Initiating emotional pioneer',
      'Nurturing protector',
      'Intuitive communicator',
      'Empathic healer',
      'Creative nurturer',
      'Practical caregiver',
      'Harmonizing peacemaker',
      'Transformative mystic',
      'Adventurous seeker',
      'Structured builder',
      'Innovative humanitarian',
      'Transcendent dreamer',
    ]
    const index = Math.floor((degree / 30) % 12)
    return personalities[index]
  }

  return (
    <div className="container py-8 max-w-7xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-blue-500/20 rounded-full">
          <Moon className="h-8 w-8 text-blue-600" />
        </div>
        <div>
          <h1 className="text-4xl font-bold">The Moon</h1>
          <p className="text-muted-foreground">Emotional Intelligence & Intuitive Wisdom</p>
        </div>
      </div>

      {currentPosition && (
        <Card className="mb-6 border-blue-500/20 bg-blue-50/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Current Lunar Position
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <Badge variant="default" className="text-lg py-1 px-3">
                {currentPosition.sign} {currentPosition.degree}°
              </Badge>
              <Badge variant="outline" className="text-lg py-1 px-3">
                {getPhaseEmoji(moonPhase)} {moonPhase}
              </Badge>
              <span className="text-sm text-muted-foreground">
                The Moon nurtures through {currentPosition.sign}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="phases">Moon Phases</TabsTrigger>
          <TabsTrigger value="degrees">360° Personalities</TabsTrigger>
          <TabsTrigger value="cycles">Lunar Cycles</TabsTrigger>
          <TabsTrigger value="agent">Lunar Agent</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Info className="h-5 w-5" />
                  Lunar Essence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Emotional Core</h4>
                  <p className="text-sm text-muted-foreground">
                    The Moon represents your emotional nature, instincts, and subconscious patterns.
                    It reveals how you nurture and seek comfort.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Keywords</h4>
                  <div className="flex flex-wrap gap-2">
                    {getMoonKeywords().map((keyword: string) => (
                      <Badge key={keyword} variant="secondary">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">Lunar Colors</h4>
                  <div className="flex gap-2">
                    {getMoonColors().map((color: string) => (
                      <div
                        key={color}
                        className="w-8 h-8 rounded-full border-2 border-gray-300"
                        style={{
                          backgroundColor:
                            color.toLowerCase() === 'silver'
                              ? '#C0C0C0'
                              : color.toLowerCase() === 'white'
                                ? '#FFFFFF'
                                : color.toLowerCase() === 'pearl'
                                  ? '#F8F8FF'
                                  : color.toLowerCase().replace(' ', ''),
                        }}
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
                  <span>238,855 miles (384,400 km)</span>

                  <span className="text-muted-foreground">Diameter:</span>
                  <span>2,159 miles (3,474 km)</span>

                  <span className="text-muted-foreground">Surface Temperature:</span>
                  <span>-173°C to 127°C (-279°F to 260°F)</span>

                  <span className="text-muted-foreground">Rotation Period:</span>
                  <span>27.3 Earth days (tidally locked)</span>

                  <span className="text-muted-foreground">Orbit Period:</span>
                  <span>27.3 days (sidereal month)</span>

                  <span className="text-muted-foreground">Phase Cycle:</span>
                  <span>29.5 days (synodic month)</span>
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
                  <Badge variant="default">Cancer</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Exaltation</p>
                  <Badge variant="secondary">Taurus</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Detriment</p>
                  <Badge variant="destructive">Capricorn</Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Fall</p>
                  <Badge variant="outline">Scorpio</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="phases" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                Moon Phase System
              </CardTitle>
              <CardDescription>Each lunar phase carries unique energy and wisdom</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {moonPhases.map(phase => (
                  <Card
                    key={phase}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setMoonPhase(phase)}
                  >
                    <CardContent className="pt-6 text-center">
                      <div className="text-4xl mb-2">{getPhaseEmoji(phase)}</div>
                      <p className="font-semibold text-sm">{phase}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {phase === 'New Moon' && 'Beginnings'}
                        {phase === 'Waxing Crescent' && 'Intention'}
                        {phase === 'First Quarter' && 'Decision'}
                        {phase === 'Waxing Gibbous' && 'Refinement'}
                        {phase === 'Full Moon' && 'Illumination'}
                        {phase === 'Waning Gibbous' && 'Gratitude'}
                        {phase === 'Last Quarter' && 'Release'}
                        {phase === 'Waning Crescent' && 'Surrender'}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card className="bg-muted/30">
                <CardHeader>
                  <CardTitle className="text-lg">Current Selection: {moonPhase}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    {moonPhase === 'New Moon' &&
                      'Time for new beginnings, setting intentions, and planting seeds for the future.'}
                    {moonPhase === 'Waxing Crescent' &&
                      'Building momentum, taking first actions toward your intentions.'}
                    {moonPhase === 'First Quarter' &&
                      'Facing challenges, making decisions, pushing through resistance.'}
                    {moonPhase === 'Waxing Gibbous' &&
                      'Refining your approach, adjusting course, persevering toward goals.'}
                    {moonPhase === 'Full Moon' &&
                      'Peak illumination, harvest time, emotions heightened, clarity achieved.'}
                    {moonPhase === 'Waning Gibbous' &&
                      'Sharing wisdom, expressing gratitude, giving back to others.'}
                    {moonPhase === 'Last Quarter' &&
                      'Releasing what no longer serves, forgiveness, clearing space.'}
                    {moonPhase === 'Waning Crescent' &&
                      'Rest and reflection, preparing for renewal, deep introspection.'}
                  </p>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="degrees" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>360-Degree Lunar Personalities</CardTitle>
              <CardDescription>
                Each degree of the Moon's journey carries a unique personality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">
                    Select Lunar Degree: {selectedDegree}°
                  </label>
                  <Slider
                    value={[selectedDegree]}
                    onValueChange={value => setSelectedDegree(value[0])}
                    min={0}
                    max={359}
                    step={1}
                    className="mt-2"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Zodiac Position</p>
                    <Badge variant="outline">
                      {signs[Math.floor(selectedDegree / 30)]} {selectedDegree % 30}°
                    </Badge>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Decan</p>
                    <Badge variant="secondary">
                      {Math.floor((selectedDegree % 30) / 10) + 1} Decan
                    </Badge>
                  </div>
                </div>

                <Card className="bg-blue-50/50 dark:bg-blue-900/20">
                  <CardContent className="pt-6">
                    <h4 className="font-semibold mb-2">Personality at {selectedDegree}°</h4>
                    <p className="text-sm mb-3">{getLunarPersonality(selectedDegree)}</p>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Emotional Style: </span>
                        <span>
                          {selectedDegree < 120
                            ? 'Initiating'
                            : selectedDegree < 240
                              ? 'Stabilizing'
                              : 'Transforming'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Intuitive Mode: </span>
                        <span>
                          {selectedDegree % 30 < 10
                            ? 'Instinctual'
                            : selectedDegree % 30 < 20
                              ? 'Receptive'
                              : 'Integrative'}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Nurturing Approach: </span>
                        <span>{signs[Math.floor(selectedDegree / 30)]}-influenced</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cycles" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Lunar Cycles & Returns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-blue-50/50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="font-semibold mb-2">Lunar Return (Monthly)</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  The Moon returns to its natal position every 27.3 days, marking your emotional
                  reset cycle.
                </p>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Sidereal Month:</span>
                    <span className="ml-2 font-semibold">27.3 days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Synodic Month:</span>
                    <span className="ml-2 font-semibold">29.5 days</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Degrees per Day:</span>
                    <span className="ml-2 font-semibold">~13.2°</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Signs per Month:</span>
                    <span className="ml-2 font-semibold">All 12 signs</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Progressed Moon Cycle</h4>
                <div className="space-y-2 text-sm">
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">27-30 Year Cycle</p>
                    <p className="text-muted-foreground">
                      The progressed Moon completes a full zodiac cycle
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">2.5 Years per Sign</p>
                    <p className="text-muted-foreground">
                      Major emotional themes shift every 2.5 years
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Monthly Lunations</p>
                    <p className="text-muted-foreground">
                      13 lunar returns per year, 13 emotional resets
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Eclipses & Nodes</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Lunar Eclipses</p>
                    <p className="text-xs text-muted-foreground">
                      Emotional revelations and releases
                    </p>
                  </div>
                  <div className="p-3 border rounded-lg">
                    <p className="font-medium">Nodal Return</p>
                    <p className="text-xs text-muted-foreground">Every 18.6 years - karmic reset</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agent" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lunar Agent Consultation</CardTitle>
              <CardDescription>
                Connect with the Moon's intuitive wisdom for any degree and phase
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Select value={selectedSign} onValueChange={setSelectedSign}>
                    <SelectTrigger>
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

                  <Select value={moonPhase} onValueChange={setMoonPhase}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {moonPhases.map(phase => (
                        <SelectItem key={phase} value={phase}>
                          {getPhaseEmoji(phase)} {phase}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="text-center py-4">
                  <p className="text-sm text-muted-foreground mb-4">
                    Consult with the Lunar consciousness at {selectedSign} {selectedDegree}° during{' '}
                    {moonPhase}
                  </p>
                  <Button
                    onClick={() =>
                      (window.location.href = `/agents/Moon/${encodeURIComponent(selectedSign)}/${selectedDegree}`)
                    }
                    className="w-full md:w-auto"
                  >
                    Start Lunar Consultation
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
