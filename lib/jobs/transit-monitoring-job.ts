/**
 * Transit Monitoring Background Job
 * =================================
 *
 * Scheduled job to monitor natal charts for significant transits
 * and automatically create notifications for users.
 */

import { prisma } from '@/lib/db'
import {
  calculatePlanetaryTransitsForDateRange,
  type NatalPlacement,
} from '@/lib/services/planetary-transit-significance-scorer'
import {
  createNotificationsForSignificantTransits,
  getUserNotificationPreferences,
  type NotificationPreferences,
} from '@/lib/services/transit-notification-service'

export interface TransitMonitoringResult {
  jobId: string
  startTime: Date
  endTime: Date
  chartsProcessed: number
  notificationsCreated: number
  significantTransits: number
  errors: Array<{
    chartId: string
    error: string
    timestamp: Date
  }>
  performance: {
    totalDuration: number
    averageChartTime: number
    maxChartTime: number
  }
}

export interface TransitMonitoringOptions {
  dateRange?: {
    start: Date
    end: Date
  }
  significanceThreshold?: number
  priorityFilter?: ('low' | 'medium' | 'high' | 'critical')[]
  categoryFilter?: ('personal_transit' | 'agent_activation' | 'consciousness_breakthrough')[]
  maxChartsPerRun?: number
  skipChartsWithoutPreferences?: boolean
}

/**
 * Main transit monitoring job function
 */
