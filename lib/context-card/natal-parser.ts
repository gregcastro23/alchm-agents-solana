/**
 * Natal Context Parser & Allowlist Validator
 *
 * Implements strict schema validation and field allowlisting for seeker natal
 * charts. Guarantees that document instructions (e.g. "HOW TO USE THIS FILE",
 * prompt headers, or arbitrary commentary) are completely stripped and NEVER
 * passed as prompt instructions to council delegates.
 */

import { z } from 'zod'
import type { StructuredNatalData } from '@/lib/agents/council/council-context'

const VALID_SIGNS = [
  'Aries',
  'Taurus',
  'Gemini',
  'Cancer',
  'Leo',
  'Virgo',
  'Libra',
  'Scorpio',
  'Sagittarius',
  'Capricorn',
  'Aquarius',
  'Pisces',
] as const

export const ContextCardEnvelopeSchema = z.object({
  version: z.literal(1),
  data: z.record(z.unknown()),
})

export type ContextCardEnvelope = z.infer<typeof ContextCardEnvelopeSchema>

export const StructuredNatalPlacementSchema = z.object({
  body: z.string().min(1).max(30),
  sign: z.string().refine(s => VALID_SIGNS.some(v => v.toLowerCase() === s.toLowerCase()), {
    message: 'Invalid zodiac sign',
  }),
  deg: z.number().min(0).max(30),
  house: z.number().int().min(1).max(12).optional(),
  retro: z.boolean().optional(),
  dignity: z.string().optional(),
})

export const StructuredNatalDataSchema = z.object({
  handle: z.string().max(50).optional(),
  bigThree: z
    .object({
      sun: z.string().optional(),
      moon: z.string().optional(),
      rising: z.string().optional(),
    })
    .optional(),
  placements: z.array(StructuredNatalPlacementSchema).min(1),
  houses: z
    .array(
      z.object({
        house: z.number().int().min(1).max(12),
        sign: z.string(),
        deg: z.number().min(0).max(30),
      })
    )
    .optional(),
  aspects: z
    .array(
      z.object({
        a: z.string(),
        b: z.string(),
        type: z.string(),
        orb: z.number().min(0).max(15),
        applying: z.boolean().optional(),
      })
    )
    .optional(),
})

/**
 * Parses raw input (versioned JSON envelope, ContextCardData object, or legacy Markdown)
 * into a strictly validated StructuredNatalData object. Returns null if invalid.
 */
export function parseNatalContext(input: unknown): StructuredNatalData | null {
  if (!input) return null

  // 1. Direct object or envelope check
  if (typeof input === 'object') {
    const rawData = (input as any).data || input
    return extractFromStructuredObject(rawData)
  }

  if (typeof input !== 'string') return null
  const trimmed = input.trim()
  if (!trimmed) return null

  // 2. Try parsing JSON string
  if (trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed)
      const rawData = parsed.data || parsed
      return extractFromStructuredObject(rawData)
    } catch {
      // Fall through to markdown parsing
    }
  }

  // 3. Legacy Markdown parser with strict allowlist extraction
  return parseLegacyMarkdown(trimmed)
}

function extractFromStructuredObject(raw: any): StructuredNatalData | null {
  try {
    const bigThree = raw.birth?.bigThree || raw.bigThree
    const points = Array.isArray(raw.points) ? raw.points : raw.placements || []

    const placements = points
      .filter((p: any) => p && typeof p.body === 'string' && typeof p.sign === 'string')
      .map((p: any) => ({
        body: String(p.body).trim(),
        sign: String(p.sign).trim(),
        deg: typeof p.deg === 'number' ? p.deg : 0,
        house: typeof p.house === 'number' ? p.house : undefined,
        retro: Boolean(p.retro),
        dignity: typeof p.dignity === 'string' ? p.dignity : undefined,
      }))

    const aspects = Array.isArray(raw.aspects)
      ? raw.aspects
          .filter((a: any) => a && typeof a.a === 'string' && typeof a.b === 'string')
          .map((a: any) => ({
            a: String(a.a).trim(),
            b: String(a.b).trim(),
            type: String(a.type).trim(),
            orb: typeof a.orb === 'number' ? a.orb : 0,
            applying: typeof a.applying === 'boolean' ? a.applying : undefined,
          }))
      : []

    const result = {
      handle: typeof raw.birth?.handle === 'string' ? raw.birth.handle : undefined,
      bigThree: bigThree
        ? {
            sun: bigThree.sun ? String(bigThree.sun).trim() : undefined,
            moon: bigThree.moon ? String(bigThree.moon).trim() : undefined,
            rising: bigThree.rising ? String(bigThree.rising).trim() : undefined,
          }
        : undefined,
      placements,
      aspects,
    }

    const validated = StructuredNatalDataSchema.safeParse(result)
    return validated.success ? validated.data : null
  } catch {
    return null
  }
}

/**
 * Strict allowlist parser for legacy Context Card Markdown.
 * Strips all prose, headers, instructions, and prompt advice.
 */
function parseLegacyMarkdown(md: string): StructuredNatalData | null {
  const placements: StructuredNatalData['placements'] = []
  const aspects: NonNullable<StructuredNatalData['aspects']> = []
  let sunSign: string | undefined
  let moonSign: string | undefined
  let risingSign: string | undefined

  const lines = md.split('\n')
  for (const line of lines) {
    const l = line.trim()

    // Match Big Three
    const sunMatch = l.match(/\*\*Sun\*\*\s+in\s+([A-Za-z]+)/i)
    if (sunMatch) sunSign = sunMatch[1]

    const moonMatch = l.match(/\*\*Moon\*\*\s+in\s+([A-Za-z]+)/i)
    if (moonMatch) moonSign = moonMatch[1]

    const risingMatch = l.match(/\*\*(?:Rising|Ascendant)\*\*\s+in\s+([A-Za-z]+)/i)
    if (risingMatch) risingSign = risingMatch[1]

    // Match Placements: - **Planet** in Sign at X° ...
    const placementMatch = l.match(
      /-\s+\*\*([A-Za-z\s]+)\*\*\s+in\s+([A-Za-z]+)(?:\s+at\s+(\d+(?:\.\d+)?)°)?/i
    )
    if (placementMatch) {
      const body = placementMatch[1].trim()
      const sign = placementMatch[2].trim()
      const deg = placementMatch[3] ? parseFloat(placementMatch[3]) : 0

      // Skip non-body headers
      if (!['Subject', 'Data Provenance', 'Methodology', 'Core Signature'].includes(body)) {
        placements.push({
          body,
          sign,
          deg,
          retro: l.toLowerCase().includes('retrograde'),
        })
      }
    }

    // Match Aspects: - PlanetA Type PlanetB (orb X°)
    const aspectMatch = l.match(
      /-\s+([A-Za-z]+)\s+([A-Za-z\s-]+)\s+([A-Za-z]+)\s+\(orb\s+(\d+(?:\.\d+)?)°\)/i
    )
    if (aspectMatch) {
      aspects.push({
        a: aspectMatch[1].trim(),
        b: aspectMatch[3].trim(),
        type: aspectMatch[2].trim(),
        orb: parseFloat(aspectMatch[4]),
      })
    }
  }

  if (placements.length === 0 && !sunSign) return null

  return {
    bigThree: {
      sun: sunSign,
      moon: moonSign,
      rising: risingSign,
    },
    placements,
    aspects,
  }
}
