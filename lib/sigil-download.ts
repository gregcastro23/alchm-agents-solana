import type { NatalSigilRune } from '@/lib/runes/natal-sigil-runes'

type DownloadableSigil = Partial<NatalSigilRune> & {
  generationTime?: string
  birthInfo?: unknown
  variation?: string
  style?: string
}

const STYLE_COLORS: Record<string, { primary: string; secondary: string; accent: string }> = {
  nordic: { primary: '#60a5fa', secondary: '#dbeafe', accent: '#1e3a8a' },
  celtic: { primary: '#34d399', secondary: '#dcfce7', accent: '#14532d' },
  alchemical: { primary: '#fb923c', secondary: '#ffedd5', accent: '#7c2d12' },
  cosmic: { primary: '#c084fc', secondary: '#f3e8ff', accent: '#581c87' },
}

export const SIGIL_STYLE_SYMBOLS: Record<string, string> = {
  nordic: 'ᚱ',
  celtic: '☘',
  alchemical: '🜍',
  cosmic: '✦',
}

function escapeXml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function slugifyFilename(value: unknown, fallback = 'sigil') {
  const slug = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function getSigilStyle(sigil: DownloadableSigil) {
  return sigil.visualStyle || sigil.style || 'cosmic'
}

function getSigilBaseName(sigil: DownloadableSigil, index?: number) {
  const suffix = typeof index === 'number' ? `-${index + 1}` : ''
  return `${slugifyFilename(sigil.name, 'natal-sigil')}${suffix}`
}

function getSigilEffects(sigil: DownloadableSigil) {
  if (!Array.isArray(sigil.effects)) {
    return []
  }

  return sigil.effects.map(effect => {
    if (typeof effect === 'string') {
      return effect
    }

    return [effect.name || effect.type, effect.description].filter(Boolean).join(': ')
  })
}

export function createSigilSvg(sigil: DownloadableSigil) {
  if (sigil.svgGeometry?.trim().startsWith('<svg')) {
    return sigil.svgGeometry
  }

  const style = getSigilStyle(sigil)
  const colors = STYLE_COLORS[style] || STYLE_COLORS.cosmic
  const symbol = sigil.symbol || SIGIL_STYLE_SYMBOLS[style] || SIGIL_STYLE_SYMBOLS.cosmic
  const title = sigil.name || 'Natal Sigil'
  const subtitle = sigil.personalizedMeaning || sigil.description || `${style} natal sigil`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <radialGradient id="aura" cx="50%" cy="45%" r="62%">
      <stop offset="0%" stop-color="${colors.secondary}" stop-opacity="0.9"/>
      <stop offset="55%" stop-color="${colors.primary}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="1"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="10" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="#020617"/>
  <circle cx="512" cy="512" r="420" fill="url(#aura)" stroke="${colors.primary}" stroke-width="8"/>
  <circle cx="512" cy="512" r="310" fill="none" stroke="${colors.secondary}" stroke-opacity="0.45" stroke-width="3"/>
  <circle cx="512" cy="512" r="220" fill="none" stroke="${colors.primary}" stroke-opacity="0.7" stroke-width="5"/>
  <g filter="url(#glow)" fill="none" stroke="${colors.secondary}" stroke-linecap="round">
    <path d="M512 196 L612 418 L852 444 L672 604 L724 836 L512 714 L300 836 L352 604 L172 444 L412 418 Z" stroke-width="8" opacity="0.82"/>
    <path d="M512 250 L688 512 L512 774 L336 512 Z" stroke-width="5" opacity="0.65"/>
    <path d="M254 512 H770 M512 254 V770" stroke-width="4" opacity="0.42"/>
  </g>
  <text x="512" y="545" text-anchor="middle" dominant-baseline="middle" font-family="Georgia, serif" font-size="188" fill="${colors.secondary}" filter="url(#glow)">${escapeXml(symbol)}</text>
  <text x="512" y="890" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="34" fill="${colors.secondary}">${escapeXml(title)}</text>
  <text x="512" y="936" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="22" fill="${colors.primary}">${escapeXml(subtitle).slice(0, 96)}</text>
</svg>`
}

export function sigilSvgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function downloadText(text: string, filename: string, type: string) {
  downloadBlob(new Blob([text], { type }), filename)
}

async function urlToBlob(url: string) {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Unable to fetch ${url}`)
  }

  return response.blob()
}

function imageToPngBlob(src: string) {
  return new Promise<Blob>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth || 1024
      canvas.height = image.naturalHeight || 1024
      const context = canvas.getContext('2d')

      if (!context) {
        reject(new Error('Canvas is not available'))
        return
      }

      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Unable to render PNG'))
        }
      }, 'image/png')
    }
    image.onerror = () => reject(new Error('Unable to load sigil image'))
    image.src = src
  })
}

