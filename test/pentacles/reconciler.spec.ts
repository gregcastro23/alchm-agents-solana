// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { reconcileConversion } from '@/lib/pentacles/reconciler'

describe('Pentacle Reconciler (Section 4.2)', () => {
  it('settles escrow when Kitchen reports transaction was applied', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      expect(url).toContain('settle_pentacle_conversion')
      return { ok: true, status: 200, text: async () => '' }
    })

    const decision = await reconcileConversion('conv-123', { applied: true }, mockTransport as any)

    expect(decision.action).toBe('settle')
    expect(decision.conversionId).toBe('conv-123')
  })

  it('refunds escrow when Kitchen reports transaction was NOT applied', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      expect(url).toContain('refund_pentacle_conversion')
      return { ok: true, status: 200, text: async () => '' }
    })

    const decision = await reconcileConversion('conv-456', { applied: false }, mockTransport as any)

    expect(decision.action).toBe('refund')
    expect(decision.conversionId).toBe('conv-456')
  })
})
