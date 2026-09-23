/**
 * The split admin pages keep the honesty contract: a failed source renders
 * "—" with its reason (per cell, where the page joins sources), a real zero
 * renders 0, and statuses carry a word.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/admin',
}))

import { AgentsView } from '@/components/admin/pages/AgentsPage'
import { BuildView } from '@/components/admin/pages/BuildPage'
import { ChatsView } from '@/components/admin/pages/ChatsPage'
import { OverviewView } from '@/components/admin/pages/OverviewPage'
import { InfrastructureView } from '@/components/admin/pages/SystemPages'
import { agentsFixture, buildFixture, chatsFixture, dashboardFixture } from './fixtures/admin-b2'

const unknownsIn = (el: HTMLElement) => within(el).queryAllByLabelText(/^unknown:/)

describe('Agents page', () => {
  it('a failed sync read leaves only its columns "—", with the reason', () => {
    render(<AgentsView data={agentsFixture({ syncFails: true })} />)
    const table = screen.getByRole('region', { name: 'Agent roster' })
    const unknowns = unknownsIn(table)
    // alchm.kitchen and last-activation columns for each of the 3 agents.
    expect(unknowns.length).toBe(6)
    for (const el of unknowns)
      expect(el.getAttribute('aria-label')).toBe('unknown: relation "users" does not exist')
    // The DB column still read.
    expect(within(table).getByText('Missing')).toBeInTheDocument()
    // WTEN's count is not exposed: "—", not 0.
    expect(
      screen.getByLabelText(/^unknown: alchm.kitchen exposes no agent roster count/)
    ).toBeInTheDocument()
  })

  it('reads real zeros as 0 and words every chart state', () => {
    render(<AgentsView data={agentsFixture()} />)
    expect(screen.getAllByText('Computed').length).toBeGreaterThan(0)
    expect(screen.getByText('No chart')).toBeInTheDocument()
    expect(screen.getByText('Unlinked')).toBeInTheDocument()
    const table = screen.getByRole('region', { name: 'Agent roster' })
    const rumi = within(table).getByText('Rumi').closest('tr')!
    expect(within(rumi).getAllByText('0').length).toBe(2)
  })
})

describe('Build health page', () => {
  it('shows the failed GitHub source with its reason and CI states in words', () => {
    render(<BuildView data={buildFixture()} />)
    expect(
      screen.getAllByLabelText('unknown: GitHub API rate limit reached').length
    ).toBeGreaterThan(0)
    expect(screen.getByText('Failing')).toBeInTheDocument()
    expect(screen.getByText('Passing')).toBeInTheDocument()
    expect(screen.getByText(/1 failing/)).toBeInTheDocument()
  })
})

describe('Chats page', () => {
  it('missing latency is "—", failures are words and counts', () => {
    render(<ChatsView data={chatsFixture()} />)
    const byModel = screen.getByRole('region', { name: 'Chats by model' })
    expect(unknownsIn(byModel).length).toBe(2)
    expect(within(byModel).getByText('(20%)')).toBeInTheDocument()
    const recent = screen.getByRole('region', { name: 'Recent chats' })
    expect(within(recent).getByText('Failed')).toBeInTheDocument()
    expect(within(recent).getByText('Answered')).toBeInTheDocument()
  })
})

describe('Overview and infrastructure', () => {
  it('a failed users read is "—" with its reason while other numbers stand', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{}', { status: 500 }))
    )
    render(<OverviewView data={dashboardFixture()} />)
    expect(screen.getByLabelText(/^unknown: P1001/)).toBeInTheDocument()
    expect(screen.getByText('12')).toBeInTheDocument()
    // Harmony with no scores is said, not drawn at 50%.
    expect(screen.getByText('No agent has all four element scores yet.')).toBeInTheDocument()
  })

  it('names configured keys as configured, and a down backend with its reason', () => {
    render(<InfrastructureView system={dashboardFixture().system} />)
    expect(screen.getByText('Unreachable')).toBeInTheDocument()
    expect(screen.getByText(/answered 502/)).toBeInTheDocument()
    expect(screen.getByText('groq: set')).toBeInTheDocument()
    expect(screen.getByText('openai: not set')).toBeInTheDocument()
  })
})
