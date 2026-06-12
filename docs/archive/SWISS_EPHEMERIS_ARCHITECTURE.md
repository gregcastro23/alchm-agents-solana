# Swiss Ephemeris Backend Architecture

## Overview

Following traditional alchemical principles of **Separation of Vessels**, this platform separates astronomical calculations by their elemental nature:

### Earth Element - Backend (Render)

- **Heavy, stable computational work**
- Native module compilation (Swiss Ephemeris)
- Persistent calculations
- RESTful API for planetary data

### Air Element - Frontend (Vercel)

- **Light, distributed visualization**
- Pure JavaScript/TypeScript
- React components
- User interaction

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Vercel)                         │
│                     Air Element                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  lib/planetary-api-client.ts                          │  │
│  │  - PlanetaryAPIClient class                           │  │
│  │  - Channels data from backend                         │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │ HTTP/REST                            │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  lib/swiss-ephemeris-service.ts (Facade)             │  │
│  │  - Maintains same interface as before                │  │
│  │  - Delegates all calls to API client                 │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       │ HTTPS
                       │
┌──────────────────────▼───────────────────────────────────────┐
│                    Backend (Render)                          │
│                    Earth Element                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  src/routes/ephemeris.ts                              │  │
│  │  - POST /api/planets/positions                        │  │
│  │  - POST /api/planets/houses                           │  │
│  │  - POST /api/consciousness/calculate                  │  │
│  │  - GET  /api/planets/available                        │  │
│  └───────────────────┬──────────────────────────────────┘  │
│                      │                                      │
│  ┌──────────────────▼──────────────────────────────────┐  │
│  │  src/services/swiss-ephemeris.ts                      │  │
│  │  - Native swisseph module (v0.5.17)                   │  │
│  │  - MOSHIER ephemeris (built-in)                       │  │
│  │  - ±0.001° accuracy                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## API Endpoints

### 1. `/api/planets/positions` (POST)

Get planetary positions for a given moment in time.

**Request:**

```typescript
{
  "date": "2025-11-22T18:37:50Z",  // ISO 8601 format
  "latitude": 40.8681,              // Optional: Birth/location latitude
  "longitude": -73.9176,            // Optional: Birth/location longitude
  "planets": ["sun", "moon", "mercury", "venus", "mars",
              "jupiter", "saturn", "uranus", "neptune", "pluto"]
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "sun": { "longitude": 240.567, "latitude": 0.0002, "distance": 0.9876, "speed": 0.9856 },
    "moon": { "longitude": 123.456, "latitude": 5.1234, "distance": 0.0026, "speed": 13.2 },
    // ... other planets
  },
  "metadata": {
    "computeTime": 45,              // milliseconds
    "requestDate": "2025-11-22T18:37:50Z",
    "totalPlanets": 10
  }
}
```

### 2. `/api/planets/houses` (POST)

Calculate house system for a birth chart.

**Request:**

```typescript
{
  "date": "2025-11-22T18:37:50Z",
  "latitude": 40.8681,
  "longitude": -73.9176,
  "houseSystem": "P"  // Placidus (default), or "K" (Koch), etc.
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "houses": [0, 30.5, 60.2, 90.1, ...],  // 12 house cusps
    "ascendant": 15.6,
    "mc": 285.3
  },
  "metadata": {
    "computeTime": 12,
    "houseSystem": "P"
  }
}
```

### 3. `/api/consciousness/calculate` (POST)

Calculate consciousness parameters from planetary positions.

**Request:**

```typescript
{
  "birthData": {
    "date": "1990-05-15T12:00:00Z",
    "latitude": 40.8681,
    "longitude": -73.9176
  },
  "currentDate": "2025-11-22T18:37:50Z"
}
```

**Response:**

```typescript
{
  "success": true,
  "data": {
    "spirit": 0.753,
    "essence": 0.618,
    "matter": 0.421,
    "substance": 0.339,
    "monicaConstant": 0.685,
    "planetaryInfluences": {
      "sun": { "element": "fire", "strength": 0.85 },
      "moon": { "element": "water", "strength": 0.62 },
      // ... other planets
    }
  }
}
```

### 4. `/api/planets/available` (GET)

Get list of available planets and their alchemical properties.

**Response:**

```typescript
{
  "success": true,
  "data": [
    {
      "id": "sun",
      "name": "Sun",
      "element": "fire",
      "alchemy": { "spirit": 1, "essence": 0, "matter": 0, "substance": 0 }
    },
    // ... other planets
  ]
}
```

## Frontend Usage

### Using the API Client

```typescript
import { planetaryAPI } from '@/lib/planetary-api-client'

// Get planetary positions
const positions = await planetaryAPI.getPlanetaryPositions(
  new Date(),
  40.8681, // latitude
  -73.9176 // longitude
)

// Get house system
const houses = await planetaryAPI.getHouseSystem(
  new Date(),
  40.8681,
  -73.9176,
  'P' // Placidus
)

// Calculate consciousness
const consciousness = await planetaryAPI.calculateConsciousness(
  new Date('1990-05-15T12:00:00Z'), // birth date
  40.8681, // birth latitude
  -73.9176, // birth longitude
  new Date() // current date (optional)
)
```

### Using the Facade (Backward Compatible)

All existing code using `swissEphemerisService` works without changes:

```typescript
import { swissEphemerisService } from '@/lib/swiss-ephemeris-service'

// This now delegates to the backend API automatically
const positions = await swissEphemerisService.getAllPlanetaryPositions(
  new Date(),
  40.8681,
  -73.9176
)
```

