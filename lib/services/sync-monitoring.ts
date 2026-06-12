/**
 * Synchronization Monitoring Service
 * ==================================
 *
 * Monitors cross-backend planetary position synchronization health,
 * performance, and accuracy metrics for the revolutionary astrological
 * precision integration between Planetary Agents and WhatToEatNext.
 */

import { planetaryPositionSyncService } from './planetary-position-sync'

export interface SyncAlert {
  id: string
  level: 'info' | 'warning' | 'critical'
  message: string
  timestamp: string
  resolved: boolean
  resolvedAt?: string
  metadata?: Record<string, any>
}

export interface SyncMetrics {
  total_syncs: number
  successful_syncs: number
  failed_syncs: number
  average_sync_time_ms: number
  total_discrepancies: number
  total_corrections: number
  success_rate: number
  last_sync_timestamp?: string
  health_score: number // 0-100
}

export interface SyncHealthReport {
  overall_status: 'healthy' | 'degraded' | 'critical'
  planetary_agents_status: 'online' | 'degraded' | 'offline'
  whattoeatnext_status: 'online' | 'degraded' | 'offline'
  sync_service_status: 'operational' | 'degraded' | 'failed'
  metrics: SyncMetrics
  active_alerts: SyncAlert[]
  recommendations: string[]
  last_check: string
}

export class SyncMonitoringService {
  private alerts: SyncAlert[] = []
  private metrics: SyncMetrics = {
    total_syncs: 0,
    successful_syncs: 0,
    failed_syncs: 0,
    average_sync_time_ms: 0,
    total_discrepancies: 0,
    total_corrections: 0,
    success_rate: 0,
    health_score: 100,
  }
  private readonly ALERT_RETENTION_DAYS = 7
  private readonly HEALTH_CHECK_INTERVAL = 5 * 60 * 1000 // 5 minutes

  constructor() {
    // Start periodic health monitoring
    this.startHealthMonitoring()
  }

  /**
   * Log a synchronization result and update metrics
   */
  logSyncResult(result: any): void {
    this.metrics.total_syncs++

    if (result.success) {
      this.metrics.successful_syncs++
      this.metrics.last_sync_timestamp = new Date().toISOString()
    } else {
      this.metrics.failed_syncs++
      this.createAlert(
        'warning',
        `Synchronization failed: ${result.errors?.join(', ') || 'Unknown error'}`
      )
    }

    // Update sync time average
    const syncTime = result.sync_report?.sync_duration_ms || 0
    this.metrics.average_sync_time_ms =
      (this.metrics.average_sync_time_ms * (this.metrics.total_syncs - 1) + syncTime) /
      this.metrics.total_syncs

    // Update discrepancy metrics
    const discrepancies = result.sync_report?.discrepancies_found || 0
    const corrections = result.sync_report?.corrections_applied || 0

    this.metrics.total_discrepancies += discrepancies
    this.metrics.total_corrections += corrections

    this.metrics.success_rate =
      this.metrics.total_syncs > 0
        ? (this.metrics.successful_syncs / this.metrics.total_syncs) * 100
        : 0

    // Update health score
    this.updateHealthScore()

    // Check for concerning patterns
    this.checkForAlerts(result)
  }

  /**
   * Generate comprehensive health report
   */
  async generateHealthReport(): Promise<SyncHealthReport> {
    const health = await planetaryPositionSyncService.getHealthStatus()
    const syncStatus = await planetaryPositionSyncService.getSyncStatus()

    // Determine overall status
    let overall_status: 'healthy' | 'degraded' | 'critical' = 'healthy'
    if (health.overall_health === 'critical' || this.metrics.success_rate < 50) {
      overall_status = 'critical'
    } else if (health.overall_health === 'warning' || this.metrics.success_rate < 80) {
      overall_status = 'degraded'
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(health, syncStatus)

    return {
      overall_status,
      planetary_agents_status: health.vsop87_available ? 'online' : 'offline',
      whattoeatnext_status: health.whattoeatnext_available ? 'online' : 'degraded',
      sync_service_status:
        health.overall_health === 'healthy'
          ? 'operational'
          : health.overall_health === 'warning'
            ? 'degraded'
            : 'failed',
      metrics: this.metrics,
      active_alerts: this.getActiveAlerts(),
      recommendations,
      last_check: new Date().toISOString(),
    }
  }

  /**
   * Get current metrics
   */
  getMetrics(): SyncMetrics {
    return { ...this.metrics }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): SyncAlert[] {
    return this.alerts.filter(alert => !alert.resolved)
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(): SyncAlert[] {
    return [...this.alerts]
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId)
    if (alert && !alert.resolved) {
      alert.resolved = true
      alert.resolvedAt = new Date().toISOString()
      return true
    }
    return false
  }

  /**
   * Clear old resolved alerts
   */
  cleanupOldAlerts(): void {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - this.ALERT_RETENTION_DAYS)

    this.alerts = this.alerts.filter(
      alert => !alert.resolved || new Date(alert.timestamp) > cutoffDate
    )
  }

