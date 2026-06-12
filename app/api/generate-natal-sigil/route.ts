import { NextRequest, NextResponse } from 'next/server'
import { PatternToRuneConverter } from '@/lib/runes/pattern-to-rune-converter'
import { ChartGeometryExtractor } from '@/lib/chart-geometry-extractor'
import { detectPatternsStatic, PlanetPosition } from '@/lib/astrological-pattern-recognition'
import { calculateEnhancedChart } from '@/lib/enhanced-chart-calculator'
import { createNatalSigilRune, RuneGeometry, SigilStyle } from '@/lib/runes/natal-sigil-runes'
import { BirthInfoSchema, type BirthInfo } from '@/lib/schemas'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

interface GenerateSigilRequest {
  birthInfo?: BirthInfo
  geometry?: RuneGeometry
  style?: SigilStyle
  patternType?: string
  aspectFocused?: boolean
  prompt?: string
  chartData?: any
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateSigilRequest = await request.json()
    const {
      birthInfo,
      geometry,
      style = 'nordic',
      patternType,
      aspectFocused,
      prompt,
      chartData,
    } = body

    // Validate birth info if provided
    if (birthInfo) {
      try {
        BirthInfoSchema.parse(birthInfo)
      } catch (error) {
        return NextResponse.json(
          { error: 'Invalid birth information', details: error },
          { status: 400 }
        )
      }
    }

    // If no geometry provided, generate from birth info or chart data
    let finalGeometry = geometry
    if (!finalGeometry) {
      if (birthInfo) {
        // Generate chart and extract geometry
        console.log('Generating chart from birth info...')
        const enhancedChart = await calculateEnhancedChart(birthInfo, true)

        // Convert chart data to planet positions
        const planetPositions: PlanetPosition[] = enhancedChart.planets.map(p => ({
          planet: p.planet,
          sign: p.sign,
          degree: p.degree,
          house: p.house,
          date: new Date(),
        }))

        // Convert AspectData to Aspect format
        const convertedAspects = enhancedChart.aspects.map(aspect => ({
          ...aspect,
          type: aspect.type as any,
          separating: !aspect.applying,
        }))

        // Extract geometry from chart data
        finalGeometry = ChartGeometryExtractor.extractFromChartData(
          planetPositions,
          convertedAspects,
          800,
          800
        )

        // Add patterns to geometry (convert PatternData to PatternConfiguration)
        finalGeometry.sacredPatterns = enhancedChart.patterns.map(pattern => ({
          ...pattern,
          type: pattern.type as any,
          aspects: pattern.aspects.map(aspect => ({
            ...aspect,
            type: aspect.type as any,
            separating: !aspect.applying,
          })),
        }))
        finalGeometry.dominantElement = enhancedChart.alchemicalData.dominantElement
      } else if (chartData) {
        // Extract geometry from provided chart data
        const planetPositions: PlanetPosition[] = Object.entries(chartData.planets || {}).map(
          ([planet, data]: [string, any]) => ({
            planet,
            sign: data.sign,
            degree: data.degree,
            house: data.house || 1,
            date: new Date(),
          })
        )

        finalGeometry = ChartGeometryExtractor.extractFromChartData(
          planetPositions,
          chartData.aspects || [],
          800,
          800
        )
      } else {
        return NextResponse.json({ error: 'No birth info or geometry provided' }, { status: 400 })
      }
    }

    // Detect patterns if not already present
    if (!finalGeometry.sacredPatterns || finalGeometry.sacredPatterns.length === 0) {
      const planetPositions: PlanetPosition[] = chartData?.planets
        ? Object.entries(chartData.planets).map(([planet, data]: [string, any]) => ({
            planet,
            sign: data.sign,
            degree: data.degree,
            house: data.house || 1,
          }))
        : []

      if (planetPositions.length > 0) {
        const { patterns } = detectPatternsStatic(planetPositions)
        finalGeometry.sacredPatterns = patterns
      }
    }

    let sigil

