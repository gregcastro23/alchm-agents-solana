import { createHash } from 'node:crypto'
import { encodeAbiParameters, keccak256 } from 'viem'

export const ESMS_DECIMALS = 4 as const
export const MAX_LEDGER_ATOMS = 999_999_999_999n

const PERSONA_DOMAIN = Buffer.from('ASOL_PERSONA_V1', 'utf8')
const EPOCH_DOMAIN = Buffer.from('ASOL_EPOCH_V1', 'utf8')

export function ledgerUnitsToAtoms(value: string): bigint {
  const match = /^(\d{1,8})(?:\.(\d{1,4}))?$/.exec(value)
  if (!match) {
    throw new Error('ledger amount must be an unsigned Decimal(12,4) string')
  }

  const whole = BigInt(match[1])
  const fraction = BigInt((match[2] ?? '').padEnd(ESMS_DECIMALS, '0'))
  const atoms = whole * 10_000n + fraction

  if (atoms > MAX_LEDGER_ATOMS) {
    throw new Error('ledger amount exceeds Decimal(12,4)')
  }

  return atoms
}

export function hashTargetPersona(agentId: string, values: readonly number[]): string {
  if (values.length !== 64) {
    throw new Error('target persona must contain exactly 64 values')
  }

  const agentKey = sha256(Buffer.from(agentId.normalize('NFC'), 'utf8'))
  const personaBytes = Buffer.alloc(64 * Float64Array.BYTES_PER_ELEMENT)
  const view = new DataView(personaBytes.buffer, personaBytes.byteOffset, personaBytes.byteLength)

  values.forEach((value, index) => {
    if (!Number.isFinite(value)) {
      throw new Error(`target persona value ${index} is not finite`)
    }
    view.setFloat64(index * Float64Array.BYTES_PER_ELEMENT, Object.is(value, -0) ? 0 : value, true)
  })

  return sha256(Buffer.concat([PERSONA_DOMAIN, agentKey, personaBytes])).toString('hex')
}

export function canonicalizeContext(value: unknown): string {
  return canonicalJson(value)
}

export function hashEpochContext(value: unknown): string {
  return sha256(
    Buffer.concat([EPOCH_DOMAIN, Buffer.from(canonicalizeContext(value), 'utf8')])
  ).toString('hex')
}

export function openZeppelinStarLeaf(starId: number): string {
  if (!Number.isInteger(starId) || starId < 0 || starId > 0xffff_ffff) {
    throw new Error('star ID must be a uint32')
  }
  const encoded = encodeAbiParameters([{ type: 'uint32' }], [starId])
  return keccak256(keccak256(encoded))
}

export const REDEEM_AUTHORIZATION_DOMAIN = Buffer.from('ASOL_ESMS_REDEEM_V1', 'utf8')

export function buildRedeemAuthorizationVector(args: {
  programId: Uint8Array
  clusterDomain: Uint8Array
  holder: Uint8Array
  orderId: Uint8Array
  amounts: readonly [bigint, bigint, bigint, bigint]
  deadline: bigint
}): string {
  if (
    args.programId.length !== 32 ||
    args.clusterDomain.length !== 32 ||
    args.holder.length !== 32 ||
    args.orderId.length !== 32 ||
    args.amounts.length !== 4
  ) {
    throw new Error('All authorization vector identifiers must be 32 bytes with exactly 4 amounts')
  }
  const values = Buffer.alloc(8 * 5)
  args.amounts.forEach((amount, index) => values.writeBigUInt64LE(amount, index * 8))
  values.writeBigInt64LE(args.deadline, 32)
  const buffer = Buffer.concat([
    REDEEM_AUTHORIZATION_DOMAIN,
    Buffer.from(args.programId),
    Buffer.from(args.clusterDomain),
    Buffer.from(args.holder),
    Buffer.from(args.orderId),
    values,
  ])
  return buffer.toString('hex')
}

function sha256(value: Uint8Array): Buffer {
  return createHash('sha256').update(value).digest()
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('context numbers must be finite')
    }
    return JSON.stringify(Object.is(value, -0) ? 0 : value)
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(',')}]`
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map(key => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
      .join(',')}}`
  }
  throw new Error(`unsupported context value: ${typeof value}`)
}
