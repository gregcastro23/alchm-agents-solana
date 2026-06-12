// lib/chart-generators/natal-chart-generator.ts
// Local SVG-based natal chart generation with cosmic styling

import { BirthInfo } from '../schemas'
import {
  generateAccurateHoroscope,
  generateProfessionalHoroscope,
  type GeneratedHoroscope,
  type PlanetPosition,
} from '../monica/horoscope-generator'
import {
  CosmicChartTheme,
  generateChartStyles,
  getZodiacColors,
  getPlanetStyle,
  getAspectStyle,
} from './chart-styles'

export interface ChartConfig {
  size: number
  centerX: number
  centerY: number
  outerRadius: number
  innerRadius: number
  strokeWidth: number
  fontSize: number
  isDarkMode?: boolean
  responsive?: boolean
}

export interface LocalChartResponse {
  svg: string
  meta: {
    generated: boolean
    local: boolean
    timestamp: string
    method: string
  }
}

// Planetary symbols in Unicode
const PLANET_SYMBOLS = {
  Sun: '☉',
  Moon: '☾',
  Mercury: '☿',
  Venus: '♀',
  Mars: '♂',
  Jupiter: '♃',
  Saturn: '♄',
  Uranus: '♅',
  Neptune: '♆',
  Pluto: '♇',
}

// Zodiac symbols
const ZODIAC_SYMBOLS = {
  Aries: '♈',
  Taurus: '♉',
  Gemini: '♊',
  Cancer: '♋',
  Leo: '♌',
  Virgo: '♍',
  Libra: '♎',
  Scorpio: '♏',
  Sagittarius: '♐',
  Capricorn: '♑',
  Aquarius: '♒',
  Pisces: '♓',
}

// Use cosmic theme colors - now imported from chart-styles.ts

/**
 * Convert degrees to radians
 */
function degToRad(degrees: number): number {
  return (degrees * Math.PI) / 180
}

/**
 * Calculate position on circle from degrees (0° = top, clockwise)
 */
function calculatePosition(
  degrees: number,
  radius: number,
  centerX: number,
  centerY: number
): { x: number; y: number } {
  // Convert to standard mathematical coordinates (0° = right, counter-clockwise)
  // then adjust for astrological coordinates (0° = top, clockwise)
  const adjustedDegrees = 90 - degrees
  const radian = degToRad(adjustedDegrees)

  return {
    x: centerX + radius * Math.cos(radian),
    y: centerY - radius * Math.sin(radian),
  }
}

/**
 * Convert sign and degree to absolute degrees (0-360)
 */
function signDegreeToAbsolute(sign: string, degree: number): number {
  const signs = [
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
  ]
  const signIndex = signs.indexOf(sign)
  return signIndex * 30 + degree
}

/**
 * Generate zodiac wheel background with cosmic styling
 */
function generateZodiacWheel(config: ChartConfig): string {
  const { centerX, centerY, outerRadius, innerRadius, isDarkMode = false } = config
  let svg = ''

  // Draw 12 zodiac sections with cosmic styling
  for (let i = 0; i < 12; i++) {
    const startAngle = i * 30
    const endAngle = (i + 1) * 30
    const midAngle = startAngle + 15

    // Zodiac section background
    const start1 = calculatePosition(startAngle, outerRadius, centerX, centerY)
    const end1 = calculatePosition(endAngle, outerRadius, centerX, centerY)
    const start2 = calculatePosition(startAngle, innerRadius, centerX, centerY)
    const end2 = calculatePosition(endAngle, innerRadius, centerX, centerY)

    // Create sector path
    const largeArc = 0 // Always 30 degrees, so never large arc
    const pathData = [
      `M ${start2.x} ${start2.y}`,
      `L ${start1.x} ${start1.y}`,
      `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${end1.x} ${end1.y}`,
      `L ${end2.x} ${end2.y}`,
      `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${start2.x} ${start2.y}`,
      'Z',
    ].join(' ')

    // Get cosmic colors for this zodiac sign
    const signs = [
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
    ]
    const zodiacColors = getZodiacColors(signs[i], isDarkMode)

    svg += `
      <path d="${pathData}"
            class="zodiac-sector"
            fill="${zodiacColors.fill}"
            stroke="${zodiacColors.stroke}"
            stroke-width="1"
            opacity="${isDarkMode ? 0.8 : 0.9}"/>
    `

    // Zodiac symbol with cosmic styling
    const symbolPos = calculatePosition(midAngle, (outerRadius + innerRadius) / 2, centerX, centerY)
    const symbol = ZODIAC_SYMBOLS[signs[i] as keyof typeof ZODIAC_SYMBOLS] || signs[i][0]
    const textColor = isDarkMode
      ? CosmicChartTheme.colors.text.primary.dark
      : CosmicChartTheme.colors.text.primary.light

    svg += `
      <text x="${symbolPos.x}" y="${symbolPos.y}"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="${config.fontSize + 2}"
            font-weight="bold"
            fill="${textColor}"
            ${isDarkMode ? 'filter="drop-shadow(0 0 5px rgba(251, 191, 36, 0.3))"' : ''}>
        ${symbol}
      </text>
    `

    // Degree markings
    svg += `
      <line x1="${start1.x}" y1="${start1.y}"
            x2="${start2.x}" y2="${start2.y}"
            stroke="#adb5bd"
            stroke-width="1"/>
    `
  }

  return svg
}

