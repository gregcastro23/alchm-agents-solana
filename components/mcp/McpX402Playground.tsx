'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Coins,
  Copy,
  Check,
  Cpu,
  KeyRound,
  Play,
  RefreshCw,
  Repeat,
  ShieldCheck,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import { rateStats, evaluateSeals, earnedSeals, type CoreStats } from '@/lib/agents/rating'
import {
  MCP_V140_TOOL_CATALOG,
  buildX402PaymentPreview,
  prepareMcpArguments,
  rateMcpToolReadiness,
  type McpSettlementRail,
  type McpV140ToolName,
  type NormalizedMcpBillingReceipt,
} from '@/lib/mcp/playground-catalog'

const RAIL_LABELS: Record<McpSettlementRail, { label: string; badge: string; network: string }> = {
  'arc-eip3009': {
    label: 'Circle Arc EIP-3009',
    badge: 'Self-Settled',
    network: 'eip155:5042002',
  },
  'solana-amm': {
    label: 'Solana Constellation AMM',
    badge: 'SPL / ESMS Swap',
    network: 'solana:mainnet-beta',
  },
  'base-x402': {
    label: 'Base Sepolia x402',
    badge: 'Facilitator',
    network: 'eip155:84532',
  },
}

interface LedgerEntry {
  id: string
  tool: McpV140ToolName
  receipt: NormalizedMcpBillingReceipt
  pvr: number
}

function makeIdempotencyKey(toolName: string) {
  const rand = Math.random().toString(36).slice(2, 10)
  return `idem_${toolName.slice(0, 12)}_${rand}`
}

