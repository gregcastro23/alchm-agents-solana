### Enhanced Kinetics APIs (Platform-wide Activation)

All endpoints return JSON and enforce TypeScript strict types on the server.

Feature flag: set `NEXT_PUBLIC_KINETICS_BACKEND=true` to route frontend through these endpoints via `UnifiedKineticsClient`.

1. POST `/api/alchm-kinetics/enhanced`

Request:

```json
{
  "location": { "lat": 37.7749, "lon": -122.4194 },
  "options": {
    "includeAgentOptimization": true,
    "includePowerPrediction": true,
    "includeResonanceMap": false,
    "agentIds": ["galileo-galilei", "leonardo-da-vinci"]
  }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "base": {
      "power": [{ "t": "2025-09-20T00:00:00Z", "power": 0.62 }],
      "timing": { "planetaryHours": ["Sun", "Moon", "Mars"], "seasonalInfluence": "Autumn" }
    },
    "agentOptimization": {
      "recommendations": [],
      "currentConditions": { "hour": "Sun", "power": 0.62, "momentum": "sustained" }
    },
    "powerPrediction": {
      "trend": "rising",
      "confidence": 0.7,
      "nextHourPower": 0.68,
      "peakWindow": null
    }
  },
  "computeTimeMs": 42
}
```

2. POST `/api/kinetics/group`

Request:

```json
{
  "agentIds": ["galileo-galilei", "leonardo-da-vinci", "michelangelo"],
  "location": { "lat": 37.7749, "lon": -122.4194 }
}
```

Response:

```json
{
  "success": true,
  "data": {
    "harmony": 0.73,
    "powerAmplification": 1.2,
    "momentumFlow": "sustained",
    "currentPower": 0.65,
    "resonances": { "galileo-galilei": { "leonardo-da-vinci": 0.82 } }
  },
  "computeTimeMs": 35
}
```

3. POST `/api/kinetics/token`

Request:

```json
{ "baseTokenRate": 100, "baseNFTRarity": 0.3, "location": { "lat": 37.7749, "lon": -122.4194 } }
```

Response:

```json
{
  "success": true,
  "data": {
    "currentRate": 138.2,
    "baseRate": 100,
    "kineticMultiplier": 1.382,
    "velocityIndicator": "stable",
    "momentumPhase": "sustained",
    "powerLevel": 0.62,
    "nextOptimalWindow": null,
    "accumulationForecast": "Stable accumulation period - consistent generation expected",
    "solarAmplification": 1.0,
    "seasonalModifier": 1.05,
    "nftRarity": {
      "baseRarity": 0.3,
      "kineticRarity": 0.62,
      "tier": "Rare",
      "priceMultiplier": 2.5,
      "powerBoost": 0.15,
      "planetaryBoost": 0.2,
      "seasonalBoost": 0.05,
      "minting_time": "2025-09-20T12:34:56.000Z",
      "planetary_hour": "Sun"
    }
  },
  "computeTimeMs": 31
}
```

Client usage (frontend):

```ts
import { UnifiedKineticsClient } from '@/lib/kinetics-unified-client'

// Base kinetics (auto-fallback when flag disabled)
await UnifiedKineticsClient.getKinetics({
  lat,
  lon,
  date,
  includeElemental: true,
  includePlanetary: true,
  window: 3,
})

// Enhanced kinetics (requires NEXT_PUBLIC_KINETICS_BACKEND=true)
await UnifiedKineticsClient.getEnhanced({
  location: { lat, lon },
  options: { includeAgentOptimization: true, includePowerPrediction: true },
})

// Group dynamics
await UnifiedKineticsClient.getGroupDynamics({ agentIds, location: { lat, lon } })

// Token/NFT metrics
await UnifiedKineticsClient.getTokenMetrics({
  baseTokenRate,
  baseNFTRarity,
  location: { lat, lon },
})
```

Latency target: <200ms for cached/common paths. Use the unified client to progressively enable backend and fall back to existing client logic on errors.

# API Documentation Update - Natal Sigil Generation

## New Endpoint: `/api/generate-natal-sigil`

### Overview

Generates personalized runic sigils from natal chart geometry using AI-powered mystical art creation.

### Methods

#### POST `/api/generate-natal-sigil`

Generate a natal sigil from birth information or chart geometry.

**Request Body:**

```typescript
interface GenerateSigilRequest {
  birthInfo?: BirthInfo // Optional birth information
  geometry?: RuneGeometry // Optional pre-computed geometry
  style?: 'nordic' | 'celtic' | 'alchemical' | 'cosmic' // Sigil style
  patternType?: string // Specific pattern to use
  aspectFocused?: boolean // Generate from aspects vs patterns
  prompt?: string // Custom prompt override
  chartData?: any // Alternative chart data format
}
```

**Response:**

```typescript
interface GenerateSigilResponse {
  success: boolean
  sigil: NatalSigilRune // Generated sigil with metadata
  sourcePattern?: PatternConfiguration // Source pattern used
  geometry: {
    // Geometry summary
    aspectCount: number
    powerNodeCount: number
    patternCount: number
    dominantElement: string
    elementalBalance: ElementBalance
  }
  metadata: {
    // Generation metadata
    aspectCount: number
    powerNodeCount: number
    patternCount: number
    dominantPattern?: string
    dominantElement: string
    generationTime: string
    style: string
  }
}
```

**Example Request:**

