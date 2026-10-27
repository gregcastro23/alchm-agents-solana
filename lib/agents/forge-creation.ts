import { Prisma, type PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import {
  HistoricalAgentsService,
  type CreateHistoricalAgentInput,
} from '@/lib/historical-agents-db'
import { EconomyService } from '@/lib/services/economyService'
import type { CraftedAgent } from '@/lib/agent-types'
import { ForgeSuccessSchema } from './forge-client'

export interface ForgeSuccessResponse {
  success: true
  agent: CraftedAgent
  balances?: { spirit: number; essence: number; matter: number; substance: number }
  monicaMessage: string
  deduplicated?: boolean
}

export class ForgeRequestConflict extends Error {}
export class InsufficientForgeFunds extends Error {}
export class ForgeUnavailable extends Error {}

export interface ForgeRequestKey {
  creatorId: string
  clientRequestId: string
  requestHash: string
}

// JSON serialization matches NextResponse (including Dates and omitted undefined
// fields). Validate the serialized value before storing it as a replay contract.
const JsonValueSchema: z.ZodType<Prisma.JsonValue> = z.lazy(() =>
  z.union([
    z.string(),
    z.number().finite(),
    z.boolean(),
    z.null(),
    z.array(JsonValueSchema),
    z.record(JsonValueSchema),
  ])
)
const JsonObjectSchema = z.record(JsonValueSchema)

export async function readForgeReplay(db: PrismaClient, key: ForgeRequestKey) {
  const original = await db.agentCreationRequest.findUnique({
    where: {
      creatorId_clientRequestId: {
        creatorId: key.creatorId,
        clientRequestId: key.clientRequestId,
      },
    },
  })
  if (!original) return null
  if (original.requestHash !== key.requestHash) {
    throw new ForgeRequestConflict('This request ID was already used with different agent details.')
  }
  const parsed = ForgeSuccessSchema.safeParse(original.response)
  if (!parsed.success || original.agentId !== parsed.data.agent.id) {
    throw new ForgeUnavailable(
      'The saved creation result is unavailable. Keep the same request ID.'
    )
  }
  return { ...JsonObjectSchema.parse(original.response), deduplicated: true }
}

interface ForgeCreationInput {
  creatorId?: string
  request?: { clientRequestId: string; requestHash: string }
  agentData: CreateHistoricalAgentInput
  agent: unknown
  monicaMessage: string
  blueprint?: Prisma.InputJsonObject
}

/** All local effects commit together; no network work runs in this transaction. */
export async function commitForgeCreation(input: ForgeCreationInput, db: PrismaClient = prisma) {
  const key =
    input.request && input.creatorId ? { creatorId: input.creatorId, ...input.request } : undefined
  if (input.request && !key) throw new Error('Keyed forging requires an authenticated creator')
  try {
    return await db.$transaction(
      async tx => {
        if (key) {
          // The unique constraint serializes competing requests. A failed creation
          // rolls this claim back too, so a retry can safely claim the key again.
          await tx.agentCreationRequest.create({ data: key })
        }
        let balances: ForgeSuccessResponse['balances']
        if (input.creatorId) {
          const debit = await EconomyService.debitOperation(input.creatorId, 'forge_agent', tx)
          if (!debit.ok || !debit.balances) {
            throw new InsufficientForgeFunds('Insufficient ESMS reserves to fuel the forge')
          }
          balances = debit.balances
        }

        await HistoricalAgentsService.createAgent(input.agentData, tx)
        if (input.creatorId) {
          const agent = JsonObjectSchema.parse(JSON.parse(JSON.stringify(input.agent)))
          await tx.created_agents.create({
            data: {
              creatorId: input.creatorId,
              sourceType: 'philosopher-stone-forge',
              momentChart: { agentId: input.agentData.agentId },
              blueprint: input.blueprint ?? {
                agentId: input.agentData.agentId,
                name: input.agentData.name,
              },
              monicaConstant: input.agentData.monicaConstant,
              personality: agent.personality ?? {},
            },
          })
        }

        const response = JsonObjectSchema.parse(
          JSON.parse(
            JSON.stringify({
              success: true,
              agent: input.agent,
              balances,
              monicaMessage: input.monicaMessage,
            })
          )
        )
        ForgeSuccessSchema.parse(response)
        if (key) {
          await tx.agentCreationRequest.update({
            where: {
              creatorId_clientRequestId: {
                creatorId: key.creatorId,
                clientRequestId: key.clientRequestId,
              },
            },
            data: { agentId: input.agentData.agentId, response },
          })
        }
        return response
      },
      { maxWait: 10_000, timeout: 15_000 }
    )
  } catch (error) {
    if (key && error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // This SELECT runs AFTER the aborted transaction, with a fresh snapshot.
      // An insert-or-select CTE can miss a concurrent winning row under MVCC.
      const original = await readForgeReplay(db, key)
      if (original) return original
    }
    throw error
  }
}
