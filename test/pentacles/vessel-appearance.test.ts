import { describe, it, expect } from 'bun:test'
import {
  resolveAgentAppearance,
  createVesselPortraitSvg,
  VESSEL_APPEARANCE_MANIFEST,
  CANONICAL_ROSTER_71,
  VESSEL_RELIC_LABELS,
  type VesselAppearanceProfile,
} from '@/lib/agents/vessel-appearance-manifest'

describe('Vessel Appearance Manifest & Procedural Likeness Contract', () => {
  describe('Canonical Pilot Vessel Profiles', () => {
    it('resolves Sir Isaac Newton pilot profile accurately', () => {
      const newton = resolveAgentAppearance('isaac-newton')
      expect(newton.era).toBe('enlightenment')
      expect(newton.headSilhouette.crownStyle).toBe('newton-curls')
      expect(newton.garmentSilhouette.mantleStyle).toBe('enlightenment-coat')
      expect(newton.garmentSilhouette.collarStyle).toBe('high-cravat')
      expect(newton.signatureRelic).toBe('prism-octahedron')
      expect(VESSEL_RELIC_LABELS[newton.signatureRelic]).toBe('Prism Octahedron')
      expect(newton.paletteOverrides.primaryGarmentHex).toBe('#481f32')
      expect(newton.paletteOverrides.hairOrCrownHex).toBe('#d6c9b5')
      expect(newton.portraitUrl).toBe('/avatars/newton.png')
      expect(newton.portraitSvgDataUri).toBeDefined()
      expect(newton.portraitSvgDataUri).toStartWith('data:image/svg+xml,')
      expect(decodeURIComponent(newton.portraitSvgDataUri!)).toContain('<svg')
    })

    it('resolves Leonardo da Vinci pilot profile accurately', () => {
      const leonardo = resolveAgentAppearance('leonardo-da-vinci')
      expect(leonardo.era).toBe('renaissance')
      expect(leonardo.headSilhouette.crownStyle).toBe('da-vinci-beret-beard')
      expect(leonardo.garmentSilhouette.mantleStyle).toBe('renaissance-drape')
      expect(leonardo.garmentSilhouette.collarStyle).toBe('renaissance-collar')
      expect(leonardo.signatureRelic).toBe('vitruvian-gyroscope')
      expect(VESSEL_RELIC_LABELS[leonardo.signatureRelic]).toBe('Vitruvian Gyroscope')
      expect(leonardo.paletteOverrides.primaryGarmentHex).toBe('#302b68')
      expect(leonardo.paletteOverrides.secondaryTrimHex).toBe('#deb968')
      expect(leonardo.portraitUrl).toBe('/avatars/leonardo-da-vinci.png')
      expect(leonardo.portraitSvgDataUri).toBeDefined()
      expect(leonardo.portraitSvgDataUri).toStartWith('data:image/svg+xml,')
    })

    it('resolves Emily Dickinson pilot profile accurately', () => {
      const emily = resolveAgentAppearance('emily-dickinson')
      expect(emily.era).toBe('romantic')
      expect(emily.headSilhouette.crownStyle).toBe('dickinson-parted-bun')
      expect(emily.garmentSilhouette.mantleStyle).toBe('victorian-shawl')
      expect(emily.garmentSilhouette.collarStyle).toBe('lace-tippet')
      expect(emily.signatureRelic).toBe('herbarium-quill-lantern')
      expect(VESSEL_RELIC_LABELS[emily.signatureRelic]).toBe('Herbarium Lantern')
      expect(emily.paletteOverrides.primaryGarmentHex).toBe('#ece6d8')
      expect(emily.portraitUrl).toBe('/avatars/emily-dickinson.png')
      expect(emily.portraitSvgDataUri).toBeDefined()
      expect(emily.portraitSvgDataUri).toStartWith('data:image/svg+xml,')
    })

    it('resolves User Avatar Neo pilot profile accurately', () => {
      const neo = resolveAgentAppearance('user-avatar-neo')
      expect(neo.era).toBe('astral')
      expect(neo.headSilhouette.crownStyle).toBe('sovereign-crest')
      expect(neo.garmentSilhouette.mantleStyle).toBe('alchemical-vestments')
      expect(neo.garmentSilhouette.collarStyle).toBe('astral-gorget')
      expect(neo.signatureRelic).toBe('solar-astrolabe')
      expect(VESSEL_RELIC_LABELS[neo.signatureRelic]).toBe('Solar Astrolabe')
      expect(neo.paletteOverrides.primaryGarmentHex).toBe('#171b2c')
      expect(neo.paletteOverrides.secondaryTrimHex).toBe('#efc45c')
      expect(neo.portraitSvgDataUri).toBeDefined()
      expect(neo.portraitSvgDataUri).toStartWith('data:image/svg+xml,')
    })
  })

  describe('Deterministic Fallback Across 71-Agent Roster', () => {
    it('contains all 71 canonical historical figures', () => {
      expect(CANONICAL_ROSTER_71.length).toBe(71)
    })

    it('generates fully populated appearance profiles for all 71 agents', () => {
      for (const agent of CANONICAL_ROSTER_71) {
        const profile = resolveAgentAppearance(agent.key)
        expect(profile).toBeDefined()
        expect(profile.era).toBeDefined()
        expect(profile.headSilhouette.crownStyle).toBeDefined()
        expect(profile.headSilhouette.faceProportion.jawWidth).toBeGreaterThan(0.5)
        expect(profile.headSilhouette.faceProportion.browDepth).toBeGreaterThan(0.5)
        expect(profile.headSilhouette.faceProportion.cranialHeight).toBeGreaterThan(0.5)
        expect(profile.garmentSilhouette.mantleStyle).toBeDefined()
        expect(profile.garmentSilhouette.collarStyle).toBeDefined()
        expect(profile.signatureRelic).toBeDefined()
        expect(profile.paletteOverrides.primaryGarmentHex).toStartWith('#')
        expect(profile.paletteOverrides.secondaryTrimHex).toStartWith('#')
        expect(profile.paletteOverrides.hairOrCrownHex).toStartWith('#')
        expect(profile.paletteOverrides.skinOrMaterialToneHex).toStartWith('#')
        expect(profile.portraitSvgDataUri).toBeDefined()
        expect(profile.portraitSvgDataUri).toStartWith('data:image/svg+xml,')
      }
    })

    it('generates reproducible SVG cameos with inline vector content', () => {
      const mockProfile: VesselAppearanceProfile = {
        era: 'enlightenment',
        headSilhouette: {
          crownStyle: 'newton-curls',
          faceProportion: { jawWidth: 0.9, browDepth: 1.0, cranialHeight: 1.0 },
        },
        garmentSilhouette: {
          mantleStyle: 'enlightenment-coat',
          collarStyle: 'high-cravat',
        },
        signatureRelic: 'prism-octahedron',
        paletteOverrides: {
          primaryGarmentHex: '#3b1d28',
          secondaryTrimHex: '#d8c4a0',
          hairOrCrownHex: '#ece2d0',
          skinOrMaterialToneHex: '#e8c7a5',
        },
      }

      const svgDataUri = createVesselPortraitSvg(mockProfile)
      expect(svgDataUri).toStartWith('data:image/svg+xml,')
      const decoded = decodeURIComponent(svgDataUri)
      expect(decoded).toContain('<svg xmlns="http://www.w3.org/2000/svg"')
      expect(decoded).toContain('Prism') // Relic label
      expect(decoded).toContain('M80 71L87 81') // Octahedron path
    })

    it('ensures returned profiles are isolated copies (no shared mutation)', () => {
      const copy1 = resolveAgentAppearance('isaac-newton')
      const copy2 = resolveAgentAppearance('isaac-newton')

      copy1.paletteOverrides.primaryGarmentHex = '#000000'
      expect(copy2.paletteOverrides.primaryGarmentHex).toBe('#481f32')
    })
  })
})
