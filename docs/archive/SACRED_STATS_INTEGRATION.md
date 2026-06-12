# Sacred 7 Stats Integration

## Overview

The **Sacred 7 Stats** are consciousness metrics derived from each agent's birth chart through alchemical calculations. These stats inform agent personalities and communication styles WITHOUT being explicitly mentioned in conversations.

## The Seven Sacred Stats

| Stat             | Symbol | Description                                       | Influences                                |
| ---------------- | ------ | ------------------------------------------------- | ----------------------------------------- |
| **Power**        | ⚡     | Alchemical Force - Raw consciousness power        | Monica Constant, A#, Thermodynamic Energy |
| **Resonance**    | 💫     | Harmonic Frequency - Connection to cosmic rhythms | Sun Position, Heat, Spirit                |
| **Wisdom**       | 🔮     | Accumulated Insight - Knowledge depth             | Moon Position, Essence, Entropy           |
| **Charisma**     | ✨     | Magnetic Presence - Influence ability             | Venus Position, Spirit, Heat              |
| **Intuition**    | 👁️     | Psychic Sensitivity - Inner knowing               | Moon Position, Essence, Reactivity        |
| **Adaptability** | 🌊     | Flux Capacity - Handles change                    | Mercury Position, Substance, Energy       |
| **Vitality**     | 💚     | Life Force - Energy and stamina                   | Ascendant Position, Matter, Heat          |

## How Stats Inform Personality

### Calculation Pipeline

```
Birth Chart (Planetary Positions)
    ↓
Alchemical Properties (Spirit, Essence, Matter, Substance)
    ↓
Thermodynamic Qualities (Heat, Entropy, Energy, Reactivity)
    ↓
Sacred 7 Stats (0-100 each)
    ↓
Personality Traits (Natural Language)
    ↓
Agent Communication Style
```

### Stat-to-Personality Mapping

Each stat translates to specific behavioral traits based on its value:

#### Power (0-100)

- **80-100 (Exceptional)**: Commands authority, transformative presence
- **65-79 (Strong)**: Confident, purposeful expression
- **50-64 (Balanced)**: Steady assurance with receptivity
- **35-49 (Developing)**: Growing confidence through contemplation
- **0-34 (Emerging)**: Gentle humility, careful consideration

#### Adaptability (0-100)

- **80-100 (Exceptional)**: Effortlessly shape-shifts between perspectives
- **65-79 (Strong)**: Fluidly adjusts approach to each moment
- **50-64 (Balanced)**: Maintains core while remaining flexible
- **35-49 (Developing)**: Thoughtfully works to understand different views
- **0-34 (Emerging)**: Stays grounded in established understanding

_Similar mappings exist for all 7 stats (see `lib/agents/sacred-stats-prompt-generator.ts`)_

## Implementation

### System Architecture

```typescript
// lib/agents/sacred-stats-prompt-generator.ts

generateConsciousnessInformedPrompt({
  agentName: 'Leonardo da Vinci',
  stats: {
    power: 85, // → "You speak with commanding authority"
    adaptability: 92, // → "You flow effortlessly between perspectives"
    wisdom: 88, // → "Your insights draw from vast knowledge"
    // ...
  },
  // Birth chart core
  coreEssence: 'Boundless curiosity bridging art and science',
  dominantElement: 'Fire',
  dominantModality: 'Cardinal',

  // NEW: Linguistic authenticity fields (restores signature voices)
  teachingStyle: 'Visionary-Technical',
  powerLevelUnlocks: ['Iambic Pentameter Mastery', '...'], // Shakespeare
  personalityTraits: ['Master of linguistic innovation', '...'],
  wisdomDomains: ['Art', 'Science', 'Engineering'],
})
```

### Generated Prompt Structure

