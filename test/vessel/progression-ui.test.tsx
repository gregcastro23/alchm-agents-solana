import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  VesselProgressionDisplay,
  resolveTransitTier,
} from '@/components/vessel/vessel-progression-display'
import type { AgentProgressionProfile } from '@/lib/agents/leveling-service'
import type { VesselStats } from '@/lib/vessel/progression'

function createSampleProgression(
  overrides: Partial<AgentProgressionProfile> = {}
): AgentProgressionProfile {
  const stats: VesselStats = {
    power: 80,
    resonance: 75,
    wisdom: 88,
    charisma: 70,
    intuition: 82,
    adaptability: 74,
    vitality: 78,
    solarAgency: 85,
    lunarReceptivity: 72,
    mercurialVelocity: 90,
    venusianCoherence: 68,
    martialImpetus: 76,
    jovianExpansion: 84,
    saturnianStructure: 80,
    chironicAdaptation: 70,
    uranianSurprisal: 75,
    neptunianResonance: 78,
    plutonicIntegration: 82,
    kineticAlignment: 80,
  }

  const statDeltas: VesselStats = {
    ...stats,
    power: 1.5,
    wisdom: 2.0,
    solarAgency: 1.2,
  }

  return {
    agentId: 'isaac-newton',
    vesselLevel: 15,
    totalXp: 19725,
    xpToNextLevel: 2775,
    levelBoost: 1.6969,
    baseOverall: 78.4,
    trainedOverall: 80.1,
    currentOverall: 82.3,
    transitDelta: 2.2,
    progressionStatus: 'live',
    asOf: '2026-10-20T16:00:00.000Z',
    expBreakdown: {
      chat: 0,
      training: 19725,
      actions: 0,
      achievements: 0,
      pentacles: 0,
    },
    trainingEvidence: {
      status: 'verified',
      verifiedItems: 789,
    },
    stats,
    statDeltas,
    reasons: [],
    ...overrides,
  }
}

