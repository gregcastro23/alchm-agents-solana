import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { backend, getAlchemicalQuantitiesLegacy } from '@/lib/backend'
import { buildAgentContext } from '@/lib/agents/persona/build-agent-context'
import { consciousnessPersistence } from '@/lib/consciousness-persistence'
import { calculateAgentChatPricing } from '@/lib/economy/chat-pricing'
import { createHash } from 'node:crypto'

interface UnifiedAgentRequest {
  action: string
  parameters?: any
}

interface UnifiedAgentResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
  timestamp: string
}

function requestParameter(
  parameters: Record<string, unknown>,
  body: UnifiedAgentRequest,
  ...keys: string[]
): unknown {
  const root = body as unknown as Record<string, unknown>
  for (const key of keys) {
    if (parameters[key] !== undefined) return parameters[key]
    if (root[key] !== undefined) return root[key]
  }
  return undefined
}

function chatDebitIdempotencyKey(
  userId: string,
  requestKey: unknown,
  agentId: string,
  message: string
): string | undefined {
  if (typeof requestKey !== 'string' || !requestKey.trim()) return undefined
  // Bind a client request ID to the immutable operation payload. Reusing the
  // same ID for a different prompt must produce a different debit key rather
  // than turning the first successful charge into an unlimited-chat coupon.
  const digest = createHash('sha256')
    .update(JSON.stringify([requestKey.trim(), agentId, message]))
    .digest('hex')
  return `unified_chat:${userId}:${digest}`
}