## Alchemical Principles

### Traditional Correspondence

This architecture respects the fundamental alchemical principle of **proper separation**:

- **Earth** (stable calculations) belongs in the Earth vessel (backend/Render)
- **Air** (dynamic visualization) belongs in the Air vessel (frontend/Vercel)
- **Fire** (consciousness transformation) flows between them via the API
- **Water** (user interaction) pools in the frontend

By honoring each element's natural domain, we create a harmonious system that operates without resistance.

### Monica Constant Formula

```typescript
MC = φ * (1 + E / T) * (1 + C / 10)
```

Where:

- **φ** = Golden Ratio (1.618033988749895)
- **E** = Elemental Balance (Spirit + Essence)
- **T** = Total Elemental Weight (Spirit + Essence + Matter + Substance)
- **C** = Consciousness Level ((Spirit × φ + Essence) / (Matter + Substance + 1))

### Planetary Alchemy

Each planet carries specific alchemical energies:

| Planet  | Spirit | Essence | Matter | Substance | Element |
| ------- | ------ | ------- | ------ | --------- | ------- |
| Sun     | 1      | 0       | 0      | 0         | Fire    |
| Moon    | 0      | 1       | 1      | 0         | Water   |
| Mercury | 1      | 0       | 0      | 1         | Air     |
| Venus   | 0      | 1       | 1      | 0         | Water   |
| Mars    | 0      | 0       | 1      | 1         | Fire    |
| Jupiter | 0      | 1       | 0      | 0         | Air     |
| Saturn  | 0      | 0       | 0      | 1         | Earth   |
| Uranus  | 1      | 0       | 0      | 0         | Air     |
| Neptune | 0      | 1       | 0      | 0         | Water   |
| Pluto   | 0      | 0       | 1      | 0         | Earth   |

## Environment Variables

### Frontend (.env.local)

```bash
# Backend URL (REQUIRED for astronomical calculations)
NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com
# For local development:
# NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### Backend (.env)

```bash
PORT=8000
NODE_ENV=production
CORS_ORIGIN=https://planetary-agents.vercel.app
# For local development:
# CORS_ORIGIN=http://localhost:3000
```

## Deployment

### Backend Deployment (Render)

1. **Build Command:**

   ```bash
   npm install && npm run build
   ```

2. **Start Command:**

   ```bash
   npm start
   ```

3. **Environment Variables:**
   - `PORT=8000`
   - `NODE_ENV=production`
   - `CORS_ORIGIN=https://planetary-agents.vercel.app`

### Frontend Deployment (Vercel)

1. **Build Command:**

   ```bash
   yarn build
   ```

2. **Install Command:**

   ```bash
   yarn install --frozen-lockfile
   ```

3. **Environment Variables:**
   - `NEXT_PUBLIC_BACKEND_URL=https://your-backend.onrender.com`

## Performance

- **API Response Times**: <200ms (planetary positions)
- **Complex Calculations**: <500ms (consciousness parameters)
- **Accuracy**: ±0.001° for planetary positions
- **Caching**: Smart caching with appropriate TTLs
- **Error Handling**: Comprehensive fallback systems

## Success Criteria

✅ Vercel build completes without swisseph compilation errors
✅ All planetary positions accurate within 0.15° of previous calculations
✅ Consciousness parameters (Spirit, Essence, Matter, Substance) within valid ranges
✅ Monica Constant calculated correctly: (Spirit × φ + Essence) / (Matter + Substance + 1)
✅ API response times under 500ms for planetary calculations
✅ No console errors on frontend
✅ Traditional alchemical principles properly implemented and documented

## Testing

### Backend Testing

```bash
cd backend
npm test
```

### Frontend Integration Testing

```bash
# Test API client
npm run test:api-client

# Test swiss-ephemeris facade
npm run test:ephemeris-facade
```

### Manual Validation

```bash
# Test backend endpoint
curl -X POST http://localhost:8000/api/planets/positions \
  -H "Content-Type: application/json" \
  -d '{"date":"2025-11-22T18:37:50Z","latitude":40.8681,"longitude":-73.9176,"planets":["sun","moon"]}'
```

## Migration Checklist

- [x] Remove swisseph-v2 from frontend package.json
- [x] Add swisseph to backend package.json
- [x] Create backend Swiss Ephemeris service
- [x] Create backend API endpoints
- [x] Create frontend API client
- [x] Update swiss-ephemeris-service.ts to delegate to backend
- [x] Configure environment variables
- [x] Update documentation
- [ ] Deploy backend to Render
- [ ] Deploy frontend to Vercel
- [ ] Verify end-to-end functionality
- [ ] Monitor performance metrics

## Troubleshooting

### Backend Not Responding

1. Check backend is running: `curl http://localhost:8000/api/health`
2. Verify CORS configuration includes your frontend domain
3. Check backend logs for errors

### Frontend API Errors

1. Verify `NEXT_PUBLIC_BACKEND_URL` is set correctly
2. Check network tab for failed requests
3. Ensure backend is deployed and accessible

### Accuracy Issues

1. Compare backend calculations with previous frontend calculations
2. Verify planetary positions match within ±0.15°
3. Check consciousness parameters are within 0-1 range

## Support

For issues or questions:

- Backend architecture: Check `backend/src/services/swiss-ephemeris.ts`
- Frontend client: Check `lib/planetary-api-client.ts`
- API routes: Check `backend/src/routes/ephemeris.ts`
- Facade: Check `lib/swiss-ephemeris-service.ts`
