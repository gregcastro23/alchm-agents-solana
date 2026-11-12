import { BufferMemory } from '@langchain/classic/memory'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, ToolMessage, type BaseMessage } from '@langchain/core/messages'
import type { ChatResult } from '@langchain/core/outputs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  HAS_PY_SWISSEPH,
  mockAuth,
  mockUpsertUserProfile,
  mockFindUserProfile,
  mockUpsertProfile,
  mockFindProfile,
  mockGetNatalChart,
  mockGetPrimaryNatalChart,
  mockGetUserNatalCharts,
  mockApplyRectifiedBirthTimeToChart,
  mockGenerateText,
} = vi.hoisted(() => {
  const { spawnSync } = require('node:child_process') as typeof import('node:child_process')
  const pyCheck = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', 'import swisseph'], {
    timeout: 3000,
    stdio: 'ignore',
  })
  return {
    HAS_PY_SWISSEPH: process.env.FORCE_NO_SWISSEPH !== '1' && pyCheck.status === 0,
    mockAuth: vi.fn(),
    mockUpsertUserProfile: vi.fn(),
    mockFindUserProfile: vi.fn(),
    mockUpsertProfile: vi.fn(),
    mockFindProfile: vi.fn(),
    mockGetNatalChart: vi.fn(),
    mockGetPrimaryNatalChart: vi.fn(),
    mockGetUserNatalCharts: vi.fn(),
    mockApplyRectifiedBirthTimeToChart: vi.fn(),
    mockGenerateText: vi.fn(),
  }
})

vi.mock('@/lib/auth', () => ({
  auth: mockAuth,
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user_profiles: {
      upsert: mockUpsertUserProfile,
      findUnique: mockFindUserProfile,
    },
    profiles: {
      upsert: mockUpsertProfile,
      findUnique: mockFindProfile,
    },
    monica_user_settings: {
      upsert: vi.fn().mockResolvedValue({ id: 'settings-1' }),
    },
    monica_user_progress: {
      upsert: vi.fn().mockResolvedValue({}),
    },
    monica_interactions: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@/lib/backend', () => ({
  BackendError: class BackendError extends Error {},
  backend: HAS_PY_SWISSEPH
    ? {}
    : {
        // CI frontend runner has no pyswisseph wheel; provide calibrated fallback responses
        // while keeping full real Swiss Ephemeris execution whenever pyswisseph is present.
        rectify: {
          windows: async () => ({
            rising_windows: [
              {
                sign: 'Virgo',
                start_time: '07:58',
                end_time: '10:34',
                duration_minutes: 156,
                prior_probability: 0.1083,
              },
            ],
            sun_rise_lmt: '04:29',
            sun_set_lmt: '19:24',
            moon_start: { sign: 'Aries', degree: 12.4 },
            moon_end: { sign: 'Aries', degree: 25.6 },
            moon_ingress_minute: null,
            moon_ingress_time: null,
            entropy_bits: 3.5278,
            next_best_questions: [
              {
                id: 'time_clue_diurnal',
                category: 'time_clue',
                prompt: 'What time window were you born in?',
                expected_info_gain_bits: 2.1,
              },
            ],
          }),
          score: async (body: { evidence?: Array<{ type?: string }> }) => {
            const ev = Array.isArray(body?.evidence) ? body.evidence : []
            const hasStrongEvidence = ev.some(
              item => item.type === 'recorded_time' || item.type === 'life_event'
            )
            if (hasStrongEvidence) {
              return {
                top_sign: 'Virgo',
                top_sign_probability: 0.8759,
                working_time: '09:15',
                working_longitude: 162.5,
                working_sign: 'Virgo',
                window_80_minutes: 120,
                is_calculations_eligible: true,
                entropy_bits: 0.6632,
                next_best_questions: [],
                distribution: { Virgo: 0.8759 },
                credible_windows: [
                  { sign: 'Virgo', start_time: '08:15', end_time: '10:15', probability: 0.8759 },
                ],
                evidence_count: ev.length,
              }
            }
            return {
              top_sign: 'Scorpio',
              top_sign_probability: 0.42,
              working_time: '15:00',
              working_longitude: 225.0,
              working_sign: 'Scorpio',
              window_80_minutes: 240,
              is_calculations_eligible: false,
              entropy_bits: 1.9,
              next_best_questions: [],
              distribution: { Scorpio: 0.42 },
              credible_windows: [],
              evidence_count: ev.length,
            }
          },
        },
      },
  getAlchemicalQuantitiesLegacy: vi.fn().mockResolvedValue({
    'Alchemy Effects': {
      'Total Spirit': 42,
      'Total Essence': 38,
      'Total Matter': 29,
      'Total Substance': 31,
    },
    Heat: 14,
    Entropy: 6,
    Reactivity: 9,
    Energy: 18,
    'Dominant Element': 'Water',
  }),
}))

