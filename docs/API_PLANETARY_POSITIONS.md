# Planetary Positions API

## Overview

The Planetary Positions API provides accurate, real-time planetary position calculations using Swiss Ephemeris. This API is CORS-enabled for use from `alchm.kitchen` and other authorized domains.

## Base URL

- **Production**: `https://your-production-domain.com/api/planetary-positions`
- **Development**: `http://localhost:3001/api/planetary-positions`

## CORS Configuration

The following origins are whitelisted:

- `https://alchm.kitchen`
- `https://www.alchm.kitchen`
- `http://localhost:3000`
- `http://localhost:3001`
- `http://localhost:3002`

## Endpoints

### GET `/api/planetary-positions`

Fetch current or historical planetary positions.

#### Query Parameters

| Parameter        | Type                                      | Default      | Description                               |
| ---------------- | ----------------------------------------- | ------------ | ----------------------------------------- |
| `date`           | ISO 8601 string                           | Current time | The date/time for position calculation    |
| `accuracy`       | `high` \| `medium` \| `low` \| `fallback` | `high`       | Accuracy level for calculations           |
| `includeAlchemy` | boolean                                   | `false`      | Include alchemical quantities in response |
| `useCache`       | boolean                                   | `true`       | Use cached results if available           |

#### Example Request

```javascript
// From alchm.kitchen
const response = await fetch('https://your-domain.com/api/planetary-positions?includeAlchemy=true')
const data = await response.json()
console.log(data)
```

```bash
# cURL example
curl "https://your-domain.com/api/planetary-positions?includeAlchemy=true"
```

#### Response Format

```typescript
{
  timestamp: string;              // ISO 8601 timestamp
  planetaryPositions: Array<{
    planet: string;               // Planet name (Sun, Moon, Mercury, etc.)
    sign: string;                 // Zodiac sign (Aries, Taurus, etc.)
    degree: number;               // Degree within sign (0-29.9999)
    longitude?: number;           // Absolute longitude (0-360)
    retrograde: boolean;          // Retrograde status
    speed?: number;               // Degrees per day
  }>;
  alchmQuantities?: {             // Only if includeAlchemy=true
    spirit: number;
    essence: number;
    matter: number;
    substance: number;
    Heat: number;
    Entropy: number;
    Reactivity: number;
    Energy: number;
  };
  monicaConstant?: number;        // Only if includeAlchemy=true
  source: 'external-api' | 'enhanced-calculator' | 'basic-transits' | 'static-fallback';
  accuracy: 'high' | 'medium' | 'low' | 'fallback';
  cached: boolean;
  cacheAge?: number;              // Milliseconds since cached
}
```

#### Response Headers

- `Access-Control-Allow-Origin`: Your origin (e.g., `https://alchm.kitchen`)
- `Cache-Control`: Caching policy based on accuracy level
- `X-Source`: Calculation method used
- `X-Accuracy`: Accuracy level
- `X-Cached`: Whether response was cached

### POST `/api/planetary-positions`

Same as GET but accepts parameters in request body.

#### Request Body

```typescript
{
  date?: string;                  // ISO 8601 date string
  accuracy?: 'high' | 'medium' | 'low' | 'fallback';
  includeAlchemy?: boolean;
  useCache?: boolean;
}
```

#### Example Request

```javascript
const response = await fetch('https://your-domain.com/api/planetary-positions', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    date: '2025-11-21T00:00:00Z',
    includeAlchemy: true,
    accuracy: 'high',
  }),
})

const data = await response.json()
```

## Usage Examples

### Basic Usage (JavaScript/TypeScript)

```typescript
// Fetch current planetary positions
async function getCurrentPositions() {
  try {
    const response = await fetch('https://your-domain.com/api/planetary-positions')

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()

    // Access planetary positions
    data.planetaryPositions.forEach(planet => {
      console.log(`${planet.planet}: ${planet.sign} ${planet.degree.toFixed(2)}°`)
      if (planet.retrograde) {
        console.log(`  (Retrograde)`)
      }
    })

    return data
  } catch (error) {
    console.error('Error fetching planetary positions:', error)
    throw error
  }
}

// Fetch positions with alchemy data
async function getPositionsWithAlchemy() {
  const response = await fetch(
    'https://your-domain.com/api/planetary-positions?includeAlchemy=true'
  )
  const data = await response.json()

  console.log('Alchemical Quantities:', data.alchmQuantities)
  console.log('Monica Constant:', data.monicaConstant)

  return data
}

// Fetch positions for a specific date
async function getHistoricalPositions(dateString: string) {
  const response = await fetch('https://your-domain.com/api/planetary-positions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      date: dateString,
      accuracy: 'high',
    }),
  })

  return await response.json()
}
```

### React Hook Example

