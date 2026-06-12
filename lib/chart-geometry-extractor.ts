/**
 * Chart Geometry Extractor
 *
 * Unified service for extracting aspect geometry from various chart visualizations.
 * Converts SVG/Canvas chart elements into RuneGeometry for sigil generation.
 */

import {
  PlanetPosition,
  Aspect,
  AspectType,
  PatternConfiguration,
  detectPatternsStatic,
  getAspectColor,
} from './astrological-pattern-recognition'
import {
  RuneGeometry,
  EnhancedAspectLine,
  PowerNode,
  ASPECT_RUNE_MAPPINGS,
} from './runes/natal-sigil-runes'

export interface ChartCoordinate {
  x: number
  y: number
  planet?: string
  degree?: number
}

export interface ChartBounds {
  width: number
  height: number
  centerX: number
  centerY: number
  radius: number
}

/**
 * Main chart geometry extractor class
 */
export class ChartGeometryExtractor {
  /**
   * Extract geometry from an SVG chart element
   */
  static extractFromSVG(svgElement: SVGElement): RuneGeometry {
    const bounds = this.getSVGBounds(svgElement)
    const planetCoordinates = this.extractPlanetCoordinatesFromSVG(svgElement)
    const aspectLines = this.extractAspectLinesFromSVG(svgElement, planetCoordinates)
    const powerNodes = this.detectPowerNodes(aspectLines, bounds)
    const elementalBalance = this.calculateElementalBalance(aspectLines)

    return {
      aspectLines,
      centerPoint: { x: bounds.centerX, y: bounds.centerY },
      powerNodes,
      sacredPatterns: [], // Will be populated by pattern detection
      chartBounds: {
        width: bounds.width,
        height: bounds.height,
      },
      dominantElement: this.determineDominantElement(elementalBalance),
      elementalBalance,
    }
  }

  /**
   * Extract geometry from a Canvas chart element
   */
  static extractFromCanvas(canvasElement: HTMLCanvasElement): RuneGeometry {
    const ctx = canvasElement.getContext('2d')
    if (!ctx) {
      throw new Error('Unable to get canvas context')
    }

    const bounds: ChartBounds = {
      width: canvasElement.width,
      height: canvasElement.height,
      centerX: canvasElement.width / 2,
      centerY: canvasElement.height / 2,
      radius: Math.min(canvasElement.width, canvasElement.height) / 2 - 20,
    }

    // For canvas, we would need to analyze pixel data or maintain a drawing state
    // This is a simplified implementation
    const aspectLines = this.extractAspectLinesFromCanvas(ctx, bounds)
    const powerNodes = this.detectPowerNodes(aspectLines, bounds)
    const elementalBalance = this.calculateElementalBalance(aspectLines)

    return {
      aspectLines,
      centerPoint: { x: bounds.centerX, y: bounds.centerY },
      powerNodes,
      sacredPatterns: [],
      chartBounds: {
        width: bounds.width,
        height: bounds.height,
      },
      dominantElement: this.determineDominantElement(elementalBalance),
      elementalBalance,
    }
  }

  /**
   * Extract geometry from planet positions and aspects
   */
  static extractFromChartData(
    planets: PlanetPosition[],
    aspects: Aspect[],
    width: number = 800,
    height: number = 800
  ): RuneGeometry {
    const bounds: ChartBounds = {
      width,
      height,
      centerX: width / 2,
      centerY: height / 2,
      radius: Math.min(width, height) / 2 - 40,
    }

    // Calculate planet coordinates on a circle
    const planetCoordinates = this.calculatePlanetCoordinates(planets, bounds)

    // Convert aspects to enhanced aspect lines
    const aspectLines = this.convertAspectsToLines(aspects, planetCoordinates, bounds)

    // Detect power nodes
    const powerNodes = this.detectPowerNodes(aspectLines, bounds)

    // Detect patterns
    const { patterns } = detectPatternsStatic(planets)

    // Calculate elemental balance
    const elementalBalance = this.calculateElementalBalanceFromPlanets(planets)

    return {
      aspectLines,
      centerPoint: { x: bounds.centerX, y: bounds.centerY },
      powerNodes,
      sacredPatterns: patterns,
      chartBounds: {
        width: bounds.width,
        height: bounds.height,
      },
      dominantElement: this.determineDominantElement(elementalBalance),
      elementalBalance,
    }
  }

