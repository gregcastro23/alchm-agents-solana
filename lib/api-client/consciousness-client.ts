import { z } from 'zod'

const defaultBackendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || process.env.BACKEND_URL || 'http://localhost:8000'

const AgentBlueprintSchema = z.object({
  identity: z.object({
    name: z.string(),
    title: z.string(),
    birthMoment: z.string().optional(),
    creator: z.string(),
    sourceCharts: z.any(),
  }),
  personality: z.any(),
  consciousness: z.object({
    monicaConstant: z.number(),
    level: z.string(),
    velocity: z.number(),
    resonance: z.number(),
  }),
  aiParams: z.object({
    temperature: z.number(),
    topP: z.number(),
    systemPrompt: z.string(),
  }),
  synthesis: z.any(),
  createdAt: z.string(),
})

export type AgentBlueprint = z.infer<typeof AgentBlueprintSchema>

export class ConsciousnessClient {
  constructor(private readonly backendUrl: string = defaultBackendUrl) {}

  private buildUrl(path: string): string {
    return `${this.backendUrl.replace(/\/$/, '')}${path}`
  }

  private async request(path: string, init?: RequestInit) {
    const response = await fetch(this.buildUrl(path), {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(
        `Consciousness backend request failed (${response.status}): ${text || response.statusText}`
      )
    }

    return response.json()
  }

  async createAgentOfMoment(
    birthChart: unknown,
    momentChart: unknown,
    additionalCharts: unknown[] = [],
    timestamp: string = new Date().toISOString()
  ): Promise<AgentBlueprint> {
    const payload = {
      birthChart,
      momentChart,
      additionalCharts,
      timestamp,
    }

    const data = await this.request('/api/consciousness-crafting/create-agent', {
      method: 'POST',
      body: JSON.stringify(payload),
    })

    const parsed = AgentBlueprintSchema.safeParse(data?.blueprint ?? data)
    if (!parsed.success) {
      throw new Error(`Invalid blueprint response from backend: ${parsed.error.message}`)
    }

    return parsed.data
  }
}
