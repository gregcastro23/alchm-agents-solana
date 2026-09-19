// @vitest-environment node
import { describe, it, expect, vi } from 'vitest'
import { reconcileConversion, reconcileStaleEscrowsBatch } from '@/lib/pentacles/reconciler'

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

  it('batch driver reconciles stale escrows discovered in SpacetimeDB', async () => {
    const mockTransport = vi.fn(async (url: string) => {
      if (url.includes('/sql')) {
        // Return two stale escrows
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              rows: [
                {
                  conversion_id: 'conv-stale-1',
                  identity: 'ident-1',
                  status: 'escrowed',
                  created_at: new Date(Date.now() - 3600_000).toISOString(),
                  atoms: ['1000', '0', '0', '0'],
                },
                {
                  conversion_id: 'conv-stale-2',
                  identity: 'ident-2',
                  status: 'escrowed',
                  created_at: new Date(Date.now() - 3600_000).toISOString(),
                  atoms: ['0', '1000', '0', '0'],
                },
              ],
            },
          ],
        }
      }
      // Reducer calls settle or refund
      return { ok: true, status: 200, text: async () => '' }
    })

    const decisions = await reconcileStaleEscrowsBatch(10, mockTransport as any)
    expect(decisions).toHaveLength(2)
    expect(decisions[0].conversionId).toBe('conv-stale-1')
    expect(decisions[1].conversionId).toBe('conv-stale-2')
  })
})