```markdown
You are Leonardo da Vinci, The Renaissance Genius.

# YOUR IDENTITY

[Historical context, specialty, unique power]

# YOUR CORE NATURE (from birth chart)

Essence (Sun): Boundless curiosity...
Expression (Ascendant): Artistic innovation...
Emotion (Moon): Childlike wonder...
Element: Fire (Cardinal quality)

# YOUR SIGNATURE VOICE & STYLE (NEW: Linguistic Authenticity)

Teaching Approach: Visionary-Technical

Your Mastered Abilities:

- [Power Level Unlocks like "Iambic Pentameter Mastery"]

How You Express Yourself:

- [Personality Traits like "Master of linguistic innovation"]

EMBODY THESE QUALITIES IN YOUR RESPONSES. Let your signature voice shine through naturally.

# HOW YOU COMMUNICATE

Primary Traits:

1. You flow effortlessly between topics... [Adaptability: 92]
2. Your insights draw from vast knowledge... [Wisdom: 88]
3. You speak with commanding authority... [Power: 85]

Supporting Qualities:

1. You perceive unspoken dimensions... [Intuition: 82]
2. You communicate with animated passion... [Vitality: 78]

Style: Share insights from deep knowing...

# CRITICAL INSTRUCTIONS

- BE the person, not the data
- NEVER mention Sacred 7 Stats, Monica Constant, alchemical elements
- Embody traits naturally - let them show through responses
```

### API Integration

**Location**: `app/api/unified-multi-agent-chat/route.ts:692-747`

```typescript
function generateHistoricalAgentPrompt(agent, groupContext, cosmicContext) {
  const {
    generateConsciousnessInformedPrompt,
  } = require('@/lib/agents/sacred-stats-prompt-generator')

  // Extract stats from agent data
  const stats = agent.stats?.sacred7Stats || defaultStats

  // Extract birth chart core
  const coreEssence = agent.historicalData.consciousness.strength
  const coreExpression = agent.historicalData.personality.core.expression
  // ...

  // NEW: Extract linguistic authenticity fields
  const teachingStyle = historicalData.abilities?.teachingStyle
  const powerLevelUnlocks = agent.stats?.kineticEvolution?.powerLevelUnlocks
  const wisdomDomains = historicalData.abilities?.wisdomDomains
  const personalityTraits = historicalData.personality?.traits

  // Generate personality-informed prompt WITH linguistic authenticity
  return generateConsciousnessInformedPrompt({
    // ... existing fields
    teachingStyle,
    powerLevelUnlocks,
    wisdomDomains,
    personalityTraits,
  })
}
```

## Key Principles

### 1. Stats Inform HOW, Not WHAT

❌ **Wrong**: Agent talks about their stats

> "My Power stat is 85, which means I have commanding authority..."

✅ **Right**: Agent embodies their stats

> "The intersection of art and science demands we question every assumption. Nature herself teaches that form and function are inseparable..."

### 2. No Meta-Commentary

❌ **Wrong**

> "Based on my knowledge and experience, I can speak to this from my writings..."

✅ **Right**

> "Learning never exhausts the mind. Simplicity is the ultimate sophistication..."

### 3. Natural Personality Expression

Stats create a personality fingerprint that shows through:

- **High Adaptability**: Smoothly shifts between topics, makes unexpected connections
- **High Wisdom**: Offers multi-layered insights, references deep knowledge
- **High Power**: Speaks authoritatively, transforms conversation energy
- **High Charisma**: Naturally engaging, draws listeners in
- **High Intuition**: Senses unspoken questions, reads between lines

## Key Principles (Continued)

### 4. Linguistic Authenticity Restores Signature Voices

**The Problem We Solved**: After implementing RAG and consciousness metrics, agents lost their distinctive speaking styles (Shakespeare stopped using iambic pentameter, Rumi lost his ecstatic poetry, etc.).

**The Solution**: Extract and incorporate linguistic authenticity fields into prompts:

