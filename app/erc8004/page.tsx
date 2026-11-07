'use client'

/**
 * ERC-8004 Agent Leaderboard — "a one-stop place to discover trustworthy, payable
 * agents." The Google Cloud prize frontend: ranks ERC-8004 mainnet agents by
 * reputation feedback + validation pass rate (indexed live from BigQuery via
 * /api/erc8004/registry) and highlights x402-payable agents.
 *
 * Deploy on Cloud Run: `next build` (standalone) → container. Reads from the
 * BigQuery-backed API route, so it renders an empty/error state without GCP creds.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Bot, ExternalLink, RefreshCw, ShieldCheck, Star, Zap } from 'lucide-react'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { McpX402Playground } from '@/components/mcp/McpX402Playground'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'

interface LeaderboardEntry {
  agentId: string
  globalId: string
  owner: string
  agentURI: string
  file: {
    name?: string
    description?: string
    services?: { name: string; endpoint: string }[]
    supportedTrust?: string[]
  } | null
  prizeEligible: boolean
  supportedTrust: string[]
  feedbackCount: number
  avgFeedback: number | null
  validationCount: number
  avgValidation: number | null
  validationPassRate: number | null
  score: number
  registeredAt: string
}

const short = (a: string) => (a?.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a)
const pct = (n: number | null) => (n == null ? '—' : `${Math.round(n * 100)}%`)

export default function Erc8004LeaderboardPage() {
  const [agents, setAgents] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [limit, setLimit] = useState(50)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/erc8004/registry?type=leaderboard&limit=${limit}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error || `HTTP ${res.status}`)
      setAgents(json.agents ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load leaderboard')
      setAgents([])
    } finally {
      setLoading(false)
    }
  }, [limit])

  useEffect(() => {
    void load()
  }, [load])

  const getAgentPvr = useCallback((a: LeaderboardEntry) => {
    const scoreBoost = Math.min(25, Math.round((a.score || 0) * 0.25))
    const feedbackBoost = Math.min(20, Math.round((a.avgFeedback ?? 3.8) * 4))
    const passBoost = Math.min(20, Math.round((a.validationPassRate ?? 0.75) * 20))
    const x402Boost = a.prizeEligible ? 8 : 0
    const stats: CoreStats = {
      power: Math.min(99, Math.max(58, 56 + scoreBoost + x402Boost)),
      resonance: Math.min(99, Math.max(58, 56 + feedbackBoost + x402Boost)),
      wisdom: Math.min(
        99,
        Math.max(58, 56 + Math.min(20, a.supportedTrust.length * 6) + scoreBoost)
      ),
      charisma: Math.min(99, Math.max(62, 60 + scoreBoost + x402Boost)),
      intuition: Math.min(99, Math.max(60, 58 + Math.round((feedbackBoost + passBoost) / 2))),
      adaptability: Math.min(99, Math.max(60, 58 + scoreBoost)),
      vitality: Math.min(99, Math.max(58, 56 + passBoost + x402Boost)),
    }
    return rateStats(stats).ovr
  }, [])

  const registryCohortRating = useMemo(() => {
    const x402Count = agents.filter(a => a.prizeEligible).length
    const avgScore =
      agents.length > 0 ? agents.reduce((acc, a) => acc + (a.score || 0), 0) / agents.length : 74
    const stats: CoreStats = {
      power: Math.min(99, Math.max(70, Math.round(68 + Math.min(26, avgScore * 0.25)))),
      resonance: Math.min(99, Math.max(70, Math.round(70 + Math.min(24, x402Count * 2)))),
      wisdom: Math.min(99, Math.max(70, Math.round(70 + Math.min(25, avgScore * 0.22)))),
      charisma: Math.min(99, Math.max(74, Math.round(74 + Math.min(22, x402Count * 2.5)))),
      intuition: Math.min(99, Math.max(72, Math.round(72 + Math.min(22, avgScore * 0.2)))),
      adaptability: Math.min(99, Math.max(72, Math.round(71 + Math.min(22, x402Count * 2)))),
      vitality: Math.min(99, Math.max(72, Math.round(72 + Math.min(22, agents.length * 0.3)))),
    }
    const esmsBalances = {
      spirit: 48,
      essence: 44,
      matter: 52,
      substance: 46,
    }
    const sealProgress = evaluateSeals({ stats, esmsBalances })
    const seals = earnedSeals(sealProgress)
    const rated = rateStats(stats)
    return {
      ovr: rated.ovr,
      archetype: rated.archetype,
      seals,
    }
  }, [agents])

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 text-slate-100">
      <header className="mb-8">
        <div className="flex items-center gap-3">
          <Bot className="h-8 w-8 text-emerald-400" />
          <h1 className="text-3xl font-bold tracking-tight">ERC-8004 Agent Registry</h1>
        </div>
        <p className="mt-2 max-w-2xl text-slate-400">
          Discover trustworthy, payable AI agents. Ranked by on-chain reputation feedback and
          validation, indexed live from the Ethereum mainnet ERC-8004 registry via Google BigQuery.
          <span className="ml-1 inline-flex items-center gap-1 text-emerald-400">
            <Zap className="h-3.5 w-3.5" /> = accepts x402 payments
          </span>
        </p>
        <div className="mt-4 max-w-xl">
          <VesselRatingRibbon
            ovr={registryCohortRating.ovr}
            archetype={registryCohortRating.archetype}
            seals={registryCohortRating.seals}
            compact
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-emerald-600/90 px-3 py-1.5 text-sm font-medium hover:bg-emerald-500"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1.5 text-sm"
          >
            {[25, 50, 100, 250].map(n => (
              <option key={n} value={n}>
                Top {n}
              </option>
            ))}
          </select>
          <Link
            href="/gallery"
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-400/10 px-3 py-1.5 font-mono text-xs font-semibold text-amber-200 hover:bg-amber-400/20 transition-colors"
          >
            Rated Entities Vault (PVR 25–99)
          </Link>
          <Link
            href="/desktop"
            className="inline-flex items-center gap-1.5 rounded-lg border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 font-mono text-xs font-semibold text-violet-200 hover:bg-violet-500/20 transition-colors"
          >
            @alchm/mcp-server@1.5.0 Bridge
          </Link>
        </div>
      </header>

      {error && (
        <div className="mb-6 rounded-xl border border-amber-700/50 bg-amber-950/40 p-4 text-amber-200">
          <p className="font-medium">Couldn&apos;t load the registry.</p>
          <p className="mt-1 text-sm text-amber-300/80">{error}</p>
          <p className="mt-1 text-xs text-amber-300/60">
            The live index is temporarily unavailable. You can retry without losing your place.
          </p>
        </div>
      )}

      <div className="mb-8">
        <McpX402Playground defaultExpanded />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/60 backdrop-blur">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/80 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-4 py-3">#</th>
              <th className="px-4 py-3">Agent</th>
              <th className="px-4 py-3 text-right">Score</th>
              <th className="px-4 py-3 text-right">Feedback</th>
              <th className="px-4 py-3 text-right">Validation</th>
              <th className="px-4 py-3">Trust</th>
              <th className="px-4 py-3">Owner</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {loading && agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Querying BigQuery…
                </td>
              </tr>
            ) : agents.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  No agents indexed yet.
                </td>
              </tr>
            ) : (
              agents.map((a, i) => (
                <tr key={a.globalId} className="hover:bg-slate-800/40">
                  <td className="px-4 py-3 font-mono text-slate-500">{i + 1}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-100">
                        {a.file?.name || `Agent #${a.agentId}`}
                      </span>
                      <span className="rounded-full border border-amber-400/35 bg-amber-500/15 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                        PVR {getAgentPvr(a)}
                      </span>
                      {a.prizeEligible && (
                        <span
                          title="Accepts x402 payments"
                          className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300"
                        >
                          <Zap className="h-3 w-3" /> x402
                        </span>
                      )}
                      {a.agentURI && (
                        <a
                          href={a.agentURI.startsWith('http') ? a.agentURI : undefined}
                          target="_blank"
                          rel="noreferrer"
                          className="text-slate-500 hover:text-slate-300"
                          title={a.agentURI}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                    {a.file?.description && (
                      <p className="mt-0.5 line-clamp-1 max-w-md text-xs text-slate-500">
                        {a.file.description}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-300">
                    {a.score.toFixed(1)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      {a.avgFeedback != null ? a.avgFeedback.toFixed(1) : '—'}
                    </span>
                    <span className="ml-1 text-xs text-slate-500">({a.feedbackCount})</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-sky-400" />
                      {pct(a.validationPassRate)}
                    </span>
                    <span className="ml-1 text-xs text-slate-500">({a.validationCount})</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {a.supportedTrust.length === 0 ? (
                        <span className="text-xs text-slate-600">—</span>
                      ) : (
                        a.supportedTrust.map(t => (
                          <span
                            key={t}
                            className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-300"
                          >
                            {t}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-400">{short(a.owner)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-6 text-center text-xs text-slate-600">
        Indexed from <code className="text-slate-500">goog_blockchain_ethereum_mainnet_us</code> ·
        ERC-8004 IdentityRegistry <code className="text-slate-500">0x8004A169…</code> · powered by
        Google BigQuery
      </footer>
    </main>
  )
}
