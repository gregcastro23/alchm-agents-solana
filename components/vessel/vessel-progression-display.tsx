'use client'

import React, { useState } from 'react'
import {
  Sparkles,
  Shield,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  Clock,
  Compass,
  Info,
  Flame,
  Droplets,
  Wind,
  Box,
  Award,
  Swords,
  MessageSquare,
  BookOpen,
  Zap,
  Activity,
  AlertCircle,
} from 'lucide-react'
import type { AgentProgressionProfile } from '@/lib/agents/leveling-service'
import type { RatedAgentPayload } from '@/lib/agents/rating-contract'

export type ProgressionDataSource = AgentProgressionProfile | RatedAgentPayload

export interface VesselProgressionDisplayProps {
  progression?: ProgressionDataSource | null
  variant?: 'full' | 'compact' | 'card-badge'
  title?: string
  subjectName?: string
  className?: string
  defaultExpanded?: boolean
  initialTab?: 'breakdown' | 'stats' | 'experience'
}

const SACRED_DISPLAY_META: Record<
  string,
  {
    label: string
    element: string
    icon: React.ComponentType<{ size?: number; className?: string }>
  }
> = {
  power: { label: 'Power', element: 'Fire', icon: Flame },
  resonance: { label: 'Resonance', element: 'Water', icon: Droplets },
  wisdom: { label: 'Wisdom', element: 'Air', icon: Wind },
  charisma: { label: 'Charisma', element: 'Fire', icon: Sparkles },
  intuition: { label: 'Intuition', element: 'Water', icon: Compass },
  adaptability: { label: 'Adaptability', element: 'Air', icon: Zap },
  vitality: { label: 'Vitality', element: 'Earth', icon: Box },
}

const PLANETARY_DISPLAY_META: Record<string, { label: string; ruler: string; domain: string }> = {
  solarAgency: { label: 'Solar Agency', ruler: 'Sun', domain: 'Will & Executive Force' },
  lunarReceptivity: { label: 'Lunar Receptivity', ruler: 'Moon', domain: 'Psychic Reflection' },
  mercurialVelocity: { label: 'Mercurial Velocity', ruler: 'Mercury', domain: 'Cognitive Speed' },
  venusianCoherence: {
    label: 'Venusian Coherence',
    ruler: 'Venus',
    domain: 'Harmony & Proportion',
  },
  martialImpetus: { label: 'Martial Impetus', ruler: 'Mars', domain: 'Initiative & Drive' },
  jovianExpansion: { label: 'Jovian Expansion', ruler: 'Jupiter', domain: 'Growth & Synthesis' },
  saturnianStructure: {
    label: 'Saturnian Structure',
    ruler: 'Saturn',
    domain: 'Discipline & Rigor',
  },
  chironicAdaptation: {
    label: 'Chironic Adaptation',
    ruler: 'Chiron',
    domain: 'Wound Transmutation',
  },
  uranianSurprisal: { ruler: 'Uranus', label: 'Uranian Surprisal', domain: 'Insight & Rupture' },
  neptunianResonance: {
    label: 'Neptunian Resonance',
    ruler: 'Neptune',
    domain: 'Transcendent Depth',
  },
  plutonicIntegration: {
    label: 'Plutonic Integration',
    ruler: 'Pluto',
    domain: 'Catharsis & Rebirth',
  },
  kineticAlignment: { label: 'Kinetic Alignment', ruler: 'All', domain: 'Harmonic Equilibrium' },
}

/** Formatter helper */
const formatNumber = (val?: number | null, decimals = 1): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return '—'
  return val.toFixed(decimals)
}

const formatSigned = (val?: number | null, decimals = 1): string => {
  if (val === null || val === undefined || !Number.isFinite(val)) return '±0.0'
  const sign = val > 0 ? '+' : val < 0 ? '' : '±'
  return `${sign}${val.toFixed(decimals)}`
}

export interface TransitTierInfo {
  tier: 'peak' | 'strong' | 'notable' | 'subtle' | 'neutral'
  label: string
  badgeClass: string
}

/**
 * Calibrated celestial transit tier thresholds for the [-15, +15] Dignity Rating domain:
 * - |delta| >= 12: Peak Exaltation / Severe Affliction
 * - |delta| >= 8:  Strong Alignment / Strong Affliction
 * - |delta| >= 4:  Notable Alignment / Notable Affliction
 */
