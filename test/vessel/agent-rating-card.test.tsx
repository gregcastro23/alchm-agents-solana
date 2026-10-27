import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AgentRatingCard } from '@/components/vessel/agent-rating-card'
import { getHistoricalAgent } from '@/lib/agents/historical'
import { SKY_BODIES, deriveLiveSky, type SkyLongitudes } from '@/lib/agents/rating/live-sky'
import {
  buildRatedAgentPayload,
  ratableFromRoster,
  type RatedVesselPayload,
} from '@/lib/agents/rating/vessel-payload'

// A Swiss-stamped sky (2026-10-15 05:43 UT), as `test/agents/vessel-payload.spec.ts` uses.
const LONGITUDES: Record<string, [number, boolean]> = {
  Sun: [201.893, false],
  Moon: [254.488, false],
  Mercury: [226.6762, false],
  Venus: [215.71, true],
  Mars: [129.7684, false],
  Jupiter: [141.9852, false],
  Saturn: [10.4673, true],
  Uranus: [65.2121, true],
  Neptune: [2.4796, true],
  Pluto: [303.0663, true],
}
const sky = deriveLiveSky(
  Object.fromEntries(
    SKY_BODIES.map(b => [b, { longitude: LONGITUDES[b][0], retrograde: LONGITUDES[b][1] }])
  ) as SkyLongitudes,
  'swiss-ephemeris',
  new Date('2026-10-15T05:43:00Z')
)

/** What the route would send for an agent, through the route's own builder and a JSON round trip. */
function rosterPayload(
  agentId: string,
  balances = { spirit: 12, essence: 3, matter: 60, substance: 0.7 }
): RatedVesselPayload {
  const vessel = ratableFromRoster(getHistoricalAgent(agentId)!)
  const payload = buildRatedAgentPayload({
    vessel,
    balances: { agentId: vessel.agentId, balances, esmsSource: 'database' },
    sky,
  })
  return JSON.parse(JSON.stringify(payload))
}
const newtonPayload = () => rosterPayload('isaac-newton')

const fetchMock = () => vi.mocked(global.fetch)
/** A fresh Response per call: a body can be read once. */
function answer(body: unknown, status = 200) {
  fetchMock().mockImplementation(async () => Response.json(body, { status }))
}

beforeEach(() => {
  global.fetch = vi.fn()
})
afterEach(() => cleanup())

