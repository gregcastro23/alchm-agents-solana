/**
 * Standard Webhooks (v1 HMAC-SHA256) signing for outbound deliveries to WTEN (alchm.kitchen).
 *
 * Implements the Standard Webhooks v1 spec:
 *   to_sign = `${msg_id}.${timestamp}.${body_bytes}`
 *   signature = `v1,${base64(hmac_sha256(secret_bytes, to_sign))}`
 *
 * The shared secret is base64-encoded and may optionally be prefixed with `whsec_`.
 */
import { hmac } from '@noble/hashes/hmac'
import { sha256 } from '@noble/hashes/sha256'
import { utf8ToBytes } from '@noble/hashes/utils'

export interface SignWebhookParams {
  id: string
  timestamp: number
  bodyBytes: Uint8Array | string
  secret: Uint8Array
}

export interface StandardWebhookHeaders {
  'webhook-id': string
  'webhook-timestamp': string
  'webhook-signature': string
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64')
  }
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    const buf = Buffer.from(b64, 'base64')
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  }
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Parses a Standard Webhooks secret key.
 *
 * Strips whitespace and the optional `whsec_` prefix, then decodes the base64 string
 * into a raw Uint8Array secret key.
 */
export function parseWebhookSecret(raw: string): Uint8Array {
  const trimmed = raw.trim()
  if (!trimmed) {
    throw new Error('Webhook secret cannot be empty')
  }
  const b64 = trimmed.startsWith('whsec_') ? trimmed.slice(6) : trimmed
  if (!b64) {
    throw new Error('Webhook secret cannot be empty after stripping whsec_ prefix')
  }
  const b64Regex = /^[A-Za-z0-9+/=]+$/
  if (!b64Regex.test(b64)) {
    throw new Error('Webhook secret must be a valid base64-encoded string')
  }
  const key = base64ToBytes(b64)
  if (key.length === 0) {
    throw new Error('Webhook secret decoded to 0 bytes')
  }
  return key
}

/**
 * Computes the Standard Webhooks v1 signature string (`v1,<base64>`).
 */
export function computeV1Signature(params: SignWebhookParams): string {
  const { id, timestamp, bodyBytes, secret } = params
  const prefix = utf8ToBytes(`${id}.${timestamp}.`)
  const bodyUint8 = typeof bodyBytes === 'string' ? utf8ToBytes(bodyBytes) : bodyBytes

  const toSign = new Uint8Array(prefix.length + bodyUint8.length)
  toSign.set(prefix, 0)
  toSign.set(bodyUint8, prefix.length)

  const mac = hmac(sha256, secret, toSign)
  const b64 = bytesToBase64(mac)
  return `v1,${b64}`
}

/**
 * Computes the signature and returns standard webhook headers.
 */
export function signStandardWebhook(params: {
  id: string
  timestamp: number
  body: Uint8Array | string
  secretRaw: string
}): { id: string; timestamp: number; signature: string; headers: StandardWebhookHeaders } {
  const secretKey = parseWebhookSecret(params.secretRaw)
  const signature = computeV1Signature({
    id: params.id,
    timestamp: params.timestamp,
    bodyBytes: params.body,
    secret: secretKey,
  })
  return {
    id: params.id,
    timestamp: params.timestamp,
    signature,
    headers: {
      'webhook-id': params.id,
      'webhook-timestamp': String(params.timestamp),
      'webhook-signature': signature,
    },
  }
}
