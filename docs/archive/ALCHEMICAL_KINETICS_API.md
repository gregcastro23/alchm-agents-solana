# Alchemical Kinetics API Documentation

## Overview

The Alchemical Kinetics API provides backend endpoints for calculating the **rate of change** and **momentum** of consciousness evolution based on classical alchemical principles. These formulas work on top of our core alchemizer engine implementing:

- **Elemental Velocity (Celeritas)** - Mercury Principle: Rate of Transformation
- **Elemental Momentum (Impetus)** - Mars + Saturn Synthesis: Sustained Force of Change
- **Elemental Force (Vis)** - Classical Force Principle: Acceleration and Resistance
- **Flow States** - Jupiter (Expansion) and Saturn (Contraction) Principles
- **Resonance Fields** - Venus + Neptune Principle: Harmonic and Discord
- **Temporal Pressure** - Sun + Moon Synthesis: Solar and Lunar Rhythms

## Base URL

```
Production: https://your-backend.onrender.com
Development: http://localhost:8000
```

## Endpoints

### 1. Calculate Alchemical Kinetics

Calculate complete alchemical kinetics for a given consciousness state.

**Endpoint:** `POST /api/kinetics/alchemical`

**Request Body:**

```json
{
  "current": {
    "spirit": 0.7,
    "essence": 0.6,
    "matter": 0.5,
    "substance": 0.4,
    "elementals": {
      "Fire": 6.5,
      "Water": 5.2,
      "Air": 7.1,
      "Earth": 4.8
    },
    "timestamp": "2025-01-15T12:00:00Z"
  },
  "previous": {
    "spirit": 0.6,
    "essence": 0.5,
    "matter": 0.4,
    "substance": 0.3,
    "elementals": {
      "Fire": 5.5,
      "Water": 4.2,
      "Air": 6.1,
      "Earth": 3.8
    },
    "timestamp": "2025-01-15T11:00:00Z"
  },
  "location": {
    "lat": 40.7128,
    "lon": -74.006
  }
}
```

**Parameters:**

- `current` (required): Current alchemical state
  - `spirit`, `essence`, `matter`, `substance`: 0-1 range
  - `elementals`: Fire, Water, Air, Earth values (typically 0-10 range)
  - `timestamp`: ISO 8601 timestamp
- `previous` (optional): Previous state for velocity/force calculations
- `location` (required): Latitude and longitude for planetary calculations

**Response:**

```json
{
  "success": true,
  "data": {
    "velocity": {
      "Fire": 1.0,
      "Water": 1.0,
      "Air": 1.0,
      "Earth": 1.0,
      "magnitude": 2.0
    },
    "momentum": {
      "Fire": 6.5,
      "Water": 5.2,
      "Air": 7.1,
      "Earth": 4.8,
      "magnitude": 12.35
    },
    "force": {
      "Fire": 0.5,
      "Water": 0.4,
      "Air": 0.6,
      "Earth": 0.3,
      "magnitude": 0.95,
      "type": "accelerating"
    },
    "flowState": {
      "expansion": 0.8,
      "contraction": 0.1,
      "balance": 0.9,
      "type": "expanding",
      "description": "Jupiter-dominated expansion - consciousness growing and diversifying"
    },
    "resonance": {
      "harmonic": 0.85,
      "discord": 0.15,
      "purity": 0.85,
      "quality": "pure"
    },
    "temporalPressure": {
      "solarity": 0.7,
      "lunarity": 0.3,
      "pressure": 0.4,
      "rhythm": "diurnal"
    },
    "metadata": {
      "timestamp": "2025-01-15T12:00:00Z",
      "previousTimestamp": "2025-01-15T11:00:00Z",
      "timeInterval": 1.0,
      "planetaryHour": "Sun"
    }
  },
  "computeTimeMs": 45,
  "metadata": {
    "location": { "lat": 40.7128, "lon": -74.006 },
    "timestamp": "2025-01-15T12:00:00Z",
    "hasPreviousState": true,
    "planetaryHour": "Sun",
    "forceType": "accelerating",
    "flowType": "expanding",
    "resonanceQuality": "pure",
    "temporalRhythm": "diurnal"
  }
}
```