```typescript
import { useState, useEffect } from 'react';

interface PlanetaryPosition {
  planet: string;
  sign: string;
  degree: number;
  retrograde: boolean;
  speed?: number;
}

interface PlanetaryData {
  timestamp: string;
  planetaryPositions: PlanetaryPosition[];
  source: string;
  accuracy: string;
  cached: boolean;
}

export function usePlanetaryPositions(includeAlchemy = false) {
  const [data, setData] = useState<PlanetaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function fetchPositions() {
      try {
        setLoading(true);
        const url = `https://your-domain.com/api/planetary-positions?includeAlchemy=${includeAlchemy}`;
        const response = await fetch(url);

        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.statusText}`);
        }

        const result = await response.json();
        setData(result);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setLoading(false);
      }
    }

    fetchPositions();

    // Refresh every 5 minutes (positions don't change quickly)
    const interval = setInterval(fetchPositions, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [includeAlchemy]);

  return { data, loading, error };
}

// Usage in component
function PlanetaryDisplay() {
  const { data, loading, error } = usePlanetaryPositions(true);

  if (loading) return <div>Loading planetary positions...</div>;
  if (error) return <div>Error: {error.message}</div>;
  if (!data) return null;

  return (
    <div>
      <h2>Current Planetary Positions</h2>
      <p>As of: {new Date(data.timestamp).toLocaleString()}</p>
      <p>Source: {data.source} | Accuracy: {data.accuracy}</p>

      <ul>
        {data.planetaryPositions.map(planet => (
          <li key={planet.planet}>
            {planet.planet}: {planet.sign} {planet.degree.toFixed(2)}°
            {planet.retrograde && ' ℞'}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div v-if="loading">Loading...</div>
  <div v-else-if="error">Error: {{ error.message }}</div>
  <div v-else>
    <h2>Planetary Positions</h2>
    <div v-for="planet in positions" :key="planet.planet">
      {{ planet.planet }}: {{ planet.sign }} {{ planet.degree.toFixed(2) }}°
      <span v-if="planet.retrograde">℞</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const positions = ref([])
const loading = ref(true)
const error = ref(null)

onMounted(async () => {
  try {
    const response = await fetch('https://your-domain.com/api/planetary-positions')
    const data = await response.json()
    positions.value = data.planetaryPositions
  } catch (err) {
    error.value = err
  } finally {
    loading.value = false
  }
})
</script>
```

## Caching Strategy

The API uses intelligent caching based on accuracy level:

| Accuracy   | Cache Duration | Use Case               |
| ---------- | -------------- | ---------------------- |
| `high`     | 5 minutes      | Real-time applications |
| `medium`   | 15 minutes     | General purpose        |
| `low`      | 1 hour         | Historical analysis    |
| `fallback` | 24 hours       | Backup calculations    |

## Calculation Sources (Fallback Hierarchy)

1. **Swiss Ephemeris** (highest accuracy) - Professional astronomical calculations
2. **Enhanced Calculator** (high accuracy) - Advanced algorithms
3. **Basic Transit Calculations** (medium accuracy) - Simplified calculations
4. **Static Positions** (low accuracy) - Last resort fallback

## Rate Limiting

- No rate limiting currently implemented
- Recommended: Cache responses client-side for 5 minutes
- Planetary positions change slowly - frequent polling is unnecessary

## Error Handling

### Error Response Format

```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### Common Errors

| Status Code | Meaning             | Solution                                           |
| ----------- | ------------------- | -------------------------------------------------- |
| 400         | Invalid date format | Use ISO 8601 format (e.g., `2025-11-21T00:00:00Z`) |
| 500         | Calculation failure | Retry with `accuracy=medium` or `accuracy=low`     |

### Error Handling Example

```typescript
async function fetchWithErrorHandling() {
  try {
    const response = await fetch('https://your-domain.com/api/planetary-positions')

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.message || 'Failed to fetch positions')
    }

    return await response.json()
  } catch (error) {
    console.error('API Error:', error)

    // Fallback to lower accuracy
    try {
      const fallbackResponse = await fetch(
        'https://your-domain.com/api/planetary-positions?accuracy=medium'
      )
      return await fallbackResponse.json()
    } catch (fallbackError) {
      console.error('Fallback failed:', fallbackError)
      throw fallbackError
    }
  }
}
```

## Sample Response

```json
{
  "timestamp": "2025-11-21T04:24:35.453Z",
  "planetaryPositions": [
    {
      "planet": "Sun",
      "sign": "Scorpio",
      "degree": 29.108324382468254,
      "longitude": 239.1083243824682,
      "retrograde": false,
      "speed": 1.0101019063443184
    },
    {
      "planet": "Moon",
      "sign": "Sagittarius",
      "degree": 8.893827017262424,
      "longitude": 248.8938270172624,
      "retrograde": false,
      "speed": 11.884452519729845
    },
    {
      "planet": "Mercury",
      "sign": "Scorpio",
      "degree": 27.236935012013646,
      "longitude": 237.23693501201367,
      "retrograde": true,
      "speed": -1.3385816742862926
    }
  ],
  "source": "external-api",
  "accuracy": "high",
  "cached": true,
  "cacheAge": 3499
}
```

## Support

For issues or questions, please contact the Planetary Agents development team or open an issue on the repository.
