import 'server-only'

import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { requireAdminRequest } from '@/lib/security/privileged-api-auth'
import { authenticateDesktopApiKey, extractDesktopApiKey } from '@/lib/security/desktop-auth'
import { safeEqual } from '@/lib/security/secure-compare'
import { resolveAnyAgent } from '@/lib/agents/resolve-any-agent'
import { postAgentWeeklyMenu, type WeeklyMenu } from '@/lib/wtenClient'
import { stableEventId } from '@/lib/wten/delivery'

const mealType = z.enum(['breakfast', 'lunch', 'dinner', 'snack'])
const elements = z.object({
  Fire: z.number(),
  Water: z.number(),
  Earth: z.number(),
  Air: z.number(),
})
const menuSchema = z
  .object({
    id: z.string().optional(),
    agentSlug: z
      .string()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9_-]+$/),
    agentDisplayName: z.string().min(1).max(200),
    weekStartDate: z.string().datetime({ offset: true }),
    status: z.enum(['draft', 'completed']).default('draft'),
    shareToFeed: z.boolean().default(false),
    title: z.string().min(1).max(500),
    summary: z.string().max(5000),
    meals: z
      .array(
        z.object({
          id: z.string(),
          dayOfWeek: z.number().int().min(0).max(6),
          mealType,
          servings: z.number().positive().max(1000),
          recipe: z
            .object({
              id: z.string(),
              name: z.string(),
              cuisine: z.string().optional(),
              ingredients: z.array(z.string()).optional(),
              nutrition: z.record(z.number()).optional(),
              elementalProperties: elements.optional(),
            })
            .optional(),
          planetarySnapshot: z
            .object({
              dominantPlanet: z.string(),
              zodiacSign: z.string(),
              lunarPhase: z.string(),
              elementalState: elements,
              timestamp: z.string(),
            })
            .optional(),
          notes: z.string().optional(),
          createdAt: z.string().optional(),
          updatedAt: z.string().optional(),
        })
      )
      .length(28)
      .refine(
        meals => new Set(meals.map(m => `${m.dayOfWeek}:${m.mealType}`)).size === 28,
        'Each day and meal type must appear exactly once'
      ),
    nutritionalTotals: z.record(z.number()).optional(),
    groceryList: z
      .array(
        z.object({
          name: z.string(),
          category: z.string().optional(),
          quantity: z.number().optional(),
          unit: z.string().optional(),
          checked: z.boolean().optional(),
        })
      )
      .optional(),
    inventory: z.array(z.string()).optional(),
    weeklyBudget: z.number().nullable().optional(),
    planetaryFocus: z.string().optional(),
    dietaryFocus: z.string().optional(),
    featuredMeals: z
      .array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          mealType: z.string(),
          recipeId: z.string(),
          recipeName: z.string(),
        })
      )
      .optional(),
    planetarySignature: z
      .object({
        planetaryHour: z.string(),
        planetaryDay: z.string(),
        dominantElement: z.string(),
        postedAt: z.string().optional(),
        dominantSign: z.string().optional(),
        natalPositions: z.array(z.unknown()).optional(),
        transitPositions: z.array(z.unknown()).optional(),
      })
      .optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .strict()

type PublicationActor = { id: string } | { response: NextResponse }

export async function publicationActor(request: Request): Promise<PublicationActor> {
  const token = extractDesktopApiKey(request)
  if (token) {
    if (process.env.PA_USER_API_KEY && safeEqual(token, process.env.PA_USER_API_KEY)) {
      return { id: 'service:pa-master' }
    }
    const identity = await authenticateDesktopApiKey(token)
    if (identity.status !== 'verified') {
      return {
        response: NextResponse.json(
          { success: false, error: 'Verified publisher required' },
          { status: 401 }
        ),
      }
    }
    const user = await prisma.users.findUnique({
      where: { id: identity.userId },
      select: { role: true },
    })
    if (!user || !['admin', 'operator', 'alchemist'].includes(user.role)) {
      return {
        response: NextResponse.json(
          { success: false, error: 'Publisher permission required' },
          { status: 403 }
        ),
      }
    }
    return { id: `user:${identity.userId}` }
  }
  // Browser operators use their verified admin session and mutation-origin check.
  const access = await requireAdminRequest(request)
  if (!access.ok) return { response: access.response }
  if (!access.admin.user.id) {
    return {
      response: NextResponse.json(
        { success: false, error: 'Verified publisher required' },
        { status: 401 }
      ),
    }
  }
  return { id: `user:${access.admin.user.id}` }
}

