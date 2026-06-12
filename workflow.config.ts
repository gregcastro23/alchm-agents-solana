/**
 * Workflow DevKit Configuration
 *
 * Configuration for the Workflow DevKit integration
 * See: https://workflow.dev/docs
 */

import { defineConfig } from 'workflow'

export default defineConfig({
  // Workflow runtime settings
  runtime: {
    // Maximum duration for a workflow execution (in milliseconds)
    // Default: 24 hours
    maxDuration: 24 * 60 * 60 * 1000,

    // Retry configuration for failed steps
    retry: {
      maxAttempts: 3,
      backoff: 'exponential', // exponential, linear, or fixed
      initialDelay: 1000, // 1 second
      maxDelay: 60000, // 1 minute
    },
  },

  // Observability settings
  observability: {
    // Enable tracing for workflow execution
    tracing: true,

    // Enable metrics collection
    metrics: true,

    // Log level (debug, info, warn, error)
    logLevel: 'info',
  },

  // Step configuration
  steps: {
    // Default timeout for individual steps (in milliseconds)
    defaultTimeout: 30000, // 30 seconds

    // Retry configuration for steps
    retry: {
      maxAttempts: 3,
      backoff: 'exponential',
      initialDelay: 1000,
      maxDelay: 30000,
    },
  },

  // Storage configuration
  storage: {
    // For development, use in-memory storage
    // For production, use a persistent store (Redis, PostgreSQL, etc.)
    type: process.env.NODE_ENV === 'production' ? 'redis' : 'memory',

    // Redis configuration (if using Redis storage)
    redis: {
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      keyPrefix: 'workflow:',
    },
  },

  // Workflow-specific configurations
  workflows: {
    // Consciousness Evolution Workflow
    consciousnessEvolution: {
      // Maximum concurrent executions
      maxConcurrency: 10,

      // Timeout for the entire workflow
      timeout: 30 * 24 * 60 * 60 * 1000, // 30 days

      // Retry configuration
      retry: {
        maxAttempts: 5,
        backoff: 'exponential',
      },
    },
  },
})