    // Generate sigil based on type
    if (
      aspectFocused ||
      !finalGeometry.sacredPatterns ||
      finalGeometry.sacredPatterns.length === 0
    ) {
      // Generate aspect-focused sigil
      console.log('Generating aspect-focused sigil...')

      if (!prompt) {
        // Generate prompt from geometry
        const generatedPrompt = PatternToRuneConverter.generateAspectFocusedPrompt(
          finalGeometry,
          style
        )

        // Create sigil without pattern
        sigil = createNatalSigilRune(finalGeometry, style, 'aspect-based')

        // Try to generate image
        try {
          const { fetchImaginize } = await import('@/lib/astrologize')
          const imageData = await fetchImaginize(generatedPrompt, {
            style_preset: `mystical-${style}`,
            width: 1024,
            height: 1024,
            cfg_scale: 12,
            steps: 50,
          })

          sigil.generatedImageUrl =
            imageData?.generated_image_url || imageData?.url || imageData?.imageUrl
        } catch (imageError) {
          console.warn('Image generation failed, returning sigil without image:', imageError)
        }
      } else {
        // Use provided prompt
        sigil = createNatalSigilRune(finalGeometry, style, 'aspect-based')

        try {
          const { fetchImaginize } = await import('@/lib/astrologize')
          const imageData = await fetchImaginize(prompt, {
            style_preset: `mystical-${style}`,
            width: 1024,
            height: 1024,
            cfg_scale: 12,
            steps: 50,
          })

          sigil.generatedImageUrl =
            imageData?.generated_image_url || imageData?.url || imageData?.imageUrl
        } catch (imageError) {
          console.warn('Image generation failed:', imageError)
        }
      }
    } else {
      // Generate pattern-based sigil
      const dominantPattern = patternType
        ? finalGeometry.sacredPatterns.find(p => p.type === patternType) ||
          finalGeometry.sacredPatterns[0]
        : finalGeometry.sacredPatterns.sort((a, b) => b.strength - a.strength)[0]

      if (!dominantPattern) {
        return NextResponse.json(
          { error: 'No significant patterns found for sigil generation' },
          { status: 400 }
        )
      }

      console.log(`Generating ${dominantPattern.type} pattern sigil...`)
      sigil = await PatternToRuneConverter.generateSigilFromPattern(
        dominantPattern,
        finalGeometry,
        style
      )
    }

    // Calculate additional metadata
    const metadata = {
      aspectCount: finalGeometry.aspectLines.length,
      powerNodeCount: finalGeometry.powerNodes.length,
      patternCount: finalGeometry.sacredPatterns.length,
      dominantPattern: finalGeometry.sacredPatterns[0]?.type,
      dominantElement: finalGeometry.dominantElement,
      generationTime: new Date().toISOString(),
      style,
    }

    return NextResponse.json({
      success: true,
      sigil,
      sourcePattern: finalGeometry.sacredPatterns[0],
      geometry: {
        aspectCount: finalGeometry.aspectLines.length,
        powerNodeCount: finalGeometry.powerNodes.length,
        patternCount: finalGeometry.sacredPatterns.length,
        dominantElement: finalGeometry.dominantElement,
        elementalBalance: finalGeometry.elementalBalance,
      },
      metadata,
    })
  } catch (error) {
    console.error('Error in natal sigil generation:', error)
    return NextResponse.json(
      {
        error: 'Failed to generate natal sigil',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}

/**
 * GET endpoint to retrieve sigil generation info
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    service: 'Natal Sigil Generator',
    version: '1.0.0',
    availableStyles: ['nordic', 'celtic', 'alchemical', 'cosmic'],
    supportedPatterns: [
      'grand-trine',
      't-square',
      'grand-cross',
      'yod',
      'stellium',
      'mystic-rectangle',
      'kite',
      'grand-sextile',
      'cradle',
    ],
    aspectTypes: [
      'conjunction',
      'opposition',
      'trine',
      'square',
      'sextile',
      'quincunx',
      'semisextile',
      'sesquiquadrate',
      'semisquare',
      'quintile',
      'biquintile',
    ],
    endpoints: {
      generate: {
        method: 'POST',
        path: '/api/generate-natal-sigil',
        body: {
          birthInfo: 'Optional birth information',
          geometry: 'Optional pre-computed geometry',
          style: 'Style: nordic|celtic|alchemical|cosmic',
          patternType: 'Optional specific pattern to use',
          aspectFocused: 'Generate from aspects instead of patterns',
          prompt: 'Optional custom prompt',
          chartData: 'Optional chart data',
        },
      },
    },
  })
}
