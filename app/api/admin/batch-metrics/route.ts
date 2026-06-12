/**
 * Batch Processing Metrics API
 * Provides real job queue metrics for the batch processing dashboard
 */

import { NextRequest, NextResponse } from 'next/server'
import { adminErrorResponse, requireAdmin } from '@/lib/admin-auth'
import { prisma } from '@/lib/db'

function mapJobStatus(status: string) {
  switch (status) {
    case 'pending':
      return 'queued'
    case 'running':
      return 'processing'
    case 'completed':
    case 'failed':
    case 'cancelled':
      return status
    default:
      return 'queued'
  }
}

export async function GET(_request: NextRequest) {
  try {
    const admin = await requireAdmin()
    if (!admin.ok) return adminErrorResponse(admin)

    // Get job statistics from database
    const [allJobs, queuedJobs, processingJobs, completedJobs, failedJobs, recentJobs] =
      await Promise.all([
        prisma.transit_monitoring_jobs.count(),
        prisma.transit_monitoring_jobs.count({ where: { status: 'pending' } }),
        prisma.transit_monitoring_jobs.count({ where: { status: 'running' } }),
        prisma.transit_monitoring_jobs.count({ where: { status: 'completed' } }),
        prisma.transit_monitoring_jobs.count({ where: { status: 'failed' } }),
        prisma.transit_monitoring_jobs.findMany({
          take: 10,
          orderBy: { scheduledFor: 'desc' },
        }),
      ])

    // Calculate average processing time
    const completedWithTime = await prisma.transit_monitoring_jobs.aggregate({
      where: {
        status: 'completed',
        executionTime: { not: null },
      },
      _avg: {
        executionTime: true,
      },
    })

    const avgProcessingTime = completedWithTime._avg.executionTime || 4200
    const memoryUsage =
      process.memoryUsage().heapTotal > 0
        ? (process.memoryUsage().heapUsed / process.memoryUsage().heapTotal) * 100
        : null
    const maxWorkers = Number(process.env.BATCH_MAX_WORKERS || 5)

    // Calculate throughput (jobs per hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    const jobsLastHour = await prisma.transit_monitoring_jobs.count({
      where: {
        scheduledFor: { gte: oneHourAgo },
      },
    })

    // Build metrics response
    const metrics = {
      totalJobs: allJobs,
      queuedJobs,
      processingJobs,
      completedJobs,
      failedJobs,
      averageProcessingTime: avgProcessingTime,
      throughputPerHour: jobsLastHour,
      resourceUtilization: {
        cpu: null,
        memory: memoryUsage,
        activeWorkers: processingJobs,
        maxWorkers,
        estimated: false,
      },
      queueHealth:
        queuedJobs < 50 && failedJobs / Math.max(1, allJobs) < 0.05
          ? 'healthy'
          : queuedJobs > 100
            ? 'critical'
            : 'degraded',
    }

    // Convert recent jobs to batch job format
    const jobs = recentJobs.map((job, index: number) => ({
      id: job.id,
      type: 'transit_monitoring',
      priority: index < 3 ? 'high' : index < 7 ? 'medium' : 'low',
      status: mapJobStatus(job.status),
      progress: job.status === 'completed' ? 100 : job.status === 'running' ? 50 : 0,
      createdAt: job.scheduledFor,
      startedAt: job.startedAt || undefined,
      completedAt: job.completedAt || undefined,
      estimatedDuration: avgProcessingTime,
      actualDuration: job.executionTime || undefined,
      retryCount: job.retryCount,
      maxRetries: job.maxRetries,
      error: job.lastError || undefined,
    }))

    return NextResponse.json({
      success: true,
      metrics,
      jobs,
      alerts: [],
      bottlenecks: [],
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Batch Metrics API] Error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
