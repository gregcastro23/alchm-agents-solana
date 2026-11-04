import {
  ZONE_PROFILES,
  SEAL_TIER_MULTIPLIERS,
  bestZoneId,
  computeZoneSynergies,
  earnedSeals,
  effectiveContestRating,
  evaluateSeals,
  rateStats,
  resolveZoneContest,
  type ContestVessel,
  type CoreStats,
  type EsmsToken,
  type SacredStatKey,
  type VesselArchetype,
  type ZoneContestResult,
  type ZoneProfile,
  type ZoneSynergy,
} from '@/lib/agents/rating'
import type { AlchemicalSeal, ResonanceSurgeState } from '@/lib/agents/rating-contract'
import type { Element } from '@/lib/staking/types'

export type EsmsBalances = Record<EsmsToken, number>

export interface SquadVesselCandidate {
  id: string
  name: string
  title: string
  faction: string
  element: Element
  ratings: CoreStats
  esmsBalances: EsmsBalances
  ovr: number
  archetype: VesselArchetype
  seals: AlchemicalSeal[]
  surge: Pick<ResonanceSurgeState, 'active' | 'statBoosts'>
  bestZoneId: number
  bestZoneLabel: string
  bestZoneEcr: number
  zoneSynergies: ZoneSynergy[]
}

export interface TarotMeleeCard {
  handId: string
  tableId: string
  seatId: string
  cardId: string
  suit: 'Wands' | 'Cups' | 'Swords' | 'Pentacles'
  rank: number
  isMajor: boolean
  inverted: boolean
  played: boolean
  title: string
  element: Element
  tacticalNote: string
  ecrBonus: number
}

export interface SlottedZoneSimulation {
  zone: ZoneProfile
  attacker: SquadVesselCandidate | null
  defenderName: string
  defenderFaction: string
  defenderOvr: number
  currentAttackerControl: number
  contest: ZoneContestResult | null
  tarotBonusEcr: number
  effectiveAttackerEcr: number
  winProbabilityPct: number
  projectedTricksWon: number
  sealMultiplier: number
}

const SUIT_TO_ELEMENT: Record<TarotMeleeCard['suit'], Element> = {
  Wands: 'Fire',
  Cups: 'Water',
  Swords: 'Air',
  Pentacles: 'Earth',
}

const MAJOR_ARCANA_TITLES: Record<number, string> = {
  0: '0 · The Fool',
  1: 'I · The Magician',
  2: 'II · The High Priestess',
  3: 'III · The Empress',
  4: 'IV · The Emperor',
  5: 'V · The Hierophant',
  6: 'VI · The Lovers',
  7: 'VII · The Chariot',
  8: 'VIII · Strength',
  9: 'IX · The Hermit',
  10: 'X · Wheel of Fortune',
  11: 'XI · Justice',
  12: 'XII · The Hanged Man',
  13: 'XIII · Death',
  14: 'XIV · Temperance',
  15: 'XV · The Devil',
  16: 'XVI · The Tower',
  17: 'XVII · The Star',
  18: 'XVIII · The Moon',
  19: 'XIX · The Sun',
  20: 'XX · Judgement',
  21: 'XXI · The World',
}

const MINOR_RANK_LABELS: Record<number, string> = {
  1: 'Ace',
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Page',
  12: 'Knight',
  13: 'Queen',
  14: 'King',
}

/**
 * Compute top-3 stat boosts (+12 / +8 / +4) when a vessel's Resonance Surge is active.
 */
export function buildSurgeBoosts(
  ratings: CoreStats,
  active: boolean
): Pick<ResonanceSurgeState, 'active' | 'statBoosts'> {
  const entries = (Object.entries(ratings) as [SacredStatKey, number][]).sort((a, b) => b[1] - a[1])
  const statBoosts: Partial<Record<SacredStatKey, number>> = {}
  if (entries[0]) statBoosts[entries[0][0]] = 12
  if (entries[1]) statBoosts[entries[1][0]] = 8
  if (entries[2]) statBoosts[entries[2][0]] = 4
  return { active, statBoosts }
}

