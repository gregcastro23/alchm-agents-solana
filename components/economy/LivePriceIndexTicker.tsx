'use client'

import React, { useState, useEffect } from 'react'
import {
  Flame,
  Droplets,
  Mountain,
  Wind,
  Copy,
  Check,
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Sparkles,
  RefreshCw,
  Coins,
} from 'lucide-react'
import { useElementalPriceIndex } from '@/hooks/useElementalPriceIndex'
import type { EsmsTokenName } from '@/lib/economy/price-index-contract'
import type {
  CircleBoardResonanceWindow,
  TriplicateTradeEvent,
} from '@/components/cosmic-agents/types'

interface LivePriceIndexTickerProps {
  variant?: 'ribbon' | 'matrix' | 'compact'
  className?: string
  onElementClick?: (axis: EsmsTokenName) => void
}

const TOKEN_VISUALS: Record<
  EsmsTokenName,
  {
    icon: typeof Flame
    border: string
    glow: string
    text: string
    bg: string
    badgeBg: string
    stroke: string
    fill: string
  }
> = {
  Spirit: {
    icon: Flame,
    border: 'border-orange-500/40 hover:border-orange-400',
    glow: 'shadow-[0_0_20px_rgba(249,115,22,0.18)]',
    text: 'text-orange-400',
    bg: 'bg-orange-950/20',
    badgeBg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
    stroke: '#fb923c',
    fill: 'rgba(251, 146, 60, 0.15)',
  },
  Essence: {
    icon: Droplets,
    border: 'border-sky-500/40 hover:border-sky-400',
    glow: 'shadow-[0_0_20px_rgba(56,189,248,0.18)]',
    text: 'text-sky-400',
    bg: 'bg-sky-950/20',
    badgeBg: 'bg-sky-500/10 text-sky-400 border-sky-500/30',
    stroke: '#38bdf8',
    fill: 'rgba(56, 189, 248, 0.15)',
  },
  Matter: {
    icon: Mountain,
    border: 'border-lime-500/40 hover:border-lime-400',
    glow: 'shadow-[0_0_20px_rgba(163,230,53,0.18)]',
    text: 'text-lime-400',
    bg: 'bg-lime-950/20',
    badgeBg: 'bg-lime-500/10 text-lime-400 border-lime-500/30',
    stroke: '#a3e635',
    fill: 'rgba(163, 230, 53, 0.15)',
  },
  Substance: {
    icon: Wind,
    border: 'border-purple-500/40 hover:border-purple-400',
    glow: 'shadow-[0_0_20px_rgba(192,132,252,0.18)]',
    text: 'text-purple-400',
    bg: 'bg-purple-950/20',
    badgeBg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
    stroke: '#c084fc',
    fill: 'rgba(192, 132, 252, 0.15)',
  },
}

function SparklineSvg({
  data,
  stroke,
  fill,
  width = 120,
  height = 36,
}: {
  data: number[]
  stroke: string
  fill: string
  width?: number
  height?: number
}) {
  if (!data || data.length < 2) return null

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points = data
    .map((val, idx) => {
      const x = (idx / (data.length - 1)) * width
      const y = height - ((val - min) / range) * (height - 8) - 4
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')

  const areaPoints = `0,${height} ${points} ${width},${height}`

  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`grad-${stroke.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.3" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#grad-${stroke.replace('#', '')})`} />
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
      />
    </svg>
  )
}

