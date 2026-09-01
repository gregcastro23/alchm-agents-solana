/** Stable, JSON-safe controller types at the ASOL ↔ Pentacles boundary. */

export const PLANET_FACTIONS = [
  'Sun',
  'Moon',
  'Mercury',
  'Venus',
  'Mars',
  'Jupiter',
  'Saturn',
  'Uranus',
  'Neptune',
  'Pluto',
] as const

export type PlanetFaction = (typeof PLANET_FACTIONS)[number]
export type PentaclesSuit = 'Cups' | 'Swords' | 'Pentacles' | 'Wands'
export type PentaclesZoneKind = 'House' | 'Spire' | 'Crown'
export type PentaclesMeleeState = 'Mustering' | 'Seated' | 'Resolved'
export type PentaclesJingMove = 'Meltdown' | 'Freeze' | 'TectonicRoot' | 'Vacuum' | 'Erode'

export interface NatalPlacementInput {
  body: PlanetFaction
  sign: number
  arcMinutes: number
  retrograde: boolean
  dignity: number
}

export interface NatalChartInput {
  birthUnix: number
  birthLat: number
  birthLon: number
  timeKnown: boolean
  placements: NatalPlacementInput[]
  ascendant: number
  midheaven: number
  houseCusps: number[] | null
  houseSystem: string
  interceptedSigns: number[] | null
}

export interface PentaclesAgent {
  agentKey: string
  handle: string
  identity: string
  faction: PlanetFaction
  chart?: NatalChartInput
}

export interface AgentProvisioningInput {
  agentKey: string
  handle: string
  chart: NatalChartInput
  preferredFaction?: PlanetFaction
}

export interface PentaclesPlayer {
  identity: string
  handle: string
  faction: PlanetFaction
  tokens: string
  wordWins: number
}

export interface PentaclesCard {
  cardId: string
  ownerIdentity: string
  suit: PentaclesSuit
  rank: number
  health: number
  attack: number
  armour: number
  cooldownMs: number
  sourceBody: PlanetFaction
  inverted: boolean
  isMajor: boolean
  level: number
  letter: number
}

export interface PentaclesDeckSlot {
  slotId: string
  ownerIdentity: string
  cardId: string
  loadout: 'Active' | 'Defense' | 'Bench'
}

export interface PentaclesZone {
  zoneId: number
  kind: PentaclesZoneKind
  owner: PlanetFaction | null
  control: number
  inFlux: boolean
  fluxLevel: number
}

export interface PentaclesStar {
  hipId: number
  name: string
  magnitude: number
  heldBy: PlanetFaction | null
  regionHint: number
}

export interface PentaclesBattle {
  battleId: string
  starId: number
  attackerIdentity: string
  won: boolean
  attackerScore: number
  defenseRating: number
  createdAt: string
}

export interface PentaclesMeleeTable {
  tableId: string
  zoneId: number
  roundIndex: string
  trumpSuit: PentaclesSuit
  state: PentaclesMeleeState
  seatCount: number
  openedAt: string
  resolvedAt: string | null
}

export interface PentaclesMeleeSeat {
  seatId: string
  tableId: string
  occupantIdentity: string
  faction: PlanetFaction
  isHuman: boolean
  claim: number
  counters: number
  meldsValue: number
  score: number
}

export interface PentaclesMeleeHandCard {
  handId: string
  tableId: string
  seatId: string
  cardId: string
  suit: PentaclesSuit
  rank: number
  isMajor: boolean
  inverted: boolean
  played: boolean
}

export interface PentaclesMeleePlay {
  playId: string
  tableId: string
  trickNumber: number
  seatId: string
  cardId: string
  suit: PentaclesSuit
  rank: number
  isMajor: boolean
  playedAt: string
}

export interface PentaclesMeleeTrick {
  trickId: string
  tableId: string
  trickNumber: number
  leaderSeat: string
  ledSuit: PentaclesSuit | null
  winnerSeat: string
  counters: number
  resolvedAt: string
}

export interface PentaclesAgentMeleeTurn {
  turnId: string
  tableId: string
  seatId: string
  occupantIdentity: string
  trickNumber: number
  legalCardIds: string[]
  requestedAt: string
  expiresAt: string
  selectedCardId: string | null
  answeredAt: string | null
  resolvedAt: string | null
  fallbackUsed: boolean
}

export interface PentaclesSnapshot {
  capturedAt: string
  players: PentaclesPlayer[]
  agents: PentaclesAgent[]
  cards: PentaclesCard[]
  deckSlots: PentaclesDeckSlot[]
  zones: PentaclesZone[]
  stars: PentaclesStar[]
  battles: PentaclesBattle[]
  wordDuels: unknown[]
  jingDuels: unknown[]
  meleeTables: PentaclesMeleeTable[]
  meleeSeats: PentaclesMeleeSeat[]
  meleeHands: PentaclesMeleeHandCard[]
  meleePlays: PentaclesMeleePlay[]
  meleeTricks: PentaclesMeleeTrick[]
  meleeQueue: unknown[]
  agentMeleeTurns: PentaclesAgentMeleeTurn[]
}

export type PentaclesAction =
  | 'provision_agent'
  | 'star_battle'
  | 'word_duel'
  | 'jing_cast'
  | 'jing_counter'
  | 'war_table_card'

export interface PentaclesIntent {
  intentId: string
  action: PentaclesAction
  agentKey: string
  targetId: string
  cardIds: string[]
  rationale: string
  score: number
  createdAt: string
}

export interface PentaclesControllerRun {
  runId: string
  startedAt: string
  finishedAt: string
  dryRun: boolean
  rosterSeen: number
  intents: PentaclesIntent[]
  executed: number
  skipped: number
  failed: number
  errors: string[]
}

export interface PentaclesControllerStatus {
  enabled: boolean
  active: boolean
  paused: boolean
  dryRun: boolean
  intervalMs: number
  lastRun: PentaclesControllerRun | null
  lastSnapshotAt: string | null
}

export interface WordCandidate {
  word: string
  score: number
}

export interface WarTableChoiceInput {
  faction: PlanetFaction
  trumpSuit: PentaclesSuit
  trickNumber: number
  legalCardIds: string[]
  hand: PentaclesCard[]
}
