# 🚀 Zodiac Accuracy System - Production Deployment Configuration

## Overview

Production deployment configuration for the enhanced zodiac accuracy system with ±0.01° precision using VSOP87 astronomical algorithms.

## Environment Variables

### Required Environment Variables

```bash
# Core System
ZODIAC_PRECISION_MODE=high
ZODIAC_CACHE_ENABLED=true
ZODIAC_FALLBACK_ENABLED=true

# Performance Settings
ZODIAC_CACHE_TTL=3600000    # 1 hour in milliseconds
ZODIAC_MAX_CACHE_SIZE=1000  # Maximum cached calendars
ZODIAC_CALCULATION_TIMEOUT=5000  # 5 seconds max per calculation

# Monitoring
ZODIAC_MONITORING_ENABLED=true
ZODIAC_LOG_LEVEL=info
ZODIAC_ERROR_REPORTING=true

# API Rate Limiting
ZODIAC_API_RATE_LIMIT=1000  # Requests per hour
ZODIAC_API_BURST_LIMIT=100  # Burst requests per minute
```

### Optional Environment Variables

```bash
# Advanced Settings
ZODIAC_DECAN_SYSTEM=chaldean  # chaldean | modern
ZODIAC_COORDINATE_SYSTEM=tropical  # tropical | sidereal
ZODIAC_PRECISION_DIGITS=6  # Decimal places for calculations

# Development/Testing
ZODIAC_DEBUG_MODE=false
ZODIAC_ACCURACY_CHECKS=true
ZODIAC_BENCHMARK_MODE=false
```

## Next.js Configuration

### next.config.js Updates

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['@/lib/ephemeris'],
  },
  env: {
    ZODIAC_PRECISION_MODE: process.env.ZODIAC_PRECISION_MODE || 'high',
    ZODIAC_CACHE_ENABLED: process.env.ZODIAC_CACHE_ENABLED || 'true',
  },
  webpack: (config, { isServer }) => {
    // Optimize zodiac calculations for production
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      }
    }

    // Add source maps for zodiac modules in production
    if (process.env.NODE_ENV === 'production') {
      config.optimization = {
        ...config.optimization,
        moduleIds: 'deterministic',
      }
    }

    return config
  },
  // Performance optimizations
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
}

module.exports = nextConfig
```

## Docker Configuration

### Dockerfile.zodiac

```dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
RUN yarn --frozen-lockfile

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Set zodiac environment variables for build
ENV ZODIAC_PRECISION_MODE=high
ENV ZODIAC_CACHE_ENABLED=true
ENV NODE_ENV=production

# Build with optimizations
RUN yarn build

# Production image, copy all the files and run next
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV ZODIAC_PRECISION_MODE=high
ENV ZODIAC_CACHE_ENABLED=true
ENV ZODIAC_FALLBACK_ENABLED=true

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

# Set the correct permission for prerender cache
RUN mkdir .next
RUN chown nextjs:nodejs .next

# Automatically leverage output traces to reduce image size
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000
ENV HOSTNAME "0.0.0.0"

