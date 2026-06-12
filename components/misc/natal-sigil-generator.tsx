'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Sparkles,
  Download,
  Loader2,
  Eye,
  Wand2,
  Info,
  ChevronRight,
  Zap,
  Star,
  Shield,
  Compass,
  Mountain,
  Activity,
  Brain,
  Heart,
  RotateCw,
} from 'lucide-react'
import {
  RuneGeometry,
  SigilStyle,
  NatalSigilRune,
  SIGIL_STYLE_PARAMS,
  calculateSigilPower,
  calculateSigilCosts,
} from '@/lib/runes/natal-sigil-runes'
import { PatternToRuneConverter } from '@/lib/runes/pattern-to-rune-converter'
import { PatternConfiguration } from '@/lib/astrological-pattern-recognition'
import { downloadSigilAsset } from '@/lib/sigil-download'
import Image from 'next/image'

interface NatalSigilGeneratorProps {
  geometry: RuneGeometry
  chartData?: any
  onSigilGenerated?: (sigil: NatalSigilRune) => void
}

const styleIcons: Record<SigilStyle, React.ReactNode> = {
  nordic: <Mountain className="w-4 h-4" />,
  celtic: <Compass className="w-4 h-4" />,
  alchemical: <Shield className="w-4 h-4" />,
  cosmic: <Star className="w-4 h-4" />,
}

