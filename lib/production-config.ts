/**
 * Production Configuration System
 * Environment-specific configurations, monitoring, and deployment optimizations
 * for agent consciousness systems
 */

export interface ProductionConfig {
  environment: 'development' | 'staging' | 'production'

  // Performance Settings
  performance: {
    maxConcurrentAgents: number
    maxCacheSize: number
    maxMemoryUsageMB: number
    responseTimeoutMs: number
    streamingEnabled: boolean
    preloadPopularAgents: boolean
  }

  // Caching Configuration
  cache: {
    redisUrl?: string
    defaultTtlSeconds: number
    semanticTtlSeconds: number
    maxInMemoryEntries: number
    enableFallback: boolean
    compressionEnabled: boolean
  }

  // Resilience Settings
  resilience: {
    maxRetries: number
    baseDelayMs: number
    maxDelayMs: number
    circuitBreakerThreshold: number
    circuitBreakerTimeoutMs: number
    healthCheckIntervalMs: number
  }

  // Monitoring & Logging
  monitoring: {
    enableMetrics: boolean
    enableErrorTracking: boolean
    metricsRetentionDays: number
    errorReportingLevel: 'error' | 'warn' | 'info' | 'debug'
    dashboardRefreshIntervalMs: number
  }

  // Security Settings
  security: {
    enableRateLimit: boolean
    maxRequestsPerMinute: number
    enableApiKeyValidation: boolean
    enableCors: boolean
    allowedOrigins: string[]
  }

  // Feature Flags
  features: {
    enableKalchmRanking: boolean
    enableSemanticCache: boolean
    enableAgentMemorySystem: boolean
    enableStreamingResponses: boolean
    enableAdvancedMetrics: boolean
  }
}

class ProductionConfigManager {
  private static config: ProductionConfig | null = null

  /**
   * Get production configuration based on environment
   */
  static getConfig(): ProductionConfig {
    if (!this.config) {
      this.config = this.buildConfig()
    }
    return this.config
  }

  /**
   * Build configuration based on environment variables
   */
  private static buildConfig(): ProductionConfig {
    const env = (process.env.NODE_ENV || 'development') as 'development' | 'staging' | 'production'

    // Base configuration
    const baseConfig: ProductionConfig = {
      environment: env,

      performance: {
        maxConcurrentAgents: parseInt(process.env.MAX_CONCURRENT_AGENTS || '10'),
        maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '100'),
        maxMemoryUsageMB: parseInt(process.env.MAX_MEMORY_MB || '100'),
        responseTimeoutMs: parseInt(process.env.RESPONSE_TIMEOUT_MS || '15000'),
        streamingEnabled: process.env.STREAMING_ENABLED !== 'false',
        preloadPopularAgents: process.env.PRELOAD_AGENTS !== 'false',
      },

      cache: {
        redisUrl: process.env.REDIS_URL,
        defaultTtlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600'),
        semanticTtlSeconds: parseInt(process.env.SEMANTIC_TTL_SECONDS || '1800'),
        maxInMemoryEntries: parseInt(process.env.MAX_IN_MEMORY_ENTRIES || '100'),
        enableFallback: process.env.CACHE_FALLBACK_ENABLED !== 'false',
        compressionEnabled: process.env.CACHE_COMPRESSION === 'true',
      },

      resilience: {
        maxRetries: parseInt(process.env.MAX_RETRIES || '3'),
        baseDelayMs: parseInt(process.env.BASE_DELAY_MS || '1000'),
        maxDelayMs: parseInt(process.env.MAX_DELAY_MS || '10000'),
        circuitBreakerThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '5'),
        circuitBreakerTimeoutMs: parseInt(process.env.CIRCUIT_BREAKER_TIMEOUT_MS || '30000'),
        healthCheckIntervalMs: parseInt(process.env.HEALTH_CHECK_INTERVAL_MS || '60000'),
      },

