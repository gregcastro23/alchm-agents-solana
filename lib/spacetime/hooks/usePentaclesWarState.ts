'use client'

import { useEffect, useMemo, useState } from 'react'
import { tables } from '@/lib/spacetime/generated'
import type {
  AgentChart,
  AgentMeleeTurn,
  Battle,
  Card,
  DeckSlot,
  DuelChallenge,
  JingDuel,
  MeleeHand,
  MeleePlay,
  MeleeQueue,
  MeleeSeat,
  MeleeTable,
  MeleeTrick,
  Player,
  StarNode,
  WordDuel,
  Zone,
} from '@/lib/spacetime/generated/types'
import { useSpacetime } from '@/lib/spacetime/SpacetimeContext'

interface RawWarState {
  players: Player[]
  agents: AgentChart[]
  cards: Card[]
  deckSlots: DeckSlot[]
  zones: Zone[]
  stars: StarNode[]
  battles: Battle[]
  duelChallenges: DuelChallenge[]
  wordDuels: WordDuel[]
  jingDuels: JingDuel[]
  meleeTables: MeleeTable[]
  meleeSeats: MeleeSeat[]
  meleeHands: MeleeHand[]
  meleePlays: MeleePlay[]
  meleeTricks: MeleeTrick[]
  meleeQueue: MeleeQueue[]
  agentMeleeTurns: AgentMeleeTurn[]
}

interface ObservableTable {
  onInsert: (callback: (...args: any[]) => void) => void
  onUpdate: (callback: (...args: any[]) => void) => void
  onDelete: (callback: (...args: any[]) => void) => void
  removeOnInsert: (callback: (...args: any[]) => void) => void
  removeOnUpdate: (callback: (...args: any[]) => void) => void
  removeOnDelete: (callback: (...args: any[]) => void) => void
}

const EMPTY: RawWarState = {
  players: [],
  agents: [],
  cards: [],
  deckSlots: [],
  zones: [],
  stars: [],
  battles: [],
  duelChallenges: [],
  wordDuels: [],
  jingDuels: [],
  meleeTables: [],
  meleeSeats: [],
  meleeHands: [],
  meleePlays: [],
  meleeTricks: [],
  meleeQueue: [],
  agentMeleeTurns: [],
}

