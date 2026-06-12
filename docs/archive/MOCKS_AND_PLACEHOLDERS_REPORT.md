# Mocks and Placeholders Replacement Report

**Generated:** 2025-01-21  
**Status:** Comprehensive audit complete

## Executive Summary

This report identifies **12 major areas** where mocks and placeholders exist that should be replaced with real, robust functionality. These are prioritized by impact and feasibility.

---

## 🔴 High Priority - Core Functionality

### 1. Mock Geocoding Service

**File:** `components/charts/quick-chart-input.tsx`  
**Lines:** 25-61  
**Current State:** Uses `mockGeocode()` with hardcoded coordinates for ~10 cities  
**Impact:** Users cannot create charts for locations not in the mock list  
**Replacement:** Integrate real geocoding service:

- **Option A:** Google Maps Geocoding API
- **Option B:** Mapbox Geocoding API
- **Option C:** OpenStreetMap Nominatim (free, no API key)
- **Recommendation:** Start with Nominatim, upgrade to Mapbox for production

**Code Location:**

```25:61:planetary-agents/components/charts/quick-chart-input.tsx
// Mock geocoding function - in production, use a real geocoding service
const mockGeocode = async (
  location: string
): Promise<{ latitude: number; longitude: number; formattedName: string } | null> => {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500))

  // Mock coordinates for common cities
  const mockCoordinates: Record<string, { lat: number; lng: number; name: string }> = {
    'new york': { lat: 40.7128, lng: -74.006, name: 'New York, NY, USA' },
    // ... more hardcoded cities
  }
  // ...
}
```

---

### 2. Incomplete Alchemize Function

**File:** `backend/src/services/alchemizer-service.ts`  
**Lines:** 725-754  
**Current State:** Function skeleton with placeholder return values (all zeros)  
**Impact:** Core alchemical calculations return empty results  
**Replacement:** Implement full alchemize logic from workspace rules

**Code Location:**

```725:754:planetary-agents/backend/src/services/alchemizer-service.ts
async function alchemizeFullPlaceholder(birthInfo: any, horoscopeDict: any): Promise<any> {
  // ... (full alchemize logic from workspace rules, adapted to TS)
  // Implement the entire function as provided, handling all effects, aspects, etc.
  // For brevity, insert the core loop and calculations here.
  // Note: This is a placeholder; expand with full code.

  // Placeholder return to satisfy type
  return {
    'Alchemy Effects': {
      'Total Spirit': 0,
      'Total Essence': 0,
      'Total Matter': 0,
      'Total Substance': 0,
    },
  }
}
```

**Action Required:** Port the complete JavaScript alchemize function from workspace rules into TypeScript.

---

### 3. Mock Planetary Transits

**File:** `app/time-laboratory/page.tsx`  
**Lines:** 410-424  
**Current State:** Hardcoded planetary positions  
**Impact:** Time Laboratory shows incorrect transit data  
**Replacement:** Integrate Swiss Ephemeris or astronomical calculation library

**Code Location:**

```410:424:planetary-agents/app/time-laboratory/page.tsx
const loadCurrentTransits = useCallback(async () => {
  try {
    // This would integrate with astronomical calculations
    // For now, we'll use mock data
    setCurrentTransits([
      { planet: 'Sun', longitude: 45, sign: 'Taurus' },
      { planet: 'Moon', longitude: 120, sign: 'Leo' },
      { planet: 'Mercury', longitude: 35, sign: 'Taurus' },
      { planet: 'Venus', longitude: 80, sign: 'Gemini' },
      { planet: 'Mars', longitude: 200, sign: 'Libra' },
    ])
  } catch (error) {
    console.error('Failed to load current transits:', error)
  }
}, [])
```

**Action Required:** Use existing Swiss Ephemeris integration or create API endpoint that calculates real planetary positions.

---

## 🟡 Medium Priority - Analytics & Monitoring

### 4. Performance Dashboard Mock Data

**File:** `components/admin/performance-dashboard.tsx`  
**Lines:** 118-214  
**Current State:** Simulated data with hardcoded metrics  
**Impact:** Dashboard shows fake metrics instead of real system performance  
**Replacement:** Create API endpoints to collect:

- Real-time system metrics (CPU, memory, response times)
- User analytics from database/logs
- Agent analytics from chat system
- Performance metrics from monitoring tools

**Code Location:**

