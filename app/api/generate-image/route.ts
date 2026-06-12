import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, negative_prompt, width = 1024, height = 1024, steps = 30 } = body

    if (!prompt) {
      return NextResponse.json({ error: 'Missing prompt' }, { status: 400 })
    }

    const apiToken = process.env.CLOUDFLARE_API_TOKEN
    const accountId = process.env.CLOUDFLARE_ACCOUNT_ID

    if (!apiToken) {
      console.error('[generate-image] Missing CLOUDFLARE_API_TOKEN')
      return NextResponse.json(
        { error: 'Server misconfiguration: Missing Cloudflare API Token' },
        { status: 500 }
      )
    }

    if (!accountId) {
      console.error('[generate-image] Missing CLOUDFLARE_ACCOUNT_ID')
      return NextResponse.json(
        { error: 'Server misconfiguration: Missing Cloudflare Account ID' },
        { status: 500 }
      )
    }

    // Call Cloudflare Workers AI Stable Diffusion XL model
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/stabilityai/stable-diffusion-xl-base-1.0`

    console.log(
      `[generate-image] Requesting image from Cloudflare AI for prompt: ${prompt.substring(0, 50)}...`
    )

    const cfResponse = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        // negative_prompt is supported by some models, might be ignored by others
        negative_prompt: negative_prompt || 'text, labels, watermarks, ugly, bad anatomy',
        num_steps: steps,
      }),
    })

    if (!cfResponse.ok) {
      let errorText = ''
      try {
        errorText = await cfResponse.text()
      } catch (e) {
        errorText = 'Could not read error body'
      }
      console.error(`[generate-image] Cloudflare AI error (${cfResponse.status}):`, errorText)
      return NextResponse.json(
        {
          error: `Image generation failed: ${cfResponse.statusText}`,
          details: errorText,
        },
        { status: 502 }
      )
    }

    // Cloudflare returns a binary blob for image models
    const imageBlob = await cfResponse.blob()
    const arrayBuffer = await imageBlob.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    const mimeType = imageBlob.type || 'image/png'
    const dataUri = `data:${mimeType};base64,${base64Data}`

    return NextResponse.json({
      success: true,
      provider: 'cloudflare-workers-ai',
      imageUrl: dataUri,
      url: dataUri,
      metadata: {
        model: '@cf/stabilityai/stable-diffusion-xl-base-1.0',
      },
    })
  } catch (error) {
    console.error('[generate-image] Error proxying to nanobanana/Cloudflare:', error)
    return NextResponse.json(
      { error: 'Internal server error processing image generation request' },
      { status: 500 }
    )
  }
}
