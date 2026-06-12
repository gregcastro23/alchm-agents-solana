import { NextRequest, NextResponse } from 'next/server'
import {
  buildIngredientPrompt,
  generateIngredientImage,
  resolveStoragePath,
  type IngredientImageInput,
} from '@/lib/ingredient-image-generator'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(request: NextRequest) {
  let body: Record<string, unknown>

  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const input: IngredientImageInput = {
    ingredient_id: typeof body.ingredient_id === 'string' ? body.ingredient_id : undefined,
    slug: typeof body.slug === 'string' ? body.slug : undefined,
    name: (body.name as string).trim(),
    category: typeof body.category === 'string' ? body.category : undefined,
    description: typeof body.description === 'string' ? body.description : undefined,
    elementalProperties:
      body.elementalProperties && typeof body.elementalProperties === 'object'
        ? (body.elementalProperties as IngredientImageInput['elementalProperties'])
        : undefined,
    sensoryProfile:
      body.sensoryProfile && typeof body.sensoryProfile === 'object'
        ? (body.sensoryProfile as Record<string, unknown>)
        : undefined,
    culinaryProfile:
      body.culinaryProfile && typeof body.culinaryProfile === 'object'
        ? (body.culinaryProfile as Record<string, unknown>)
        : undefined,
    qualities: Array.isArray(body.qualities)
      ? (body.qualities as string[]).filter(q => typeof q === 'string')
      : undefined,
  }

  try {
    const result = await generateIngredientImage(input)

    if (!result.url && !result.fallback) {
      return NextResponse.json({ error: 'Image provider returned no URL' }, { status: 502 })
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[generate-ingredient-image] generation error:', err)
    return NextResponse.json(
      {
        error: 'Failed to generate ingredient image',
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    service: 'Ingredient Image Generator',
    provider: 'nanobanana',
    version: '1.0.0',
    endpoint: 'POST /api/generate-ingredient-image',
    compatibility: 'WTEN batchEnrichIngredients compatible',
    requiredFields: ['name'],
    optionalFields: [
      'ingredient_id',
      'slug',
      'category',
      'description',
      'elementalProperties',
      'sensoryProfile',
      'culinaryProfile',
      'qualities',
    ],
    promptStyle: buildIngredientPrompt({ name: '<ingredient>' }),
    storagePath: resolveStoragePath({ name: '<ingredient>' }),
  })
}
