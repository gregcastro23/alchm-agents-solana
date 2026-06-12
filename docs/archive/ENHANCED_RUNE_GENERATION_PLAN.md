# Enhanced Natal Chart to Runic Sigil Generation System

## Response to Claude Code Plan Improvements

### **Key Integration Insights from Codebase Analysis**

1. **Leverage Existing Rune System**: The current rune system in `lib/runes/` is sophisticated with alchemical costs, power calculations, and multi-chart capabilities. We should extend this rather than create parallel systems.

2. **Utilize Advanced Pattern Recognition**: `lib/astrological-pattern-recognition.ts` already detects 11 aspect types and sacred patterns. We should build on this foundation.

3. **Unify Chart Geometry Extraction**: Multiple chart components exist - we need a unified approach for geometry extraction.

### **Enhanced Implementation Plan**

#### **Phase 1: Core Infrastructure Extension**

**1. Extend Existing Rune System** (`lib/runes/natal-sigil-runes.ts`)

```typescript
import { Rune, RuneEffect, AlchemicalCost } from './rune-system'
import { PatternConfiguration, Aspect } from '../astrological-pattern-recognition'

export interface NatalSigilRune extends Rune {
  sigilType: 'aspect-based' | 'pattern-based' | 'planetary-focused' | 'elemental-harmony'
  sourceGeometry: RuneGeometry
  aspectSignature: string // Unique identifier for aspect pattern
  visualStyle: 'nordic' | 'celtic' | 'alchemical' | 'cosmic'
  generatedImageUrl?: string
  svgGeometry?: string
  meditationInstructions: string[]
}

export interface RuneGeometry {
  aspectLines: EnhancedAspectLine[]
  centerPoint: { x: number; y: number }
  powerNodes: PowerNode[]
  sacredPatterns: PatternConfiguration[] // Use existing pattern detection
  chartBounds: { width: number; height: number }
}

export interface EnhancedAspectLine extends Aspect {
  coordinates: { x1: number; y1: number; x2: number; y2: number }
  visualWeight: number
  color: string
  runicStroke: string // Converted to runic pattern
}
```

**2. Enhance Pattern Recognition Integration** (`lib/runes/pattern-to-rune-converter.ts`)

```typescript
import { PatternConfiguration, detectPatterns } from '../astrological-pattern-recognition'
import { fetchImaginize } from '../astrologize'

export class PatternToRuneConverter {
  static convertPatternToPrompt(pattern: PatternConfiguration, style: string): string {
    const basePrompt = `Ancient ${style} runic sigil embodying ${pattern.type}:`

    switch (pattern.type) {
      case 'grand-trine':
        return `${basePrompt} Three-fold harmony in ${pattern.element} element, 
                flowing triangular energy pattern, sacred geometry of divine flow`
      case 't-square':
        return `${basePrompt} Dynamic tension cross, transformative challenge pattern,
                angular power lines converging at stress point`
      case 'yod':
        return `${basePrompt} Finger of God pattern, destiny activation sigil,
                two sextiles pointing to apex planet ${pattern.planets[0]}`
      // ... other patterns
    }
  }

  static async generateSigilFromPattern(
    pattern: PatternConfiguration,
    geometry: RuneGeometry,
    style: string
  ): Promise<NatalSigilRune> {
    const prompt = this.convertPatternToPrompt(pattern, style)

    const imageData = await fetchImaginize(prompt, {
      style_preset: `mystical-${style}`,
      width: 1024,
      height: 1024,
      cfg_scale: 12,
      steps: 50,
      // Pass geometry data for AI to incorporate
      geometryHints: {
        aspectCount: geometry.aspectLines.length,
        powerNodeCount: geometry.powerNodes.length,
        dominantPattern: pattern.type,
      },
    })

    return {
      id: `natal-sigil-${pattern.type}-${Date.now()}`,
      name: `${pattern.type} Natal Sigil`,
      symbol: this.generateRunicSymbol(pattern),
      element: this.mapPatternToElement(pattern),
      runeType: 'cosmic',
      sigilType: 'pattern-based',
      sourceGeometry: geometry,
      aspectSignature: this.generateAspectSignature(geometry.aspectLines),
      visualStyle: style,
      generatedImageUrl: imageData.generated_image_url,
      baseCost: this.calculateSigilCosts(pattern, geometry),
      currentCost: this.calculateSigilCosts(pattern, geometry),
      effects: this.generateSigilEffects(pattern),
      requirements: { minANumber: pattern.strength },
      rarity: this.calculateRarity(pattern.strength),
      description: `Personalized sigil derived from your natal ${pattern.type} pattern`,
      craftingTime: 15,
      meditationInstructions: this.generateMeditationInstructions(pattern),
    }
  }
}
```

