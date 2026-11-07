/**
 * @file lib/mcp/prompts.ts
 *
 * Server-defined prompt blueprints for the Planetary Agents MCP Server (`agents.alchm.kitchen`).
 * Provides structured multi-step workflows for Meta Muse, Claude Desktop, Cursor, and
 * autonomous agents.
 */

export interface PromptArgument {
  name: string
  description?: string
  required?: boolean
}

export interface PromptDefinition {
  name: string
  description: string
  arguments?: PromptArgument[]
}

export interface PromptMessage {
  role: 'user' | 'assistant'
  content: {
    type: 'text'
    text: string
  }
}

export interface GetPromptResult {
  [key: string]: unknown
  description?: string
  messages: PromptMessage[]
}

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    name: 'mentor_match_consultation',
    description:
      'Match a user natal chart, active sky transits, or personal dilemma with the optimal historical mentor from the 71+ vessel roster, inspect their PVR 25–99 OVR & Seals, and conduct an in-character consultation.',
    arguments: [
      {
        name: 'dilemmaOrTopic',
        description:
          'The philosophical question, creative challenge, or personal dilemma to explore',
        required: true,
      },
      {
        name: 'element',
        description: 'Target elemental emphasis (Fire, Water, Earth, Air)',
        required: false,
      },
      {
        name: 'archetype',
        description:
          'Preferred mentor archetype or domain (e.g. Philosopher, Astronomer, Mystic, Strategist)',
        required: false,
      },
      {
        name: 'agentSlug',
        description:
          'Optional preferred mentor slug to anchor against (e.g. socrates, johannes-kepler, carl-jung)',
        required: false,
      },
    ],
  },
  {
    name: 'multi_agent_symposium',
    description:
      'Convene 2–3 historical personas with contrasting elemental and planetary signatures to deliberate a topic using transit-modulated persona syntax and Pentacle Zone synergies.',
    arguments: [
      {
        name: 'topic',
        description: 'The thesis, dilemma, or subject for the symposium to debate',
        required: true,
      },
      {
        name: 'agentSlug',
        description:
          'Lead historical agent slug (e.g. socrates, rumi, galileo-galilei, leonardo-da-vinci)',
        required: false,
      },
      {
        name: 'element',
        description: 'Primary elemental axis for the debate (Fire, Water, Earth, Air)',
        required: false,
      },
      {
        name: 'archetype',
        description: 'Archetypal lens for council selection (e.g. Philosopher, Mystic, Polymath)',
        required: false,
      },
    ],
  },
  {
    name: 'natal_sky_biwheel_reading',
    description:
      "Interpret live celestial transits against a historical agent's or user's natal anchor using the Natal-Sky Bi-Wheel overlay, Resonance Surge tiers, and 4D ESMS Wavefunction.",
    arguments: [
      {
        name: 'agentSlug',
        description:
          'Slug of the historical vessel to anchor the bi-wheel reading (e.g. johannes-kepler, carl-jung, hildegard-of-bingen)',
        required: true,
      },
      {
        name: 'element',
        description:
          'Optional elemental lens to highlight in the bi-wheel overlay (Fire, Water, Earth, Air)',
        required: false,
      },
      {
        name: 'archetype',
        description: 'Optional archetypal focus for the reading',
        required: false,
      },
    ],
  },
]

function buildMentorMatchConsultationPrompt(args?: Record<string, string>): GetPromptResult {
  const dilemma = args?.dilemmaOrTopic ?? 'navigating a major creative and intellectual transition'
  const elementClause = args?.element ? ` with ${args.element} elemental alignment` : ''
  const archetypeClause = args?.archetype ? ` focusing on the ${args.archetype} archetype` : ''
  const preferredClause = args?.agentSlug
    ? ` (considering '${args.agentSlug}' as a candidate anchor)`
    : ''

  return {
    description: `Mentor match consultation workflow for: ${dilemma}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Please match me with the optimal historical mentor for "${dilemma}"${elementClause}${archetypeClause}${preferredClause}. Follow this structured workflow:
1. Live Sky & Mentor Match:
   - Read 'agents://sky/current-transits' to observe the live planetary longitudes, lunar phase, and 4D ESMS sky wavefunction.
   - Call 'match_historical_mentor' with query/dilemma="${dilemma}"${args?.element ? `, element="${args.element}"` : ''}${args?.archetype ? `, archetype="${args.archetype}"` : ''} to rank the top 3 historical mentors by Natal-Sky Bi-Wheel resonance and PVR (25–99 OVR).
2. Deep Persona & PVR Inspection:
   - Read resource 'agents://persona/{slug}' for the #1 ranked mentor to inspect their natal chart placements, Sacred 7 communication traits, Alchemical Seals, and Pentacle Zone ECRs at zero token cost.
   - Optionally call 'inspect_agent_pvr_telemetry' to compare the top mentors' ESMS diamond and zone contest advantages.
3. In-Character Consultation:
   - Call 'simulate_agent_dialogue' with the top mentor and the dilemma to synthesize a transit-modulated response grounded in their authentic historical voice and active bi-wheel aspects.`,
        },
      },
    ],
  }
}