  /**
   * Export monitoring data for analysis
   */
  exportMonitoringData(): {
    metrics: SyncMetrics
    alerts: SyncAlert[]
    export_timestamp: string
    period_days: number
  } {
    return {
      metrics: this.metrics,
      alerts: this.alerts,
      export_timestamp: new Date().toISOString(),
      period_days: this.ALERT_RETENTION_DAYS,
    }
  }

  /**
   * Reset metrics (for testing or manual reset)
   */
  resetMetrics(): void {
    this.metrics = {
      total_syncs: 0,
      successful_syncs: 0,
      failed_syncs: 0,
      average_sync_time_ms: 0,
      total_discrepancies: 0,
      total_corrections: 0,
      success_rate: 0,
      health_score: 100,
    }
    this.createAlert('info', 'Metrics manually reset')
  }

  private createAlert(
    level: 'info' | 'warning' | 'critical',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const alert: SyncAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      level,
      message,
      timestamp: new Date().toISOString(),
      resolved: false,
      metadata,
    }

    this.alerts.unshift(alert) // Add to beginning

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(0, 100)
    }

    console.log(`[${level.toUpperCase()}] Sync Alert: ${message}`)
  }

  private checkForAlerts(result: any): void {
    // Check for high discrepancy count
    if (result.sync_report?.discrepancies_found > 5) {
      this.createAlert(
        'warning',
        `High discrepancy count: ${result.sync_report.discrepancies_found} planetary position differences detected`,
        { discrepancies: result.sync_report.discrepancies_found }
      )
    }

    // Check for slow sync times
    if (result.sync_report?.sync_duration_ms > 10000) {
      // 10 seconds
      this.createAlert(
        'warning',
        `Slow synchronization: ${result.sync_report.sync_duration_ms}ms sync time`,
        { sync_time_ms: result.sync_report.sync_duration_ms }
      )
    }

    // Check for repeated failures
    const recentFailures = this.alerts.filter(
      a =>
        !a.resolved &&
        a.level === 'warning' &&
        a.message.includes('failed') &&
        new Date(a.timestamp) > new Date(Date.now() - 3600000) // Last hour
    ).length

    if (recentFailures >= 3) {
      this.createAlert(
        'critical',
        `Multiple synchronization failures detected: ${recentFailures} in the last hour`,
        { recent_failures: recentFailures }
      )
    }
  }

  private updateHealthScore(): void {
    let score = 100

    // Deduct points for low success rate
    if (this.metrics.success_rate < 50) score -= 50
    else if (this.metrics.success_rate < 80) score -= 25
    else if (this.metrics.success_rate < 95) score -= 10

    // Deduct points for high average sync time
    if (this.metrics.average_sync_time_ms > 5000) score -= 20
    else if (this.metrics.average_sync_time_ms > 2000) score -= 10

    // Deduct points for high discrepancy rates
    const discrepancyRate =
      this.metrics.total_syncs > 0 ? this.metrics.total_discrepancies / this.metrics.total_syncs : 0
    if (discrepancyRate > 2) score -= 30
    else if (discrepancyRate > 1) score -= 15
    else if (discrepancyRate > 0.5) score -= 5

    this.metrics.health_score = Math.max(0, score)
  }

  private generateRecommendations(health: any, syncStatus: any): string[] {
    const recommendations: string[] = []

    if (health.overall_health !== 'healthy') {
      recommendations.push('Cross-backend synchronization health is degraded')
    }

    if (!health.whattoeatnext_available) {
      recommendations.push('WhatToEatNext service is unreachable - check API connectivity and keys')
    }

    if (!health.vsop87_available) {
      recommendations.push('Local VSOP87 calculations unavailable - check astronomical calculator')
    }

    if (this.metrics.success_rate < 95) {
      recommendations.push(
        `Synchronization success rate is ${this.metrics.success_rate.toFixed(1)}% - investigate failures`
      )
    }

    if (this.metrics.average_sync_time_ms > 2000) {
      recommendations.push(
        `Average sync time is high: ${this.metrics.average_sync_time_ms.toFixed(0)}ms - optimize performance`
      )
    }

    if (this.metrics.total_discrepancies > this.metrics.total_syncs * 0.1) {
      recommendations.push(
        'High planetary position discrepancies detected - verify calculation accuracy'
      )
    }

    if (recommendations.length === 0) {
      recommendations.push('All synchronization systems operating optimally')
      recommendations.push('Cross-backend precision integration is fully functional')
    }

    return recommendations
  }

  private startHealthMonitoring(): void {
    // Periodic health check every 5 minutes
    setInterval(async () => {
      try {
        const report = await this.generateHealthReport()

        if (report.overall_status === 'critical') {
          this.createAlert('critical', 'Critical synchronization health detected', {
            health_report: report,
          })
        } else if (report.overall_status === 'degraded') {
          this.createAlert('warning', 'Degraded synchronization health detected', {
            health_report: report,
          })
        }

        // Cleanup old alerts weekly
        if (Math.random() < 0.1) {
          // ~10% chance every 5 minutes = ~weekly
          this.cleanupOldAlerts()
        }
      } catch (error) {
        console.error('Health monitoring check failed:', error)
        this.createAlert('critical', `Health monitoring failed: ${(error as Error).message}`)
      }
    }, this.HEALTH_CHECK_INTERVAL)
  }
}

// Export singleton instance
export const syncMonitoringService = new SyncMonitoringService()