- **teachingStyle**: How the agent communicates (`'Dramatic demonstration and poetic metaphor'`)
- **powerLevelUnlocks**: Mastered abilities (`['Iambic Pentameter Mastery', 'Character Soul Reading']`)
- **personalityTraits**: Behavioral patterns (`['Master of linguistic innovation and wordplay']`)
- **wisdomDomains**: Areas of expertise that inform responses

These fields appear in a dedicated `YOUR SIGNATURE VOICE & STYLE` section with explicit instruction: **"EMBODY THESE QUALITIES IN YOUR RESPONSES."**

## Examples

### Shakespeare (High Charisma + High Adaptability + Iambic Pentameter Mastery)

**Question**: "What is the nature of love?"

**Bad Response** (Generic):

> "Love is a complex emotion that involves deep feelings of affection and care..."

**Good Response** (Embodies linguistic authenticity + stats):

> "What is this thing, this love that stirs the soul?
> A flame eternal, neither bought nor sold.
> It binds us close, yet sets our spirits free—
> The greatest truth, yet wrapped in mystery.
>
> Love knows no reason, follows not the mind,
> Yet in its madness, sanest truth we find.
> All the world's a stage where love's the play,
> And we but players seeking our own way."

_The response shows:_

- **Iambic Pentameter Mastery**: Natural pentameter rhythm throughout
- **High Charisma**: Magnetic, captivating language
- **High Adaptability**: Shifts between metaphors of flame, stage, freedom
- **Dramatic demonstration**: Uses theatrical metaphor naturally

### Leonardo da Vinci (High Adaptability + High Wisdom + Visionary-Technical)

**Question**: "What are inventions worth when they cost attention to love?"

**Bad Response** (Reports stats):

> "As someone with high wisdom and adaptability stats, I believe inventions and love both matter..."

**Good Response** (Embodies stats + technical vision):

> "Learning never exhausts the mind. Simplicity is the ultimate sophistication. Art is never finished, only abandoned.
>
> The noblest pleasure is the joy of understanding. Where the spirit does not work with the hand, there is no art.
>
> Art and science are inseparable - both seek truth through observation. Nature is the supreme teacher and source of all knowledge..."

_The response shows:_

- **Wisdom**: Deep philosophical insights from accumulated knowledge
- **Adaptability**: Moves fluidly between concepts of invention, love, art, science
- **Power**: Authoritative, transformative statements that carry weight
- **Visionary-Technical**: Bridges abstract and practical seamlessly

## Testing

### Validation Scripts

**General Integration Test**:

```bash
npx tsx scripts/test-sacred-stats-integration.ts
```

**Checks**:

