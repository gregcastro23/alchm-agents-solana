/**
 * Advanced Batch Performance Monitoring System
 * Real-time analytics, bottleneck detection, and optimization recommendations
 */

import { EventEmitter } from 'events'
import { batchQueueManager, BatchJob } from './batch-queue-manager'

export interface PerformanceMetrics {
  timestamp: Date
  batchProcessing: {
    totalJobs: number
    completedJobs: number
    failedJobs: number
    averageProcessingTime: number
    throughputPerMinute: number
    queueLength: number
    activeWorkers: number
  }
  systemResources: {
    cpuUsage: number
    memoryUsage: number
    diskIO: number
    networkLatency: number
  }
  bottlenecks: BottleneckAnalysis[]
  optimizationRecommendations: OptimizationRecommendation[]
  alerts: PerformanceAlert[]
}

export interface BottleneckAnalysis {
  type: 'cpu' | 'memory' | 'io' | 'network' | 'queue' | 'dependency'
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  impact: string
  suggestedAction: string
  affectedJobs: string[]
  metrics: Record<string, number>
}

export interface OptimizationRecommendation {
  category: 'resource' | 'algorithm' | 'configuration' | 'architecture'
  priority: 'low' | 'medium' | 'high'
  title: string
  description: string
  expectedImprovement: string
  implementationEffort: 'low' | 'medium' | 'high'
  actionItems: string[]
}

export interface PerformanceAlert {
  id: string
  level: 'info' | 'warning' | 'error' | 'critical'
  timestamp: Date
  title: string
  description: string
  metric: string
  currentValue: number
  thresholdValue: number
  affectedComponents: string[]
  acknowledged: boolean
}

export interface TrendAnalysis {
  metric: string
  timeframe: 'last_hour' | 'last_day' | 'last_week'
  trend: 'improving' | 'stable' | 'degrading'
  changePercent: number
  prediction: {
    nextValue: number
    confidence: number
    timeToThreshold?: number
  }
}