**Validation Rules:**

- All numeric values must be valid numbers
- Timestamp must be valid ISO 8601 format
- Latitude: -90 to 90
- Longitude: -180 to 180

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Validation failed
- `503 Service Unavailable`: Kinetics backend disabled

---

### 2. Calculate Kinetics Timeline

Calculate alchemical kinetics over a time range.

**Endpoint:** `POST /api/kinetics/alchemical-timeline`

**Request Body:**

```json
{
  "startDate": "2025-01-15T00:00:00Z",
  "endDate": "2025-01-15T23:59:59Z",
  "location": {
    "lat": 40.7128,
    "lon": -74.006
  },
  "intervalHours": 1
}
```

**Parameters:**

- `startDate` (required): ISO 8601 start timestamp
- `endDate` (required): ISO 8601 end timestamp (max 7 days from start)
- `location` (required): Latitude and longitude
- `intervalHours` (optional): Hours between data points (1-24, default: 1)

**Response:**

```json
{
  "success": true,
  "data": [
    {
      "velocity": { "Fire": 1.0, "Water": 0.8, "Air": 1.2, "Earth": 0.9, "magnitude": 2.1 },
      "momentum": { "Fire": 6.0, "Water": 4.8, "Air": 7.2, "Earth": 5.4, "magnitude": 12.3 },
      "force": {
        "Fire": 0.3,
        "Water": 0.2,
        "Air": 0.4,
        "Earth": 0.25,
        "magnitude": 0.65,
        "type": "accelerating"
      },
      "flowState": {
        "expansion": 0.7,
        "contraction": 0.2,
        "balance": 0.8,
        "type": "expanding",
        "description": "..."
      },
      "resonance": { "harmonic": 0.8, "discord": 0.2, "purity": 0.8, "quality": "pure" },
      "temporalPressure": {
        "solarity": 0.1,
        "lunarity": 0.9,
        "pressure": 0.8,
        "rhythm": "nocturnal"
      },
      "metadata": {
        "timestamp": "2025-01-15T00:00:00Z",
        "previousTimestamp": null,
        "timeInterval": 1,
        "planetaryHour": "Moon"
      }
    }
    // ... more data points
  ],
  "computeTimeMs": 234,
  "cacheHit": false,
  "metadata": {
    "dataPoints": 24,
    "startDate": "2025-01-15T00:00:00Z",
    "endDate": "2025-01-15T23:59:59Z",
    "intervalHours": 1,
    "location": { "lat": 40.7128, "lon": -74.006 },
    "statistics": {
      "averageVelocity": 1.85,
      "averageMomentum": 11.2,
      "averageForce": 0.55,
      "flowStateDistribution": {
        "expanding": 12,
        "contracting": 8,
        "balanced": 4
      }
    }
  }
}
```

**Validation Rules:**

- Date range cannot exceed 7 days (168 hours)
- `endDate` must be after `startDate`
- `intervalHours` must be 1-24

**Caching:**

- Results cached for 5 minutes
- Cache key includes all request parameters

**Status Codes:**

- `200 OK`: Success
- `400 Bad Request`: Validation failed or invalid date range
- `503 Service Unavailable`: Kinetics backend disabled

---

### 3. Get Kinetics Status

Get system status and available features.

**Endpoint:** `GET /api/kinetics/status`

**Response:**

```json
{
  "success": true,
  "data": {
    "system": "online",
    "version": "3.0.0",
    "features": {
      "enhanced": true,
      "groupDynamics": true,
      "tokenMetrics": true,
      "alchemicalKinetics": true
    },
    "capabilities": [
      "Enhanced kinetics with agent optimization",
      "Group harmony calculations",
      "Token rate and rarity dynamics",
      "Power prediction and resonance mapping",
      "Alchemical kinetics: Velocity, Momentum, Force",
      "Flow states: Expansion (Jupiter) and Contraction (Saturn)",
      "Resonance fields: Harmonic and Discord calculations",
      "Temporal pressure: Solar and Lunar rhythms"
    ]
  },
  "timestamp": "2025-01-15T12:00:00Z"
}
```

