# Planetary Agents API Documentation

## Overview

The Planetary Agents API provides endpoints for astrological AI interactions, including the Monica Avatar Agent, Personalized AI consciousness mirrors, and planetary agents. This API enables consciousness training with XP progression, achievements, and adaptive learning based on users' astrological birth charts.

## Recent Updates (January 29, 2025)

### Monica Avatar Agent Improvements

- **Enhanced Visual Identity**: Updated to use official Alchm logo avatar
- **Anthropic Compliance**: Implemented best practices for effective AI agents
- **Input Validation**: Added comprehensive message validation and safety limits
- **Error Handling**: Improved user-friendly error responses in Monica's voice
- **Performance**: Added controlled temperature (0.7) for natural conversation flow

## Base URL

```
Development: http://localhost:3000/api
Production: https://your-domain.com/api
```

## Authentication

Currently, the API uses simple user identification. In production, implement proper authentication:

```typescript
// Headers for authenticated requests
{
  "Authorization": "Bearer <jwt_token>",
  "Content-Type": "application/json"
}
```

## Rate Limiting

- **Default**: 100 requests per minute per IP
- **AI Generation**: 5 requests per hour per user
- **Chat Interactions**: 60 requests per minute per user

## API Endpoints

### 1. Monica Avatar Agent

Interact with Monica, the official Alchm system expert and world-renowned tarot master.

**Endpoint:** `POST /api/monica-agent`

**Request Body:**

```json
{
  "message": "Tell me about the Monica Constant",
  "userId": "user_123456",
  "sessionId": "monica-session-123",
  "includeAlchm": true,
  "includeCharacterVector": false,
  "includeConsciousness": false
}
```

**Response (200 OK):**

```json
{
  "response": "The Monica Constant bears my name because I am its ultimate master and interpreter...",
  "sessionId": "monica-session-123",
  "monicaInsights": {
    "characterVector": {
      "taurus": 42,
      "cancer": 25,
      "virgo": 25,
      "aries": 4,
      "sagittarius": 4
    },
    "peakMoment": {
      "aNumber": 40
    },
    "currentApproach": {
      "response_style": {
        "tone": "warm and nurturing",
        "pace": "steady and patient",
        "structure": "systematic and clear",
        "supportLevel": "high"
      }
    }
  },
  "userContext": {
    "currentMomentANumber": 32.5,
    "peakMomentANumber": 40
  }
}
```

**Error Responses:**

```json
// 400 Bad Request - Invalid Input
{
  "response": "I'd love to help you, dear one! Could you please share what you'd like to explore?",
  "error": "INVALID_INPUT",
  "monicaNote": "My nurturing Cancer Moon wants to understand your needs!"
}

// 200 OK - API Key Missing
{
  "response": "Oh dear, I'm experiencing some technical difficulties...",
  "error": "API_KEY_MISSING",
  "monicaNote": "My practical Taurus nature says we need to check the basics first!"
}
```

### 2. Create Personalized AI

Creates a new AI consciousness mirror based on birth chart data.

**Endpoint:** `POST /api/personalized-ai`

**Request Body:**

```json
{
  "birthInfo": {
    "date": "1990-01-01",
    "time": "12:00",
    "location": "New York, NY",
    "name": "John Doe"
  },
  "userId": "user_123456",
  "horoscopeData": {
    "planets": {
      "sun": { "sign": "capricorn", "degree": 10.5 },
      "moon": { "sign": "pisces", "degree": 23.2 },
      "mercury": { "sign": "sagittarius", "degree": 5.7 }
    },
    "houses": {},
    "aspects": []
  }
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "aiConfig": {
    "personalityId": "ai_user_123456_1705123456789",
    "userId": "user_123456",
    "basePersonality": {
      "coreTraits": [
        {
          "source": "sun (core identity)",
          "influence": 1.0,
          "traits": "Strong leadership qualities, practical approach to life..."
        }
      ],
      "supportingTraits": [],
      "dominantElement": "earth",
      "synthesizedPrompt": "You are a personalized AI consciousness mirror..."
    },
    "trainingScores": {
      "communication_style": 50,
      "knowledge_depth": 50,
      "emotional_intelligence": 50,
      "creativity": 50,
      "memory_integration": 50,
      "personality_alignment": 50
    },
    "totalXp": 0,
    "level": 1,
    "createdAt": "2024-01-13T10:30:56.789Z"
  },
  "personalityProfile": {
    "coreTraits": [...],
    "dominantElement": "earth",
    "elementalBalance": {
      "fire": 0.2,
      "earth": 0.4,
      "air": 0.3,
      "water": 0.1
    }
  }
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Birth info and user ID are required"
}

// 500 Internal Server Error
{
  "error": "Failed to generate personalized AI"
}
```