/**
 * Generate house system (simplified equal house)
 */
function generateHouses(config: ChartConfig, ascendantDegree: number): string {
  const { centerX, centerY, outerRadius, innerRadius } = config
  let svg = ''

  // Draw 12 house cusps starting from ascendant
  for (let i = 0; i < 12; i++) {
    const houseCusp = (ascendantDegree + i * 30) % 360
    const start = calculatePosition(houseCusp, innerRadius * 0.7, centerX, centerY)
    const end = calculatePosition(houseCusp, innerRadius, centerX, centerY)

    svg += `
      <line x1="${start.x}" y1="${start.y}"
            x2="${end.x}" y2="${end.y}"
            stroke="#6c757d"
            stroke-width="1"
            stroke-dasharray="3,3"/>
    `

    // House number
    const numberPos = calculatePosition(houseCusp + 15, innerRadius * 0.85, centerX, centerY)
    svg += `
      <text x="${numberPos.x}" y="${numberPos.y}"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="${config.fontSize - 2}"
            fill="#6c757d">
        ${i + 1}
      </text>
    `
  }

  return svg
}

/**
 * Generate planet positions with cosmic styling
 */
function generatePlanets(config: ChartConfig, planets: PlanetPosition[]): string {
  const { centerX, centerY, outerRadius, innerRadius, isDarkMode = false } = config
  let svg = ''

  planets.forEach(planet => {
    const absoluteDegree = signDegreeToAbsolute(planet.Sign.label, planet.degrees)
    const radius = innerRadius + (outerRadius - innerRadius) * 0.3
    const position = calculatePosition(absoluteDegree, radius, centerX, centerY)

    const symbol = PLANET_SYMBOLS[planet.label as keyof typeof PLANET_SYMBOLS] || planet.label[0]
    const planetStyle = getPlanetStyle(planet.label, isDarkMode)

    // Planet symbol with cosmic glow
    svg += `
      <g class="planet-group" data-planet="${planet.label}">
        <circle cx="${position.x}" cy="${position.y}"
                r="${config.fontSize / 2 + 2}"
                class="planet-glow"
                fill="${planetStyle.fill}"
                stroke="${planetStyle.stroke}"
                stroke-width="2"
                ${planetStyle.filter ? `filter="${planetStyle.filter}"` : ''}
                opacity="${isDarkMode ? 0.9 : 1}"/>
        <text x="${position.x}" y="${position.y}"
              text-anchor="middle"
              dominant-baseline="central"
              font-size="${config.fontSize}"
              font-weight="bold"
              class="planet-symbol"
              fill="${isDarkMode ? '#ffffff' : '#ffffff'}"
              style="text-shadow: 0 0 10px ${planetStyle.fill}">
          ${symbol}
        </text>
      </g>
    `

    // Planet label with degrees
    const labelRadius = radius + 25
    const labelPos = calculatePosition(absoluteDegree, labelRadius, centerX, centerY)
    const degreeText = `${Math.floor(planet.degrees)}°${planet.Sign.label.substring(0, 3)}`

    svg += `
      <text x="${labelPos.x}" y="${labelPos.y}"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="${config.fontSize - 2}"
            fill="#495057">
        ${planet.label}
      </text>
      <text x="${labelPos.x}" y="${labelPos.y + config.fontSize}"
            text-anchor="middle"
            dominant-baseline="central"
            font-size="${config.fontSize - 4}"
            fill="#6c757d">
        ${degreeText}${planet.retrograde ? ' R' : ''}
      </text>
    `
  })

  return svg
}

/**
 * Generate aspects between planets with cosmic styling
 */
