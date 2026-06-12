# Site Metrics Tracking System

## Overview

The Site Metrics Tracking System provides comprehensive monitoring and analytics for the Planetary Agents application. It structures all alchemical quantities as **tags** and **metadata** where each key in the alchm info becomes a metadata key with its corresponding value.

## Key Features

### 🏷️ Tags Structure

- **Automatic categorization** of alchemical data
- **Dynamic tag generation** based on current astrological state
- **Filterable analytics** for easy data exploration
- **Consistent naming convention** for all tags

### 📋 Metadata Structure

- **Flattened data structure** using underscore notation
- **All alchm keys become metadata keys** with their values
- **Comprehensive tracking** of every calculated value
- **Searchable and queryable** data format

### 🔄 Real-time Tracking

- **Automatic tracking** of alchemical quantities
- **User interaction monitoring**
- **Performance metrics** collection
- **Error tracking** and debugging
- **Galileo integration** for centralized logging

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Alchemizer    │───▶│ Site Metrics     │───▶│   Galileo       │
│                 │    │   Tracker        │    │   Dashboard     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  Alchm Data     │    │  Tags & Metadata │    │  Real-time      │
│  (Nested)       │    │  (Flattened)     │    │  Monitoring     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Tags Structure

### Base Tags

Every tracking event includes these base tags:

```javascript
;[
  'alchemical_quantities', // Base category
  'planetary_agents', // Planetary system
  'astrological_data', // Astrological calculations
  'thermodynamic_calculations', // Energy calculations
]
```

### Dynamic Tags

Additional tags are generated based on current state:

```javascript
// Element-based tags
;`element_${dominantElement.toLowerCase()}` // e.g., 'element_fire'
// Modality-based tags
`modality_${dominantModality.toLowerCase()}` // e.g., 'modality_cardinal'
// Sun sign tags
`sun_sign_${sunSign.toLowerCase()}` // e.g., 'sun_sign_aries'
```

### Example Tags Output

```javascript
;[
  'alchemical_quantities',
  'planetary_agents',
  'astrological_data',
  'thermodynamic_calculations',
  'element_fire',
  'modality_cardinal',
  'sun_sign_aries',
]
```

## Metadata Structure

### Flattening Process

All nested alchm data is flattened using underscore notation:

```javascript
// Original nested structure
{
  'Alchemy Effects': {
    'Total Spirit': 2.5,
    'Total Essence': 1.8
  },
  'Heat': 0.0034,
  'Sun Sign': 'Aries'
}

// Flattened metadata structure
{
  'Alchemy_Effects_Total_Spirit': 2.5,
  'Alchemy_Effects_Total_Essence': 1.8,
  'Heat': 0.0034,
  'Sun_Sign': 'Aries'
}
```

### Key Metadata Examples

| Original Key                      | Metadata Key                      | Description              |
| --------------------------------- | --------------------------------- | ------------------------ |
| `Alchemy Effects.Total Spirit`    | `Alchemy_Effects_Total_Spirit`    | Spirit quantity          |
| `Alchemy Effects.Total Essence`   | `Alchemy_Effects_Total_Essence`   | Essence quantity         |
| `Alchemy Effects.Total Matter`    | `Alchemy_Effects_Total_Matter`    | Matter quantity          |
| `Alchemy Effects.Total Substance` | `Alchemy_Effects_Total_Substance` | Substance quantity       |
| `Heat`                            | `Heat`                            | Thermodynamic heat       |
| `Entropy`                         | `Entropy`                         | Thermodynamic entropy    |
| `Reactivity`                      | `Reactivity`                      | Thermodynamic reactivity |
| `Energy`                          | `Energy`                          | Thermodynamic energy     |
| `K_alchm`                         | `K_alchm`                         | Kalchm constant          |
| `MonicaConstant`                  | `MonicaConstant`                  | Monica constant          |
| `Dominant Element`                | `Dominant_Element`                | Dominant element         |
| `Sun Sign`                        | `Sun_Sign`                        | Current sun sign         |
| `Chart Ruler`                     | `Chart_Ruler`                     | Chart ruler planet       |

## API Endpoints

### GET `/api/site-metrics`

Retrieves current site metrics including tags and metadata.

**Response:**

