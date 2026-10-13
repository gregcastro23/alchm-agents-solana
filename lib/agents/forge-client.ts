import { z } from 'zod'
import type { ForgeSuccessResponse } from '@/lib/agents/forge-creation'

/** Resolved by the server's native + kitchen-bridge auth before the forge is interactive. */
export interface ForgeIdentity {
  creatorId: string | undefined
  identityUnavailable: boolean
}

// Only the fields rendered by the forge clients belong to this reader contract.
export const ForgeSuccessSchema = z.object({
  success: z.literal(true),
  agent: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    consciousness: z.object({ monicaConstant: z.number().finite() }),
  }),
  balances: z
    .object({
      spirit: z.number().finite(),
      essence: z.number().finite(),
      matter: z.number().finite(),
      substance: z.number().finite(),
    })
    .nullable()
    .optional(),
  monicaMessage: z.string().optional(),
  deduplicated: z.boolean().optional(),
})

export type ForgeSuccess = z.infer<typeof ForgeSuccessSchema>

type AssertCompatible<T extends true> = T
export type ForgeProducerCompatibility = AssertCompatible<
  ForgeSuccessResponse extends ForgeSuccess ? true : false
>

const RejectionSchema = z.object({
  success: z.literal(false).optional(),
  error: z.string().optional(),
  monicaMessage: z.string().optional(),
})

export class ForgeSubmissionError extends Error {
  constructor(
    message: string,
    readonly outcome: 'rejected' | 'uncertain'
  ) {
    super(message)
    this.name = 'ForgeSubmissionError'
  }
}

/** One submitted input retains its key until creation is confirmed or the input/creator changes. */
export function createForgeAttempt(newId: () => string = () => crypto.randomUUID()) {
  let pending: { creatorId: string; input: string; clientRequestId: string } | undefined

  return {
    prepare(creatorId: string | undefined, input: object) {
      const serialized = JSON.stringify(input)
      if (!creatorId) {
        pending = undefined
        return { body: serialized, clientRequestId: undefined }
      }
      if (pending?.creatorId !== creatorId || pending.input !== serialized) {
        pending = { creatorId, input: serialized, clientRequestId: newId() }
      }
      return {
        body: JSON.stringify({ ...input, clientRequestId: pending.clientRequestId }),
        clientRequestId: pending.clientRequestId,
      }
    },
    confirm(clientRequestId: string | undefined) {
      if (pending?.clientRequestId === clientRequestId) pending = undefined
    },
  }
}

/** A transport failure or unreadable success may already have committed: keep the attempt key. */
export async function submitForge(
  attempt: ReturnType<typeof createForgeAttempt>,
  creatorId: string | undefined,
  input: object,
  fetcher: typeof fetch = fetch
): Promise<ForgeSuccess> {
  const request = attempt.prepare(creatorId, input)
  const uncertainMessage = creatorId
    ? 'Creation confirmation is unavailable. Your agent may already exist. Retry the same request without changing its details to check the original creation.'
    : 'Creation confirmation is unavailable. Your agent may already exist. Check the Vault before trying again.'
  let response: Response
  try {
    response = await fetcher('/api/create-agent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: request.body,
    })
  } catch {
    throw new ForgeSubmissionError(uncertainMessage, 'uncertain')
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    if (response.ok) throw new ForgeSubmissionError(uncertainMessage, 'uncertain')
    throw new ForgeSubmissionError(
      `The forge rejected the request (${response.status}).`,
      'rejected'
    )
  }

  if (!response.ok) {
    const rejection = RejectionSchema.safeParse(payload)
    const message = rejection.success
      ? response.status === 402
        ? (rejection.data.monicaMessage ?? rejection.data.error)
        : rejection.data.error
      : undefined
    throw new ForgeSubmissionError(
      message ?? `The forge rejected the request (${response.status}).`,
      'rejected'
    )
  }

  const result = ForgeSuccessSchema.safeParse(payload)
  if (!result.success) {
    const rejection = RejectionSchema.required({ success: true }).safeParse(payload)
    if (rejection.success) {
      throw new ForgeSubmissionError(
        rejection.data.error ?? 'The forge rejected the request.',
        'rejected'
      )
    }
    throw new ForgeSubmissionError(uncertainMessage, 'uncertain')
  }
  attempt.confirm(request.clientRequestId)
  return result.data
}
