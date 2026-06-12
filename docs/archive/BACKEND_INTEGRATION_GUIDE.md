# Backend Integration Guide

This guide explains how to integrate the new Planetary Agents Backend service with your existing React frontend.

## 🎯 Overview

The new backend service acts as a gateway between your React frontend and the existing alchm-backend, providing:

- **Server-side calculations** for planetary hours, thermodynamics, and token rates
- **Intelligent caching** with Redis and memory fallback
- **Real-time updates** via WebSocket
- **Feature flags** for progressive rollout
- **Graceful fallbacks** to existing frontend calculations

## 🚀 Quick Start

### 1. Start the Backend Service

```bash
cd backend
./scripts/start-dev.sh
```

The backend will be available at:

- **API**: http://localhost:8000
- **WebSocket**: ws://localhost:8001
- **Health Check**: http://localhost:8000/api/health

### 2. Configure Frontend Environment

Add to your frontend `.env.local`:

```env
# Backend Service URLs
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8001

# Feature Flags (enable progressively)
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=true
NEXT_PUBLIC_THERMODYNAMICS_BACKEND=true
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND=true
NEXT_PUBLIC_KINETICS_BACKEND=true
```

### 3. Install Unified Clients

The unified clients are already created in your `lib/unified-clients/` directory:

- `planetary-client.ts` - Planetary hours with fallback
- `thermodynamics-client.ts` - Thermodynamics with fallback
- `token-client.ts` - Token calculations with fallback

## 🔄 Migration Strategy

### Phase 1: Backend Setup (✅ Complete)

- Backend service deployed and running
- All API endpoints functional
- WebSocket server operational
- Caching layer active

### Phase 2: Gradual Migration

#### Step 1: Enable Planetary Hours Backend

```typescript
// Replace existing planetary hour calls
import { UnifiedPlanetaryClient } from '@/lib/unified-clients/planetary-client'

// Old way:
// const planetaryHour = await planetaryCalculator.getPlanetaryHour(date)

// New way (with automatic fallback):
const planetaryHour = await UnifiedPlanetaryClient.getCurrentPlanetaryHour({
  datetime: date,
  location: { lat, lon },
})
```

#### Step 2: Enable Thermodynamics Backend

```typescript
import { UnifiedThermodynamicsClient } from '@/lib/unified-clients/thermodynamics-client'

// Replace thermodynamics calculations
const result = await UnifiedThermodynamicsClient.calculateThermodynamics(elementalValues)
```

#### Step 3: Enable Token Calculations Backend

```typescript
import { UnifiedTokenClient } from '@/lib/unified-clients/token-client'

// Replace token rate calculations
const tokenData = await UnifiedTokenClient.calculateTokens({
  tokens: { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 },
  location: { lat, lon },
})
```

## 🎛️ Feature Flag Management

### Environment Variables

Control which calculations use the backend:

```env
# Enable/disable individual systems
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=true
NEXT_PUBLIC_THERMODYNAMICS_BACKEND=false  # Disable for testing
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND=true
NEXT_PUBLIC_KINETICS_BACKEND=true
```

### Runtime Checking

```typescript
// Check if backend is enabled
const status = UnifiedPlanetaryClient.getStatus()
console.log('Backend enabled:', status.backendEnabled)
console.log('Backend URL:', status.backendUrl)
```

## 🌐 WebSocket Integration

### Basic Connection

```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8001')

ws.onopen = () => {
  // Subscribe to planetary hours
  ws.send(
    JSON.stringify({
      type: 'subscribe',
      channel: 'planetary-hours',
      data: {
        location: { lat: 37.7749, lon: -122.4194 },
      },
    })
  )
}

ws.onmessage = event => {
  const message = JSON.parse(event.data)
  if (message.type === 'update' && message.channel === 'planetary-hours') {
    // Handle planetary hour update
    console.log('New planetary hour:', message.data)
  }
}
```

### React Hook for WebSocket