export async function runTransitMonitoringJob(
  options: TransitMonitoringOptions = {}
): Promise<TransitMonitoringResult> {
  const jobId = `transit-monitoring-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const startTime = new Date()

  console.log(`🚀 Starting transit monitoring job: ${jobId}`)

  const result: TransitMonitoringResult = {
    jobId,
    startTime,
    endTime: new Date(),
    chartsProcessed: 0,
    notificationsCreated: 0,
    significantTransits: 0,
    errors: [],
    performance: {
      totalDuration: 0,
      averageChartTime: 0,
      maxChartTime: 0,
    },
  }

  try {
    const {
      dateRange,
      significanceThreshold,
      priorityFilter,
      categoryFilter,
      maxChartsPerRun = 100,
      skipChartsWithoutPreferences = true,
    } = options

    // Default to next 7 days if no date range specified
    const monitoringStartDate = dateRange?.start || new Date()
    const monitoringEndDate = dateRange?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    console.log(
      `📅 Monitoring date range: ${monitoringStartDate.toISOString()} to ${monitoringEndDate.toISOString()}`
    )

    // Get active natal charts with notification preferences
    const activeCharts = await prisma.userNatalChart.findMany({
      where: {
        isActive: true,
        notificationOn: true,
        ...(skipChartsWithoutPreferences
          ? {
              // Only include charts that have been analyzed recently
              lastAnalyzed: {
                not: null,
                gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
              },
            }
          : {}),
      },
      select: {
        id: true,
        userId: true,
        chartName: true,
        planets: true,
        preferences: true,
        dominantElement: true,
        dominantModality: true,
        monicaConstant: true,
        spiritScore: true,
        essenceScore: true,
        matterScore: true,
        substanceScore: true,
        lastAnalyzed: true,
      },
      take: maxChartsPerRun,
      orderBy: {
        lastAnalyzed: 'asc', // Process oldest first
      },
    })

    console.log(`📊 Found ${activeCharts.length} active natal charts to monitor`)

    let totalProcessingTime = 0
    let maxProcessingTime = 0

    for (const chart of activeCharts) {
      const chartStartTime = Date.now()

      try {
        console.log(
          `🔍 Processing chart: ${chart.chartName} (${chart.id}) for user: ${chart.userId}`
        )

        // Get user notification preferences
        let userPreferences: NotificationPreferences = {
          enabled: true,
          significanceThreshold: significanceThreshold || 0.6,
          priorityLevels: ['medium', 'high', 'critical'],
          categories: ['personal_transit', 'agent_activation', 'consciousness_breakthrough'],
          deliveryMethods: ['in_app'],
          frequency: 'immediate',
        }

        try {
          const dbPreferences = await getUserNotificationPreferences(chart.userId)
          userPreferences = { ...userPreferences, ...dbPreferences }
        } catch (prefError) {
          console.warn(
            `⚠️  Could not load preferences for user ${chart.userId}, using defaults:`,
            prefError
          )
        }

        // Skip if notifications are disabled
        if (!userPreferences.enabled) {
          console.log(`⏭️  Skipping chart ${chart.id} - notifications disabled`)
          continue
        }

        // Convert chart planets to NatalPlacement format
        if (!Array.isArray(chart.planets)) {
          throw new Error('Invalid planets data: must be an array')
        }

        const natalPlacements: NatalPlacement[] = chart.planets.map((p: any) => ({
          planet: p.label || p.name || p.planet,
          degree: Number(p.longitude) || Number(p.degree) || 0,
          sign: p.sign,
          house: p.house || '',
          element: getElementForSign(p.sign),
        }))

        if (natalPlacements.length === 0) {
          throw new Error('No valid planetary positions found')
        }

        // Build user consciousness profile
        const userProfile = {
          dominantElement: chart.dominantElement,
          monicaConstant: chart.monicaConstant,
          spiritScore: chart.spiritScore,
          essenceScore: chart.essenceScore,
          matterScore: chart.matterScore,
          substanceScore: chart.substanceScore,
        }

        // Calculate transits for the monitoring period
        const transitResults = calculatePlanetaryTransitsForDateRange(
          natalPlacements,
          monitoringStartDate,
          monitoringEndDate,
          userProfile,
          {
            transitingPlanet: 'Sun', // Focus on Sun transits for now
            significanceThreshold: userPreferences.significanceThreshold,
            orbTolerance: 5, // 5-degree orb
          }
        )

        // Filter transits based on user preferences
        const significantTransits = transitResults.filter(transit => {
          // Check significance threshold
          if (transit.overallScore < userPreferences.significanceThreshold) {
            return false
          }

          // Check priority filter
          const transitPriority = ((transit as any).priority || 'medium') as
            | 'low'
            | 'medium'
            | 'high'
            | 'critical'
          const transitCategory = ((transit as any).category || 'personal_transit') as
            | 'personal_transit'
            | 'agent_activation'
            | 'consciousness_breakthrough'

          if (priorityFilter && !priorityFilter.includes(transitPriority)) {
            return false
          }

          // Check category filter
          if (categoryFilter && !categoryFilter.includes(transitCategory)) {
            return false
          }

          // Check user preferences
          if (!userPreferences.priorityLevels.includes(transitPriority)) {
            return false
          }

          if (!userPreferences.categories.includes(transitCategory)) {
            return false
          }

          return true
        })

        console.log(
          `✨ Found ${significantTransits.length} significant transits for chart ${chart.id}`
        )
        result.significantTransits += significantTransits.length

        // Create notifications for significant transits
        if (significantTransits.length > 0) {
          const notificationsCreated = await createNotificationsForSignificantTransits(
            chart.id,
            significantTransits
          )

          result.notificationsCreated += notificationsCreated
          console.log(`📬 Created ${notificationsCreated} notifications for chart ${chart.id}`)
        }

        // Update chart's last analyzed timestamp
        await prisma.userNatalChart.update({
          where: { id: chart.id },
          data: {
            lastAnalyzed: new Date(),
            analysisCount: { increment: 1 },
          },
        })

        result.chartsProcessed++

        const chartProcessingTime = Date.now() - chartStartTime
        totalProcessingTime += chartProcessingTime
        maxProcessingTime = Math.max(maxProcessingTime, chartProcessingTime)
      } catch (chartError) {
        const errorMsg = `Error processing chart ${chart.id}: ${chartError instanceof Error ? chartError.message : 'Unknown error'}`
        console.error(`❌ ${errorMsg}`)

        result.errors.push({
          chartId: chart.id,
          error: errorMsg,
          timestamp: new Date(),
        })
      }
    }

    result.endTime = new Date()
    result.performance = {
      totalDuration: result.endTime.getTime() - startTime.getTime(),
      averageChartTime:
        result.chartsProcessed > 0 ? totalProcessingTime / result.chartsProcessed : 0,
      maxChartTime: maxProcessingTime,
    }

    console.log(`✅ Transit monitoring job completed: ${jobId}`)
    console.log(
      `📊 Results: ${result.chartsProcessed} charts processed, ${result.notificationsCreated} notifications created`
    )
    console.log(
      `⏱️  Performance: ${result.performance.totalDuration}ms total, ${result.performance.averageChartTime.toFixed(0)}ms avg per chart`
    )

    if (result.errors.length > 0) {
      console.warn(`⚠️  ${result.errors.length} errors occurred during processing`)
    }
  } catch (jobError) {
    console.error(`💥 Fatal error in transit monitoring job ${jobId}:`, jobError)

    result.endTime = new Date()
    result.errors.push({
      chartId: 'job',
      error: `Fatal job error: ${jobError instanceof Error ? jobError.message : 'Unknown error'}`,
      timestamp: new Date(),
    })
  }

  return result
}

/**
 * Schedule transit monitoring job to run periodically
 * This is a simple implementation - in production, you'd use a proper job scheduler
 */
export class TransitMonitoringScheduler {
  private intervalId: NodeJS.Timeout | null = null
  private isRunning = false

  constructor(
    private intervalMinutes: number = 60, // Run every hour by default
    private options: TransitMonitoringOptions = {}
  ) {}

  start(): void {
    if (this.isRunning) {
      console.warn('Transit monitoring scheduler is already running')
      return
    }

    console.log(`🕐 Starting transit monitoring scheduler (every ${this.intervalMinutes} minutes)`)

    this.isRunning = true

    // Run immediately on start
    this.runJob()

    // Then schedule periodic runs
    this.intervalId = setInterval(
      () => {
        this.runJob()
      },
      this.intervalMinutes * 60 * 1000
    )
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.isRunning = false
    console.log('🛑 Transit monitoring scheduler stopped')
  }

  async runJob(): Promise<TransitMonitoringResult> {
    try {
      console.log('🔄 Running scheduled transit monitoring job...')
      return await runTransitMonitoringJob(this.options)
    } catch (error) {
      console.error('Failed to run scheduled transit monitoring job:', error)
      throw error
    }
  }

  isActive(): boolean {
    return this.isRunning
  }
}

/**
 * Utility function to get element for sign
 */
function getElementForSign(sign: string): 'Fire' | 'Water' | 'Air' | 'Earth' {
  const elementMap: Record<string, 'Fire' | 'Water' | 'Air' | 'Earth'> = {
    Aries: 'Fire',
    Taurus: 'Earth',
    Gemini: 'Air',
    Cancer: 'Water',
    Leo: 'Fire',
    Virgo: 'Earth',
    Libra: 'Air',
    Scorpio: 'Water',
    Sagittarius: 'Fire',
    Capricorn: 'Earth',
    Aquarius: 'Air',
    Pisces: 'Water',
  }
  return elementMap[sign] || 'Fire'
}

/**
 * Export the main job function for direct execution
 */
export { runTransitMonitoringJob as default }