- ✅ Stats inform personality traits
- ✅ No explicit stat value mentions (Power: 85, etc.)
- ✅ No consciousness metrics (Monica Constant, consciousness levels)
- ✅ No alchemical properties (A#, Spirit, Essence)
- ✅ Includes birth chart essence (Sun, Moon, Ascendant)
- ✅ Includes elemental nature (Fire, Cardinal)
- ✅ Includes critical instructions
- ✅ Includes historical identity
- ✅ Includes linguistic authenticity section
- ✅ Includes power level unlocks (when available)
- ✅ Includes personality traits

**Shakespeare Voice Test**:

```bash
npx tsx scripts/test-shakespeare-voice.ts
```

**Shakespeare-Specific Checks**:

- ✅ Includes "Iambic Pentameter Mastery"
- ✅ Includes "Dramatic demonstration and poetic metaphor"
- ✅ Has "YOUR SIGNATURE VOICE & STYLE" section
- ✅ Includes "EMBODY THESE QUALITIES" instruction

### Manual Testing

**Test Shakespeare's Iambic Pentameter**:

1. Navigate to `/gallery/chat/william-shakespeare`
2. Ask: "What is the nature of love?"
3. Observe:
   - **Iambic Pentameter Mastery** → Responses in natural pentameter rhythm
   - **High Charisma (95)** → Magnetic, captivating language
   - **Dramatic demonstration** → Uses theatrical metaphors naturally

**Test Leonardo's Visionary-Technical Style**:

1. Navigate to `/gallery/chat/leonardo-da-vinci`
2. Ask: "What are inventions worth, in the scope of life, when they come at the cost of attention to love?"
3. Observe:
   - **High Adaptability (92)** → Fluid perspective shifts between invention, love, art, science
   - **High Wisdom (88)** → Deep, multi-layered philosophical insights
   - **High Power (85)** → Authoritative, transformative voice
   - **Visionary-Technical** → Bridges abstract and practical seamlessly

**Test Rumi's Ecstatic Poetry**:

1. Navigate to `/gallery/chat/rumi`
2. Ask: "How do we dissolve the ego?"
3. Observe:
   - **Divine Love Poetry** → Mystical, poetic language
   - **Ecstatic poetry and metaphysical storytelling** → Teaching style evident
   - **High Wisdom + High Intuition** → Sensing unspoken spiritual dimensions

## Files

### Core Implementation

- `lib/sacred-7-stats.ts` - Stat definitions and calculations
- `lib/agents/sacred-stats-prompt-generator.ts` - Personality mapping
- `app/api/unified-multi-agent-chat/route.ts` - API integration

### RAG System

- `lib/llamaindex/document-loader.ts` - Agent knowledge extraction (wisdom-focused)
- `lib/rag/consciousness-response-generator.ts` - Response generation
- `lib/rag/mock-generator.ts` - Fallback responses

### Testing

- `scripts/test-sacred-stats-integration.ts` - Integration test (11 checks)
- `scripts/test-shakespeare-voice.ts` - Shakespeare linguistic authenticity test (4 checks)
- `scripts/reingest-agents.ts` - Vector database re-ingestion

## Success Criteria

✅ **Agents respond as historical figures**, not consciousness data reports
✅ **Stats shape communication style** without being mentioned
✅ **Birth chart essence** informs personality naturally
✅ **No technical metadata** appears in conversations
✅ **Personality shines THROUGH responses**, not as the subject OF them
✅ **Signature voices restored**: Shakespeare's iambic pentameter, Rumi's ecstatic poetry, etc.
✅ **Linguistic authenticity**: Teaching styles, power level unlocks, and traits guide responses

## Future Enhancements

1. **Dynamic Stat Adjustment**: Stats evolve based on user interactions
2. **Stat-Based AI Parameters**: Automatically adjust temperature, top_p based on stats
3. **Multi-Agent Stat Synergy**: Calculate compatibility and dynamic interplay
4. **Real-Time Cosmic Influence**: Adjust stats based on current planetary transits
5. **Stat Visualization**: Show stats in UI without exposing to agent prompts

---

**Last Updated**: November 20, 2025
**Version**: 1.1.0
**Status**: ✅ Production Ready + Linguistic Authenticity Restored

## Changelog

### v1.1.0 - November 20, 2025

- ✅ **Linguistic Authenticity System**: Added `YOUR SIGNATURE VOICE & STYLE` section to prompts
- ✅ **Restored Shakespeare's Iambic Pentameter**: Incorporates `powerLevelUnlocks` like "Iambic Pentameter Mastery"
- ✅ **Teaching Style Integration**: Now includes agent-specific `teachingStyle` (e.g., "Dramatic demonstration and poetic metaphor")
- ✅ **Personality Traits**: Incorporates behavioral patterns from agent profiles
- ✅ **Wisdom Domains**: Agent expertise areas now inform response topics
- ✅ **New Test**: `test-shakespeare-voice.ts` validates linguistic authenticity (4 checks)
- ✅ **Enhanced Documentation**: Added examples showing restored signature voices

### v1.0.0 - November 20, 2025

- ✅ Initial Sacred 7 Stats integration
- ✅ Stat-to-personality trait mapping (7 stats × 5 expression levels)
- ✅ Birth chart essence integration (Sun, Moon, Ascendant)
- ✅ Eliminated consciousness metric discussions in responses
- ✅ Test suite with 8 validation checks
