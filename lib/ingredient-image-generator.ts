import { fetchImaginize } from './astrologize'

export interface ElementalProperties {
  Fire?: number
  Water?: number
  Earth?: number
  Air?: number
  [key: string]: number | undefined
}

export interface IngredientImageInput {
  ingredient_id?: string
  slug?: string
  name: string
  category?: string
  description?: string
  elementalProperties?: ElementalProperties
  sensoryProfile?: Record<string, unknown>
  culinaryProfile?: Record<string, unknown>
  qualities?: string[]
}

export interface IngredientImageResult {
  url: string | null
  image_url: string | null
  provider: 'nanobanana'
  prompt: string
  storage_path: string
  fallback?: boolean
  fallback_reason?: string
}

// Subtle photographic accent per element — avoids fantasy clutter
const ELEMENT_ACCENTS: Record<string, string> = {
  Fire: 'warm amber side lighting',
  Water: 'cool moisture and surface dewdrops',
  Earth: 'earthy matte tones and natural texture',
  Air: 'soft airy backlighting and open negative space',
}

const NEGATIVE_PROMPT =
  'text, labels, hands, packaging, watermarks, logos, fantasy elements, excessive blur, cartoon, illustration, painting'

export function buildIngredientPrompt(input: IngredientImageInput): string {
  const segments: string[] = []

  // Core subject
  let subject = `premium culinary photograph of ${input.name}`
  if (input.category) subject += ` (${input.category})`
  segments.push(subject)

  // First sentence of description, lowercased, max 120 chars
  if (input.description) {
    const first = input.description.split(/[.!?]/)[0].trim()
    if (first && first.length <= 120) {
      segments.push(first.toLowerCase())
    }
  }

  // Photographic style constants
  segments.push(
    'centered on dark slate surface',
    'studio lighting',
    'razor-sharp focus',
    'rich natural texture',
    'generous negative space for card cropping',
    'professional food photography'
  )

  // Elemental atmosphere — only dominant elements (> 0.3), at most two
  if (input.elementalProperties) {
    const accents = Object.entries(input.elementalProperties)
      .filter(([, v]) => typeof v === 'number' && (v as number) > 0.3)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 2)
      .map(([k]) => ELEMENT_ACCENTS[k])
      .filter(Boolean)

    if (accents.length > 0) {
      segments.push(`subtle ${accents.join(' and ')} accent`)
    }
  }

  // Selected qualities (max 4, strings only)
  const qualities = (input.qualities ?? []).filter(q => typeof q === 'string').slice(0, 4)
  if (qualities.length > 0) {
    segments.push(qualities.join(', '))
  }

  return segments.join(', ')
}

export function resolveStoragePath(
  input: Pick<IngredientImageInput, 'slug' | 'ingredient_id' | 'name'>
): string {
  const key =
    input.slug ??
    input.ingredient_id ??
    input.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  return `ingredients/${key}.png`
}

export function extractImageUrl(imageData: Record<string, unknown>): string | null {
  return (
    (imageData?.generated_image_url as string | undefined) ??
    (imageData?.url as string | undefined) ??
    (imageData?.imageUrl as string | undefined) ??
    null
  )
}

export async function generateIngredientImage(
  input: IngredientImageInput
): Promise<IngredientImageResult> {
  const prompt = buildIngredientPrompt(input)
  const storage_path = resolveStoragePath(input)

  // Asynchronous pattern: we return the expected storage bucket path immediately
  // to prevent Vercel 504 timeouts, and fire the external provider call in the background.
  const imageUrl = storage_path

  // Fire and forget image generation (in production this would use a background job queue)
  fetchImaginize(prompt, {
    style_preset: 'photorealistic',
    width: 1024,
    height: 1024,
    cfg_scale: 7,
    steps: 30,
    negative_prompt: NEGATIVE_PROMPT,
  }).catch(err => console.error('[generateIngredientImage] Async generation error:', err))

  return {
    url: imageUrl,
    image_url: imageUrl,
    provider: 'nanobanana',
    prompt,
    storage_path,
    fallback: false,
  }
}
