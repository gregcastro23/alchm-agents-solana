# Component Integration Guide - Natal Sigil Generation

## Overview

This guide covers how to integrate the natal sigil generation components into existing and new parts of the Planetary Agents system.

## Core Components

### 1. NatalSigilGenerator

**Location:** `components/natal-sigil-generator.tsx`

**Purpose:** Interactive interface for generating personalized runic sigils from chart geometry.

#### Props Interface

```typescript
interface NatalSigilGeneratorProps {
  geometry: RuneGeometry // Required: Chart geometry data
  chartData?: any // Optional: Additional chart context
  onSigilGenerated?: (sigil: NatalSigilRune) => void // Optional: Callback for generated sigils
}
```

#### Basic Usage

```tsx
import NatalSigilGenerator from '@/components/natal-sigil-generator'
import { ChartGeometryExtractor } from '@/lib/chart-geometry-extractor'

function MyChartComponent({ chartData }) {
  const [geometry, setGeometry] = useState<RuneGeometry | null>(null)
  const [showGenerator, setShowGenerator] = useState(false)

  const handleGenerateRune = () => {
    // Extract geometry from chart
    const extractedGeometry = ChartGeometryExtractor.extractFromChartData(
      chartData.planets,
      chartData.aspects,
      800,
      800
    )

    setGeometry(extractedGeometry)
    setShowGenerator(true)
  }

  return (
    <div>
      {/* Your existing chart display */}
      <ChartDisplay data={chartData} />

      {/* Rune generation button */}
      <Button onClick={handleGenerateRune}>Generate Sigil</Button>

      {/* Conditional sigil generator */}
      {showGenerator && geometry && (
        <NatalSigilGenerator
          geometry={geometry}
          chartData={chartData}
          onSigilGenerated={sigil => {
            console.log('Generated sigil:', sigil)
            setShowGenerator(false)
          }}
        />
      )}
    </div>
  )
}
```

#### Advanced Integration

```tsx
function AdvancedChartComponent({ birthInfo, planetPositions }) {
  const [sigilHistory, setSigilHistory] = useState<NatalSigilRune[]>([])

  const handleSigilGenerated = useCallback(
    (sigil: NatalSigilRune) => {
      // Add to history
      setSigilHistory(prev => [...prev, sigil])

      // Store in localStorage
      localStorage.setItem('generated-sigils', JSON.stringify([...sigilHistory, sigil]))

      // Optional: Analytics tracking
      analytics.track('sigil_generated', {
        style: sigil.visualStyle,
        power: sigil.powerLevel,
        patterns: sigil.sourceGeometry.sacredPatterns.length,
      })
    },
    [sigilHistory]
  )

  return (
    <div>
      <NatalSigilGenerator
        geometry={geometry}
        chartData={{ birthInfo, planetPositions }}
        onSigilGenerated={handleSigilGenerated}
      />

      {/* Display sigil history */}
      <SigilGallery sigils={sigilHistory} />
    </div>
  )
}
```

### 2. ChartGeometryExtractor

**Location:** `lib/chart-geometry-extractor.ts`

**Purpose:** Extract aspect coordinates and patterns from various chart formats.

#### Methods

```typescript
// From planet positions and aspects
ChartGeometryExtractor.extractFromChartData(
  planets: PlanetPosition[],
  aspects: Aspect[],
  width?: number,
  height?: number
): RuneGeometry

// From SVG chart element
ChartGeometryExtractor.extractFromSVG(
  svgElement: SVGElement
): RuneGeometry

// From Canvas chart element
ChartGeometryExtractor.extractFromCanvas(
  canvasElement: HTMLCanvasElement
): RuneGeometry
```

#### Integration Examples

**With Existing Chart Components:**

```tsx
function ExistingChartComponent({ planets, aspects }) {
  const handleExtractGeometry = () => {
    // Convert to required format
    const planetPositions: PlanetPosition[] = planets.map(p => ({
      planet: p.name,
      sign: p.sign,
      degree: p.degree,
      house: p.house,
    }))

    // Extract geometry
    const geometry = ChartGeometryExtractor.extractFromChartData(planetPositions, aspects, 800, 800)

    // Use geometry for sigil generation
    return geometry
  }

  return (
    <div>
      <Button onClick={handleExtractGeometry}>Extract Chart Geometry</Button>
    </div>
  )
}
```

**With SVG Charts:**

```tsx
function SVGChartComponent() {
  const svgRef = useRef<SVGSVGElement>(null)

  const handleExtractFromSVG = () => {
    if (svgRef.current) {
      const geometry = ChartGeometryExtractor.extractFromSVG(svgRef.current)
      return geometry
    }
  }

  return (
    <div>
      <svg ref={svgRef} className="chart-svg">
        {/* Your SVG chart content */}
      </svg>
      <Button onClick={handleExtractFromSVG}>Generate Sigil from Chart</Button>
    </div>
  )
}
```

### 3. PatternToRuneConverter

**Location:** `lib/runes/pattern-to-rune-converter.ts`

**Purpose:** Convert astrological patterns into sigil prompts and generate complete sigils.