function buildMultiAgentSymposiumPrompt(args?: Record<string, string>): GetPromptResult {
  const topic = args?.topic ?? 'the harmony between mathematical necessity and poetic intuition'
  const leadAgent = args?.agentSlug ?? 'johannes-kepler'
  const elementClause = args?.element ? ` emphasizing ${args.element} elemental tension` : ''
  const archetypeClause = args?.archetype ? ` through the ${args.archetype} lens` : ''

  return {
    description: `Multi-agent symposium workflow debating: ${topic}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Convene a multi-agent historical symposium on "${topic}" anchored by '${leadAgent}'${elementClause}${archetypeClause}:
1. Roster & Sanctum Context:
   - Read 'agents://roster/historical' or 'agents://sanctum/council-chamber' to select 2–3 historical vessels with contrasting elemental and planetary ruling signatures (including '${leadAgent}').
2. Telemetry & Dyadic Comparison:
   - Call 'inspect_agent_pvr_telemetry' for the selected agents to compare their 25–99 OVR ratings, earned Alchemical Seals, and 11-zone Effective Contest Ratings (ECR).
3. Council Deliberation:
   - Call 'convene_agent_council' (or 'simulate_agent_dialogue') with the selected agent slugs and topic="${topic}" to synthesize each thinker's transit-modulated perspective vector, inter-chart synastry chord, and dialetical synthesis.`,
        },
      },
    ],
  }
}

function buildNatalSkyBiwheelReadingPrompt(args?: Record<string, string>): GetPromptResult {
  const slug = args?.agentSlug ?? 'johannes-kepler'
  const elementClause = args?.element ? ` with focus on the ${args.element} element` : ''

  return {
    description: `Natal-Sky Bi-Wheel reading anchored on ${slug}`,
    messages: [
      {
        role: 'user',
        content: {
          type: 'text',
          text: `Perform a complete Natal-Sky Bi-Wheel reading anchored on historical vessel '${slug}'${elementClause}:
1. Natal & Persona Blueprint:
   - Read 'agents://persona/${slug}' to retrieve ${slug}'s canonical natal chart placements, ruling planet faction, baseline 25–99 PVR OVR, and active transit syntax modifiers.
2. Live Sky & Bi-Wheel Overlay:
   - Read 'agents://sky/current-transits' for the current planetary positions, lunar phase, and 4D ESMS sky wavefunction.
   - Call 'match_historical_mentor' with userNatal set to ${slug}'s natal placements to compute the exact orb-weighted Natal-Sky Bi-Wheel aspects, Resonance Surge tier (+12/+8/+4 OVR), and allied historical mentors.
3. PVR & Seal Telemetry:
   - Call 'inspect_agent_pvr_telemetry' for '${slug}' to evaluate how earned Alchemical Seals (Copper through Celestial) and ambient alchemical tides shape their optimal Pentacle Zone.`,
        },
      },
    ],
  }
}

const PROMPT_BUILDERS: Record<string, (args?: Record<string, string>) => GetPromptResult> = {
  mentor_match_consultation: buildMentorMatchConsultationPrompt,
  multi_agent_symposium: buildMultiAgentSymposiumPrompt,
  natal_sky_biwheel_reading: buildNatalSkyBiwheelReadingPrompt,
}

export const PA_MCP_PROMPTS = PROMPT_DEFINITIONS

export function getPrompt(name: string, args?: Record<string, string>): GetPromptResult | null {
  const builder = PROMPT_BUILDERS[name]
  if (!builder) return null
  return builder(args)
}