#### **Phase 2: Chart Integration Enhancement**

**3. Unified Geometry Extraction Service** (`lib/chart-geometry-extractor.ts`)

```typescript
export class ChartGeometryExtractor {
  static extractFromSVG(svgElement: SVGElement): RuneGeometry {
    // Extract aspect lines from SVG paths
    const aspectLines = this.parseAspectLines(svgElement)
    const powerNodes = this.detectPowerNodes(aspectLines)
    const centerPoint = this.calculateChartCenter(svgElement)

    return {
      aspectLines,
      centerPoint,
      powerNodes,
      sacredPatterns: [], // Will be populated by pattern recognition
      chartBounds: this.getSVGBounds(svgElement),
    }
  }

  static extractFromCanvas(canvasElement: HTMLCanvasElement): RuneGeometry {
    // Canvas extraction logic
    // This is more complex but allows for pixel-level analysis
  }

  private static parseAspectLines(svgElement: SVGElement): EnhancedAspectLine[] {
    const lines = svgElement.querySelectorAll('line, path')
    return Array.from(lines)
      .filter(line => line.classList.contains('aspect-line'))
      .map(line => this.convertSVGLineToAspectLine(line))
  }
}
```

**4. Enhanced Chart Components**

Modify existing chart components to include geometry extraction:

```typescript
// In components/enhanced-chart-display.tsx
export function EnhancedChartDisplay({ chartData, showRuneGenerator = false }) {
  const [extractedGeometry, setExtractedGeometry] = useState<RuneGeometry | null>(null)
  const chartRef = useRef<SVGElement>(null)

  const handleExtractGeometry = useCallback(() => {
    if (chartRef.current) {
      const geometry = ChartGeometryExtractor.extractFromSVG(chartRef.current)
      const patterns = detectPatterns(chartData.planets) // Use existing function
      geometry.sacredPatterns = patterns
      setExtractedGeometry(geometry)
    }
  }, [chartData])

  return (
    <div>
      <svg ref={chartRef} className="chart-svg">
        {/* Existing chart rendering */}
      </svg>

      {showRuneGenerator && (
        <div className="mt-4">
          <Button onClick={handleExtractGeometry}>
            Extract Chart Geometry for Rune
          </Button>

          {extractedGeometry && (
            <NatalSigilGenerator
              geometry={extractedGeometry}
              chartData={chartData}
            />
          )}
        </div>
      )}
    </div>
  )
}
```

#### **Phase 3: Advanced UI Components**

**5. Natal Sigil Generator Component** (`components/natal-sigil-generator.tsx`)

