/**
 * Solana page render: a failed section is "—" with its reason; statuses in words.
 * PDA derivation doesn't run under jsdom, so pool addresses are stubbed.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/solana/constellation-amm', async importOriginal => {
  const real = await importOriginal<typeof import('@/lib/solana/constellation-amm')>()
  const { PublicKey } = await import('@solana/web3.js')
  return {
    ...real,
    getConstellationPoolAddress: (id: number) => new PublicKey(new Uint8Array(32).fill(id + 1)),
  }
})

import { buildSolanaChainReport, type ChainReader } from '@/lib/admin/solana-chain'
import { SolanaView } from '@/components/admin/pages/SolanaPage'

const failing: ChainReader = {
  rpcLabel: 'test-rpc',
  privateRpc: false,
  getAccount: async () => null,
  getAccounts: async () => {
    throw new Error('429 Too Many Requests')
  },
  getTokenSupply: async () => ({ amount: '1', decimals: 4, uiAmount: 0.0001 }),
  getBalanceLamports: async () => 12_000_000_000,
  countHolders: async () => 0,
}

describe('Solana page', () => {
  it('renders a failed section as "—" with its reason, and statuses in words', async () => {
    const r = await buildSolanaChainReport(failing, null, async () => ({
      sync: {
        connectionStatus: 'connected',
        queueDepth: 0,
        lastProcessedSlot: '1',
        lastError: null,
        heartbeatAt: new Date().toISOString(),
      },
      bridge: {
        connectionStatus: 'stopped',
        queueDepth: 4,
        lastProcessedSlot: null,
        lastError: 'stale',
        heartbeatAt: null,
      },
    }))
    render(<SolanaView data={JSON.parse(JSON.stringify(r))} />)
    const poolsCard = screen
      .getByRole('heading', { name: 'Constellation AMM pools' })
      .closest('section')!
    expect(within(poolsCard).getByLabelText('unknown: 429 Too Many Requests')).toBeInTheDocument()
    const programCard = screen.getByRole('heading', { name: 'Program' }).closest('section')!
    expect(
      within(programCard).getByLabelText(/^unknown: program account not found/)
    ).toBeInTheDocument()
    expect(screen.getByText('Not reporting')).toBeInTheDocument()
    expect(screen.getByText(/of 12 pass/)).toBeInTheDocument()
    expect(screen.getAllByText('Unknown').length).toBeGreaterThan(0)
  })
})
