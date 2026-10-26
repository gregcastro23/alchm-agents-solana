// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  FORGE_INPUT,
  OWNER_FREE_TEXT,
  chartKeyPaths,
  forgeVessel,
  keyPaths,
  numberLeaves,
} from './support/forge'

// The real POST /api/create-agent into the real HistoricalAgentsService.createAgent; only the edges
// are faked (see support/forge.ts). What is asserted is what reaches the database.
describe('POST /api/create-agent: what the forge persists in historical_agents.aura', () => {
  it('stores scalars only: monicaConstant and consciousness, never the chart synthesis', async () => {
    const { writtenData } = await forgeVessel({ creatorId: 'user-creator-1' })

    expect(Object.keys(writtenData.aura).sort()).toEqual(['consciousness', 'monicaConstant'])
    expect(Object.keys(writtenData.aura.consciousness).sort()).toEqual([
      'essence',
      'matter',
      'spirit',
      'substance',
    ])
    for (const value of numberLeaves(writtenData.aura)) expect(Number.isFinite(value)).toBe(true)
    expect(writtenData.aura.monicaConstant).toBe(writtenData.monicaConstant)
  })

  it('leaves no birth chart anywhere under aura: no sourceCharts, ascendant, houses, bodies or degrees', async () => {
    const { writtenData } = await forgeVessel()

    expect(keyPaths(writtenData.aura).filter(p => p.includes('sourceCharts'))).toEqual([])
    expect(chartKeyPaths(writtenData.aura)).toEqual([])
    // not even as a number: no degree of the stored chart is reachable from the aura
    const chartDegrees = numberLeaves(writtenData.natalChart).filter(n => !Number.isInteger(n))
    expect(chartDegrees.length).toBeGreaterThan(10)
    for (const degree of chartDegrees) expect(numberLeaves(writtenData.aura)).not.toContain(degree)
  })

  it('still stores the chart where it belongs, in the private natalChart column', async () => {
    const { writtenData } = await forgeVessel()

    const paths = chartKeyPaths(writtenData.natalChart).map(p => p.split('.').pop()!.toLowerCase())
    expect(paths).toEqual(
      expect.arrayContaining(['ascendant', 'houses', 'celestialbodies', 'degrees'])
    )
    expect(writtenData.craftedBy).toBe('philosopher-stone-user')
    expect(writtenData.historicalEra).toBe('user_created')
  })

  it('stores the same aura for the legacy request shape (birthDate/birthTime/birthLocation)', async () => {
    const { writtenData } = await forgeVessel({
      input: {
        birthInfo: undefined,
        birthDate: '1987-06-23',
        birthTime: '05:41',
        birthLocation: {
          name: 'Seattle, WA',
          latitude: 47.6062,
          longitude: -122.3321,
          timezone: 'America/Los_Angeles',
        },
      },
    })

    expect(Object.keys(writtenData.aura).sort()).toEqual(['consciousness', 'monicaConstant'])
    expect(chartKeyPaths(writtenData.aura)).toEqual([])
    expect(writtenData.birthLocation).toEqual({ lat: 47.6062, lon: -122.3321, name: 'Seattle, WA' })
  })

  it('does not copy the owner free text into aura (it lives in personalityCore, which the readers project)', async () => {
    const { writtenData } = await forgeVessel()

    for (const text of Object.values(OWNER_FREE_TEXT)) {
      expect(JSON.stringify(writtenData.aura)).not.toContain(text)
    }
    expect(writtenData.personalityCore.userProvidedContext).toEqual(OWNER_FREE_TEXT)
    expect(FORGE_INPUT.personalContext).toEqual(OWNER_FREE_TEXT)
  })

  it('writes the creator ledger row for a signed-in forger and none for an anonymous one', async () => {
    const signedIn = await forgeVessel({ creatorId: 'user-creator-1' })
    expect(signedIn.createdAgentsRow?.creatorId).toBe('user-creator-1')
    expect(signedIn.createdAgentsRow?.blueprint.agentId).toBe(signedIn.agentId)

    const anonymous = await forgeVessel()
    expect(anonymous.createdAgentsRow).toBeNull()
  })
})