```bash
curl -X POST "/api/generate-natal-sigil" \
  -H "Content-Type: application/json" \
  -d '{
    "birthInfo": {
      "name": "John Doe",
      "year": 1990,
      "month": 2,
      "day": 15,
      "hour": 14,
      "minute": 30,
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "style": "nordic"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "sigil": {
    "id": "natal-sigil-pattern-based-1703123456789",
    "name": "Nordic Natal Sigil",
    "symbol": "△",
    "element": "fire",
    "runeType": "cosmic",
    "sigilType": "pattern-based",
    "visualStyle": "nordic",
    "generatedImageUrl": "https://generated-image-url.com/sigil.png",
    "powerLevel": 87,
    "effects": [
      {
        "type": "consciousness",
        "power": 104,
        "duration": "days",
        "description": "Activates your grand-trine consciousness pattern for profound insights"
      }
    ],
    "meditationInstructions": [
      "Light a candle and place the sigil before you on stone or wood",
      "Breathe deeply and imagine yourself in an ancient Nordic forest",
      "Focus on the grand-trine energy pattern within the sigil"
    ],
    "personalizedMeaning": "Your grand-trine pattern reveals Three-fold harmony in Fire element...",
    "activationRitual": "Pass the sigil through sacred flame three times while chanting the elder runes"
  },
  "sourcePattern": {
    "type": "grand-trine",
    "planets": ["sun", "mars", "jupiter"],
    "strength": 87,
    "element": "Fire",
    "interpretation": "Three-fold harmony in Fire element..."
  },
  "geometry": {
    "aspectCount": 8,
    "powerNodeCount": 3,
    "patternCount": 2,
    "dominantElement": "Fire",
    "elementalBalance": {
      "fire": 45,
      "water": 20,
      "air": 25,
      "earth": 10
    }
  }
}
```

#### GET `/api/generate-natal-sigil`

Get service information and available options.

**Response:**

```json
{
  "service": "Natal Sigil Generator",
  "version": "1.0.0",
  "availableStyles": ["nordic", "celtic", "alchemical", "cosmic"],
  "supportedPatterns": [
    "grand-trine",
    "t-square",
    "grand-cross",
    "yod",
    "stellium",
    "mystic-rectangle",
    "kite",
    "grand-sextile",
    "cradle"
  ],
  "aspectTypes": [
    "conjunction",
    "opposition",
    "trine",
    "square",
    "sextile",
    "quincunx",
    "semisextile",
    "sesquiquadrate",
    "semisquare",
    "quintile",
    "biquintile"
  ],
  "endpoints": {
    "generate": {
      "method": "POST",
      "path": "/api/generate-natal-sigil",
      "body": "See POST documentation above"
    }
  }
}
```

### Error Responses

**400 Bad Request:**

```json
{
  "error": "Invalid birth information",
  "details": "Validation error details"
}
```

**400 Bad Request - No Patterns:**

```json
{
  "error": "No significant patterns found for sigil generation"
}
```

**500 Internal Server Error:**

```json
{
  "error": "Failed to generate natal sigil",
  "details": "Error message details"
}
```

### Input Validation

**BirthInfo Requirements:**

- `year`: Required integer (e.g., 1990)
- `month`: Required integer 0-11 (0-based, e.g., 2 for March)
- `day`: Required integer 1-31
- `hour`: Optional integer 0-23 (default: 12)
- `minute`: Optional integer 0-59 (default: 0)
- `latitude`: Optional number -90 to 90 (default: 0)
- `longitude`: Optional number -180 to 180 (default: 0)
- `name`: Optional string (default: "Subject")

**Style Options:**

- `nordic`: Angular runic strokes with stone textures
- `celtic`: Flowing knotwork with illuminated manuscript style
- `alchemical`: Geometric precision with hermetic symbols
- `cosmic`: Ethereal patterns with stellar backgrounds

### Integration Examples

#### Frontend Integration

```typescript
// React component usage
const generateSigil = async (birthData: BirthInfo, style: string) => {
  const response = await fetch('/api/generate-natal-sigil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ birthInfo: birthData, style }),
  })

  if (!response.ok) {
    throw new Error('Sigil generation failed')
  }

  return response.json()
}
```

#### Chart Integration

```typescript
// Generate from existing chart data
const generateFromChart = async (chartData: any, style: string) => {
  const response = await fetch('/api/generate-natal-sigil', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chartData, style }),
  })

  return response.json()
}
```

#### Batch Generation

```typescript
// Generate multiple styles
const generateAllStyles = async (birthInfo: BirthInfo) => {
  const styles = ['nordic', 'celtic', 'alchemical', 'cosmic']
  const promises = styles.map(style => generateSigil(birthInfo, style))

  return Promise.all(promises)
}
```

### Rate Limiting

- Maximum 10 requests per minute per IP
- Maximum 100 requests per hour per IP
- Longer generation times for complex charts (up to 30 seconds)

### Performance Notes

- Pattern-based generation: 5-15 seconds
- Aspect-focused generation: 3-8 seconds
- Batch generation: Process styles sequentially to avoid rate limits
- Image generation depends on imaginize API availability

### Dependencies

- **imaginize API**: Required for image generation
- **Chart Calculator**: For birth info processing
- **Pattern Recognition**: For sacred pattern detection
- **Geometry Extractor**: For aspect coordinate extraction

### Caching

- Generated images cached by imaginize service
- Pattern detection results cached per chart
- Geometry extraction cached for repeated requests

---

_This endpoint integrates seamlessly with the existing rune system and provides a complete solution for transforming astrological data into personalized mystical tools._
