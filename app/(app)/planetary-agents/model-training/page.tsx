'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { planetaryDignities } from '@/lib/astrological-data'

export default function ModelTrainingPage() {
  const [selectedPlanet, setSelectedPlanet] = useState('Sun')
  const [selectedSign, setSelectedSign] = useState('Aries')
  const [trainingStatus, setTrainingStatus] = useState<
    'idle' | 'training' | 'completed' | 'failed'
  >('idle')
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [useCustomPrompt, setUseCustomPrompt] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')

  const planets = [
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
  ]
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

  // Get the dignity of the current planet in the selected sign
  const dignity = planetaryDignities[
    selectedPlanet as keyof typeof planetaryDignities
  ]?.domicile.includes(selectedSign)
    ? 'domicile'
    : planetaryDignities[selectedPlanet as keyof typeof planetaryDignities]?.exaltation.includes(
          selectedSign
        )
      ? 'exaltation'
      : planetaryDignities[selectedPlanet as keyof typeof planetaryDignities]?.detriment.includes(
            selectedSign
          )
        ? 'detriment'
        : planetaryDignities[selectedPlanet as keyof typeof planetaryDignities]?.fall.includes(
              selectedSign
            )
          ? 'fall'
          : 'peregrine'

  // Default training prompt based on planet and sign
  const getDefaultPrompt = () => {
    return `Train a specialized astrological agent for ${selectedPlanet} in ${selectedSign}.

This agent should embody the qualities of ${selectedPlanet} as expressed through the sign of ${selectedSign}.

Planetary Dignity: ${dignity.toUpperCase()}

The agent should:
1. Provide interpretations consistent with traditional astrological wisdom
2. Reflect the ${dignity} status of ${selectedPlanet} in ${selectedSign}
3. Offer practical guidance based on this planetary placement
4. Respond to questions with the appropriate tone and energy of this combination

Include knowledge from classical texts as well as modern interpretations.`
  }

  const handleStartTraining = () => {
    setTrainingStatus('training')
    setTrainingProgress(0)

    // Simulate training progress
    const interval = setInterval(() => {
      setTrainingProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          setTrainingStatus('completed')
          return 100
        }
        return prev + 5
      })
    }, 500)
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold text-center mb-2">Planetary Model Training</h1>
      <p className="text-center mb-8 max-w-2xl mx-auto">
        Train specialized Galileo AI models for each planetary position
      </p>

      <Tabs defaultValue="train" className="max-w-4xl mx-auto">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="train">Train Models</TabsTrigger>
          <TabsTrigger value="manage">Manage Models</TabsTrigger>
          <TabsTrigger value="batch">Batch Training</TabsTrigger>
        </TabsList>

        <TabsContent value="train">
          <Card>
            <CardHeader>
              <CardTitle>Train a Planetary Model</CardTitle>
              <CardDescription>
                Create a specialized model for a specific planet in a zodiac sign
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="planet">Planet</Label>
                  <Select
                    value={selectedPlanet}
                    onValueChange={(value: string) => setSelectedPlanet(value)}
                  >
                    <SelectTrigger id="planet">
                      <SelectValue placeholder="Select Planet" />
                    </SelectTrigger>
                    <SelectContent>
                      {planets.map(planet => (
                        <SelectItem key={planet} value={planet}>
                          {planet}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sign">Sign</Label>
                  <Select
                    value={selectedSign}
                    onValueChange={(value: string) => setSelectedSign(value)}
                  >
                    <SelectTrigger id="sign">
                      <SelectValue placeholder="Select Sign" />
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
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="custom-prompt">Use Custom Training Prompt</Label>
                  <Switch
                    id="custom-prompt"
                    checked={useCustomPrompt}
                    onCheckedChange={setUseCustomPrompt}
                  />
                </div>

                <Textarea
                  value={useCustomPrompt ? customPrompt : getDefaultPrompt()}
                  onChange={e => setCustomPrompt(e.target.value)}
                  disabled={!useCustomPrompt}
                  rows={10}
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>Dignity Status</Label>
                <div className="p-3 rounded-md bg-secondary/20">
                  <p className="font-medium">
                    {selectedPlanet} in {selectedSign}:{' '}
                    <span className="capitalize">{dignity}</span>
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    {dignity === 'domicile' &&
                      `${selectedPlanet} rules ${selectedSign} and is very strong in this sign.`}
                    {dignity === 'exaltation' &&
                      `${selectedPlanet} is exalted in ${selectedSign}, expressing its highest qualities.`}
                    {dignity === 'detriment' &&
                      `${selectedPlanet} is in detriment in ${selectedSign}, facing challenges in expression.`}
                    {dignity === 'fall' &&
                      `${selectedPlanet} is in fall in ${selectedSign}, experiencing significant difficulties.`}
                    {dignity === 'peregrine' &&
                      `${selectedPlanet} is peregrine in ${selectedSign}, neither strengthened nor weakened.`}
                  </p>
                </div>
              </div>

              {trainingStatus === 'training' && (
                <div className="space-y-2">
                  <Label>Training Progress</Label>
                  <div className="h-2 w-full bg-secondary rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-300 ease-in-out"
                      style={{ width: `${trainingProgress}%` }}
                    />
                  </div>
                  <p className="text-sm text-center">{trainingProgress}% Complete</p>
                </div>
              )}

              {trainingStatus === 'completed' && (
                <div className="p-3 rounded-md bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                  <p className="font-medium">Training Completed Successfully!</p>
                  <p className="text-sm mt-1">
                    Your model for {selectedPlanet} in {selectedSign} is now ready to use.
                  </p>
                </div>
              )}

              {trainingStatus === 'failed' && (
                <div className="p-3 rounded-md bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                  <p className="font-medium">Training Failed</p>
                  <p className="text-sm mt-1">
                    There was an error training your model. Please try again.
                  </p>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleStartTraining}
                disabled={trainingStatus === 'training'}
                className="w-full"
              >
                {trainingStatus === 'idle'
                  ? 'Start Training'
                  : trainingStatus === 'training'
                    ? 'Training in Progress...'
                    : trainingStatus === 'completed'
                      ? 'Train Again'
                      : 'Retry Training'}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="manage">
          <Card>
            <CardHeader>
              <CardTitle>Manage Trained Models</CardTitle>
              <CardDescription>
                View, test, and manage your trained planetary models
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Input placeholder="Search models..." />

                <div className="border rounded-md divide-y">
                  {planets.slice(0, 3).map(planet =>
                    signs.slice(0, 2).map(sign => (
                      <div
                        key={`${planet}-${sign}`}
                        className="p-4 flex items-center justify-between"
                      >
                        <div>
                          <p className="font-medium">
                            {planet} in {sign}
                          </p>
                          <p className="text-sm text-muted-foreground">Trained on 2025-05-10</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm">
                            Test
                          </Button>
                          <Button variant="outline" size="sm">
                            Edit
                          </Button>
                          <Button variant="destructive" size="sm">
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))
                  )}

                  <div className="p-4 text-center text-muted-foreground">
                    <p>Showing 6 of 120 models</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="batch">
          <Card>
            <CardHeader>
              <CardTitle>Batch Training</CardTitle>
              <CardDescription>Train multiple planetary models at once</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Select Planets</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {planets.map(planet => (
                    <div key={planet} className="flex items-center space-x-2">
                      <input type="checkbox" id={`planet-${planet}`} className="rounded" />
                      <Label htmlFor={`planet-${planet}`}>{planet}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Select Signs</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {signs.map(sign => (
                    <div key={sign} className="flex items-center space-x-2">
                      <input type="checkbox" id={`sign-${sign}`} className="rounded" />
                      <Label htmlFor={`sign-${sign}`}>{sign}</Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 border rounded-md bg-secondary/10">
                <p className="font-medium">Training Summary</p>
                <p className="text-sm mt-1">Selected: 0 planets × 0 signs = 0 models</p>
                <p className="text-sm text-muted-foreground">Estimated training time: 0 minutes</p>
              </div>
            </CardContent>
            <CardFooter>
              <Button className="w-full" disabled>
                Start Batch Training
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