  /**
   * Get SVG bounds
   */
  private static getSVGBounds(svgElement: SVGElement): ChartBounds {
    const svgEl = svgElement as SVGSVGElement
    const viewBox = svgEl.viewBox?.baseVal
    const width = viewBox?.width || svgElement.clientWidth || 800
    const height = viewBox?.height || svgElement.clientHeight || 800
    const centerX = width / 2
    const centerY = height / 2
    const radius = Math.min(width, height) / 2 - 20

    return { width, height, centerX, centerY, radius }
  }

  /**
   * Extract planet coordinates from SVG elements
   */
  private static extractPlanetCoordinatesFromSVG(
    svgElement: SVGElement
  ): Map<string, ChartCoordinate> {
    const coordinates = new Map<string, ChartCoordinate>()

    // Look for planet markers (circles, text elements, or custom elements)
    const planetElements = svgElement.querySelectorAll(
      '[data-planet], .planet-marker, circle.planet, text.planet-label'
    )

    planetElements.forEach(element => {
      const planet =
        element.getAttribute('data-planet') ||
        element.getAttribute('id')?.replace('planet-', '') ||
        element.textContent?.toLowerCase()

      if (planet) {
        let x = 0,
          y = 0

        if (element instanceof SVGCircleElement) {
          x = parseFloat(element.getAttribute('cx') || '0')
          y = parseFloat(element.getAttribute('cy') || '0')
        } else if (element instanceof SVGTextElement) {
          x = parseFloat(element.getAttribute('x') || '0')
          y = parseFloat(element.getAttribute('y') || '0')
        } else {
          // Try to get transform or position
          const transform = element.getAttribute('transform')
          const match = transform?.match(/translate\(([^,]+),([^)]+)\)/)
          if (match) {
            x = parseFloat(match[1])
            y = parseFloat(match[2])
          }
        }

        coordinates.set(planet, {
          x,
          y,
          planet,
          degree: parseFloat(element.getAttribute('data-degree') || '0'),
        })
      }
    })