function generateAspects(config: ChartConfig, planets: PlanetPosition[]): string {
  const { centerX, centerY, innerRadius, isDarkMode = false } = config
  let svg = ''

  const aspectOrbs = {
    conjunction: { degrees: 0, orb: 8 },
    opposition: { degrees: 180, orb: 8 },
    trine: { degrees: 120, orb: 6 },
    square: { degrees: 90, orb: 6 },
    sextile: { degrees: 60, orb: 4 },
  }

  for (let i = 0; i < planets.length; i++) {
    for (let j = i + 1; j < planets.length; j++) {
      const planet1 = planets[i]
      const planet2 = planets[j]

      const degree1 = signDegreeToAbsolute(planet1.Sign.label, planet1.degrees)
      const degree2 = signDegreeToAbsolute(planet2.Sign.label, planet2.degrees)

      let angleDiff = Math.abs(degree1 - degree2)
      if (angleDiff > 180) angleDiff = 360 - angleDiff

      // Check for aspects with cosmic styling
      for (const [aspectName, aspectData] of Object.entries(aspectOrbs)) {
        if (Math.abs(angleDiff - aspectData.degrees) <= aspectData.orb) {
          const pos1 = calculatePosition(degree1, innerRadius * 0.9, centerX, centerY)
          const pos2 = calculatePosition(degree2, innerRadius * 0.9, centerX, centerY)
          const aspectStyle = getAspectStyle(aspectName, isDarkMode)

          svg += `
            <line x1="${pos1.x}" y1="${pos1.y}"
                  x2="${pos2.x}" y2="${pos2.y}"
                  class="aspect-line"
                  stroke="${aspectStyle.stroke}"
                  stroke-width="${aspectStyle.strokeWidth}"
                  opacity="${aspectStyle.opacity}"
                  ${aspectStyle.filter ? `filter="${aspectStyle.filter}"` : ''}
                  data-aspect="${aspectName}"
                  data-planets="${planet1.label}-${planet2.label}"/>
          `
          break // Only draw the first matching aspect
        }
      }
    }
  }

  return svg
}

/**
 * Generate complete natal chart SVG
 */