### 2. Chat with Personalized AI

Send a message to the AI and receive a response with training updates.

**Endpoint:** `POST /api/personalized-ai-chat`

**Request Body:**

```json
{
  "message": "Tell me about my communication style based on my Mercury placement",
  "personalityId": "ai_user_123456_1705123456789",
  "userId": "user_123456",
  "trainingFocus": "communication_style",
  "feedbackData": {
    "rating": 5,
    "explicit": true,
    "feedbackType": "positive",
    "correction": "Could be more detailed about practical applications"
  }
}
```

**Response (200 OK):**

```json
{
  "response": "Based on your Mercury in Sagittarius, you have a naturally expansive and philosophical communication style...",
  "trainingUpdate": {
    "xpGained": 75,
    "totalXp": 1250,
    "level": 12,
    "trainingScores": {
      "communication_style": 67,
      "knowledge_depth": 52,
      "emotional_intelligence": 48,
      "creativity": 55,
      "memory_integration": 51,
      "personality_alignment": 58
    },
    "personalityAdjustments": [
      "Improved communication style (+3.2)",
      "Enhanced knowledge depth (+1.1)"
    ]
  },
  "achievements": [
    {
      "id": "communication_apprentice",
      "name": "Communication Apprentice",
      "description": "Reach 60+ points in Communication Style",
      "xpReward": 100,
      "unlockedAt": "2024-01-13T10:35:22.123Z"
    }
  ],
  "levelUp": true
}
```

**Error Responses:**

```json
// 400 Bad Request
{
  "error": "Message, personality ID, and user ID are required"
}

// 500 Internal Server Error
{
  "error": "Failed to process chat message"
}
```

### 3. Get AI Configuration

Retrieve current AI configuration and training progress.

**Endpoint:** `GET /api/personalized-ai/{personalityId}`

**Response (200 OK):**

```json
{
  "success": true,
  "aiConfig": {
    "personalityId": "ai_user_123456_1705123456789",
    "userId": "user_123456",
    "trainingScores": {
      "communication_style": 67,
      "knowledge_depth": 52,
      "emotional_intelligence": 48,
      "creativity": 55,
      "memory_integration": 51,
      "personality_alignment": 58
    },
    "totalXp": 1250,
    "level": 12,
    "conversationHistory": [
      {
        "id": "conv_1705123456789",
        "userMessage": "Tell me about...",
        "aiResponse": "Based on your chart...",
        "timestamp": "2024-01-13T10:35:22.123Z",
        "xpGained": 75,
        "interactionQuality": "good"
      }
    ],
    "userPreferences": {
      "communicationStyle": {
        "formality": "mixed",
        "humor": "moderate",
        "depth": "detailed",
        "responseLength": "moderate"
      }
    }
  }
}
```

### 4. Update Training Focus

Set or change the current training focus category.

**Endpoint:** `PUT /api/personalized-ai/{personalityId}/training-focus`

**Request Body:**

```json
{
  "trainingFocus": "emotional_intelligence"
}
```

**Response (200 OK):**

```json
{
  "success": true,
  "trainingFocus": "emotional_intelligence",
  "message": "Training focus updated. You'll earn 2x XP for emotional intelligence improvements."
}
```

### 5. Get Training Analytics

Retrieve comprehensive training analytics and insights.

**Endpoint:** `GET /api/personalized-ai/{personalityId}/analytics`

**Query Parameters:**

- `period`: `7d`, `30d`, `90d`, `all` (default: `30d`)
- `category`: Specific training category to analyze

**Response (200 OK):**

```json
{
  "success": true,
  "analytics": {
    "period": "30d",
    "totalInteractions": 156,
    "averageSessionLength": 8.3,
    "learningVelocity": 2.4,
    "alignmentAccuracy": 82.5,
    "categoryProgress": {
      "communication_style": {
        "currentScore": 67,
        "startScore": 50,
        "improvement": 17,
        "trend": "improving"
      }
    },
    "achievements": [
      {
        "id": "week_warrior",
        "unlockedAt": "2024-01-10T15:22:11.456Z"
      }
    ],
    "predictions": {
      "nextLevelEta": "3 days",
      "expectedScore30Day": {
        "communication_style": 75
      }
    }
  }
}
```

### 6. Export User Data

Export all user data for GDPR compliance.

