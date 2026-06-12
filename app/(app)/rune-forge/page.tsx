'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Hammer,
  Upload,
  Sparkles,
  Download,
  Grid,
  User,
  Calendar,
  MapPin,
  Clock,
  Info,
  ChevronRight,
  Plus,
  X,
} from 'lucide-react'
import dynamic from 'next/dynamic'

const NatalSigilGenerator = dynamic(() => import('@/components/misc/natal-sigil-generator'), {
  loading: () => (
    <div className="flex items-center justify-center h-32">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  ),
  ssr: false,
})
import { MeditationGuidance } from '@/components/sigil/meditation-guidance'
import { BatchSigilGenerator } from '@/components/sigil/batch-sigil-generator'
import { useIsMobile } from '@/hooks/use-mobile'
import QuickChartInput from '@/components/charts/quick-chart-input'
import { ChartGeometryExtractor } from '@/lib/chart-geometry-extractor'
import { detectPatternsStatic, PlanetPosition } from '@/lib/astrological-pattern-recognition'
import {
  calculateEnhancedChart,
  parseBirthData,
  geocodeLocation,
} from '@/lib/enhanced-chart-calculator'
import { RuneGeometry, NatalSigilRune, SigilStyle } from '@/lib/runes/natal-sigil-runes'
import { PatternToRuneConverter } from '@/lib/runes/pattern-to-rune-converter'
import { downloadSigilCollection } from '@/lib/sigil-download'
import type { BirthInfo } from '@/lib/schemas'
import Image from 'next/image'

const QuickChartInputAny = QuickChartInput as any

interface GeneratedSigil extends NatalSigilRune {
  generationTime: string
  birthInfo?: BirthInfo
}

