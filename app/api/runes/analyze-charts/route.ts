import { NextResponse } from 'next/server'
import { analyzeChart, combineCharts, analyzeChartCompatibility } from '@/lib/runes/chart-combiner'
import { BirthChart } from '@/lib/runes/multi-chart-runes'

export const dynamic = 'force-dynamic'
export const revalidate = 0

interface ChartAnalysisRequest {
  charts: {
    name: string
    birthDate: string
    birthTime?: string
    birthLocation?: string
  }[]
  relationshipType?: string
}

export async function POST(req: Request) {
  try {
    const { charts, relationshipType }: ChartAnalysisRequest = await req.json()

    if (!charts || !Array.isArray(charts) || charts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'At least one chart is required' },
        { status: 400 }
      )
    }

    if (charts.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Maximum 8 charts allowed for collective runes' },
        { status: 400 }
      )
    }

    // Analyze each chart individually
    const analyzedCharts: BirthChart[] = []
    const analysisErrors: string[] = []

    for (const chart of charts) {
      try {
        const analyzed = await analyzeChart(
          chart.name,
          chart.birthDate,
          chart.birthTime,
          chart.birthLocation
        )
        analyzedCharts.push(analyzed)
      } catch (error) {
        console.error(`Error analyzing chart for ${chart.name}:`, error)
        analysisErrors.push(`Failed to analyze chart for ${chart.name}`)
      }
    }

    if (analyzedCharts.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to analyze any charts', details: analysisErrors },
        { status: 500 }
      )
    }

    // Combine charts
    const chartCombination = await combineCharts(analyzedCharts, relationshipType)

    // Get detailed compatibility analysis
    const compatibilityAnalysis = analyzeChartCompatibility(chartCombination)

    return NextResponse.json({
      success: true,
      chartCombination,
      compatibilityAnalysis,
      analysisErrors: analysisErrors.length > 0 ? analysisErrors : undefined,
      metadata: {
        totalCharts: analyzedCharts.length + 1, // +1 for current moment
        complexity: chartCombination.complexity,
        processingTime: Date.now(),
        chartIds: analyzedCharts.map(c => c.id),
      },
    })
  } catch (error) {
    console.error('Error in chart analysis API:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to analyze charts',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