```typescript
import { useEffect, useState } from 'react'

export function usePlanetaryWebSocket(location: { lat: number; lon: number }) {
  const [planetaryHour, setPlanetaryHour] = useState(null)
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    const ws = new WebSocket(process.env.NEXT_PUBLIC_WEBSOCKET_URL!)

    ws.onopen = () => {
      setConnected(true)
      ws.send(
        JSON.stringify({
          type: 'subscribe',
          channel: 'planetary-hours',
          data: { location },
        })
      )
    }

    ws.onmessage = event => {
      const message = JSON.parse(event.data)
      if (message.type === 'update' && message.channel === 'planetary-hours') {
        setPlanetaryHour(message.data)
      }
    }

    ws.onclose = () => setConnected(false)
    ws.onerror = () => setConnected(false)

    return () => ws.close()
  }, [location])

  return { planetaryHour, connected }
}
```

## 🔧 Component Updates

### Planetary Hours Component

```typescript
// Before
import { PlanetaryHourCalculator } from '@/lib/core-energy-rules'

// After
import { UnifiedPlanetaryClient } from '@/lib/unified-clients/planetary-client'
import { usePlanetaryWebSocket } from '@/hooks/usePlanetaryWebSocket'

export function PlanetaryHourDisplay({ location }: { location: { lat: number; lon: number } }) {
  const [planetaryHour, setPlanetaryHour] = useState(null)
  const { planetaryHour: livePlanetaryHour } = usePlanetaryWebSocket(location)

  useEffect(() => {
    // Initial load
    UnifiedPlanetaryClient.getCurrentPlanetaryHour({
      location,
      datetime: new Date()
    }).then(setPlanetaryHour)
  }, [location])

  // Use live data if available, otherwise use initial data
  const currentHour = livePlanetaryHour || planetaryHour

  return (
    <div>
      <h3>Current Planetary Hour</h3>
      <p>Planet: {currentHour?.planet}</p>
      <p>Type: {currentHour?.dayType}</p>
      <p>Next Transition: {currentHour?.nextTransition?.toLocaleTimeString()}</p>
    </div>
  )
}
```

### Token Rates Component

```typescript
import { UnifiedTokenClient } from '@/lib/unified-clients/token-client'

export function TokenRatesDisplay({ location }: { location: { lat: number; lon: number } }) {
  const [tokenData, setTokenData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTokens = async () => {
      setLoading(true)
      try {
        const data = await UnifiedTokenClient.calculateTokens({
          tokens: { Spirit: 1.0, Essence: 0.8, Matter: 0.6, Substance: 0.4 },
          location
        })
        setTokenData(data)
      } catch (error) {
        console.error('Token calculation failed:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchTokens()
    const interval = setInterval(fetchTokens, 5 * 60 * 1000) // Update every 5 minutes
    return () => clearInterval(interval)
  }, [location])

  if (loading) return <div>Loading token rates...</div>

  return (
    <div>
      <h3>Token Rates</h3>
      {tokenData && (
        <div>
          <p>Spirit: {tokenData.rates.Spirit.toFixed(3)}</p>
          <p>Essence: {tokenData.rates.Essence.toFixed(3)}</p>
          <p>Matter: {tokenData.rates.Matter.toFixed(3)}</p>
          <p>Substance: {tokenData.rates.Substance.toFixed(3)}</p>
          <p>Market Phase: {tokenData.metadata.marketPhase}</p>
        </div>
      )}
    </div>
  )
}
```

## 📊 Performance Monitoring

### Response Time Tracking

```typescript
// Add performance monitoring to API calls
const startTime = performance.now()
const result = await UnifiedPlanetaryClient.getCurrentPlanetaryHour({ location })
const endTime = performance.now()

console.log(`Planetary hour calculation took ${endTime - startTime}ms`)
```

### Health Check Integration

```typescript
// Monitor backend health
export async function checkBackendHealth() {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/health`)
    const health = await response.json()

    return {
      healthy: health.status === 'healthy',
      services: health.services,
      responseTime: health.responseTime,
    }
  } catch (error) {
    return { healthy: false, error: error.message }
  }
}
```

## 🚨 Error Handling

### Graceful Fallbacks

The unified clients automatically fall back to frontend calculations when the backend is unavailable:

```typescript
// This automatically falls back to frontend calculation if backend fails
const result = await UnifiedThermodynamicsClient.calculateThermodynamics(values)

