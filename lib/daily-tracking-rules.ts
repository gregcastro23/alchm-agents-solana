// Daily Tracking and Precision Rules
// Based on Gregs_Energy_Kalchm_Daily_Tracker.ipynb and Rising_Sign_Precision_Tracker.ipynb

export interface DailyEnergyReading {
  timestamp: Date
  sunSign: string
  moonSign: string
  ascendant: string
  chartRuler: string
  alchemicalValues: {
    spirit: number
    essence: number
    matter: number
    substance: number
    totalPower: number
  }
  elementalValues: {
    fire: number
    water: number
    air: number
    earth: number
  }
  thermodynamics: {
    heat: number
    entropy: number
    reactivity: number
    energy: number
  }
  constants: {
    kalchmConstant: number
    monicaConstant: number
  }
  planetaryHour: string
  moonPhase: string
  seasonalInfluence: string
}

export interface DailyTracking {
  date: string
  morningReading: DailyEnergyReading
  eveningReading?: DailyEnergyReading
  peakEnergyTime?: string
  lowEnergyTime?: string
  dominantTheme: string
  challenges: string[]
  opportunities: string[]
  foodChoices: string[]
  energyLevel: 1 | 2 | 3 | 4 | 5
  moodRating: 1 | 2 | 3 | 4 | 5
  notes: string
}

export interface WeeklyPattern {
  weekStarting: string
  dominantElement: string
  avgEnergy: number
  avgKalchmConstant: number
  avgMonicaConstant: number
  peakDay: string
  challengingDay: string
  patterns: string[]
  recommendations: string[]
}

export interface MonthlyTrend {
  month: string
  year: number
  overallTrend: 'Ascending' | 'Descending' | 'Stable' | 'Fluctuating'
  dominantElements: string[]
  avgThermodynamics: {
    heat: number
    entropy: number
    reactivity: number
    energy: number
  }
  significantDates: string[]
  evolutionNotes: string[]
}

/**
 * DAILY ENERGY TRACKER
 * Core tracking and analysis system
 */
export class DailyEnergyTracker {
  private static readings: DailyEnergyReading[] = []
  private static dailyLogs: DailyTracking[] = []

