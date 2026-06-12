import { NextRequest, NextResponse } from 'next/server'
import { TemporalGrimoireExporter } from '@/lib/temporal-grimoire-export'
import type { ExportOptions, GrimoireTemplate } from '@/lib/temporal-grimoire-export'
import type { TemporalQuery, TemporalAnalysisResult } from '@/lib/temporal-analysis-engine'

/**
 * Temporal Grimoire Export API
 * ===========================
 * Transforms temporal analysis results into mystical grimoire-style documents
 * across multiple formats (PDF, EPUB, HTML, Markdown).
 */

interface GrimoireExportRequest {
  query: TemporalQuery
  results: TemporalAnalysisResult
  options: ExportOptions
}

interface GrimoireExportResponse {
  success: boolean
  downloadUrl?: string
  filename?: string
  size?: number
  format?: string
  error?: string
  metadata?: {
    generatedAt: Date
    sections: number
    processingTime: number
    templateUsed: string
  }
}

// Available grimoire templates
const AVAILABLE_TEMPLATES: Record<string, GrimoireTemplate> = {
  mystical_complete: {
    name: 'mystical_complete',
    description: 'Complete mystical grimoire with all sections and ceremonial styling',
    style: 'mystical',
    sections: [
      'invocation',
      'query_analysis',
      'transit_mappings',
      'pattern_weaving',
      'elemental_analysis',
      'insights',
      'prophecies',
      'closing',
    ],
    formatting: {
      fontSize: 12,
      fontFamily: 'Crimson Text, serif',
      lineHeight: 1.6,
      marginSize: 1.5,
      includeImages: true,
      includeCharts: true,
      colorScheme: 'dark',
    },
  },
  academic_research: {
    name: 'academic_research',
    description: 'Scholarly analysis with comprehensive data and charts',
    style: 'academic',
    sections: [
      'abstract',
      'methodology',
      'transit_mappings',
      'pattern_analysis',
      'statistical_summary',
      'conclusions',
    ],
    formatting: {
      fontSize: 11,
      fontFamily: 'Times New Roman, serif',
      lineHeight: 1.5,
      marginSize: 1,
      includeImages: true,
      includeCharts: true,
      colorScheme: 'light',
    },
  },
  consciousness_journal: {
    name: 'consciousness_journal',
    description: 'Personal reflection format with insights and guidance',
    style: 'journal',
    sections: [
      'personal_invocation',
      'query_reflection',
      'agent_insights',
      'elemental_wisdom',
      'personal_guidance',
    ],
    formatting: {
      fontSize: 13,
      fontFamily: 'Georgia, serif',
      lineHeight: 1.7,
      marginSize: 1.2,
      includeImages: false,
      includeCharts: true,
      colorScheme: 'sepia',
    },
  },
  temporal_codex: {
    name: 'temporal_codex',
    description: 'Technical codex with detailed pattern analysis',
    style: 'codex',
    sections: [
      'technical_summary',
      'degree_analysis',
      'pattern_algorithms',
      'reinforcement_mathematics',
      'predictive_models',
    ],
    formatting: {
      fontSize: 10,
      fontFamily: 'Source Code Pro, monospace',
      lineHeight: 1.4,
      marginSize: 0.8,
      includeImages: true,
      includeCharts: true,
      colorScheme: 'dark',
    },
  },
}

