/**
 * Read-only Pentacles stats for the Alchm Vessel, over SpacetimeDB's HTTP SQL
 * API (public tables only). The player is linked through the public
 * `verified_solana_wallet` table — the same wallet this user verified here.
 *
 * Every table read is independent: a missing table (e.g. `pillar_duel` before
 * the module is republished) or a paused database nulls that stat and is
 * reported, but never fails the whole Vessel.
 */

import { getSpacetimeConfig } from '@/lib/spacetime/config'
import { quantizeEsms, type EsmsTuple, type VesselClash } from './contract'

const BASE58_PUBKEY = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const HEX_IDENTITY = /^(0x)?[0-9a-f]{64}$/i

type Row = Record<string, unknown>
export type Transport = typeof fetch

export interface PentaclesVesselStats {
  identity: string
  arenaTokens: number | null
  wordWins: number | null
  pillarPool: EsmsTuple | null
  arenaWins: number | null
  arenaResolved: number | null
  recentClashes: VesselClash[]
  /** Tables that could not be read, with the reason. */
  unavailable: string[]
}

// ── SATS JSON decoding (mirrors Pentacles src/net/spacetime.js) ─────────────

function elName(el: any, i: number): string {
  const n = el?.name ?? el?.Name
  if (typeof n === 'string') return n
  if (n && typeof n === 'object') return n.some ?? n.Some ?? `col${i}`
  return `col${i}`
}

function decodeSats(type: any, val: unknown): unknown {
  if (!type) return val
  if (type.Sum) {
    const variants = type.Sum.variants || []
    if (!Array.isArray(val)) return val
    const [tag, payload] = val
    const variant = variants[tag]
    const vname = (variant && (variant.name?.some ?? variant.name)) ?? String(tag)
    const isOption =
      variants.length === 2 && variants.some((v: any) => (v?.name?.some ?? v?.name) === 'none')
    if (isOption) {
      if (vname === 'none') return null
      return decodeSats(variant?.algebraic_type ?? variant?.algebraicType, payload)
    }
    return vname
  }
  if (type.Product && Array.isArray(val)) {
    const out: Row = {}
    ;(type.Product.elements || []).forEach((e: any, i: number) => {
      out[elName(e, i)] = decodeSats(e?.algebraic_type ?? e?.algebraicType, val[i])
    })
    return out
  }
  return val
}

export function decodeSqlResult(json: unknown): Row[] {
  const stmt: any = Array.isArray(json) ? json[json.length - 1] : json
  if (!stmt) return []
  const schema = stmt.schema || stmt.Schema
  const rows = stmt.rows || stmt.Rows || []
  if (!rows.length) return []
  const elements = schema?.elements || schema?.Elements || []
  const cols = elements.map((el: any, i: number) => elName(el, i))
  const types = elements.map((el: any) => el?.algebraic_type ?? el?.algebraicType)
  if (!Array.isArray(rows[0])) return rows
  return rows.map((row: unknown[]) => {
    const obj: Row = {}
    row.forEach((val, i) => {
      obj[cols[i] ?? `col${i}`] = decodeSats(types[i], val)
    })
    return obj
  })
}

export function identityHex(value: unknown): string | null {
  const raw = (value && typeof value === 'object' ? (value as Row).__identity__ : value) ?? null
  if (raw === null) return null
  let hex: string
  try {
    hex =
      typeof raw === 'bigint' || typeof raw === 'number'
        ? BigInt(raw).toString(16).padStart(64, '0')
        : String(raw).replace(/^0x/i, '').toLowerCase()
  } catch {
    return null
  }
  return HEX_IDENTITY.test(hex) ? hex : null
}

// ── Pure stat folds (unit tested) ────────────────────────────────────────────

function toMillis(ts: unknown): number {
  if (ts && typeof ts === 'object') {
    const micros = (ts as Row).__timestamp_micros_since_unix_epoch__
    if (micros !== undefined) return Math.floor(Number(micros) / 1000)
  }
  const n = Number(ts)
  return Number.isFinite(n) ? n : 0
}

interface DuelRow {
  duel_id?: unknown
  initiator?: unknown
  target_player?: unknown
  target_agent?: unknown
  winner_is_initiator?: unknown
  state?: unknown
  updated_at?: unknown
  created_at?: unknown
}