export default function NatalSigilGenerator({
  geometry,
  chartData,
  onSigilGenerated,
}: NatalSigilGeneratorProps) {
  const [selectedStyle, setSelectedStyle] = useState<SigilStyle>('nordic')
  const [generatedSigil, setGeneratedSigil] = useState<NatalSigilRune | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState('generate')
  const [recommendedStyle, setRecommendedStyle] = useState<SigilStyle | null>(null)

  // Calculate sigil metrics
  const sigilPower = calculateSigilPower(geometry)
  const sigilCosts = calculateSigilCosts(geometry, selectedStyle)

  // Determine recommended style based on dominant pattern
  useEffect(() => {
    if (geometry.sacredPatterns.length > 0) {
      const dominantPattern = geometry.sacredPatterns.sort((a, b) => b.strength - a.strength)[0]
      const recommended = PatternToRuneConverter.recommendStyle(dominantPattern)
      setRecommendedStyle(recommended)
    }
  }, [geometry])

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setError(null)

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setGenerationProgress(prev => Math.min(prev + 10, 90))
      }, 200)

      // Determine generation method based on patterns
      let sigil: NatalSigilRune

      if (geometry.sacredPatterns.length > 0) {
        // Use dominant pattern for sigil generation
        const dominantPattern = geometry.sacredPatterns.sort((a, b) => b.strength - a.strength)[0]

        // Generate via API
        const response = await fetch('/api/generate-natal-sigil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geometry,
            style: selectedStyle,
            patternType: dominantPattern.type,
            chartData,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate sigil')
        }

        const data = await response.json()
        sigil = data.sigil
      } else {
        // Generate aspect-focused sigil
        const prompt = PatternToRuneConverter.generateAspectFocusedPrompt(geometry, selectedStyle)

        const response = await fetch('/api/generate-natal-sigil', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            geometry,
            style: selectedStyle,
            aspectFocused: true,
            prompt,
            chartData,
          }),
        })

        if (!response.ok) {
          throw new Error('Failed to generate sigil')
        }

        const data = await response.json()
        sigil = data.sigil
      }

      clearInterval(progressInterval)
      setGenerationProgress(100)
      setGeneratedSigil(sigil)
      setActiveTab('display')

      if (onSigilGenerated) {
        onSigilGenerated(sigil)
      }
    } catch (err) {
      console.error('Error generating sigil:', err)
      setError(err instanceof Error ? err.message : 'Failed to generate sigil')
    } finally {
      setIsGenerating(false)
      setGenerationProgress(0)
    }
  }, [geometry, selectedStyle, chartData, onSigilGenerated])

  const handleDownload = useCallback(
    async (format: 'png' | 'svg' | 'pdf') => {
      if (!generatedSigil) return

      try {
        await downloadSigilAsset(generatedSigil, format)
      } catch (err) {
        console.error('Error downloading sigil:', err)
        setError(err instanceof Error ? err.message : 'Failed to download sigil')
      }
    },
    [generatedSigil]
  )

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="w-5 h-5 text-purple-500" />
            Generate Your Natal Sigil
          </CardTitle>
          <CardDescription>
            Transform your unique astrological geometry into a personalized magical sigil
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid grid-cols-3 w-full">
              <TabsTrigger value="generate">Generate</TabsTrigger>
              <TabsTrigger value="display" disabled={!generatedSigil}>
                Display
              </TabsTrigger>
              <TabsTrigger value="instructions" disabled={!generatedSigil}>
                Instructions
              </TabsTrigger>
            </TabsList>

            <TabsContent value="generate" className="space-y-6">
              {/* Style Selection */}
              <div className="space-y-3">
                <Label>Sigil Style</Label>
                <Select
                  value={selectedStyle}
                  onValueChange={v => setSelectedStyle(v as SigilStyle)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SIGIL_STYLE_PARAMS).map(([style, params]) => (
                      <SelectItem key={style} value={style}>
                        <div className="flex items-center gap-2">
                          {styleIcons[style as SigilStyle]}
                          <span className="capitalize">{style}</span>
                          {recommendedStyle === style && (
                            <Badge variant="secondary" className="ml-2 text-xs">
                              Recommended
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {recommendedStyle && recommendedStyle !== selectedStyle && (
                  <p className="text-sm text-muted-foreground">
                    💡 Based on your chart patterns, {recommendedStyle} style is recommended
                  </p>
                )}
              </div>

              {/* Geometry Preview */}
              <div className="space-y-3">
                <Label>Detected Sacred Patterns</Label>
                {geometry.sacredPatterns.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3">
                    {geometry.sacredPatterns.slice(0, 4).map((pattern, i) => (
                      <div
                        key={i}
                        className="p-3 border rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-sm">{pattern.type}</span>
                          <Badge variant="outline" className="text-xs">
                            {pattern.strength}%
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {pattern.interpretation}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <Alert>
                    <Info className="h-4 w-4" />
                    <AlertDescription>
                      No major patterns detected. Sigil will be generated from aspect geometry.
                    </AlertDescription>
                  </Alert>
                )}
              </div>

              {/* Aspect Summary */}
              <div className="space-y-3">
                <Label>Aspect Geometry</Label>
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="text-center p-2 border rounded">
                    <div className="text-2xl font-bold text-primary">
                      {geometry.aspectLines.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Aspect Lines</div>
                  </div>
                  <div className="text-center p-2 border rounded">
                    <div className="text-2xl font-bold text-purple-500">
                      {geometry.powerNodes.length}
                    </div>
                    <div className="text-xs text-muted-foreground">Power Nodes</div>
                  </div>
                  <div className="text-center p-2 border rounded">
                    <div className="text-2xl font-bold text-amber-500">{sigilPower}%</div>
                    <div className="text-xs text-muted-foreground">Sigil Power</div>
                  </div>
                </div>
              </div>

              {/* Elemental Balance */}
              <div className="space-y-3">
                <Label>Elemental Composition</Label>
                <div className="space-y-2">
                  {Object.entries(geometry.elementalBalance).map(([element, percentage]) => (
                    <div key={element} className="flex items-center gap-2">
                      <span className="text-sm capitalize w-16">{element}</span>
                      <Progress value={percentage} className="flex-1" />
                      <span className="text-sm text-muted-foreground w-10 text-right">
                        {percentage}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alchemical Costs */}
              <div className="space-y-3">
                <Label>Alchemical Investment</Label>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div className="text-center p-2 bg-red-500/10 rounded">
                    <div className="font-medium">{sigilCosts.spirit}</div>
                    <div className="text-xs text-muted-foreground">Spirit</div>
                  </div>
                  <div className="text-center p-2 bg-blue-500/10 rounded">
                    <div className="font-medium">{sigilCosts.essence}</div>
                    <div className="text-xs text-muted-foreground">Essence</div>
                  </div>
                  <div className="text-center p-2 bg-green-500/10 rounded">
                    <div className="font-medium">{sigilCosts.matter}</div>
                    <div className="text-xs text-muted-foreground">Matter</div>
                  </div>
                  <div className="text-center p-2 bg-yellow-500/10 rounded">
                    <div className="font-medium">{sigilCosts.substance}</div>
                    <div className="text-xs text-muted-foreground">Substance</div>
                  </div>
                </div>

                <div className="mt-4">
                  <Label>Sacred Stats Investment Matrix</Label>
                  <div className="grid grid-cols-7 gap-1 mt-2">
                    {[
                      {
                        icon: Zap,
                        label: 'Power',
                        value: Math.round(sigilCosts.spirit * 0.8 + sigilCosts.essence * 0.2),
                        color: 'text-orange-600',
                        bg: 'bg-orange-500/10',
                      },
                      {
                        icon: Activity,
                        label: 'Reson.',
                        value: Math.round(sigilCosts.essence * 0.9 + sigilCosts.substance * 0.1),
                        color: 'text-purple-600',
                        bg: 'bg-purple-500/10',
                      },
                      {
                        icon: Brain,
                        label: 'Wisdom',
                        value: Math.round(sigilCosts.matter * 0.7 + sigilCosts.spirit * 0.3),
                        color: 'text-indigo-600',
                        bg: 'bg-indigo-500/10',
                      },
                      {
                        icon: Heart,
                        label: 'Charis.',
                        value: Math.round(sigilCosts.essence * 0.6 + sigilCosts.spirit * 0.4),
                        color: 'text-pink-600',
                        bg: 'bg-pink-500/10',
                      },
                      {
                        icon: Eye,
                        label: 'Intuit.',
                        value: Math.round(sigilCosts.spirit * 0.5 + sigilCosts.substance * 0.5),
                        color: 'text-cyan-600',
                        bg: 'bg-cyan-500/10',
                      },
                      {
                        icon: RotateCw,
                        label: 'Adapt.',
                        value: Math.round(sigilCosts.substance * 0.8 + sigilCosts.essence * 0.2),
                        color: 'text-teal-600',
                        bg: 'bg-teal-500/10',
                      },
                      {
                        icon: Sparkles,
                        label: 'Vital.',
                        value: Math.round(sigilCosts.matter * 0.9 + sigilCosts.spirit * 0.1),
                        color: 'text-green-600',
                        bg: 'bg-green-500/10',
                      },
                    ].map((stat, i) => (
                      <div key={i} className={`text-center p-1.5 rounded ${stat.bg}`}>
                        <stat.icon className={`h-3 w-3 mx-auto mb-1 ${stat.color}`} />
                        <div className="font-mono text-xs">{stat.value}</div>
                        <div className="text-[9px] text-muted-foreground">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate Button */}
              <Button onClick={handleGenerate} disabled={isGenerating} className="w-full" size="lg">
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Sigil... {generationProgress}%
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Natal Sigil
                  </>
                )}
              </Button>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
            </TabsContent>

            <TabsContent value="display" className="space-y-6">
              {generatedSigil && (
                <>
                  {/* Sigil Display */}
                  <div className="relative aspect-square bg-gradient-to-br from-purple-900/20 to-blue-900/20 rounded-lg overflow-hidden">
                    {generatedSigil.generatedImageUrl ? (
                      <Image
                        src={generatedSigil.generatedImageUrl}
                        alt={generatedSigil.name}
                        fill
                        className="object-contain p-4"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-6xl">{generatedSigil.symbol}</div>
                      </div>
                    )}
                  </div>

                  {/* Sigil Details */}
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-semibold mb-2">{generatedSigil.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {generatedSigil.personalizedMeaning}
                      </p>
                    </div>

                    <Separator />

                    {/* Effects */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Zap className="w-4 h-4 text-yellow-500" />
                        Sigil Effects
                      </h4>
                      <div className="space-y-2">
                        {generatedSigil.effects.map((effect, i) => (
                          <div key={i} className="flex items-start gap-2 text-sm">
                            <ChevronRight className="w-4 h-4 mt-0.5 text-muted-foreground" />
                            <div>
                              <span className="font-medium">{effect.type}:</span>{' '}
                              {effect.description}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Download Options */}
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('png')}
                        className="flex-1"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PNG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('svg')}
                        className="flex-1"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        SVG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownload('pdf')}
                        className="flex-1"
                      >
                        <Download className="mr-2 h-4 w-4" />
                        PDF
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            <TabsContent value="instructions" className="space-y-6">
              {generatedSigil && (
                <>
                  {/* Meditation Instructions */}
                  <div>
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-purple-500" />
                      Meditation Instructions
                    </h4>
                    <ol className="space-y-2">
                      {generatedSigil.meditationInstructions.map((instruction, i) => (
                        <li key={i} className="flex gap-2 text-sm">
                          <span className="font-medium text-muted-foreground">{i + 1}.</span>
                          <span>{instruction}</span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <Separator />

                  {/* Activation Ritual */}
                  {generatedSigil.activationRitual && (
                    <div>
                      <h4 className="font-medium mb-3 flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-amber-500" />
                        Activation Ritual
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {generatedSigil.activationRitual}
                      </p>
                    </div>
                  )}

                  {/* Requirements */}
                  <div>
                    <h4 className="font-medium mb-3">Requirements</h4>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {generatedSigil.requirements.minANumber && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-muted-foreground">Min A#:</span>
                          <span className="font-medium">
                            {generatedSigil.requirements.minANumber}
                          </span>
                        </div>
                      )}
                      {generatedSigil.requirements.consciousness_level && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-muted-foreground">Consciousness:</span>
                          <span className="font-medium">
                            Level {generatedSigil.requirements.consciousness_level}
                          </span>
                        </div>
                      )}
                      {generatedSigil.requirements.moonPhase && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-muted-foreground">Moon Phase:</span>
                          <span className="font-medium capitalize">
                            {generatedSigil.requirements.moonPhase}
                          </span>
                        </div>
                      )}
                      {generatedSigil.craftingTime && (
                        <div className="flex justify-between p-2 bg-muted rounded">
                          <span className="text-muted-foreground">Crafting Time:</span>
                          <span className="font-medium">{generatedSigil.craftingTime} min</span>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