  static addReading(reading: DailyEnergyReading): void {
    this.readings.push(reading)
    this.readings.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())
  }

  static getCurrentReading(): DailyEnergyReading | null {
    return this.readings.length > 0 ? this.readings[this.readings.length - 1] : null
  }

  static getReadingsForDate(date: Date): DailyEnergyReading[] {
    const dateStr = date.toISOString().split('T')[0]
    return this.readings.filter(
      reading => reading.timestamp.toISOString().split('T')[0] === dateStr
    )
  }

  static getReadingsForDateRange(startDate: Date, endDate: Date): DailyEnergyReading[] {
    return this.readings.filter(
      reading => reading.timestamp >= startDate && reading.timestamp <= endDate
    )
  }

  static analyzeCurrentState(): {
    energyPhase: 'Building' | 'Clearing' | 'Balancing' | 'Transforming'
    dominantInfluence: string
    keyMetrics: Record<string, number>
    recommendations: string[]
    alerts: string[]
  } {
    const current = this.getCurrentReading()
    if (!current) {
      return {
        energyPhase: 'Balancing',
        dominantInfluence: 'Unknown',
        keyMetrics: {},
        recommendations: ['Take a current reading to begin analysis'],
        alerts: ['No current data available'],
      }
    }

    const { alchemicalValues, thermodynamics, constants } = current
    const totalAlchemical = Object.values(alchemicalValues).reduce((sum, val) => sum + val, 0)

    // Determine energy phase
    let energyPhase: 'Building' | 'Clearing' | 'Balancing' | 'Transforming'
    if (totalAlchemical < -10) {
      energyPhase = 'Clearing'
    } else if (totalAlchemical > 10) {
      energyPhase = 'Building'
    } else if (Math.abs(thermodynamics.energy) > 0.1) {
      energyPhase = 'Transforming'
    } else {
      energyPhase = 'Balancing'
    }

    // Determine dominant influence
    const elementalEntries = Object.entries(current.elementalValues)
    const dominantElement = elementalEntries.reduce((max, curr) =>
      Math.abs(curr[1]) > Math.abs(max[1]) ? curr : max
    )[0]

    const dominantInfluence = `${dominantElement} element via ${current.chartRuler}`

    // Key metrics
    const keyMetrics = {
      "Greg's Energy": thermodynamics.energy,
      'Total Alchemical': totalAlchemical,
      'Kalchm Constant': constants.kalchmConstant,
      'Monica Constant': constants.monicaConstant,
      Heat: thermodynamics.heat,
      Entropy: thermodynamics.entropy,
      Reactivity: thermodynamics.reactivity,
    }

    // Generate recommendations
    const recommendations: string[] = []
    const alerts: string[] = []

    switch (energyPhase) {
      case 'Clearing':
        recommendations.push('Focus on release and letting go')
        recommendations.push('Choose light, cleansing foods')
        recommendations.push('Engage in gentle, flowing activities')
        if (totalAlchemical < -20) {
          alerts.push('Intense clearing period - extra self-care needed')
        }
        break

      case 'Building':
        recommendations.push('Focus on growth and development')
        recommendations.push('Choose nourishing, strengthening foods')
        recommendations.push('Take on new projects and challenges')
        break

      case 'Transforming':
        recommendations.push('Embrace change and evolution')
        recommendations.push('Choose dynamic, varied foods')
        recommendations.push('Stay flexible and adaptable')
        if (Math.abs(thermodynamics.energy) > 0.5) {
          alerts.push('High transformation energy - monitor carefully')
        }
        break

      case 'Balancing':
        recommendations.push('Maintain equilibrium and harmony')
        recommendations.push('Choose balanced, moderate foods')
        recommendations.push('Focus on stability and consistency')
        break
    }

    // Check for concerning patterns
    if (constants.kalchmConstant < -1) {
      alerts.push('Kalchm constant strongly negative - system strain detected')
    }
    if (constants.monicaConstant < -1) {
      alerts.push('Monica constant strongly negative - resistance to change')
    }
    if (thermodynamics.reactivity > 2) {
      alerts.push('High reactivity - potential for rapid changes')
    }

    return {
      energyPhase,
      dominantInfluence,
      keyMetrics,
      recommendations,
      alerts,
    }
  }

  static generateDailyInsights(date: Date): {
    summary: string
    energyPattern: string
    optimalTiming: {
      bestActivities: Array<{ time: string; activity: string }>
      avoidTimes: string[]
    }
    foodGuidance: {
      breakfast: string[]
      lunch: string[]
      dinner: string[]
    }
  } {
    const readings = this.getReadingsForDate(date)
    if (readings.length === 0) {
      return {
        summary: 'No readings available for this date',
        energyPattern: 'Unknown',
        optimalTiming: { bestActivities: [], avoidTimes: [] },
        foodGuidance: { breakfast: [], lunch: [], dinner: [] },
      }
    }

    const morning = readings.find(r => r.timestamp.getHours() < 12)
    const evening = readings.find(r => r.timestamp.getHours() >= 17)
    const current = readings[readings.length - 1]

    // Generate summary
    let summary = `${current.sunSign} energy with ${current.chartRuler} influence. `
    summary += `Total alchemical power: ${current.alchemicalValues.totalPower.toFixed(1)}. `
    summary += `Greg's Energy: ${current.thermodynamics.energy.toFixed(3)}.`

    // Determine energy pattern
    let energyPattern = 'Stable'
    if (morning && evening) {
      const energyChange = evening.thermodynamics.energy - morning.thermodynamics.energy
      if (energyChange > 0.1) {
        energyPattern = 'Rising'
      } else if (energyChange < -0.1) {
        energyPattern = 'Declining'
      } else {
        energyPattern = 'Stable'
      }
    }

    // Optimal timing based on planetary hours and energy
    const optimalTiming = this.generateOptimalTiming(current)

    // Food guidance based on current state
    const foodGuidance = this.generateFoodGuidance(current)

    return {
      summary,
      energyPattern,
      optimalTiming,
      foodGuidance,
    }
  }

  private static generateOptimalTiming(reading: DailyEnergyReading): {
    bestActivities: Array<{ time: string; activity: string }>
    avoidTimes: string[]
  } {
    const bestActivities: Array<{ time: string; activity: string }> = []
    const avoidTimes: string[] = []

    const { energy } = reading.thermodynamics
    const { planetaryHour } = reading

    // High energy periods
    if (energy > 0.1) {
      bestActivities.push({
        time: 'Current planetary hour',
        activity: 'Dynamic activities, important decisions, creative work',
      })
    }

    // Planetary hour specific activities
    switch (planetaryHour) {
      case 'Sun':
        bestActivities.push({
          time: 'Solar hours (sunrise +/- 2 hours)',
          activity: 'Leadership, public activities, vitality work',
        })
        break
      case 'Moon':
        bestActivities.push({
          time: 'Lunar hours (evening)',
          activity: 'Emotional processing, intuitive work, nurturing',
        })
        break
      case 'Mercury':
        bestActivities.push({
          time: 'Mercury hours',
          activity: 'Communication, learning, detailed work',
        })
        break
      case 'Venus':
        bestActivities.push({
          time: 'Venus hours',
          activity: 'Relationships, beauty, artistic pursuits',
        })
        break
      case 'Mars':
        bestActivities.push({
          time: 'Mars hours',
          activity: 'Physical exercise, competitive activities, bold action',
        })
        break
      case 'Jupiter':
        bestActivities.push({
          time: 'Jupiter hours',
          activity: 'Growth, expansion, teaching, spiritual work',
        })
        break
      case 'Saturn':
        bestActivities.push({
          time: 'Saturn hours',
          activity: 'Structure, discipline, long-term planning',
        })
        break
    }

    // Low energy periods to avoid
    if (energy < -0.1) {
      avoidTimes.push('Current period - rest and restore instead')
    }

    if (reading.alchemicalValues.totalPower < -15) {
      avoidTimes.push('Major decision making - clearing period active')
    }

    return { bestActivities, avoidTimes }
  }

  private static generateFoodGuidance(reading: DailyEnergyReading): {
    breakfast: string[]
    lunch: string[]
    dinner: string[]
  } {
    const { alchemicalValues, elementalValues } = reading
    const isClearing = alchemicalValues.totalPower < 0

    let breakfast: string[] = []
    let lunch: string[] = []
    let dinner: string[] = []

    if (isClearing) {
      breakfast = ['Light fruits and herbal tea', 'Fresh juice or smoothie', 'Avoid heavy proteins']
      lunch = ['Light salad with minimal dressing', 'Steamed vegetables', 'Clear soup or broth']
      dinner = [
        'Very light meal or skip if not hungry',
        'Herbal tea',
        'Stop eating 3+ hours before sleep',
      ]
    } else {
      breakfast = ['Balanced meal with protein', 'Whole grains or fruits', 'Warm beverages']
      lunch = ['Main meal of the day', 'Balanced nutrients', 'Foods matching dominant element']
      dinner = ['Moderate, nourishing meal', 'Avoid excessive stimulation', 'Prepare for rest']
    }

    // Adjust for elemental dominance
    const dominantElement = Object.entries(elementalValues).reduce((max, curr) =>
      Math.abs(curr[1]) > Math.abs(max[1]) ? curr : max
    )[0]

    const elementalNote = this.getElementalFoodNote(dominantElement)
    breakfast.push(elementalNote)

    return { breakfast, lunch, dinner }
  }

  private static getElementalFoodNote(element: string): string {
    switch (element) {
      case 'fire':
        return 'Include warming spices and energizing foods'
      case 'water':
        return 'Focus on hydrating and cooling foods'
      case 'air':
        return 'Choose light, easily digestible foods'
      case 'earth':
        return 'Include grounding, substantial foods'
      default:
        return 'Balance all elemental qualities'
    }
  }
}