// Main handler for all agent operations proxied to Railway backend
export async function POST(request: NextRequest): Promise<NextResponse<UnifiedAgentResponse>> {
  try {
    const body: UnifiedAgentRequest = await request.json()
    const { action, parameters = {} } = body

    const timestamp = new Date().toISOString()

    switch (action) {
      case 'list': {
        const listData = await backend.agents.list(parameters)
        return NextResponse.json({ success: true, data: listData, timestamp })
      }

      case 'get': {
        if (!parameters.agentId) throw new Error('Missing agentId')
        const getData = await backend.agents.get(parameters.agentId)
        return NextResponse.json({ success: true, data: getData, timestamp })
      }

      case 'create': {
        const createData = await backend.agents.create(parameters)
        // Fire-and-forget: assign the new agent its gasless ENS subname (ENSIP-26
        // records). No-ops unless NameStone is configured; never blocks creation.
        import('@/lib/namestone')
          .then(({ registerAgentSubnameOnCreate }) =>
            registerAgentSubnameOnCreate(createData as any, parameters)
          )
          .catch(err => console.warn('ENS subname registration skipped:', err))
        return NextResponse.json({ success: true, data: createData, timestamp })
      }

      case 'interact':
      case 'chat': {
        // A few older clients still send chat fields at the request root. Keep
        // accepting that shape while treating `parameters` as canonical.
        const agentId = requestParameter(parameters, body, 'agentId') as string | undefined
        const requestedMessage = requestParameter(parameters, body, 'message', 'userMessage') as
          | string
          | undefined
        if (!agentId) throw new Error('Missing agentId')
        if (!requestedMessage) throw new Error('Missing message')

        // Bridge-aware: recognizes PA-native sessions AND alchm.kitchen sessions.
        const session = await auth()
        const userId = session?.user?.id

        // ESMS Token Economy: Spend resources for agent operation —
        // UNLESS this agent is in the current week's free rotation (waive cost).
        const { EconomyService } = await import('@/lib/services/economyService')
        const { isAgentFreeThisWeek, isAgentFreeInCachedRotation } =
          await import('@/lib/agents/weekly-feature-rotation')

        const freeThisWeek = await isAgentFreeThisWeek(agentId).catch(error => {
          const cachedFree = isAgentFreeInCachedRotation(agentId)
          // Guests cannot repair a failed ephemeris lookup by signing in or
          // paying. Fail open for this rate-limited request so a cold serverless
          // instance never turns the advertised free rotation into a 401/402.
          const waiveForGuest = !userId
          console.warn(
            `[agents/unified] Weekly rotation lookup failed; waiver ${cachedFree || waiveForGuest ? 'applied' : 'unavailable'}`,
            error
          )
          return cachedFree || waiveForGuest
        })

        if (!userId && !freeThisWeek) {
          const { logSecurityEvent } = await import('@/lib/security-audit-logger')
          logSecurityEvent({
            eventType: 'AUTH_FAILURE',
            resource: '/api/agents/unified (chat)',
            details: { action },
          })
          return NextResponse.json(
            {
              success: false,
              error:
                "Authentication required for agent interaction. Try this week's free historical agents!",
              timestamp,
            },
            { status: 401 }
          )
        }

        // Rate limiting check (OWASP LLM10 / API4)
        const { checkRateLimit } = await import('@/lib/rate-limiter')
        const rateCheck = checkRateLimit(userId ? `chat:${userId}` : 'chat:anon', {
          windowMs: 60 * 1000,
          maxRequests: 30,
        })
        if (!rateCheck.allowed) {
          const { logSecurityEvent } = await import('@/lib/security-audit-logger')
          logSecurityEvent({
            eventType: 'RATE_LIMIT_EXCEEDED',
            userId: userId || 'anonymous',
            resource: '/api/agents/unified (chat)',
          })
          return NextResponse.json(
            {
              success: false,
              error: 'Rate limit exceeded. Please wait before sending more messages.',
              timestamp,
            },
            { status: 429 }
          )
        }

        // Resolve the chart from trusted server-side agent data. Canonical
        // historical/star agents take the in-memory fast path; DB-only crafted
        // and degree agents use the broader resolver only when needed.
        const personaCtx = buildAgentContext(agentId)
        let agentElement = personaCtx?.agent.consciousness?.dominantElement
        if (!agentElement) {
          const { resolveAnyAgent } = await import('@/lib/agents/resolve-any-agent')
          const resolvedAgent = await resolveAnyAgent(agentId)
          agentElement = resolvedAgent?.consciousness?.dominantElement
        }

        let balances
        let pricing
        if (freeThisWeek) {
          balances = userId
            ? await EconomyService.getBalances(userId)
            : EconomyService.ZERO_BALANCES
        } else if (userId) {
          // Transit lookup is advisory to the multiplier, not availability.
          // If the ephemeris/backend is temporarily unavailable, bill the
          // balanced neutral price instead of turning a chat into a 500.
          let currentAlchemy: unknown
          try {
            currentAlchemy = await getAlchemicalQuantitiesLegacy()
          } catch (error) {
            console.warn(
              '[agents/unified] Live transit pricing unavailable; using neutral base price',
              error
            )
          }
          pricing = calculateAgentChatPricing(
            personaCtx?.agent || parameters.agentId || agentElement,
            currentAlchemy,
            { message: requestedMessage }
          )

          const requestKey =
            request.headers.get('Idempotency-Key') ||
            requestParameter(parameters, body, 'requestId', 'idempotencyKey')
          const idempotencyKey = chatDebitIdempotencyKey(
            userId,
            requestKey,
            agentId,
            requestedMessage
          )

          // token_balances is the shared off-chain source of truth for human
          // chat. Do not also call syncDebitToAlchm here: that endpoint serves
          // remote agent-action actors and a second debit would double-charge.
          const debitResult = await EconomyService.debitDynamic(
            userId,
            pricing.cost,
            idempotencyKey ? { idempotencyKey } : undefined
          )
          if (!debitResult.ok) {
            return NextResponse.json(
              {
                success: false,
                error: 'Insufficient tokens',
                data: { required: pricing.cost, pricing },
                timestamp,
              },
              { status: 402 }
            )
          }
          if (debitResult.reason === 'already_applied') {
            return NextResponse.json(
              {
                success: false,
                error: 'This chat request has already been processed.',
                data: { code: 'CHAT_REQUEST_ALREADY_PROCESSED' },
                timestamp,
              },
              { status: 409 }
            )
          }
          balances = debitResult.balances
        }

        const { sanitizePromptInput } = await import('@/lib/utils/sanitizer')
        const userMessage = requestedMessage
          ? sanitizePromptInput(requestedMessage)
          : requestedMessage

        // Walrus memory: inject the agent's most-relevant past memories into the
        // persona (no-op without MemWal). Never blocks chat — falls back to the raw block.
        let personaBlock = personaCtx?.personaBlock
        if (personaCtx && userMessage) {
          const { augmentPersonaWithMemory } = await import('@/lib/walrus')
          personaBlock = await augmentPersonaWithMemory(
            personaCtx.personaBlock,
            agentId,
            userMessage
          )
        }

        // Premium gating: cap the requested model tier to the user's entitlement
        // (active subscription or validated BYOK key). Free users requesting a
        // premium tier degrade to the free chain rather than being rejected.
        const { getEntitlements } = await import('@/lib/premium/entitlements')
        const { capModelTier } = await import('@/lib/premium/tiers')
        // kitchenPremium unifies the role: an alchm.kitchen subscription grants
        // premium here too (surfaced by the session bridge).
        const entitlements = userId
          ? await getEntitlements(userId, { kitchenPremium: session?.user?.kitchenPremium })
          : { tier: 'free' as const, isSubscribed: false, byokProviders: [] }
        const effectiveTier = capModelTier(
          parameters.modelTier,
          entitlements.tier,
          entitlements.byokProviders
        )

        // BYOK: forward the user's own provider keys so premium calls bill them.
        let userProviderKeys: { anthropic?: string; openai?: string } | undefined
        if (userId && entitlements.byokProviders.length > 0) {
          const { getDecryptedKey } = await import('@/lib/byok/store')
          const keys: { anthropic?: string; openai?: string } = {}
          for (const provider of entitlements.byokProviders) {
            const decrypted = await getDecryptedKey(userId, provider)
            if (decrypted) keys[provider] = decrypted
          }
          if (Object.keys(keys).length > 0) userProviderKeys = keys
        }

        const chatData = await backend.agents.chat({
          agentId,
          message: requestedMessage,
          sessionId: parameters.sessionId,
          userId: parameters.userId || userId,
          context: parameters.context,
          systemPromptOverride: personaBlock,
          personaCacheKey: personaCtx?.cacheKey,
          modelTier: effectiveTier,
          userProviderKeys,
        })

        // Conserve interaction logging
        if (userId && chatData.text) {
          const powerGained = Math.max(1, Math.floor(chatData.text.length / 100))
          consciousnessPersistence
            .logInteraction({
              userId,
              agentId,
              interactionType: 'historical-chat',
              powerGained,
              planetaryInfluence: 'unknown',
              elementalResonance: 0.5,
              metadata: {
                userMessage: requestedMessage,
              },
            })
            .catch(err => console.warn('Failed to log unified agent interaction:', err))
        }

        // Walrus memory write-back: remember this exchange so future turns can recall
        // it (MemWal-gated; fire-and-forget so it never blocks or fails the response).
        if (chatData?.text && userMessage) {
          import('@/lib/walrus')
            .then(({ rememberConversation }) =>
              rememberConversation(agentId, userMessage, chatData.text)
            )
            .catch(() => {})
        }

        // Cosmic Leveling: award XP/EVs from this conversation. Fire-and-forget
        // so leveling never blocks or fails the chat response.
        if (chatData?.text) {
          const { HistoricalAgentsService } = await import('@/lib/historical-agents-db')
          // Deeper / longer answers earn a little more XP (0.5x–2x of base).
          const qualityMultiplier = Math.min(2, Math.max(0.5, (chatData.text.length || 0) / 600))

          // The agent the user spoke with gains XP.
          HistoricalAgentsService.awardXp(agentId, { qualityMultiplier }).catch(err =>
            console.warn('awardXp failed:', err)
          )

          // Training session: a crafted agent (trainerAgentId) grouped with this
          // partner earns XP and EVs in the partner's dominant Sacred 7 stat.
          const trainerId = parameters.trainerAgentId
          if (trainerId && trainerId !== agentId) {
            HistoricalAgentsService.awardXp(trainerId, { qualityMultiplier }).catch(() => {})
            HistoricalAgentsService.awardEvs(trainerId, agentId).catch(err =>
              console.warn('awardEvs failed:', err)
            )
          }
        }

        const disclaimer =
          'Planetary Agent responses and cosmic recipes are synthesized using Large Language Models (LLMs) and real-time astrological transit algorithms. They are provided for culinary inspiration and entertainment only, and do not constitute human medical, nutritional, or professional advice.'

        return NextResponse.json({
          success: true,
          data: chatData,
          ai_generated: true,
          disclaimer,
          balances,
          free: freeThisWeek,
          pricing: freeThisWeek ? { waived: true } : pricing,
          timestamp,
        })
      }

      case 'multi_agent_chat': {
        const session = await auth()
        const userId = session?.user?.id
        const agentIds = (requestParameter(parameters, body, 'agentIds') as
          | string[]
          | undefined) || ['sirius', 'arcturus', 'vega', 'polaris']
        const userMessage =
          (requestParameter(parameters, body, 'message', 'userMessage') as string | undefined) ||
          'How should I allocate my USDC collateral today?'

        const systemPromptOverrides: Record<string, string> = {}
        for (const id of agentIds) {
          const personaCtx = buildAgentContext(id)
          if (personaCtx) {
            systemPromptOverrides[id] = personaCtx.personaBlock
          }
        }

        let multiData: any
        try {
          multiData = await backend.agents.multiChat({
            agentIds,
            message: userMessage,
            sessionId: parameters.sessionId,
            userId: parameters.userId || userId,
            context: parameters.context,
            systemPromptOverrides,
            modelTier: parameters.modelTier,
          })
        } catch (err) {
          const STAR_SPECS: Record<
            string,
            { name: string; element: string; text: (msg: string) => string }
          > = {
            sirius: {
              name: 'Sirius',
              element: 'Fire',
              text: msg =>
                `As Sirius, Radiant Sovereign of Fire (Spirit Yield, 248% APY), I urge you to channel your USDC collateral into the Sirius Star Vault on Circle Arc while my star is risen to forge eternal Spirit.`,
            },
            arcturus: {
              name: 'Arcturus',
              element: 'Air',
              text: msg =>
                `As Arcturus, Master of Air (Substance Yield, 195% APY), higher strategic clarity demands balancing your position with intellectual precision across Fire and Earth vaults on Circle Arc.`,
            },
            vega: {
              name: 'Vega',
              element: 'Water',
              text: msg =>
                `As Vega, Mystic Queen of Water (Essence Yield, 210% APY), flow your USDC into harmonic liquidity reserves to distill pure emotional Essence and steady yield.`,
            },
            polaris: {
              name: 'Polaris',
              element: 'Earth',
              text: msg =>
                `As Polaris, Immutable Anchor of Earth (Matter Yield, 180% APY), anchor a foundational stake in the North Star Vault for unwavering structural stability and physical abundance.`,
            },
          }

          const responses = agentIds.map(id => {
            const key = id.toLowerCase().trim()
            const spec = STAR_SPECS[key] || {
              name: id.charAt(0).toUpperCase() + id.slice(1),
              element: 'Spirit',
              text: () =>
                `As ${id}, I advise aligning your USDC collateral according to cosmic yield principles.`,
            }
            return {
              agentId: id,
              name: spec.name,
              element: spec.element,
              text: spec.text(userMessage),
            }
          })

          multiData = {
            responses,
            sessionId: parameters.sessionId || `council-session-${Date.now()}`,
          }
        }

        return NextResponse.json({
          success: true,
          data: multiData,
          responses: multiData.responses,
          timestamp,
        })
      }

      case 'update': {
        if (!parameters.agentId) throw new Error('Missing agentId')
        const { agentId, ...patch } = parameters
        const updated = await backend.agents.update(agentId, patch)
        return NextResponse.json({ success: true, data: updated, timestamp })
      }

      case 'delete': {
        if (!parameters.agentId) throw new Error('Missing agentId')
        const result = await backend.agents.delete(parameters.agentId)
        return NextResponse.json({ success: true, data: result, timestamp })
      }

      case 'stats': {
        const data = await backend.agents.stats()
        return NextResponse.json({ success: true, data, timestamp })
      }

      case 'search': {
        const query = parameters.query || parameters.q
        if (!query) throw new Error('Missing query parameter')
        const limit = typeof parameters.limit === 'number' ? parameters.limit : 25
        const data = await backend.agents.search(query, limit)
        return NextResponse.json({ success: true, data, timestamp })
      }

      case 'dashboard': {
        // Composite call — stats + the most recent N agents in one
        // response so the admin UI can render with a single request.
        // Kept Next-side rather than backend because the shape is a
        // UI concern that may evolve faster than the FastAPI schema.
        const [stats, agents] = await Promise.all([
          backend.agents.stats(),
          backend.agents.list({ skip: 0, limit: 12 }),
        ])
        return NextResponse.json({
          success: true,
          data: { stats, recentAgents: agents },
          timestamp,
        })
      }

      case 'evolve':
        // Agent evolution interacts with the agent_consciousness table
        // and its Prisma model is the canonical source. The Python
        // backend doesn't own that schema. Until the design for
        // backend-side evolution is settled, callers should use the
        // dedicated /api/consciousness/evolve route instead.
        return NextResponse.json(
          {
            success: false,
            error:
              "Action 'evolve' is owned by /api/consciousness/evolve, not this unified surface. " +
              'Update the caller to hit that route directly.',
            timestamp,
          },
          { status: 501 }
        )

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown action: ${action}`,
            timestamp,
          },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Unified agent API proxy error', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest): Promise<NextResponse<UnifiedAgentResponse>> {
  const { searchParams } = new URL(request.url)
  const action = searchParams.get('action') || 'list'
  const timestamp = new Date().toISOString()

  try {
    switch (action) {
      case 'list': {
        const listData = await backend.agents.list(Object.fromEntries(searchParams))
        return NextResponse.json({ success: true, data: listData, timestamp })
      }

      case 'health':
        return NextResponse.json({
          success: true,
          data: {
            status: 'healthy',
            mode: 'proxy-to-backend',
            version: '2.0.0',
          },
          timestamp,
        })

      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unknown GET action: ${action}`,
            timestamp,
          },
          { status: 400 }
        )
    }
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error',
        timestamp,
      },
      { status: 500 }
    )
  }
}