```typescript
export function NatalSigilGenerator({
  geometry,
  chartData
}: {
  geometry: RuneGeometry
  chartData: any
}) {
  const [selectedStyle, setSelectedStyle] = useState<'nordic' | 'celtic' | 'alchemical' | 'cosmic'>('nordic')
  const [generatedSigil, setGeneratedSigil] = useState<NatalSigilRune | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  const handleGenerate = async () => {
    setIsGenerating(true)
    try {
      // Use the most prominent pattern for sigil generation
      const dominantPattern = geometry.sacredPatterns
        .sort((a, b) => b.strength - a.strength)[0]

      if (dominantPattern) {
        const sigil = await PatternToRuneConverter.generateSigilFromPattern(
          dominantPattern,
          geometry,
          selectedStyle
        )
        setGeneratedSigil(sigil)
      }
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Generate Your Natal Sigil</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Style Selection */}
          <div>
            <Label>Sigil Style</Label>
            <Select value={selectedStyle} onValueChange={setSelectedStyle}>
              <SelectItem value="nordic">Nordic (Angular, Runic)</SelectItem>
              <SelectItem value="celtic">Celtic (Flowing, Knotwork)</SelectItem>
              <SelectItem value="alchemical">Alchemical (Geometric, Hermetic)</SelectItem>
              <SelectItem value="cosmic">Cosmic (Starfield, Holographic)</SelectItem>
            </Select>
          </div>

          {/* Pattern Preview */}
          <div>
            <Label>Detected Sacred Patterns</Label>
            <div className="grid grid-cols-2 gap-2">
              {geometry.sacredPatterns.map((pattern, i) => (
                <div key={i} className="p-2 border rounded">
                  <div className="font-medium">{pattern.type}</div>
                  <div className="text-sm text-muted-foreground">
                    Strength: {pattern.strength}%
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Generation Controls */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full"
          >
            {isGenerating ? 'Generating Sigil...' : 'Generate Natal Sigil'}
          </Button>

          {/* Generated Sigil Display */}
          {generatedSigil && (
            <SigilDisplay sigil={generatedSigil} />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
```

#### **Phase 4: API Enhancement**

**6. Enhanced API Route** (`app/api/generate-natal-sigil/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { PatternToRuneConverter } from '@/lib/runes/pattern-to-rune-converter'
import { detectPatterns } from '@/lib/astrological-pattern-recognition'
import { BirthInfoSchema } from '@/lib/schemas'

export async function POST(request: NextRequest) {
  try {
    const { birthInfo, geometry, style, patternType } = await request.json()

    // Validate birth info if provided
    if (birthInfo) {
      BirthInfoSchema.parse(birthInfo)
    }

    // If no geometry provided, generate from birth info
    let finalGeometry = geometry
    if (!finalGeometry && birthInfo) {
      // Generate chart and extract geometry
      const chartData = await generateChartFromBirthInfo(birthInfo)
      finalGeometry = await extractGeometryFromChartData(chartData)
    }

    // Detect patterns if not provided
    if (!finalGeometry.sacredPatterns.length) {
      const patterns = detectPatterns(/* planet positions from geometry */)
      finalGeometry.sacredPatterns = patterns
    }

    // Generate sigil from dominant pattern
    const dominantPattern = finalGeometry.sacredPatterns.sort((a, b) => b.strength - a.strength)[0]

    if (!dominantPattern) {
      return NextResponse.json(
        { error: 'No significant patterns found for sigil generation' },
        { status: 400 }
      )
    }

    const sigil = await PatternToRuneConverter.generateSigilFromPattern(
      dominantPattern,
      finalGeometry,
      style || 'nordic'
    )

    return NextResponse.json({
      success: true,
      sigil,
      sourcePattern: dominantPattern,
      geometry: finalGeometry,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate natal sigil', details: error.message },
      { status: 500 }
    )
  }
}
```

### **Key Improvements Over Original Plan**

1. **Leverages Existing Infrastructure**: Builds on the sophisticated rune system already in place
2. **Integrates Pattern Recognition**: Uses the advanced pattern detection already implemented
3. **Unified Geometry Extraction**: Creates a single service for extracting geometry from different chart types
4. **Enhanced Error Handling**: Includes fallbacks and graceful degradation
5. **Better Type Safety**: Uses existing TypeScript interfaces and schemas
6. **Alchemical Integration**: Connects to the existing alchemical cost and power systems

### **Integration Points**

- **Chart of the Moment**: Add sigil generation button to `/chart-of-the-moment/page.tsx`
- **Agent Charts**: Include sigil options in `/agents/[planet]/[sign]/[degree]/page.tsx`
- **Gallery Integration**: Add sigil gallery to existing rune displays
- **Monica Integration**: Allow Monica to explain sigil meanings and usage

### **Testing Strategy**

1. **Unit Tests**: Test pattern-to-prompt conversion algorithms
2. **Integration Tests**: Test with various chart complexities from existing test data
3. **Visual Tests**: Verify sigil generation consistency across styles
4. **Performance Tests**: Ensure imaginize API calls don't block UI

This enhanced approach maintains backward compatibility while adding powerful new capabilities that integrate seamlessly with the existing codebase architecture.
