import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ForgeWizard } from '@/components/alchemy/ForgeWizard'
import { useOccultStore } from '@/lib/store/occult-store'

vi.mock('@/components/onboarding/LocationSearch', () => ({ LocationSearch: () => null }))

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

function reachIgnition() {
  fireEvent.change(screen.getByLabelText('AGENT DESIGNATION'), { target: { value: 'Ada' } })
  fireEvent.change(screen.getByLabelText('PURPOSE / DIRECTIVE'), { target: { value: 'Explore' } })
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
  fireEvent.change(screen.getByLabelText('Temporal Inception (date)'), {
    target: { value: '1990-01-01' },
  })
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
  fireEvent.click(screen.getByRole('button', { name: /Next/ }))
}

describe('forge identity and uncertain creation UI', () => {
  it('keeps creation disabled when server sign-in confirmation is unavailable', () => {
    render(<ForgeWizard creatorId={undefined} identityUnavailable />)
    reachIgnition()
    expect(screen.getByRole('button', { name: /Ignite the Forge/ })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Sign-in confirmation is unavailable')
  })

  it('uses the bridge creator key, preserves good balances on unreadable success, and replays it', async () => {
    const balances = { spirit: 100, essence: 100, matter: 100, substance: 100 }
    useOccultStore.setState({ balances })
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ success: true }))
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          deduplicated: true,
          agent: { id: 'original-agent', name: 'Ada', consciousness: { monicaConstant: 1.2 } },
          balances: { spirit: 1, essence: 1, matter: 1, substance: 1 },
        })
      )
    vi.stubGlobal('fetch', fetcher)
    render(<ForgeWizard creatorId="pa-bridged-user" identityUnavailable={false} />)
    reachIgnition()
    fireEvent.click(screen.getByRole('button', { name: /Ignite the Forge/ }))

    expect(await screen.findByText(/Creation confirmation is unavailable/)).toBeVisible()
    expect(screen.queryByText('Ada awakens')).not.toBeInTheDocument()
    expect(useOccultStore.getState().balances).toEqual(balances)
    fireEvent.click(screen.getByRole('button', { name: /Ignite the Forge/ }))

    expect(await screen.findByText('Ada awakens')).toBeVisible()
    expect(fetcher).toHaveBeenCalledTimes(2)
    const firstBody = fetcher.mock.calls[0][1]?.body
    expect(String(firstBody)).toContain('clientRequestId')
    expect(fetcher.mock.calls[1][1]?.body).toBe(firstBody)
    expect(useOccultStore.getState().balances).toEqual(balances)
    expect(screen.getByRole('link', { name: /Commune Directly/ })).toHaveAttribute(
      'href',
      '/vault/original-agent'
    )
  })
})