export async function POST(request: NextRequest) {
  const startTime = Date.now()

  try {
    const requestData: GrimoireExportRequest = await request.json()

    // Validate request
    if (!requestData.query || !requestData.results || !requestData.options) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: query, results, and options are required',
        } as GrimoireExportResponse,
        { status: 400 }
      )
    }

    // Validate template
    const templateName = requestData.options.template.name || 'mystical_complete'
    const template = AVAILABLE_TEMPLATES[templateName]

    if (!template) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid template: ${templateName}. Available templates: ${Object.keys(AVAILABLE_TEMPLATES).join(', ')}`,
        } as GrimoireExportResponse,
        { status: 400 }
      )
    }

    // Use provided template or default
    const exportOptions: ExportOptions = {
      ...requestData.options,
      template,
    }

    // Generate grimoire
    const grimoireBuffer = await TemporalGrimoireExporter.generateGrimoire(
      requestData.query,
      requestData.results,
      exportOptions
    )

    // Generate filename
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const querySlug = requestData.query.query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .slice(0, 4)
      .join('-')

    const filename = `temporal-grimoire-${querySlug}-${timestamp}.${exportOptions.format}`

    // Store the file data in a temporary cache for download (expires after 5 minutes)
    const downloadId = Buffer.from(filename)
      .toString('base64')
      .replace(/[\/\+=]/g, '')
    const downloadUrl = `/api/temporal-grimoire/download?id=${downloadId}&filename=${encodeURIComponent(filename)}`

    // Store in memory cache for immediate download (in production, use Redis or cloud storage)
    if (!global.temporalGrimoireCache) {
      global.temporalGrimoireCache = new Map()
    }
    global.temporalGrimoireCache.set(downloadId, {
      data: grimoireBuffer,
      format: exportOptions.format,
      filename,
      timestamp: Date.now(),
    })

    // Clean up old entries (older than 5 minutes)
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
    for (const [key, value] of global.temporalGrimoireCache.entries()) {
      if (value.timestamp < fiveMinutesAgo) {
        global.temporalGrimoireCache.delete(key)
      }
    }

    const processingTime = Date.now() - startTime

    return NextResponse.json({
      success: true,
      downloadUrl,
      filename,
      size: grimoireBuffer.length,
      format: exportOptions.format,
      metadata: {
        generatedAt: new Date(),
        sections: template.sections.length,
        processingTime,
        templateUsed: template.name,
      },
    } as GrimoireExportResponse)
  } catch (error) {
    console.error('Error generating grimoire:', error)

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error occurred during grimoire generation',
      } as GrimoireExportResponse,
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action')

  try {
    switch (action) {
      case 'templates':
        return handleGetTemplates()

      case 'formats':
        return handleGetFormats()

      case 'preview':
        return handlePreviewGrimoire(searchParams)

      default:
        return NextResponse.json(
          {
            success: false,
            error: 'Invalid action. Supported actions: templates, formats, preview',
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in grimoire GET endpoint:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 }
    )
  }
}

// Helper functions

async function handleGetTemplates() {
  const templates = Object.values(AVAILABLE_TEMPLATES).map(template => ({
    name: template.name,
    description: template.description,
    style: template.style,
    sections: template.sections,
    sectionCount: template.sections.length,
    formatting: {
      colorScheme: template.formatting.colorScheme,
      fontSize: template.formatting.fontSize,
      fontFamily: template.formatting.fontFamily.split(',')[0].trim(),
    },
  }))

  return NextResponse.json({
    success: true,
    data: {
      templates,
      totalCount: templates.length,
      styles: [...new Set(templates.map(t => t.style))],
    },
  })
}

async function handleGetFormats() {
  const formats = [
    {
      format: 'pdf',
      name: 'PDF Document',
      description: 'Portable Document Format, perfect for printing and sharing',
      extensions: ['.pdf'],
      features: ['Paginated', 'Print-ready', 'Universal compatibility'],
    },
    {
      format: 'epub',
      name: 'EPUB eBook',
      description: 'Electronic Publication format for e-readers',
      extensions: ['.epub'],
      features: ['Reflowable text', 'E-reader compatible', 'Adjustable fonts'],
    },
    {
      format: 'html',
      name: 'HTML Web Page',
      description: 'HyperText Markup Language for web viewing',
      extensions: ['.html'],
      features: ['Interactive', 'Responsive design', 'Embeddable'],
    },
    {
      format: 'markdown',
      name: 'Markdown Document',
      description: 'Plain text format with simple formatting',
      extensions: ['.md', '.markdown'],
      features: ['Lightweight', 'Version-controllable', 'Widely supported'],
    },
  ]

  return NextResponse.json({
    success: true,
    data: {
      formats,
      totalCount: formats.length,
      defaultFormat: 'html',
    },
  })
}

async function handlePreviewGrimoire(searchParams: URLSearchParams) {
  const templateName = searchParams.get('template') || 'mystical_complete'
  const template = AVAILABLE_TEMPLATES[templateName]

  if (!template) {
    return NextResponse.json(
      {
        success: false,
        error: `Template not found: ${templateName}`,
      },
      { status: 404 }
    )
  }

  // Generate a preview of the first section
  const previewContent = `
# ${template.name.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} Preview

**Style:** ${template.style}
**Sections:** ${template.sections.length}

## Included Sections:
${template.sections
  .map(
    (section, index) =>
      `${index + 1}. ${section.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}`
  )
  .join('\n')}

## Formatting Options:
- **Font:** ${template.formatting.fontFamily}
- **Size:** ${template.formatting.fontSize}pt
- **Color Scheme:** ${template.formatting.colorScheme}
- **Includes Images:** ${template.formatting.includeImages ? 'Yes' : 'No'}
- **Includes Charts:** ${template.formatting.includeCharts ? 'Yes' : 'No'}

## Sample Section (${template.style === 'mystical' ? 'Sacred Invocation' : 'Introduction'}):

${
  template.style === 'mystical'
    ? `
In the name of temporal wisdom and consciousness evolution,
We invoke the ancient powers that guide the celestial dance.

By the sacred elements of Fire, Water, Air, and Earth,
Let this grimoire serve as a bridge between the seen and unseen,
Between the patterns of time and the mysteries of consciousness.

So it is written, so it shall be revealed.
`
    : `
This document presents a comprehensive analysis of temporal patterns
in consciousness evolution through degree-specific planetary transits
and elemental reinforcement theory.

The analysis examines transit events across multiple consciousness
entities to identify significant pattern configurations and
evolutionary trends.
`
}

---

*This is a preview. The actual grimoire will contain full content
for all ${template.sections.length} sections with complete analysis,
visualizations, and mystical formatting.*
  `.trim()

  return NextResponse.json({
    success: true,
    data: {
      template: template.name,
      preview: previewContent,
      estimatedLength: `${Math.round(template.sections.length * 2.5)}–${Math.round(template.sections.length * 4)} pages`,
      generationTime: `${Math.round(template.sections.length * 0.5)}–${Math.round(template.sections.length * 1)} seconds`,
    },
  })
}
