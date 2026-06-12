// Astrologize API integration (proxy helper)
// Fetches a circular natal horoscope (chart wheel) from an external Astrologize-like service

import {
  BirthInfoSchema,
  type BirthInfo,
  AlchmResponseSchema,
  AstrologizeWheelSchema,
} from './schemas'
import { CircuitBreaker, withRetries } from './resilience'
import {
  generateNatalChartSVG,
  type LocalChartResponse,
} from './chart-generators/natal-chart-generator'
import { generateProfessionalHoroscope } from './monica/horoscope-generator'
import { chartCache } from './chart-generators/chart-cache'

export type AstrologizeWheelResponse = {
  svg?: string
  imageUrl?: string
  meta?: any
}

const DEFAULT_BASE = 'https://alchm-backend.onrender.com'

function getBase(): string {
  return (process.env.ASTROLOGIZE_API_BASE || DEFAULT_BASE).replace(/\/$/, '')
}

const astroCB = new CircuitBreaker()
const alchmCB = new CircuitBreaker()

export async function fetchAstrologizeWheel(birth: BirthInfo): Promise<AstrologizeWheelResponse> {
  BirthInfoSchema.parse(birth)

  // Check if this is a current moment request (no name or specific birth time)
  const isCurrentMoment = !birth.name || birth.name === 'Current Moment'

  // Check cache first
  const cachedResult = chartCache.get(birth, isCurrentMoment)
  if (cachedResult) {
    console.log('Returning cached chart result')
    return {
      ...cachedResult,
      meta: { ...cachedResult.meta, cached: true },
    }
  }

  // Try external API first
  const url = `${getBase()}/astrologize`
  const payload = {
    name: birth.name || 'Subject',
    year: birth.year,
    // External API expects 1-based month; internal is 0-based [[memory:3826859]]
    month: birth.month + 1,
    day: birth.day,
    hour: birth.hour,
    minute: birth.minute,
    latitude: birth.latitude,
    longitude: birth.longitude,
    format: 'svg',
    // Try to pass house system if provided
    houseSystem: 'placidus', // Default to most popular system
  }

  const execResult = await astroCB.exec(async () => {
    const res = await withRetries(
      () =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      2,
      200
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Astrologize API error: ${res.status} ${res.statusText} - ${text}`)
    }
    const data = await res.json().catch(() => ({}))
    const normalized = {
      svg: data.svg || data.data?.svg || data.wheelSvg,
      imageUrl: data.imageUrl || data.data?.imageUrl || data.wheelUrl,
      meta: data.meta || data.data?.meta || { configured: true },
    }
    return AstrologizeWheelSchema.parse(normalized)
  })

  // If external API succeeded, cache and return result
  if (execResult.result && (execResult.result.svg || execResult.result.imageUrl)) {
    if (execResult.degraded) {
      execResult.result.meta = { ...(execResult.result.meta || {}), degraded: true }
    }

    // Cache the successful result
    chartCache.set(birth, execResult.result, isCurrentMoment)

    return execResult.result
  }

  // External API failed or returned empty result, throw error directly since fallbacks are removed
  throw new Error('External chart API unavailable and fallbacks have been disabled.')
}

export type AlchmResponse = {
  alchm?: any
  spirit?: number
  essence?: number
  matter?: number
  substance?: number
  [key: string]: any
}

export async function fetchAlchmAlchemize(birth: BirthInfo): Promise<AlchmResponse> {
  BirthInfoSchema.parse(birth)
  const url = `${getBase()}/alchemize`
  const payload = {
    name: birth.name || 'Subject',
    year: birth.year,
    // External API expects 1-based month; internal is 0-based [[memory:3826859]]
    month: birth.month + 1,
    day: birth.day,
    hour: birth.hour,
    minute: birth.minute,
    latitude: birth.latitude,
    longitude: birth.longitude,
  }

  const execResult = await alchmCB.exec(async () => {
    const res = await withRetries(
      () =>
        fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }),
      2,
      200
    )
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`Alchm /alchemize error: ${res.status} ${res.statusText} - ${text}`)
    }
    const data = await res.json().catch(() => ({}))
    return AlchmResponseSchema.parse(data)
  })

  if (!execResult.result) {
    throw new Error('Alchemize API unavailable and fallbacks have been disabled.')
  }
  if ((execResult as any).degraded) {
    ;(execResult.result as any).meta = {
      ...((execResult.result as any).meta || {}),
      degraded: true,
    }
  }
  return execResult.result
}

export async function fetchImaginize(
  prompt: string,
  options: Record<string, any> = {}
): Promise<any> {
  // If Cloudflare tokens are available, use them directly as the new nanobanana proxy
  const cfToken = process.env.CLOUDFLARE_API_TOKEN
  const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID

  if (cfToken && cfAccountId) {
    console.log('[fetchImaginize] Using Cloudflare Workers AI for image generation')
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          num_steps: options.steps || 30,
          negative_prompt: options.negative_prompt || 'text, labels, watermarks, ugly, bad anatomy',
        }),
        timeout: 20000, // 20 second timeout for image generation
      } as any)

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`Cloudflare AI error: ${res.status} ${res.statusText} - ${text}`)
      }

      const imageBlob = await res.blob()
      const arrayBuffer = await imageBlob.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')
      const mimeType = imageBlob.type || 'image/png'
      const dataUri = `data:${mimeType};base64,${base64Data}`

      return {
        imageUrl: dataUri,
        url: dataUri,
        provider: 'cloudflare-workers-ai',
      }
    } catch (error) {
      if (error instanceof TypeError || (error as any).message.includes('timeout')) {
        return {
          imageUrl: null,
          fallback: true,
          placeholder: 'Image generation timeout - sigil pattern preserved',
          error: 'Network timeout or connection error',
        }
      }
      throw error
    }
  }

  // Fallback to old external API if Cloudflare is not configured
  const url = `${getBase()}/imaginize`

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, ...options }),
      timeout: 10000, // 10 second timeout
    } as any)

    if (!res.ok) {
      const text = await res.text().catch(() => '')

      // Return placeholder for service unavailable errors
      if (res.status === 503 || res.status === 502) {
        return {
          imageUrl: null,
          fallback: true,
          placeholder: 'Service temporarily unavailable - sigil patterns recorded',
          error: `External image service unavailable (${res.status})`,
        }
      }

      throw new Error(`Alchm /imaginize error: ${res.status} ${res.statusText} - ${text}`)
    }

    return res.json().catch(() => ({}))
  } catch (error) {
    // Network or timeout errors
    if (error instanceof TypeError || (error as any).message.includes('timeout')) {
      return {
        imageUrl: null,
        fallback: true,
        placeholder: 'Image generation timeout - sigil pattern preserved',
        error: 'Network timeout or connection error',
      }
    }
    throw error
  }
}

export type AlchmizeResponse = {
  astrologize?: AstrologizeWheelResponse | null
  alchemize?: AlchmResponse | null
  imaginize?: any | null
  meta: {
    degraded?: boolean
    errors?: string[]
  }
}

export async function fetchAlchmize(input: {
  birth: BirthInfo
  prompt?: string
  imaginizeOptions?: Record<string, any>
}): Promise<AlchmizeResponse> {
  // Validate birth data (zero-based month expected)
  BirthInfoSchema.parse(input.birth)

  const tasks = {
    astrologize: fetchAstrologizeWheel(input.birth),
    alchemize: fetchAlchmAlchemize(input.birth),
    imaginize: input.prompt
      ? fetchImaginize(input.prompt, input.imaginizeOptions || {})
      : Promise.resolve(null),
  }

  const [astrologizeRes, alchemizeRes, imaginizeRes] = await Promise.allSettled([
    tasks.astrologize,
    tasks.alchemize,
    tasks.imaginize,
  ])

  const errors: string[] = []

  const astrologize = astrologizeRes.status === 'fulfilled' ? astrologizeRes.value : null
  if (astrologizeRes.status === 'rejected')
    errors.push(`astrologize: ${astrologizeRes.reason?.message || String(astrologizeRes.reason)}`)

  const alchemize = alchemizeRes.status === 'fulfilled' ? alchemizeRes.value : null
  if (alchemizeRes.status === 'rejected')
    errors.push(`alchemize: ${alchemizeRes.reason?.message || String(alchemizeRes.reason)}`)

  const imaginize = imaginizeRes.status === 'fulfilled' ? imaginizeRes.value : null
  if (imaginizeRes.status === 'rejected')
    errors.push(`imaginize: ${imaginizeRes.reason?.message || String(imaginizeRes.reason)}`)

  return {
    astrologize,
    alchemize,
    imaginize,
    meta: {
      degraded: errors.length > 0,
      errors: errors.length ? errors : undefined,
    },
  }
}