export function buildSquadVesselCandidate(input: {
  id: string
  name: string
  title: string
  faction: string
  element: Element
  ratings: CoreStats
  esmsBalances: EsmsBalances
  surgeActive?: boolean
}): SquadVesselCandidate {
  const rated = rateStats(input.ratings)
  const seals = earnedSeals(
    evaluateSeals({
      stats: input.ratings,
      esmsBalances: input.esmsBalances,
    })
  )
  const surge = buildSurgeBoosts(input.ratings, Boolean(input.surgeActive))
  const contestVessel: ContestVessel = {
    ratings: input.ratings,
    seals,
    surge,
  }
  const zoneSynergies = computeZoneSynergies(contestVessel)
  const optimalZoneId = bestZoneId(contestVessel)
  const bestSynergy = zoneSynergies[optimalZoneId] ?? zoneSynergies[0]

  return {
    id: input.id,
    name: input.name,
    title: input.title,
    faction: input.faction,
    element: input.element,
    ratings: input.ratings,
    esmsBalances: input.esmsBalances,
    ovr: rated.ovr,
    archetype: rated.archetype,
    seals,
    surge,
    bestZoneId: optimalZoneId,
    bestZoneLabel: bestSynergy?.label ?? 'House N-ENE',
    bestZoneEcr: bestSynergy?.synergy ?? rated.ovr,
    zoneSynergies,
  }
}

export const WAR_TABLE_CANONICAL_ROSTER: SquadVesselCandidate[] = [
  buildSquadVesselCandidate({
    id: 'mars-vanguard',
    name: 'Ares Crucible Vanguard',
    title: 'Horizon Bastion Commander',
    faction: 'Mars',
    element: 'Fire',
    ratings: {
      power: 95,
      resonance: 72,
      wisdom: 68,
      charisma: 88,
      intuition: 74,
      adaptability: 76,
      vitality: 92,
    },
    esmsBalances: { spirit: 420, essence: 140, matter: 260, substance: 150 },
    surgeActive: true,
  }),
  buildSquadVesselCandidate({
    id: 'saturn-bulwark',
    name: 'Kronos Lithic Warden',
    title: 'Northern Gate Anchor',
    faction: 'Saturn',
    element: 'Earth',
    ratings: {
      power: 89,
      resonance: 70,
      wisdom: 88,
      charisma: 66,
      intuition: 75,
      adaptability: 72,
      vitality: 96,
    },
    esmsBalances: { spirit: 160, essence: 150, matter: 460, substance: 190 },
    surgeActive: false,
  }),
  buildSquadVesselCandidate({
    id: 'mercury-sky-weaver',
    name: 'Hermes Caduceus Tactician',
    title: 'Eastern Spire Signalist',
    faction: 'Mercury',
    element: 'Air',
    ratings: {
      power: 76,
      resonance: 78,
      wisdom: 86,
      charisma: 82,
      intuition: 90,
      adaptability: 96,
      vitality: 72,
    },
    esmsBalances: { spirit: 190, essence: 180, matter: 140, substance: 450 },
    surgeActive: true,
  }),
  buildSquadVesselCandidate({
    id: 'jupiter-seer',
    name: 'Jove Astral Oracle',
    title: 'Star-Tip Diviner',
    faction: 'Jupiter',
    element: 'Fire',
    ratings: {
      power: 78,
      resonance: 84,
      wisdom: 92,
      charisma: 86,
      intuition: 95,
      adaptability: 85,
      vitality: 76,
    },
    esmsBalances: { spirit: 440, essence: 240, matter: 160, substance: 210 },
    surgeActive: false,
  }),
  buildSquadVesselCandidate({
    id: 'solaris-crown-sovereign',
    name: 'Sol Invictus Archon',
    title: 'Keystone of the Crown',
    faction: 'Sun',
    element: 'Water',
    ratings: {
      power: 85,
      resonance: 96,
      wisdom: 86,
      charisma: 95,
      intuition: 88,
      adaptability: 84,
      vitality: 84,
    },
    esmsBalances: { spirit: 340, essence: 480, matter: 260, substance: 280 },
    surgeActive: true,
  }),
  buildSquadVesselCandidate({
    id: 'lunaris-tide-sentinel',
    name: 'Selene Abyssal Sentinel',
    title: 'Western Horizon Keeper',
    faction: 'Moon',
    element: 'Water',
    ratings: {
      power: 86,
      resonance: 92,
      wisdom: 78,
      charisma: 79,
      intuition: 86,
      adaptability: 78,
      vitality: 94,
    },
    esmsBalances: { spirit: 150, essence: 430, matter: 240, substance: 180 },
    surgeActive: false,
  }),
  buildSquadVesselCandidate({
    id: 'uranus-flux-architect',
    name: 'Promethean Horizon Breaker',
    title: 'Gale-Force Vanguard',
    faction: 'Uranus',
    element: 'Air',
    ratings: {
      power: 93,
      resonance: 74,
      wisdom: 79,
      charisma: 75,
      intuition: 82,
      adaptability: 91,
      vitality: 88,
    },
    esmsBalances: { spirit: 220, essence: 160, matter: 190, substance: 410 },
    surgeActive: false,
  }),
  buildSquadVesselCandidate({
    id: 'venus-harmonic-mystic',
    name: 'Cytherean Spire Cantor',
    title: 'Western Spire Harmonist',
    faction: 'Venus',
    element: 'Water',
    ratings: {
      power: 70,
      resonance: 91,
      wisdom: 88,
      charisma: 89,
      intuition: 94,
      adaptability: 87,
      vitality: 74,
    },
    esmsBalances: { spirit: 180, essence: 450, matter: 170, substance: 230 },
    surgeActive: false,
  }),
]