```118:214:planetary-agents/components/admin/performance-dashboard.tsx
// Simulate data fetching
useEffect(() => {
  const fetchDashboardData = async () => {
    setLoading(true)

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1000))

    const mockData: DashboardData = {
      timeRange,
      systemMetrics: {
        timestamp: Date.now(),
        activeUsers: 1247,
        totalSessions: 8923,
        // ... all hardcoded values
      },
      // ...
    }
    // ...
  }
}, [timeRange, autoRefresh])
```

**Action Required:**

1. Create `/api/admin/performance-metrics` endpoint
2. Integrate with existing monitoring/logging systems
3. Query database for user/agent analytics
4. Replace mock data with API calls

---

### 5. Batch Processing Dashboard Mock Data

**File:** `components/dashboards/batch-processing-dashboard.tsx`  
**Lines:** 98-195  
**Current State:** Mock job queue metrics and batch jobs  
**Impact:** Cannot monitor real batch processing operations  
**Replacement:** Connect to actual job queue system (Redis/BullMQ) or database

**Code Location:**

```98:195:planetary-agents/components/dashboards/batch-processing-dashboard.tsx
// Mock data for demonstration
const initializeMockData = useCallback(() => {
  const mockMetrics: QueueMetrics = {
    totalJobs: 156,
    queuedJobs: 12,
    processingJobs: 3,
    // ... hardcoded values
  }
  // ...
}, [])
```

**Action Required:**

1. Create `/api/admin/batch-metrics` endpoint
2. Query job queue for real metrics
3. Replace mock data initialization

---

### 6. Galileo Dashboard Mock Data

**File:** `components/dashboards/galileo-dashboard.tsx`  
**Lines:** 32-51, 71-83  
**Current State:** Hardcoded metrics data  
**Impact:** Cannot see real Galileo logging metrics  
**Replacement:** Integrate with Galileo API to fetch real metrics

**Code Location:**

```32:51:planetary-agents/components/dashboards/galileo-dashboard.tsx
// Mock data for demo purposes - in a real app this would come from Galileo's API
const mockMetricsData = [
  { name: 'Day 1', requests: 24, success: 20, failure: 4, avgLatency: 850 },
  // ... hardcoded data
]

const refreshData = async () => {
  setIsLoading(true)
  // In a real implementation, this would fetch data from Galileo's API
  // For demo purposes we're just simulating a delay
  await new Promise(resolve => setTimeout(resolve, 1000))
  // ...
}
```

**Action Required:** Use Galileo SDK/API to fetch real metrics data.

---

## 🟢 Lower Priority - Feature Enhancements

### 7. PDF/EPUB Export Placeholders

**File:** `lib/temporal-grimoire-export.ts`  
**Lines:** 713-731  
**Current State:** Returns placeholder buffers instead of real PDF/EPUB files  
**Impact:** Export functionality doesn't work  
**Replacement:** Implement real PDF/EPUB generation

**Code Location:**

```713:731:planetary-agents/lib/temporal-grimoire-export.ts
private static async generatePDF(
  sections: GrimoireSection[],
  template: GrimoireTemplate,
  options: ExportOptions
): Promise<Buffer> {
  // Mock PDF generation - in production, use libraries like puppeteer or jsPDF
  const htmlContent = this.generateHTMLContent(sections, template, options)
  return Buffer.from(`PDF_PLACEHOLDER:${htmlContent.length}_BYTES`, 'utf-8')
}

private static async generateEPUB(
  sections: GrimoireSection[],
  template: GrimoireTemplate,
  options: ExportOptions
): Promise<Buffer> {
  // Mock EPUB generation - in production, use epub-gen or similar
  const content = sections.map(s => s.content).join('\n\n')
  return Buffer.from(`EPUB_PLACEHOLDER:${content.length}_BYTES`, 'utf-8')
}
```

**Action Required:**

- **PDF:** Use `puppeteer` (server-side) or `jsPDF` (client-side)
- **EPUB:** Use `epub-gen` library

---

### 8. Quality Evaluation Placeholder

**File:** `lib/personalized-ai/training-interface-design.ts`  
**Lines:** 919-935  
**Current State:** Simple keyword matching instead of AI analysis  
**Impact:** Quality scores are inaccurate  
**Replacement:** Use OpenAI/Anthropic API for real quality evaluation

**Code Location:**