export function LivePriceIndexTicker({
  variant = 'ribbon',
  className = '',
  onElementClick,
}: LivePriceIndexTickerProps) {
  const { data, loading, error, lastRefreshed, refresh, formatIndex, formatChange, quotesList } =
    useElementalPriceIndex({ refreshIntervalMs: 15000 })

  const [copiedMint, setCopiedMint] = useState<string | null>(null)
  const [triplicateTrades, setTriplicateTrades] = useState<TriplicateTradeEvent[]>([])
  const [resonanceWindows, setResonanceWindows] = useState<CircleBoardResonanceWindow[]>([])

  useEffect(() => {
    if (typeof window === 'undefined') return

    let es: EventSource | null = null
    try {
      es = new EventSource('/api/feed/stream')

      const handleFeed = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload && payload.type === 'triplicate-trade') {
            const trade = payload as TriplicateTradeEvent
            setTriplicateTrades(prev => {
              const key = trade.tradeId || trade.id
              if (prev.some(t => (t.tradeId || t.id) === key)) return prev
              return [trade, ...prev].slice(0, 10)
            })
          }
        } catch {
          // ignore
        }
      }

      const handleResonanceWindow = (event: MessageEvent) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload && payload.windowKey) {
            const win = payload as CircleBoardResonanceWindow
            setResonanceWindows(prev => {
              if (prev.some(w => w.windowKey === win.windowKey)) return prev
              return [win, ...prev].slice(0, 5)
            })
          }
        } catch {
          // ignore
        }
      }

      es.addEventListener('feed', handleFeed)
      es.addEventListener('resonance_window', handleResonanceWindow)
    } catch {
      // EventSource fallback
    }

    return () => {
      if (es) {
        es.close()
      }
    }
  }, [])

  const copyToClipboard = (text: string, axis: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text)
      setCopiedMint(axis)
      setTimeout(() => setCopiedMint(null), 2000)
    }
  }

  const renderQuotePill = (quote: (typeof quotesList)[0], idx: number, isDuplicate = false) => {
    const vis = TOKEN_VISUALS[quote.axis]
    const Icon = vis.icon
    const change = formatChange(quote.change24hPct)
    const isPrimaryQuote = !isDuplicate && idx < quotesList.length

    return (
      <div
        key={`${quote.axis}-${idx}-${isDuplicate ? 'dup' : 'orig'}`}
        onClick={() => onElementClick?.(quote.axis)}
        onKeyDown={event => {
          if (isPrimaryQuote && onElementClick && (event.key === 'Enter' || event.key === ' ')) {
            event.preventDefault()
            onElementClick(quote.axis)
          }
        }}
        role={isPrimaryQuote ? (onElementClick ? 'button' : 'group') : undefined}
        tabIndex={isPrimaryQuote && onElementClick ? 0 : undefined}
        aria-hidden={!isPrimaryQuote}
        aria-label={
          isPrimaryQuote
            ? `${quote.name} (${quote.symbol}) ESMS Token index: ${formatIndex(quote)} IDX on Solana Devnet`
            : undefined
        }
        title={
          isPrimaryQuote
            ? `${quote.name} (${quote.symbol}) ESMS Token index on Solana Devnet`
            : undefined
        }
        className="inline-flex items-center gap-2.5 px-3 py-1 rounded-full bg-[#0e1014] border border-[#23262B] hover:border-[#8c947c]/60 transition-colors"
      >
        <Icon className={`w-3.5 h-3.5 ${vis.text}`} aria-hidden="true" />
        <span className="font-mono-label text-[10px] font-bold text-[#e0e4d2]">{quote.symbol}</span>
        <span className="font-mono-label text-[11px] text-[#e0e4d2] font-semibold">
          {formatIndex(quote)} IDX
        </span>
        <span
          className={`font-mono-label text-[9px] px-1.5 py-0.2 rounded font-bold flex items-center gap-0.5 ${
            change.isPositive ? 'text-[#b8fc4b] bg-[#b8fc4b]/10' : 'text-[#ff7b72] bg-[#ff7b72]/10'
          }`}
        >
          {change.isPositive ? (
            <TrendingUp className="w-2.5 h-2.5 inline" aria-hidden="true" />
          ) : (
            <TrendingDown className="w-2.5 h-2.5 inline" aria-hidden="true" />
          )}
          {change.text}
        </span>
        <span className="text-[9px] font-mono-label text-[#8c947c] hidden sm:inline">
          [SKY {Math.round(quote.weight * 100)}%]
        </span>
      </div>
    )
  }

  const renderTradePill = (trade: TriplicateTradeEvent, idx: number, isDuplicate = false) => (
    <div
      key={`triplicate-${trade.tradeId || trade.id}-${idx}-${isDuplicate ? 'dup' : 'orig'}`}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#171409] border border-amber-500/50 shadow-[0_0_12px_rgba(245,158,11,0.2)]"
      title={`Astrolabe Triplicate Trade: ${trade.aspectDescription}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" aria-hidden="true" />
      <span className="font-mono-label text-[10px] font-bold text-amber-300">
        TRIPLICATE: {trade.makerName} ⇄ {trade.takerName}
      </span>
      <span className="font-mono-label text-[10px] text-[#e0e4d2]">
        {trade.gaveAmount} {trade.gaveToken} ➔ {trade.receivedAmount} {trade.receivedToken}
      </span>
      <span className="font-mono-label text-[9px] px-1.5 py-0.2 rounded font-bold text-[#b8fc4b] bg-[#b8fc4b]/15 border border-[#b8fc4b]/30">
        +{trade.resonanceBonusPct}% REBATE
      </span>
    </div>
  )

  const renderWindowPill = (win: CircleBoardResonanceWindow, idx: number, isDuplicate = false) => (
    <div
      key={`window-${win.windowKey}-${idx}-${isDuplicate ? 'dup' : 'orig'}`}
      className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#0a1a14] border border-emerald-500/50 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
      title={`Celestial Resonance Window: ${win.harmonicAspect} via ${win.transitCatalyst}`}
    >
      <Sparkles className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
      <span className="font-mono-label text-[10px] font-bold text-emerald-300 uppercase">
        WINDOW: {win.harmonicAspect}
      </span>
      <span className="font-mono-label text-[9px] px-1.5 py-0.2 rounded font-bold text-[#b8fc4b] bg-[#b8fc4b]/15 border border-[#b8fc4b]/30">
        +{win.bonusPct}% SYNASTRY
      </span>
    </div>
  )

  const renderTickerTapeBatch = (batchKey: string, isDuplicate = false) => (
    <React.Fragment key={batchKey}>
      {quotesList.map((quote, idx) => renderQuotePill(quote, idx, isDuplicate))}
      {resonanceWindows.map((win, idx) => renderWindowPill(win, idx, isDuplicate))}
      {triplicateTrades.map((trade, idx) => renderTradePill(trade, idx, isDuplicate))}
    </React.Fragment>
  )

  // ==========================================================================
  // 1. RIBBON / MARQUEE TICKER TAPE VARIANT
  // ==========================================================================
  if (variant === 'ribbon') {
    return (
      <div
        className={`w-full relative overflow-hidden bg-[#050506]/95 border-y border-[#23262B] backdrop-blur-md z-20 py-2 ${className}`}
        role="region"
        aria-label="Live ESMS Token index on Solana Devnet"
      >
        {/* Ambient edge fade gradients */}
        <div className="absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-[#050506] to-transparent z-10 pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-[#050506] to-transparent z-10 pointer-events-none" />

        <div className="flex items-center">
          {/* Static Left Badge */}
          <div className="shrink-0 flex items-center gap-2 pl-4 pr-3 border-r border-[#23262B] z-20 bg-[#050506]">
            <span className="led-dot led-green animate-pulse" aria-hidden="true" />
            <span className="font-mono-label text-[9px] uppercase tracking-widest text-[#b8fc4b] font-bold">
              ESMS DEVNET INDEX
            </span>
          </div>

          {/* Marquee Track */}
          <div className="overflow-hidden flex-1 group">
            <div className="ticker-continuous items-center gap-8 whitespace-nowrap cursor-pointer">
              {/* Render duplicated sets for seamless continuous marquee loop */}
              {quotesList.length === 0 ? (
                <span className="px-4 font-mono-label text-[10px] text-[#8c947c]">
                  {loading ? 'SYNCING CANONICAL ESMS ORACLE…' : (error ?? 'PRICE ORACLE OFFLINE')}
                </span>
              ) : (
                <>
                  {renderTickerTapeBatch('batch-0', false)}
                  {renderTickerTapeBatch('batch-1', true)}
                  {renderTickerTapeBatch('batch-2', true)}
                  {renderTickerTapeBatch('batch-3', true)}
                </>
              )}
            </div>
          </div>

          {/* Right Controls */}
          <div className="shrink-0 flex items-center gap-2 pr-4 pl-3 border-l border-[#23262B] z-20 bg-[#050506]">
            <span
              className="font-mono-label text-[9px] px-2 py-0.5 rounded border border-[#424936] text-[#c2cab0]"
              title="Dimensionless ESMS index points — not a USD or SOL market quote"
            >
              IDX
            </span>
            <button
              onClick={() => refresh()}
              disabled={loading}
              className="text-[#8c947c] hover:text-[#b8fc4b] transition-colors"
              title="Refresh live ESMS Token index"
              aria-label="Refresh live ESMS Token index"
            >
              <RefreshCw
                className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================================================
  // 2. DETAILED MATRIX / GRID VARIANT
  // ==========================================================================
  return (
    <div className={`space-y-6 ${className}`}>
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-5 rounded-xl border-[#23262B]">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#b8fc4b]/10 rounded-lg border border-[#b8fc4b]/30">
            <Coins className="w-6 h-6 text-[#b8fc4b]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-headline-sm text-lg text-[#e0e4d2]">
                Canonical ESMS Price Index
              </h3>
              <span className="font-mono-label text-[9px] uppercase px-2 py-0.5 rounded border border-[#b8fc4b]/40 text-[#b8fc4b] bg-[#b8fc4b]/10">
                Solana Devnet · Token-2022
              </span>
            </div>
            <p className="font-body-md text-xs text-[#8c947c] mt-0.5">
              Live Solana Devnet index shared with alchm.kitchen. Index points are dimensionless;
              the separate mint and redeem rails are the only USD values.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 self-end sm:self-center">
          <span className="font-mono-label text-[9px] text-[#8c947c]">
            {error
              ? 'ORACLE OFFLINE'
              : lastRefreshed
                ? `SYNC ${lastRefreshed.toISOString().slice(11, 19)} UTC`
                : 'SYNCING…'}
          </span>

          <button
            onClick={() => refresh()}
            disabled={loading}
            title="Refresh live ESMS Token index"
            aria-label="Refresh live ESMS Token index"
            className="flex items-center gap-1.5 px-3 py-1.5 font-mono-label text-[10px] tracking-wider rounded border border-[#424936] text-[#c2cab0] hover:border-[#b8fc4b] hover:text-[#b8fc4b] transition-all"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            <span>SYNC</span>
          </button>
        </div>
      </div>

      {/* Astrolabe Triplicate Trades & Active Resonance Windows Panel */}
      {(triplicateTrades.length > 0 || resonanceWindows.length > 0) && (
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-[#0c0d08]/60 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" aria-hidden="true" />
              <h4 className="font-headline-sm text-sm font-bold text-amber-200 uppercase tracking-wider">
                Live Astrolabe Triplicate Trades & Resonance Windows
              </h4>
            </div>
            <span className="font-mono-label text-[9px] px-2 py-0.5 rounded border border-amber-500/40 text-amber-300 bg-amber-500/10">
              SSE STREAM ACTIVE
            </span>
          </div>

          <div className="flex flex-wrap gap-2.5">
            {resonanceWindows.map((win, idx) => renderWindowPill(win, idx, false))}
            {triplicateTrades.map((trade, idx) => renderTradePill(trade, idx, false))}
          </div>
        </div>
      )}

      {/* Four ESMS quantity cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {quotesList.length === 0 && (
          <div className="sm:col-span-2 lg:col-span-4 glass-panel rounded-xl p-6 border border-[#424936] font-mono-label text-xs text-[#8c947c]">
            {loading
              ? 'Synchronizing the canonical ESMS oracle…'
              : (error ?? 'Price oracle offline')}
          </div>
        )}
        {quotesList.map(quote => {
          const vis = TOKEN_VISUALS[quote.axis]
          const Icon = vis.icon
          const change = formatChange(quote.change24hPct)
          const isCopied = copiedMint === quote.axis
          const shortMint = `${quote.mintAddress.slice(0, 4)}...${quote.mintAddress.slice(-4)}`

          return (
            <div
              key={quote.axis}
              className={`glass-panel rounded-xl p-5 border transition-all duration-300 relative overflow-hidden flex flex-col justify-between ${vis.border} ${vis.glow} ${vis.bg}`}
              role="group"
              title={`${quote.name} (${quote.symbol}) ESMS Token index on Solana Devnet`}
              aria-label={`${quote.name} (${quote.symbol}) ESMS Token index: ${formatIndex(quote)} IDX on Solana Devnet`}
            >
              {/* Subtle top indicator bar */}
              <div
                className="absolute top-0 left-0 right-0 h-1"
                style={{ backgroundColor: vis.stroke }}
              />

              <div>
                {/* Card Header */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`p-2 rounded-lg border ${vis.badgeBg}`}>
                      <Icon className={`w-5 h-5 ${vis.text}`} aria-hidden="true" />
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-headline-sm text-base font-bold text-[#e0e4d2]">
                          {quote.name}
                        </h4>
                        <span className="font-mono-label text-[9px] text-[#8c947c]">
                          ({quote.symbol})
                        </span>
                      </div>
                      <span className="font-mono-label text-[9px] text-[#8c947c]">
                        {quote.contributingPlanets}
                      </span>
                    </div>
                  </div>

                  <span
                    className={`font-mono-label text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-0.5 ${
                      change.isPositive
                        ? 'text-[#b8fc4b] bg-[#b8fc4b]/10 border border-[#b8fc4b]/30'
                        : 'text-[#ff7b72] bg-[#ff7b72]/10 border border-[#ff7b72]/30'
                    }`}
                  >
                    {change.isPositive ? (
                      <TrendingUp className="w-3 h-3 inline" aria-hidden="true" />
                    ) : (
                      <TrendingDown className="w-3 h-3 inline" aria-hidden="true" />
                    )}
                    {change.text}
                  </span>
                </div>

                {/* Price Display */}
                <div className="my-4">
                  <div className="font-mono-label text-[10px] text-[#8c947c] uppercase tracking-wider mb-0.5">
                    Neutral Cost Index
                  </div>
                  <div className="font-headline-lg text-2xl md:text-3xl font-bold text-[#e0e4d2] tracking-tight">
                    {formatIndex(quote)} <span className="text-sm text-[#8c947c]">IDX</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono-label text-[10px] text-[#8c947c]">
                      Velocity (1h):
                    </span>
                    <span
                      className={`font-mono-label text-[10px] font-semibold ${
                        quote.change1hPct >= 0 ? 'text-[#b8fc4b]' : 'text-[#ff7b72]'
                      }`}
                    >
                      {quote.change1hPct >= 0 ? '+' : ''}
                      {quote.change1hPct.toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Harmonic Sparkline Curve */}
                <div className="my-3 py-2 border-y border-[#23262B] flex items-center justify-between">
                  <div className="space-y-1">
                    <span className="font-mono-label text-[9px] text-[#8c947c] block uppercase">
                      Quantized Sky Share
                    </span>
                    <span className="font-mono-label text-[11px] font-bold text-[#e0e4d2]">
                      {(quote.weight * 100).toFixed(2)}%
                    </span>
                  </div>
                  <SparklineSvg
                    data={quote.sparkline}
                    stroke={vis.stroke}
                    fill={vis.fill}
                    width={110}
                    height={32}
                  />
                </div>

                {/* Oracle basis */}
                <div className="mb-4 bg-[#050506]/50 rounded p-2.5 border border-[#23262B]">
                  <div className="flex items-center gap-1.5 text-[10px] font-mono-label text-[#c2cab0]">
                    <Sparkles className={`w-3 h-3 ${vis.text}`} aria-hidden="true" />
                    <span className="truncate">{data?.basis.model ?? 'Canonical ESMS oracle'}</span>
                  </div>
                  <div className="font-body-md text-[10px] text-[#8c947c] mt-1 leading-snug">
                    {quote.description}
                  </div>
                </div>
              </div>

              {/* Solana Mint Address & Actions Footer */}
              <div className="pt-3 border-t border-[#23262B] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono-label text-[9px] text-[#8c947c] uppercase">
                    Solana Devnet Mint (Token-2022)
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => copyToClipboard(quote.mintAddress, quote.axis)}
                      className="flex items-center gap-1 font-mono-label text-[9px] px-2 py-0.5 rounded bg-[#1d2116] border border-[#424936] text-[#c2cab0] hover:text-[#b8fc4b] hover:border-[#b8fc4b] transition-colors"
                      title={`Copy ${quote.name} Solana Devnet mint address`}
                      aria-label={`Copy ${quote.name} Solana Devnet mint address`}
                    >
                      {isCopied ? (
                        <>
                          <Check className="w-2.5 h-2.5 text-[#b8fc4b]" />
                          <span className="text-[#b8fc4b]">COPIED</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-2.5 h-2.5" />
                          <span>{shortMint}</span>
                        </>
                      )}
                    </button>
                    <a
                      href={`https://explorer.solana.com/address/${quote.mintAddress}?cluster=devnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#8c947c] hover:text-[#7bd1fa] transition-colors p-0.5"
                      title={`View ${quote.name} on Solana Devnet Explorer`}
                      aria-label={`View ${quote.name} on Solana Devnet Explorer`}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default LivePriceIndexTicker