export function McpX402Playground({ defaultExpanded = true }: { defaultExpanded?: boolean }) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [selectedToolName, setSelectedToolName] = useState<McpV140ToolName>('get_live_sky_transits')
  const [rail, setRail] = useState<McpSettlementRail>('arc-eip3009')
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    makeIdempotencyKey('get_live_sky_transits')
  )
  const [argsText, setArgsText] = useState<string>(() =>
    JSON.stringify(MCP_V140_TOOL_CATALOG[0].defaultArgs, null, 2)
  )
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastResult, setLastResult] = useState<Record<string, unknown> | null>(null)
  const [lastReceipt, setLastReceipt] = useState<NormalizedMcpBillingReceipt | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const selectedTool = useMemo(
    () => MCP_V140_TOOL_CATALOG.find(t => t.name === selectedToolName) ?? MCP_V140_TOOL_CATALOG[0],
    [selectedToolName]
  )

  const toolPvr = useMemo(() => rateMcpToolReadiness(selectedTool), [selectedTool])

  const playgroundRibbon = useMemo(() => {
    const stats: CoreStats = {
      power: Math.min(99, selectedTool.stats.power + (ledger.length > 0 ? 3 : 0)),
      resonance: Math.min(99, selectedTool.stats.resonance + (rail === 'arc-eip3009' ? 2 : 1)),
      wisdom: Math.min(99, selectedTool.stats.wisdom),
      charisma: Math.min(99, selectedTool.stats.charisma + Math.min(6, ledger.length * 2)),
      intuition: Math.min(99, selectedTool.stats.intuition),
      adaptability: Math.min(99, selectedTool.stats.adaptability + 2),
      vitality: Math.min(99, selectedTool.stats.vitality + 2),
    }
    const rated = rateStats(stats)
    const seals = earnedSeals(
      evaluateSeals({
        stats,
        esmsBalances: {
          spirit: 180 + ledger.length * 15,
          essence: 165 + ledger.length * 12,
          matter: 150 + ledger.length * 10,
          substance: 175 + ledger.length * 14,
        },
      })
    )
    return { ovr: rated.ovr, archetype: rated.archetype, seals }
  }, [selectedTool, rail, ledger.length])

  const handleSelectTool = useCallback((toolName: McpV140ToolName) => {
    const found = MCP_V140_TOOL_CATALOG.find(t => t.name === toolName)
    if (!found) return
    setSelectedToolName(toolName)
    setArgsText(JSON.stringify(found.defaultArgs, null, 2))
    setIdempotencyKey(makeIdempotencyKey(toolName))
    setError(null)
  }, [])

  const parsedArgs = useMemo(() => {
    try {
      const parsed = JSON.parse(argsText)
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : {}
    } catch {
      return selectedTool.defaultArgs
    }
  }, [argsText, selectedTool.defaultArgs])

  const jsonRpcPreview = useMemo(
    () => ({
      jsonrpc: '2.0',
      id: 1,
      method: 'tools/call',
      params: {
        name: selectedTool.name,
        arguments: prepareMcpArguments(parsedArgs, idempotencyKey),
      },
    }),
    [selectedTool.name, parsedArgs, idempotencyKey]
  )

  const x402Preview = useMemo(
    () => buildX402PaymentPreview(selectedTool, rail, idempotencyKey),
    [selectedTool, rail, idempotencyKey]
  )

  const executeToolCall = useCallback(
    async (customKey?: string) => {
      const activeKey = customKey ?? idempotencyKey
      setRunning(true)
      setError(null)
      try {
        let parsed: Record<string, unknown>
        try {
          parsed = JSON.parse(argsText)
        } catch {
          throw new Error('Arguments must be valid JSON object syntax.')
        }

        const res = await fetch('/api/mcp/playground', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: selectedTool.name,
            arguments: parsed,
            idempotencyKey: activeKey,
            settlementRail: rail,
          }),
        })
        const payload = await res.json()
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || `Execution failed (${res.status})`)
        }

        const receipt = payload.billing as NormalizedMcpBillingReceipt
        setLastResult(payload.result as Record<string, unknown>)
        setLastReceipt(receipt)
        setLedger(prev => [
          {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tool: selectedTool.name,
            receipt,
            pvr: Number(payload.pvr ?? toolPvr.ovr),
          },
          ...prev.slice(0, 7),
        ])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to execute MCP tool call')
      } finally {
        setRunning(false)
      }
    },
    [argsText, idempotencyKey, rail, selectedTool.name, toolPvr.ovr]
  )

  const copyText = (text: string, id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(text)
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1800)
    }
  }

  return (
    <section
      aria-label="In-Browser MCP v1.4.0 and x402 Protocol Playground"
      className="rounded-2xl border border-amber-400/25 bg-zinc-950/85 p-5 shadow-[0_0_35px_rgba(245,158,11,0.08)] backdrop-blur-md space-y-5"
    >
      {/* Header Bar */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-md border border-amber-400/40 bg-amber-400/10 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-amber-200">
              <Terminal className="h-3 w-3" />
              @alchm/mcp-server@1.4.0
            </span>
            <span className="rounded-md border border-emerald-400/35 bg-emerald-500/10 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              x402 + EIP-3009 + Solana AMM
            </span>
            <span className="rounded-md border border-purple-400/35 bg-purple-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-purple-200">
              Tool PVR {toolPvr.ovr} · {toolPvr.archetype.title}
            </span>
          </div>
          <h3 className="text-lg font-extrabold tracking-tight text-white">
            In-Browser MCP &amp; x402 Protocol Playground
          </h3>
          <p className="text-xs text-zinc-400 max-w-3xl">
            Execute any of the 8 canonical{' '}
            <code className="text-amber-200">@alchm/mcp-server@1.4.0</code> tools, inspect{' '}
            <code className="text-sky-300">_meta.idempotencyKey</code> forwarding, verify zero-cost
            idempotent replay receipts, and preview x402 micropayment headers across Circle Arc,
            Solana Constellation AMM, and Base Sepolia.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(prev => !prev)}
          className="rounded-xl border border-white/15 bg-white/[0.04] px-3.5 py-2 font-mono text-[11px] font-semibold text-zinc-200 hover:bg-white/[0.08] transition"
        >
          {expanded ? 'Collapse Playground' : 'Open Interactive Playground'}
        </button>
      </div>

      <VesselRatingRibbon
        ovr={playgroundRibbon.ovr}
        archetype={playgroundRibbon.archetype}
        seals={playgroundRibbon.seals}
        compact
      />

      {expanded && (
        <div className="space-y-5">
          {/* 1. 8-Tool Selector Grid */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                1. Select Canonical @alchm/mcp-server@1.4.0 Tool (8 Allowlisted)
              </span>
              <span className="font-mono text-[10px] text-zinc-500">
                Protocol Version: 2025-06-18
              </span>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {MCP_V140_TOOL_CATALOG.map(tool => {
                const isSelected = tool.name === selectedTool.name
                const rating = rateMcpToolReadiness(tool)
                const totalEsms =
                  tool.esmsCost.spirit +
                  tool.esmsCost.essence +
                  tool.esmsCost.matter +
                  tool.esmsCost.substance
                return (
                  <button
                    key={tool.name}
                    type="button"
                    onClick={() => handleSelectTool(tool.name)}
                    className={`rounded-xl border p-3 text-left transition-all ${
                      isSelected
                        ? 'border-amber-400/50 bg-amber-500/10 shadow-[0_0_20px_rgba(245,158,11,0.12)]'
                        : 'border-white/10 bg-zinc-900/50 hover:border-white/20 hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span className="truncate font-mono text-[11px] font-bold text-white">
                        {tool.name}
                      </span>
                      <span className="shrink-0 rounded border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[9px] font-bold text-amber-300">
                        PVR {rating.ovr}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-zinc-400 leading-snug">
                      {tool.description}
                    </p>
                    <div className="mt-2.5 flex items-center justify-between border-t border-white/5 pt-2 font-mono text-[9px] text-zinc-400">
                      <span>{totalEsms} ESMS</span>
                      <span>${(Number(tool.x402AtomicUsdc) / 1_000_000).toFixed(3)} USDC</span>
                      <span
                        className={tool.mutating ? 'text-purple-300 font-bold' : 'text-emerald-300'}
                      >
                        {tool.mutating ? 'MUTATING' : 'READ'}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 2. Settlement Rail + Idempotency Controls */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Settlement Rail Switcher */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  <Coins className="h-3.5 w-3.5 text-amber-400" />
                  2. x402 / On-Chain Settlement Rail
                </span>
                <span className="font-mono text-[10px] text-emerald-300">
                  {RAIL_LABELS[rail].network}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {(Object.keys(RAIL_LABELS) as McpSettlementRail[]).map(r => {
                  const info = RAIL_LABELS[r]
                  const active = rail === r
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRail(r)}
                      className={`rounded-lg border px-3 py-2 text-left transition ${
                        active
                          ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'
                          : 'border-white/10 bg-zinc-950/60 text-zinc-400 hover:bg-zinc-900'
                      }`}
                    >
                      <div className="text-xs font-bold">{info.label}</div>
                      <div className="mt-0.5 font-mono text-[9px] uppercase tracking-wider opacity-80">
                        {info.badge}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Idempotency Key & Replay Control */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  <KeyRound className="h-3.5 w-3.5 text-sky-400" />
                  3. _meta.idempotencyKey &amp; Replay Guard
                </span>
                <button
                  type="button"
                  onClick={() => setIdempotencyKey(makeIdempotencyKey(selectedTool.name))}
                  className="inline-flex items-center gap-1 rounded border border-sky-400/30 bg-sky-500/10 px-2 py-0.5 font-mono text-[10px] font-semibold text-sky-200 hover:bg-sky-500/20"
                >
                  <RefreshCw className="h-2.5 w-2.5" />
                  New Key
                </button>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  aria-label="Idempotency key"
                  value={idempotencyKey}
                  onChange={e => setIdempotencyKey(e.target.value)}
                  className="w-full rounded-lg border border-white/15 bg-zinc-950 px-3 py-1.5 font-mono text-xs text-sky-200 focus:border-sky-400 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => copyText(idempotencyKey, 'idem')}
                  className="rounded-lg border border-white/10 bg-zinc-950 p-2 text-zinc-400 hover:text-white"
                  title="Copy Idempotency Key"
                >
                  {copiedId === 'idem' ? (
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              <p className="text-[11px] text-zinc-400">
                First execution with a key returns{' '}
                <code className="text-emerald-300">status: &quot;charged&quot;, debited: true</code>
                . Re-running with the same key returns{' '}
                <code className="text-amber-300">
                  status: &quot;replayed&quot;, debited: false, replayed: true
                </code>
                .
              </p>
            </div>
          </div>

          {/* 3. Arguments Editor + JSON-RPC / x402 Inspector */}
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  Tool Input Arguments (JSON)
                </span>
                <button
                  type="button"
                  onClick={() => setArgsText(JSON.stringify(selectedTool.defaultArgs, null, 2))}
                  className="font-mono text-[10px] text-zinc-400 underline hover:text-zinc-200"
                >
                  Reset Default Payload
                </button>
              </div>
              <textarea
                aria-label="Tool input arguments JSON"
                rows={6}
                value={argsText}
                onChange={e => setArgsText(e.target.value)}
                className="w-full rounded-xl border border-white/10 bg-zinc-950/90 p-3 font-mono text-xs text-zinc-100 focus:border-amber-400/50 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void executeToolCall()}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-gradient-to-r from-amber-500/25 via-orange-500/20 to-amber-500/25 px-4 py-2.5 font-mono text-xs font-bold uppercase tracking-wider text-amber-100 hover:brightness-110 disabled:opacity-50 transition"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  {running ? 'Invoking MCP Tool...' : 'Invoke Tool Call'}
                </button>
                <button
                  type="button"
                  disabled={running}
                  onClick={() => void executeToolCall(idempotencyKey)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-purple-400/35 bg-purple-500/15 px-3.5 py-2.5 font-mono text-xs font-bold text-purple-200 hover:bg-purple-500/25 disabled:opacity-50 transition"
                >
                  <Repeat className="h-3.5 w-3.5" />
                  Replay Same Key (0-Cost Test)
                </button>
              </div>
              {error && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 font-mono text-xs text-rose-200">
                  {error}
                </div>
              )}
            </div>

            {/* Live JSON-RPC 2.0 + x402 Envelope Preview */}
            <div className="rounded-xl border border-white/10 bg-zinc-900/40 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-300">
                  JSON-RPC 2.0 Wire Envelope &amp; x402 Payment Header
                </span>
                <button
                  type="button"
                  onClick={() =>
                    copyText(JSON.stringify({ jsonRpcPreview, x402Preview }, null, 2), 'rpc')
                  }
                  className="inline-flex items-center gap-1 font-mono text-[10px] text-zinc-400 hover:text-white"
                >
                  {copiedId === 'rpc' ? (
                    <Check className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  Copy Wire JSON
                </button>
              </div>
              <pre className="max-h-48 overflow-auto rounded-xl border border-white/5 bg-zinc-950/90 p-3 font-mono text-[11px] text-sky-200/90">
                {JSON.stringify({ jsonRpc: jsonRpcPreview, x402Header: x402Preview }, null, 2)}
              </pre>
            </div>
          </div>

          {/* 4. Normalized Billing Receipt & Tool Execution Output */}
          {lastReceipt && lastResult && (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-950/15 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    Normalized Billing Receipt (alchm_mcp._normalize_billing)
                  </span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase ${
                      lastReceipt.replayed
                        ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                        : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                    }`}
                  >
                    {lastReceipt.status} · debited={String(lastReceipt.debited)} · replayed=
                    {String(lastReceipt.replayed)}
                  </span>
                </div>
                <pre className="max-h-52 overflow-auto rounded-xl border border-white/5 bg-zinc-950/90 p-3 font-mono text-[11px] text-emerald-200">
                  {JSON.stringify(lastReceipt, null, 2)}
                </pre>
              </div>

              <div className="rounded-xl border border-purple-500/25 bg-purple-950/15 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-purple-200">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    Structured Tool Output ({selectedTool.name})
                  </span>
                  <span className="font-mono text-[10px] text-zinc-400">
                    PVR {toolPvr.ovr} Verified
                  </span>
                </div>
                <pre className="max-h-52 overflow-auto rounded-xl border border-white/5 bg-zinc-950/90 p-3 font-mono text-[11px] text-purple-100">
                  {JSON.stringify(lastResult, null, 2)}
                </pre>
              </div>
            </div>
          )}

          {/* 5. Session Receipt Ledger */}
          {ledger.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-zinc-900/30 p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                  <Cpu className="h-3.5 w-3.5 text-amber-400" />
                  Session MCP Receipt Ledger ({ledger.length} Invocations)
                </span>
                <span className="font-mono text-[10px] text-zinc-500">
                  Idempotent replays charge 0 ESMS / 0 USDC
                </span>
              </div>
              <div className="divide-y divide-white/5">
                {ledger.map(entry => (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 font-mono text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <CheckCircle2
                        className={`h-3.5 w-3.5 ${
                          entry.receipt.replayed ? 'text-amber-400' : 'text-emerald-400'
                        }`}
                      />
                      <span className="font-bold text-white">{entry.tool}</span>
                      <span className="rounded border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        PVR {entry.pvr}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        key: {entry.receipt.idempotencyKey}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span className="text-zinc-400">{entry.receipt.rail}</span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                          entry.receipt.replayed
                            ? 'bg-amber-500/15 text-amber-300'
                            : 'bg-emerald-500/15 text-emerald-300'
                        }`}
                      >
                        {entry.receipt.replayed
                          ? 'REPLAYED (0 ESMS)'
                          : `CHARGED (${
                              entry.receipt.cost.spirit +
                              entry.receipt.cost.essence +
                              entry.receipt.cost.matter +
                              entry.receipt.cost.substance
                            } ESMS)`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