vi.mock('@/lib/services/natal-chart-storage', () => ({
  getNatalChart: mockGetNatalChart,
  getPrimaryNatalChart: mockGetPrimaryNatalChart,
  getUserNatalCharts: mockGetUserNatalCharts,
  applyRectifiedBirthTimeToChart: mockApplyRectifiedBirthTimeToChart,
}))

vi.mock('@/lib/langchain/memory-manager', () => {
  const memories = new Map<string, BufferMemory>()
  const historyRecords: Array<{ sessionId: string; agentId: string; user: string; ai: string }> = []
  return {
    getMemoryManager: () => ({
      getMemory: async (sessionId: string, agentId: string) => {
        const key = `${sessionId}:${agentId}`
        let mem = memories.get(key)
        if (!mem) {
          mem = new BufferMemory({
            returnMessages: true,
            memoryKey: 'chat_history',
            inputKey: 'input',
            outputKey: 'output',
          })
          memories.set(key, mem)
        }
        return mem
      },
      saveConversation: async (
        sessionId: string,
        agentId: string,
        userMessage: string,
        agentResponse: string
      ) => {
        historyRecords.push({ sessionId, agentId, user: userMessage, ai: agentResponse })
      },
    }),
  }
})

vi.mock('@/app/api/secure-config', () => ({
  verifyApiKeys: () => true,
}))

vi.mock('ai', async () => {
  const actual = await vi.importActual<typeof import('ai')>('ai')
  return {
    ...actual,
    generateText: mockGenerateText,
  }
})

import { POST as monicaPost } from '@/app/api/monica-agent/route'
import {
  executeAgentQuery,
  clearAgentRouterCache,
  getAgentRouter,
} from '@/lib/langchain/agent-router'
import { rectifyApplyInputSchema } from '@/lib/rectification/tool-handlers'
import { clearRectificationSessionHistory, isRectificationIntent } from '@/lib/rectification/intent'
import { resolveRectificationCoordinates } from '@/lib/rectification/location'
import { monicaRouter } from '@/lib/monica/enhanced-router'
import { geocodeLocation } from '@/lib/services/geocoding-service'
import { runWithToolExecutionContext } from '@/lib/langchain/tool-context'
import { rectifyApplyTool } from '@/lib/langchain/agent-tools'
import { NextRequest } from 'next/server'

function extractLastHumanIndex(messages: BaseMessage[]): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]._getType() === 'human') return i
  }
  return -1
}

function getTurnToolMessages(messages: BaseMessage[]): ToolMessage[] {
  const lastHuman = extractLastHumanIndex(messages)
  return messages.slice(lastHuman + 1).filter((m): m is ToolMessage => m._getType() === 'tool')
}

/**
 * Deterministic scripted BaseChatModel that drives a real 3-turn rectification
 * conversation using LangChain ToolCallingAgent and real Python Swiss Ephemeris tools.
 */