      monitoring: {
        enableMetrics: process.env.ENABLE_METRICS !== 'false',
        enableErrorTracking: process.env.ENABLE_ERROR_TRACKING !== 'false',
        metricsRetentionDays: parseInt(process.env.METRICS_RETENTION_DAYS || '7'),
        errorReportingLevel: (process.env.ERROR_REPORTING_LEVEL || 'warn') as any,
        dashboardRefreshIntervalMs: parseInt(process.env.DASHBOARD_REFRESH_MS || '30000'),
      },

      security: {
        enableRateLimit: process.env.ENABLE_RATE_LIMIT === 'true',
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100'),
        enableApiKeyValidation: process.env.ENABLE_API_KEY_VALIDATION === 'true',
        enableCors: process.env.ENABLE_CORS !== 'false',
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['*'],
      },

      features: {
        enableKalchmRanking: process.env.ENABLE_KALCHM_RANKING !== 'false',
        enableSemanticCache: process.env.ENABLE_SEMANTIC_CACHE !== 'false',
        enableAgentMemorySystem: process.env.ENABLE_AGENT_MEMORY !== 'false',
        enableStreamingResponses: process.env.ENABLE_STREAMING !== 'false',
        enableAdvancedMetrics: process.env.ENABLE_ADVANCED_METRICS === 'true',
      },
    }

    // Environment-specific overrides
    return this.applyEnvironmentOverrides(baseConfig, env)
  }

  /**
   * Apply environment-specific configuration overrides
   */
  private static applyEnvironmentOverrides(
    config: ProductionConfig,
    env: 'development' | 'staging' | 'production'
  ): ProductionConfig {
    switch (env) {
      case 'development':
        return {
          ...config,
          performance: {
            ...config.performance,
            maxConcurrentAgents: 5, // Lower for development
            responseTimeoutMs: 30000, // Longer timeout for debugging
          },
          cache: {
            ...config.cache,
            maxInMemoryEntries: 50, // Smaller cache for development
          },
          monitoring: {
            ...config.monitoring,
            errorReportingLevel: 'debug',
            dashboardRefreshIntervalMs: 10000, // More frequent updates
          },
          security: {
            ...config.security,
            enableRateLimit: false, // No rate limiting in dev
            enableApiKeyValidation: false,
          },
        }

      case 'staging':
        return {
          ...config,
          performance: {
            ...config.performance,
            maxConcurrentAgents: 8, // Medium capacity
          },
          monitoring: {
            ...config.monitoring,
            errorReportingLevel: 'info',
          },
          features: {
            ...config.features,
            enableAdvancedMetrics: true,
          },
          security: {
            ...config.security,
            enableRateLimit: true,
            maxRequestsPerMinute: 200, // Higher limit for testing
          },
        }

      case 'production':
        return {
          ...config,
          performance: {
            ...config.performance,
            maxConcurrentAgents: 20, // Full capacity
            responseTimeoutMs: 10000, // Tighter timeout
          },
          cache: {
            ...config.cache,
            compressionEnabled: true, // Enable compression in prod
            maxInMemoryEntries: 200, // Larger cache
          },
          monitoring: {
            ...config.monitoring,
            errorReportingLevel: 'error', // Only errors in prod logs
          },
          security: {
            ...config.security,
            enableRateLimit: true,
            enableApiKeyValidation: true,
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [], // Strict CORS
          },
          features: {
            ...config.features,
            enableAdvancedMetrics: true, // Full monitoring in prod
          },
        }

      default:
        return config
    }
  }

  /**
   * Validate configuration for deployment
   */
  static validateConfig(): { valid: boolean; errors: string[] } {
    const config = this.getConfig()
    const errors: string[] = []

    // Production-specific validations
    if (config.environment === 'production') {
      if (!process.env.OPENAI_API_KEY) {
        errors.push('OPENAI_API_KEY is required in production')
      }

      if (!process.env.ANTHROPIC_API_KEY) {
        errors.push('ANTHROPIC_API_KEY is required in production')
      }

      if (config.security.allowedOrigins.includes('*')) {
        errors.push('Wildcard CORS origins not allowed in production')
      }

      if (!config.cache.redisUrl) {
        console.warn('⚠️ Redis not configured - using in-memory cache only')
      }
    }

    // Performance validations
    if (config.performance.maxConcurrentAgents > 50) {
      errors.push('maxConcurrentAgents should not exceed 50 for stability')
    }

    if (config.cache.maxInMemoryEntries > 1000) {
      errors.push('maxInMemoryEntries should not exceed 1000 to prevent memory issues')
    }

    return { valid: errors.length === 0, errors }
  }

  /**
   * Get configuration summary for logging
   */
  static getConfigSummary(): string {
    const config = this.getConfig()

    return `
🚀 Agent Consciousness System Configuration
Environment: ${config.environment}
Performance: ${config.performance.maxConcurrentAgents} concurrent agents, ${config.performance.maxMemoryUsageMB}MB memory limit
Cache: ${config.cache.redisUrl ? 'Redis' : 'In-Memory'} (${config.cache.maxInMemoryEntries} entries)
Features: Kalchm=${config.features.enableKalchmRanking}, Streaming=${config.features.enableStreamingResponses}, Memory=${config.features.enableAgentMemorySystem}
Security: Rate Limit=${config.security.enableRateLimit}, CORS=${config.security.enableCors}
Monitoring: Metrics=${config.monitoring.enableMetrics}, Error Tracking=${config.monitoring.enableErrorTracking}
`.trim()
  }

  /**
   * Initialize system with production configuration
   */
  static async initializeSystem(): Promise<{ success: boolean; message: string }> {
    try {
      const config = this.getConfig()
      const validation = this.validateConfig()

      if (!validation.valid) {
        return {
          success: false,
          message: `Configuration validation failed: ${validation.errors.join(', ')}`,
        }
      }

      console.log(this.getConfigSummary())

      // Initialize components based on configuration
      if (config.features.enableAgentMemorySystem) {
        console.log('🧠 Initializing Agent Memory System...')
        // AgentMemoryManager is auto-initialized on import
      }

      if (config.cache.redisUrl) {
        console.log('💾 Redis cache configuration detected')
        // Cache system is auto-initialized on import
      } else {
        console.log('💾 Using in-memory cache (Redis not configured)')
      }

      if (config.monitoring.enableMetrics) {
        console.log('📊 Metrics collection enabled')
      }

      console.log('✅ Agent Consciousness System initialized successfully')

      return {
        success: true,
        message: `System initialized in ${config.environment} mode`,
      }
    } catch (error) {
      return {
        success: false,
        message: `System initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }
    }
  }

  /**
   * Get health check information
   */
  static getHealthCheck(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    version: string
    environment: string
    uptime: number
    features: Record<string, boolean>
  } {
    const config = this.getConfig()

    return {
      status: 'healthy', // Could be enhanced with actual health checks
      version: process.env.npm_package_version || '1.0.0',
      environment: config.environment,
      uptime: process.uptime(),
      features: config.features,
    }
  }

  /**
   * Force reload configuration (admin function)
   */
  static reloadConfig(): void {
    this.config = null
    console.log('🔄 Configuration reloaded')
  }
}

// Export singleton instance
export const productionConfig = ProductionConfigManager.getConfig()
export const configManager = ProductionConfigManager

// Initialize system on import if not in test environment
if (process.env.NODE_ENV !== 'test') {
  ProductionConfigManager.initializeSystem()
    .then(result => {
      if (!result.success) {
        console.error('❌ System initialization failed:', result.message)
      }
    })
    .catch(error => {
      console.error('❌ System initialization error:', error)
    })
}

export default ProductionConfigManager