/**
 * Exact branch-and-bound solver assigning up to 5 squad vessels to distinct zones in 0..10
 * to maximize the sum of Effective Contest Ratings (ECR).
 */
export function autoSlotSquadOptimalEcr(
  squad: readonly SquadVesselCandidate[]
): Record<number, string> {
  const limited = squad.slice(0, 11)
  const n = limited.length
  if (n === 0) return {}

  const zoneCount = ZONE_PROFILES.length
  const ecrMatrix: number[][] = limited.map(vessel =>
    ZONE_PROFILES.map(z => vessel.zoneSynergies[z.zoneId]?.synergy ?? vessel.ovr)
  )

  const maxPerVessel = ecrMatrix.map(row => Math.max(...row))
  const suffixMax = new Array<number>(n + 1).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    suffixMax[i] = suffixMax[i + 1] + maxPerVessel[i]
  }

  let bestTotal = -1
  let bestAssignment: number[] = new Array<number>(n).fill(0)
  const currentAssignment: number[] = new Array<number>(n).fill(0)

  function search(vesselIdx: number, usedMask: number, currentSum: number) {
    if (vesselIdx === n) {
      if (currentSum > bestTotal) {
        bestTotal = currentSum
        bestAssignment = [...currentAssignment]
      }
      return
    }
    if (currentSum + suffixMax[vesselIdx] <= bestTotal + 1e-9) {
      return
    }

    // Try zones in descending ECR order for this vessel so we hit the optimal bound immediately
    const row = ecrMatrix[vesselIdx]
    const zoneOrder = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].sort((a, b) => row[b] - row[a])

    for (const z of zoneOrder) {
      if ((usedMask & (1 << z)) !== 0) continue
      currentAssignment[vesselIdx] = z
      search(vesselIdx + 1, usedMask | (1 << z), currentSum + row[z])
    }
  }

  search(0, 0, 0)

  const slots: Record<number, string> = {}
  for (let i = 0; i < n; i++) {
    slots[bestAssignment[i]] = limited[i].id
  }
  return slots
}

/**
 * Highest Seal multiplier a vessel earns in a given zone.
 */
export function getVesselZoneSealMultiplier(
  vessel: SquadVesselCandidate,
  zone: ZoneProfile
): number {
  let mult = 1
  for (const seal of vessel.seals) {
    if (seal.category !== zone.esmsToken) continue
    const candidate = SEAL_TIER_MULTIPLIERS[seal.tier] ?? 1
    if (candidate > mult) mult = candidate
  }
  return mult
}