/**
 * RISING SIGN PRECISION TRACKER
 * Tracks accuracy of rising sign calculations and adjustments
 */
export class RisingSignPrecisionTracker {
  private static precisionLogs: Array<{
    timestamp: Date
    reportedRising: string
    calculatedRising: string
    degreePrecision: number
    birthTimeAccuracy: 'Exact' | 'Within5Min' | 'Within15Min' | 'Within1Hour' | 'Approximate'
    confidenceLevel: number
    adjustmentMade: boolean
    notes: string
  }> = []

  static logPrecisionCheck(data: {
    reportedRising: string
    calculatedRising: string
    degreePrecision: number
    birthTimeAccuracy: 'Exact' | 'Within5Min' | 'Within15Min' | 'Within1Hour' | 'Approximate'
    confidenceLevel: number
    adjustmentMade: boolean
    notes: string
  }): void {
    this.precisionLogs.push({
      timestamp: new Date(),
      ...data,
    })
  }

  static getCurrentPrecisionStatus(): {
    overallAccuracy: number
    recentTrend: 'Improving' | 'Stable' | 'Declining'
    recommendedActions: string[]
    confidenceLevel: 'High' | 'Medium' | 'Low'
  } {
    if (this.precisionLogs.length === 0) {
      return {
        overallAccuracy: 0,
        recentTrend: 'Stable',
        recommendedActions: ['Begin logging precision checks'],
        confidenceLevel: 'Low',
      }
    }

    const recent = this.precisionLogs.slice(-10)
    const avgConfidence = recent.reduce((sum, log) => sum + log.confidenceLevel, 0) / recent.length
    const accurateCount = recent.filter(log => log.reportedRising === log.calculatedRising).length
    const overallAccuracy = accurateCount / recent.length

    // Determine trend
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2))
    const secondHalf = recent.slice(Math.floor(recent.length / 2))

    const firstHalfAccuracy =
      firstHalf.filter(log => log.reportedRising === log.calculatedRising).length / firstHalf.length
    const secondHalfAccuracy =
      secondHalf.filter(log => log.reportedRising === log.calculatedRising).length /
      secondHalf.length

    let recentTrend: 'Improving' | 'Stable' | 'Declining'
    if (secondHalfAccuracy > firstHalfAccuracy + 0.1) {
      recentTrend = 'Improving'
    } else if (secondHalfAccuracy < firstHalfAccuracy - 0.1) {
      recentTrend = 'Declining'
    } else {
      recentTrend = 'Stable'
    }

    // Generate recommendations
    const recommendedActions: string[] = []

    if (overallAccuracy < 0.7) {
      recommendedActions.push('Review birth time accuracy')
      recommendedActions.push('Consider alternative calculation methods')
      recommendedActions.push('Cross-reference with multiple sources')
    }

    if (avgConfidence < 0.7) {
      recommendedActions.push('Increase sample size for better confidence')
      recommendedActions.push('Focus on higher precision measurements')
    }

    const lowPrecisionCount = recent.filter(log => log.degreePrecision < 1).length
    if (lowPrecisionCount > recent.length * 0.3) {
      recommendedActions.push('Improve degree precision in calculations')
    }

    // Determine confidence level
    let confidenceLevel: 'High' | 'Medium' | 'Low'
    if (overallAccuracy > 0.8 && avgConfidence > 0.8) {
      confidenceLevel = 'High'
    } else if (overallAccuracy > 0.6 && avgConfidence > 0.6) {
      confidenceLevel = 'Medium'
    } else {
      confidenceLevel = 'Low'
    }

    return {
      overallAccuracy,
      recentTrend,
      recommendedActions,
      confidenceLevel,
    }
  }

  static generatePrecisionReport(): {
    totalChecks: number
    accuracyByTimeframe: Record<string, number>
    commonDiscrepancies: Array<{ from: string; to: string; frequency: number }>
    recommendedImprovements: string[]
  } {
    const totalChecks = this.precisionLogs.length

    // Accuracy by birth time accuracy
    const accuracyByTimeframe: Record<string, number> = {}
    const timeframes = ['Exact', 'Within5Min', 'Within15Min', 'Within1Hour', 'Approximate']

    timeframes.forEach(timeframe => {
      const logsForTimeframe = this.precisionLogs.filter(log => log.birthTimeAccuracy === timeframe)
      if (logsForTimeframe.length > 0) {
        const accurate = logsForTimeframe.filter(
          log => log.reportedRising === log.calculatedRising
        ).length
        accuracyByTimeframe[timeframe] = accurate / logsForTimeframe.length
      }
    })

    // Common discrepancies
    const discrepancyMap = new Map<string, number>()
    this.precisionLogs.forEach(log => {
      if (log.reportedRising !== log.calculatedRising) {
        const key = `${log.reportedRising}->${log.calculatedRising}`
        discrepancyMap.set(key, (discrepancyMap.get(key) || 0) + 1)
      }
    })

    const commonDiscrepancies = Array.from(discrepancyMap.entries())
      .map(([key, frequency]) => {
        const [from, to] = key.split('->')
        return { from, to, frequency }
      })
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 5)

    // Recommended improvements
    const recommendedImprovements: string[] = []

    if (accuracyByTimeframe['Exact'] < 0.9) {
      recommendedImprovements.push(
        'Even exact birth times showing discrepancies - check calculation method'
      )
    }

    if (accuracyByTimeframe['Approximate'] && accuracyByTimeframe['Approximate'] > 0.3) {
      recommendedImprovements.push(
        'Surprising accuracy with approximate times - verify methodology'
      )
    }

    if (commonDiscrepancies.length > 0) {
      recommendedImprovements.push(
        `Most common error: ${commonDiscrepancies[0].from} -> ${commonDiscrepancies[0].to}`
      )
    }

    return {
      totalChecks,
      accuracyByTimeframe,
      commonDiscrepancies,
      recommendedImprovements,
    }
  }
}