    return coordinates
  }

  /**
   * Extract aspect lines from SVG
   */
  private static extractAspectLinesFromSVG(
    svgElement: SVGElement,
    planetCoordinates: Map<string, ChartCoordinate>
  ): EnhancedAspectLine[] {
    const aspectLines: EnhancedAspectLine[] = []

    // Look for aspect lines (paths or lines)
    const lineElements = svgElement.querySelectorAll(
      '[data-aspect], .aspect-line, line.aspect, path.aspect'
    )

    lineElements.forEach(element => {
      const aspectType = element.getAttribute('data-aspect') as AspectType
      const planet1 = element.getAttribute('data-planet1')
      const planet2 = element.getAttribute('data-planet2')

      if (aspectType && planet1 && planet2) {
        const coord1 = planetCoordinates.get(planet1)
        const coord2 = planetCoordinates.get(planet2)

        if (coord1 && coord2) {
          const aspectMapping = ASPECT_RUNE_MAPPINGS[aspectType]

          aspectLines.push({
            planet1,
            planet2,
            type: aspectType,
            angle: parseFloat(element.getAttribute('data-angle') || '0'),
            orb: parseFloat(element.getAttribute('data-orb') || '0'),
            applying: element.getAttribute('data-applying') === 'true',
            separating: element.getAttribute('data-separating') === 'true',
            strength: (element.getAttribute('data-strength') || 'moderate') as Aspect['strength'],
            coordinates: {
              x1: coord1.x,
              y1: coord1.y,
              x2: coord2.x,
              y2: coord2.y,
            },
            visualWeight: aspectMapping?.weight || 1,
            color: aspectMapping?.color || getAspectColor(aspectType),
            runicStroke: aspectMapping?.stroke || 'default-stroke',
            energyFlow: aspectMapping?.energy || 'neutral',
          })
        }
      } else if (element instanceof SVGLineElement) {
        // Fallback: extract from line coordinates
        const x1 = parseFloat(element.getAttribute('x1') || '0')
        const y1 = parseFloat(element.getAttribute('y1') || '0')
        const x2 = parseFloat(element.getAttribute('x2') || '0')
        const y2 = parseFloat(element.getAttribute('y2') || '0')

        // Try to determine aspect type from class or stroke
        const classList = element.classList
        let type: AspectType = 'conjunction'
        if (classList.contains('opposition')) type = 'opposition'
        else if (classList.contains('trine')) type = 'trine'
        else if (classList.contains('square')) type = 'square'
        else if (classList.contains('sextile')) type = 'sextile'

        const aspectMapping = ASPECT_RUNE_MAPPINGS[type]

        aspectLines.push({
          planet1: 'unknown1',
          planet2: 'unknown2',
          type,
          angle: 0,
          orb: 0,
          applying: false,
          separating: false,
          strength: 'moderate',
          coordinates: { x1, y1, x2, y2 },
          visualWeight: aspectMapping?.weight || 1,
          color: element.getAttribute('stroke') || aspectMapping?.color || '#808080',
          runicStroke: aspectMapping?.stroke || 'default-stroke',
          energyFlow: aspectMapping?.energy || 'neutral',
        })
      }
    })

    return aspectLines
  }

  /**
   * Extract aspect lines from Canvas (simplified)
   */
  private static extractAspectLinesFromCanvas(
    ctx: CanvasRenderingContext2D,
    bounds: ChartBounds
  ): EnhancedAspectLine[] {
    // This would require maintaining drawing state or analyzing pixel data
    // For now, return empty array - real implementation would track drawing operations
    return []
  }

  /**
   * Calculate planet coordinates on a circle
   */
  private static calculatePlanetCoordinates(
    planets: PlanetPosition[],
    bounds: ChartBounds
  ): Map<string, ChartCoordinate> {
    const coordinates = new Map<string, ChartCoordinate>()
    const signOrder = [
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

    planets.forEach(planet => {
      // Calculate absolute degree (0-360)
      const signIndex = signOrder.indexOf(planet.sign)
      const absoluteDegree = signIndex * 30 + planet.degree

      // Convert to radians (0 degrees = top of circle)
      const radians = ((absoluteDegree - 90) * Math.PI) / 180

      // Calculate position on circle
      const x = bounds.centerX + bounds.radius * Math.cos(radians)
      const y = bounds.centerY + bounds.radius * Math.sin(radians)

      coordinates.set(planet.planet, {
        x,
        y,
        planet: planet.planet,
        degree: absoluteDegree,
      })
    })

    return coordinates
  }

  /**
   * Convert aspects to enhanced aspect lines
   */
  private static convertAspectsToLines(
    aspects: Aspect[],
    planetCoordinates: Map<string, ChartCoordinate>,
    bounds: ChartBounds
  ): EnhancedAspectLine[] {
    return aspects.map(aspect => {
      const coord1 = planetCoordinates.get(aspect.planet1) || {
        x: bounds.centerX,
        y: bounds.centerY,
      }
      const coord2 = planetCoordinates.get(aspect.planet2) || {
        x: bounds.centerX,
        y: bounds.centerY,
      }

      const aspectMapping = ASPECT_RUNE_MAPPINGS[aspect.type]

      return {
        ...aspect,
        coordinates: {
          x1: coord1.x,
          y1: coord1.y,
          x2: coord2.x,
          y2: coord2.y,
        },
        visualWeight: aspectMapping?.weight || 1,
        color: aspectMapping?.color || getAspectColor(aspect.type),
        runicStroke: aspectMapping?.stroke || 'default-stroke',
        energyFlow: aspectMapping?.energy || 'neutral',
      }
    })
  }

  /**
   * Detect power nodes where multiple aspects converge
   */
  static detectPowerNodes(aspectLines: EnhancedAspectLine[], bounds: ChartBounds): PowerNode[] {
    const nodes: PowerNode[] = []
    const convergenceThreshold = 20 // pixels

    // Group lines by proximity
    const intersectionPoints = new Map<
      string,
      {
        x: number
        y: number
        lines: EnhancedAspectLine[]
      }
    >()

    // Find line intersections
    for (let i = 0; i < aspectLines.length; i++) {
      for (let j = i + 1; j < aspectLines.length; j++) {
        const intersection = this.lineIntersection(aspectLines[i], aspectLines[j])

        if (intersection) {
          const key = `${Math.round(intersection.x / convergenceThreshold)}_${Math.round(intersection.y / convergenceThreshold)}`

          if (!intersectionPoints.has(key)) {
            intersectionPoints.set(key, {
              x: intersection.x,
              y: intersection.y,
              lines: [],
            })
          }

          const point = intersectionPoints.get(key)!
          if (!point.lines.includes(aspectLines[i])) {
            point.lines.push(aspectLines[i])
          }
          if (!point.lines.includes(aspectLines[j])) {
            point.lines.push(aspectLines[j])
          }
        }
      }
    }

    // Convert intersection points to power nodes
    intersectionPoints.forEach(point => {
      if (point.lines.length >= 2) {
        const energy =
          point.lines.length * 10 + point.lines.filter(l => l.energyFlow === 'positive').length * 5

        const convergingAspects = [...new Set(point.lines.map(l => l.type))]
        const planetaryInfluences = [...new Set(point.lines.flatMap(l => [l.planet1, l.planet2]))]

        nodes.push({
          x: point.x,
          y: point.y,
          energy,
          convergingAspects,
          planetaryInfluences,
        })
      }
    })

    // Sort by energy level
    return nodes.sort((a, b) => b.energy - a.energy)
  }

  /**
   * Calculate line intersection point
   */
  private static lineIntersection(
    line1: EnhancedAspectLine,
    line2: EnhancedAspectLine
  ): { x: number; y: number } | null {
    const x1 = line1.coordinates.x1
    const y1 = line1.coordinates.y1
    const x2 = line1.coordinates.x2
    const y2 = line1.coordinates.y2

    const x3 = line2.coordinates.x1
    const y3 = line2.coordinates.y1
    const x4 = line2.coordinates.x2
    const y4 = line2.coordinates.y2

    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4)

    if (Math.abs(denom) < 0.01) {
      return null // Lines are parallel
    }

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom

    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
      return {
        x: x1 + t * (x2 - x1),
        y: y1 + t * (y2 - y1),
      }
    }

    return null
  }

  /**
   * Calculate elemental balance from aspect lines
   */
  private static calculateElementalBalance(aspectLines: EnhancedAspectLine[]): {
    fire: number
    water: number
    air: number
    earth: number
  } {
    const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 }

    // Map aspect types to elements
    const aspectElements: Record<string, keyof typeof elementCounts> = {
      trine: 'fire',
      conjunction: 'earth',
      sextile: 'air',
      opposition: 'water',
      square: 'fire',
      quincunx: 'water',
    }

    aspectLines.forEach(line => {
      const element = aspectElements[line.type] || 'earth'
      elementCounts[element] += line.visualWeight
    })

    const total = Object.values(elementCounts).reduce((a, b) => a + b, 1)

    return {
      fire: Math.round((elementCounts.fire / total) * 100),
      water: Math.round((elementCounts.water / total) * 100),
      air: Math.round((elementCounts.air / total) * 100),
      earth: Math.round((elementCounts.earth / total) * 100),
    }
  }

  /**
   * Calculate elemental balance from planet positions
   */
  private static calculateElementalBalanceFromPlanets(planets: PlanetPosition[]): {
    fire: number
    water: number
    air: number
    earth: number
  } {
    const signElements: Record<
      string,
      keyof { fire: number; water: number; air: number; earth: number }
    > = {
      Aries: 'fire',
      Leo: 'fire',
      Sagittarius: 'fire',
      Taurus: 'earth',
      Virgo: 'earth',
      Capricorn: 'earth',
      Gemini: 'air',
      Libra: 'air',
      Aquarius: 'air',
      Cancer: 'water',
      Scorpio: 'water',
      Pisces: 'water',
    }

    const elementCounts = { fire: 0, water: 0, air: 0, earth: 0 }

    planets.forEach(planet => {
      const element = signElements[planet.sign]
      if (element) {
        elementCounts[element]++
      }
    })

    const total = planets.length || 1

    return {
      fire: Math.round((elementCounts.fire / total) * 100),
      water: Math.round((elementCounts.water / total) * 100),
      air: Math.round((elementCounts.air / total) * 100),
      earth: Math.round((elementCounts.earth / total) * 100),
    }
  }

  /**
   * Determine dominant element
   */
  private static determineDominantElement(balance: {
    fire: number
    water: number
    air: number
    earth: number
  }): string {
    const entries = Object.entries(balance)
    const max = entries.reduce((a, b) => (a[1] > b[1] ? a : b))
    return max[0].charAt(0).toUpperCase() + max[0].slice(1)
  }
}
