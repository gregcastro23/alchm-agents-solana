import { describe, it, expect } from 'vitest'
import { decideModel } from '@/lib/monica/router'

describe('Monica model routing', () => {
  it('defaults to mini', () => {
    const r = decideModel({ defaultModel: 'gpt-4o-mini', complexity: 'simple' })
    expect(r.modelId).toBe('gpt-4o-mini')
    expect(r.reason).toBe('default')
  })
  it('elevates on complexity', () => {
    const r = decideModel({ complexity: 'complex' })
    expect(r.modelId).toBe('gpt-4o')
    expect(r.reason).toBe('complexity_elevate')
  })
})