export function generateNatalChartSVG(
  birthInfo: BirthInfo,
  options: { useEnhancedCalculations?: boolean } = {}
): LocalChartResponse {
  try {
    // Try enhanced calculations first if requested, with fallback to legacy
    let horoscope: GeneratedHoroscope
    let method = 'Legacy simplified calculations'

    if (options.useEnhancedCalculations !== false) {
      try {
        horoscope = generateProfessionalHoroscope(
          {
            year: birthInfo.year,
            month: birthInfo.month + 1, // Convert to 1-based month
            day: birthInfo.day,
            hour: birthInfo.hour,
            minute: birthInfo.minute,
            latitude: birthInfo.latitude || 40.7128,
            longitude: birthInfo.longitude || -74.006,
          },
          {
            useLegacyFallback: false,
            includeAccuracyMetadata: true,
          }
        )
        method = 'Enhanced VSOP87-like calculations (±0.1° precision)'
      } catch (enhancedError) {
        console.warn('Enhanced calculations failed, using legacy fallback:', enhancedError)
        horoscope = generateAccurateHoroscope({
          year: birthInfo.year,
          month: birthInfo.month + 1, // Convert to 1-based month
          day: birthInfo.day,
          hour: birthInfo.hour,
          minute: birthInfo.minute,
          latitude: birthInfo.latitude || 0,
          longitude: birthInfo.longitude || 0,
        })
        method = 'Legacy fallback (enhanced calculations failed)'
      }
    } else {
      horoscope = generateAccurateHoroscope({
        year: birthInfo.year,
        month: birthInfo.month + 1, // Convert to 1-based month
        day: birthInfo.day,
        hour: birthInfo.hour,
        minute: birthInfo.minute,
        latitude: birthInfo.latitude || 0,
        longitude: birthInfo.longitude || 0,
      })
    }

    // Enhanced chart configuration with responsiveness
    const config: ChartConfig = {
      size: 400,
      centerX: 200,
      centerY: 200,
      outerRadius: 180,
      innerRadius: 120,
      strokeWidth: 2,
      fontSize: 12,
      isDarkMode: true, // Default to dark mode for cosmic theme
      responsive: true,
    }

    const ascendantDegree = signDegreeToAbsolute(
      horoscope.tropical.Ascendant.Sign.label,
      horoscope.tropical.Ascendant.degrees
    )

    // Generate SVG components
    const zodiacWheel = generateZodiacWheel(config)
    const houses = generateHouses(config, ascendantDegree)
    const planets = generatePlanets(config, horoscope.tropical.CelestialBodies.all)
    const aspects = generateAspects(config, horoscope.tropical.CelestialBodies.all)

    // Generate cosmic chart styles
    const chartStyles = generateChartStyles(config.isDarkMode)
    const bgColor = config.isDarkMode
      ? CosmicChartTheme.colors.background.glass
      : CosmicChartTheme.colors.background.light
    const borderColor = config.isDarkMode
      ? CosmicChartTheme.colors.border.glow
      : CosmicChartTheme.colors.border.light
    const titleColor = config.isDarkMode
      ? CosmicChartTheme.colors.text.primary.dark
      : CosmicChartTheme.colors.text.primary.light
    const subtitleColor = config.isDarkMode
      ? CosmicChartTheme.colors.text.secondary.dark
      : CosmicChartTheme.colors.text.secondary.light

    // Assemble complete cosmic SVG
    const svg = `
      <svg width="${config.responsive ? '100%' : config.size}"
           height="${config.responsive ? '100%' : config.size}"
           viewBox="0 0 ${config.size} ${config.size}"
           xmlns="http://www.w3.org/2000/svg"
           class="cosmic-natal-chart">
        <defs>
          ${chartStyles}
          <filter id="cosmic-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        <!-- Cosmic Background -->
        <circle cx="${config.centerX}" cy="${config.centerY}"
                r="${config.outerRadius}"
                class="chart-container"
                fill="${bgColor}"
                stroke="${borderColor}"
                stroke-width="${config.strokeWidth}"
                ${config.isDarkMode ? 'filter="url(#cosmic-glow)"' : ''}/>

        <!-- Zodiac wheel -->
        ${zodiacWheel}

        <!-- Aspects (drawn first, behind planets) -->
        ${aspects}

        <!-- Houses -->
        ${houses}

        <!-- Planets -->
        ${planets}

        <!-- Center point with cosmic glow -->
        <circle cx="${config.centerX}" cy="${config.centerY}"
                r="4"
                fill="${config.isDarkMode ? CosmicChartTheme.colors.planets.Sun.primary : '#495057'}"
                ${config.isDarkMode ? 'filter="drop-shadow(0 0 10px rgba(251, 191, 36, 0.8))"' : ''}/>

        <!-- Chart info with cosmic styling -->
        <text x="${config.centerX}" y="25"
              text-anchor="middle"
              class="chart-title"
              fill="${titleColor}"
              font-family="${CosmicChartTheme.fonts.primary}"
              ${config.isDarkMode ? 'filter="drop-shadow(0 0 10px rgba(251, 191, 36, 0.3))"' : ''}>
          ${birthInfo.name || 'Cosmic Natal Chart'}
        </text>
        <text x="${config.centerX}" y="40"
              text-anchor="middle"
              class="chart-subtitle"
              fill="${subtitleColor}"
              font-family="${CosmicChartTheme.fonts.primary}">
          ${new Date(birthInfo.year, birthInfo.month, birthInfo.day).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })} at ${String(birthInfo.hour).padStart(2, '0')}:${String(birthInfo.minute).padStart(2, '0')}
        </text>

        <!-- Cosmic signature -->
        <text x="${config.centerX}" y="${config.size - 15}"
              text-anchor="middle"
              font-size="8"
              fill="${subtitleColor}"
              opacity="0.6">
          Generated with Cosmic Precision ✨
        </text>
      </svg>
    `

    return {
      svg: svg.trim(),
      meta: {
        generated: true,
        local: true,
        timestamp: new Date().toISOString(),
        method,
      } as any,
    }
  } catch (error) {
    console.error('Error generating local natal chart:', error)

    // Return a simple fallback chart
    const fallbackSvg = `
      <svg width="400" height="400" viewBox="0 0 400 400" xmlns="http://www.w3.org/2000/svg">
        <circle cx="200" cy="200" r="150" fill="none" stroke="#dee2e6" stroke-width="2"/>
        <text x="200" y="200" text-anchor="middle" dominant-baseline="central"
              font-size="16" fill="#6c757d">
          Chart Generation Error
        </text>
        <text x="200" y="220" text-anchor="middle" dominant-baseline="central"
              font-size="12" fill="#6c757d">
          ${birthInfo.name || 'Unknown'} - ${new Date().toLocaleDateString()}
        </text>
      </svg>
    `

    return {
      svg: fallbackSvg,
      meta: {
        generated: false,
        local: true,
        timestamp: new Date().toISOString(),
        method: 'fallback-error',
      },
    }
  }
}
