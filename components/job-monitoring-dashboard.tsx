'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Label } from '@/components/ui/label'
import {
  Activity,
  Play,
  Square,
  RefreshCw,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  TrendingUp,
  BarChart3,
  Settings,
  Trash2,
  Eye,
  Calendar,
  Zap,
} from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'

interface JobData {
  id: string
  jobType: string
  scheduledFor: Date
  startedAt?: Date
  completedAt?: Date
  status: string
  chartsProcessed: number
  notificationsCreated: number
  significantTransits: number
  executionTime?: number
}

interface JobStatistics {
  totalJobs: number
  completedJobs: number
  failedJobs: number
  averageExecutionTime: number
  totalChartsProcessed: number
  totalNotificationsCreated: number
  totalSignificantTransits: number
  jobsLast24Hours: number
  jobsLast7Days: number
  jobsLast30Days: number
  successRate: number
}

interface SchedulerStatus {
  isActive: boolean
  intervalMinutes: number
}

interface JobMonitoringDashboardProps {
  userId: string
}

export function JobMonitoringDashboard({ userId }: JobMonitoringDashboardProps) {
  const [jobs, setJobs] = useState<JobData[]>([])
  const [statistics, setStatistics] = useState<JobStatistics | null>(null)
  const [schedulerStatus, setSchedulerStatus] = useState<SchedulerStatus>({
    isActive: false,
    intervalMinutes: 60,
  })
  const [activeJobs, setActiveJobs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [refreshInterval, setRefreshInterval] = useState(30) // seconds

  // Load job data
  const loadJobData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/transit-monitoring-jobs?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to load job data')

      const data = await response.json()

      setJobs(data.history || [])
      setStatistics(data.statistics || null)
      setSchedulerStatus(data.scheduler || { isActive: false, intervalMinutes: 60 })
      setActiveJobs(data.activeJobs || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load job data')
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    loadJobData()
  }, [loadJobData])

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return

    const interval = setInterval(() => {
      loadJobData()
    }, refreshInterval * 1000)

    return () => clearInterval(interval)
  }, [autoRefresh, refreshInterval, loadJobData])

  // Control scheduler
  const controlScheduler = async (action: 'start' | 'stop') => {
    try {
      const response = await fetch('/api/transit-monitoring-jobs/scheduler', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          userId,
          intervalMinutes: schedulerStatus.intervalMinutes,
        }),
      })

      if (!response.ok) throw new Error('Failed to control scheduler')

      const data = await response.json()
      setSchedulerStatus(data.scheduler)

      // Refresh data after a short delay
      setTimeout(loadJobData, 1000)
    } catch (err) {
      console.error('Failed to control scheduler:', err)
      setError(err instanceof Error ? err.message : 'Failed to control scheduler')
    }
  }

  // Run manual job
  const runManualJob = async () => {
    try {
      const response = await fetch('/api/transit-monitoring-jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          runImmediately: true,
          options: {
            significanceThreshold: 0.5,
            maxChartsPerRun: 50,
          },
        }),
      })

      if (!response.ok) throw new Error('Failed to run manual job')

      // Refresh data after a short delay
      setTimeout(loadJobData, 2000)
    } catch (err) {
      console.error('Failed to run manual job:', err)
      setError(err instanceof Error ? err.message : 'Failed to run manual job')
    }
  }

  // Cancel job
  const cancelJob = async (jobId: string) => {
    try {
      const response = await fetch(`/api/transit-monitoring-jobs/${jobId}?userId=${userId}`, {
        method: 'DELETE',
      })

      if (!response.ok) throw new Error('Failed to cancel job')

      // Refresh data
      loadJobData()
    } catch (err) {
      console.error('Failed to cancel job:', err)
      setError(err instanceof Error ? err.message : 'Failed to cancel job')
    }
  }

  // Get status color and icon
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'completed':
        return {
          color: 'text-green-500',
          bgColor: 'bg-green-50 border-green-200',
          icon: CheckCircle,
        }
      case 'failed':
        return { color: 'text-red-500', bgColor: 'bg-red-50 border-red-200', icon: XCircle }
      case 'running':
        return { color: 'text-blue-500', bgColor: 'bg-blue-50 border-blue-200', icon: Activity }
      case 'cancelled':
        return { color: 'text-gray-500', bgColor: 'bg-gray-50 border-gray-200', icon: Square }
      default:
        return { color: 'text-yellow-500', bgColor: 'bg-yellow-50 border-yellow-200', icon: Clock }
    }
  }

  // Format execution time
  const formatExecutionTime = (ms?: number) => {
    if (!ms) return 'N/A'
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  if (loading && jobs.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Job Monitoring Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor background transit monitoring jobs and system performance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            <Switch checked={autoRefresh} onCheckedChange={setAutoRefresh} id="auto-refresh" />
            <Label htmlFor="auto-refresh" className="text-sm">
              Auto-refresh ({refreshInterval}s)
            </Label>
          </div>

          <Select
            value={refreshInterval.toString()}
            onValueChange={value => setRefreshInterval(Number(value))}
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="15">15s</SelectItem>
              <SelectItem value="30">30s</SelectItem>
              <SelectItem value="60">60s</SelectItem>
              <SelectItem value="300">5m</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={loadJobData} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Scheduler Control */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Background Scheduler
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-3 h-3 rounded-full ${schedulerStatus.isActive ? 'bg-green-500' : 'bg-gray-400'}`}
                />
                <span className="font-medium">
                  {schedulerStatus.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>

              {schedulerStatus.isActive && (
                <Badge variant="outline">Every {schedulerStatus.intervalMinutes} minutes</Badge>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={runManualJob} disabled={loading}>
                <Zap className="w-4 h-4 mr-2" />
                Run Manual Job
              </Button>

              {!schedulerStatus.isActive ? (
                <Button onClick={() => controlScheduler('start')}>
                  <Play className="w-4 h-4 mr-2" />
                  Start Scheduler
                </Button>
              ) : (
                <Button variant="destructive" onClick={() => controlScheduler('stop')}>
                  <Square className="w-4 h-4 mr-2" />
                  Stop Scheduler
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Statistics Overview */}
      {statistics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-muted-foreground" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalJobs}</p>
                  <p className="text-xs text-muted-foreground">Total Jobs</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-500">
                    {statistics.successRate.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">Success Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">
                    {formatExecutionTime(statistics.averageExecutionTime)}
                  </p>
                  <p className="text-xs text-muted-foreground">Avg Execution</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-500" />
                <div>
                  <p className="text-2xl font-bold">{statistics.totalNotificationsCreated}</p>
                  <p className="text-xs text-muted-foreground">Notifications Created</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Active Jobs */}
      {activeJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5" />
              Active Jobs ({activeJobs.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activeJobs.map(job => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <Activity className="w-4 h-4 text-blue-500 animate-spin" />
                    <div>
                      <div className="font-medium">{job.jobType.replace('_', ' ')}</div>
                      <div className="text-sm text-muted-foreground">
                        Started {formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}
                      </div>
                    </div>
                  </div>

                  {job.progress && (
                    <div className="flex items-center gap-3">
                      <div className="text-sm text-muted-foreground">
                        {job.progress.chartsProcessed}/{job.progress.totalCharts} charts
                      </div>
                      <Progress
                        value={(job.progress.chartsProcessed / job.progress.totalCharts) * 100}
                        className="w-24"
                      />
                      <Button variant="outline" size="sm" onClick={() => cancelJob(job.id)}>
                        <Square className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Job History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Job History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No jobs found. Start the scheduler or run a manual job to see history.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {jobs.map(job => {
                const statusInfo = getStatusInfo(job.status)
                const StatusIcon = statusInfo.icon

                return (
                  <div key={job.id} className={`p-3 border rounded-lg ${statusInfo.bgColor}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <StatusIcon className={`w-4 h-4 ${statusInfo.color}`} />
                        <div>
                          <div className="font-medium capitalize">
                            {job.jobType.replace('_', ' ')}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {format(new Date(job.scheduledFor), 'PPp')}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-sm font-medium">
                            {job.chartsProcessed} charts • {job.notificationsCreated} notifications
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatExecutionTime(job.executionTime)}
                          </div>
                        </div>

                        <Badge className={statusInfo.color}>{job.status}</Badge>
                      </div>
                    </div>

                    {job.completedAt && job.startedAt && (
                      <div className="mt-2 text-xs text-muted-foreground">
                        Completed{' '}
                        {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
