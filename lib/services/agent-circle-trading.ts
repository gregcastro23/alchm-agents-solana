import {
  circleBoard,
  acceptCircleOffer,
  postCircleOffer,
  type CircleFailure,
} from '@/lib/alchm-transmute-sync'

export interface CircleAgent {
  userId: string
  agentEmail: string
  agentName: string
}

function logRefusal(agent: CircleAgent, action: string, result: CircleFailure): void {
  console.warn(
    `[AgentCircle] ${agent.agentEmail} ${action} refused: ${result.reason ?? result.error ?? (result.skipped ? 'sync not configured' : 'unknown')} ${result.message ?? ''}`
  )
}

/** One board read, then at most one mutation. The next tick always reads again. */
export async function circleStep(agent: CircleAgent): Promise<void> {
  try {
    const board = await circleBoard(agent.agentEmail)
    if (!board.ok) {
      logRefusal(agent, 'board', board)
      return
    }
    if (!board.market.live || !board.needs || board.needs.lacking.length === 0) return

    const today = new Date().toISOString().slice(0, 10)
    const lastTradeAt = board.stats.lastTradeAt ? new Date(board.stats.lastTradeAt) : null
    const tradedToday =
      lastTradeAt !== null &&
      Number.isFinite(lastTradeAt.getTime()) &&
      lastTradeAt.toISOString().slice(0, 10) === today

    if (!tradedToday) {
      const configuredEdge = Number(process.env.AGENT_CIRCLE_MIN_EDGE_PCT ?? 0)
      const minEdge = Number.isFinite(configuredEdge) ? configuredEdge : 0
      const offer = board.board.find(
        candidate =>
          candidate.youCanFill &&
          candidate.complementsYou &&
          candidate.market !== null &&
          candidate.market.takerEdgePct >= minEdge &&
          (!candidate.maker.isAgent || candidate.directedToYou)
      )
      if (offer) {
        const result = await acceptCircleOffer(agent.agentEmail, offer.id)
        if (result.ok) {
          console.info(`[AgentCircle] ${agent.agentEmail} traded ${JSON.stringify(result.trade)}`)
        } else {
          logRefusal(agent, 'accept', result)
        }
        // A refusal or uncertain timeout is final for this tick. In particular,
        // do not post after a fill that may have committed without a response.
        return
      }
    }

    if (board.mine.some(offer => offer.status === 'open') || !board.suggestion) return
    const { giveToken, wantToken } = board.suggestion
    const result = await postCircleOffer({
      agentEmail: agent.agentEmail,
      ...board.suggestion,
      ttlHours: 24,
      idempotencyKey: `circle_offer:${agent.userId}:${today}`,
      message: `${agent.agentName.trim()} seeks ${wantToken} — trading ${giveToken} at the index.`,
    })
    if (result.ok) {
      console.info(`[AgentCircle] ${agent.agentEmail} posted offer ${result.offer.id}`)
    } else {
      logRefusal(agent, 'offer', result)
    }
  } catch (error) {
    // A malformed response or unexpected local failure must not abort the tick.
    console.warn(
      `[AgentCircle] ${agent.agentEmail} stopped: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