#### Key Methods

```typescript
// Generate sigil from pattern
PatternToRuneConverter.generateSigilFromPattern(
  pattern: PatternConfiguration,
  geometry: RuneGeometry,
  style: SigilStyle
): Promise<NatalSigilRune>

// Generate multiple style variations
PatternToRuneConverter.generateSigilVariations(
  pattern: PatternConfiguration,
  geometry: RuneGeometry,
  styles?: SigilStyle[]
): Promise<NatalSigilRune[]>

// Recommend best style for pattern
PatternToRuneConverter.recommendStyle(
  pattern: PatternConfiguration
): SigilStyle
```

#### Integration Examples

**Automatic Style Recommendation:**

```tsx
function SmartSigilGenerator({ geometry }) {
  const [recommendedStyle, setRecommendedStyle] = useState<SigilStyle>('nordic')

  useEffect(() => {
    if (geometry.sacredPatterns.length > 0) {
      const dominantPattern = geometry.sacredPatterns[0]
      const recommended = PatternToRuneConverter.recommendStyle(dominantPattern)
      setRecommendedStyle(recommended)
    }
  }, [geometry])

  return (
    <div>
      <p>Recommended style: {recommendedStyle}</p>
      <NatalSigilGenerator
        geometry={geometry}
        // Will use recommended style as default
      />
    </div>
  )
}
```

**Batch Generation:**

```tsx
function BatchSigilGenerator({ pattern, geometry }) {
  const [variations, setVariations] = useState<NatalSigilRune[]>([])
  const [isGenerating, setIsGenerating] = useState(false)

  const handleBatchGenerate = async () => {
    setIsGenerating(true)
    try {
      const sigils = await PatternToRuneConverter.generateSigilVariations(pattern, geometry, [
        'nordic',
        'celtic',
        'alchemical',
        'cosmic',
      ])
      setVariations(sigils)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div>
      <Button onClick={handleBatchGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate All Styles'}
      </Button>

      <div className="grid grid-cols-2 gap-4">
        {variations.map((sigil, i) => (
          <SigilCard key={i} sigil={sigil} />
        ))}
      </div>
    </div>
  )
}
```

## Integration Patterns

### 1. Chart Display Integration

Add sigil generation to any existing chart display:

```tsx
function EnhancedChartDisplay({ chartData }) {
  const [showSigilOptions, setShowSigilOptions] = useState(false)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Natal Chart</CardTitle>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSigilOptions(!showSigilOptions)}>
            <Wand2 className="w-4 h-4 mr-2" />
            Generate Sigil
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Existing chart display */}
        <ChartVisualization data={chartData} />

        {/* Conditional sigil generator */}
        {showSigilOptions && (
          <div className="mt-6 border-t pt-6">
            <SigilGenerationSection chartData={chartData} />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
```

### 2. Modal Integration

For a more focused experience:

```tsx
function ChartWithSigilModal({ chartData }) {
  const [showModal, setShowModal] = useState(false)

  return (
    <div>
      <ChartDisplay data={chartData} />

      <Button onClick={() => setShowModal(true)}>Create Sigil</Button>

      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Generate Your Natal Sigil</DialogTitle>
          </DialogHeader>

          <NatalSigilGenerator
            geometry={extractedGeometry}
            chartData={chartData}
            onSigilGenerated={sigil => {
              console.log('Generated:', sigil)
              setShowModal(false)
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
```

### 3. Tab Integration

For comprehensive chart analysis:

```tsx
function ComprehensiveChartAnalysis({ chartData }) {
  return (
    <Tabs defaultValue="chart">
      <TabsList>
        <TabsTrigger value="chart">Chart</TabsTrigger>
        <TabsTrigger value="patterns">Patterns</TabsTrigger>
        <TabsTrigger value="sigils">Sigils</TabsTrigger>
      </TabsList>

      <TabsContent value="chart">
        <ChartDisplay data={chartData} />
      </TabsContent>

      <TabsContent value="patterns">
        <PatternAnalysis patterns={chartData.patterns} />
      </TabsContent>

      <TabsContent value="sigils">
        <SigilGenerationInterface chartData={chartData} />
      </TabsContent>
    </Tabs>
  )
}
```

## Page-Level Integrations

### 1. Chart of the Moment (Already Implemented)

**File:** `app/chart-of-the-moment/page.tsx`

**Features:**

- Generate sigils from current planetary transits
- Real-time geometry extraction
- Moment-specific sigil creation

### 2. Agent Consultation Pages

**Recommended Integration:** `app/agents/[planet]/[sign]/[degree]/page.tsx`

