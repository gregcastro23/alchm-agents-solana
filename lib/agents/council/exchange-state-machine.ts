/**
 * Exchange State Machine
 *
 * Client-side orchestration for sequential Council turns.
 * Manages exchange life-cycle, fences stale responses via unique exchange IDs,
 * handles AbortController cancellation when the user types or new events arrive,
 * and emits typed state events to UI listeners.
 */

import type { CouncilTurnResponse } from './council-schema'
import type { CouncilTurnContext } from './council-context'

export type ExchangeEventType =
  | 'EXCHANGE_STARTED'
  | 'TURN_STARTED'
  | 'TURN_COMPLETED'
  | 'TYPING_CHANGE'
  | 'EXCHANGE_COMPLETED'
  | 'ERROR'

export interface ExchangeEvent {
  type: ExchangeEventType
  exchangeId: string
  turnIndex?: number
  speakerKey?: string
  speakerName?: string
  response?: CouncilTurnResponse
  isTyping?: boolean
  error?: string
}

export type ExchangeEventListener = (event: ExchangeEvent) => void

export interface StartExchangeOptions {
  seekerInquiry?: string
  targetDelegate?: string
  attachedNatalEnvelope?: unknown
  ingressEvent?: {
    movingPlanet: string
    newSign: string
    newDegree: number
    isFinalWord?: boolean
    turnIndex?: number
  }
  recentTurns?: CouncilTurnContext[]
  selectedAgentFilter?: string
  maxTurns?: number
  fetchFn?: typeof fetch
  turnDelayMs?: number
}

export class ExchangeStateMachine {
  private currentExchangeId: string | null = null
  private abortController: AbortController | null = null
  private listeners: Set<ExchangeEventListener> = new Set()
  private isExecuting = false

  /**
   * Subscribe to exchange lifecycle events.
   * Returns an unsubscribe callback.
   */
  public subscribe(listener: ExchangeEventListener): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(event: ExchangeEvent) {
    for (const listener of this.listeners) {
      try {
        listener(event)
      } catch (err) {
        console.error('[ExchangeStateMachine] Error in listener:', err)
      }
    }
  }

  /**
   * Cancel any in-flight exchange immediately.
   */
  public cancel(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    this.currentExchangeId = null
    this.isExecuting = false
  }

  /**
   * Check if an exchange is currently actively processing.
   */
  public isActive(): boolean {
    return this.isExecuting
  }

  /**
   * Execute a sequential council exchange.
   * If an exchange is already in-flight, cancels it before starting.
   */
  public async startExchange(options: StartExchangeOptions): Promise<void> {
    // 1. Cancel existing in-flight exchange
    this.cancel()

    // 2. Initialize new exchange tracking
    const exchangeId = `exc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    this.currentExchangeId = exchangeId
    this.abortController = new AbortController()
    this.isExecuting = true

    const { signal } = this.abortController
    const fetchFn = options.fetchFn || fetch
    const turnDelayMs = options.turnDelayMs ?? 1200

    this.emit({
      type: 'EXCHANGE_STARTED',
      exchangeId,
    })

    const maxTurns = options.maxTurns || (options.seekerInquiry ? 2 : 3)
    const turnsAccumulated: CouncilTurnContext[] = [...(options.recentTurns || [])]

    try {
      for (let turnIdx = 0; turnIdx < maxTurns; turnIdx++) {
        // Guard: check if aborted or stale
        if (signal.aborted || this.currentExchangeId !== exchangeId) {
          return
        }

        // Determine request for this turn
        const turnRequest = {
          seekerInquiry: options.seekerInquiry,
          targetDelegate: turnIdx === 0 ? options.targetDelegate : undefined,
          attachedNatalEnvelope: options.attachedNatalEnvelope,
          ingressEvent: options.ingressEvent
            ? {
                ...options.ingressEvent,
                turnIndex: turnIdx,
              }
            : undefined,
          recentTurns: turnsAccumulated,
          selectedAgentFilter: options.selectedAgentFilter,
        }

        // Emit typing change
        this.emit({
          type: 'TYPING_CHANGE',
          exchangeId,
          isTyping: true,
        })

        // Call backend API
        const res = await fetchFn('/api/agents/council-voice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(turnRequest),
          signal,
        })

        if (signal.aborted || this.currentExchangeId !== exchangeId) {
          return
        }

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status} from council-voice`)
        }

        const data: CouncilTurnResponse = await res.json()

        if (signal.aborted || this.currentExchangeId !== exchangeId) {
          return
        }

        this.emit({
          type: 'TYPING_CHANGE',
          exchangeId,
          isTyping: false,
          speakerKey: data.speakerKey,
        })

        this.emit({
          type: 'TURN_STARTED',
          exchangeId,
          turnIndex: turnIdx,
          speakerKey: data.speakerKey,
          speakerName: data.speakerName,
        })

        this.emit({
          type: 'TURN_COMPLETED',
          exchangeId,
          turnIndex: turnIdx,
          speakerKey: data.speakerKey,
          speakerName: data.speakerName,
          response: data,
        })

        // Append to turn context for downstream turns in this exchange
        turnsAccumulated.push({
          turnId: `turn-${exchangeId}-${turnIdx}`,
          speakerKey: data.speakerKey as any,
          speakerName: data.speakerName,
          text: data.text,
          claim: data.newClaim,
          speechAct: data.speechAct as any,
        })

        // Inter-turn pause if there are more turns
        if (turnIdx < maxTurns - 1) {
          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(resolve, turnDelayMs)
            signal.addEventListener('abort', () => {
              clearTimeout(timeout)
              reject(new Error('Exchange aborted'))
            })
          }).catch(err => {
            if (signal.aborted) return
            throw err
          })
        }
      }

      if (this.currentExchangeId === exchangeId) {
        this.emit({
          type: 'EXCHANGE_COMPLETED',
          exchangeId,
        })
      }
    } catch (err: any) {
      if (signal.aborted || this.currentExchangeId !== exchangeId) {
        return // Ignored clean cancellation
      }
      console.warn('[ExchangeStateMachine] Exchange encountered error:', err)
      this.emit({
        type: 'ERROR',
        exchangeId,
        error: err?.message || 'Unknown exchange error',
      })
      this.emit({
        type: 'TYPING_CHANGE',
        exchangeId,
        isTyping: false,
      })
    } finally {
      if (this.currentExchangeId === exchangeId) {
        this.isExecuting = false
      }
    }
  }
}