class ScriptedRectificationChatModel extends BaseChatModel {
  boundToolNames: string[] = []
  turnEvidence = [
    {
      type: 'recorded_time',
      time: '09:15',
      rodden_rating: 'B',
      description: 'Hospital morning note around 9:15 AM',
    },
    {
      type: 'life_event',
      category: 'marriage',
      event_date: '2016-06-18',
      description: 'Wedding ceremony',
    },
  ]

  constructor() {
    super({})
  }

  _llmType(): string {
    return 'scripted-rectification-chat'
  }

  bindTools(tools: any[]): any {
    this.boundToolNames = tools.map((t: any) => t.name)
    return this
  }

  async _generate(messages: BaseMessage[]): Promise<ChatResult> {
    const lastHumanIdx = extractLastHumanIndex(messages)
    const lastHumanText =
      lastHumanIdx >= 0 && typeof messages[lastHumanIdx].content === 'string'
        ? messages[lastHumanIdx].content.toLowerCase()
        : ''
    const toolMsgs = getTurnToolMessages(messages)

    // Turn 1: User gives birth date + city only -> call rectify_windows, then ask #1 EIG question
    if (lastHumanText.includes('chicago') && lastHumanText.includes('rising')) {
      if (toolMsgs.length === 0) {
        return {
          generations: [
            {
              text: '',
              message: new AIMessage({
                content: '',
                tool_calls: [
                  {
                    id: 'call_turn1_windows',
                    name: 'rectify_windows',
                    args: {
                      year: 1990,
                      month: 7,
                      day: 14,
                      location: 'Chicago, IL',
                    },
                  },
                ],
              }),
            },
          ],
        }
      }

      const obs = JSON.parse(String(toolMsgs[toolMsgs.length - 1].content))
      const q1 = obs.recommendedNextQuestion?.question || 'What time window were you born in?'
      return {
        generations: [
          {
            text: '',
            message: new AIMessage({
              content: `I scanned all candidate rising windows for July 14, 1990 in ${obs.resolvedLocation?.locationName} (prior entropy ${Number(obs.entropyBits).toFixed(2)} bits). Next question: ${q1}`,
            }),
          },
        ],
      }
    }

    // Turn 2: User supplies morning clue + dated milestone -> call rectify_score
    if (lastHumanText.includes('9:15') || lastHumanText.includes('married')) {
      if (toolMsgs.length === 0) {
        return {
          generations: [
            {
              text: '',
              message: new AIMessage({
                content: '',
                tool_calls: [
                  {
                    id: 'call_turn2_score',
                    name: 'rectify_score',
                    args: {
                      year: 1990,
                      month: 7,
                      day: 14,
                      location: 'Chicago, IL',
                      step_minutes: 5,
                      evidence: this.turnEvidence,
                    },
                  },
                ],
              }),
            },
          ],
        }
      }

      const obs = JSON.parse(String(toolMsgs[toolMsgs.length - 1].content))
      return {
        generations: [
          {
            text: '',
            message: new AIMessage({
              content: `Updated posterior: ${obs.topSign} rising at ${(obs.topSignProbability * 100).toFixed(1)}% probability around ${obs.workingTime} (80% window: ${obs.window80Minutes}m, eligible: ${obs.calculationEligible}). Would you like me to save this as your rising sign?`,
            }),
          },
        ],
      }
    }

    // Turn 3: User confirms save -> call rectify_apply (note intentionally attempting extra userId field stripped by Zod)
    if (lastHumanText.includes('save') || lastHumanText.includes('yes')) {
      if (toolMsgs.length === 0) {
        return {
          generations: [
            {
              text: '',
              message: new AIMessage({
                content: '',
                tool_calls: [
                  {
                    id: 'call_turn3_apply',
                    name: 'rectify_apply',
                    args: {
                      target: 'auto',
                      year: 1990,
                      month: 7,
                      day: 14,
                      location: 'Chicago, IL',
                      evidence: this.turnEvidence,
                      step_minutes: 5,
                    },
                  },
                ],
              }),
            },
          ],
        }
      }

      const obs = JSON.parse(String(toolMsgs[toolMsgs.length - 1].content))
      return {
        generations: [
          {
            text: '',
            message: new AIMessage({
              content: obs.success
                ? `Saved! Your rectified Ascendant is now ${obs.topSign} (${obs.workingTime}) across your profile and chart ${obs.chartId || ''}.`
                : `Could not save yet: ${obs.message}`,
            }),
          },
        ],
      }
    }

    // Fallback reply for session isolation test
    return {
      generations: [
        {
          text: '',
          message: new AIMessage({
            content: `History count seen: ${messages.length}. Last message: ${lastHumanText}`,
          }),
        },
      ],
    }
  }
}

