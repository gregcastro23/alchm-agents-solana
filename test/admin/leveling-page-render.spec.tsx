import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { LevelingView } from '@/components/admin/panels/CosmicLevelingPanel'
import { LevelingPage } from '@/components/admin/pages/AgentPanelPages'
import { LevelingReportSchema } from '@/lib/admin/leveling-schema'
import { levelingFixture } from './fixtures/leveling'

vi.mock('@/lib/db', () => ({ prisma: {} }))

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

function progressionTable() {
  return screen.getByRole('region', { name: 'Agent Vessel progression' })
}

function rowFor(name: string) {
  return within(progressionTable())
    .getByRole('button', { name: `Inspect ${name}` })
    .closest('tr')!
}

function orderedAgents() {
  return within(progressionTable())
    .queryAllByRole('button', { name: /^Inspect / })
    .map(button => button.textContent)
}

describe('admin Vessel progression interactions', () => {
  it('keeps recorded stats inspectable when experience is pending', () => {
    const data = levelingFixture()
    if (!data.progression.ok) throw new Error('Missing fixture progression')
    data.progression.value.agents[0].stats = data.progression.value.agents[1].stats
    render(<LevelingView data={data} initialAgentId="rumi" />)
    const stats = screen.getByRole('region', { name: 'Recorded stats while experience is pending' })
    expect(within(stats).getAllByRole('definition')).toHaveLength(19)
    expect(within(stats).getByText('solar Agency')).toBeInTheDocument()
    expect(screen.queryByText('Level 1 of 100')).not.toBeInTheDocument()
  })
  it('keeps unknown experience separate from recorded zero and includes level 100', () => {
    render(<LevelingView data={levelingFixture()} />)
    const pending = rowFor('Rumi')
    const pendingCells = within(pending).getAllByRole('cell')
    expect(pendingCells[1]).toHaveTextContent('—')
    expect(pendingCells[2]).toHaveTextContent('Experience pending')
    expect(within(pending).queryByText(/^0$/)).not.toBeInTheDocument()
    expect(within(pending).queryByText(/^1$/)).not.toBeInTheDocument()
    expect(
      within(pending).getAllByLabelText('unknown: No recorded experience is connected.')
    ).toHaveLength(7)
    const zeroCells = within(rowFor('Zeno of Citium')).getAllByRole('cell')
    expect(zeroCells[1]).toHaveTextContent(/^1$/)
    expect(zeroCells[2].firstChild?.textContent).toBe('0')
    expect(within(zeroCells[2]).getByText('100 to next level')).toBeInTheDocument()
    expect(within(rowFor('Isaac Newton')).getByText('100')).toBeInTheDocument()
    expect(
      within(rowFor('Isaac Newton')).getByText('Max level · EXP keeps accumulating')
    ).toBeInTheDocument()
    expect(screen.getByRole('row', { name: 'Experience pending 1' })).toBeInTheDocument()
  })

  it('labels positive, negative and neutral transit changes in words and with signs', () => {
    render(<LevelingView data={levelingFixture()} />)
    expect(within(rowFor('Ada Lovelace')).getByText('+2.2 Rising')).toBeInTheDocument()
    expect(within(rowFor('Isaac Newton')).getByText('-2.5 Falling')).toBeInTheDocument()
    expect(within(rowFor('Zeno of Citium')).getByText('0.0 Steady')).toBeInTheDocument()
  })

  it('combines rating status, search and sort without discarding pending agents', () => {
    render(<LevelingView data={levelingFixture()} />)
    expect(orderedAgents()).toEqual(['Isaac Newton', 'Ada Lovelace', 'Zeno of Citium', 'Rumi'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'name' },
    })
    expect(orderedAgents()).toEqual(['Ada Lovelace', 'Isaac Newton', 'Rumi', 'Zeno of Citium'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Rating status' }), {
      target: { value: 'live' },
    })
    expect(orderedAgents()).toEqual(['Ada Lovelace', 'Zeno of Citium'])
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find an agent' }), {
      target: { value: 'zeno-of-citium' },
    })
    expect(orderedAgents()).toEqual(['Zeno of Citium'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Rating status' }), {
      target: { value: 'pending' },
    })
    expect(screen.getByText('No agents match these filters.')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox', { name: 'Find an agent' }), {
      target: { value: '' },
    })
    expect(orderedAgents()).toEqual(['Rumi'])
    fireEvent.change(screen.getByRole('combobox', { name: 'Rating status' }), {
      target: { value: 'all' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort by' }), {
      target: { value: 'current' },
    })
    expect(orderedAgents()).toEqual(['Ada Lovelace', 'Isaac Newton', 'Zeno of Citium', 'Rumi'])
  })

  it('inspects the shared 19-stat display and canonical verified training evidence', () => {
    render(<LevelingView data={levelingFixture()} />)
    fireEvent.click(
      within(rowFor('Ada Lovelace')).getByRole('button', { name: 'Inspect Ada Lovelace' })
    )
    const inspection = screen.getByRole('region', {
      name: 'Ada Lovelace Two-Level Vessel Progression System',
    })
    expect(within(inspection).getByText('Level 15 of 100')).toBeInTheDocument()
    expect(within(inspection).getByText('19,725 EXP')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Open agent profile →' })).toHaveAttribute(
      'href',
      '/agent/ada-lovelace'
    )
    fireEvent.click(within(inspection).getByRole('button', { name: 'All 19 Stats' }))
    const labels = [
      'Power',
      'Resonance',
      'Wisdom',
      'Charisma',
      'Intuition',
      'Adaptability',
      'Vitality',
      'Solar Agency',
      'Lunar Receptivity',
      'Mercurial Velocity',
      'Venusian Coherence',
      'Martial Impetus',
      'Jovian Expansion',
      'Saturnian Structure',
      'Chironic Adaptation',
      'Uranian Surprisal',
      'Neptunian Resonance',
      'Plutonic Integration',
      'Kinetic Alignment',
    ]
    for (const label of labels) expect(within(inspection).getByText(label)).toBeInTheDocument()
    expect(within(inspection).getByText('+1.5')).toBeInTheDocument()
    expect(within(inspection).getByText('-0.5')).toBeInTheDocument()
    fireEvent.click(within(inspection).getByRole('button', { name: 'EXP Ledger' }))
    expect(within(inspection).getByText('Verified Manifest')).toBeInTheDocument()
    expect(within(inspection).getByText('789 verified training conversations')).toBeInTheDocument()
    expect(within(inspection).queryByText('Pending Verification')).not.toBeInTheDocument()
  })

  it('keeps a selected pending subject pending and resets inspection when selection changes', () => {
    render(<LevelingView data={levelingFixture()} initialAgentId="rumi" />)
    const pendingInspection = screen
      .getByRole('heading', { name: 'Rumi · Vessel inspection' })
      .closest('section')!
    expect(within(pendingInspection).getByText(/Experience pending/)).toBeInTheDocument()
    expect(within(pendingInspection).queryByRole('progressbar')).not.toBeInTheDocument()
    expect(within(pendingInspection).queryByText('Level 1 of 100')).not.toBeInTheDocument()
    fireEvent.click(
      within(rowFor('Ada Lovelace')).getByRole('button', { name: 'Inspect Ada Lovelace' })
    )
    const inspection = screen.getByRole('region', {
      name: 'Ada Lovelace Two-Level Vessel Progression System',
    })
    fireEvent.click(within(inspection).getByRole('button', { name: 'All 19 Stats' }))
    fireEvent.click(within(rowFor('Rumi')).getByRole('button', { name: 'Inspect Rumi' }))
    expect(
      screen.queryByRole('region', { name: /Two-Level Vessel Progression System/ })
    ).not.toBeInTheDocument()
    fireEvent.click(
      within(rowFor('Ada Lovelace')).getByRole('button', { name: 'Inspect Ada Lovelace' })
    )
    expect(screen.getByText('Expandable Rating Breakdown')).toBeInTheDocument()
  })

  it('leaves permanent and current progression readable when legacy EV telemetry fails', () => {
    render(<LevelingView data={levelingFixture({ legacyFails: true })} />)
    expect(screen.getByLabelText('unknown: Legacy EV database is unavailable.')).toBeInTheDocument()
    expect(within(rowFor('Ada Lovelace')).getByText('15')).toBeInTheDocument()
    expect(within(rowFor('Ada Lovelace')).getByText('+2.2 Rising')).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Legacy EV training' })).not.toBeInTheDocument()
  })
})

describe('validated leveling refresh', () => {
  it('retains the last validated roster if a later response has malformed nested stats', async () => {
    vi.useFakeTimers()
    const good = levelingFixture()
    if (!good.progression.ok) throw new Error('Fixture requires progression')
    const malformed = structuredClone(good) as any
    malformed.progression.value.agents[1].stats.kineticAlignment = 'invalid stat'
    expect(LevelingReportSchema.safeParse(malformed).success).toBe(false)
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(good))
      .mockResolvedValueOnce(Response.json(malformed))
    vi.stubGlobal('fetch', fetcher)
    const { unmount } = render(<LevelingPage />)
    await act(async () => {})
    expect(rowFor('Ada Lovelace')).toBeInTheDocument()
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000)
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('alert')).toHaveTextContent('Response did not match the expected shape')
    expect(screen.getByText('Showing the last good read below.')).toBeInTheDocument()
    expect(rowFor('Ada Lovelace')).toBeInTheDocument()
    expect(orderedAgents()).toHaveLength(4)
    unmount()
  })
})
