import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { createForgeAttempt, ForgeSuccessSchema, submitForge } from '@/lib/agents/forge-client'

const success = {
  success: true,
  agent: {
    id: 'agent-original',
    name: 'Ada',
    consciousness: { monicaConstant: 1.2, natalChart: { serverOnly: true } },
    personality: { serverOnly: true },
  },
  balances: { spirit: 1, essence: 2, matter: 3, substance: 4 },
  monicaMessage: 'Awakening complete.',
}

const input = { name: 'Ada', purpose: 'Explore', birthInfo: { year: 1990 } }

function bodyRequestId(body: unknown) {
  return z.object({ clientRequestId: z.string().uuid() }).parse(JSON.parse(String(body)))
    .clientRequestId
}

describe('forge request attempt identity', () => {
  it('uses one UUID for repeated submissions until a confirmed creation', () => {
    const attempt = createForgeAttempt()
    const first = attempt.prepare('creator-a', input)
    const second = attempt.prepare('creator-a', { ...input })

    expect(bodyRequestId(first.body)).toBe(first.clientRequestId)
    expect(second).toEqual(first)
    attempt.confirm(first.clientRequestId)
    expect(attempt.prepare('creator-a', input).clientRequestId).not.toBe(first.clientRequestId)
  })

  it('changes identity when the submitted input or creator changes', () => {
    const attempt = createForgeAttempt()
    const first = attempt.prepare('creator-a', input)
    const changedInput = attempt.prepare('creator-a', { ...input, name: 'Grace' })
    const changedCreator = attempt.prepare('creator-b', { ...input, name: 'Grace' })

    expect(changedInput.clientRequestId).not.toBe(first.clientRequestId)
    expect(changedCreator.clientRequestId).not.toBe(changedInput.clientRequestId)
    // A late response for the old submission cannot clear the newer submission's key.
    attempt.confirm(first.clientRequestId)
    expect(attempt.prepare('creator-b', { ...input, name: 'Grace' })).toEqual(changedCreator)
  })

  it('does not allocate or send an idempotency key for an anonymous request', () => {
    const newId = vi.fn(() => crypto.randomUUID())
    const attempt = createForgeAttempt(newId)
    expect(attempt.prepare(undefined, input)).toEqual({
      body: JSON.stringify(input),
      clientRequestId: undefined,
    })
    expect(newId).not.toHaveBeenCalled()
  })
})

describe('forge response confirmation', () => {
  it('validates the fields clients consume while allowing server-only fields', () => {
    expect(ForgeSuccessSchema.parse(success)).toEqual({
      ...success,
      agent: { id: 'agent-original', name: 'Ada', consciousness: { monicaConstant: 1.2 } },
    })
    expect(ForgeSuccessSchema.parse({ ...success, balances: null }).balances).toBeNull()
    expect(ForgeSuccessSchema.parse({ ...success, balances: undefined }).balances).toBeUndefined()
  })

  it('reuses the exact request after a lost response, then clears it after confirmation', async () => {
    const attempt = createForgeAttempt()
    const sentBodies: Array<RequestInit['body']> = []
    const fetcher: typeof fetch = async (_url, init) => {
      sentBodies.push(init?.body)
      if (sentBodies.length === 1) throw new TypeError('Response was lost after commit')
      return Response.json({ ...success, deduplicated: true })
    }

    await expect(submitForge(attempt, 'creator-a', input, fetcher)).rejects.toMatchObject({
      outcome: 'uncertain',
      message: expect.stringContaining('Retry the same request'),
    })
    const result = await submitForge(attempt, 'creator-a', input, fetcher)
    expect(result.agent.id).toBe('agent-original')
    expect(result.deduplicated).toBe(true)
    expect(sentBodies[1]).toBe(sentBodies[0])
    expect(attempt.prepare('creator-a', input).clientRequestId).not.toBe(
      bodyRequestId(sentBodies[0])
    )
  })

  it.each([
    { success: true },
    { ...success, agent: { ...success.agent, id: 42 } },
    { ...success, agent: { ...success.agent, consciousness: { monicaConstant: '1.2' } } },
    { ...success, balances: { ...success.balances, substance: '4' } },
    { ...success, monicaMessage: {} },
  ])('keeps the key and reports uncertain creation for malformed 2xx %#', async payload => {
    const attempt = createForgeAttempt()
    const prepared = attempt.prepare('creator-a', input)
    const fetcher: typeof fetch = async () => Response.json(payload)

    await expect(submitForge(attempt, 'creator-a', input, fetcher)).rejects.toMatchObject({
      outcome: 'uncertain',
    })
    expect(attempt.prepare('creator-a', input)).toEqual(prepared)
  })

  it('keeps the key when a 2xx body cannot be decoded', async () => {
    const attempt = createForgeAttempt()
    const prepared = attempt.prepare('creator-a', input)
    const fetcher: typeof fetch = async () => new Response('not JSON', { status: 200 })

    await expect(submitForge(attempt, 'creator-a', input, fetcher)).rejects.toMatchObject({
      outcome: 'uncertain',
    })
    expect(attempt.prepare('creator-a', input)).toEqual(prepared)
  })

  it('recognizes an explicit failure envelope even if the server uses 2xx', async () => {
    const attempt = createForgeAttempt()
    const prepared = attempt.prepare('creator-a', input)
    const fetcher: typeof fetch = async () =>
      Response.json({ success: false, error: 'Creation was rejected.' })

    await expect(submitForge(attempt, 'creator-a', input, fetcher)).rejects.toMatchObject({
      outcome: 'rejected',
      message: 'Creation was rejected.',
    })
    expect(attempt.prepare('creator-a', input)).toEqual(prepared)
  })

  it.each([400, 409, 500, 503])(
    'reports an HTTP %s rejection and preserves its retry key',
    async status => {
      const attempt = createForgeAttempt()
      const prepared = attempt.prepare('creator-a', input)
      const fetcher: typeof fetch = async () =>
        Response.json({ success: false, error: 'Server rejected the request.' }, { status })

      await expect(submitForge(attempt, 'creator-a', input, fetcher)).rejects.toMatchObject({
        outcome: 'rejected',
        message: 'Server rejected the request.',
      })
      expect(attempt.prepare('creator-a', input)).toEqual(prepared)
    }
  )

  it('uses the reserve explanation for a 402 and handles unreadable non2xx as a rejection', async () => {
    const attempt = createForgeAttempt()
    const insufficient: typeof fetch = async () =>
      Response.json(
        {
          success: false,
          error: 'Insufficient balance',
          monicaMessage: 'Your reserves are too low.',
        },
        { status: 402 }
      )
    await expect(submitForge(attempt, 'creator-a', input, insufficient)).rejects.toMatchObject({
      outcome: 'rejected',
      message: 'Your reserves are too low.',
    })

    const unreadable: typeof fetch = async () => new Response('not JSON', { status: 503 })
    await expect(submitForge(attempt, 'creator-a', input, unreadable)).rejects.toMatchObject({
      outcome: 'rejected',
      message: 'The forge rejected the request (503).',
    })
  })

  it('does not tell an anonymous user that replay is idempotent', async () => {
    const fetcher: typeof fetch = async () => new Response('not JSON', { status: 200 })
    await expect(
      submitForge(createForgeAttempt(), undefined, input, fetcher)
    ).rejects.toMatchObject({
      outcome: 'uncertain',
      message: expect.stringContaining('Check the Vault before trying again'),
    })
  })
})
