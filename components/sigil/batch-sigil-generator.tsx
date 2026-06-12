'use client'

import React, { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Layers,
  Download,
  Sparkles,
  Grid,
  Palette,
  Settings,
  Star,
  Gem,
  Crown,
  Target,
  Eye,
  Flame,
  Waves,
  Wind,
  Mountain,
  Package,
  CheckCircle,
  X,
  RotateCcw,
} from 'lucide-react'
import { useIsMobile } from '@/hooks/use-mobile'
import type { NatalSigilRune, SigilStyle, RuneGeometry } from '@/lib/runes/natal-sigil-runes'
import {
  createSigilSvg,
  downloadSigilCollection,
  SIGIL_STYLE_SYMBOLS,
  sigilSvgToDataUrl,
} from '@/lib/sigil-download'
import type { BirthInfo } from '@/lib/schemas'

interface BatchSigilGeneratorProps {
  geometry: RuneGeometry
  birthInfo?: BirthInfo
  onSigilsGenerated: (sigils: GeneratedSigil[]) => void
  className?: string
}

interface GeneratedSigil extends NatalSigilRune {
  generationTime: string
  birthInfo?: BirthInfo
  variation?: string
}

interface BatchOptions {
  styles: SigilStyle[]
  includeVariations: boolean
  variationCount: number
  includePowerLevels: boolean
  powerLevels: ('minor' | 'standard' | 'major' | 'transcendent')[]
  includeElementalFocus: boolean
  elementalFoci: ('fire' | 'water' | 'air' | 'earth' | 'spirit')[]
  includeTimingVariations: boolean
  generateMeditations: boolean
  exportFormat: 'individual' | 'collection' | 'both'
}

const STYLE_DESCRIPTIONS = {
  nordic: {
    name: 'Nordic Runic',
    element: 'Ice & Fire',
    description: 'Ancient Norse power with crystalline clarity',
    icon: <Mountain className="w-5 h-5" />,
    color: 'text-blue-400',
  },
  celtic: {
    name: 'Celtic Spiral',
    element: 'Earth & Water',
    description: 'Sacred geometry of the ancient Celts',
    icon: <Target className="w-5 h-5" />,
    color: 'text-green-400',
  },
  alchemical: {
    name: 'Alchemical',
    element: 'Fire & Mercury',
    description: 'Hermetic transformation symbols',
    icon: <Flame className="w-5 h-5" />,
    color: 'text-orange-400',
  },
  cosmic: {
    name: 'Cosmic',
    element: 'Ether & Light',
    description: 'Universal consciousness patterns',
    icon: <Star className="w-5 h-5" />,
    color: 'text-purple-400',
  },
}

const POWER_LEVEL_DESCRIPTIONS = {
  minor: {
    name: 'Minor Activation',
    description: 'Gentle introduction to sigil energy',
    intensity: 25,
    color: 'text-green-400',
  },
  standard: {
    name: 'Standard Power',
    description: 'Balanced activation for daily practice',
    intensity: 50,
    color: 'text-blue-400',
  },
  major: {
    name: 'Major Working',
    description: 'Powerful sigil for significant transformation',
    intensity: 75,
    color: 'text-orange-400',
  },
  transcendent: {
    name: 'Transcendent',
    description: 'Ultimate consciousness expansion',
    intensity: 100,
    color: 'text-purple-400',
  },
}

const ELEMENTAL_FOCUS_DESCRIPTIONS = {
  fire: {
    name: 'Fire Focus',
    description: 'Passion, energy, transformation',
    icon: <Flame className="w-4 h-4" />,
    color: 'text-red-400',
  },
  water: {
    name: 'Water Focus',
    description: 'Emotion, intuition, healing',
    icon: <Waves className="w-4 h-4" />,
    color: 'text-blue-400',
  },
  air: {
    name: 'Air Focus',
    description: 'Intellect, communication, clarity',
    icon: <Wind className="w-4 h-4" />,
    color: 'text-yellow-400',
  },
  earth: {
    name: 'Earth Focus',
    description: 'Grounding, manifestation, stability',
    icon: <Mountain className="w-4 h-4" />,
    color: 'text-green-400',
  },
  spirit: {
    name: 'Spirit Focus',
    description: 'Transcendence, unity, enlightenment',
    icon: <Sparkles className="w-4 h-4" />,
    color: 'text-purple-400',
  },
}