describe('AgentRatingCard', () => {
  it('renders the route’s numbers: OVR, archetype, the seven ratings, every Seal and the surge', async () => {
    const payload = newtonPayload()
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)

    expect(screen.getByRole('status')).toHaveTextContent('Reading the live sky')
    const card = await screen.findByRole('region', {
      name: 'Pentacle Vessel Rating for Sir Isaac Newton',
    })

    expect(card).toHaveTextContent(`OVR${payload.ovr}`)
    expect(card).toHaveTextContent(payload.archetype.title)
    expect(card).toHaveTextContent(`Faction · ${payload.factionName}`)
    expect(card).toHaveTextContent('Swiss Ephemeris')
    expect(card).toHaveTextContent('Pentacle Vessel Rating Scale · 25–99')
    for (const [stat, rating] of Object.entries(payload.ratings)) {
      const label = stat[0].toUpperCase() + stat.slice(1)
      expect(card, stat).toHaveTextContent(`${label}${rating}`)
    }
    expect(screen.getByRole('img', { name: /^Sacred 7 ratings: Power \d+/ })).toBeInTheDocument()
    for (const seal of payload.sealProgress) expect(card, seal.name).toHaveTextContent(seal.name)
    expect(card).toHaveTextContent('Ledger holdings')
    expect(card).not.toHaveTextContent('computed from the baseline')

    const surge = payload.surge!
    expect(card).toHaveTextContent(`${Math.round(surge.meter)}Meter`)
    expect(card).toHaveTextContent(surge.active ? 'surge active' : 'Dormant')
    expect(screen.getByRole('progressbar', { name: 'Heat' })).toHaveAttribute(
      'aria-valuenow',
      String(Math.round(surge.heat * 100))
    )

    expect(fetchMock()).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock().mock.calls[0]
    expect(url).toBe('/api/agents/rating?agentId=isaac-newton')
    expect(init).toMatchObject({ cache: 'no-store' })
    // Same-origin by default: the session cookie goes, so a creator sees their own wallet.
    expect(init).not.toHaveProperty('credentials')
  })

  it('says where a Seal tops out rather than offering a tier it can never reach', async () => {
    const payload = newtonPayload()
    const power = payload.sealProgress.find(s => s.stat === 'power')!
    expect(power.maxTier).toBe('Astral') // the contract's documented ceiling for power
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    expect(card).toHaveTextContent('tops out at Astral')
  })

  it('names the active surge and its boosts', async () => {
    const payload = newtonPayload()
    const { primary, secondary } = payload.archetype
    payload.surge = {
      ...payload.surge!,
      meter: 84,
      active: true,
      surgeType: 'tempest',
      statBoosts: Object.fromEntries(
        Object.keys(payload.ratings).map(k => [k, k === primary ? 12 : k === secondary ? 8 : 4])
      ),
    }
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    expect(card).toHaveTextContent('Tempest surge active')
    expect(card).toHaveTextContent('+12')
    expect(card).toHaveTextContent('others +4')
  })

  it('shows a missing sky as missing, never as a calm ring', async () => {
    const payload = newtonPayload()
    payload.surge = null
    payload.sky = null
    payload.degraded = { sky: 'No sky could be computed' }
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    expect(card).toHaveTextContent('Sky unavailable')
    expect(card).toHaveTextContent('No sky could be computed')
    expect(card).not.toHaveTextContent('Meter')
    expect(card).not.toHaveTextContent('Dormant')
  })

  it('labels baseline holdings as a baseline, with the route’s reason', async () => {
    const payload = newtonPayload()
    payload.esmsSource = 'fallback'
    payload.degraded = { esms: 'owner wallet is private' }
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    expect(card).toHaveTextContent('Baseline holdings')
    expect(card).toHaveTextContent('(owner wallet is private)')
    expect(card).toHaveTextContent('computed from the baseline, not a wallet')
    expect(card).not.toHaveTextContent('Holds ')
  })

  it.each([
    [400, 'This vessel’s id cannot be rated', false],
    [404, 'No rating for this vessel', false],
    [422, 'Not enough recorded to rate this vessel', false],
    [429, 'Rating requests are being throttled', true],
    [503, 'The rating could not be read', true],
  ])('answers %i with its own message and the route’s reason', async (status, title, retry) => {
    answer({ success: false, error: `route says ${status}` }, status)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(title)
    expect(alert).toHaveTextContent(`route says ${status}`)
    expect(screen.queryByRole('button', { name: 'Retry' }) !== null).toBe(retry)
  })

  it('retries a transient failure on request', async () => {
    answer({ success: false, error: 'Too Many Requests' }, 429)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const retry = await screen.findByRole('button', { name: 'Retry' })
    answer(newtonPayload())
    fireEvent.click(retry)
    expect(await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })).toBeVisible()
    expect(fetchMock()).toHaveBeenCalledTimes(2)
  })

  it('refuses a payload that does not have the shape it reads, naming where', async () => {
    const { ratings: _dropped, ...broken } = newtonPayload()
    answer(broken)
    render(<AgentRatingCard agentId="isaac-newton" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected payload at ratings')
  })

  it('says the service could not be reached when the request itself fails', async () => {
    fetchMock().mockRejectedValue(new TypeError('Failed to fetch'))
    render(<AgentRatingCard agentId="isaac-newton" />)
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('could not be reached')
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument()
  })

  it('encodes the id, and abandons the request when unmounted', async () => {
    fetchMock().mockImplementation(() => new Promise<Response>(() => {}))
    const { unmount } = render(<AgentRatingCard agentId="agent-wren & co" />)
    await waitFor(() => expect(fetchMock()).toHaveBeenCalledTimes(1))
    const [url, init] = fetchMock().mock.calls[0]
    expect(url).toBe('/api/agents/rating?agentId=agent-wren%20%26%20co')
    expect(init?.signal?.aborted).toBe(false)
    unmount()
    expect(init?.signal?.aborted).toBe(true)
  })

  it('shows a harmony read from no chart as missing, not as a neutral 0.00', async () => {
    // Plato's chart is a placeholder: the route reads no harmony and sends harmonyOffset 0.
    const plato = rosterPayload('plato')
    expect(plato.isPlaceholder).toBe(true)
    expect(plato.surge!.harmonyOffset).toBe(0)
    expect(plato.sealProgress.every(seal => seal.natalAffinity === null)).toBe(true)
    answer(plato)
    render(<AgentRatingCard agentId="plato" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    expect(card).toHaveTextContent('Natal harmony — (no sourced chart)')
    expect(card).not.toHaveTextContent('Natal harmony 0.00')
  })

  it('prints a measured harmony when the chart was read', async () => {
    const payload = newtonPayload()
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    const offset = payload.surge!.harmonyOffset
    expect(card).toHaveTextContent(`Natal harmony ${offset > 0 ? '+' : ''}${offset.toFixed(2)}`)
  })

  it('never prints a balance at a gate it has not reached', async () => {
    // 1.999 Spirit is under Silver's gate of 2: it must not read "2.00" beside "needs holdings".
    const payload = rosterPayload('isaac-newton', {
      spirit: 1.999,
      essence: 9.996,
      matter: 249.6,
      substance: 0.4999,
    })
    answer(payload)
    render(<AgentRatingCard agentId="isaac-newton" />)
    const card = await screen.findByRole('region', { name: /Pentacle Vessel Rating for/ })
    for (const text of ['1.99 Spirit', '9.99 Essence', '249 Matter', '0.49 Substance']) {
      expect(card).toHaveTextContent(text)
    }
    for (const text of ['2.00 Spirit', '10.00 Essence', '250 Matter', '0.50 Substance']) {
      expect(card).not.toHaveTextContent(text)
    }
  })

  it('server-renders the loading state, without fetching', () => {
    const html = renderToStaticMarkup(<AgentRatingCard agentId="isaac-newton" />)
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Reading the live sky and the ledger')
    expect(fetchMock()).not.toHaveBeenCalled()
  })
})
