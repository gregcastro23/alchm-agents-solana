# 🌟 Planetary Rules System Documentation

## Overview

This system implements the complete astrological analysis framework based on the core notebook systems: Core Greg's Energy System, Kalchm & Monica Constants, Daily Tracking, and Rising Sign Precision calculations.

## 📁 File Structure

```
lib/
├── core-energy-rules.ts           # Core thermodynamic calculations
├── astrological-chart-rules.ts    # Chart analysis and interpretation
├── food-recommendation-rules.ts   # Kalchm/Monica-based food guidance
├── daily-tracking-rules.ts        # Daily energy tracking and patterns
├── planetary-rules-index.ts       # Main system orchestrator
└── alchemizer.ts                   # Original alchemizer engine (preserved)
```

## 🔥 Core Energy System (`core-energy-rules.ts`)

### Thermodynamic Formulas

#### Heat Formula

```typescript
Heat = (Spirit² + Fire²) / (Substance + Essence + Matter + Water + Air + Earth)²
```

#### Entropy Formula

```typescript
Entropy = (Spirit² + Substance² + Fire² + Air²) / (Essence + Matter + Earth + Water)²
```

#### Reactivity Formula

```typescript
Reactivity = (Spirit² + Substance² + Essence² + Fire² + Air² + Water²) / (Matter + Earth)²
```

#### Greg's Energy Formula

```typescript
Greg's Energy = Heat - (Entropy × Reactivity)
```

### Key Classes

- `GregsEnergyCalculator` - Core calculations
- `PlanetaryInfluenceCalculator` - Current planetary effects
- `PlanetaryHourCalculator` - Planetary hour timing

### Usage

```typescript
import { GregsEnergyCalculator } from './core-energy-rules'

const result = GregsEnergyCalculator.calculateAllMetrics(
  { spirit: -3, essence: -4, matter: -7, substance: -3 },
  { fire: -1, water: -5, air: 0, earth: -2 }
)
```

## 📊 Chart Analysis (`astrological-chart-rules.ts`)

### Critical Features

- **Critical Degrees**: 0°, 1°, 13°, 26°, 29°
- **Anaretic Degree**: 29° (crisis and completion)
- **Chart Types**: Diurnal vs Nocturnal analysis
- **Modality Analysis**: Cardinal, Fixed, Mutable distribution
- **Elemental Balance**: Individual element analysis (no opposing elements)

### Key Classes

- `CriticalDegreeAnalyzer` - Degree significance
- `ChartTypeAnalyzer` - Day/night chart effects
- `ModalityAnalyzer` - Cardinal/Fixed/Mutable
- `ElementalAnalyzer` - Fire/Water/Air/Earth analysis
- `ComprehensiveChartAnalyzer` - Complete chart interpretation

### Usage

```typescript
import { ComprehensiveChartAnalyzer } from './astrological-chart-rules'

const analysis = ComprehensiveChartAnalyzer.analyzeChart(chartData)
// Returns: overallAssessment, keyThemes, optimalActivities, etc.
```

## 🍃 Food Recommendations (`food-recommendation-rules.ts`)

### Food Categories

- **Clearing**: Light, detoxifying (leafy greens, citrus, herbal teas)
- **Building**: Nourishing, strengthening (whole grains, proteins, root vegetables)
- **Balancing**: Harmonizing (seasonal fruits, steamed vegetables)
- **Transformative**: Dynamic change (fermented foods, spices)

### Advanced Constants Integration

- **Kalchm Constant**: System stability/tension indicator
- **Monica Constant**: Change resistance/support indicator

### Key Classes

- `KalchmFoodAnalyzer` - Main recommendation engine
- `PlanetaryMealTiming` - Planetary hour food timing
- `SeasonalFoodAdjustments` - Seasonal modifications

### Usage

```typescript
import { KalchmFoodAnalyzer } from './food-recommendation-rules'

const recommendations = KalchmFoodAnalyzer.analyzeFoodNeeds(
  alchemicalValues,
  elementalValues,
  thermodynamics,
  constants
)
```

## 📈 Daily Tracking (`daily-tracking-rules.ts`)

### Tracking Components

- **Daily Energy Readings**: Complete energy snapshots
- **Weekly Patterns**: Trend analysis and dominant themes
- **Monthly Trends**: Long-term evolution tracking
- **Rising Sign Precision**: Accuracy monitoring

### Key Classes

- `DailyEnergyTracker` - Core tracking system
- `RisingSignPrecisionTracker` - Accuracy validation
- `PatternRecognitionSystem` - Pattern identification

### Usage

