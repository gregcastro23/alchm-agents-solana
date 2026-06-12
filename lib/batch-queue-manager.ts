/**
 * Enterprise-Grade Batch Queue Management System
 * Handles queue processing, prioritization, and resource management
 */

import { EventEmitter } from 'events'

export interface BatchJob {
  id: string
  type: 'kinetics_export' | 'agent_analysis' | 'consciousness_sync' | 'custom'
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  progress: number
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  estimatedDuration: number
  actualDuration?: number
  retryCount: number
  maxRetries: number
  data: any
  result?: any
  error?: string
  processingNode?: string
  resources: {
    cpu: number
    memory: number
    priority: number
  }
  dependencies?: string[]
  tags?: string[]
}

export interface QueueMetrics {
  totalJobs: number
  queuedJobs: number
  processingJobs: number
  completedJobs: number
  failedJobs: number
  averageProcessingTime: number
  throughputPerHour: number
  resourceUtilization: {
    cpu: number
    memory: number
    activeWorkers: number
    maxWorkers: number
  }
  queueHealth: 'healthy' | 'degraded' | 'critical'
}

export interface WorkerNode {
  id: string
  status: 'active' | 'idle' | 'busy' | 'offline'
  capabilities: string[]
  currentLoad: number
  maxConcurrency: number
  currentJobs: string[]
  lastHeartbeat: Date
  totalProcessed: number
  averageProcessingTime: number
  errorRate: number
}

export class BatchQueueManager extends EventEmitter {
  private jobs = new Map<string, BatchJob>()
  private queue: string[] = []
  private processingJobs = new Map<string, AbortController>()
  private workers = new Map<string, WorkerNode>()
  private isProcessing = false
  private maxConcurrentJobs = 5
  private retryDelays = [1000, 5000, 15000, 30000, 60000] // Exponential backoff
  private cleanupInterval!: NodeJS.Timeout
  private metricsInterval: NodeJS.Timeout
  private metrics: QueueMetrics

  constructor(options?: {
    maxConcurrentJobs?: number
    autoStart?: boolean
    enableCleanup?: boolean
    metricsInterval?: number
  }) {
    super()

    this.maxConcurrentJobs = options?.maxConcurrentJobs || 5
    this.metrics = this.initializeMetrics()

    // Initialize cleanup and metrics intervals
    if (options?.enableCleanup !== false) {
      this.cleanupInterval = setInterval(() => this.cleanupCompletedJobs(), 300000) // 5 minutes
    }

    this.metricsInterval = setInterval(
      () => this.updateMetrics(),
      options?.metricsInterval || 30000
    ) // 30 seconds

    // Auto-start processing
    if (options?.autoStart !== false) {
      this.startProcessing()
    }

    // Register default worker
    this.registerWorker({
      id: 'default-worker',
      status: 'active',
      capabilities: ['kinetics_export', 'agent_analysis', 'consciousness_sync', 'custom'],
      currentLoad: 0,
      maxConcurrency: this.maxConcurrentJobs,
      currentJobs: [],
      lastHeartbeat: new Date(),
      totalProcessed: 0,
      averageProcessingTime: 0,
      errorRate: 0,
    })
  }

  /**
   * Job Management
   */

  addJob(
    jobData: Omit<BatchJob, 'id' | 'status' | 'progress' | 'createdAt' | 'retryCount'>
  ): string {
    const jobId = this.generateJobId()

    const job: BatchJob = {
      ...jobData,
      id: jobId,
      status: 'queued',
      progress: 0,
      createdAt: new Date(),
      retryCount: 0,
      maxRetries: jobData.maxRetries || 3,
    }

    this.jobs.set(jobId, job)
    this.insertJobInQueue(jobId)

    this.emit('jobAdded', job)
    console.log(`📋 Job ${jobId} added to queue with priority ${job.priority}`)

    return jobId
  }

  getJob(jobId: string): BatchJob | undefined {
    return this.jobs.get(jobId)
  }

  cancelJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job) return false

    if (job.status === 'processing') {
      const controller = this.processingJobs.get(jobId)
      if (controller) {
        controller.abort()
        this.processingJobs.delete(jobId)
      }
    }

    if (job.status === 'queued') {
      const queueIndex = this.queue.indexOf(jobId)
      if (queueIndex > -1) {
        this.queue.splice(queueIndex, 1)
      }
    }

    job.status = 'cancelled'
    job.completedAt = new Date()

    this.emit('jobCancelled', job)
    console.log(`🚫 Job ${jobId} cancelled`)

    return true
  }

  retryJob(jobId: string): boolean {
    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'failed') return false

    if (job.retryCount >= job.maxRetries) {
      console.log(`❌ Job ${jobId} exceeded max retries (${job.maxRetries})`)
      return false
    }

    job.status = 'queued'
    job.progress = 0
    job.retryCount++
    job.error = undefined

    this.insertJobInQueue(jobId)

    this.emit('jobRetried', job)
    console.log(`🔄 Job ${jobId} queued for retry (attempt ${job.retryCount}/${job.maxRetries})`)

    return true
  }

  /**
   * Queue Processing
   */

  private insertJobInQueue(jobId: string): void {
    const job = this.jobs.get(jobId)
    if (!job) return

    // Priority-based insertion
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const jobPriority = priorityOrder[job.priority]

    let insertIndex = this.queue.length
    for (let i = 0; i < this.queue.length; i++) {
      const queuedJob = this.jobs.get(this.queue[i])
      if (queuedJob && priorityOrder[queuedJob.priority] > jobPriority) {
        insertIndex = i
        break
      }
    }

    this.queue.splice(insertIndex, 0, jobId)
  }

  startProcessing(): void {
    if (this.isProcessing) return

    this.isProcessing = true
    this.emit('processingStarted')
    console.log('🚀 Batch queue processing started')

    this.processNextJob()
  }

  stopProcessing(): void {
    this.isProcessing = false

    // Cancel all processing jobs
    this.processingJobs.forEach((controller, jobId) => {
      controller.abort()
      const job = this.jobs.get(jobId)
      if (job) {
        job.status = 'cancelled'
        job.completedAt = new Date()
      }
    })

    this.processingJobs.clear()
    this.emit('processingStopped')
    console.log('⏸️ Batch queue processing stopped')
  }

  private async processNextJob(): Promise<void> {
    if (!this.isProcessing || this.processingJobs.size >= this.maxConcurrentJobs) {
      return
    }

    const jobId = this.queue.shift()
    if (!jobId) {
      // No jobs in queue, check again in 1 second
      setTimeout(() => this.processNextJob(), 1000)
      return
    }

    const job = this.jobs.get(jobId)
    if (!job || job.status !== 'queued') {
      this.processNextJob()
      return
    }

    // Check dependencies
    if (job.dependencies && !this.areDependenciesMet(job.dependencies)) {
      // Put job back in queue and try later
      this.queue.unshift(jobId)
      setTimeout(() => this.processNextJob(), 5000)
      return
    }

    await this.executeJob(job)
    this.processNextJob()
  }

  private async executeJob(job: BatchJob): Promise<void> {
    const controller = new AbortController()
    this.processingJobs.set(job.id, controller)

    job.status = 'processing'
    job.startedAt = new Date()
    job.progress = 0

    this.emit('jobStarted', job)
    console.log(`🏗️ Processing job ${job.id} (${job.type})`)

    try {
      // Process job based on type
      const result = await this.processJobByType(job, controller.signal)

      job.status = 'completed'
      job.progress = 100
      job.completedAt = new Date()
      job.result = result
      job.actualDuration = job.completedAt.getTime() - (job.startedAt?.getTime() || 0)

      this.emit('jobCompleted', job)
      console.log(`✅ Job ${job.id} completed in ${job.actualDuration}ms`)
    } catch (error) {
      if (controller.signal.aborted) {
        job.status = 'cancelled'
        console.log(`🚫 Job ${job.id} was cancelled`)
      } else {
        job.status = 'failed'
        job.error = error instanceof Error ? error.message : 'Unknown error'

        this.emit('jobFailed', job)
        console.log(`❌ Job ${job.id} failed: ${job.error}`)

        // Attempt retry with exponential backoff
        if (job.retryCount < job.maxRetries) {
          const delay = this.retryDelays[Math.min(job.retryCount, this.retryDelays.length - 1)]
          setTimeout(() => this.retryJob(job.id), delay)
        }
      }

      job.completedAt = new Date()
      job.actualDuration = job.completedAt.getTime() - (job.startedAt?.getTime() || 0)
    } finally {
      this.processingJobs.delete(job.id)
    }
  }

  private async processJobByType(job: BatchJob, signal: AbortSignal): Promise<any> {
    // Simulate processing based on job type
    const simulateProgress = (duration: number) => {
      return new Promise((resolve, reject) => {
        const startTime = Date.now()
        const interval = setInterval(() => {
          if (signal.aborted) {
            clearInterval(interval)
            reject(new Error('Job cancelled'))
            return
          }

          const elapsed = Date.now() - startTime
          job.progress = Math.min(100, Math.round((elapsed / duration) * 100))

          if (elapsed >= duration) {
            clearInterval(interval)
            resolve(`Processed ${job.type} job`)
          }
        }, 100)
      })
    }

    switch (job.type) {
      case 'kinetics_export':
        return await simulateProgress(job.estimatedDuration || 5000)

      case 'agent_analysis':
        return await simulateProgress(job.estimatedDuration || 3000)

      case 'consciousness_sync':
        return await simulateProgress(job.estimatedDuration || 8000)

      case 'custom':
        return await simulateProgress(job.estimatedDuration || 2000)

      default:
        throw new Error(`Unknown job type: ${job.type}`)
    }
  }

  /**
   * Worker Management
   */

  registerWorker(worker: WorkerNode): void {
    this.workers.set(worker.id, worker)
    this.emit('workerRegistered', worker)
    console.log(`👷 Worker ${worker.id} registered`)
  }

  unregisterWorker(workerId: string): void {
    this.workers.delete(workerId)
    this.emit('workerUnregistered', workerId)
    console.log(`👷 Worker ${workerId} unregistered`)
  }

  getWorkers(): WorkerNode[] {
    return Array.from(this.workers.values())
  }

  /**
   * Metrics and Health
   */

  getMetrics(): QueueMetrics {
    return { ...this.metrics }
  }

  getQueueStatus(): {
    totalJobs: number
    queuedJobs: BatchJob[]
    processingJobs: BatchJob[]
    recentlyCompleted: BatchJob[]
    failed: BatchJob[]
  } {
    const allJobs = Array.from(this.jobs.values())

    return {
      totalJobs: allJobs.length,
      queuedJobs: allJobs.filter(job => job.status === 'queued'),
      processingJobs: allJobs.filter(job => job.status === 'processing'),
      recentlyCompleted: allJobs
        .filter(job => job.status === 'completed')
        .sort((a, b) => (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0))
        .slice(0, 10),
      failed: allJobs.filter(job => job.status === 'failed'),
    }
  }

  /**
   * Utility Methods
   */

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private areDependenciesMet(dependencies: string[]): boolean {
    return dependencies.every(depId => {
      const dep = this.jobs.get(depId)
      return dep && dep.status === 'completed'
    })
  }

  private cleanupCompletedJobs(): void {
    const cutoffTime = Date.now() - 24 * 60 * 60 * 1000 // 24 hours ago
    let cleanedCount = 0

    this.jobs.forEach((job, id) => {
      if (
        (job.status === 'completed' || job.status === 'failed') &&
        job.completedAt &&
        job.completedAt.getTime() < cutoffTime
      ) {
        this.jobs.delete(id)
        cleanedCount++
      }
    })

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old jobs`)
    }
  }

  private updateMetrics(): void {
    const allJobs = Array.from(this.jobs.values())
    const completedJobs = allJobs.filter(job => job.status === 'completed')

    this.metrics = {
      totalJobs: allJobs.length,
      queuedJobs: allJobs.filter(job => job.status === 'queued').length,
      processingJobs: allJobs.filter(job => job.status === 'processing').length,
      completedJobs: completedJobs.length,
      failedJobs: allJobs.filter(job => job.status === 'failed').length,
      averageProcessingTime: this.calculateAverageProcessingTime(completedJobs),
      throughputPerHour: this.calculateThroughput(completedJobs),
      resourceUtilization: {
        cpu: this.calculateCpuUtilization(),
        memory: this.calculateMemoryUtilization(),
        activeWorkers: this.workers.size,
        maxWorkers: this.maxConcurrentJobs,
      },
      queueHealth: this.calculateQueueHealth(),
    }

    this.emit('metricsUpdated', this.metrics)
  }

  private initializeMetrics(): QueueMetrics {
    return {
      totalJobs: 0,
      queuedJobs: 0,
      processingJobs: 0,
      completedJobs: 0,
      failedJobs: 0,
      averageProcessingTime: 0,
      throughputPerHour: 0,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        activeWorkers: 0,
        maxWorkers: this.maxConcurrentJobs,
      },
      queueHealth: 'healthy',
    }
  }

  private calculateAverageProcessingTime(completedJobs: BatchJob[]): number {
    if (completedJobs.length === 0) return 0

    const totalTime = completedJobs.reduce((sum, job) => sum + (job.actualDuration || 0), 0)

    return Math.round(totalTime / completedJobs.length)
  }

  private calculateThroughput(completedJobs: BatchJob[]): number {
    const oneHourAgo = Date.now() - 60 * 60 * 1000
    const recentJobs = completedJobs.filter(
      job => job.completedAt && job.completedAt.getTime() > oneHourAgo
    )

    return recentJobs.length
  }

  private calculateCpuUtilization(): number {
    return Math.round((this.processingJobs.size / this.maxConcurrentJobs) * 100)
  }

  private calculateMemoryUtilization(): number {
    // Mock memory calculation - in production, use actual memory monitoring
    const baseMemory = 50 // Base memory usage
    const jobMemory = this.processingJobs.size * 10 // Each job uses ~10% memory
    return Math.min(100, baseMemory + jobMemory)
  }

  private calculateQueueHealth(): 'healthy' | 'degraded' | 'critical' {
    const queuedCount = Array.from(this.jobs.values()).filter(job => job.status === 'queued').length
    const failureRate = this.metrics.failedJobs / Math.max(1, this.metrics.totalJobs)

    if (queuedCount > 100 || failureRate > 0.2) {
      return 'critical'
    } else if (queuedCount > 50 || failureRate > 0.1) {
      return 'degraded'
    }

    return 'healthy'
  }

  /**
   * Cleanup
   */

  destroy(): void {
    this.stopProcessing()

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval)
    }

    this.removeAllListeners()
    console.log('🔧 Batch queue manager destroyed')
  }
}

// Singleton instance
export const batchQueueManager = new BatchQueueManager({
  maxConcurrentJobs: 5,
  autoStart: true,
  enableCleanup: true,
  metricsInterval: 30000,
})
