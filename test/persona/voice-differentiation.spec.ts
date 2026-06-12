import { beforeEach, describe, expect, it } from 'vitest'
import { buildAgentContext, clearAgentContextCache } from '@/lib/agents/persona/build-agent-context'

const REFERENCE_AGENTS = [
  {
    id: 'socrates',
    era: 'Ancient',
    specialty: 'Philosophy & Dialectic Method',
  },
  {
    id: 'albert-einstein',
    era: 'Modern',
    specialty: 'Theoretical Physics',
  },
  {
    id: 'voltaire',
    era: 'Enlightenment',
    specialty: 'Philosophy & Literature',
  },
  {
    id: 'hildegard-of-bingen',
    era: 'Medieval',
    specialty: 'Mystical Theology & Medicine',
  },
  {
    id: 'paulo-freire',
    era: 'Modern',
    specialty: 'Critical Pedagogy',
  },
] as const

function extractCommunicationStyle(personaBlock: string): string {
  const start = personaBlock.indexOf('## Your Communication Style')
  const end = personaBlock.indexOf('### Internal stat profile', start)
  if (start < 0 || end < 0) {
    throw new Error('Persona block missing Communication Style section')
  }
  return personaBlock.slice(start, end).trim()
}

describe('persona voice differentiation', () => {
  beforeEach(() => {
    clearAgentContextCache()
  })

  it('resolves every reference agent and produces a stable cache key', () => {
    for (const { id } of REFERENCE_AGENTS) {
      const ctx = buildAgentContext(id)
      expect(ctx, `agent ${id} should resolve`).not.toBeNull()
      expect(ctx!.personaBlock.length).toBeGreaterThan(500)
      expect(ctx!.cacheKey).toMatch(/^[a-f0-9]{16}$/)
    }
  })

  it.each(REFERENCE_AGENTS)(
    'includes era "$era" and specialty "$specialty" markers for $id',
    ({ id, era, specialty }) => {
      const ctx = buildAgentContext(id)
      expect(ctx).not.toBeNull()
      expect(ctx!.personaBlock).toContain(era)
      expect(ctx!.personaBlock).toContain(specialty)
    }
  )

  it('forbids leaking Sacred 7 / Monica system terminology in the closing rule', () => {
    for (const { id } of REFERENCE_AGENTS) {
      const ctx = buildAgentContext(id)!
      expect(ctx.personaBlock).toContain('Never reference them')
      expect(ctx.personaBlock).toContain('Monica Constant')
    }
  })

  it('produces a distinct Communication Style section for every reference agent', () => {
    const signatures = new Map<string, string>()
    for (const { id } of REFERENCE_AGENTS) {
      const ctx = buildAgentContext(id)!
      signatures.set(id, extractCommunicationStyle(ctx.personaBlock))
    }

    const values = [...signatures.values()]
    const unique = new Set(values)
    expect(
      unique.size,
      `expected every reference agent to have a distinct Communication Style; got duplicates among ${[...signatures.keys()].join(', ')}`
    ).toBe(values.length)
  })

  it('produces a distinct cacheKey for every reference agent', () => {
    const keys = REFERENCE_AGENTS.map(({ id }) => buildAgentContext(id)!.cacheKey)
    expect(new Set(keys).size).toBe(keys.length)
  })

  it.each(REFERENCE_AGENTS)('persona block snapshot — $id', ({ id }) => {
    const ctx = buildAgentContext(id)!
    expect(ctx.personaBlock).toMatchSnapshot('personaBlock')
    expect(ctx.cacheKey).toMatchSnapshot('cacheKey')
  })
})
