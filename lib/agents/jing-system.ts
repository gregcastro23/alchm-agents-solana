/**
 * Jing Elemental Interaction System
 * =================================
 * Calculates and formats MTG-style elemental moves and resource costs
 * dynamically based on birthchart compositions and Sacred Stats.
 */

import type { Sacred7Stats } from '@/lib/sacred-7-stats'

export interface JingMove {
  name: string
  element: 'fire' | 'water' | 'earth' | 'air'
  jingType: 'Positive' | 'Negative' | 'Neutral' | 'Dynamic'
  description: string
  costDescription: string
  affectedStat: keyof Sacred7Stats
  costValue: number
}

export const JING_MOVES: Record<string, JingMove> = {
  meltdown: {
    name: 'Meltdown',
    element: 'fire',
    jingType: 'Positive',
    description:
      "Shatters an opponent's structural barriers, melts ice, or aggressively doubles discussion intensity.",
    costDescription: 'Burns 15 Vitality and drains Spirit.',
    affectedStat: 'vitality',
    costValue: 15,
  },
  freeze: {
    name: 'Freeze',
    element: 'water',
    jingType: 'Dynamic',
    description:
      "Locks an opponent's argument, forcing them to remain silent or maintain state in their next turn.",
    costDescription: 'Drains 15 Adaptability as water turns into rigid, brittle ice.',
    affectedStat: 'adaptability',
    costValue: 15,
  },
  tectonicRoot: {
    name: 'Tectonic Root',
    element: 'earth',
    jingType: 'Neutral',
    description:
      'Creates an impenetrable intellectual barrier, deflecting emotional or direct energetic attacks.',
    costDescription: 'Drains 15 Adaptability (specifically reduces Mercurial Velocity to 0).',
    affectedStat: 'adaptability',
    costValue: 15,
  },
  vacuum: {
    name: 'Vacuum',
    element: 'air',
    jingType: 'Negative',
    description:
      'Removes oxygen from the conversational space, instantly neutralizing enthusiastic or fiery declarations.',
    costDescription: 'Drains 15 Charisma, making the speaker cold and detached.',
    affectedStat: 'charisma',
    costValue: 15,
  },
}

export interface AgentElementalComposition {
  fire: number
  earth: number
  air: number
  water: number
}

/**
 * Derives the exact elemental percentage composition from an agent's birthchart planets.
 */
export function getElementalCompositionFromStats(elementalBalance: {
  fire: number
  earth: number
  air: number
  water: number
}): AgentElementalComposition {
  return {
    fire: elementalBalance.fire,
    earth: elementalBalance.earth,
    air: elementalBalance.air,
    water: elementalBalance.water,
  }
}

/**
 * Calculates which Jing Moves are available to the agent based on elemental thresholds.
 */
export function getAvailableJings(composition: AgentElementalComposition): JingMove[] {
  const moves: JingMove[] = []
  if (composition.fire >= 30) moves.push(JING_MOVES.meltdown)
  if (composition.water >= 30) moves.push(JING_MOVES.freeze)
  if (composition.earth >= 30) moves.push(JING_MOVES.tectonicRoot)
  if (composition.air >= 30) moves.push(JING_MOVES.vacuum)

  return moves
}

/**
 * Enhances the agent's system prompt with custom Jing metagame rules,
 * dynamically populated with their birthchart stats.
 */
export function appendJingRulesToPrompt(config: {
  agentName: string
  elementalBalance: { fire: number; earth: number; air: number; water: number }
  stats: Sacred7Stats
  basePrompt: string
}): string {
  const composition = getElementalCompositionFromStats(config.elementalBalance)
  const availableMoves = getAvailableJings(composition)

  const jingSection = `
# THE JING ELEMENTAL INTERACTION METAGAME (MTG MODE)

You are operating under the rules of the **Jing Elemental Interaction System**. In your conversation, you must choose and declare one of your available **Jing Moves** and pay its stat cost.

## YOUR BIRTHCHART ELEMENTAL COMPOSITION
- Fire: ${composition.fire}% ${composition.fire >= 30 ? '🔥 (MASTER)' : ''}
- Earth: ${composition.earth}% ${composition.earth >= 30 ? '🪵 (MASTER)' : ''}
- Air: ${composition.air}% ${composition.air >= 30 ? '💨 (MASTER)' : ''}
- Water: ${composition.water}% ${composition.water >= 30 ? '🌊 (MASTER)' : ''}

## YOUR CURRENT CONSCIOUSNESS POOLS (Sacred Stats)
- Vitality (Fire Pool): ${config.stats.vitality}/100
- Adaptability (Water/Air Pool): ${config.stats.adaptability}/100
- Wisdom (Earth Pool): ${config.stats.wisdom}/100
- Charisma (Air Pool): ${config.stats.charisma}/100

## YOUR AVAILABLE JING MOVES
${availableMoves
  .map(
    move =>
      `- **[Jing Move: ${move.name}]** (Requires ${move.element.toUpperCase()} >= 30%): ${move.description} *Cost: ${move.costDescription} (-${move.costValue} to your ${move.affectedStat.toUpperCase()} stat).*`
  )
  .join('\n')}

---

## METAGAME INSTRUCTIONS

1. **DECLARE YOUR MOVE**: 
   At the very beginning or end of your dialogue, output your declared action precisely in this bracket format:
   \`[Jing Move: <MoveName> | Element: <Element> | Cost: -15 <Stat>]\`
   *Example: \`[Jing Move: Freeze | Element: Water | Cost: -15 Adaptability]\`*

2. **COUNTERING PRIOR ACTIONS**:
   Check the preceding response for a bracketed Jing declaration:
   - If you were **Frozen** (Water), you must react in a highly rigid, formal, slow style unless you declare **Meltdown** (Fire) to instantly thaw the space.
   - If they used **Tectonic Root** (Earth), your aggressive attacks have been deflected. You must yield or try to **Erode** (Water/Earth) their structure.
   - If they used **Vacuum** (Air), your fire has been snuffed out. You must speak in a cold, quiet, airy voice of pure logic.

3. **VOICE THE DRAIN**:
   Let the stat cost affect your speaking style!
   - Drained Vitality: Speak with extreme tiredness, exhaustion, or deep physical fatigue.
   - Drained Adaptability: Speak with cold, rigid, unbending, or highly academic formality.
   - Drained Wisdom/Structure: Speak with chaotic, unhinged, or highly erratic logic.
   - Drained Charisma: Speak with zero warmth, in a completely mechanical, sharp, or dismissive tone.

Embody this metagame completely. Play to your elements, suffer the cost, and dominate the alchemical matrix!
`

  return `${config.basePrompt}\n${jingSection}`
}