/**
 * One publication boundary for MCP and browser callers. The existing durable
 * event ledger reserves a key before any external write. An uncertain delivery
 * stays reserved: safely retrying it requires WTEN's atomic feed dedupe contract.
 */
export async function publishWeeklyMenu(
  request: Request,
  legacyBody = false
): Promise<NextResponse> {
  try {
    const actor = await publicationActor(request)
    if ('response' in actor) return actor.response
    const key = request.headers.get('idempotency-key')?.trim()
    if (!key || key.length > 200 || !/^[\x21-\x7e]+$/.test(key)) {
      return NextResponse.json(
        { success: false, error: 'A valid Idempotency-Key is required' },
        { status: 400 }
      )
    }
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON request body' },
        { status: 400 }
      )
    }
    const parsed = legacyBody
      ? menuSchema.safeParse(body)
      : z.object({ menu: menuSchema }).strict().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid weekly menu payload' },
        { status: 400 }
      )
    }
    const draft = legacyBody
      ? (parsed.data as z.infer<typeof menuSchema>)
      : (parsed.data as { menu: z.infer<typeof menuSchema> }).menu
    const weekStart = new Date(draft.weekStartDate)
    if (
      weekStart.getUTCDay() !== 0 ||
      weekStart.getUTCHours() ||
      weekStart.getUTCMinutes() ||
      weekStart.getUTCSeconds() ||
      weekStart.getUTCMilliseconds()
    ) {
      return NextResponse.json(
        { success: false, error: 'weekStartDate must be Sunday at midnight UTC' },
        { status: 400 }
      )
    }
    const agent = await resolveAnyAgent(draft.agentSlug)
    if (!agent || agent.id !== draft.agentSlug) {
      return NextResponse.json({ success: false, error: 'Agent not found' }, { status: 404 })
    }
    const fingerprint = stableEventId('weekly-menu-payload', draft)
    const eventId = stableEventId('weekly-menu-publication', actor.id, key)
    const metadata = { actorId: actor.id, fingerprint }
    let row
    try {
      row = await prisma.agent_action_events.create({
        data: {
          agentId: agent.id,
          agentEmail: `${agent.id}@agentic.alchm.kitchen`,
          eventType: 'weekly_menu_publish',
          triggerType: 'explicit_publication',
          triggerSummary: 'Authorized weekly menu publication',
          metadataPayload: metadata,
          score: 0,
          idempotencyKey: eventId,
          status: 'publishing',
          attempts: 1,
        },
      })
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error
      const existing = await prisma.agent_action_events.findUnique({
        where: { idempotencyKey: eventId },
      })
      const saved = existing?.metadataPayload as {
        actorId?: string
        fingerprint?: string
        response?: unknown
      } | null
      if (!existing || saved?.actorId !== actor.id || saved?.fingerprint !== fingerprint) {
        return NextResponse.json(
          { success: false, error: 'Idempotency-Key was already used with a different payload' },
          { status: 409 }
        )
      }
      if (existing.status === 'posted' && saved.response) {
        return NextResponse.json(saved.response, { headers: { 'Idempotency-Replayed': 'true' } })
      }
      return NextResponse.json(
        {
          success: false,
          error:
            'Publication is pending or unconfirmed; verify its outcome before submitting another key',
        },
        { status: 409 }
      )
    }

    try {
      const result = await postAgentWeeklyMenu(
        {
          ...draft,
          agentDisplayName: agent.name,
          status: 'completed',
          shareToFeed: true,
        } as WeeklyMenu,
        eventId
      )
      await prisma.agent_action_events.update({
        where: { id: row.id },
        data: {
          status: 'posted',
          postedAt: new Date(),
          metadataPayload: { ...metadata, response: result } as unknown as Prisma.InputJsonValue,
        },
      })
      return NextResponse.json(result)
    } catch {
      await prisma.agent_action_events
        .update({
          where: { id: row.id },
          data: {
            status: 'publication_uncertain',
            lastError: 'Publication outcome requires verification',
          },
        })
        .catch(() => {})
      return NextResponse.json(
        {
          success: false,
          error: 'Publication could not be confirmed; reuse this key when checking its outcome',
        },
        { status: 502 }
      )
    }
  } catch {
    // Credential and ledger failures must never turn into an anonymous write.
    return NextResponse.json(
      { success: false, error: 'Publication authorization or persistence unavailable' },
      { status: 503 }
    )
  }
}