/**
 * Format or synthesize a 5-card Tarot Melee Hand (`my_melee_hand`).
 */
export function formatTarotMeleeCard(raw: {
  handId: string
  tableId: string
  seatId: string
  cardId: string
  suit: string
  rank: number
  isMajor: boolean
  inverted: boolean
  played: boolean
  trumpSuit?: string
}): TarotMeleeCard {
  const suit: TarotMeleeCard['suit'] =
    raw.suit === 'Wands' || raw.suit === 'Cups' || raw.suit === 'Swords' || raw.suit === 'Pentacles'
      ? raw.suit
      : 'Pentacles'
  const element = SUIT_TO_ELEMENT[suit]
  const title = raw.isMajor
    ? (MAJOR_ARCANA_TITLES[raw.rank % 22] ?? `Arcana ${raw.rank}`)
    : `${MINOR_RANK_LABELS[Math.max(1, Math.min(14, raw.rank))] ?? raw.rank} of ${suit}`

  const isTrump = raw.trumpSuit === suit
  const baseBonus = raw.isMajor ? 4.5 : Math.round((raw.rank / 14) * 3.2 * 10) / 10
  const trumpBonus = isTrump ? 2.0 : 0
  const polarityFactor = raw.inverted ? 0.85 : 1.0
  const ecrBonus = Math.round((baseBonus + trumpBonus) * polarityFactor * 10) / 10

  const tacticalNote = raw.isMajor
    ? `${raw.inverted ? 'Inverted' : 'Upright'} Major Arcana · Overrides minor suits & boosts ${element} zones`
    : `${isTrump ? 'Active Trump Suit · ' : ''}${raw.inverted ? 'Inverted polarity (defensive ward)' : `Direct ${element} trick lead`}`

  return {
    handId: raw.handId,
    tableId: raw.tableId,
    seatId: raw.seatId,
    cardId: raw.cardId,
    suit,
    rank: raw.rank,
    isMajor: raw.isMajor,
    inverted: raw.inverted,
    played: raw.played,
    title,
    element,
    tacticalNote,
    ecrBonus,
  }
}

export function buildPreviewMeleeHand(
  seedOffset = 0,
  trumpSuit: TarotMeleeCard['suit'] = 'Wands'
): TarotMeleeCard[] {
  const specs: Array<{
    suit: TarotMeleeCard['suit']
    rank: number
    isMajor: boolean
    inverted: boolean
  }> = [
    { suit: 'Wands', rank: (19 + seedOffset) % 22, isMajor: true, inverted: false },
    { suit: 'Pentacles', rank: ((13 + seedOffset) % 14) + 1, isMajor: false, inverted: false },
    { suit: 'Swords', rank: ((11 + seedOffset * 2) % 14) + 1, isMajor: false, inverted: false },
    { suit: 'Cups', rank: (2 + seedOffset) % 22, isMajor: true, inverted: seedOffset % 2 === 1 },
    { suit: 'Wands', rank: ((9 + seedOffset * 3) % 14) + 1, isMajor: false, inverted: false },
  ]

  return specs.map((spec, idx) =>
    formatTarotMeleeCard({
      handId: `sim-hand-${seedOffset}-${idx + 1}`,
      tableId: 'sim-table-1',
      seatId: 'seat-alpha',
      cardId: `card-${100 + seedOffset * 10 + idx}`,
      suit: spec.suit,
      rank: spec.rank,
      isMajor: spec.isMajor,
      inverted: spec.inverted,
      played: false,
      trumpSuit,
    })
  )
}

/**
 * Simulate all 11 Pentacle zones for the current squad assignment and active Tarot melee card.
 */