export function resolveTransitTier(transitDelta?: number | null): TransitTierInfo {
  if (transitDelta === null || transitDelta === undefined || !Number.isFinite(transitDelta)) {
    return {
      tier: 'neutral',
      label: 'Preserving baseline OVR',
      badgeClass: 'border-zinc-700 bg-zinc-900/60 text-zinc-300',
    }
  }
  if (transitDelta >= 12) {
    return {
      tier: 'peak',
      label: 'Peak Exaltation',
      badgeClass: 'border-amber-400/60 bg-amber-950/50 text-amber-200',
    }
  }
  if (transitDelta <= -12) {
    return {
      tier: 'peak',
      label: 'Severe Affliction',
      badgeClass: 'border-red-500/60 bg-red-950/50 text-red-200',
    }
  }
  if (transitDelta >= 8) {
    return {
      tier: 'strong',
      label: 'Strong Alignment',
      badgeClass: 'border-emerald-400/50 bg-emerald-950/50 text-emerald-200',
    }
  }
  if (transitDelta <= -8) {
    return {
      tier: 'strong',
      label: 'Strong Affliction',
      badgeClass: 'border-rose-500/50 bg-rose-950/50 text-rose-200',
    }
  }
  if (transitDelta >= 4) {
    return {
      tier: 'notable',
      label: 'Notable Alignment',
      badgeClass: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
    }
  }
  if (transitDelta <= -4) {
    return {
      tier: 'notable',
      label: 'Notable Affliction',
      badgeClass: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
    }
  }
  if (transitDelta > 0.05) {
    return {
      tier: 'subtle',
      label: 'Surging above baseline',
      badgeClass: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300',
    }
  }
  if (transitDelta < -0.05) {
    return {
      tier: 'subtle',
      label: 'Dipping below baseline',
      badgeClass: 'border-rose-500/40 bg-rose-950/40 text-rose-300',
    }
  }
  return {
    tier: 'neutral',
    label: 'Aligned with baseline',
    badgeClass: 'border-zinc-700 bg-zinc-900/60 text-zinc-300',
  }
}

