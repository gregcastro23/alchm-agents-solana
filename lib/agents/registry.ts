// Agent registry and types for routing across the app

export type AgentRole =
  | 'transits'
  | 'alchemizer'
  | 'monica_mc'
  | 'temporal_delta'
  | 'synastry'
  | 'tarot'
  | 'narrative'
  | 'safety'
  | 'router'

export interface AgentDefinition<I = unknown, O = unknown> {
  id: string
  role: AgentRole
  description?: string
  model?: string
  tools?: string[]
  maxLatencyMs?: number
  budgetCents?: number
  confidenceThreshold?: number // 0..1
  handler?: (input: I) => Promise<O>
}

class AgentRegistry {
  private agents: Map<string, AgentDefinition> = new Map()

  register(agent: AgentDefinition): void {
    this.agents.set(agent.id, agent)
  }

  get(id: string): AgentDefinition | undefined {
    return this.agents.get(id)
  }

  list(): AgentDefinition[] {
    return Array.from(this.agents.values())
  }
}

export const agentRegistry = new AgentRegistry()

// Pre-register known agents with enhanced configurations
agentRegistry.register({
  id: 'router',
  role: 'router',
  description: 'Dispatches tasks to specialized agents',
  maxLatencyMs: 500,
  confidenceThreshold: 0.8,
})

agentRegistry.register({
  id: 'transits',
  role: 'transits',
  description: 'Current planetary positions and deltas',
  maxLatencyMs: 2000,
  confidenceThreshold: 0.9,
  budgetCents: 10,
})

agentRegistry.register({
  id: 'alchemizer',
  role: 'alchemizer',
  description: 'Alchemy quantities via alchm-backend or local fallback',
  maxLatencyMs: 5000,
  confidenceThreshold: 0.85,
  budgetCents: 25,
})

agentRegistry.register({
  id: 'monica_mc',
  role: 'monica_mc',
  description: 'Monica Constant calculator and validator',
  maxLatencyMs: 1000,
  confidenceThreshold: 0.95,
  budgetCents: 5,
})

agentRegistry.register({
  id: 'temporal_delta',
  role: 'temporal_delta',
  description: 'Temporal delta computation',
  maxLatencyMs: 1500,
  confidenceThreshold: 0.9,
  budgetCents: 10,
})

agentRegistry.register({
  id: 'synastry',
  role: 'synastry',
  description: 'Synastry/composite analysis',
  maxLatencyMs: 3000,
  confidenceThreshold: 0.8,
  budgetCents: 20,
})

agentRegistry.register({
  id: 'tarot',
  role: 'tarot',
  description: 'Tarot reading and interpretation',
  maxLatencyMs: 4000,
  confidenceThreshold: 0.75,
  budgetCents: 30,
})

agentRegistry.register({
  id: 'narrative',
  role: 'narrative',
  description: 'Natural language narrative generation',
  maxLatencyMs: 6000,
  confidenceThreshold: 0.7,
  budgetCents: 40,
})

agentRegistry.register({
  id: 'safety',
  role: 'safety',
  description: 'Content safety and validation',
  maxLatencyMs: 1000,
  confidenceThreshold: 0.95,
  budgetCents: 5,
})