**Endpoint:** `GET /api/personalized-ai/{personalityId}/export`

**Response (200 OK):**

```json
{
  "success": true,
  "exportData": {
    "personalityId": "ai_user_123456_1705123456789",
    "birthChart": {...},
    "trainingHistory": [...],
    "conversationHistory": [...],
    "achievements": [...],
    "exportedAt": "2024-01-13T10:40:00.000Z"
  }
}
```

### 7. Delete AI and Data

Delete AI configuration and all associated data.

**Endpoint:** `DELETE /api/personalized-ai/{personalityId}`

**Response (200 OK):**

```json
{
  "success": true,
  "message": "AI configuration and all associated data have been permanently deleted"
}
```

### 8. Zodiac Calendar API

Access professional astronomical calculations with VSOP87 precision for zodiac positions, planetary movements, and celestial timing.

**Base Endpoint:** `GET /api/zodiac-calendar`

**Available Actions:**

- `current-period` - Get current zodiac information
- `degree-for-date` - Zodiac position for specific date/time
- `dates-for-degree` - Date ranges when Sun is at specific degree
- `year-map` - Complete annual zodiac calendar
- `monthly-calendar` - Monthly zodiac calendar view
- `compare-accuracy` - Compare old vs new system accuracy

#### 8.1 Current Zodiac Period

Get real-time zodiac position and next ingress information.

**Endpoint:** `GET /api/zodiac-calendar?action=current-period`

**Response (200 OK):**

```json
{
  "current_time": "2025-09-29T21:21:46.533Z",
  "zodiac_position": {
    "absolute_longitude": 186.97924682988742,
    "sign": "Libra",
    "sign_index": 6,
    "degree_in_sign": 6.9792468298874155,
    "minute_in_degree": 58.75480979324493,
    "decan": 1,
    "decan_ruler": "Venus"
  },
  "current_period": {
    "sign": "Libra",
    "startDate": "2025-09-16T00:00:00.000Z",
    "endDate": "2025-10-16T00:00:00.000Z",
    "durationDays": 30,
    "decans": {
      "first": {
        "start": "2025-09-16T00:00:00.000Z",
        "end": "2025-09-26T00:00:00.000Z",
        "duration_hours": 240
      },
      "second": {
        "start": "2025-09-26T00:00:00.000Z",
        "end": "2025-10-06T00:00:00.000Z",
        "duration_hours": 240
      },
      "third": {
        "start": "2025-10-06T00:00:00.000Z",
        "end": "2025-10-16T00:00:00.000Z",
        "duration_hours": 240
      }
    }
  },
  "next_ingress": {
    "sign": "Scorpio",
    "days": 17,
    "date": "2025-10-16T00:00:00.000Z"
  },
  "current_decan": 1,
  "decan_ruler": "Venus"
}
```

#### 8.2 Zodiac Position for Date

Get exact zodiac degree and position for any date and time.

**Endpoint:** `GET /api/zodiac-calendar?action=degree-for-date&date=2025-03-20T09:00:00Z`

**Response (200 OK):**

```json
{
  "date": "2025-03-20T09:00:00.000Z",
  "zodiac": {
    "absolute_longitude": 0.0024158561136573553,
    "sign": "Aries",
    "sign_index": 0,
    "degree_in_sign": 0.0024158561136573553,
    "minute_in_degree": 0.14495136681944132,
    "decan": 1,
    "decan_ruler": "Mars"
  },
  "degreeInfo": {
    "degree": 0,
    "sign": "Aries",
    "signDegree": 0,
    "decan": 1,
    "dateRange": {
      "start": "2025-03-20T09:00:00.000Z",
      "end": "2025-03-21T10:00:00.000Z",
      "duration_hours": 25
    },
    "keywords": ["New beginnings", "Pioneer spirit", "Cardinal fire"]
  },
  "solar": {
    "longitude": 0.0024158561136573553,
    "distance": 0.9958799023660894,
    "speed": 0.9937985071907736,
    "equation_of_time": -7.398977233143994,
    "declination": 0.0009608455170517285
  }
}
```

#### 8.3 Accuracy Comparison

Compare old approximation system vs new VSOP87 astronomical precision.

**Endpoint:** `GET /api/zodiac-calendar?action=compare-accuracy&date=2025-09-21`

**Response (200 OK):**