export function usePentaclesWarState() {
  const { connection, status } = useSpacetime()
  const [raw, setRaw] = useState<RawWarState>(EMPTY)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!connection) {
      setRaw(EMPTY)
      setIsReady(status === 'disabled')
      return
    }

    let disposed = false
    const sync = () => {
      if (disposed) return
      setRaw({
        players: Array.from(connection.db.player.iter()),
        agents: Array.from(connection.db.agent_chart.iter()),
        cards: Array.from(connection.db.card.iter()),
        deckSlots: Array.from(connection.db.deck_slot.iter()),
        zones: Array.from(connection.db.zone.iter()),
        stars: Array.from(connection.db.star_node.iter()),
        battles: Array.from(connection.db.battle.iter()),
        duelChallenges: Array.from(connection.db.duel_challenge.iter()),
        wordDuels: Array.from(connection.db.word_duel.iter()),
        jingDuels: Array.from(connection.db.jing_duel.iter()),
        meleeTables: Array.from(connection.db.melee_table.iter()),
        meleeSeats: Array.from(connection.db.melee_seat.iter()),
        meleeHands: Array.from(connection.db.melee_hand.iter()),
        meleePlays: Array.from(connection.db.melee_play.iter()),
        meleeTricks: Array.from(connection.db.melee_trick.iter()),
        meleeQueue: Array.from(connection.db.melee_queue.iter()),
        agentMeleeTurns: Array.from(connection.db.agent_melee_turn.iter()),
      })
      setIsReady(true)
      setError(null)
    }
    const onChange = () => sync()
    const observed: ObservableTable[] = [
      connection.db.player,
      connection.db.agent_chart,
      connection.db.card,
      connection.db.deck_slot,
      connection.db.zone,
      connection.db.star_node,
      connection.db.battle,
      connection.db.duel_challenge,
      connection.db.word_duel,
      connection.db.jing_duel,
      connection.db.melee_table,
      connection.db.melee_seat,
      connection.db.melee_hand,
      connection.db.melee_play,
      connection.db.melee_trick,
      connection.db.melee_queue,
      connection.db.agent_melee_turn,
    ] as ObservableTable[]

    for (const table of observed) {
      table.onInsert(onChange)
      table.onUpdate(onChange)
      table.onDelete(onChange)
    }

    const subscription = connection
      .subscriptionBuilder()
      .onApplied(sync)
      .onError(() => {
        if (!disposed) {
          setError('The Pentacles gameplay subscription failed.')
          setIsReady(true)
        }
      })
      .subscribe([
        tables.player,
        tables.agent_chart,
        tables.card,
        tables.deck_slot,
        tables.zone,
        tables.star_node,
        tables.battle,
        tables.duel_challenge,
        tables.word_duel,
        tables.jing_duel,
        tables.melee_table,
        tables.melee_seat,
        tables.melee_hand,
        tables.melee_play,
        tables.melee_trick,
        tables.melee_queue,
        tables.agent_melee_turn,
      ])

    return () => {
      disposed = true
      for (const table of observed) {
        table.removeOnInsert(onChange)
        table.removeOnUpdate(onChange)
        table.removeOnDelete(onChange)
      }
      if (!subscription.isEnded()) subscription.unsubscribe()
    }
  }, [connection, status])

  const state = useMemo(() => {
    const agents = new Set(raw.agents.map(agent => agent.identity.toHexString()))
    const agentByIdentity = new Map(
      raw.agents.map(agent => [agent.identity.toHexString(), agent.handle])
    )
    const playerByIdentity = new Map(
      raw.players.map(player => [player.identity.toHexString(), player])
    )
    const cardsByOwner = new Map<string, number>()
    for (const card of raw.cards) {
      const identity = card.owner.toHexString()
      cardsByOwner.set(identity, (cardsByOwner.get(identity) ?? 0) + 1)
    }
    const activeCardsByOwner = new Map<string, number>()
    for (const slot of raw.deckSlots) {
      if (slot.loadout.tag !== 'Active') continue
      const identity = slot.owner.toHexString()
      activeCardsByOwner.set(identity, (activeCardsByOwner.get(identity) ?? 0) + 1)
    }

    return {
      players: raw.players.map(player => ({
        identity: player.identity.toHexString(),
        handle: player.handle,
        faction: player.faction.tag,
        tokens: player.tokens.toString(),
        isAgent: agents.has(player.identity.toHexString()),
        cardCount: cardsByOwner.get(player.identity.toHexString()) ?? 0,
        activeCardCount: activeCardsByOwner.get(player.identity.toHexString()) ?? 0,
      })),
      agents: raw.agents.map(agent => {
        const identity = agent.identity.toHexString()
        return {
          identity,
          handle: agent.handle,
          faction: playerByIdentity.get(identity)?.faction.tag ?? 'Unknown',
          cardCount: cardsByOwner.get(identity) ?? 0,
          activeCardCount: activeCardsByOwner.get(identity) ?? 0,
        }
      }),
      zones: raw.zones
        .map(zone => ({
          zoneId: zone.zoneId,
          kind: zone.kind.tag,
          owner: zone.owner?.tag ?? null,
          control: zone.control,
          inFlux: zone.inFlux,
          fluxLevel: zone.fluxLevel,
          claimedStars: raw.stars.filter(star => star.regionHint === zone.zoneId && star.heldBy)
            .length,
        }))
        .sort((left, right) => left.zoneId - right.zoneId),
      battles: raw.battles
        .map(battle => ({
          battleId: battle.battleId.toString(),
          starId: battle.starId,
          attacker: agentByIdentity.get(battle.attacker.toHexString()) ?? 'Unknown seeker',
          won: battle.won,
          attackerScore: battle.attackerScore,
          defenseRating: battle.defenseRating,
          createdAt: battle.createdAt.toDate().toISOString(),
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      wordDuels: raw.wordDuels
        .map(duel => ({
          duelId: duel.duelId.toString(),
          player:
            agentByIdentity.get(duel.player.toHexString()) ??
            playerByIdentity.get(duel.player.toHexString())?.handle ??
            'Unknown seeker',
          opponent: duel.opponent.tag,
          playerWord: duel.playerWord,
          playerScore: duel.playerScore,
          agentWord: duel.agentWord,
          agentScore: duel.agentScore,
          won: duel.won,
          tokensAwarded: duel.tokensAwarded.toString(),
          createdAt: duel.createdAt.toDate().toISOString(),
          agentRationale: duel.agentRationale ?? null,
        }))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
      pendingWordChallenges: raw.duelChallenges
        .filter(challenge => !challenge.answered)
        .map(challenge => ({
          challengeId: challenge.challengeId.toString(),
          player:
            agentByIdentity.get(challenge.player.toHexString()) ??
            playerByIdentity.get(challenge.player.toHexString())?.handle ??
            'Unknown seeker',
          opponent: challenge.opponent.tag,
          playerWord: challenge.playerWord,
          playerScore: challenge.playerScore,
          candidateCount: (() => {
            try {
              const candidates: unknown = JSON.parse(challenge.candidates)
              return Array.isArray(candidates) ? candidates.length : 0
            } catch {
              return 0
            }
          })(),
          createdAt: challenge.createdAt.toDate().toISOString(),
        }))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt)),
      jingDuels: raw.jingDuels
        .map(duel => ({
          duelId: duel.duelId.toString(),
          initiator:
            agentByIdentity.get(duel.initiator.toHexString()) ??
            playerByIdentity.get(duel.initiator.toHexString())?.handle ??
            'Unknown seeker',
          targetPlayer: duel.targetPlayer?.toHexString() ?? null,
          targetAgent: duel.targetAgent?.tag ?? null,
          openingMove: duel.openingMove.tag,
          state: duel.state.tag,
          winnerIsInitiator: duel.winnerIsInitiator ?? null,
          createdAt: duel.createdAt.toDate().toISOString(),
          updatedAt: duel.updatedAt.toDate().toISOString(),
        }))
        .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
      meleeQueue: raw.meleeQueue
        .map(entry => ({
          identity: entry.identity.toHexString(),
          handle:
            agentByIdentity.get(entry.identity.toHexString()) ??
            playerByIdentity.get(entry.identity.toHexString())?.handle ??
            'Unknown seeker',
          zoneId: entry.zoneId,
          faction: entry.faction.tag,
          queuedAt: entry.queuedAt.toDate().toISOString(),
        }))
        .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt)),
      meleeTables: raw.meleeTables
        .map(table => ({
          tableId: table.tableId.toString(),
          zoneId: table.zoneId,
          roundIndex: table.roundIndex.toString(),
          trumpSuit: table.trumpSuit.tag,
          state: table.state.tag,
          seatCount: table.seatCount,
          openedAt: table.openedAt.toDate().toISOString(),
          resolvedAt: table.resolvedAt?.toDate().toISOString() ?? null,
          seats: raw.meleeSeats
            .filter(seat => seat.tableId === table.tableId)
            .map(seat => ({
              seatId: seat.seatId.toString(),
              occupant:
                agentByIdentity.get(seat.occupant.toHexString()) ??
                playerByIdentity.get(seat.occupant.toHexString())?.handle ??
                'Unknown seeker',
              faction: seat.faction.tag,
              isHuman: seat.isHuman,
              claim: seat.claim,
              score: seat.score,
              counters: seat.counters,
            })),
          plays: raw.meleePlays.filter(play => play.tableId === table.tableId).length,
          tricks: raw.meleeTricks.filter(trick => trick.tableId === table.tableId).length,
          cardsRemaining: raw.meleeHands.filter(
            card => card.tableId === table.tableId && !card.played
          ).length,
          pendingAgentTurns: raw.agentMeleeTurns.filter(
            turn => turn.tableId === table.tableId && turn.resolvedAt == null
          ).length,
        }))
        .sort((left, right) => Number(BigInt(right.tableId) - BigInt(left.tableId))),
    }
  }, [raw])

  return {
    ...state,
    status,
    loading: status !== 'disabled' && !isReady,
    error,
    isLive: raw.zones.length > 0,
  }
}

export default usePentaclesWarState