async function sigilToPngBlob(sigil: DownloadableSigil) {
  if (sigil.generatedImageUrl) {
    try {
      return await imageToPngBlob(sigil.generatedImageUrl)
    } catch {
      try {
        const blob = await urlToBlob(sigil.generatedImageUrl)
        if (blob.type.startsWith('image/') && blob.type !== 'image/svg+xml') {
          return blob
        }
      } catch {
        // Fall through to SVG rendering.
      }
    }
  }

  return imageToPngBlob(sigilSvgToDataUrl(createSigilSvg(sigil)))
}

function createSigilManifest(sigil: DownloadableSigil) {
  return {
    id: sigil.id,
    name: sigil.name,
    symbol: sigil.symbol,
    style: getSigilStyle(sigil),
    sigilType: sigil.sigilType,
    element: sigil.element,
    rarity: sigil.rarity,
    powerLevel: sigil.powerLevel,
    generatedAt: sigil.generationTime || new Date().toISOString(),
    birthInfo: sigil.birthInfo,
    description: sigil.description,
    personalizedMeaning: sigil.personalizedMeaning,
    activationRitual: sigil.activationRitual,
    meditationInstructions: sigil.meditationInstructions || [],
    effects: getSigilEffects(sigil),
    requirements: sigil.requirements,
    costs: {
      base: sigil.baseCost,
      current: sigil.currentCost,
    },
  }
}

export async function downloadSigilAsset(sigil: DownloadableSigil, format: 'png' | 'svg' | 'pdf') {
  const baseName = getSigilBaseName(sigil)

  if (format === 'svg') {
    await downloadText(createSigilSvg(sigil), `${baseName}.svg`, 'image/svg+xml;charset=utf-8')
    return
  }

  if (format === 'png') {
    downloadBlob(await sigilToPngBlob(sigil), `${baseName}.png`)
    return
  }

  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'letter' })
  const margin = 48
  const title = sigil.name || 'Natal Sigil'

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.text(title, margin, 56)

  try {
    const imageBlob = await sigilToPngBlob(sigil)
    const imageDataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(imageBlob)
    })
    doc.addImage(imageDataUrl, 'PNG', margin, 84, 250, 250)
  } catch {
    doc.setFont('times', 'normal')
    doc.setFontSize(92)
    doc.text(
      sigil.symbol || SIGIL_STYLE_SYMBOLS[getSigilStyle(sigil)] || SIGIL_STYLE_SYMBOLS.cosmic,
      145,
      220
    )
  }

  let y = 370
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12)
  doc.text('Meaning', margin, y)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  y += 18
  doc.text(
    doc.splitTextToSize(
      sigil.personalizedMeaning || sigil.description || 'Generated natal sigil',
      500
    ),
    margin,
    y
  )
  y += 54

  const effects = getSigilEffects(sigil)
  if (effects.length > 0) {
    doc.setFont('helvetica', 'bold')
    doc.text('Effects', margin, y)
    doc.setFont('helvetica', 'normal')
    y += 18
    effects.slice(0, 6).forEach(effect => {
      doc.text(doc.splitTextToSize(`- ${effect}`, 500), margin, y)
      y += 24
    })
  }

  const instructions = sigil.meditationInstructions || []
  if (instructions.length > 0) {
    y += 10
    doc.setFont('helvetica', 'bold')
    doc.text('Meditation', margin, y)
    doc.setFont('helvetica', 'normal')
    y += 18
    instructions.slice(0, 6).forEach((instruction, index) => {
      doc.text(doc.splitTextToSize(`${index + 1}. ${instruction}`, 500), margin, y)
      y += 28
    })
  }

  doc.save(`${baseName}.pdf`)
}

export async function downloadSigilCollection(
  sigils: DownloadableSigil[],
  collectionName = 'sigil-collection'
) {
  if (sigils.length === 0) {
    return
  }

  const JSZip = (await import('jszip')).default
  const zip = new JSZip()
  const manifest = sigils.map(createSigilManifest)

  zip.file('manifest.json', JSON.stringify(manifest, null, 2))

  await Promise.all(
    sigils.map(async (sigil, index) => {
      const baseName = getSigilBaseName(sigil, index)
      const folder = zip.folder(baseName)

      if (!folder) {
        return
      }

      folder.file('metadata.json', JSON.stringify(createSigilManifest(sigil), null, 2))
      folder.file('sigil.svg', createSigilSvg(sigil))

      const instructions = [
        sigil.name || 'Natal Sigil',
        '',
        sigil.personalizedMeaning || sigil.description || '',
        '',
        'Meditation Instructions',
        ...(sigil.meditationInstructions || []).map((instruction, i) => `${i + 1}. ${instruction}`),
        '',
        sigil.activationRitual ? `Activation Ritual\n${sigil.activationRitual}` : '',
      ]
        .filter(Boolean)
        .join('\n')

      folder.file('guide.txt', instructions)

      try {
        folder.file('sigil.png', await sigilToPngBlob(sigil))
      } catch {
        // SVG plus metadata are still useful if rasterization fails.
      }
    })
  )

  const blob = await zip.generateAsync({ type: 'blob' })
  downloadBlob(blob, `${slugifyFilename(collectionName, 'sigil-collection')}.zip`)
}