---

## Formulas Reference

### 1. Elemental Velocity (Celeritas)

**Mercury Principle - Rate of Transformation**

```typescript
velocity[element] = (current[element] - previous[element]) / timeInterval
modifiedVelocity = velocity * getPlanetaryVelocityModifier(planetaryHour, element)
```

**Planetary Modifiers:**

- Mercury hours: +10% global boost
- Fire: +20% during Sun/Mars hours
- Water: +15% during Moon/Venus hours
- Air: +15% during Mercury hours
- Earth: +10% during Saturn hours

### 2. Elemental Momentum (Impetus)

**Mars + Saturn Synthesis - Sustained Force**

```typescript
momentum[element] = current[element] * velocity[element]
modifiedMomentum = momentum * getPlanetaryMomentumModifier(planetaryHour)
```

**Planetary Modifiers:**

- Mars/Saturn hours: +15% momentum boost

### 3. Elemental Force (Vis)

**Classical Force Principle**

```typescript
force[element] = (currentMomentum[element] - previousMomentum[element]) / timeInterval
modifiedForce = force * getPlanetaryForceModifier(planetaryHour)

// Force classification:
if (forceMagnitude > 0.1) forceType = 'accelerating'
else if (forceMagnitude < -0.1) forceType = 'decelerating'
else forceType = 'sustained'
```

### 4. Flow States

**Jupiter (Expansion) vs Saturn (Contraction)**

```typescript
totalChange = (currentTotal - previousTotal) / timeInterval

if (totalChange > 0.05)
  type = 'expanding' // Jupiter-dominated
else if (totalChange < -0.05)
  type = 'contracting' // Saturn-dominated
else type = 'balanced'
```

### 5. Resonance Field

**Venus + Neptune Principle**

```typescript
// Alignment between velocity and momentum
dotProduct = (velocity · momentum) / (|velocity| × |momentum|)

harmonic = max(0, dotProduct)      // Positive alignment
discord = max(0, -dotProduct)      // Negative alignment
purity = abs(dotProduct)           // Overall alignment strength

if (purity > 0.7) quality = 'pure'
else if (purity > 0.3) quality = 'mixed'
else quality = 'chaotic'
```

### 6. Temporal Pressure

**Sun (Diurnal) vs Moon (Nocturnal)**

```typescript
// Solar strength peaks at noon (12:00)
solarity = 1 - abs(hour - 12) / 12

// Lunar strength peaks at midnight (00:00)
lunarity = 1 - min(abs(hour - 0), abs(hour - 24)) / 12

pressure = abs(solarity - lunarity)

if (solarity > lunarity + 0.2) rhythm = 'diurnal'
else if (lunarity > solarity + 0.2) rhythm = 'nocturnal'
else rhythm = 'balanced'
```

---

## Frontend Client Usage

### TypeScript/JavaScript

```typescript
import AlchemicalKineticsClient from '@/lib/unified-clients/alchemical-kinetics-client'

// Create alchemical state
const currentState = AlchemicalKineticsClient.createAlchemicalState(
  0.7, // spirit
  0.6, // essence
  0.5, // matter
  0.4, // substance
  { Fire: 6.5, Water: 5.2, Air: 7.1, Earth: 4.8 }, // elementals
  new Date() // timestamp
)

// Calculate kinetics
const kinetics = await AlchemicalKineticsClient.calculateKinetics(
  currentState,
  previousState, // or null for first calculation
  { lat: 40.7128, lon: -74.006 }
)

// Analyze kinetics for insights
const analysis = AlchemicalKineticsClient.analyzeKinetics(kinetics)
console.log(analysis.summary)
console.log(analysis.insights)
console.log(analysis.recommendations)

// Calculate timeline
const timeline = await AlchemicalKineticsClient.calculateKineticsTimeline(
  '2025-01-15T00:00:00Z', // startDate
  '2025-01-15T23:59:59Z', // endDate
  { lat: 40.7128, lon: -74.006 },
  1 // intervalHours
)
```