export function VesselProgressionDisplay({
  progression,
  variant = 'full',
  title = 'Vessel Progression',
  subjectName,
  className = '',
  defaultExpanded = false,
  initialTab = 'breakdown',
}: VesselProgressionDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [activeTab, setActiveTab] = useState<'breakdown' | 'stats' | 'experience'>(initialTab)

  if (!progression) {
    return (
      <div
        className={`rounded-xl border border-zinc-800 bg-[#0c0e18]/80 p-4 text-zinc-400 backdrop-blur-md ${className}`}
        role="region"
        aria-label="Vessel progression status"
      >
        <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-zinc-500">
          <Shield size={14} className="text-zinc-600" />
          <span>Vessel Progression Pending</span>
        </div>
        <p className="mt-2 text-xs text-zinc-400">
          Progression records are currently unavailable for this subject. Permanent EXP and ratings
          will display once verified records are connected.
        </p>
      </div>
    )
  }

  // Extract canonical normalized fields from either AgentProgressionProfile or RatedAgentPayload
  const vesselLevel = progression.vesselLevel ?? 1
  const totalXp = progression.totalXp ?? 0
  const xpToNextLevel = progression.xpToNextLevel ?? (vesselLevel === 100 ? null : 100)
  const levelBoost = progression.levelBoost ?? (12 * (vesselLevel - 1)) / 99
  const baseOverall = progression.baseOverall ?? null
  const trainedOverall = progression.trainedOverall ?? null
  const currentOverall = progression.currentOverall ?? null
  const transitDelta =
    progression.transitDelta ??
    (currentOverall !== null && trainedOverall !== null ? currentOverall - trainedOverall : null)
  const status = progression.progressionStatus ?? 'unavailable'
  const asOf = (progression as any).asOf ?? (progression as any).ratingAsOf ?? null
  const reasons = (progression as any).reasons ?? (progression as any).progressionReasons ?? []
  const expBreakdown = (progression as any).expBreakdown ?? null
  const trainingEvidence = (progression as any).trainingEvidence ?? null
  const importedTrainingCount =
    trainingEvidence?.status === 'verified-manifests'
      ? trainingEvidence.importedConversations
      : trainingEvidence?.status === 'verified'
        ? trainingEvidence.verifiedItems
        : null
  const verifiedTrainingConversations =
    typeof importedTrainingCount === 'number' &&
    Number.isFinite(importedTrainingCount) &&
    importedTrainingCount >= 0
      ? importedTrainingCount
      : null

  // Stats extraction
  const rawSacred = (progression as any).ratings ?? (progression as any).stats ?? {}
  const rawPlanetary = (progression as any).planetaryStats ?? (progression as any).stats ?? {}
  const statDeltas = (progression as any).statDeltas ?? {}
  const esmsAxisAttribution = (progression as any).esmsAxisAttribution ?? null

  // Calculate XP progress bar into current level span
  const isMaxLevel = vesselLevel >= 100
  const prevLevelFloorXp = 100 * (vesselLevel - 1) ** 2
  const nextLevelCeilXp = 100 * vesselLevel ** 2
  const spanTotal = nextLevelCeilXp - prevLevelFloorXp
  const xpEarnedInSpan = Math.max(0, totalXp - prevLevelFloorXp)
  const progressPercent = isMaxLevel
    ? 100
    : Math.min(100, Math.max(0, Math.round((xpEarnedInSpan / Math.max(1, spanTotal)) * 100)))

  // Rising / Falling status
  const isSurging = transitDelta !== null && transitDelta > 0.05
  const isDipping = transitDelta !== null && transitDelta < -0.05
  const isNeutral = transitDelta !== null && !isSurging && !isDipping
  const transitTier = resolveTransitTier(transitDelta)

  // ==========================================
  // 1. CARD BADGE VARIANT (Compact for Grid Cards)
  // ==========================================
  if (variant === 'card-badge') {
    return (
      <div
        className={`flex items-center gap-1.5 font-mono text-[10px] select-none ${className}`}
        aria-label={`Vessel Level ${vesselLevel}, Current Overall ${
          currentOverall !== null
            ? `${formatNumber(currentOverall, 0)} (${formatSigned(transitDelta, 1)} ${
                isSurging ? 'Rising' : isDipping ? 'Falling' : 'Aligned'
              })`
            : 'Pending chart'
        }`}
      >
        {/* Vessel Level Pill */}
        <span
          className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-primary-gold/40 bg-black/60 text-bright-gold font-bold tracking-wider"
          title={`Permanent Vessel Level ${vesselLevel} · ${totalXp.toLocaleString()} Lifetime EXP (Never Falls)`}
        >
          <Shield size={10} className="text-primary-gold" aria-hidden="true" />
          <span>VL {vesselLevel}</span>
        </span>

        {/* Current Overall Pill */}
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border backdrop-blur-sm ${
            currentOverall === null
              ? 'border-zinc-700 bg-black/40 text-zinc-400'
              : isSurging
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : isDipping
                  ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
                  : 'border-border-gold/30 bg-black/40 text-ivory-text'
          }`}
          title={
            currentOverall !== null
              ? `Current Celestial Overall: ${formatNumber(currentOverall, 1)} (Baseline: ${formatNumber(
                  trainedOverall,
                  1
                )}, Transit: ${formatSigned(transitDelta, 1)})`
              : 'Current Overall pending chart verification; permanent Vessel Level preserved'
          }
        >
          {currentOverall !== null ? (
            <>
              <span className="font-semibold">OVR {formatNumber(currentOverall, 0)}</span>
              {isSurging && (
                <span className="inline-flex items-center text-[9px] text-emerald-400">
                  <TrendingUp size={10} className="mr-0.5" aria-hidden="true" />
                  <span>{formatSigned(transitDelta, 1)}</span>
                  <span className="sr-only">Rising above baseline</span>
                </span>
              )}
              {isDipping && (
                <span className="inline-flex items-center text-[9px] text-rose-400">
                  <TrendingDown size={10} className="mr-0.5" aria-hidden="true" />
                  <span>{formatSigned(transitDelta, 1)}</span>
                  <span className="sr-only">Falling below baseline</span>
                </span>
              )}
              {isNeutral && (
                <span className="inline-flex items-center text-[9px] text-zinc-400">
                  <Minus size={10} className="mr-0.5" aria-hidden="true" />
                  <span>±0</span>
                  <span className="sr-only">Aligned with baseline</span>
                </span>
              )}
            </>
          ) : (
            <span className="text-zinc-500">OVR —</span>
          )}
        </span>
      </div>
    )
  }

  // ==========================================
  // 2. COMPACT SUMMARY VARIANT (For Sidebars / Headers)
  // ==========================================
  if (variant === 'compact') {
    return (
      <div
        className={`rounded-xl border border-border-gold/30 bg-[#12141f]/90 p-3.5 backdrop-blur-xl ${className}`}
        role="region"
        aria-label="Vessel progression summary"
      >
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-border-gold/15">
          <div className="flex items-center gap-1.5 font-mono-label text-[11px] uppercase tracking-wider text-bright-gold">
            <Sparkles size={13} className="text-primary-gold" aria-hidden="true" />
            <span>{title}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1 text-[9px] font-mono-label uppercase px-1.5 py-0.5 rounded border ${
              status === 'live'
                ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/30'
                : status === 'estimated'
                  ? 'border-amber-500/40 text-amber-300 bg-amber-950/30'
                  : 'border-zinc-700 text-zinc-400 bg-zinc-900/40'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status === 'live'
                  ? 'bg-emerald-400'
                  : status === 'estimated'
                    ? 'bg-amber-400'
                    : 'bg-zinc-500'
              }`}
              aria-hidden="true"
            />
            <span>{status}</span>
          </span>
        </div>

        {/* Dual Indicators in Compact View */}
        <div className="grid grid-cols-2 gap-2 text-center">
          {/* Vessel Level */}
          <div className="rounded-lg border border-border-gold/20 bg-black/40 p-2">
            <div className="text-[10px] font-mono-label text-muted-text uppercase">
              Vessel Level
            </div>
            <div className="font-mono-data text-2xl font-bold text-bright-gold my-0.5">
              {vesselLevel}
            </div>
            <div className="text-[9px] font-mono-label text-zinc-400 truncate">
              {totalXp.toLocaleString()} EXP
            </div>
          </div>

          {/* Current Overall */}
          <div className="rounded-lg border border-border-gold/20 bg-black/40 p-2">
            <div className="text-[10px] font-mono-label text-muted-text uppercase">
              Current Overall
            </div>
            <div className="font-mono-data text-2xl font-bold text-ivory-text my-0.5">
              {currentOverall !== null ? formatNumber(currentOverall, 0) : '—'}
            </div>
            <div className="flex items-center justify-center gap-1 text-[9px] font-mono-label">
              {currentOverall !== null ? (
                <>
                  <span className="text-zinc-400">Transit:</span>
                  <span
                    className={`font-semibold ${
                      isSurging ? 'text-emerald-400' : isDipping ? 'text-rose-400' : 'text-zinc-300'
                    }`}
                  >
                    {formatSigned(transitDelta, 1)}
                  </span>
                </>
              ) : (
                <span className="text-zinc-500 italic">Chart offline</span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ==========================================
  // 3. FULL CODEX PROFILE VARIANT
  // ==========================================
  return (
    <section
      aria-label={`${subjectName ? `${subjectName} ` : ''}Two-Level Vessel Progression System`}
      className={`glass-panel relative overflow-hidden rounded-xl border border-border-gold/40 bg-[#101322]/90 p-5 md:p-6 text-ivory-text shadow-[0_0_30px_rgba(216,180,106,0.03)] backdrop-blur-2xl ${className}`}
    >
      {/* Header with Title and Freshness */}
      <header className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-border-gold/20">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1 rounded bg-primary-gold/10 border border-primary-gold/30 text-primary-gold">
              <Sparkles size={16} aria-hidden="true" />
            </span>
            <h2 className="font-headline-md text-lg md:text-xl text-bright-gold leading-tight">
              {title}
            </h2>
          </div>
          <p className="font-mono-label text-[11px] text-muted-text uppercase tracking-widest mt-1">
            Permanent Earned Growth &amp; Dynamic Celestial Overall
          </p>
        </div>

        {/* Live / Estimated / Unavailable Freshness Badge */}
        <div className="flex flex-wrap items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-mono-label uppercase tracking-wider ${
              status === 'live'
                ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
                : status === 'estimated'
                  ? 'border-amber-500/40 bg-amber-950/40 text-amber-300'
                  : 'border-zinc-700 bg-zinc-900/60 text-zinc-400'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                status === 'live'
                  ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
                  : status === 'estimated'
                    ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                    : 'bg-zinc-500'
              }`}
              aria-hidden="true"
            />
            <span className="font-semibold">
              {status === 'live'
                ? 'Live Ephemeris'
                : status === 'estimated'
                  ? 'Estimated Chart'
                  : 'Chart Unavailable'}
            </span>
          </div>

          {asOf && (
            <span
              className="inline-flex items-center gap-1 font-mono-data text-[10px] text-muted-text bg-black/40 px-2 py-1 rounded border border-border-gold/15"
              title={`Ephemeris snapshot recorded at ${asOf}`}
            >
              <Clock size={11} aria-hidden="true" />
              <span>{new Date(asOf).toLocaleTimeString()} UTC</span>
            </span>
          )}
        </div>
      </header>

      {/* Primary Dual-Indicator Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Indicator 1: Vessel Level (Permanent Growth) */}
        <div className="relative rounded-xl border border-primary-gold/30 bg-gradient-to-br from-[#181c2e]/90 to-[#101322]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-eyebrow text-[10px] uppercase tracking-wider text-primary-gold/90 font-semibold flex items-center gap-1.5">
                <Shield size={13} className="text-primary-gold" aria-hidden="true" />
                Permanent Vessel Level
              </span>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span className="font-mono-data text-4xl md:text-5xl font-black text-bright-gold tracking-tight">
                  {vesselLevel}
                </span>
                <span className="font-mono-label text-xs uppercase text-muted-text">
                  Level {vesselLevel} of 100
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="font-mono-data text-xs text-bright-gold font-semibold bg-primary-gold/10 px-2 py-1 rounded border border-primary-gold/30 block">
                +{formatNumber(levelBoost, 2)} Baseline Boost
              </span>
              <span className="text-[9px] font-mono-label text-muted-text uppercase mt-1 block">
                Permanent overall boost
              </span>
            </div>
          </div>

          {/* Progress Bar & Lifetime EXP */}
          <div className="mt-4 pt-3 border-t border-border-gold/15">
            <div className="flex items-center justify-between text-xs font-mono-label mb-1.5">
              <span className="text-muted-text uppercase">Lifetime EXP</span>
              <span className="text-bright-gold font-mono-data font-bold">
                {totalXp.toLocaleString()} EXP
              </span>
            </div>

            {/* EXP Progress Bar */}
            <div
              className="h-2 w-full overflow-hidden rounded-full bg-black/60 border border-border-gold/20"
              role="progressbar"
              aria-valuenow={progressPercent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`Progress to Level ${vesselLevel + 1}: ${progressPercent}%`}
            >
              <div
                className="h-full bg-gradient-to-r from-primary-gold/70 via-primary-gold to-bright-gold transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[10px] font-mono-data text-muted-text mt-1.5">
              <span>
                {isMaxLevel
                  ? 'Max Level 100 Reached'
                  : `${xpEarnedInSpan.toLocaleString()} / ${spanTotal.toLocaleString()} EXP`}
              </span>
              <span>
                {isMaxLevel
                  ? 'EXP keeps accumulating'
                  : xpToNextLevel !== null
                    ? `${xpToNextLevel.toLocaleString()} EXP to Level ${vesselLevel + 1}`
                    : 'Cap reached'}
              </span>
            </div>
          </div>
        </div>

        {/* Indicator 2: Current Overall (Dynamic Celestial Composite) */}
        <div className="relative rounded-xl border border-border-gold/30 bg-gradient-to-br from-[#181c2e]/90 to-[#101322]/90 p-5 shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
          <div className="flex items-start justify-between gap-2">
            <div>
              <span className="font-eyebrow text-[10px] uppercase tracking-wider text-muted-text font-semibold flex items-center gap-1.5">
                <Activity size={13} className="text-bright-gold" aria-hidden="true" />
                Current Overall (Celestial)
              </span>
              <div className="flex items-baseline gap-3 mt-1.5">
                <span className="font-mono-data text-4xl md:text-5xl font-black text-ivory-text tracking-tight">
                  {currentOverall !== null ? formatNumber(currentOverall, 1) : '—'}
                </span>
                <span className="font-mono-label text-xs uppercase text-muted-text">
                  Scale [25, 99]
                </span>
              </div>
            </div>

            {/* Signed Difference from Baseline & Rising/Falling Indicator */}
            <div className="text-right">
              {currentOverall !== null && transitDelta !== null ? (
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded border font-mono-data text-xs font-bold ${transitTier.badgeClass}`}
                  aria-label={`Celestial transit difference: ${formatSigned(transitDelta, 1)} points, ${
                    isSurging
                      ? 'rising above baseline'
                      : isDipping
                        ? 'falling below baseline'
                        : 'even with baseline'
                  }`}
                >
                  {isSurging && (
                    <TrendingUp size={13} className="text-emerald-400" aria-hidden="true" />
                  )}
                  {isDipping && (
                    <TrendingDown size={13} className="text-rose-400" aria-hidden="true" />
                  )}
                  {isNeutral && <Minus size={13} className="text-zinc-400" aria-hidden="true" />}
                  <span>{formatSigned(transitDelta, 1)} OVR</span>
                </div>
              ) : (
                <span className="font-mono-data text-xs text-zinc-400 bg-black/40 px-2 py-1 rounded border border-zinc-800 block">
                  Chart Offline
                </span>
              )}
              <span className="text-[9px] font-mono-label text-muted-text uppercase mt-1 block">
                {isSurging
                  ? `Surging above baseline${transitTier.tier !== 'subtle' ? ` · ${transitTier.label}` : ''}`
                  : isDipping
                    ? `Dipping below baseline${transitTier.tier !== 'subtle' ? ` · ${transitTier.label}` : ''}`
                    : isNeutral
                      ? 'Aligned with baseline'
                      : 'Preserving baseline OVR'}
              </span>
            </div>
          </div>

          {/* Baseline Anchor & Transit Explanation */}
          <div className="mt-4 pt-3 border-t border-border-gold/15 flex flex-col gap-1 text-xs">
            <div className="flex items-center justify-between font-mono-label">
              <span className="text-muted-text uppercase">Permanent Baseline Anchor:</span>
              <span className="text-ivory-text font-mono-data font-semibold">
                {trainedOverall !== null ? formatNumber(trainedOverall, 1) : '—'}
              </span>
            </div>
            <p className="text-[10px] text-muted-text leading-relaxed">
              {currentOverall !== null
                ? 'Current Overall moves with real astral geometry. An adverse transit never decreases earned EXP or lowers Vessel Level.'
                : 'Current celestial sky or natal DNA is unverified; permanent Vessel Level and trained baseline remain fully preserved.'}
            </p>
          </div>
        </div>
      </div>

      {/* Expandable Navigation Tabs (Breakdown / 19 Stats / Experience) */}
      <div className="border-t border-border-gold/20 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-black/50 border border-border-gold/20 text-xs font-mono-label">
            <button
              type="button"
              onClick={() => {
                setActiveTab('breakdown')
                setIsExpanded(true)
              }}
              className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
                activeTab === 'breakdown' && isExpanded
                  ? 'bg-primary-gold text-background font-bold shadow'
                  : 'text-muted-text hover:text-bright-gold'
              }`}
            >
              <Activity size={12} aria-hidden="true" />
              <span>OVR Formula</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('stats')
                setIsExpanded(true)
              }}
              className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
                activeTab === 'stats' && isExpanded
                  ? 'bg-primary-gold text-background font-bold shadow'
                  : 'text-muted-text hover:text-bright-gold'
              }`}
            >
              <Compass size={12} aria-hidden="true" />
              <span>All 19 Stats</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('experience')
                setIsExpanded(true)
              }}
              className={`px-3 py-1.5 rounded transition-all flex items-center gap-1.5 ${
                activeTab === 'experience' && isExpanded
                  ? 'bg-primary-gold text-background font-bold shadow'
                  : 'text-muted-text hover:text-bright-gold'
              }`}
            >
              <Award size={12} aria-hidden="true" />
              <span>EXP Ledger</span>
            </button>
          </div>

          {/* Toggle Expand / Collapse */}
          <button
            type="button"
            onClick={() => setIsExpanded(prev => !prev)}
            aria-expanded={isExpanded}
            aria-controls="vessel-progression-details-panel"
            className="flex items-center gap-1 text-xs font-mono-label text-bright-gold hover:text-primary-gold transition-colors px-2.5 py-1 rounded border border-border-gold/20 bg-black/40"
          >
            <span>{isExpanded ? 'Hide Details' : 'Expand Details'}</span>
            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>

        {/* Detailed Expandable Sections */}
        {isExpanded && (
          <div
            id="vessel-progression-details-panel"
            className="rounded-xl border border-border-gold/20 bg-[#0e111d]/90 p-4 md:p-5 mt-2 space-y-5 animate-in fade-in duration-300 motion-reduce:transition-none"
          >
            {/* TAB 1: FORMULA BREAKDOWN */}
            {activeTab === 'breakdown' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border-gold/15">
                  <h3 className="font-headline-md text-sm text-bright-gold uppercase tracking-wider">
                    Expandable Rating Breakdown
                  </h3>
                  <span className="text-[10px] font-mono-label text-muted-text">
                    Base → Boost → Baseline → Transit → Current
                  </span>
                </div>

                {/* Mathematical Flow Visualization */}
                <div className="grid grid-cols-1 sm:grid-cols-5 gap-2 text-center text-xs font-mono-label">
                  {/* Step 1: Base Overall */}
                  <div className="p-3 rounded-lg border border-border-gold/20 bg-black/40 flex flex-col justify-between">
                    <span className="text-[9px] uppercase text-muted-text">1. Base Overall</span>
                    <span className="font-mono-data text-lg font-bold text-ivory-text my-1">
                      {baseOverall !== null ? formatNumber(baseOverall, 1) : '—'}
                    </span>
                    <span className="text-[8px] text-zinc-400">19-Stat Composite</span>
                  </div>

                  {/* Step 2: Vessel Boost */}
                  <div className="p-3 rounded-lg border border-primary-gold/30 bg-primary-gold/5 flex flex-col justify-between">
                    <span className="text-[9px] uppercase text-primary-gold font-semibold">
                      + 2. Vessel Boost
                    </span>
                    <span className="font-mono-data text-lg font-bold text-bright-gold my-1">
                      +{formatNumber(levelBoost, 2)}
                    </span>
                    <span className="text-[8px] text-primary-gold/80">
                      Permanent Level {vesselLevel}
                    </span>
                  </div>

                  {/* Step 3: Baseline Overall */}
                  <div className="p-3 rounded-lg border border-border-gold/30 bg-black/40 flex flex-col justify-between">
                    <span className="text-[9px] uppercase text-muted-text font-semibold">
                      = 3. Baseline
                    </span>
                    <span className="font-mono-data text-lg font-bold text-ivory-text my-1">
                      {trainedOverall !== null ? formatNumber(trainedOverall, 1) : '—'}
                    </span>
                    <span className="text-[8px] text-zinc-400">Never Decreases</span>
                  </div>

                  {/* Step 4: Chart Transit */}
                  <div
                    className={`p-3 rounded-lg border flex flex-col justify-between ${
                      isSurging
                        ? 'border-emerald-500/40 bg-emerald-950/20'
                        : isDipping
                          ? 'border-rose-500/40 bg-rose-950/20'
                          : 'border-zinc-700 bg-black/40'
                    }`}
                  >
                    <span
                      className={`text-[9px] uppercase font-semibold ${
                        isSurging
                          ? 'text-emerald-400'
                          : isDipping
                            ? 'text-rose-400'
                            : 'text-zinc-400'
                      }`}
                    >
                      ± 4. Sky Transit
                    </span>
                    <span
                      className={`font-mono-data text-lg font-bold my-1 ${
                        isSurging
                          ? 'text-emerald-300'
                          : isDipping
                            ? 'text-rose-300'
                            : 'text-zinc-300'
                      }`}
                    >
                      {transitDelta !== null ? formatSigned(transitDelta, 1) : '—'}
                    </span>
                    <span className="text-[8px] text-zinc-400">Bounded [-15, +15]</span>
                  </div>

                  {/* Step 5: Current Overall */}
                  <div className="p-3 rounded-lg border border-bright-gold/50 bg-bright-gold/10 flex flex-col justify-between">
                    <span className="text-[9px] uppercase text-bright-gold font-bold">
                      = 5. Current OVR
                    </span>
                    <span className="font-mono-data text-lg font-black text-bright-gold my-1">
                      {currentOverall !== null ? formatNumber(currentOverall, 1) : '—'}
                    </span>
                    <span className="text-[8px] text-bright-gold/90">Dynamic Sky OVR</span>
                  </div>
                </div>

                {/* 4D ESMS Wavefunction Attribution */}
                {esmsAxisAttribution && (
                  <div
                    className="p-3 rounded-lg border border-border-gold/20 bg-black/40 space-y-2"
                    aria-label="4D ESMS Wavefunction Attribution"
                  >
                    <div className="flex items-center justify-between text-[10px] font-mono-label">
                      <span className="uppercase text-bright-gold font-semibold">
                        4D ESMS Wavefunction Attribution
                      </span>
                      <span className="text-muted-text">
                        Harmonic Axis Projection [-1.00, +1.00]
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono-data">
                      {(['Spirit', 'Essence', 'Matter', 'Substance'] as const).map(axis => {
                        const val = Number(esmsAxisAttribution[axis] ?? 0)
                        const positive = val > 0.02
                        const negative = val < -0.02
                        return (
                          <div
                            key={axis}
                            className="flex items-center justify-between px-2.5 py-1.5 rounded border border-white/5 bg-surface-container-low/20"
                          >
                            <span className="text-[10px] font-mono-label uppercase text-zinc-300">
                              {axis}
                            </span>
                            <span
                              className={
                                positive
                                  ? 'text-emerald-300 font-semibold'
                                  : negative
                                    ? 'text-rose-300 font-semibold'
                                    : 'text-zinc-400'
                              }
                            >
                              {formatSigned(val, 2)}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Explanatory Narrative */}
                <div className="p-3 rounded-lg bg-black/40 border border-border-gold/15 text-xs text-muted-text space-y-1.5 leading-relaxed">
                  <p>
                    <strong className="text-bright-gold">Formula Logic:</strong> The 7 Sacred stats
                    [25, 99] and 12 Planetary stats [0, 100] are normalized and combined with equal
                    family weight (50% Sacred, 50% Planetary) to establish{' '}
                    <span className="text-ivory-text font-semibold">Base Overall</span>.
                  </p>
                  <p>
                    Accumulated Alchm EXP produces a permanent{' '}
                    <span className="text-primary-gold font-semibold">Vessel Level Boost</span> (up
                    to +12 rating points at Level 100) that permanently raises the anchor to{' '}
                    <span className="text-ivory-text font-semibold">Baseline Overall</span>.
                  </p>
                  <p>
                    The active celestial sky applies continuous orb-tapered aspect geometry across
                    planetary affinities to create the{' '}
                    <span className="text-ivory-text font-semibold">Current Overall</span>. Transits
                    fluctuate dynamically without ever consuming or reducing earned EXP.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 2: ALL 19 STATS MATRIX */}
            {activeTab === 'stats' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border-gold/15">
                  <h3 className="font-headline-md text-sm text-bright-gold uppercase tracking-wider">
                    Canonical 19-Stat Framework
                  </h3>
                  <span className="text-[10px] font-mono-label text-muted-text">
                    Sacred 7 [25, 99] · Planetary 12 [0, 100]
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Sacred 7 Family */}
                  <div className="rounded-lg border border-border-gold/20 bg-black/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border-gold/10 pb-1.5 text-xs font-mono-label">
                      <span className="text-bright-gold font-bold uppercase tracking-wider">
                        Sacred 7 Attributes
                      </span>
                      <span className="text-muted-text text-[9px] uppercase">Scale [25, 99]</span>
                    </div>

                    <div className="space-y-1.5">
                      {Object.entries(SACRED_DISPLAY_META).map(([key, meta]) => {
                        const Icon = meta.icon
                        const val = rawSacred[key] ?? null
                        const delta = statDeltas[key] ?? 0
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between py-1 px-2 rounded bg-surface-container-low/20 border border-white/5 hover:border-border-gold/20 text-xs font-mono-data"
                          >
                            <span className="flex items-center gap-1.5 text-ivory-text">
                              <Icon size={12} className="text-primary-gold" />
                              <span>{meta.label}</span>
                              <span className="text-[9px] text-zinc-500">· {meta.element}</span>
                            </span>
                            <div className="flex items-center gap-2">
                              {delta !== 0 && (
                                <span
                                  className={`text-[10px] ${
                                    delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {formatSigned(delta, 1)}
                                </span>
                              )}
                              <span className="font-bold text-bright-gold min-w-[28px] text-right">
                                {formatNumber(val, 0)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Planetary 12 Family */}
                  <div className="rounded-lg border border-border-gold/20 bg-black/40 p-3.5 space-y-2.5">
                    <div className="flex items-center justify-between border-b border-border-gold/10 pb-1.5 text-xs font-mono-label">
                      <span className="text-bright-gold font-bold uppercase tracking-wider">
                        Planetary 12 Attributes
                      </span>
                      <span className="text-muted-text text-[9px] uppercase">Scale [0, 100]</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                      {Object.entries(PLANETARY_DISPLAY_META).map(([key, meta]) => {
                        const val = rawPlanetary[key] ?? null
                        const delta = statDeltas[key] ?? 0
                        return (
                          <div
                            key={key}
                            className="flex items-center justify-between py-1 px-2 rounded bg-surface-container-low/20 border border-white/5 hover:border-border-gold/20 text-xs font-mono-data"
                          >
                            <div className="truncate pr-1">
                              <span className="text-ivory-text block truncate text-[11px]">
                                {meta.label}
                              </span>
                              <span className="text-[8px] text-zinc-500 uppercase block">
                                {meta.ruler}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {delta !== 0 && (
                                <span
                                  className={`text-[9px] ${
                                    delta > 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {formatSigned(delta, 1)}
                                </span>
                              )}
                              <span className="font-bold text-ivory-text min-w-[24px] text-right">
                                {formatNumber(val, 0)}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: EXPERIENCE CATEGORIES & EVIDENCE */}
            {activeTab === 'experience' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between pb-2 border-b border-border-gold/15">
                  <h3 className="font-headline-md text-sm text-bright-gold uppercase tracking-wider">
                    Experience Ledger &amp; Training Proof
                  </h3>
                  <span className="text-[10px] font-mono-label text-muted-text">
                    Total: {totalXp.toLocaleString()} EXP
                  </span>
                </div>

                {/* Category Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs font-mono-label">
                  <div className="p-2.5 rounded-lg border border-border-gold/20 bg-black/40 text-center">
                    <MessageSquare size={13} className="mx-auto text-sky-400 mb-1" />
                    <span className="text-[9px] uppercase text-muted-text block">Live Chats</span>
                    <span className="font-mono-data text-sm font-bold text-ivory-text">
                      {expBreakdown?.chat ? expBreakdown.chat.toLocaleString() : '0'} EXP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border-gold/20 bg-black/40 text-center">
                    <BookOpen size={13} className="mx-auto text-primary-gold mb-1" />
                    <span className="text-[9px] uppercase text-muted-text block">Training</span>
                    <span className="font-mono-data text-sm font-bold text-bright-gold">
                      {expBreakdown?.training ? expBreakdown.training.toLocaleString() : '0'} EXP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border-gold/20 bg-black/40 text-center">
                    <Zap size={13} className="mx-auto text-amber-400 mb-1" />
                    <span className="text-[9px] uppercase text-muted-text block">Site Actions</span>
                    <span className="font-mono-data text-sm font-bold text-ivory-text">
                      {expBreakdown?.actions ? expBreakdown.actions.toLocaleString() : '0'} EXP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border-gold/20 bg-black/40 text-center">
                    <Award size={13} className="mx-auto text-emerald-400 mb-1" />
                    <span className="text-[9px] uppercase text-muted-text block">
                      Kitchen Quests
                    </span>
                    <span className="font-mono-data text-sm font-bold text-ivory-text">
                      {expBreakdown?.achievements
                        ? expBreakdown.achievements.toLocaleString()
                        : '0'}{' '}
                      EXP
                    </span>
                  </div>

                  <div className="p-2.5 rounded-lg border border-border-gold/20 bg-black/40 text-center col-span-2 sm:col-span-1">
                    <Swords size={13} className="mx-auto text-rose-400 mb-1" />
                    <span className="text-[9px] uppercase text-muted-text block">Pentacles</span>
                    <span className="font-mono-data text-sm font-bold text-ivory-text">
                      {expBreakdown?.pentacles ? expBreakdown.pentacles.toLocaleString() : '0'} EXP
                    </span>
                  </div>
                </div>

                {/* Evidence Verification Banner */}
                <div className="rounded-lg border border-border-gold/20 bg-black/40 p-3 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono-label text-[10px] uppercase text-muted-text font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={13} className="text-emerald-400" />
                      Historical Training Evidence
                    </span>
                    <span
                      className={`text-[9px] font-mono-label uppercase px-2 py-0.5 rounded border ${
                        verifiedTrainingConversations !== null
                          ? 'border-emerald-500/40 text-emerald-400 bg-emerald-950/40'
                          : 'border-zinc-700 text-zinc-400'
                      }`}
                    >
                      {verifiedTrainingConversations !== null
                        ? 'Verified Manifest'
                        : 'Pending Verification'}
                    </span>
                  </div>

                  <p className="text-[11px] text-muted-text leading-relaxed">
                    {verifiedTrainingConversations !== null ? (
                      <>
                        Credited{' '}
                        <strong className="text-bright-gold">
                          {verifiedTrainingConversations.toLocaleString()} verified training
                          conversations
                        </strong>{' '}
                        under the canonical 25 EXP/conversation policy. Catalog training imports use
                        deterministic manifest digests; durable live awards remain pending
                        integration.
                      </>
                    ) : (
                      'Historical training manifests will display once authoritative event receipts are synced.'
                    )}
                  </p>

                  <div className="text-[10px] text-zinc-500 pt-1 border-t border-border-gold/10">
                    <em>Notice:</em> Spendable ESMS token balances, arena tokens, and unverified
                    counters do not grant experience. Live awards require durable receipts that
                    survive chat text expiration; receipt persistence is pending integration.
                  </div>
                </div>
              </div>
            )}

            {/* Diagnostic Reasons if any */}
            {reasons.length > 0 && (
              <div className="rounded-lg border border-zinc-800 bg-black/60 p-3 text-xs text-zinc-400 space-y-1">
                <div className="flex items-center gap-1.5 text-zinc-500 font-mono-label text-[10px] uppercase">
                  <AlertCircle size={12} className="text-amber-500" />
                  <span>Progression Diagnostics</span>
                </div>
                <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                  {reasons.map((r: string, idx: number) => (
                    <li key={idx}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