// You can also check the fallback status
const status = UnifiedThermodynamicsClient.getStatus()
if (!status.backendEnabled) {
  console.log('Using frontend fallback for thermodynamics')
}
```

### Error Boundaries

```typescript
export function BackendErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      fallback={<div>Backend service temporarily unavailable. Using local calculations.</div>}
      onError={(error) => {
        console.error('Backend service error:', error)
        // Log to your error tracking service
      }}
    >
      {children}
    </ErrorBoundary>
  )
}
```

## 🔄 Rollback Strategy

If you need to disable the backend service:

### 1. Environment Variables

```env
# Disable all backend features
NEXT_PUBLIC_PLANETARY_HOURS_BACKEND=false
NEXT_PUBLIC_THERMODYNAMICS_BACKEND=false
NEXT_PUBLIC_TOKEN_CALCULATIONS_BACKEND=false
NEXT_PUBLIC_KINETICS_BACKEND=false
```

### 2. Runtime Disable

```typescript
// Temporarily disable backend in code
process.env.NEXT_PUBLIC_PLANETARY_HOURS_BACKEND = 'false'
```

### 3. Complete Rollback

Simply stop the backend service - all unified clients will automatically fall back to frontend calculations.

## 📈 Monitoring & Observability

### Key Metrics to Track

1. **Response Times**
   - Target: <200ms for all endpoints
   - Monitor: 95th percentile response times

2. **Cache Hit Rates**
   - Target: >80% cache hit rate
   - Monitor: Cache performance by endpoint

3. **Error Rates**
   - Target: <1% error rate
   - Monitor: Backend service availability

4. **Fallback Usage**
   - Track when frontend fallbacks are used
   - Monitor backend service reliability

### Dashboard Queries

```typescript
// Example monitoring queries
const metrics = {
  responseTime: 'avg(api_response_time_seconds) by (endpoint)',
  cacheHitRate: 'cache_hits / (cache_hits + cache_misses) * 100',
  errorRate: 'api_errors / api_requests * 100',
  fallbackUsage: 'frontend_fallback_count / total_requests * 100',
}
```

## 🎯 Best Practices

### 1. Progressive Enhancement

- Start with one system (e.g., planetary hours)
- Monitor performance and stability
- Gradually enable other systems

### 2. Caching Strategy

- Use appropriate TTL values for different data types
- Monitor cache hit rates
- Implement cache warming for critical data

### 3. Error Handling

- Always implement fallbacks
- Log errors for monitoring
- Provide user feedback for service issues

### 4. Performance Optimization

- Use WebSocket for real-time data
- Implement request coalescing
- Monitor and optimize slow endpoints

### 5. Security

- Validate all inputs
- Implement rate limiting
- Use CORS appropriately

## 🆘 Troubleshooting

### Backend Service Won't Start

```bash
# Check logs
cd backend
tail -f logs/combined.log

# Check dependencies
yarn install

# Check environment
cat .env
```

### Frontend Can't Connect to Backend

```typescript
// Test backend connectivity
fetch('http://localhost:8000/api/health')
  .then(response => response.json())
  .then(data => console.log('Backend health:', data))
  .catch(error => console.error('Backend connection failed:', error))
```

### WebSocket Connection Issues

```typescript
// Debug WebSocket connection
const ws = new WebSocket('ws://localhost:8001')
ws.onopen = () => console.log('WebSocket connected')
ws.onerror = error => console.error('WebSocket error:', error)
ws.onclose = event => console.log('WebSocket closed:', event.code, event.reason)
```

### Performance Issues

```bash
# Check backend performance
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:8000/api/health"

# Monitor resource usage
docker stats planetary-backend
```

## 📞 Support

- **Backend Logs**: `backend/logs/combined.log`
- **Health Check**: `http://localhost:8000/api/health/detailed`
- **WebSocket Status**: Check browser developer tools Network tab
- **Feature Flags**: Verify environment variables in both frontend and backend