export function simulateAllZonesForSquad(params: {
  slottedByZone: Record<number, string>
  roster: readonly SquadVesselCandidate[]
  liveZones?: ReadonlyArray<{
    zoneId: number
    owner: string | null
    control: number
  }>
  selectedCard?: TarotMeleeCard | null
}): SlottedZoneSimulation[] {
  const vesselById = new Map(params.roster.map(v => [v.id, v]))
  const liveZoneById = new Map((params.liveZones ?? []).map(z => [z.zoneId, z]))

  const DEFENDER_FACTIONS = [
    'Saturn',
    'Mercury',
    'Mars',
    'Moon',
    'Venus',
    'Jupiter',
    'Uranus',
    'Sun',
    'Pluto',
    'Neptune',
    'Sun',
  ]

  return ZONE_PROFILES.map(zone => {
    const liveZone = liveZoneById.get(zone.zoneId)
    const defenderFaction =
      liveZone?.owner ?? DEFENDER_FACTIONS[zone.zoneId % DEFENDER_FACTIONS.length]
    const baseDefStat = 74 + ((zone.zoneId * 3) % 14)
    const defenderRatings: CoreStats = {
      power: Math.min(96, baseDefStat + (zone.kind === 'House' ? 8 : 2)),
      resonance: Math.min(96, baseDefStat + (zone.kind === 'Crown' ? 10 : 3)),
      wisdom: Math.min(96, baseDefStat + (zone.kind === 'Spire' ? 9 : 3)),
      charisma: Math.min(96, baseDefStat + (zone.kind === 'Crown' ? 9 : 2)),
      intuition: Math.min(96, baseDefStat + (zone.kind === 'Spire' ? 8 : 2)),
      adaptability: Math.min(96, baseDefStat + (zone.kind === 'Spire' ? 7 : 3)),
      vitality: Math.min(96, baseDefStat + (zone.kind === 'House' ? 9 : 3)),
    }
    const defenderSeals = earnedSeals(
      evaluateSeals({
        stats: defenderRatings,
        esmsBalances: { spirit: 210, essence: 210, matter: 210, substance: 210 },
      })
    )
    const defenderRated = rateStats(defenderRatings)
    const defenderVessel: ContestVessel = {
      ratings: defenderRatings,
      seals: defenderSeals,
      surge: null,
    }

    const currentAttackerControl = liveZone
      ? Math.max(0, Math.min(100, 50 - Math.round(liveZone.control / 2)))
      : 50

    const slottedVesselId = params.slottedByZone[zone.zoneId]
    const attacker = slottedVesselId ? (vesselById.get(slottedVesselId) ?? null) : null

    if (!attacker) {
      const defEcr = effectiveContestRating(defenderVessel, zone.zoneId)
      return {
        zone,
        attacker: null,
        defenderName: `${defenderFaction} Sentinel`,
        defenderFaction,
        defenderOvr: defenderRated.ovr,
        currentAttackerControl,
        contest: null,
        tarotBonusEcr: 0,
        effectiveAttackerEcr: 0,
        winProbabilityPct: 0,
        projectedTricksWon: 0,
        sealMultiplier: 1,
      }
    }

    const attackerVessel: ContestVessel = {
      ratings: attacker.ratings,
      seals: attacker.seals,
      surge: attacker.surge,
    }

    const contest = resolveZoneContest(
      attackerVessel,
      defenderVessel,
      zone.zoneId,
      currentAttackerControl
    )

    const card = params.selectedCard
    const cardElementMatchesZone = card && !card.played && card.element === zone.element
    const tarotBonusEcr =
      card && !card.played
        ? Math.round((cardElementMatchesZone ? card.ecrBonus * 1.35 : card.ecrBonus * 0.65) * 100) /
          100
        : 0

    const effectiveAttackerEcr = Math.round((contest.attackerScore + tarotBonusEcr) * 100) / 100
    const scoreDiff = effectiveAttackerEcr - contest.defenderScore
    const winProbabilityPct = Math.max(5, Math.min(98, Math.round(50 + scoreDiff * 1.75)))
    const projectedTricksWon = Math.max(1, Math.min(12, Math.round((winProbabilityPct / 100) * 12)))

    return {
      zone,
      attacker,
      defenderName: `${defenderFaction} Sentinel`,
      defenderFaction,
      defenderOvr: defenderRated.ovr,
      currentAttackerControl,
      contest,
      tarotBonusEcr,
      effectiveAttackerEcr,
      winProbabilityPct,
      projectedTricksWon,
      sealMultiplier: getVesselZoneSealMultiplier(attacker, zone),
    }
  })
}