```json
{
  "date": "2025-09-21T00:00:00.000Z",
  "old_calculation": {
    "sign": "Pisces",
    "degree": 27,
    "absolute": 357,
    "method": "simplified day-of-year division"
  },
  "new_calculation": {
    "sign": "Virgo",
    "degree": 28.267546027616845,
    "absolute": 178.26754602761685,
    "method": "VSOP87 astronomical calculation"
  },
  "accuracy_improvement": {
    "degree_difference": 178.73245397238315,
    "improvement_factor": "35.75x",
    "sun_distance": "1.004090515431774 AU",
    "sun_speed": "0.9776°/day",
    "equation_of_time": "6.82 minutes"
  }
}
```

**Notes:**

- All calculations use professional astronomical precision (±0.01° accuracy)
- Sub-millisecond response times with intelligent caching
- UTC timestamps for consistent astronomical calculations
- Includes Sabian symbols and degree keywords where available

## Data Models

### PersonalizedAIConfig

```typescript
interface PersonalizedAIConfig {
  userId: string
  personalityId: string
  birthChart: AlchemicalProfile
  basePersonality: PersonalityProfile
  trainingScores: TrainingScores
  totalXp: number
  level: number
  conversationHistory: ConversationEntry[]
  userPreferences: UserPreferences
  adaptations: PersonalityAdaptations
  createdAt: string
  lastUpdated: string
}
```

### TrainingScores

```typescript
interface TrainingScores {
  communication_style: number // 0-100
  knowledge_depth: number // 0-100
  emotional_intelligence: number // 0-100
  creativity: number // 0-100
  memory_integration: number // 0-100
  personality_alignment: number // 0-100
}
```

### ConversationEntry

```typescript
interface ConversationEntry {
  id: string
  userMessage: string
  aiResponse: string
  timestamp: string
  userFeedback?: FeedbackData
  xpGained: number
  interactionQuality: 'poor' | 'average' | 'good' | 'excellent'
  trainingImpact: TrainingImpact
}
```

### FeedbackData

```typescript
interface FeedbackData {
  rating: number // 1-5 stars
  explicit: boolean // True if user explicitly rated
  feedbackType: 'positive' | 'negative' | 'neutral' | 'exceptional'
  correction?: string // User-provided correction
  timestamp: string
}
```

## XP and Leveling System

### XP Calculation

```typescript
// Base XP values
const baseXpMap = {
  poor: 10,
  average: 25,
  good: 40,
  excellent: 50,
}

// Feedback bonuses
const feedbackBonus = {
  negative: 0,
  neutral: 10,
  positive: 25,
  exceptional: 50,
}

// Total calculation
totalXp = (baseXp + feedbackBonus + focusBonus) * streakMultiplier * qualityMultiplier
```

### Level Formula

```typescript
// Level calculation from total XP
level = Math.floor((totalXp / 100) ** (2 / 3)) + 1

// XP required for specific level
xpRequired = Math.floor(100 * (level - 1) ** 1.5)
```

### Level Tiers

| Levels | Name       | XP Range | Description                      |
| ------ | ---------- | -------- | -------------------------------- |
| 1-10   | Novice     | 0-1K     | Basic personality formation      |
| 11-25  | Apprentice | 1K-5K    | Learning user preferences        |
| 26-50  | Adept      | 5K-15K   | Developing unique voice          |
| 51-75  | Expert     | 15K-35K  | Advanced consciousness mirroring |
| 76-100 | Master     | 35K-100K | Perfect synchronization          |

## Achievement System

### Achievement Types

- **milestone**: Level-based achievements
- **skill**: Category mastery achievements
- **social**: Interaction-based achievements
- **special**: Unique accomplishments

### Sample Achievements

```json
{
  "first_words": {
    "name": "First Words",
    "description": "Complete your first conversation",
    "xpReward": 100,
    "requirements": [{ "type": "interactions", "value": 1 }]
  },
  "quick_learner": {
    "name": "Quick Learner",
    "description": "Reach level 10 in under 50 interactions",
    "xpReward": 250,
    "requirements": [
      { "type": "level", "value": 10 },
      { "type": "interactions", "value": 50 }
    ]
  },
  "communication_master": {
    "name": "Communication Master",
    "description": "Max out Communication Style category",
    "xpReward": 500,
    "requirements": [{ "type": "category_score", "value": 100, "category": "communication_style" }]
  }
}
```

## Error Handling

### HTTP Status Codes

- **200 OK**: Successful request
- **400 Bad Request**: Invalid input or missing required fields
- **401 Unauthorized**: Authentication required
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error
- **503 Service Unavailable**: Service temporarily unavailable