/**
 * PATTERN RECOGNITION SYSTEM
 * Identifies patterns in daily tracking data
 */
export class PatternRecognitionSystem {
  static identifyWeeklyPatterns(readings: DailyEnergyReading[]): WeeklyPattern[] {
    const patterns: WeeklyPattern[] = []

    // Group readings by week
    const weeklyGroups = new Map<string, DailyEnergyReading[]>()
    readings.forEach(reading => {
      const week = this.getWeekKey(reading.timestamp)
      if (!weeklyGroups.has(week)) {
        weeklyGroups.set(week, [])
      }
      weeklyGroups.get(week)!.push(reading)
    })

    // Analyze each week
    weeklyGroups.forEach((weekReadings, weekKey) => {
      if (weekReadings.length < 3) return // Need minimum data

      const pattern = this.analyzeWeeklyPattern(weekKey, weekReadings)
      patterns.push(pattern)
    })

    return patterns.sort(
      (a, b) => new Date(b.weekStarting).getTime() - new Date(a.weekStarting).getTime()
    )
  }

  private static getWeekKey(date: Date): string {
    const startOfWeek = new Date(date)
    startOfWeek.setDate(date.getDate() - date.getDay())
    return startOfWeek.toISOString().split('T')[0]
  }

  private static analyzeWeeklyPattern(
    weekKey: string,
    readings: DailyEnergyReading[]
  ): WeeklyPattern {
    // Calculate averages
    const avgEnergy =
      readings.reduce((sum, r) => sum + r.thermodynamics.energy, 0) / readings.length
    const avgKalchmConstant =
      readings.reduce((sum, r) => sum + r.constants.kalchmConstant, 0) / readings.length
    const avgMonicaConstant =
      readings.reduce((sum, r) => sum + r.constants.monicaConstant, 0) / readings.length

    // Find dominant element
    const elementTotals = { fire: 0, water: 0, air: 0, earth: 0 }
    readings.forEach(reading => {
      elementTotals.fire += reading.elementalValues.fire
      elementTotals.water += reading.elementalValues.water
      elementTotals.air += reading.elementalValues.air
      elementTotals.earth += reading.elementalValues.earth
    })

    const dominantElement = Object.entries(elementTotals).reduce((max, curr) =>
      Math.abs(curr[1]) > Math.abs(max[1]) ? curr : max
    )[0]

    // Find peak and challenging days
    const sortedByEnergy = [...readings].sort(
      (a, b) => b.thermodynamics.energy - a.thermodynamics.energy
    )
    const peakDay = sortedByEnergy[0].timestamp.toLocaleDateString()
    const challengingDay = sortedByEnergy[sortedByEnergy.length - 1].timestamp.toLocaleDateString()

    // Identify patterns
    const patterns: string[] = []
    if (avgEnergy > 0.1) {
      patterns.push('High energy transformation week')
    } else if (avgEnergy < -0.1) {
      patterns.push('Low energy integration week')
    }

    if (Math.abs(avgKalchmConstant) > 1) {
      patterns.push('Strong Kalchm constant influence')
    }

    if (Math.abs(avgMonicaConstant) > 1) {
      patterns.push('Strong Monica constant influence')
    }

    // Generate recommendations
    const recommendations: string[] = []
    if (avgEnergy < -0.2) {
      recommendations.push('Focus on building and nourishing activities')
    } else if (avgEnergy > 0.2) {
      recommendations.push('Channel high energy into creative projects')
    }

    recommendations.push(`Work with ${dominantElement} element themes`)

    return {
      weekStarting: weekKey,
      dominantElement,
      avgEnergy,
      avgKalchmConstant,
      avgMonicaConstant,
      peakDay,
      challengingDay,
      patterns,
      recommendations,
    }
  }