CMD ["node", "server.js"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  planetary-agents:
    build:
      context: .
      dockerfile: Dockerfile.zodiac
    ports:
      - '3000:3000'
    environment:
      - NODE_ENV=production
      - ZODIAC_PRECISION_MODE=high
      - ZODIAC_CACHE_ENABLED=true
      - ZODIAC_FALLBACK_ENABLED=true
      - ZODIAC_MONITORING_ENABLED=true
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - redis
    restart: unless-stopped
    healthcheck:
      test: ['CMD', 'curl', '-f', 'http://localhost:3000/api/zodiac-calendar?action=current-period']
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis_data:/data
    restart: unless-stopped

volumes:
  redis_data:
```

## Vercel Deployment

### vercel.json

```json
{
  "version": 2,
  "env": {
    "ZODIAC_PRECISION_MODE": "high",
    "ZODIAC_CACHE_ENABLED": "true",
    "ZODIAC_FALLBACK_ENABLED": "true",
    "ZODIAC_MONITORING_ENABLED": "true"
  },
  "functions": {
    "app/api/zodiac-calendar/route.ts": {
      "maxDuration": 10
    }
  },
  "crons": [
    {
      "path": "/api/zodiac-calendar/cache-warmup",
      "schedule": "0 0 * * *"
    }
  ]
}
```

## Redis Configuration

### Caching Strategy

```javascript
// lib/redis-config.js
const redis = require('redis')

const client = redis.createClient({
  url: process.env.REDIS_URL,
  retry_strategy: options => {
    if (options.error && options.error.code === 'ECONNREFUSED') {
      return new Error('The server refused the connection')
    }
    if (options.total_retry_time > 1000 * 60 * 60) {
      return new Error('Retry time exhausted')
    }
    if (options.attempt > 10) {
      return undefined
    }
    return Math.min(options.attempt * 100, 3000)
  },
})

// Cache keys
const CACHE_KEYS = {
  ANNUAL_CALENDAR: year => `zodiac:calendar:${year}`,
  ZODIAC_POSITION: date => `zodiac:position:${date.toISOString().split('T')[0]}`,
  DEGREE_MAP: (year, degree) => `zodiac:degree:${year}:${degree}`,
  CARDINAL_POINTS: year => `zodiac:cardinal:${year}`,
}

module.exports = { client, CACHE_KEYS }
```

## Performance Monitoring

### Monitoring Dashboard API

```javascript
// app/api/zodiac-monitor/route.ts
import { zodiacMonitoring } from '@/lib/zodiac-monitoring'

export async function GET() {
  const metrics = zodiacMonitoring.getMetrics()
  const health = zodiacMonitoring.getHealthStatus()
  const performance = zodiacMonitoring.getPerformanceStats()

  return Response.json({
    timestamp: new Date().toISOString(),
    health: health.status,
    metrics: {
      calculations_per_second: metrics.calculationsPerformed / (Date.now() / 1000),
      average_response_time: metrics.averageCalculationTime,
      cache_hit_rate: metrics.cacheHitRate * 100,
      error_rate: (metrics.errorCount / metrics.calculationsPerformed) * 100,
    },
    alerts: health.issues,
    recommendations: health.recommendations,
  })
}
```

## Database Schema

### Zodiac Cache Table

```sql
CREATE TABLE zodiac_cache (
  id SERIAL PRIMARY KEY,
  cache_key VARCHAR(255) UNIQUE NOT NULL,
  data JSONB NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_zodiac_cache_key ON zodiac_cache(cache_key);
CREATE INDEX idx_zodiac_cache_expires ON zodiac_cache(expires_at);

-- Cleanup old cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_zodiac_cache()
RETURNS void AS $$
BEGIN
  DELETE FROM zodiac_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Schedule cleanup (if using pg_cron)
SELECT cron.schedule('cleanup-zodiac-cache', '0 2 * * *', 'SELECT cleanup_expired_zodiac_cache();');
```

## Load Balancing

### Nginx Configuration

```nginx
upstream planetary_agents {
    server app1:3000 weight=3;
    server app2:3000 weight=2;
    server app3:3000 weight=1;

    # Health checks
    keepalive 32;
}

server {
    listen 80;
    server_name your-domain.com;

    # Zodiac API specific caching
    location /api/zodiac-calendar {
        proxy_pass http://planetary_agents;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # Cache zodiac calculations
        proxy_cache_valid 200 1h;
        proxy_cache_key "$request_uri$is_args$args";
        add_header X-Cache-Status $upstream_cache_status;

        # Timeout settings
        proxy_connect_timeout 5s;
        proxy_send_timeout 10s;
        proxy_read_timeout 10s;
    }

    # Main application
    location / {
        proxy_pass http://planetary_agents;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Monitoring & Alerting

### Prometheus Metrics

```javascript
// lib/prometheus-metrics.js
const prometheus = require('prom-client')

const zodiacCalculationDuration = new prometheus.Histogram({
  name: 'zodiac_calculation_duration_seconds',
  help: 'Duration of zodiac calculations',
  labelNames: ['operation_type'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10],
})

const zodiacCacheHitRate = new prometheus.Gauge({
  name: 'zodiac_cache_hit_rate',
  help: 'Cache hit rate for zodiac calculations',
})

const zodiacApiRequests = new prometheus.Counter({
  name: 'zodiac_api_requests_total',
  help: 'Total zodiac API requests',
  labelNames: ['endpoint', 'status'],
})

module.exports = {
  zodiacCalculationDuration,
  zodiacCacheHitRate,
  zodiacApiRequests,
}
```

### Health Check Endpoint

```javascript
// app/api/health/zodiac/route.ts
export async function GET() {
  try {
    // Test core zodiac functionality
    const testDate = new Date()
    const position = getZodiacPositionForDate(testDate)

    if (!position || !position.sign) {
      throw new Error('Zodiac calculation failed')
    }

    const health = zodiacMonitoring.getHealthStatus()

    return Response.json(
      {
        status: health.status,
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        features: {
          high_precision: true,
          caching: true,
          monitoring: true,
          fallback: true,
        },
        test_calculation: {
          date: testDate.toISOString(),
          result: `${position.degree_in_sign.toFixed(2)}° ${position.sign}`,
          decan: position.decan,
          ruler: position.decan_ruler,
        },
      },
      {
        status: health.status === 'healthy' ? 200 : health.status === 'warning' ? 200 : 503,
      }
    )
  } catch (error) {
    return Response.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    )
  }
}
```

## Deployment Checklist

### Pre-deployment

- [ ] Run full test suite: `yarn test && yarn test:zodiac`
- [ ] Verify type checking: `yarn type-check`
- [ ] Check bundle size: `yarn analyze`
- [ ] Test API endpoints: `curl http://localhost:3000/api/zodiac-calendar`
- [ ] Validate environment variables
- [ ] Review monitoring configuration

### Production Deployment

- [ ] Set all required environment variables
- [ ] Configure Redis/caching layer
- [ ] Set up monitoring dashboards
- [ ] Configure load balancer
- [ ] Test health check endpoints
- [ ] Verify SSL certificates
- [ ] Set up log aggregation

### Post-deployment

- [ ] Monitor error rates and performance
- [ ] Verify cache hit rates
- [ ] Test all zodiac API endpoints
- [ ] Check accuracy with known astronomical events
- [ ] Monitor memory usage and scaling
- [ ] Set up alerting for critical issues

## Security Considerations

### Rate Limiting

```javascript
// middleware/rate-limit.js
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(1000, '1 h'),
  analytics: true,
})

export async function zodiacRateLimit(request) {
  const ip = request.ip ?? '127.0.0.1'
  const { success } = await ratelimit.limit(`zodiac_${ip}`)

  if (!success) {
    throw new Error('Rate limit exceeded')
  }
}
```

### Input Validation

```javascript
// lib/zodiac-validation.js
export function validateZodiacInput(input) {
  // Validate date inputs
  if (input.date && !isValidDate(input.date)) {
    throw new Error('Invalid date format')
  }

  // Validate degree inputs
  if (input.degree !== undefined) {
    const degree = parseFloat(input.degree)
    if (isNaN(degree) || degree < 0 || degree >= 360) {
      throw new Error('Degree must be between 0 and 359')
    }
  }

  // Validate year inputs
  if (input.year !== undefined) {
    const year = parseInt(input.year)
    if (isNaN(year) || year < 1900 || year > 2100) {
      throw new Error('Year must be between 1900 and 2100')
    }
  }
}
```

## Performance Targets

### Production SLA

- **API Response Time**: < 200ms (95th percentile)
- **Accuracy**: ±0.01° for all calculations
- **Uptime**: 99.9%
- **Cache Hit Rate**: > 80%
- **Error Rate**: < 0.1%

### Scaling Thresholds

- **CPU Usage**: Scale up at 70%
- **Memory Usage**: Scale up at 80%
- **Response Time**: Scale up if > 500ms for 5 minutes
- **Error Rate**: Alert if > 1% for 2 minutes

This configuration ensures production-ready deployment with high availability, performance monitoring, and robust error handling for the zodiac accuracy system.