```typescript
import { DailyEnergyTracker } from './daily-tracking-rules'

const currentState = DailyEnergyTracker.analyzeCurrentState()
const insights = DailyEnergyTracker.generateDailyInsights(new Date())
```

## 🎯 Main System (`planetary-rules-index.ts`)

### Complete Analysis Pipeline

```typescript
import PlanetaryRulesSystem from './planetary-rules-index'

const analysis = PlanetaryRulesSystem.performCompleteAnalysis(
  birthInfo, // Birth data
  currentChart // From alchemizer API
)

// Returns:
// - energyAnalysis: Thermodynamics, constants, planetary influence
// - chartAnalysis: Complete chart interpretation
// - foodRecommendations: Personalized food guidance
// - dailyGuidance: Optimal timing and activities
// - alerts: Important warnings and notifications
```

### System Validation

```typescript
const validation = PlanetaryRulesSystem.validateCalculations(results)
const healthCheck = PlanetaryRulesSystem.performSystemHealthCheck()
```

## 🔄 Core Principles

### 1. Elemental Logic (CRITICAL)

- ❌ **NO OPPOSING ELEMENTS** - Never treat Fire as opposing Water, or Earth as opposing Air
- ✅ **ELEMENTS REINFORCE THEMSELVES** - Like attracts like
- ✅ **ALL COMBINATIONS WORK** - Every element can harmonize with others
- ✅ **INDIVIDUAL VALUE** - Each element contributes unique qualities

### 2. Alchemizer Engine Integration

- Maintain core `alchemize()` function
- Preserve original `signs` and `planetInfo` data structures
- Keep original calculation methods while extending functionality

### 3. Negative Value Handling

- Negative alchemical values = clearing and release needed
- Negative elemental values = specific element deficiency
- Negative constants = system strain or resistance

### 4. Thermodynamic Consistency

- Heat, Entropy, Reactivity must be non-negative
- Greg's Energy = Heat - (Entropy × Reactivity)
- Values should be mathematically consistent

## 🚀 Getting Started

### Quick Setup

```typescript
// Import the main system
import PlanetaryRulesSystem from './lib/planetary-rules-index'

// Perform complete analysis
const results = PlanetaryRulesSystem.performCompleteAnalysis(birthInfo, chartFromAPI)

// Validate results
const validation = PlanetaryRulesSystem.validateCalculations(results)

if (validation.isValid) {
  console.log('Analysis complete:', results)
} else {
  console.error('Validation errors:', validation.errors)
}
```

### Individual Component Usage

```typescript
// Use specific analyzers
import {
  GregsEnergyCalculator,
  ComprehensiveChartAnalyzer,
  KalchmFoodAnalyzer,
} from './lib/planetary-rules-index'

// Calculate thermodynamics
const energy = GregsEnergyCalculator.calculateAllMetrics(alchemy, elements)

// Analyze chart
const chartAnalysis = ComprehensiveChartAnalyzer.analyzeChart(chartData)

// Get food recommendations
const foods = KalchmFoodAnalyzer.analyzeFoodNeeds(alchemy, elements, energy, constants)
```

## 🔧 Integration Points

### With Existing Alchemizer

```typescript
// lib/alchemizer.ts remains unchanged
// New rules extend and enhance existing functionality
import { alchemize } from './alchemizer'
import PlanetaryRulesSystem from './planetary-rules-index'

// Use together
const alchemizerResult = alchemize(birthInfo, horoscopeDict)
const enhancedAnalysis = PlanetaryRulesSystem.performCompleteAnalysis(birthInfo, alchemizerResult)
```

### API Integration

```typescript
// app/api/enhanced-analysis/route.ts
import PlanetaryRulesSystem from '@/lib/planetary-rules-index'

export async function POST(request: Request) {
  const { birthInfo, chartData } = await request.json()

  const analysis = PlanetaryRulesSystem.performCompleteAnalysis(birthInfo, chartData)

  return Response.json(analysis)
}
```

## ⚠️ Important Notes

1. **Always validate calculations** using the built-in validation system
2. **Respect elemental logic** - never implement opposing elements
3. **Handle negative values appropriately** - they indicate clearing, not errors
4. **Maintain alchemizer compatibility** - preserve original functionality
5. **Use proper typing** - TypeScript interfaces ensure consistency

## 📚 References

- Core Greg's Energy System notebook
- Kalchm & Monica Constant Calculations notebook
- Daily Energy Tracking notebook
- Rising Sign Precision Tracker notebook
- Current Moment Chart Analysis notebook

---

_This system provides a complete framework for advanced astrological analysis while maintaining compatibility with the original alchemizer engine._