export default function RuneForgePage() {
  const isMobile = useIsMobile()
  const [activeTab, setActiveTab] = useState('quick')
  const [birthInfo, setBirthInfo] = useState<BirthInfo | null>(null)
  const [geometry, setGeometry] = useState<RuneGeometry | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generatedSigils, setGeneratedSigils] = useState<GeneratedSigil[]>([])
  const [selectedSigilIndex, setSelectedSigilIndex] = useState<number | null>(null)
  const [showMeditationGuidance, setShowMeditationGuidance] = useState(false)
  const [showBatchGenerator, setShowBatchGenerator] = useState(false)

  // Manual input fields
  const [manualInput, setManualInput] = useState({
    name: '',
    date: '',
    time: '',
    location: '',
  })

  const handleQuickChartSubmit = useCallback(async (chartData: any) => {
    setIsProcessing(true)
    setError(null)

    try {
      // Parse the chart data
      let parsedBirthInfo: BirthInfo | null = null

      if (typeof chartData === 'string') {
        // Parse text input
        const parsed = parseBirthData(chartData)
        if (parsed.year && parsed.month !== undefined && parsed.day) {
          parsedBirthInfo = {
            name: parsed.name || 'Subject',
            year: parsed.year,
            month: parsed.month,
            day: parsed.day,
            hour: parsed.hour || 12,
            minute: parsed.minute || 0,
            latitude: 0,
            longitude: 0,
          }
        }
      } else if (chartData.birthInfo) {
        parsedBirthInfo = chartData.birthInfo
      }

      if (!parsedBirthInfo) {
        throw new Error('Invalid chart data format')
      }

      setBirthInfo(parsedBirthInfo)

      // Calculate enhanced chart
      console.log('Calculating chart...')
      const enhancedChart = await calculateEnhancedChart(parsedBirthInfo, false)

      // Extract geometry
      const planetPositions: PlanetPosition[] = enhancedChart.planets.map(p => ({
        planet: p.planet,
        sign: p.sign,
        degree: p.degree,
        house: p.house,
      }))

      const extractedGeometry = ChartGeometryExtractor.extractFromChartData(
        planetPositions,
        enhancedChart.aspects as any,
        800,
        800
      )

      extractedGeometry.sacredPatterns = enhancedChart.patterns as any
      extractedGeometry.dominantElement = enhancedChart.alchemicalData.dominantElement

      setGeometry(extractedGeometry)
      setActiveTab('generate')
    } catch (err) {
      console.error('Error processing chart:', err)
      setError(err instanceof Error ? err.message : 'Failed to process chart data')
    } finally {
      setIsProcessing(false)
    }
  }, [])

  const handleManualSubmit = useCallback(async () => {
    setIsProcessing(true)
    setError(null)

    try {
      // Parse date
      const dateParts = manualInput.date.split('-')
      const year = parseInt(dateParts[0])
      const month = parseInt(dateParts[1]) - 1 // Zero-based month
      const day = parseInt(dateParts[2])

      // Parse time
      const timeParts = manualInput.time.split(':')
      const hour = parseInt(timeParts[0] || '12')
      const minute = parseInt(timeParts[1] || '0')

      // Geocode location
      const coords = await geocodeLocation(manualInput.location)
      if (!coords) {
        throw new Error('Unable to geocode location')
      }

      const parsedBirthInfo: BirthInfo = {
        name: manualInput.name || 'Subject',
        year,
        month,
        day,
        hour,
        minute,
        latitude: coords.latitude,
        longitude: coords.longitude,
      }

      setBirthInfo(parsedBirthInfo)

      // Calculate chart and extract geometry
      const enhancedChart = await calculateEnhancedChart(parsedBirthInfo, false)

      const planetPositions: PlanetPosition[] = enhancedChart.planets.map(p => ({
        planet: p.planet,
        sign: p.sign,
        degree: p.degree,
        house: p.house,
      }))

      const extractedGeometry = ChartGeometryExtractor.extractFromChartData(
        planetPositions,
        enhancedChart.aspects as any,
        800,
        800
      )

      extractedGeometry.sacredPatterns = enhancedChart.patterns as any
      extractedGeometry.dominantElement = enhancedChart.alchemicalData.dominantElement

      setGeometry(extractedGeometry)
      setActiveTab('generate')
    } catch (err) {
      console.error('Error processing manual input:', err)
      setError(err instanceof Error ? err.message : 'Failed to process birth data')
    } finally {
      setIsProcessing(false)
    }
  }, [manualInput])

  const handleSigilGenerated = useCallback(
    (sigil: NatalSigilRune) => {
      const newSigil: GeneratedSigil = {
        ...sigil,
        generationTime: new Date().toISOString(),
        birthInfo: birthInfo ?? undefined,
      }
      setGeneratedSigils(prev => [...prev, newSigil])
      setActiveTab('gallery')
    },
    [birthInfo]
  )

  const handleBatchGenerate = useCallback(async () => {
    if (!geometry) return

    setIsProcessing(true)
    setError(null)

    try {
      const styles: SigilStyle[] = ['nordic', 'celtic', 'alchemical', 'cosmic']

      // Generate variations for each style
      if (geometry.sacredPatterns.length > 0) {
        const dominantPattern = geometry.sacredPatterns[0]
        const variations = await PatternToRuneConverter.generateSigilVariations(
          dominantPattern,
          geometry,
          styles
        )

        const newSigils: GeneratedSigil[] = variations.map(sigil => ({
          ...sigil,
          generationTime: new Date().toISOString(),
          birthInfo: birthInfo ?? undefined,
        }))

        setGeneratedSigils(prev => [...prev, ...newSigils])
        setActiveTab('gallery')
      } else {
        throw new Error('No patterns found for batch generation')
      }
    } catch (err) {
      console.error('Error in batch generation:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate sigil variations')
    } finally {
      setIsProcessing(false)
    }
  }, [geometry, birthInfo])

  const handleDownloadAll = useCallback(async () => {
    try {
      await downloadSigilCollection(generatedSigils, 'rune-forge-sigils')
    } catch (err) {
      console.error('Error downloading sigil collection:', err)
      setError(err instanceof Error ? err.message : 'Failed to download sigil collection')
    }
  }, [generatedSigils])

  const handleBatchSigilsGenerated = useCallback((newSigils: GeneratedSigil[]) => {
    setGeneratedSigils(prev => [...prev, ...newSigils])
    setActiveTab('gallery')
    setShowBatchGenerator(false)
  }, [])

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-bold mb-3 flex items-center justify-center gap-3">
          <Hammer className="w-8 h-8 text-purple-500" />
          Rune Forge
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Transform your natal chart geometry into personalized runic sigils for meditation and
          magical practice
        </p>
      </div>

      {/* Main Content */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-6'} w-full mb-6`}>
          {isMobile ? (
            <>
              <TabsTrigger value="quick" className="text-xs">
                <Upload className="w-4 h-4 mr-1" />
                Input
              </TabsTrigger>
              <TabsTrigger value="manual" className="text-xs">
                <User className="w-4 h-4 mr-1" />
                Manual
              </TabsTrigger>
              {geometry && (
                <>
                  <TabsTrigger value="generate" className="text-xs">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Generate
                  </TabsTrigger>
                  <TabsTrigger value="batch" className="text-xs">
                    <Grid className="w-4 h-4 mr-1" />
                    Batch
                  </TabsTrigger>
                </>
              )}
              {generatedSigils.length > 0 && (
                <>
                  <TabsTrigger value="meditation" className="text-xs">
                    <Sparkles className="w-4 h-4 mr-1" />
                    Meditate
                  </TabsTrigger>
                  <TabsTrigger value="gallery" className="text-xs">
                    <Grid className="w-4 h-4 mr-1" />
                    Gallery
                  </TabsTrigger>
                </>
              )}
            </>
          ) : (
            <>
              <TabsTrigger value="quick">Quick Input</TabsTrigger>
              <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              <TabsTrigger value="generate" disabled={!geometry}>
                Generate
              </TabsTrigger>
              <TabsTrigger value="batch" disabled={!geometry}>
                Batch
              </TabsTrigger>
              <TabsTrigger value="meditation" disabled={generatedSigils.length === 0}>
                Meditation
              </TabsTrigger>
              <TabsTrigger value="gallery" disabled={generatedSigils.length === 0}>
                Gallery ({generatedSigils.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Quick Input Tab */}
        <TabsContent value="quick">
          <Card>
            <CardHeader>
              <CardTitle>Quick Chart Input</CardTitle>
              <CardDescription>
                Paste your birth data or upload a chart file to begin
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuickChartInputAny
                onChartSubmit={handleQuickChartSubmit}
                disabled={isProcessing}
                showAnalysis={false}
                placeholder='Enter birth data (e.g., "John Doe, March 15 1990, 2:30 PM, New York")'
              />

              {isProcessing && (
                <div className="mt-4 space-y-2">
                  <Progress value={50} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    Processing chart data...
                  </p>
                </div>
              )}

              {error && (
                <Alert variant="destructive" className="mt-4">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Entry Tab */}
        <TabsContent value="manual">
          <Card>
            <CardHeader>
              <CardTitle>Manual Birth Data Entry</CardTitle>
              <CardDescription>
                Enter birth information manually to generate your natal sigil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
                <div>
                  <Label htmlFor="name">
                    <User className="w-4 h-4 inline mr-1" />
                    Name
                  </Label>
                  <Input
                    id="name"
                    value={manualInput.name}
                    onChange={e => setManualInput(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                  />
                </div>

                <div>
                  <Label htmlFor="date">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Birth Date
                  </Label>
                  <Input
                    id="date"
                    type="date"
                    value={manualInput.date}
                    onChange={e => setManualInput(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="time">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Birth Time
                  </Label>
                  <Input
                    id="time"
                    type="time"
                    value={manualInput.time}
                    onChange={e => setManualInput(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>

                <div>
                  <Label htmlFor="location">
                    <MapPin className="w-4 h-4 inline mr-1" />
                    Birth Location
                  </Label>
                  <Input
                    id="location"
                    value={manualInput.location}
                    onChange={e => setManualInput(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="City, Country"
                  />
                </div>
              </div>

              <Button
                onClick={handleManualSubmit}
                disabled={isProcessing || !manualInput.date || !manualInput.location}
                className="w-full"
              >
                {isProcessing ? 'Processing...' : 'Process Birth Data'}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generate Tab */}
        <TabsContent value="generate">
          {geometry ? (
            <div className="space-y-6">
              {/* Chart Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Chart Analysis Complete</CardTitle>
                  <CardDescription>
                    {birthInfo?.name || 'Subject'} •{' '}
                    {birthInfo &&
                      new Date(birthInfo.year, birthInfo.month, birthInfo.day).toLocaleDateString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} gap-4 text-center`}
                  >
                    <div className="p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{geometry.aspectLines.length}</div>
                      <div className="text-xs text-muted-foreground">Aspects</div>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{geometry.powerNodes.length}</div>
                      <div className="text-xs text-muted-foreground">Power Nodes</div>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{geometry.sacredPatterns.length}</div>
                      <div className="text-xs text-muted-foreground">Patterns</div>
                    </div>
                    <div className="p-3 bg-muted rounded">
                      <div className="text-2xl font-bold">{geometry.dominantElement}</div>
                      <div className="text-xs text-muted-foreground">Element</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Batch Generation */}
              <Card>
                <CardHeader>
                  <CardTitle>Batch Generation</CardTitle>
                  <CardDescription>Generate sigils in all four styles at once</CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={handleBatchGenerate} disabled={isProcessing} className="w-full">
                    <Grid className="mr-2 h-4 w-4" />
                    Generate All Styles
                  </Button>
                </CardContent>
              </Card>

              {/* Single Generation */}
              <NatalSigilGenerator
                geometry={geometry}
                chartData={{ birthInfo }}
                onSigilGenerated={handleSigilGenerated}
              />
            </div>
          ) : (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Please input birth data first to generate your natal sigil
              </AlertDescription>
            </Alert>
          )}
        </TabsContent>

        {/* Gallery Tab */}
        <TabsContent value="gallery">
          <Card>
            <CardHeader>
              <CardTitle>Generated Sigils</CardTitle>
              <CardDescription>
                Your collection of {generatedSigils.length} natal sigil
                {generatedSigils.length !== 1 ? 's' : ''}
              </CardDescription>
              {generatedSigils.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleDownloadAll} className="ml-auto">
                  <Download className="mr-2 h-4 w-4" />
                  Download All
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {generatedSigils.map((sigil, index) => (
                  <Card
                    key={index}
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => setSelectedSigilIndex(index)}
                  >
                    <div className="aspect-square relative bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-t-lg overflow-hidden">
                      {sigil.generatedImageUrl ? (
                        <Image
                          src={sigil.generatedImageUrl}
                          alt={sigil.name}
                          fill
                          className="object-contain p-2"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="text-4xl">{sigil.symbol}</div>
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-sm">{sigil.name}</h3>
                        <Badge variant="outline" className="text-xs capitalize">
                          {sigil.visualStyle}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        Power Level: {sigil.powerLevel}%
                      </p>
                      <div className="flex gap-1">
                        {sigil.effects.slice(0, 2).map((effect, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {effect.type}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Batch Generation Tab */}
        <TabsContent value="batch">
          <BatchSigilGenerator
            geometry={geometry!}
            birthInfo={birthInfo ?? undefined}
            onSigilsGenerated={handleBatchSigilsGenerated}
          />
        </TabsContent>

        {/* Meditation Guidance Tab */}
        <TabsContent value="meditation">
          {generatedSigils.length > 0 && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Choose a Sigil for Meditation</CardTitle>
                  <CardDescription>
                    Select one of your generated sigils to begin guided meditation practice
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div
                    className={`grid ${isMobile ? 'grid-cols-2' : 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4'} gap-4`}
                  >
                    {generatedSigils.map((sigil, index) => (
                      <div
                        key={sigil.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-all hover:border-purple-500 hover:bg-purple-900/10 ${
                          selectedSigilIndex === index
                            ? 'border-purple-500 bg-purple-900/20'
                            : 'border-slate-600'
                        }`}
                        onClick={() => setSelectedSigilIndex(index)}
                      >
                        <div className="aspect-square relative bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-md overflow-hidden mb-2">
                          {sigil.generatedImageUrl ? (
                            <Image
                              src={sigil.generatedImageUrl}
                              alt={sigil.name}
                              fill
                              className="object-contain p-2"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="text-2xl">{sigil.symbol}</div>
                            </div>
                          )}
                        </div>
                        <h4 className="font-medium text-sm text-center truncate">{sigil.name}</h4>
                        <p className="text-xs text-center text-muted-foreground capitalize">
                          {sigil.visualStyle}
                        </p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {selectedSigilIndex !== null && (
                <MeditationGuidance
                  sigil={generatedSigils[selectedSigilIndex]}
                  isVisible={true}
                  onComplete={() => {
                    // Optional: Add completion tracking or other actions
                    console.log(
                      'Meditation completed for:',
                      generatedSigils[selectedSigilIndex].name
                    )
                  }}
                />
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Selected Sigil Modal */}
      {selectedSigilIndex !== null && generatedSigils[selectedSigilIndex] && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setSelectedSigilIndex(null)}
        >
          <Card
            className="max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{generatedSigils[selectedSigilIndex].name}</CardTitle>
                <Button variant="ghost" size="sm" onClick={() => setSelectedSigilIndex(null)}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sigil Image */}
              <div className="aspect-square relative bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg overflow-hidden">
                {generatedSigils[selectedSigilIndex].generatedImageUrl ? (
                  <Image
                    src={generatedSigils[selectedSigilIndex].generatedImageUrl!}
                    alt={generatedSigils[selectedSigilIndex].name}
                    fill
                    className="object-contain p-8"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-8xl">{generatedSigils[selectedSigilIndex].symbol}</div>
                  </div>
                )}
              </div>

              {/* Details */}
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Personal Meaning</h4>
                  <p className="text-sm text-muted-foreground">
                    {generatedSigils[selectedSigilIndex].personalizedMeaning}
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="font-medium mb-2">Meditation Instructions</h4>
                  <ol className="space-y-1 text-sm text-muted-foreground">
                    {generatedSigils[selectedSigilIndex].meditationInstructions.map(
                      (instruction, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="font-medium">{i + 1}.</span>
                          <span>{instruction}</span>
                        </li>
                      )
                    )}
                  </ol>
                </div>

                {generatedSigils[selectedSigilIndex].activationRitual && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="font-medium mb-2">Activation Ritual</h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedSigils[selectedSigilIndex].activationRitual}
                      </p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
