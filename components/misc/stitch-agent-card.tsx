'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { Check, MessageSquare } from 'lucide-react'
import type { CraftedAgent } from '@/lib/agent-types'
import { ELEMENT_METADATA } from '@/lib/element-metadata'
import { useFreeAgents } from '@/hooks/use-free-agents'
import {
  computeAgentProgression,
  type AgentProgressionProfile,
} from '@/lib/agents/leveling-service'
import { rateAgent, type AgentRating } from '@/lib/agents/rating'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'
import { VesselProgressionDisplay } from '@/components/vessel/vessel-progression-display'
import { VesselRatingRibbon, formatRelicLabel } from '@/components/vessel/pentacle-rating-display'

interface StitchAgentCardProps {
  agent: CraftedAgent
  progression?: AgentProgressionProfile | null
  rating?: AgentRating | null
  isSelected?: boolean
  onToggleSelection?: (agentId: string) => void
  variant?: 'card' | 'list'
}

export function StitchAgentCard({
  agent,
  progression,
  rating: ratingProp,
  isSelected = false,
  onToggleSelection,
  variant = 'card',
}: StitchAgentCardProps) {
  const element = agent.consciousness?.dominantElement || 'Air'
  const meta = ELEMENT_METADATA[element as keyof typeof ELEMENT_METADATA] || ELEMENT_METADATA.Air

  const progressionData = useMemo(
    () => (progression !== undefined ? progression : computeAgentProgression(agent)),
    [progression, agent]
  )

  const ratingData = useMemo(() => {
    if (ratingProp !== undefined) return ratingProp
    try {
      return rateAgent(agent)
    } catch {
      return null
    }
  }, [ratingProp, agent])

  const appearance = useMemo(
    () => resolveAgentAppearance(agent.id, undefined, ratingData?.archetype),
    [agent.id, ratingData?.archetype]
  )

  const portraitSrc =
    agent.appearance?.avatar || appearance.portraitSvgDataUri || '/avatars/default.png'
  const relicLabel = formatRelicLabel(appearance.signatureRelic)

  const { isFree } = useFreeAgents()
  const agentIsFree = isFree(agent.id)

  const handleSelect = (e: React.MouseEvent) => {
    if (onToggleSelection) {
      e.preventDefault()
      e.stopPropagation()
      onToggleSelection(agent.id)
    }
  }

  const origin = agent.birthLocation?.name || agent.birthData?.location?.name || 'Unknown'
  const displayOrigin = origin
    .replace(', Germany', ', DE')
    .replace(', Italy', ', IT')
    .replace(', Egypt', ', EG')
    .replace(', Mexico', ', MX')
    .replace(', Greece', ', GR')
    .replace(', France', ', FR')
    .replace(', United Kingdom', ', UK')
    .replace(', United States', ', US')

  if (variant === 'list') {
    return (
      <article className="glass-panel p-md flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 group relative hover:border-primary-gold/60 transition-all duration-300 select-none bg-[#12141f]/85 backdrop-blur-xl border border-border-gold/30 rounded-lg w-full">
        <div className="flex items-center min-w-0 flex-grow">
          {onToggleSelection && (
            <button
              type="button"
              onClick={handleSelect}
              aria-label={isSelected ? `Deselect ${agent.name}` : `Select ${agent.name}`}
              className={`w-5 h-5 mr-md rounded border transition-all flex items-center justify-center flex-shrink-0 ${
                isSelected
                  ? 'bg-primary-gold border-primary-gold text-on-primary-gold'
                  : 'border-border-gold hover:border-primary-gold bg-black/40'
              }`}
            >
              {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
            </button>
          )}

          <Link
            href={`/agent/${agent.id}`}
            className="flex items-center space-x-md min-w-0 flex-grow"
          >
            <div
              className={`w-12 h-12 rounded-full overflow-hidden border-2 flex-shrink-0 bg-[#0b0e19] ${meta.glow}`}
            >
              <img
                src={portraitSrc}
                alt={agent.name}
                onError={e => {
                  if (
                    appearance.portraitSvgDataUri &&
                    e.currentTarget.src !== appearance.portraitSvgDataUri
                  ) {
                    e.currentTarget.src = appearance.portraitSvgDataUri
                  }
                }}
                className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all"
              />
            </div>

            <div className="min-w-0 space-y-1">
              <h3 className="font-headline-md text-base text-bright-gold transition-colors group-hover:text-primary-gold truncate">
                {agent.name}
              </h3>
              <p className="font-mono-label text-[10px] text-muted-text uppercase tracking-wider truncate">
                {agent.title || 'Alchemical Scholar'}
              </p>
              {ratingData && (
                <VesselRatingRibbon ovr={ratingData.ovr} archetype={ratingData.archetype} compact />
              )}
            </div>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-right flex-shrink-0">
          <div className="hidden lg:block text-left">
            <div className="text-[9px] uppercase text-muted-text opacity-50 font-eyebrow">
              ERA &amp; RELIC
            </div>
            <div className="font-mono-data text-[11px] text-ivory-text">
              {agent.era || agent.historicalEra || 'Modern'}
              {relicLabel ? ` · ${relicLabel}` : ` · ${displayOrigin}`}
            </div>
          </div>

          <VesselProgressionDisplay progression={progressionData} variant="card-badge" />

          <Link
            href={`/vault/${agent.id}`}
            className="inline-flex items-center gap-1 rounded border border-violet-400/35 bg-violet-500/15 px-2.5 py-1 font-mono text-[10px] font-semibold uppercase text-violet-100 hover:bg-violet-500/25 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Commune
          </Link>

          <Link
            href={`/agent/${agent.id}`}
            className="inline-flex items-center gap-1 rounded border border-border-gold/40 bg-black/40 px-2.5 py-1 font-mono text-[10px] uppercase text-bright-gold hover:border-primary-gold transition-colors"
          >
            Codex →
          </Link>
        </div>
      </article>
    )
  }

  return (
    <article
      className="glass-panel p-lg flex flex-col justify-between group relative hover:border-primary-gold/60 transition-all duration-500 hover:-translate-y-1.5 select-none h-full bg-[#12141f]/85 backdrop-blur-2xl border border-border-gold shadow-[0_0_20px_rgba(216,180,106,0.03)] rounded-xl"
      style={{ minHeight: '410px' }}
    >
      {/* Selection Trigger */}
      {onToggleSelection && (
        <button
          type="button"
          onClick={handleSelect}
          className={`absolute top-4 left-4 z-20 w-5 h-5 rounded border transition-all flex items-center justify-center ${
            isSelected
              ? 'bg-primary-gold border-primary-gold text-on-primary-gold'
              : 'border-border-gold hover:border-primary-gold bg-black/40'
          }`}
          aria-label={isSelected ? `Deselect ${agent.name}` : `Select ${agent.name}`}
        >
          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
        </button>
      )}

      {agentIsFree && (
        <span className="absolute top-4 right-4 z-20 font-mono-label text-[10px] text-[#34d399] bg-[#34d399]/15 px-2 py-0.5 rounded border border-[#34d399]/40 backdrop-blur-sm">
          🎁 Free this week
        </span>
      )}

      {/* Main Profile Link */}
      <Link href={`/agent/${agent.id}`} className="w-full flex flex-col items-center flex-grow">
        {/* Avatar Area */}
        <div className="relative mb-md mt-sm">
          <div
            className={`w-28 h-28 rounded-full overflow-hidden border-2 bg-[#0b0e19] group-hover:scale-105 transition-transform duration-500 ${meta.glow}`}
            style={{
              boxShadow: `0 0 16px -2px ${meta.glowColor}`,
            }}
          >
            <img
              src={portraitSrc}
              alt={agent.name}
              onError={e => {
                if (
                  appearance.portraitSvgDataUri &&
                  e.currentTarget.src !== appearance.portraitSvgDataUri
                ) {
                  e.currentTarget.src = appearance.portraitSvgDataUri
                }
              }}
              className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700"
            />
          </div>
          <div
            className={`absolute -bottom-2 right-0 ${meta.bg} text-background text-[10px] px-2 py-0.5 rounded-full font-mono-label font-bold uppercase tracking-wider`}
          >
            {element}
          </div>
        </div>

        {/* Name, Title & Pentacle Rating Ribbon */}
        <div className="text-center w-full space-y-2 mb-md">
          <div>
            <h3 className="font-headline-md text-headline-md text-bright-gold mb-0.5 transition-colors group-hover:text-primary-gold leading-tight">
              {agent.name}
            </h3>
            <p className="font-mono-label text-[10px] text-muted-text uppercase tracking-widest line-clamp-1">
              {agent.title || 'Alchemical Scholar'}
            </p>
          </div>

          {ratingData && (
            <div className="flex justify-center pt-0.5">
              <VesselRatingRibbon ovr={ratingData.ovr} archetype={ratingData.archetype} compact />
            </div>
          )}
        </div>

        {/* Era & Signature Relic */}
        <div className="w-full grid grid-cols-2 gap-sm mt-auto">
          <div className="flex flex-col items-start p-xs bg-surface-container-low/40 border border-border-gold/10 rounded">
            <span className="text-[9px] uppercase text-muted-text opacity-50 font-eyebrow">
              Era
            </span>
            <span className="font-mono-data text-[11px] text-ivory-text truncate w-full text-left capitalize">
              {agent.era || agent.historicalEra || appearance.era}
            </span>
          </div>
          <div className="flex flex-col items-start p-xs bg-surface-container-low/40 border border-border-gold/10 rounded">
            <span className="text-[9px] uppercase text-muted-text opacity-50 font-eyebrow">
              {relicLabel ? 'Signature Relic' : 'Origin'}
            </span>
            <span className="font-mono-data text-[11px] text-ivory-text truncate w-full text-left">
              {relicLabel || displayOrigin}
            </span>
          </div>
        </div>
      </Link>

      {/* Footer: Progression + Quick Commune / Codex Links */}
      <div className="w-full pt-3 mt-3 border-t border-border-gold/20 space-y-2">
        <div className="flex flex-wrap justify-between items-center gap-1.5">
          <VesselProgressionDisplay progression={progressionData} variant="card-badge" />
          <span className="text-[10px] font-mono-label text-muted-text uppercase flex items-center gap-1">
            <span
              className={`w-1.5 h-1.5 rounded-full ${meta.bg} shadow-[0_0_5px_rgba(255,255,255,0.4)]`}
            />
            {agent.consciousness?.level || 'Active'}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/vault/${agent.id}`}
            className="inline-flex items-center justify-center gap-1 rounded border border-violet-400/35 bg-violet-500/15 py-1 font-mono text-[10px] font-semibold uppercase text-violet-100 hover:bg-violet-500/25 transition-colors"
          >
            <MessageSquare className="w-3 h-3" />
            Commune
          </Link>
          <Link
            href={`/agent/${agent.id}`}
            className="inline-flex items-center justify-center gap-1 rounded border border-border-gold/35 bg-black/40 py-1 font-mono text-[10px] font-semibold uppercase text-bright-gold hover:border-primary-gold transition-colors"
          >
            Rated Codex →
          </Link>
        </div>
      </div>
    </article>
  )
}