### cURL Examples

**Calculate kinetics:**

```bash
curl -X POST http://localhost:8000/api/kinetics/alchemical \
  -H "Content-Type: application/json" \
  -d '{
    "current": {
      "spirit": 0.7,
      "essence": 0.6,
      "matter": 0.5,
      "substance": 0.4,
      "elementals": {"Fire": 6.5, "Water": 5.2, "Air": 7.1, "Earth": 4.8},
      "timestamp": "2025-01-15T12:00:00Z"
    },
    "location": {"lat": 40.7128, "lon": -74.006}
  }'
```

**Get timeline:**

```bash
curl -X POST http://localhost:8000/api/kinetics/alchemical-timeline \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-15T00:00:00Z",
    "endDate": "2025-01-15T23:59:59Z",
    "location": {"lat": 40.7128, "lon": -74.006},
    "intervalHours": 1
  }'
```

---

## Environment Configuration

Required environment variables in backend `.env`:

```bash
# Enable kinetics backend
ENABLE_KINETICS_BACKEND=true

# Cache TTL for kinetics (seconds)
KINETICS_CACHE_TTL=120

# Optional: Redis for distributed caching
REDIS_URL=redis://localhost:6379
```

---

## Rate Limiting

- **Standard endpoints**: 100 requests per 15 minutes per IP
- **Kinetics endpoints**: 10 requests per minute per IP (compute-intensive)

---

## Error Handling

All endpoints follow consistent error format:

```json
{
  "success": false,
  "error": "Validation failed",
  "details": {
    "field": "current.spirit",
    "message": "current.spirit must be numeric"
  }
}
```

**Common Error Codes:**

- `400`: Validation error or invalid input
- `429`: Rate limit exceeded
- `500`: Internal server error
- `503`: Service unavailable (backend disabled)

---

## Performance

- **Single calculation**: ~50ms average
- **Timeline (24 hours)**: ~250ms average
- **Caching**: 2 minutes for single calculations, 5 minutes for timelines
- **Max timeline range**: 7 days (168 hours)

---

## Testing

Run the test script:

```bash
cd backend
chmod +x scripts/test-alchemical-kinetics.sh
./scripts/test-alchemical-kinetics.sh
```

This will test:

1. Status endpoint
2. Single state kinetics calculation
3. Kinetics with previous state
4. Timeline calculation
5. Validation error handling

---

## Integration with Existing Systems

The Alchemical Kinetics API integrates with:

1. **Core Alchemizer** (`lib/alchemizer.ts`): Provides base alchemical values
2. **Planetary Service** (`backend/src/services/planetary-service.ts`): Provides planetary hour calculations
3. **Thermodynamics Service**: Can use kinetics for heat/entropy evolution
4. **Agent Evolution**: Tracks consciousness velocity and momentum
5. **Time Laboratory**: Visualizes kinetics over time

---

## Roadmap

### Planned Enhancements

- [ ] Agent-specific kinetics profiles
- [ ] Multi-agent resonance calculations
- [ ] Predictive kinetics modeling
- [ ] Real-time WebSocket updates
- [ ] Advanced visualization endpoints
- [ ] Historical kinetics analysis
- [ ] Aspect-driven force calculations

---

## References

- **KINETICS_FORMULAS_EXPLAINED.md**: Complete formula documentation
- **Backend Service**: `backend/src/services/alchemical-kinetics-service.ts`
- **Routes**: `backend/src/routes/kinetics.ts`
- **Frontend Client**: `lib/unified-clients/alchemical-kinetics-client.ts`

---

**Last Updated:** January 2025
**API Version:** 3.0.0