export class BatchPerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[]
  private alerts: Map<string, PerformanceAlert>
  private monitoringInterval: NodeJS.Timeout
  private analysisInterval: NodeJS.Timeout
  private isRunning = false
  private readonly maxMetricsHistory = 1000

  // Performance thresholds
  private readonly thresholds = {
    cpuUsage: { warning: 70, critical: 90 },
    memoryUsage: { warning: 80, critical: 95 },
    queueLength: { warning: 50, critical: 100 },
    averageProcessingTime: { warning: 30000, critical: 60000 }, // ms
    failureRate: { warning: 0.05, critical: 0.15 },
    throughputDrop: { warning: 0.2, critical: 0.5 }, // percentage drop
  }

  constructor(options?: {
    monitoringInterval?: number
    analysisInterval?: number
    autoStart?: boolean
  }) {
    super()

    this.metrics = []
    this.alerts = new Map()

    const monitoringInterval = options?.monitoringInterval || 15000 // 15 seconds
    const analysisInterval = options?.analysisInterval || 60000 // 1 minute

    this.monitoringInterval = setInterval(() => this.collectMetrics(), monitoringInterval)
    this.analysisInterval = setInterval(() => this.analyzePerformance(), analysisInterval)

    if (options?.autoStart !== false) {
      this.start()
    }

    // Listen to queue manager events
    batchQueueManager.on('jobCompleted', (job: BatchJob) => this.onJobCompleted(job))
    batchQueueManager.on('jobFailed', (job: BatchJob) => this.onJobFailed(job))
    batchQueueManager.on('metricsUpdated', () => this.triggerAnalysis())
  }

  /**
   * Monitoring Control
   */

  start(): void {
    this.isRunning = true
    this.emit('monitoringStarted')
    console.log('📊 Batch performance monitoring started')
  }

  stop(): void {
    this.isRunning = false
    this.emit('monitoringStopped')
    console.log('📊 Batch performance monitoring stopped')
  }

  /**
   * Metrics Collection
   */

  private async collectMetrics(): Promise<void> {
    if (!this.isRunning) return

    try {
      const queueMetrics = batchQueueManager.getMetrics()
      const queueStatus = batchQueueManager.getQueueStatus()

      const metrics: PerformanceMetrics = {
        timestamp: new Date(),
        batchProcessing: {
          totalJobs: queueMetrics.totalJobs,
          completedJobs: queueMetrics.completedJobs,
          failedJobs: queueMetrics.failedJobs,
          averageProcessingTime: queueMetrics.averageProcessingTime,
          throughputPerMinute: Math.round(queueMetrics.throughputPerHour / 60),
          queueLength: queueMetrics.queuedJobs,
          activeWorkers: queueMetrics.resourceUtilization.activeWorkers,
        },
        systemResources: await this.collectSystemMetrics(),
        bottlenecks: [],
        optimizationRecommendations: [],
        alerts: [],
      }

      // Store metrics
      this.metrics.push(metrics)

      // Maintain history limit
      if (this.metrics.length > this.maxMetricsHistory) {
        this.metrics = this.metrics.slice(-this.maxMetricsHistory)
      }

      this.emit('metricsCollected', metrics)
    } catch (error) {
      console.error('Error collecting performance metrics:', error)
    }
  }

  private async collectSystemMetrics(): Promise<PerformanceMetrics['systemResources']> {
    // Mock system metrics - in production, integrate with actual monitoring
    return {
      cpuUsage: 30 + Math.random() * 40, // 30-70%
      memoryUsage: 40 + Math.random() * 30, // 40-70%
      diskIO: Math.random() * 100,
      networkLatency: 10 + Math.random() * 40, // 10-50ms
    }
  }

  /**
   * Performance Analysis
   */

  private async analyzePerformance(): Promise<void> {
    if (!this.isRunning || this.metrics.length < 2) return

    const latestMetrics = this.metrics[this.metrics.length - 1]

    // Analyze bottlenecks
    const bottlenecks = this.detectBottlenecks(latestMetrics)
    latestMetrics.bottlenecks = bottlenecks

    // Generate optimization recommendations
    const recommendations = this.generateOptimizationRecommendations(latestMetrics, bottlenecks)
    latestMetrics.optimizationRecommendations = recommendations

    // Check for alerts
    const alerts = this.checkForAlerts(latestMetrics)
    latestMetrics.alerts = alerts

    // Update stored alerts
    alerts.forEach(alert => this.alerts.set(alert.id, alert))

    this.emit('analysisCompleted', {
      metrics: latestMetrics,
      bottlenecks,
      recommendations,
      alerts,
    })

    if (alerts.length > 0) {
      this.emit('alertsGenerated', alerts)
    }
  }

  private detectBottlenecks(metrics: PerformanceMetrics): BottleneckAnalysis[] {
    const bottlenecks: BottleneckAnalysis[] = []

    // CPU bottleneck detection
    if (metrics.systemResources.cpuUsage > this.thresholds.cpuUsage.warning) {
      bottlenecks.push({
        type: 'cpu',
        severity:
          metrics.systemResources.cpuUsage > this.thresholds.cpuUsage.critical
            ? 'critical'
            : 'high',
        description: `High CPU usage: ${metrics.systemResources.cpuUsage.toFixed(1)}%`,
        impact: 'Slower job processing, increased latency',
        suggestedAction: 'Consider scaling workers or optimizing job algorithms',
        affectedJobs: [],
        metrics: { cpuUsage: metrics.systemResources.cpuUsage },
      })
    }

    // Memory bottleneck detection
    if (metrics.systemResources.memoryUsage > this.thresholds.memoryUsage.warning) {
      bottlenecks.push({
        type: 'memory',
        severity:
          metrics.systemResources.memoryUsage > this.thresholds.memoryUsage.critical
            ? 'critical'
            : 'high',
        description: `High memory usage: ${metrics.systemResources.memoryUsage.toFixed(1)}%`,
        impact: 'Risk of out-of-memory errors, job failures',
        suggestedAction: 'Implement memory optimization or add more RAM',
        affectedJobs: [],
        metrics: { memoryUsage: metrics.systemResources.memoryUsage },
      })
    }

    // Queue bottleneck detection
    if (metrics.batchProcessing.queueLength > this.thresholds.queueLength.warning) {
      bottlenecks.push({
        type: 'queue',
        severity:
          metrics.batchProcessing.queueLength > this.thresholds.queueLength.critical
            ? 'critical'
            : 'medium',
        description: `Large queue backlog: ${metrics.batchProcessing.queueLength} jobs`,
        impact: 'Increased wait times, delayed job completion',
        suggestedAction: 'Scale workers or optimize job prioritization',
        affectedJobs: [],
        metrics: { queueLength: metrics.batchProcessing.queueLength },
      })
    }

    // Processing time bottleneck
    if (
      metrics.batchProcessing.averageProcessingTime > this.thresholds.averageProcessingTime.warning
    ) {
      bottlenecks.push({
        type: 'cpu',
        severity:
          metrics.batchProcessing.averageProcessingTime >
          this.thresholds.averageProcessingTime.critical
            ? 'critical'
            : 'medium',
        description: `Slow processing: ${(metrics.batchProcessing.averageProcessingTime / 1000).toFixed(1)}s average`,
        impact: 'Reduced throughput, poor user experience',
        suggestedAction: 'Optimize job algorithms or increase worker capacity',
        affectedJobs: [],
        metrics: { averageProcessingTime: metrics.batchProcessing.averageProcessingTime },
      })
    }

    return bottlenecks
  }

  private generateOptimizationRecommendations(
    metrics: PerformanceMetrics,
    bottlenecks: BottleneckAnalysis[]
  ): OptimizationRecommendation[] {
    const recommendations: OptimizationRecommendation[] = []

    // High queue length optimization
    if (metrics.batchProcessing.queueLength > 20) {
      recommendations.push({
        category: 'resource',
        priority: 'high',
        title: 'Scale Worker Capacity',
        description: 'Queue backlog indicates insufficient processing capacity',
        expectedImprovement: '40-60% reduction in queue wait times',
        implementationEffort: 'medium',
        actionItems: [
          'Increase maxConcurrentJobs setting',
          'Add additional worker nodes',
          'Implement auto-scaling based on queue depth',
        ],
      })
    }

    // Low throughput optimization
    if (metrics.batchProcessing.throughputPerMinute < 10) {
      recommendations.push({
        category: 'algorithm',
        priority: 'high',
        title: 'Optimize Job Processing',
        description: 'Low throughput suggests inefficient job processing',
        expectedImprovement: '30-50% increase in processing speed',
        implementationEffort: 'high',
        actionItems: [
          'Profile and optimize slow job types',
          'Implement batch processing for similar jobs',
          'Add caching for repeated operations',
        ],
      })
    }

    // High failure rate optimization
    const failureRate =
      metrics.batchProcessing.failedJobs / Math.max(1, metrics.batchProcessing.totalJobs)
    if (failureRate > 0.05) {
      recommendations.push({
        category: 'configuration',
        priority: 'high',
        title: 'Improve Error Handling',
        description: `High failure rate: ${(failureRate * 100).toFixed(1)}%`,
        expectedImprovement: '70-80% reduction in job failures',
        implementationEffort: 'medium',
        actionItems: [
          'Implement better retry mechanisms',
          'Add input validation',
          'Improve error logging and monitoring',
        ],
      })
    }

    // Memory optimization
    if (bottlenecks.some(b => b.type === 'memory')) {
      recommendations.push({
        category: 'resource',
        priority: 'medium',
        title: 'Memory Optimization',
        description: 'High memory usage detected',
        expectedImprovement: '20-30% reduction in memory usage',
        implementationEffort: 'medium',
        actionItems: [
          'Implement job data streaming',
          'Add memory cleanup routines',
          'Optimize data structures',
        ],
      })
    }

    return recommendations
  }

  private checkForAlerts(metrics: PerformanceMetrics): PerformanceAlert[] {
    const alerts: PerformanceAlert[] = []

    // CPU usage alert
    if (metrics.systemResources.cpuUsage > this.thresholds.cpuUsage.warning) {
      alerts.push(
        this.createAlert(
          'cpu_high',
          metrics.systemResources.cpuUsage > this.thresholds.cpuUsage.critical
            ? 'critical'
            : 'warning',
          'High CPU Usage',
          `CPU usage is ${metrics.systemResources.cpuUsage.toFixed(1)}%`,
          'cpu_usage',
          metrics.systemResources.cpuUsage,
          this.thresholds.cpuUsage.warning,
          ['batch-processor', 'workers']
        )
      )
    }

    // Memory usage alert
    if (metrics.systemResources.memoryUsage > this.thresholds.memoryUsage.warning) {
      alerts.push(
        this.createAlert(
          'memory_high',
          metrics.systemResources.memoryUsage > this.thresholds.memoryUsage.critical
            ? 'critical'
            : 'warning',
          'High Memory Usage',
          `Memory usage is ${metrics.systemResources.memoryUsage.toFixed(1)}%`,
          'memory_usage',
          metrics.systemResources.memoryUsage,
          this.thresholds.memoryUsage.warning,
          ['batch-processor', 'workers']
        )
      )
    }

    // Queue length alert
    if (metrics.batchProcessing.queueLength > this.thresholds.queueLength.warning) {
      alerts.push(
        this.createAlert(
          'queue_backlog',
          metrics.batchProcessing.queueLength > this.thresholds.queueLength.critical
            ? 'critical'
            : 'warning',
          'Queue Backlog',
          `${metrics.batchProcessing.queueLength} jobs in queue`,
          'queue_length',
          metrics.batchProcessing.queueLength,
          this.thresholds.queueLength.warning,
          ['job-queue', 'workers']
        )
      )
    }

    return alerts
  }

  private createAlert(
    id: string,
    level: PerformanceAlert['level'],
    title: string,
    description: string,
    metric: string,
    currentValue: number,
    thresholdValue: number,
    affectedComponents: string[]
  ): PerformanceAlert {
    return {
      id,
      level,
      timestamp: new Date(),
      title,
      description,
      metric,
      currentValue,
      thresholdValue,
      affectedComponents,
      acknowledged: false,
    }
  }

  /**
   * Event Handlers
   */

  private onJobCompleted(job: BatchJob): void {
    // Track job completion for performance analysis
    this.emit('jobPerformanceTracked', {
      jobId: job.id,
      type: job.type,
      duration: job.actualDuration,
      status: 'completed',
    })
  }

  private onJobFailed(job: BatchJob): void {
    // Track job failure for analysis
    this.emit('jobPerformanceTracked', {
      jobId: job.id,
      type: job.type,
      duration: job.actualDuration,
      status: 'failed',
      error: job.error,
    })
  }

  private triggerAnalysis(): void {
    // Immediate analysis when queue metrics are updated
    if (this.isRunning) {
      setTimeout(() => this.analyzePerformance(), 1000)
    }
  }

  /**
   * Data Access Methods
   */

  getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null
  }

  getMetricsHistory(
    timeframe: 'last_hour' | 'last_day' | 'all' = 'last_hour'
  ): PerformanceMetrics[] {
    const now = Date.now()
    let cutoffTime: number

    switch (timeframe) {
      case 'last_hour':
        cutoffTime = now - 60 * 60 * 1000
        break
      case 'last_day':
        cutoffTime = now - 24 * 60 * 60 * 1000
        break
      default:
        return [...this.metrics]
    }

    return this.metrics.filter(m => m.timestamp.getTime() > cutoffTime)
  }

  getActiveAlerts(): PerformanceAlert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.acknowledged)
  }

  acknowledgeAlert(alertId: string): boolean {
    const alert = this.alerts.get(alertId)
    if (alert) {
      alert.acknowledged = true
      this.emit('alertAcknowledged', alert)
      return true
    }
    return false
  }

  getTrendAnalysis(
    metric: string,
    timeframe: TrendAnalysis['timeframe'] = 'last_hour'
  ): TrendAnalysis | null {
    const history = this.getMetricsHistory(timeframe as any)
    if (history.length < 2) return null

    // Extract metric values
    const values = history
      .map(m => this.extractMetricValue(m, metric))
      .filter(v => v !== null) as number[]
    if (values.length < 2) return null

    // Calculate trend
    const first = values[0]
    const last = values[values.length - 1]
    const changePercent = ((last - first) / first) * 100

    let trend: TrendAnalysis['trend']
    if (Math.abs(changePercent) < 5) {
      trend = 'stable'
    } else if (changePercent > 0) {
      trend = 'degrading' // For performance metrics, higher is usually worse
    } else {
      trend = 'improving'
    }

    return {
      metric,
      timeframe,
      trend,
      changePercent,
      prediction: {
        nextValue: last + (last - first), // Simple linear prediction
        confidence: Math.max(0.1, Math.min(0.9, 1 - Math.abs(changePercent) / 100)),
      },
    }
  }

  private extractMetricValue(metrics: PerformanceMetrics, metricPath: string): number | null {
    const paths = metricPath.split('.')
    let value: any = metrics

    for (const path of paths) {
      if (value && typeof value === 'object' && path in value) {
        value = value[path]
      } else {
        return null
      }
    }

    return typeof value === 'number' ? value : null
  }

  /**
   * Cleanup
   */

  destroy(): void {
    this.stop()

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval)
    }

    if (this.analysisInterval) {
      clearInterval(this.analysisInterval)
    }

    this.removeAllListeners()
    console.log('📊 Batch performance monitor destroyed')
  }
}

// Singleton instance
export const batchPerformanceMonitor = new BatchPerformanceMonitor({
  monitoringInterval: 15000, // 15 seconds
  analysisInterval: 60000, // 1 minute
  autoStart: true,
})