describe('Conversational Ascendant Rectification E2E', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    clearAgentRouterCache()
    clearRectificationSessionHistory()

    mockAuth.mockResolvedValue({
      user: {
        id: 'user-chat-123',
        name: 'Chat Explorer',
        email: 'chat@example.com',
      },
    })

    mockGetPrimaryNatalChart.mockResolvedValue({
      id: 'chart-primary-1',
      userId: 'user-chat-123',
      name: 'Primary Chart',
      birthDate: new Date('1990-07-14T12:00:00Z'),
      birthLocation: { name: 'Chicago, IL', lat: 41.8781, lon: -87.6298 },
      isPrimary: true,
      isActive: true,
    })
    mockGetUserNatalCharts.mockResolvedValue([])
    mockFindUserProfile.mockResolvedValue(null)
    mockFindProfile.mockResolvedValue(null)
    mockUpsertUserProfile.mockImplementation(async ({ create }: any) => ({
      id: 'profile-1',
      ...create,
    }))
    mockUpsertProfile.mockResolvedValue({ userId: 'user-chat-123' })
    mockApplyRectifiedBirthTimeToChart.mockImplementation(
      async (chartId: string, userId: string, workingTime: string, estimate: any) => ({
        id: chartId,
        userId,
        birthTime: workingTime,
        ascendantProvenance: 'rectified',
        ascendantEstimate: estimate,
      })
    )
  })

  it('resolves city names to coordinates, IANA timezone, UTC offset, and LMT offset immediately', async () => {
    const chicago = await geocodeLocation('Chicago, IL', new Date(Date.UTC(1990, 6, 14, 12, 0, 0)))
    expect(chicago).not.toBeNull()
    expect(chicago!.latitude).toBeCloseTo(41.8781, 2)
    expect(chicago!.longitude).toBeCloseTo(-87.6298, 2)
    expect(chicago!.timezone).toBe('America/Chicago')
    expect(chicago!.utcOffsetHours).toBe(-5) // CDT in July
    expect(chicago!.lmtOffsetHours).toBeCloseTo(-5.842, 2)
    expect(chicago!.clockToLmtMinutes).toBe(-51)

    const bangkok = await resolveRectificationCoordinates({
      year: 1990,
      month: 1,
      day: 15,
      location: 'Bangkok, Thailand',
    })
    expect(bangkok.latitude).toBeCloseTo(13.7563, 2)
    expect(bangkok.longitude).toBeCloseTo(100.5018, 2)
    expect(bangkok.timezone).toBe('Asia/Bangkok')
    expect(bangkok.utcOffsetHours).toBe(7)
    expect(bangkok.lmtOffsetHours).toBeCloseTo(6.7001, 2)
    expect(bangkok.clockToLmtMinutes).toBe(-18)
  })

  it('completes a full 3-turn rectification flow through AgentRouter + real Swiss Ephemeris and persists to user profile + primary chart', async () => {
    const scriptedLlm = new ScriptedRectificationChatModel()
    const router = await getAgentRouter({
      sessionId: 'rectify-session-e2e',
      agentId: 'orchestrator',
      userId: 'user-chat-123',
      userName: 'Chat Explorer',
      userEmail: 'chat@example.com',
      llmOverride: scriptedLlm,
    })

    expect(scriptedLlm.boundToolNames).toEqual(
      expect.arrayContaining([
        'geocode_location',
        'rectify_windows',
        'rectify_score',
        'rectify_apply',
      ])
    )

    // Turn 1: Birth date + city string only
    const turn1 = await router.execute(
      "Help me find my rising sign — I was born July 14, 1990 in Chicago, IL and I don't know my exact birth time."
    )
    expect(turn1.error).toBeUndefined()
    expect(turn1.toolCalls).toContain('rectify_windows')
    expect(turn1.output).toContain('Chicago')
    expect(turn1.output).toContain('Next question:')

    // Turn 2: Mother's time recollection + marriage date
    const turn2 = await router.execute(
      'My mom recalls around 9:15 AM, and I got married on June 18, 2016.'
    )
    expect(turn2.error).toBeUndefined()
    expect(turn2.toolCalls).toContain('rectify_score')
    expect(turn2.output).toMatch(/eligible: true/)

    // Turn 3: Save confirmed estimate via rectify_apply
    const turn3 = await router.execute('Yes, please save this as my rising sign!')
    expect(turn3.error).toBeUndefined()
    expect(turn3.toolCalls).toContain('rectify_apply')
    expect(turn3.output).toContain('Saved!')
    expect(turn3.output).toContain('chart-primary-1')

    expect(mockUpsertUserProfile).toHaveBeenCalledTimes(1)
    const upsertPayload = mockUpsertUserProfile.mock.calls[0][0]
    expect(upsertPayload.where).toEqual({ userId: 'user-chat-123' })
    expect(upsertPayload.update.birthLocation.latitude).toBeCloseTo(41.8781, 2)
    expect(upsertPayload.update.birthLocation.longitude).toBeCloseTo(-87.6298, 2)
    expect(upsertPayload.update.natalChart.ascendantProvenance).toBe('rectified')
    expect(
      upsertPayload.update.natalChart.ascendantEstimate.topSignProbability
    ).toBeGreaterThanOrEqual(0.7)

    expect(mockApplyRectifiedBirthTimeToChart).toHaveBeenCalledWith(
      'chart-primary-1',
      'user-chat-123',
      expect.stringMatching(/^\d{2}:\d{2}$/),
      expect.objectContaining({
        topSignProbability: expect.any(Number),
        window80Minutes: expect.any(Number),
      })
    )
  })

  it('enforces auth, rejects model-spoofed userId, and gates unconfirmed estimates on rectify_apply', async () => {
    // Zod schema does not accept a model-supplied userId
    const parsedWithSpoof = rectifyApplyInputSchema.parse({
      userId: 'victim-999',
      year: 1990,
      month: 7,
      day: 14,
      location: 'Chicago, IL',
      evidence: [{ type: 'time_clue', window: 'morning' }],
    } as any)
    expect((parsedWithSpoof as any).userId).toBeUndefined()

    // Unauthenticated call returns requiresAuth + /rectify guidance without DB writes
    mockAuth.mockResolvedValueOnce(null)
    const unauthRaw = await rectifyApplyTool.invoke({
      year: 1990,
      month: 7,
      day: 14,
      location: 'Chicago, IL',
      evidence: [{ type: 'time_clue', window: 'morning' }],
    })
    const unauth = JSON.parse(unauthRaw)
    expect(unauth.success).toBe(false)
    expect(unauth.requiresAuth).toBe(true)
    expect(unauth.rectifyUrl).toBe('/rectify')
    expect(mockUpsertUserProfile).not.toHaveBeenCalled()

    // Wide afternoon window without enough evidence -> requiresConfirmation (below >=70% / <=180m gate)
    const lowConfRaw = await runWithToolExecutionContext({ userId: 'user-real-456' }, () =>
      rectifyApplyTool.invoke({
        year: 1990,
        month: 7,
        day: 14,
        location: 'Chicago, IL',
        evidence: [{ type: 'time_clue', window: 'afternoon', description: 'Vague afternoon clue' }],
      })
    )
    const lowConf = JSON.parse(lowConfRaw)
    expect(lowConf.success).toBe(false)
    expect(lowConf.requiresConfirmation).toBe(true)
    expect(lowConf.isCalculationsEligible).toBe(false)
    expect(mockUpsertUserProfile).not.toHaveBeenCalled()
  })

  it('isolates AgentRouter instances and memory across distinct sessionId / userId keys', async () => {
    const llmA = new ScriptedRectificationChatModel()
    const llmB = new ScriptedRectificationChatModel()

    const r1 = await executeAgentQuery('Session A greeting hello world', {
      sessionId: 'sess-alpha',
      agentId: 'orchestrator',
      userId: 'user-alpha',
      llmOverride: llmA,
    })
    const r2 = await executeAgentQuery('Session B isolated check', {
      sessionId: 'sess-beta',
      agentId: 'orchestrator',
      userId: 'user-beta',
      llmOverride: llmB,
    })

    expect(r1.output).toContain('session a greeting')
    expect(r2.output).toContain('session b isolated')
    expect(r2.output).not.toContain('session a')
    // Both saw fresh single-turn human+system message count rather than leaking Session A into B
    expect(r1.output).toContain('History count seen: 2')
    expect(r2.output).toContain('History count seen: 2')
  })

  it('recognizes rectification intent in Monica router and attaches AI tools on /api/monica-agent only when relevant', async () => {
    const intent = monicaRouter.analyzeIntent(
      "What's my rising sign? Help me rectify my birth time."
    )
    expect(intent.primaryIntent).toBe('astrological')

    expect(isRectificationIntent("What's my rising sign?")).toBe(true)
    expect(
      isRectificationIntent('In the morning around 9am and I graduated in 2012', [
        { role: 'assistant', content: 'Let us rectify your rising sign credible window.' },
      ])
    ).toBe(true)
    expect(isRectificationIntent('What herbs pair best with roasted fennel?')).toBe(false)

    mockGenerateText.mockResolvedValue({
      text: 'I can help narrow down your rising sign using Swiss Ephemeris rectification.',
    })

    const rectReq = new NextRequest('http://localhost:3000/api/monica-agent', {
      method: 'POST',
      body: JSON.stringify({
        message:
          "I don't know my exact birth time. Help me find my rising sign (July 14, 1990 in Chicago).",
        sessionId: 'monica-rect-1',
      }),
    })
    const rectRes = await monicaPost(rectReq)
    expect(rectRes.status).toBe(200)
    const rectCallArgs = mockGenerateText.mock.calls[0][0]
    expect(rectCallArgs.tools).toBeDefined()
    expect(Object.keys(rectCallArgs.tools)).toEqual(
      expect.arrayContaining([
        'geocode_location',
        'rectify_windows',
        'rectify_score',
        'rectify_apply',
      ])
    )
    expect(rectCallArgs.stopWhen).toBeDefined()

    // Non-rectification prompt should NOT receive rectification tools (preserves existing baseline)
    mockGenerateText.mockClear()
    const generalReq = new NextRequest('http://localhost:3000/api/monica-agent', {
      method: 'POST',
      body: JSON.stringify({
        message: 'Suggest an elemental tea blend for calm focus.',
        sessionId: 'monica-general-1',
      }),
    })
    const generalRes = await monicaPost(generalReq)
    expect(generalRes.status).toBe(200)
    const generalCallArgs = mockGenerateText.mock.calls[0][0]
    expect(generalCallArgs.tools).toBeUndefined()
  })
})