/** Fold duel rows (Jing or 14-Pillars) into this identity's wins and clashes. */
export function foldDuels(
  rows: DuelRow[],
  identity: string,
  kind: 'jing' | 'pillar'
): { wins: number; resolved: number; clashes: VesselClash[] } {
  let wins = 0
  let resolved = 0
  const clashes: VesselClash[] = []

  for (const row of rows) {
    const initiator = identityHex(row.initiator)
    const target = identityHex(row.target_player)
    const asInitiator = initiator === identity
    const asTarget = !asInitiator && target === identity
    if (!asInitiator && !asTarget) continue

    const outcome = row.winner_is_initiator
    const won = typeof outcome === 'boolean' ? (asInitiator ? outcome : !outcome) : null
    if (won !== null) {
      resolved += 1
      if (won) wins += 1
    }

    const opponent = asInitiator
      ? row.target_agent
        ? String(row.target_agent)
        : target
          ? `0x${target.slice(0, 8)}…`
          : 'unknown'
      : `0x${(initiator ?? '').slice(0, 8)}…`

    clashes.push({
      duelId: `${kind}:${String(row.duel_id)}`,
      source: 'pentacles',
      kind: kind === 'pillar' ? '14 Pillars' : 'Jing',
      opponent,
      won,
      timestamp: toMillis(row.updated_at ?? row.created_at),
    })
  }

  return { wins, resolved, clashes }
}

// ── HTTP reads ───────────────────────────────────────────────────────────────

function httpBase(): { base: string; db: string } | null {
  const cfg = getSpacetimeConfig()
  if (!cfg) return null
  const base = cfg.uri
    .replace(/^wss:\/\//, 'https://')
    .replace(/^ws:\/\//, 'http://')
    .replace(/\/+$/, '')
  return { base, db: cfg.moduleName }
}

async function sql(query: string, transport: Transport): Promise<Row[]> {
  const target = httpBase()
  if (!target) throw new Error('SpacetimeDB not configured')
  const res = await transport(`${target.base}/v1/database/${target.db}/sql`, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain' },
    body: query,
    signal: AbortSignal.timeout(6_000),
    cache: 'no-store',
  })
  if (!res.ok) {
    const text = (await res.text().catch(() => '')).slice(0, 120)
    throw new Error(text || `HTTP ${res.status}`)
  }
  return decodeSqlResult(await res.json())
}

/**
 * Resolve the Pentacles identity bound to `walletAddress` and read its public
 * stats. Returns null when no identity is bound to that wallet. Throws only
 * when the wallet lookup itself fails (database paused/unreachable).
 */
export async function loadPentaclesVesselStats(
  walletAddress: string,
  transport: Transport = fetch
): Promise<PentaclesVesselStats | null> {
  if (!BASE58_PUBKEY.test(walletAddress)) return null

  // Base58 has no quote characters, so the validated key is safe to inline.
  const bindings = await sql(
    `SELECT identity FROM verified_solana_wallet WHERE solana_pubkey = '${walletAddress}'`,
    transport
  )
  const identity = identityHex(bindings[0]?.identity)
  if (!identity) return null

  const unavailable: string[] = []
  const attempt = async <T>(table: string, fn: () => Promise<T>): Promise<T | null> => {
    try {
      return await fn()
    } catch (error) {
      unavailable.push(`${table}: ${error instanceof Error ? error.message : String(error)}`)
      return null
    }
  }

  // Filter server-side with a hex identity literal; if this SQL dialect rejects
  // it, fall back to a column-limited scan filtered here.
  const byIdentity = async (table: string, columns: string): Promise<Row[]> => {
    try {
      return await sql(`SELECT ${columns} FROM ${table} WHERE identity = 0x${identity}`, transport)
    } catch {
      const rows = await sql(`SELECT ${columns} FROM ${table}`, transport)
      return rows.filter(row => identityHex(row.identity) === identity)
    }
  }

  const [players, pools, jingRows, pillarRows] = await Promise.all([
    attempt('player', () => byIdentity('player', 'identity, tokens, word_wins')),
    attempt('pillar_pool', () => byIdentity('pillar_pool', 'identity, esms')),
    attempt('jing_duel', () =>
      sql(
        'SELECT duel_id, initiator, target_player, target_agent, winner_is_initiator, state, updated_at FROM jing_duel',
        transport
      )
    ),
    attempt('pillar_duel', () =>
      sql(
        'SELECT duel_id, initiator, target_player, target_agent, winner_is_initiator, state, updated_at FROM pillar_duel',
        transport
      )
    ),
  ])

  const player = players?.[0]
  const pool = pools?.[0]?.esms
  const jing = jingRows ? foldDuels(jingRows, identity, 'jing') : null
  const pillar = pillarRows ? foldDuels(pillarRows, identity, 'pillar') : null
  const duelSources = [jing, pillar].filter(Boolean) as Array<NonNullable<typeof jing>>

  return {
    identity,
    arenaTokens: player ? Number(player.tokens) : null,
    wordWins: player ? Number(player.word_wins) : null,
    pillarPool:
      Array.isArray(pool) && pool.length === 4
        ? (pool.map(v => quantizeEsms(Number(v))) as EsmsTuple)
        : null,
    arenaWins: duelSources.length ? duelSources.reduce((sum, d) => sum + d.wins, 0) : null,
    arenaResolved: duelSources.length ? duelSources.reduce((sum, d) => sum + d.resolved, 0) : null,
    recentClashes: duelSources
      .flatMap(d => d.clashes)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10),
    unavailable,
  }
}
