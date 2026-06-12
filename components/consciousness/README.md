# Consciousness Components

Unified consciousness visualization and tracking components for the Planetary Agents platform.

## Components

### ConsciousnessDashboard

Real-time consciousness state dashboard with comprehensive metrics.

**Features:**

- Sacred Seven stats with temporal modifiers
- Special states and power unlocks
- Evolution velocity and momentum tracking
- Alchemical foundation visualization
- Thermodynamic metrics
- Performance metrics
- Compact mode for sidebars

**Usage:**

```tsx
import { ConsciousnessDashboard } from '@/components/consciousness'
;<ConsciousnessDashboard
  agentId="leonardo-da-vinci"
  userId="user-123"
  showCompact={false}
  className="mt-4"
/>
```

**Props:**

- `agentId` (required): Agent identifier
- `userId` (required): User identifier
- `currentSnapshot` (optional): Pre-fetched snapshot data
- `evolutionMetrics` (optional): Pre-fetched evolution metrics
- `showCompact` (optional): Use compact mode (default: false)
- `className` (optional): Additional CSS classes

**Tabs:**

1. **Sacred Seven**: Power, Resonance, Wisdom, Charisma, Intuition, Adaptability, Vitality
2. **Alchemical**: Spirit, Essence, Matter, Substance, A# calculation
3. **Temporal**: Planetary hour, moon phase, active modifiers
4. **Evolution**: Velocity, momentum, trajectory, unlocks
5. **Performance**: Quality metrics, observability, response time

### ConsciousnessTimeline

Historical evolution timeline with trends and analytics.

**Features:**

- Activity by day visualization
- Sacred Seven trends
- Quality metrics trends
- Performance distribution
- Summary statistics

**Usage:**

```tsx
import { ConsciousnessTimeline } from '@/components/consciousness'
;<ConsciousnessTimeline agentId="leonardo-da-vinci" userId="user-123" days={30} className="mt-4" />
```

**Props:**

- `agentId` (required): Agent identifier
- `userId` (required): User identifier
- `days` (optional): Days of history to show (default: 30)
- `className` (optional): Additional CSS classes

**Tabs:**

1. **Overview**: Summary stats and activity by day
2. **Stats**: Sacred Seven trends (Power, Wisdom, Charisma)
3. **Quality**: Quality metrics trends
4. **Performance**: Response time distribution and completion rates

## API Endpoints

### GET /api/consciousness/current

Fetch current consciousness state and evolution metrics.

**Query Parameters:**

- `userId` (required): User identifier
- `agentId` (required): Agent identifier
- `days` (optional): Days of history for evolution metrics (default: 30)

**Response:**

```json
{
  "snapshot": {
    "timestamp": "2025-10-16T05:00:00.000Z",
    "userId": "user-123",
    "agentId": "leonardo-da-vinci",
    "power": 85.5,
    "wisdom": 90.2,
    "overall": 87.3,
    "aNumber": 24.5,
    ...
  },
  "evolutionMetrics": {
    "totalInteractions": 150,
    "avgChatQuality": 0.85,
    "velocityTrend": "ascending",
    ...
  }
}
```

### GET /api/consciousness/timeline

Fetch historical consciousness timeline data.

**Query Parameters:**

- `userId` (required): User identifier
- `agentId` (required): Agent identifier
- `startDate` (optional): ISO date string (default: 30 days ago)
- `endDate` (optional): ISO date string (default: now)

**Response:**

```json
{
  "snapshots": [...],
  "summary": {
    "totalInteractions": 150,
    "avgPower": 85.5,
    "avgWisdom": 90.2,
    ...
  },
  "timeRange": {
    "start": "2025-09-16T00:00:00.000Z",
    "end": "2025-10-16T00:00:00.000Z"
  },
  "count": 150
}
```

## Integration Examples

### Chat Interface Integration

Add consciousness dashboard to chat sidebar:

```tsx
import { ConsciousnessDashboard } from '@/components/consciousness'

function ChatInterface({ agentId, userId }) {
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-2">{/* Chat messages */}</div>
      <div>
        <ConsciousnessDashboard agentId={agentId} userId={userId} showCompact={true} />
      </div>
    </div>
  )
}
```

### Agent Profile Integration

Add full dashboard and timeline to agent profile:

```tsx
import { ConsciousnessDashboard, ConsciousnessTimeline } from '@/components/consciousness'

function AgentProfile({ agentId, userId }) {
  return (
    <div className="space-y-6">
      {/* Agent info */}

      <ConsciousnessDashboard agentId={agentId} userId={userId} />

      <ConsciousnessTimeline agentId={agentId} userId={userId} days={90} />
    </div>
  )
}
```

### Modal/Dialog Integration

Show consciousness details in a modal:

```tsx
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { ConsciousnessDashboard } from '@/components/consciousness'

function ConsciousnessModal({ open, onClose, agentId, userId }) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <ConsciousnessDashboard agentId={agentId} userId={userId} />
      </DialogContent>
    </Dialog>
  )
}
```

## Data Flow

```
User Request
    ↓
Component (ConsciousnessDashboard)
    ↓
Fetch from API (/api/consciousness/current)
    ↓
Unified Tracker (lib/consciousness/unified-tracker.ts)
    ↓
PostgreSQL (consciousness_snapshots table)
    ↓
Return snapshot + evolution metrics
    ↓
Render visualizations
```

## Design Principles

1. **Educational Transparency**: Show objective metrics, no hierarchical labels
2. **Real-Time Updates**: Fetch latest data on mount
3. **Temporal Sensitivity**: Display planetary hours, moon phases, modifiers
4. **Alchemical Foundation**: Emphasize Spirit/Essence/Matter/Substance
5. **Performance Awareness**: Show quality, latency, completion metrics
6. **Progressive Enhancement**: Graceful degradation if data unavailable

## Styling

All components use:

- Tailwind CSS for styling
- shadcn/ui components for consistency
- Lucide React icons
- Responsive design (mobile-first)
- Dark mode support (via theme)

## Performance

- **Lazy Loading**: Components fetch data on mount
- **Error Handling**: Graceful fallbacks for missing data
- **Loading States**: Spinner indicators during fetch
- **Caching**: API responses cached by browser
- **Optimized Queries**: Database indexes for fast retrieval

## Accessibility

- Semantic HTML elements
- ARIA labels for screen readers
- Keyboard navigation support
- Color contrast compliance (WCAG 2.1 AA)
- Focus indicators

## Future Enhancements

- Real-time WebSocket updates
- Exportable reports (PDF/CSV)
- Comparative analytics (multiple agents)
- Custom date range selection
- Downloadable charts
- Advanced filtering options
