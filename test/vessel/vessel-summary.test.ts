// @vitest-environment node

import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/auth', () => ({ auth: vi.fn() }))
vi.mock('@/lib/db', () => ({
  prisma: {
    users: { findUnique: vi.fn() },
    desktopApiKey: { findFirst: vi.fn(), update: vi.fn() },
    verifiedSolanaWallet: { findUnique: vi.fn() },
    agentJingDuel: { count: vi.fn(), findMany: vi.fn() },
  },
}))
vi.mock('@/lib/vessel/summary', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/vessel/summary')>()
  return { ...actual, loadVesselForUser: vi.fn() }
})

import { GET, OPTIONS } from '@/app/api/vessel/summary/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import {
  assembleVesselState,
  loadVesselForUser,
  type KitchenVesselLedger,
} from '@/lib/vessel/summary'
import { decodeSqlResult, foldDuels, identityHex } from '@/lib/vessel/spacetime-stats'

const WALLET = 'AhNRjjyhJ4dR6ZSvWyJNSpbJFbFnxhkRdUNMY31fJ3S5'
const ME = 'a'.repeat(64)
const THEM = 'b'.repeat(64)

const request = (query = '', headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost/api/vessel/summary${query}`, { headers })

beforeEach(() => {
  vi.clearAllMocks()
  ;(prisma.desktopApiKey.findFirst as any).mockResolvedValue(null)
  ;(prisma.desktopApiKey.update as any).mockResolvedValue({})
  ;(prisma.verifiedSolanaWallet.findUnique as any).mockResolvedValue({ solanaPubKey: WALLET })
  ;(loadVesselForUser as any).mockResolvedValue({ version: 1 })
})

describe('GET /api/vessel/summary — access control', () => {
  it('refuses anonymous callers', async () => {
    ;(auth as any).mockResolvedValue(null)
    const res = await GET(request())
    expect(res.status).toBe(401)
    expect(loadVesselForUser).not.toHaveBeenCalled()
  })

  it('never accepts a userId selector', async () => {
    ;(auth as any).mockResolvedValue({ user: { id: 'u1' } })
    const res = await GET(request('?userId=someone-else'))
    expect(res.status).toBe(400)
    expect(loadVesselForUser).not.toHaveBeenCalled()
  })

  it('refuses a wallet that is not the caller’s verified wallet', async () => {
    ;(auth as any).mockResolvedValue({ user: { id: 'u1', email: 'me@example.com' } })
    const res = await GET(request('?wallet=11111111111111111111111111111111'))
    expect(res.status).toBe(403)
    expect(loadVesselForUser).not.toHaveBeenCalled()
  })

  it('serves the session user, forwarding their cookie', async () => {
    ;(auth as any).mockResolvedValue({ user: { id: 'u1', email: 'me@example.com' } })
    const res = await GET(request(`?wallet=${WALLET}`, { cookie: 'session=abc' }))
    expect(res.status).toBe(200)
    expect(loadVesselForUser).toHaveBeenCalledWith({
      userId: 'u1',
      email: 'me@example.com',
      cookie: 'session=abc',
      walletAddress: WALLET,
    })
  })

  it('rejects an unknown desktop key without falling back to the cookie', async () => {
    ;(auth as any).mockResolvedValue({ user: { id: 'u1', email: 'me@example.com' } })
    const res = await GET(request('', { 'x-api-key': 'alchm_desktop_nope', cookie: 'session=abc' }))
    expect(res.status).toBe(401)
    expect(auth).not.toHaveBeenCalled()
    expect(loadVesselForUser).not.toHaveBeenCalled()
  })

  it('refuses the unlinked dev desktop token — it belongs to no user', async () => {
    const res = await GET(request('', { authorization: 'Bearer dev-desktop-token' }))
    expect(res.status).toBe(401)
    expect(prisma.desktopApiKey.findFirst).not.toHaveBeenCalled()
    expect(loadVesselForUser).not.toHaveBeenCalled()
  })

  it('serves the user a linked desktop key belongs to, with no cookie', async () => {
    ;(prisma.desktopApiKey.findFirst as any).mockResolvedValue({ id: 'k1', userId: 'op1' })
    ;(prisma.users.findUnique as any).mockResolvedValue({ id: 'op1', email: 'op@example.com' })
    const res = await GET(request('', { 'x-api-key': 'alchm_desktop_valid' }))
    expect(res.status).toBe(200)
    expect(auth).not.toHaveBeenCalled()
    expect(loadVesselForUser).toHaveBeenCalledWith({
      userId: 'op1',
      email: 'op@example.com',
      cookie: null,
      walletAddress: WALLET,
    })
  })

  it('ignores the retired X-Sync-Secret path', async () => {
    ;(auth as any).mockResolvedValue(null)
    const res = await GET(request('?email=op@example.com', { 'x-sync-secret': 'anything' }))
    expect(res.status).toBe(401)
    expect(prisma.users.findUnique).not.toHaveBeenCalled()
  })

  it('echoes CORS credentials only for allowlisted origins', async () => {
    const allowed = await OPTIONS(request('', { origin: 'https://pentacles.alchm.kitchen' }))
    expect(allowed.headers.get('access-control-allow-origin')).toBe(
      'https://pentacles.alchm.kitchen'
    )
    expect(allowed.headers.get('access-control-allow-credentials')).toBe('true')

    const denied = await OPTIONS(request('', { origin: 'https://evil.example' }))
    expect(denied.headers.get('access-control-allow-origin')).toBeNull()
  })
})

const kitchen: KitchenVesselLedger = {
  success: true,
  version: 1,
  generatedAt: '2026-09-16T00:00:00.000Z',
  balances: { spirit: 10.12345, essence: 5, matter: 3, substance: 2 },
  streakDays: 4,
  streams: {
    jingDuels: { esms: [1, 0, 0, 0], entries: 1, lastAt: null, sourceTypes: ['duel_yield'] },
    staking: { esms: [3, 3, 3, 3], entries: 16, lastAt: null, sourceTypes: ['daily_yield'] },
    pentaclesMelee: { esms: [0, 0, 0, 0], entries: 0, lastAt: null, sourceTypes: [] },
    kitchenAchievements: {
      esms: [0, 0, 2, 0],
      entries: 1,
      lastAt: null,
      sourceTypes: ['quest_reward'],
    },
  },
  quests: { achievementsUnlocked: 1, questsCompleted: 3, rewardsClaimed: 3 },
  recent: [],
}

const allOk = {
  kitchenLedger: { ok: true },
  agentsArena: { ok: true },
  spacetimedb: { ok: true },
  priceIndex: { ok: true },
}

describe('assembleVesselState', () => {
  it('passes ledger balances through quantized, never adding value', () => {
    const vessel = assembleVesselState({
      walletAddress: WALLET,
      kitchen,
      agents: null,
      pentacles: null,
      usdRail: null,
      sources: allOk,
      now: 1,
    })
    expect(vessel.balances).toMatchObject({ spirit: 10.1235, essence: 5, matter: 3, substance: 2 })
    expect(vessel.balances.totalUsdEquivalent).toBeNull()
    expect(vessel.streams.kitchenAchievements).toMatchObject({
      achievementsUnlocked: 1,
      questsCompleted: 3,
    })
    expect(vessel.streams.staking.starVaultAccrued).toBeNull()
  })

  it('values the vessel only against a published USD rail', () => {
    const vessel = assembleVesselState({
      walletAddress: null,
      kitchen,
      agents: null,
      pentacles: null,
      usdRail: { perTokenUsd: 0.5, source: 'stripe' },
      sources: allOk,
    })
    // (10.1235 + 5 + 3 + 2) × 0.5 = 10.06175 → cents
    expect(vessel.balances.totalUsdEquivalent).toBe(10.06)
  })

  it('reports unknown stats as null when their source is missing', () => {
    const vessel = assembleVesselState({
      walletAddress: null,
      kitchen: null,
      agents: null,
      pentacles: null,
      usdRail: { perTokenUsd: 1, source: null },
      sources: { ...allOk, kitchenLedger: { ok: false, detail: 'down' } },
    })
    expect(vessel.balances.totalUsdEquivalent).toBeNull()
    expect(vessel.streams.staking.streakDays).toBeNull()
    expect(vessel.streams.jingDuels.agentDuelsRecorded).toBeNull()
    expect(vessel.streams.pentaclesMelee.arenaTokens).toBeNull()
  })
})

describe('Pentacles SpacetimeDB decoding', () => {
  it('decodes SATS rows with options and enums', () => {
    const rows = decodeSqlResult([
      {
        schema: {
          elements: [
            { name: { some: 'duel_id' }, algebraic_type: { U64: [] } },
            {
              name: { some: 'target_agent' },
              algebraic_type: {
                Sum: {
                  variants: [
                    {
                      name: { some: 'some' },
                      algebraic_type: {
                        Sum: { variants: [{ name: { some: 'Sun' } }, { name: { some: 'Moon' } }] },
                      },
                    },
                    { name: { some: 'none' }, algebraic_type: { Product: { elements: [] } } },
                  ],
                },
              },
            },
          ],
        },
        rows: [
          [7, [0, [1, []]]],
          [8, [1, []]],
        ],
      },
    ])
    expect(rows).toEqual([
      { duel_id: 7, target_agent: 'Moon' },
      { duel_id: 8, target_agent: null },
    ])
  })

  it('normalizes identity shapes', () => {
    expect(identityHex({ __identity__: `0x${ME}` })).toBe(ME)
    expect(identityHex(ME.toUpperCase())).toBe(ME)
    expect(identityHex('not-an-identity')).toBeNull()
  })

  it('attributes wins from both sides of a duel', () => {
    const { wins, resolved, clashes } = foldDuels(
      [
        { duel_id: 1, initiator: ME, target_agent: 'Mars', winner_is_initiator: true },
        { duel_id: 2, initiator: THEM, target_player: ME, winner_is_initiator: true },
        { duel_id: 3, initiator: THEM, target_player: ME, winner_is_initiator: false },
        { duel_id: 4, initiator: ME, target_agent: 'Moon', winner_is_initiator: null },
        { duel_id: 5, initiator: THEM, target_agent: 'Sun', winner_is_initiator: true },
      ],
      ME,
      'pillar'
    )
    expect(wins).toBe(2)
    expect(resolved).toBe(3)
    expect(clashes.map(c => [c.duelId, c.won])).toEqual([
      ['pillar:1', true],
      ['pillar:2', false],
      ['pillar:3', true],
      ['pillar:4', null],
    ])
  })
})