export function BatchSigilGenerator({
  geometry,
  birthInfo,
  onSigilsGenerated,
  className = '',
}: BatchSigilGeneratorProps) {
  const isMobile = useIsMobile()
  const [batchOptions, setBatchOptions] = useState<BatchOptions>({
    styles: ['nordic', 'celtic'],
    includeVariations: true,
    variationCount: 2,
    includePowerLevels: false,
    powerLevels: ['standard'],
    includeElementalFocus: false,
    elementalFoci: ['spirit'],
    includeTimingVariations: false,
    generateMeditations: true,
    exportFormat: 'both',
  })

  const [isGenerating, setIsGenerating] = useState(false)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [generatedSigils, setGeneratedSigils] = useState<GeneratedSigil[]>([])
  const [currentStep, setCurrentStep] = useState('')
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const estimatedSigilCount = useCallback(() => {
    let count = batchOptions.styles.length

    if (batchOptions.includeVariations) {
      count *= batchOptions.variationCount + 1
    }

    if (batchOptions.includePowerLevels) {
      count *= batchOptions.powerLevels.length
    }

    if (batchOptions.includeElementalFocus) {
      count *= batchOptions.elementalFoci.length
    }

    return count
  }, [batchOptions])

  const generateBatchSigils = useCallback(async () => {
    setIsGenerating(true)
    setGenerationProgress(0)
    setGeneratedSigils([])

    try {
      const sigils: GeneratedSigil[] = []
      const totalSteps = estimatedSigilCount()
      let currentStepIndex = 0

      for (const style of batchOptions.styles) {
        setCurrentStep(`Generating ${style} sigils...`)

        const baseVariations = batchOptions.includeVariations ? batchOptions.variationCount + 1 : 1
        const powerLevels = batchOptions.includePowerLevels
          ? batchOptions.powerLevels
          : ['standard']
        const elementalFoci = batchOptions.includeElementalFocus
          ? batchOptions.elementalFoci
          : ['spirit']

        for (let variation = 0; variation < baseVariations; variation++) {
          for (const powerLevel of powerLevels) {
            for (const elementalFocus of elementalFoci) {
              setCurrentStep(
                `Creating ${style} sigil (${powerLevel} power, ${elementalFocus} focus)...`
              )

              // Simulate API call for sigil generation
              await new Promise(resolve => setTimeout(resolve, 800))

              const sigil: any = {
                id: `batch-${Date.now()}-${currentStepIndex}`,
                name: `${style} Sigil ${variation > 0 ? `v${variation}` : ''}`,
                symbol: SIGIL_STYLE_SYMBOLS[style],
                visualStyle: style,
                sigilType: 'pattern-based',
                element: elementalFocus === 'spirit' ? 'spirit' : elementalFocus,
                runeType: 'cosmic',
                style,
                description: `${STYLE_DESCRIPTIONS[style].description} with ${powerLevel} power and ${elementalFocus} focus`,
                runeStrokes: geometry.aspectLines.map((line: any) => ({
                  startX: line.x1,
                  startY: line.y1,
                  endX: line.x2,
                  endY: line.y2,
                  strokeType: line.aspectType,
                  intensity:
                    POWER_LEVEL_DESCRIPTIONS[powerLevel as keyof typeof POWER_LEVEL_DESCRIPTIONS]
                      ?.intensity || 50,
                })),
                powerNodes: geometry.powerNodes,
                sacredPatterns: geometry.sacredPatterns,
                elementalBalance: {
                  fire: elementalFocus === 'fire' ? 1.0 : 0.25,
                  water: elementalFocus === 'water' ? 1.0 : 0.25,
                  air: elementalFocus === 'air' ? 1.0 : 0.25,
                  earth: elementalFocus === 'earth' ? 1.0 : 0.25,
                  spirit: elementalFocus === 'spirit' ? 1.0 : 0.5,
                },
                alchemicalCost: {
                  spirit: Math.floor(Math.random() * 50) + 25,
                  essence: Math.floor(Math.random() * 50) + 25,
                  matter: Math.floor(Math.random() * 50) + 25,
                  substance: Math.floor(Math.random() * 50) + 25,
                },
                effects: [
                  {
                    type: 'enhancement',
                    power:
                      POWER_LEVEL_DESCRIPTIONS[powerLevel as keyof typeof POWER_LEVEL_DESCRIPTIONS]
                        ?.intensity || 50,
                    duration: 'days',
                    description: `Enhanced ${elementalFocus} energy`,
                  },
                  {
                    type: 'active',
                    power:
                      POWER_LEVEL_DESCRIPTIONS[powerLevel as keyof typeof POWER_LEVEL_DESCRIPTIONS]
                        ?.intensity || 50,
                    duration: 'hours',
                    description: `${powerLevel} power activation`,
                  },
                ],
                activationInstructions: `Meditate on this sigil for ${powerLevel === 'minor' ? '5-10' : powerLevel === 'standard' ? '10-15' : powerLevel === 'major' ? '15-25' : '30+'} minutes to activate its ${elementalFocus} properties.`,
                personalizedMeaning: `${STYLE_DESCRIPTIONS[style].description} focused through ${elementalFocus} with ${powerLevel} activation.`,
                meditationInstructions: [
                  `Settle your attention on the ${style} sigil form.`,
                  `Breathe into the ${elementalFocus} current for three slow cycles.`,
                  'Name the transformation you are inviting, then release the image from effort.',
                ],
                requirements: {},
                rarity: powerLevel === 'transcendent' ? 'legendary' : 'rare',
                craftingTime:
                  powerLevel === 'minor'
                    ? 10
                    : powerLevel === 'standard'
                      ? 15
                      : powerLevel === 'major'
                        ? 25
                        : 35,
                powerLevel:
                  POWER_LEVEL_DESCRIPTIONS[powerLevel as keyof typeof POWER_LEVEL_DESCRIPTIONS]
                    ?.intensity || 50,
                generationTime: new Date().toISOString(),
                birthInfo,
                variation: variation > 0 ? `v${variation}` : undefined,
              }
              sigil.svgGeometry = createSigilSvg(sigil)
              sigil.generatedImageUrl = sigilSvgToDataUrl(sigil.svgGeometry)

              sigils.push(sigil)
              currentStepIndex++

              setGenerationProgress((currentStepIndex / totalSteps) * 100)
            }
          }
        }
      }

      setGeneratedSigils(sigils)
      onSigilsGenerated(sigils)
      setCurrentStep('Batch generation complete!')
    } catch (error) {
      console.error('Batch generation error:', error)
      setCurrentStep('Error during generation')
    } finally {
      setIsGenerating(false)
    }
  }, [batchOptions, geometry, birthInfo, estimatedSigilCount, onSigilsGenerated])

  const downloadGeneratedCollection = useCallback(async () => {
    setDownloadError(null)

    try {
      await downloadSigilCollection(generatedSigils, 'batch-sigil-collection')
    } catch (error) {
      console.error('Batch collection download error:', error)
      setDownloadError(
        error instanceof Error ? error.message : 'Failed to download sigil collection'
      )
    }
  }, [generatedSigils])

  const toggleStyle = (style: SigilStyle) => {
    setBatchOptions(prev => ({
      ...prev,
      styles: prev.styles.includes(style)
        ? prev.styles.filter(s => s !== style)
        : [...prev.styles, style],
    }))
  }

  const togglePowerLevel = (level: 'minor' | 'standard' | 'major' | 'transcendent') => {
    setBatchOptions(prev => ({
      ...prev,
      powerLevels: prev.powerLevels.includes(level)
        ? prev.powerLevels.filter(l => l !== level)
        : [...prev.powerLevels, level],
    }))
  }

  const toggleElementalFocus = (element: 'fire' | 'water' | 'air' | 'earth' | 'spirit') => {
    setBatchOptions(prev => ({
      ...prev,
      elementalFoci: prev.elementalFoci.includes(element)
        ? prev.elementalFoci.filter(e => e !== element)
        : [...prev.elementalFoci, element],
    }))
  }

  return (
    <Card
      className={`bg-gradient-to-br from-indigo-900/30 to-purple-900/30 border-purple-500/50 ${className}`}
    >
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-purple-300">Batch Sigil Generation</CardTitle>
              <CardDescription>
                Create multiple sigil variations with advanced options
              </CardDescription>
            </div>
          </div>
          <Badge className="bg-purple-600">{estimatedSigilCount()} sigils</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {isGenerating ? (
          // Generation Progress
          <div className="space-y-4">
            <div className="text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-purple-500 animate-pulse" />
              <h3 className="text-xl font-semibold mb-2">Generating Sigil Collection</h3>
              <p className="text-slate-300">{currentStep}</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Progress</span>
                <span>{Math.round(generationProgress)}%</span>
              </div>
              <Progress value={generationProgress} className="h-3" />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-3 bg-purple-900/30 rounded-lg text-center">
                <div className="text-lg font-bold text-purple-300">{generatedSigils.length}</div>
                <div className="text-xs text-slate-400">Generated</div>
              </div>
              <div className="p-3 bg-indigo-900/30 rounded-lg text-center">
                <div className="text-lg font-bold text-indigo-300">{estimatedSigilCount()}</div>
                <div className="text-xs text-slate-400">Total</div>
              </div>
              <div className="p-3 bg-pink-900/30 rounded-lg text-center">
                <div className="text-lg font-bold text-pink-300">{batchOptions.styles.length}</div>
                <div className="text-xs text-slate-400">Styles</div>
              </div>
              <div className="p-3 bg-green-900/30 rounded-lg text-center">
                <div className="text-lg font-bold text-green-300">
                  {batchOptions.generateMeditations ? 'Yes' : 'No'}
                </div>
                <div className="text-xs text-slate-400">Meditations</div>
              </div>
            </div>
          </div>
        ) : generatedSigils.length > 0 ? (
          // Generation Complete
          <div className="space-y-4">
            <div className="text-center">
              <CheckCircle className="w-16 h-16 mx-auto mb-4 text-green-500" />
              <h3 className="text-xl font-semibold mb-2 text-green-300">Generation Complete!</h3>
              <p className="text-green-200">
                Successfully generated {generatedSigils.length} unique sigils
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                className="bg-green-600 hover:bg-green-700"
                onClick={downloadGeneratedCollection}
              >
                <Download className="w-4 h-4 mr-2" />
                Download Collection
              </Button>
              <Button
                variant="outline"
                onClick={() => setGeneratedSigils([])}
                className="border-purple-500 text-purple-300"
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Generate New Batch
              </Button>
            </div>

            <div className="p-4 bg-green-900/20 rounded-lg border border-green-500/30">
              <h4 className="font-semibold text-green-300 mb-2">Collection Contents:</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                {batchOptions.styles.map(style => (
                  <div key={style} className="flex items-center gap-2">
                    {STYLE_DESCRIPTIONS[style].icon}
                    <span className="capitalize">{style}</span>
                  </div>
                ))}
              </div>
            </div>

            {downloadError && (
              <Alert variant="destructive">
                <AlertDescription>{downloadError}</AlertDescription>
              </Alert>
            )}
          </div>
        ) : (
          // Configuration Interface
          <Tabs defaultValue="styles" className="space-y-4">
            <TabsList
              className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} bg-slate-900/50`}
            >
              <TabsTrigger value="styles">Styles</TabsTrigger>
              <TabsTrigger value="variations">Variations</TabsTrigger>
              <TabsTrigger value="power">Power</TabsTrigger>
              <TabsTrigger value="export">Export</TabsTrigger>
            </TabsList>

            <TabsContent value="styles" className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-300">Select Sigil Styles</h3>
              <div
                className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-4`}
              >
                {Object.entries(STYLE_DESCRIPTIONS).map(([style, info]) => (
                  <div
                    key={style}
                    className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                      batchOptions.styles.includes(style as SigilStyle)
                        ? 'border-purple-500 bg-purple-900/20'
                        : 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50'
                    }`}
                    onClick={() => toggleStyle(style as SigilStyle)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={info.color}>{info.icon}</div>
                      <div>
                        <h4 className="font-semibold">{info.name}</h4>
                        <Badge variant="outline" className="text-xs">
                          {info.element}
                        </Badge>
                      </div>
                      {batchOptions.styles.includes(style as SigilStyle) && (
                        <CheckCircle className="w-5 h-5 text-green-500 ml-auto" />
                      )}
                    </div>
                    <p className="text-sm text-slate-400">{info.description}</p>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="variations" className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-300">Variation Options</h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="variations"
                    checked={batchOptions.includeVariations}
                    onCheckedChange={checked =>
                      setBatchOptions(prev => ({
                        ...prev,
                        includeVariations: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="variations">Include style variations</Label>
                </div>

                {batchOptions.includeVariations && (
                  <div className="space-y-2">
                    <Label>Number of variations per style: {batchOptions.variationCount}</Label>
                    <Slider
                      value={[batchOptions.variationCount]}
                      onValueChange={value =>
                        setBatchOptions(prev => ({
                          ...prev,
                          variationCount: value[0],
                        }))
                      }
                      min={1}
                      max={5}
                      step={1}
                      className="w-full"
                    />
                  </div>
                )}

                <Separator />

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="elementalFocus"
                    checked={batchOptions.includeElementalFocus}
                    onCheckedChange={checked =>
                      setBatchOptions(prev => ({
                        ...prev,
                        includeElementalFocus: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="elementalFocus">Include elemental focus variations</Label>
                </div>

                {batchOptions.includeElementalFocus && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {Object.entries(ELEMENTAL_FOCUS_DESCRIPTIONS).map(([element, info]) => (
                      <div
                        key={element}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          batchOptions.elementalFoci.includes(element as any)
                            ? 'border-purple-500 bg-purple-900/20'
                            : 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50'
                        }`}
                        onClick={() => toggleElementalFocus(element as any)}
                      >
                        <div className="flex items-center gap-2">
                          <div className={info.color}>{info.icon}</div>
                          <div>
                            <div className="font-medium text-sm">{info.name}</div>
                            <div className="text-xs text-slate-400">{info.description}</div>
                          </div>
                          {batchOptions.elementalFoci.includes(element as any) && (
                            <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="power" className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-300">Power Level Options</h3>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="powerLevels"
                  checked={batchOptions.includePowerLevels}
                  onCheckedChange={checked =>
                    setBatchOptions(prev => ({
                      ...prev,
                      includePowerLevels: !!checked,
                    }))
                  }
                />
                <Label htmlFor="powerLevels">Include multiple power levels</Label>
              </div>

              {batchOptions.includePowerLevels && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Object.entries(POWER_LEVEL_DESCRIPTIONS).map(([level, info]) => (
                    <div
                      key={level}
                      className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                        batchOptions.powerLevels.includes(level as any)
                          ? 'border-purple-500 bg-purple-900/20'
                          : 'border-slate-600 bg-slate-800/50 hover:bg-slate-700/50'
                      }`}
                      onClick={() => togglePowerLevel(level as any)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className={`font-semibold ${info.color}`}>{info.name}</h4>
                        {batchOptions.powerLevels.includes(level as any) && (
                          <CheckCircle className="w-5 h-5 text-green-500" />
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{info.description}</p>
                      <Progress value={info.intensity} className="h-2" />
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="export" className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-300">
                Export & Enhancement Options
              </h3>

              <div className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="meditations"
                    checked={batchOptions.generateMeditations}
                    onCheckedChange={checked =>
                      setBatchOptions(prev => ({
                        ...prev,
                        generateMeditations: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="meditations">Generate meditation guides for each sigil</Label>
                </div>

                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-500/30">
                  <h4 className="font-semibold text-purple-300 mb-3">Export Summary</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Estimated sigils:</span>
                      <span className="ml-2 font-mono">{estimatedSigilCount()}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Meditation guides:</span>
                      <span className="ml-2 font-mono">
                        {batchOptions.generateMeditations ? estimatedSigilCount() : 0}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400">Styles:</span>
                      <span className="ml-2 font-mono">{batchOptions.styles.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Total files:</span>
                      <span className="ml-2 font-mono">
                        {estimatedSigilCount() * (batchOptions.generateMeditations ? 2 : 1)}
                      </span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={generateBatchSigils}
                  disabled={batchOptions.styles.length === 0}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="lg"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  Generate {estimatedSigilCount()} Sigils
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}

export default BatchSigilGenerator