  static generateMonthlyTrend(patterns: WeeklyPattern[]): MonthlyTrend | null {
    if (patterns.length < 2) return null

    const firstWeek = patterns[patterns.length - 1]
    const lastWeek = patterns[0]
    const month = new Date(firstWeek.weekStarting).toLocaleString('default', { month: 'long' })
    const year = new Date(firstWeek.weekStarting).getFullYear()

    // Determine overall trend
    const energyChange = lastWeek.avgEnergy - firstWeek.avgEnergy
    let overallTrend: 'Ascending' | 'Descending' | 'Stable' | 'Fluctuating'

    if (energyChange > 0.1) {
      overallTrend = 'Ascending'
    } else if (energyChange < -0.1) {
      overallTrend = 'Descending'
    } else {
      // Check for fluctuation
      const energyValues = patterns.map(p => p.avgEnergy)
      const variance = this.calculateVariance(energyValues)
      overallTrend = variance > 0.05 ? 'Fluctuating' : 'Stable'
    }

    // Dominant elements
    const elementCount = new Map<string, number>()
    patterns.forEach(pattern => {
      elementCount.set(
        pattern.dominantElement,
        (elementCount.get(pattern.dominantElement) || 0) + 1
      )
    })

    const dominantElements = Array.from(elementCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([element]) => element)

    // Average thermodynamics
    const avgThermodynamics = {
      heat: patterns.reduce((sum, p) => sum + p.avgEnergy, 0) / patterns.length,
      entropy: 0, // Would need to track this separately
      reactivity: 0, // Would need to track this separately
      energy: patterns.reduce((sum, p) => sum + p.avgEnergy, 0) / patterns.length,
    }

    // Significant dates (peak energy days)
    const significantDates = patterns.filter(p => Math.abs(p.avgEnergy) > 0.2).map(p => p.peakDay)

    // Evolution notes
    const evolutionNotes: string[] = []
    evolutionNotes.push(`Energy trend: ${overallTrend}`)
    evolutionNotes.push(`Dominant elements: ${dominantElements.join(', ')}`)

    if (Math.abs(avgThermodynamics.energy) > 0.1) {
      evolutionNotes.push('Significant transformation period')
    }

    return {
      month,
      year,
      overallTrend,
      dominantElements,
      avgThermodynamics,
      significantDates,
      evolutionNotes,
    }
  }

  private static calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length
  }
}