```javascript
{
  "alchemicalQuantities": { /* ... */ },
  "thermodynamics": { /* ... */ },
  "astrological": { /* ... */ },
  "userInteractions": { /* ... */ },
  "system": { /* ... */ },
  "performance": { /* ... */ },
  "tags": ["alchemical_quantities", "element_fire", ...],
  "metadata": {
    "Alchemy_Effects_Total_Spirit": 2.5,
    "Heat": 0.0034,
    // ... all flattened keys
  }
}
```

### POST `/api/site-metrics`

Tracks various events with the new structure.

**Actions:**

- `track_alchemical_quantities` - Track current alchemical state
- `track_planetary_agent_interaction` - Track user interactions
- `track_page_view` - Track page navigation
- `track_custom_event` - Track custom events
- `track_performance` - Track performance metrics

## Usage Examples

### Tracking Alchemical Quantities

```javascript
import { trackAlchemicalQuantities } from '@/lib/site-metrics-tracker'

// Automatically tracks with tags and metadata
await trackAlchemicalQuantities()
```

### Tracking User Interactions

```javascript
import { trackPlanetaryAgentInteraction } from '@/lib/site-metrics-tracker'

await trackPlanetaryAgentInteraction(
  'Mars', // planet
  'Aries', // sign
  '15°', // degree
  'What is Mars like today?', // userQuery
  'Mars is currently...', // aiResponse
  1250, // responseTime (ms)
  'user-123' // userId (optional)
)
```

### Tracking Custom Events

```javascript
import { trackCustomEvent } from '@/lib/site-metrics-tracker'

await trackCustomEvent(
  'user_registration',
  {
    registrationMethod: 'email',
    source: 'landing_page',
    timestamp: new Date().toISOString(),
  },
  'user-456'
)
```

### Tracking Performance

```javascript
import { trackPerformance } from '@/lib/site-metrics-tracker'

await trackPerformance('api_response_time', 150, 'ms', {
  endpoint: '/api/alchm-quantities',
  method: 'GET',
})
```

## Galileo Integration

All tracking events are automatically sent to Galileo with the structured format:

```javascript
// Galileo log structure
{
  event_type: 'alchemical_quantities',
  tags: ['alchemical_quantities', 'element_fire', ...],
  metadata: {
    'Alchemy_Effects_Total_Spirit': 2.5,
    'Heat': 0.0034,
    // ... all flattened keys
  },
  source: 'site-metrics-tracker'
}
```

## Dashboard

Access the metrics dashboard at `/site-metrics` to view:

- **Overview**: Key metrics and active tags
- **Alchemical**: Detailed alchemical quantities and thermodynamics
- **Metadata**: Complete flattened metadata structure
- **System**: System performance and user interaction metrics

## Testing

Run the test script to verify the tracking system:

```bash
node test-site-metrics.js
```

This will test:

- ✅ Site metrics API functionality
- ✅ Tags structure generation
- ✅ Metadata flattening
- ✅ Event tracking
- ✅ Galileo integration

## Benefits

### For Developers

- **Structured data** for easy querying and analysis
- **Consistent format** across all tracking events
- **Comprehensive coverage** of all alchemical calculations
- **Real-time monitoring** for debugging and optimization

### For Analysts

- **Filterable data** using tags for targeted analysis
- **Searchable metadata** for finding specific values
- **Historical tracking** for trend analysis
- **Performance insights** for optimization

### For Users

- **Real-time updates** of alchemical quantities
- **Transparent tracking** of system performance
- **Reliable data** with error handling and fallbacks
- **Rich analytics** for understanding system behavior

## Configuration

The tracking system uses these environment variables:

```bash
# Galileo Configuration
GALILEO_API_KEY=your_galileo_api_key
GALILEO_PROJECT=your_project_name
GALILEO_LOG_STREAM=your_log_stream_name

# Optional: Base URL for testing
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## Monitoring

Monitor the tracking system through:

1. **Galileo Dashboard**: Real-time logs and metrics
2. **Site Metrics Page**: `/site-metrics` for current state
3. **API Endpoints**: Direct access to tracking data
4. **Server Logs**: Console output for debugging

## Future Enhancements

- **Historical data storage** for long-term analysis
- **Advanced filtering** by tags and metadata
- **Alerting system** for threshold violations
- **Export functionality** for external analysis
- **Custom dashboards** for specific use cases

---

The Site Metrics Tracking System provides a robust foundation for monitoring and analyzing the Planetary Agents application with structured, searchable, and comprehensive data tracking.