### Error Response Format

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE",
  "details": {
    "field": "Additional error details"
  },
  "timestamp": "2024-01-13T10:45:00.000Z"
}
```

## Security Considerations

### Input Validation

- All user inputs are sanitized and validated
- Maximum message length: 2000 characters
- Birth data validation for realistic dates/locations
- Feedback ratings constrained to 1-5 range

### Rate Limiting

```typescript
// Rate limiting configuration
const rateLimits = {
  aiGeneration: '5 requests per hour per user',
  chatInteraction: '60 requests per minute per user',
  analytics: '10 requests per minute per user',
  dataExport: '1 request per hour per user',
}
```

### Data Protection

- Sensitive data encrypted at rest
- API keys never exposed in responses
- User data access limited by authentication
- GDPR compliance for data export/deletion

## Performance Optimization

### Caching Strategy

- **AI Configurations**: Redis cache with 1-hour TTL
- **Training Scores**: In-memory cache with 15-minute TTL
- **Analytics**: Database cache with daily refresh
- **Conversation History**: Session-based caching

### Response Optimization

- Paginated conversation history (default: 20 entries)
- Compressed JSON responses
- CDN for static assets
- Database query optimization with indexes

## Monitoring and Analytics

### Key Metrics

- API response times
- Error rates by endpoint
- User engagement metrics
- AI training effectiveness
- Resource utilization

### Health Check

**Endpoint:** `GET /api/health`

```json
{
  "status": "healthy",
  "timestamp": "2024-01-13T10:50:00.000Z",
  "checks": {
    "database": true,
    "redis": true,
    "anthropic": true,
    "openai": true
  },
  "version": "1.0.0"
}
```

## SDKs and Integration

### JavaScript/TypeScript SDK

```typescript
import { PersonalizedAI } from '@planetary-agents/sdk';

const ai = new PersonalizedAI({
  apiKey: 'your-api-key',
  baseUrl: 'https://your-domain.com/api'
});

// Create AI
const aiConfig = await ai.create({
  birthInfo: {...},
  userId: 'user_123'
});

// Chat
const response = await ai.chat({
  personalityId: aiConfig.personalityId,
  message: 'Hello!',
  trainingFocus: 'communication_style'
});
```

### Python SDK

```python
from planetary_agents import PersonalizedAI

ai = PersonalizedAI(
    api_key='your-api-key',
    base_url='https://your-domain.com/api'
)

# Create AI
ai_config = ai.create(
    birth_info={...},
    user_id='user_123'
)

# Chat
response = ai.chat(
    personality_id=ai_config['personalityId'],
    message='Hello!',
    training_focus='communication_style'
)
```

## Kinetics Engine (Enhanced) - 2025-09-20

Feature flag: set `NEXT_PUBLIC_KINETICS_BACKEND=true` to route frontend through backend enhanced kinetics via `UnifiedKineticsClient`.

Endpoints:

- POST `/api/alchm-kinetics/enhanced`
  - Body: `{ location: { lat: number, lon: number }, options?: { includeAgentOptimization?: boolean, includePowerPrediction?: boolean, includeResonanceMap?: boolean, agentIds?: string[] } }`
  - Returns: `{ success, data: { base, agentOptimization?, powerPrediction?, resonanceMap? }, computeTimeMs }`

- POST `/api/kinetics/group`
  - Body: `{ agentIds: string[], location: { lat: number, lon: number } }`
  - Returns: `{ success, data: { harmony, powerAmplification, momentumFlow, currentPower, resonances }, computeTimeMs }`

- POST `/api/kinetics/token`
  - Body: `{ baseTokenRate: number, baseNFTRarity: number, location: { lat: number, lon: number } }`
  - Returns: token generation metrics and NFT rarity bundle

Client usage:

```ts
import { UnifiedKineticsClient } from '@/lib/kinetics-unified-client'

await UnifiedKineticsClient.getKinetics({
  lat,
  lon,
  date,
  includeElemental: true,
  includePlanetary: true,
  window: 3,
})
await UnifiedKineticsClient.getEnhanced({
  location: { lat, lon },
  options: { includeAgentOptimization: true, includePowerPrediction: true },
})
await UnifiedKineticsClient.getGroupDynamics({ agentIds, location: { lat, lon } })
await UnifiedKineticsClient.getTokenMetrics({
  baseTokenRate,
  baseNFTRarity,
  location: { lat, lon },
})
```

## Changelog

### v1.0.0 (2024-01-13)

- Initial API release
- Core AI generation and chat functionality
- XP system and gamification
- Training analytics
- Achievement system

---

This API documentation provides comprehensive coverage of the Personalized AI system's capabilities, enabling developers to integrate and extend the consciousness training functionality effectively.