describe('VesselProgressionDisplay Component', () => {
  describe('Card Badge Variant (variant="card-badge")', () => {
    it('renders both Vessel Level and Current Overall as distinct indicators', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="card-badge" />
      )

      // Vessel Level
      expect(html).toContain('VL 15')
      expect(html).toContain('Permanent Vessel Level 15')

      // Current Overall
      expect(html).toContain('OVR 82')
      expect(html).toContain('+2.2')
      expect(html).toContain('Rising above baseline')
    })

    it('renders falling indicator when transitDelta is negative', () => {
      const data = createSampleProgression({
        currentOverall: 77.9,
        transitDelta: -2.2,
      })
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="card-badge" />
      )

      expect(html).toContain('OVR 78')
      expect(html).toContain('-2.2')
      expect(html).toContain('Falling below baseline')
    })

    it('preserves Vessel Level when Current Overall is null during chart outage', () => {
      const data = createSampleProgression({
        currentOverall: null,
        transitDelta: null,
        progressionStatus: 'unavailable',
      })
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="card-badge" />
      )

      // Vessel Level remains visible and permanent
      expect(html).toContain('VL 15')
      // Current Overall shows unavailable placeholder without fabricating a score
      expect(html).toContain('OVR —')
      expect(html).toContain('Pending chart')
    })
  })

  describe('Compact Variant (variant="compact")', () => {
    it('renders two distinct summary cards and status badge', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="compact" />
      )

      expect(html).toContain('Vessel Level')
      expect(html).toContain('15')
      expect(html).toContain('19,725 EXP')

      expect(html).toContain('Current Overall')
      expect(html).toContain('82')
      expect(html).toContain('+2.2')
      expect(html).toContain('live')
    })
  })

  describe('Full Codex Profile Variant (variant="full")', () => {
    it('renders permanent Vessel Level with lifetime EXP, next-level progress, and permanent boost', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="full" defaultExpanded={true} />
      )

      // Permanent Vessel Level header
      expect(html).toContain('Permanent Vessel Level')
      expect(html).toContain('15')
      expect(html).toContain('Level 15 of 100')
      expect(html).toContain('+1.70 Baseline Boost')

      // Lifetime EXP and progress
      expect(html).toContain('19,725 EXP')
      expect(html).toContain('2,775 EXP to Level 16')
      expect(html).toContain('role="progressbar"')
    })

    it('renders Current Overall with signed delta and accessible rising/falling indicator', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="full" defaultExpanded={true} />
      )

      expect(html).toContain('Current Overall (Celestial)')
      expect(html).toContain('82.3')
      expect(html).toContain('+2.2 OVR')
      expect(html).toContain('Surging above baseline')
      expect(html).toContain('Live Ephemeris')
      expect(html).toContain('Permanent Baseline Anchor:')
      expect(html).toContain('80.1')
    })

    it('renders expandable mathematical breakdown (Base -> Boost -> Baseline -> Transit -> Current)', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="full" defaultExpanded={true} />
      )

      expect(html).toContain('1. Base Overall')
      expect(html).toContain('78.4')
      expect(html).toContain('+ 2. Vessel Boost')
      expect(html).toContain('+1.70')
      expect(html).toContain('= 3. Baseline')
      expect(html).toContain('80.1')
      expect(html).toContain('± 4. Sky Transit')
      expect(html).toContain('+2.2')
      expect(html).toContain('= 5. Current OVR')
      expect(html).toContain('82.3')
    })

    it('includes all 19 stats, grouped into Sacred 7 and Planetary 12', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay
          progression={data}
          variant="full"
          defaultExpanded={true}
          initialTab="stats"
        />
      )

      // Sacred 7
      expect(html).toContain('Sacred 7 Attributes')
      expect(html).toContain('Power')
      expect(html).toContain('Resonance')
      expect(html).toContain('Wisdom')
      expect(html).toContain('Charisma')
      expect(html).toContain('Intuition')
      expect(html).toContain('Adaptability')
      expect(html).toContain('Vitality')

      // Planetary 12
      expect(html).toContain('Planetary 12 Attributes')
      expect(html).toContain('Solar Agency')
      expect(html).toContain('Lunar Receptivity')
      expect(html).toContain('Mercurial Velocity')
      expect(html).toContain('Venusian Coherence')
      expect(html).toContain('Martial Impetus')
      expect(html).toContain('Jovian Expansion')
      expect(html).toContain('Saturnian Structure')
      expect(html).toContain('Chironic Adaptation')
      expect(html).toContain('Uranian Surprisal')
      expect(html).toContain('Neptunian Resonance')
      expect(html).toContain('Plutonic Integration')
      expect(html).toContain('Kinetic Alignment')
    })

    it('displays experience categories and verified training evidence', () => {
      const data = createSampleProgression()
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay
          progression={data}
          variant="full"
          defaultExpanded={true}
          initialTab="experience"
        />
      )

      expect(html).toContain('Experience Ledger')
      expect(html).toContain('Live Chats')
      expect(html).toContain('Training')
      expect(html).toContain('Site Actions')
      expect(html).toContain('Kitchen Quests')
      expect(html).toContain('Pentacles')
      expect(html).toContain('Historical Training Evidence')
      expect(html).toContain('789 verified training conversations')
      expect(html).toContain('Verified Manifest')
    })

    it('honestly renders chart outage while preserving earned growth', () => {
      const data = createSampleProgression({
        currentOverall: null,
        transitDelta: null,
        progressionStatus: 'unavailable',
        reasons: ['Current sky positions are unavailable.'],
      })
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={data} variant="full" defaultExpanded={true} />
      )

      // Vessel Level and lifetime EXP are intact
      expect(html).toContain('15')
      expect(html).toContain('19,725 EXP')
      expect(html).toContain('+1.70 Baseline Boost')

      // Current Overall is truthfully unavailable
      expect(html).toContain('Chart Offline')
      expect(html).toContain('Chart Unavailable')
      expect(html).toContain('Current sky positions are unavailable.')
    })

    it('renders honest pending state when progression data is missing', () => {
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay progression={null} variant="full" />
      )

      expect(html).toContain('Vessel Progression Pending')
      expect(html).toContain('Progression records are currently unavailable')
    })

    it('calibrates transit tier thresholds at ±4 (Notable), ±8 (Strong), and ±12 (Peak/Severe)', () => {
      expect(resolveTransitTier(4.0).label).toBe('Notable Alignment')
      expect(resolveTransitTier(-4.0).label).toBe('Notable Affliction')
      expect(resolveTransitTier(8.0).label).toBe('Strong Alignment')
      expect(resolveTransitTier(-8.0).label).toBe('Strong Affliction')
      expect(resolveTransitTier(12.0).label).toBe('Peak Exaltation')
      expect(resolveTransitTier(-12.0).label).toBe('Severe Affliction')

      const peakHtml = renderToStaticMarkup(
        <VesselProgressionDisplay
          progression={createSampleProgression({
            trainedOverall: 92.0,
            currentOverall: 99.0, // Clamped at 99 ceiling (92 + 13 = 105 -> 99)
            transitDelta: 13.0, // Raw unclamped transitDelta preserved
          })}
          variant="full"
          defaultExpanded={true}
        />
      )
      expect(peakHtml).toContain('Peak Exaltation')
      expect(peakHtml).toContain('+13.0 OVR')
      expect(peakHtml).toContain('Bounded [-15, +15]')
    })

    it('renders 4D ESMS Wavefunction Attribution in breakdown panel when present', () => {
      const html = renderToStaticMarkup(
        <VesselProgressionDisplay
          progression={createSampleProgression({
            esmsAxisAttribution: {
              Spirit: 0.72,
              Essence: 0.34,
              Matter: -0.41,
              Substance: 0.15,
            },
          })}
          variant="full"
          defaultExpanded={true}
        />
      )
      expect(html).toContain('4D ESMS Wavefunction Attribution')
      expect(html).toContain('+0.72')
      expect(html).toContain('+0.34')
      expect(html).toContain('-0.41')
      expect(html).toContain('+0.15')
    })
  })
})
