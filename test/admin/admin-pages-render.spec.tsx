/**
 * The admin pages render the honesty contract: a failed read is "—" with its
 * reason, a real zero is 0, and every status carries a word, not just a colour.
 */
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'

vi.mock('@/lib/db', () => ({ prisma: {} }))

import { JobsView } from '@/components/admin/pages/JobsPage'
import { WtenLinkView } from '@/components/admin/pages/WtenLinkPage'
import {
  jobsFixture,
  jobsUnavailableFixture,
  wtenLinkFixture,
  wtenLinkUnavailableFixture,
} from './fixtures/admin-pages'

const unknowns = () => screen.queryAllByLabelText(/^unknown:/)

describe('Jobs page', () => {
  it('unreadable heartbeats: every job is Unknown with a reason, nothing reads 0', () => {
    render(<JobsView data={jobsUnavailableFixture()} />)
    expect(screen.getByText(/Source not provisioned/)).toBeInTheDocument()
    expect(screen.getAllByText('Unknown').length).toBe(7)
    expect(unknowns().length).toBeGreaterThanOrEqual(7 * 3)
    for (const el of unknowns())
      expect(el.getAttribute('aria-label')).toMatch(/cron_runs does not exist/)
    const card = screen.getByRole('heading', { name: 'agents/tick' }).closest('article')!
    expect(within(card).queryByText(/^0$/)).toBeNull()
  })

  it('live heartbeats: states in words, and a job with no runs is not "0 missed"', () => {
    render(<JobsView data={jobsFixture()} />)
    expect(screen.getAllByText('Retrying').length).toBeGreaterThan(0)
    expect(screen.getAllByText('OK').length).toBeGreaterThan(0)
    const scrabble = screen.getByRole('heading', { name: 'scrabble/tick' }).closest('article')!
    expect(within(scrabble).getByText('No runs yet')).toBeInTheDocument()
    expect(
      within(scrabble).getAllByLabelText(/^unknown: No heartbeat recorded yet/).length
    ).toBeGreaterThan(0)
    // Measured zero renders as 0.
    const feed = screen.getByRole('heading', { name: 'push-feed' }).closest('article')!
    expect(within(feed).getByText('0')).toBeInTheDocument()
    expect(screen.getByText('No clashes')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Crons by minute of the hour' })).toBeInTheDocument()
    expect(
      screen.getByText('Crons by minute of the hour', { selector: 'caption' })
    ).toBeInTheDocument()
  })
})

describe('WTEN link page', () => {
  it('shows secret verdicts in words and a real zero as 0', () => {
    render(<WtenLinkView data={wtenLinkFixture()} />)
    expect(screen.getByText('Matches WTEN')).toBeInTheDocument()
    expect(screen.getByText('Rejected by WTEN')).toBeInTheDocument()
    expect(screen.getByText(/ALCHM_KITCHEN_SYNC_SECRET does not match WTEN/)).toBeInTheDocument()
    const event = screen.getByRole('heading', { name: 'economy/sync-event' }).closest('article')!
    // Attempts and events were read, and are zero.
    expect(within(event).getByText('Attempts').nextElementSibling?.textContent).toBe('0')
    expect(within(event).getByText('Events').nextElementSibling?.textContent).toBe('0')
    expect(within(event).getByLabelText(/^unknown: No attempts in the window/)).toBeInTheDocument()
    expect(
      screen.getByText('Outcomes for economy/sync-debit', { selector: 'caption', exact: false })
    ).toBeInTheDocument()
  })

  it('an unreadable delivery log is "—" and a notice, never an empty table', () => {
    render(<WtenLinkView data={wtenLinkUnavailableFixture()} />)
    expect(screen.getByText(/Source unreadable/)).toBeInTheDocument()
    expect(screen.queryByText(/No deliveries recorded/)).toBeNull()
    expect(unknowns().length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Not set here')).toBeInTheDocument()
    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
