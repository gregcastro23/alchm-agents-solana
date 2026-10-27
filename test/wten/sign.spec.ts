// @vitest-environment node
import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { computeV1Signature, parseWebhookSecret, signStandardWebhook } from '@/lib/wten/sign'

describe('Standard Webhooks signing (lib/wten/sign)', () => {
  // Reference golden vector from Standard Webhooks spec / WTEN
  const GOLDEN_SECRET = 'whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw='
  const GOLDEN_ID = 'msg_p5jXN8AQM9LWM0D4loKWxJek'
  const GOLDEN_TIMESTAMP = 1614265330
  const GOLDEN_BODY = '{"test": 2432232314}'
  const EXPECTED_SIG = 'v1,g0hM9SsE+OTPJTGt/tmIKtSyZlE3uFJELVlNIOLJ1OE='

  it('matches the Standard Webhooks golden vector', () => {
    const result = signStandardWebhook({
      id: GOLDEN_ID,
      timestamp: GOLDEN_TIMESTAMP,
      body: GOLDEN_BODY,
      secretRaw: GOLDEN_SECRET,
    })

    expect(result.signature).toBe(EXPECTED_SIG)
    expect(result.headers).toEqual({
      'webhook-id': GOLDEN_ID,
      'webhook-timestamp': '1614265330',
      'webhook-signature': EXPECTED_SIG,
    })
  })

  it('agrees with node:crypto createHmac implementation', () => {
    const rawSecret = 'whsec_dGVzdC1zZWNyZXQta2V5LTEyMzQ1Njc4OTA='
    const id = 'msg_unit_test_99'
    const timestamp = 1727136000
    const body = JSON.stringify({ event: 'agent.sync', agentId: 'plato-001' })

    const res = signStandardWebhook({
      id,
      timestamp,
      body,
      secretRaw: rawSecret,
    })

    // Compute independently using node:crypto
    const decodedKey = Buffer.from('dGVzdC1zZWNyZXQta2V5LTEyMzQ1Njc4OTA=', 'base64')
    const toSign = `${id}.${timestamp}.${body}`
    const expectedSig =
      'v1,' + createHmac('sha256', decodedKey).update(toSign, 'utf8').digest('base64')

    expect(res.signature).toBe(expectedSig)
  })

  describe('parseWebhookSecret', () => {
    it('parses secret with whsec_ prefix', () => {
      const key = parseWebhookSecret('whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=')
      expect(key.length).toBe(24)
    })

    it('parses secret without whsec_ prefix', () => {
      const key = parseWebhookSecret('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=')
      expect(key.length).toBe(24)
    })

    it('trims surrounding whitespace', () => {
      const key = parseWebhookSecret('  whsec_MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw= \n')
      expect(key.length).toBe(24)
    })

    it('throws on empty string', () => {
      expect(() => parseWebhookSecret('')).toThrow('Webhook secret cannot be empty')
      expect(() => parseWebhookSecret('   ')).toThrow('Webhook secret cannot be empty')
    })

    it('throws when only prefix is present', () => {
      expect(() => parseWebhookSecret('whsec_')).toThrow(
        'Webhook secret cannot be empty after stripping whsec_ prefix'
      )
    })

    it('throws on invalid base64 characters', () => {
      expect(() => parseWebhookSecret('whsec_not-valid-base64!@#$')).toThrow(
        'Webhook secret must be a valid base64-encoded string'
      )
    })
  })

  describe('body types', () => {
    it('produces identical signature for string vs UTF-8 Uint8Array', () => {
      const secret = parseWebhookSecret(GOLDEN_SECRET)
      const sigString = computeV1Signature({
        id: GOLDEN_ID,
        timestamp: GOLDEN_TIMESTAMP,
        bodyBytes: GOLDEN_BODY,
        secret,
      })
      const sigBytes = computeV1Signature({
        id: GOLDEN_ID,
        timestamp: GOLDEN_TIMESTAMP,
        bodyBytes: new TextEncoder().encode(GOLDEN_BODY),
        secret,
      })
      expect(sigString).toBe(sigBytes)
      expect(sigString).toBe(EXPECTED_SIG)
    })

    it('signs empty body correctly', () => {
      const secret = parseWebhookSecret(GOLDEN_SECRET)
      const sig = computeV1Signature({
        id: GOLDEN_ID,
        timestamp: GOLDEN_TIMESTAMP,
        bodyBytes: '',
        secret,
      })
      expect(sig.startsWith('v1,')).toBe(true)
      // Independent check for empty body: `${id}.${timestamp}.`
      const decodedKey = Buffer.from('MfKQ9r8GKYqrTwjUPD8ILPZIo2LaLaSw=', 'base64')
      const toSign = `${GOLDEN_ID}.${GOLDEN_TIMESTAMP}.`
      const expected =
        'v1,' + createHmac('sha256', decodedKey).update(toSign, 'utf8').digest('base64')
      expect(sig).toBe(expected)
    })
  })
})