```tsx
function AgentConsultationPage({ planet, sign, degree }) {
  const [chartGeometry, setChartGeometry] = useState<RuneGeometry | null>(null)

  const handleGenerateAgentSigil = () => {
    // Create geometry for specific planetary placement
    const geometry = createPlanetaryGeometry(planet, sign, degree)
    setChartGeometry(geometry)
  }

  return (
    <div>
      {/* Existing agent consultation interface */}
      <AgentInterface planet={planet} sign={sign} degree={degree} />

      {/* Add sigil generation section */}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Generate {planet} Sigil</CardTitle>
          <CardDescription>
            Create a personalized sigil for your {planet} in {sign} placement
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGenerateAgentSigil}>Generate Planetary Sigil</Button>

          {chartGeometry && (
            <NatalSigilGenerator geometry={chartGeometry} chartData={{ planet, sign, degree }} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

### 3. Birth Chart Display Components

**Recommended Integration:** `components/birth-chart-display.tsx`

```tsx
function BirthChartDisplay({ birthInfo, planets, aspects }) {
  const [showSigilGenerator, setShowSigilGenerator] = useState(false)

  return (
    <div>
      {/* Existing birth chart visualization */}
      <ChartVisualization planets={planets} aspects={aspects} />

      {/* Add sigil generation toggle */}
      <div className="mt-4 flex justify-center">
        <Button variant="outline" onClick={() => setShowSigilGenerator(!showSigilGenerator)}>
          <Sparkles className="w-4 h-4 mr-2" />
          {showSigilGenerator ? 'Hide' : 'Show'} Sigil Generator
        </Button>
      </div>

      {/* Conditional sigil generator */}
      {showSigilGenerator && (
        <div className="mt-6">
          <SigilGenerationSection birthInfo={birthInfo} planets={planets} aspects={aspects} />
        </div>
      )}
    </div>
  )
}
```

## Utility Functions

### Geometry Helper Functions

```typescript
// Create geometry from minimal data
function createBasicGeometry(
  elementalBalance: { fire: number; water: number; air: number; earth: number },
  dominantElement: string
): RuneGeometry {
  return {
    aspectLines: [],
    centerPoint: { x: 400, y: 400 },
    powerNodes: [],
    sacredPatterns: [],
    chartBounds: { width: 800, height: 800 },
    dominantElement,
    elementalBalance,
  }
}

// Create planetary-specific geometry
function createPlanetaryGeometry(planet: string, sign: string, degree: number): RuneGeometry {
  const element = getSignElement(sign)
  const elementalBalance = { fire: 0, water: 0, air: 0, earth: 0 }
  elementalBalance[element.toLowerCase() as keyof typeof elementalBalance] = 100

  return createBasicGeometry(elementalBalance, element)
}
```

### Style Helper Functions

```typescript
// Get style icon
function getStyleIcon(style: SigilStyle): ReactNode {
  const icons = {
    nordic: <Mountain className="w-4 h-4" />,
    celtic: <Compass className="w-4 h-4" />,
    alchemical: <Shield className="w-4 h-4" />,
    cosmic: <Star className="w-4 h-4" />
  }
  return icons[style]
}

// Get style description
function getStyleDescription(style: SigilStyle): string {
  const descriptions = {
    nordic: 'Angular runic strokes with ancient stone textures',
    celtic: 'Flowing knotwork with illuminated manuscript beauty',
    alchemical: 'Precise geometric patterns with hermetic symbolism',
    cosmic: 'Ethereal patterns with stellar and holographic effects'
  }
  return descriptions[style]
}
```

## Error Handling

### Component Error Boundaries

```tsx
function SigilGenerationErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary
      fallback={({ error }) => (
        <Alert variant="destructive">
          <AlertDescription>Sigil generation failed: {error.message}</AlertDescription>
        </Alert>
      )}
    >
      {children}
    </ErrorBoundary>
  )
}
```

### API Error Handling

```typescript
async function safeGenerateSigil(params: any) {
  try {
    const response = await fetch('/api/generate-natal-sigil', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Generation failed')
    }

    return await response.json()
  } catch (error) {
    console.error('Sigil generation error:', error)

    // Return fallback sigil
    return {
      success: false,
      error: error.message,
      fallbackSigil: createFallbackSigil(params.geometry),
    }
  }
}
```

## Testing Integration

### Component Testing

```typescript
import { render, screen, fireEvent } from '@testing-library/react'
import NatalSigilGenerator from '@/components/natal-sigil-generator'

test('renders sigil generator with geometry', () => {
  const mockGeometry = createMockGeometry()

  render(
    <NatalSigilGenerator
      geometry={mockGeometry}
      chartData={{}}
    />
  )

  expect(screen.getByText('Generate Natal Sigil')).toBeInTheDocument()
  expect(screen.getByLabelText('Sigil Style')).toBeInTheDocument()
})

test('calls onSigilGenerated when sigil is created', async () => {
  const onSigilGenerated = jest.fn()
  const mockGeometry = createMockGeometry()

  render(
    <NatalSigilGenerator
      geometry={mockGeometry}
      onSigilGenerated={onSigilGenerated}
    />
  )

  fireEvent.click(screen.getByText('Generate Natal Sigil'))

  // Mock API response
  await waitFor(() => {
    expect(onSigilGenerated).toHaveBeenCalledWith(
      expect.objectContaining({
        visualStyle: expect.any(String),
        powerLevel: expect.any(Number)
      })
    )
  })
})
```

---

_This guide provides comprehensive patterns for integrating natal sigil generation throughout the Planetary Agents system while maintaining code quality and user experience standards._