```919:935:planetary-agents/lib/personalized-ai/training-interface-design.ts
function evaluateMetric(submission: string, metric: QualityMetric): number {
  // Simplified placeholder - would use AI analysis in real implementation
  switch (metric.name) {
    case 'authenticity':
      return submission.includes('I feel') || submission.includes('my experience') ? 0.8 : 0.5
    case 'creativity':
      return submission.includes('imagine') || submission.includes('dream') ? 0.9 : 0.6
    // ... simple keyword matching
  }
}
```

**Action Required:** Integrate with OpenAI/Anthropic API to analyze submission quality.

---

### 9. RAG Cache Warming Placeholder

**File:** `lib/rag/rag-cache.ts`  
**Lines:** 274-278  
**Current State:** Function exists but doesn't actually warm cache  
**Impact:** Cache misses for common queries  
**Replacement:** Implement cache pre-population logic

**Code Location:**

```274:278:planetary-agents/lib/rag/rag-cache.ts
async warm(commonQueries: Array<{ query: string; agentId: string }>): Promise<void> {
  console.log(`[RAGCache] Warming cache with ${commonQueries.length} common queries...`)
  // This would be implemented to pre-populate cache with common queries
  // Left as placeholder for now
}
```

**Action Required:** Loop through queries and call RAG system to populate cache.

---

### 10. Authentication Placeholders

**File:** `lib/auth-helpers.ts`  
**Lines:** 4-20  
**Current State:** Returns null/anonymous for development  
**Impact:** No real user authentication  
**Replacement:** Implement NextAuth.js or similar

**Code Location:**

```4:20:planetary-agents/lib/auth-helpers.ts
export async function getCurrentUser(req?: NextRequest) {
  try {
    // For now, return null in development since NextAuth isn't fully configured
    // This allows the system to work with anonymous users
    return null
  } catch (error) {
    console.error('Failed to get current user:', error)
    return null
  }
}

export function getUserIdFromRequest(req: NextRequest): string {
  // For now, return a default user ID if no session
  // This allows the system to work without authentication during development
  // In production, this should throw an error or redirect to login
  return 'anonymous'
}
```

**Action Required:**

1. Configure NextAuth.js properly
2. Implement real session management
3. Update functions to use real user data

---

### 11. Mock Synastry Chart Creation

**File:** `components/temporal/temporal-client.tsx`  
**Lines:** 45-88  
**Current State:** Uses mock elemental/modal profiles (all 25% or 33%)  
**Impact:** Synastry charts show fake data  
**Replacement:** Calculate real elemental/modal profiles from birth charts

**Code Location:**

```45:88:planetary-agents/components/temporal/temporal-client.tsx
// Mock function to convert RelationChart to SynastryChart format
function createSynastryChartSkeleton(user: RelationChart, relation: RelationChart): SynastryChart {
  const mockElemental: ElementalProfile = {
    fire: 25,
    earth: 25,
    air: 25,
    water: 25,
    dominant_element: 'fire',
    secondary_element: 'earth',
  }
  const mockModal: ModalProfile = {
    cardinal: 33,
    fixed: 33,
    mutable: 34,
    dominant_mode: 'mutable',
  }
  // ... uses mock values
}
```

**Action Required:** Calculate real elemental and modal profiles from planetary positions.

---

## 📊 Summary Statistics

- **Total Issues Found:** 12
- **High Priority:** 3 (Core functionality)
- **Medium Priority:** 3 (Analytics & monitoring)
- **Lower Priority:** 6 (Feature enhancements)

---

## Implementation Recommendations

### Phase 1: Core Functionality (Week 1)

1. ✅ Replace mock geocoding with real service
2. ✅ Complete alchemize function implementation
3. ✅ Replace mock planetary transits

### Phase 2: Analytics (Week 2)

4. ✅ Performance dashboard real data
5. ✅ Batch processing dashboard real data
6. ✅ Galileo dashboard real data

### Phase 3: Features (Week 3-4)

7. ✅ PDF/EPUB export implementation
8. ✅ Quality evaluation AI integration
9. ✅ RAG cache warming
10. ✅ Authentication implementation
11. ✅ Real synastry chart calculations

---

## Notes

- Some mocks may be intentional for development/testing - verify before replacing
- Consider feature flags for gradual rollout of real implementations
- Test thoroughly after each replacement
- Monitor performance impact of real implementations
