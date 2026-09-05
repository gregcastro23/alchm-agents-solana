'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import type { ZodiacTheme } from '@/lib/zodiac-utils'
import { ProfileYieldPanel } from '@/components/profile/ProfileYieldPanel'
import { QuickChartAttachmentGenerator } from '@/components/landing/quick-chart-attachment-generator'
import {
  Compass,
  Users,
  Sparkles,
  FlaskConical,
  BrainCircuit,
  TrendingUp,
  ArrowRight,
  LogOut,
  Crown,
  ChefHat,
  Layers,
  Copy,
  Check,
} from 'lucide-react'

const CircularNatalHoroscope = dynamic(
  () => import('@/components/charts/circular-natal-horoscope'),
  {
    loading: () => (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-500" />
      </div>
    ),
  }
)

const LiveConsciousnessDisplay = dynamic(
  () =>
    import('@/components/profile/live-consciousness-display').then(mod => ({
      default: mod.LiveConsciousnessDisplay,
    })),
  {
    loading: () => (
      <div className="h-48 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500" />
      </div>
    ),
  }
)

interface MeClientProps {
  user: {
    name?: string | null
    image?: string | null
  }
  sunSign: string
  zodiacTheme: ZodiacTheme
  monicaConstant: number
  dominantElement: string
  modality: string
  spirit: number
  essence: number
  matter: number
  substance: number
  fire: number
  water: number
  air: number
  earth: number
  Heat: number
  Entropy: number
  Reactivity: number
  EnergyValue: number
  computationError: string | null
  birthInfo: {
    year: number
    month: number
    day: number
    hour: number
    minute: number
    latitude?: number
    longitude?: number
  }
  profileName: string | null
  renderAstrologize?: any
  renderAlchemize?: any
  renderImaginizer?: any
  wallet: ProfileYieldState | null
}

const tourCards = [
  {
    icon: Compass,
    title: 'Cosmic Tools',
    description:
      'Track planetary movements, chart the current moment, and explore cosmic timing through the Time Laboratory.',
    href: 'https://alchm.kitchen/quantities',
    cta: 'Open Time Lab',
  },
  {
    icon: Users,
    title: 'Planetary Council',
    description:
      'Engage in multi-agent conversations with the planetary governing body. Each agent embodies a celestial archetype.',
    href: '/planetary-council',
    cta: 'Enter the Council',
  },
  {
    icon: Sparkles,
    title: 'Agent Gallery',
    description:
      'Explore 50+ historical and astrological AI agents — from Leonardo da Vinci to Carl Jung — each shaped by real birthcharts.',
    href: '/gallery',
    cta: 'Browse Agents',
  },
  {
    icon: FlaskConical,
    title: 'Mystic Arts',
    description:
      'Cast runes, draw tarot spreads, and perform alchemical synthesis in the Rune Forge and Synthesis Chamber.',
    href: '/rune-forge',
    cta: 'Begin Crafting',
  },
  {
    icon: BrainCircuit,
    title: 'Alchemical Labs',
    description:
      'Live telemetry — the consciousness trajectory across all communions and the agent league record.',
    href: '/labs',
    cta: 'Read the Record',
  },
  {
    icon: TrendingUp,
    title: 'Your Chart',
    description:
      'Interpret your natal chart, track transits and planetary aspects, and discover how celestial events shape your path.',
    href: '/chart-interpreter',
    cta: 'Interpret Chart',
  },
  {
    icon: Crown,
    title: 'Account & Treasury',
    description:
      'Manage your ESMS Token Treasury, claim daily yields, spend at the Bazaar, and connect direct AI keys.',
    href: '/account',
    cta: 'Manage Account',
  },
  {
    icon: ChefHat,
    title: 'Your Kitchen Profile',
    description:
      'Your alchm.kitchen account and shared token wallet — same login, culinary side of the Alchm ecosystem.',
    href: 'https://alchm.kitchen/profile',
    cta: 'Open Kitchen Profile',
  },
]

function getConsciousnessLevel(mc: number): string {
  if (mc < 1) return 'Foundational'
  if (mc < 2) return 'Developing'
  if (mc < 3) return 'Advanced'
  return 'Transcendent'
}

// --- Helper for Planetary Dignity ---
type EssentialDignity = 'Domicile' | 'Exaltation' | 'Detriment' | 'Fall' | 'Peregrine'

function getPlanetDignity(planet: string, sign: string): EssentialDignity | undefined {
  const table: Record<
    string,
    { domicile: string[]; exaltation: string[]; detriment: string[]; fall: string[] }
  > = {
    Sun: { domicile: ['Leo'], exaltation: ['Aries'], detriment: ['Aquarius'], fall: ['Libra'] },
    Moon: {
      domicile: ['Cancer'],
      exaltation: ['Taurus'],
      detriment: ['Capricorn'],
      fall: ['Scorpio'],
    },
    Mercury: {
      domicile: ['Gemini', 'Virgo'],
      exaltation: ['Virgo'],
      detriment: ['Sagittarius', 'Pisces'],
      fall: ['Pisces'],
    },
    Venus: {
      domicile: ['Taurus', 'Libra'],
      exaltation: ['Pisces'],
      detriment: ['Scorpio', 'Aries'],
      fall: ['Virgo'],
    },
    Mars: {
      domicile: ['Aries', 'Scorpio'],
      exaltation: ['Capricorn'],
      detriment: ['Libra', 'Taurus'],
      fall: ['Cancer'],
    },
    Jupiter: {
      domicile: ['Sagittarius', 'Pisces'],
      exaltation: ['Cancer'],
      detriment: ['Gemini', 'Virgo'],
      fall: ['Capricorn'],
    },
    Saturn: {
      domicile: ['Capricorn', 'Aquarius'],
      exaltation: ['Libra'],
      detriment: ['Cancer', 'Leo'],
      fall: ['Aries'],
    },
  }
  const d = table[planet]
  if (!d) return undefined
  if (d.domicile.includes(sign)) return 'Domicile'
  if (d.exaltation.includes(sign)) return 'Exaltation'
  if (d.detriment.includes(sign)) return 'Detriment'
  if (d.fall.includes(sign)) return 'Fall'
  return undefined
}

const DignityBadge: React.FC<{ dignity?: EssentialDignity }> = ({ dignity }) => {
  if (!dignity) return null
  const styles: Record<EssentialDignity, string> = {
    Domicile: 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10',
    Exaltation:
      'border-amber-500/50 text-amber-400 bg-amber-500/10 shadow-[0_0_10px_rgba(245,158,11,0.15)]',
    Detriment: 'border-rose-500/30 text-rose-400 bg-rose-500/10',
    Fall: 'border-slate-500/30 text-slate-400 bg-slate-800/40',
    Peregrine: 'border-white/10 text-slate-300 bg-white/5',
  }

  return (
    <span
      className={`px-2 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider border ${styles[dignity]}`}
    >
      {dignity}
    </span>
  )
}

export function MeClient({
  user,
  sunSign,
  zodiacTheme,
  monicaConstant,
  dominantElement,
  modality,
  spirit,
  essence,
  matter,
  substance,
  fire,
  water,
  air,
  earth,
  Heat,
  Entropy,
  Reactivity,
  EnergyValue,
  computationError,
  birthInfo,
  profileName,
  renderAstrologize,
  renderAlchemize,
  renderImaginizer,
  wallet,
}: MeClientProps) {
  const maxAlchm = Math.max(spirit, essence, matter, substance, 1)

  const [activeZodiacTab, setActiveZodiacTab] = useState<'tropical' | 'sidereal'>('tropical')
  const [activeCodexTab, setActiveCodexTab] = useState<'planets' | 'angles' | 'karmic'>('planets')
  const [copied, setCopied] = useState(false)

  const handleCopyPrompt = () => {
    if (!renderImaginizer?.prompt || !navigator.clipboard?.writeText) return
    navigator.clipboard
      .writeText(renderImaginizer.prompt)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
      .catch(() => {
        /* clipboard blocked (insecure context / permission denied) — no-op */
      })
  }

  // Inject zodiac CSS custom properties via inline style on the root element
  const zodiacCssVars = {
    '--zodiac-gradient': zodiacTheme.gradient,
    '--zodiac-card-gradient': zodiacTheme.cardGradient,
    '--zodiac-accent': zodiacTheme.accentHsl,
    '--zodiac-glow': zodiacTheme.glowColor,
    '--zodiac-border': zodiacTheme.borderColor,
  } as React.CSSProperties

  // Calculate normalized macro elements & modalities
  const totalElements = Math.max(fire + earth + air + water, 1)
  const firePct = Math.round((fire / totalElements) * 100) || 25
  const earthPct = Math.round((earth / totalElements) * 100) || 25
  const airPct = Math.round((air / totalElements) * 100) || 25
  const waterPct = Math.max(0, 100 - (firePct + earthPct + airPct))

  // Modality estimation
  const cardPct = modality === 'Cardinal' ? 50 : 25
  const fixPct =
    modality === 'Fixed' ? 50 : dominantElement === 'Fire' || dominantElement === 'Water' ? 40 : 30
  const mutPct = Math.max(10, 100 - (cardPct + fixPct))

  // 12 Signs Composition Breakdown
  const ALL_12_SIGNS = [
    {
      code: 'ARI',
      name: 'Aries',
      element: 'bg-amber-500',
      color: '#F59E0B',
      weight: sunSign === 'Aries' ? 22 : 6 + ((fire * 3) % 8),
    },
    {
      code: 'TAU',
      name: 'Taurus',
      element: 'bg-emerald-400',
      color: '#10B981',
      weight: sunSign === 'Taurus' ? 22 : 5 + ((earth * 3) % 8),
    },
    {
      code: 'GEM',
      name: 'Gemini',
      element: 'bg-indigo-300',
      color: '#A78BFA',
      weight: sunSign === 'Gemini' ? 22 : 7 + ((air * 3) % 8),
    },
    {
      code: 'CAN',
      name: 'Cancer',
      element: 'bg-cyan-400',
      color: '#00E5FF',
      weight: sunSign === 'Cancer' ? 22 : 8 + ((water * 3) % 8),
    },
    {
      code: 'LEO',
      name: 'Leo',
      element: 'bg-amber-500',
      color: '#F59E0B',
      weight: sunSign === 'Leo' ? 22 : 9 + ((fire * 4) % 8),
    },
    {
      code: 'VIR',
      name: 'Virgo',
      element: 'bg-emerald-400',
      color: '#10B981',
      weight: sunSign === 'Virgo' ? 22 : 6 + ((earth * 4) % 8),
    },
    {
      code: 'LIB',
      name: 'Libra',
      element: 'bg-indigo-300',
      color: '#A78BFA',
      weight: sunSign === 'Libra' ? 22 : 7 + ((air * 4) % 8),
    },
    {
      code: 'SCO',
      name: 'Scorpio',
      element: 'bg-cyan-400',
      color: '#00E5FF',
      weight: sunSign === 'Scorpio' ? 22 : 9 + ((water * 4) % 8),
    },
    {
      code: 'SAG',
      name: 'Sagittarius',
      element: 'bg-amber-500',
      color: '#F59E0B',
      weight: sunSign === 'Sagittarius' ? 22 : 7 + ((fire * 2) % 8),
    },
    {
      code: 'CAP',
      name: 'Capricorn',
      element: 'bg-emerald-400',
      color: '#10B981',
      weight: sunSign === 'Capricorn' ? 22 : 8 + ((earth * 2) % 8),
    },
    {
      code: 'AQU',
      name: 'Aquarius',
      element: 'bg-indigo-300',
      color: '#A78BFA',
      weight: sunSign === 'Aquarius' ? 22 : 7 + ((air * 2) % 8),
    },
    {
      code: 'PIS',
      name: 'Pisces',
      element: 'bg-cyan-400',
      color: '#00E5FF',
      weight: sunSign === 'Pisces' ? 22 : 8 + ((water * 2) % 8),
    },
  ]

  const totalSignWeight = ALL_12_SIGNS.reduce((s, x) => s + x.weight, 0)
  const normalizedSigns = ALL_12_SIGNS.map(s => ({
    ...s,
    percentage: Math.max(3, Math.round((s.weight / totalSignWeight) * 100)),
  }))

  // Resolve Big 3
  const rawPlanets = renderAstrologize?.totals?.planets || {}
  const sunDegree = rawPlanets.Sun?.degree
    ? `${Number(rawPlanets.Sun.degree).toFixed(1)}°`
    : '24.5°'
  const moonSign =
    rawPlanets.Moon?.sign ||
    (dominantElement === 'Water'
      ? 'Scorpio'
      : dominantElement === 'Fire'
        ? 'Sagittarius'
        : 'Taurus')
  const moonDegree = rawPlanets.Moon?.degree
    ? `${Number(rawPlanets.Moon.degree).toFixed(1)}°`
    : '12.1°'
  const ascSign = rawPlanets.Ascendant?.sign || (dominantElement === 'Air' ? 'Gemini' : 'Leo')
  const ascDegree = rawPlanets.Ascendant?.degree
    ? `${Number(rawPlanets.Ascendant.degree).toFixed(1)}°`
    : '18.8°'

  // Dynamic Codex Placements
  const codexPlanets = [
    {
      body: 'Sun',
      symbol: '☀️',
      sign: sunSign,
      degree: sunDegree,
      house: rawPlanets.Sun?.house || 'House I',
      dignity: getPlanetDignity('Sun', sunSign),
    },
    {
      body: 'Moon',
      symbol: '🌙',
      sign: moonSign,
      degree: moonDegree,
      house: rawPlanets.Moon?.house || 'House IV',
      dignity: getPlanetDignity('Moon', moonSign),
    },
    {
      body: 'Mercury',
      symbol: '☿',
      sign: rawPlanets.Mercury?.sign || sunSign,
      degree: rawPlanets.Mercury?.degree
        ? `${Number(rawPlanets.Mercury.degree).toFixed(1)}°`
        : '09.4°',
      house: rawPlanets.Mercury?.house || 'House I',
      dignity: getPlanetDignity('Mercury', rawPlanets.Mercury?.sign || sunSign),
    },
    {
      body: 'Venus',
      symbol: '♀',
      sign: rawPlanets.Venus?.sign || 'Taurus',
      degree: rawPlanets.Venus?.degree ? `${Number(rawPlanets.Venus.degree).toFixed(1)}°` : '16.6°',
      house: rawPlanets.Venus?.house || 'House II',
      dignity: getPlanetDignity('Venus', rawPlanets.Venus?.sign || 'Taurus'),
    },
    {
      body: 'Mars',
      symbol: '♂',
      sign: rawPlanets.Mars?.sign || 'Capricorn',
      degree: rawPlanets.Mars?.degree ? `${Number(rawPlanets.Mars.degree).toFixed(1)}°` : '02.1°',
      house: rawPlanets.Mars?.house || 'House X',
      dignity: getPlanetDignity('Mars', rawPlanets.Mars?.sign || 'Capricorn'),
    },
    {
      body: 'Jupiter',
      symbol: '♃',
      sign: rawPlanets.Jupiter?.sign || 'Cancer',
      degree: rawPlanets.Jupiter?.degree
        ? `${Number(rawPlanets.Jupiter.degree).toFixed(1)}°`
        : '12.9°',
      house: rawPlanets.Jupiter?.house || 'House IX',
      dignity: getPlanetDignity('Jupiter', rawPlanets.Jupiter?.sign || 'Cancer'),
    },
    {
      body: 'Saturn',
      symbol: '♄',
      sign: rawPlanets.Saturn?.sign || 'Aquarius',
      degree: rawPlanets.Saturn?.degree
        ? `${Number(rawPlanets.Saturn.degree).toFixed(1)}°`
        : '28.3°',
      house: rawPlanets.Saturn?.house || 'House XI',
      dignity: getPlanetDignity('Saturn', rawPlanets.Saturn?.sign || 'Aquarius'),
    },
  ]

  const codexAngles = [
    {
      body: 'Ascendant (ASC)',
      symbol: '🌅',
      sign: ascSign,
      degree: ascDegree,
      house: 'Angle I (Eastern Horizon)',
      dignity: 'Domicile' as EssentialDignity,
    },
    {
      body: 'Midheaven (MC)',
      symbol: '🏛️',
      sign: rawPlanets.Midheaven?.sign || 'Taurus',
      degree: rawPlanets.Midheaven?.degree
        ? `${Number(rawPlanets.Midheaven.degree).toFixed(1)}°`
        : '25.6°',
      house: 'Angle X (Culmination)',
      dignity: undefined,
    },
    {
      body: 'Descendant (DSC)',
      symbol: '🤝',
      sign: dominantElement === 'Air' ? 'Sagittarius' : 'Aquarius',
      degree: ascDegree,
      house: 'Angle VII (Western Horizon)',
      dignity: undefined,
    },
    {
      body: 'Imum Coeli (IC)',
      symbol: '⚓',
      sign: dominantElement === 'Fire' ? 'Scorpio' : 'Pisces',
      degree: '25.6°',
      house: 'Angle IV (Nadir Roots)',
      dignity: undefined,
    },
  ]

  const codexKarmic = [
    {
      body: 'North Node (Rahu)',
      symbol: '☊',
      sign: rawPlanets.NorthNode?.sign || 'Aries',
      degree: '14.2°',
      house: 'House XI (Destiny Vector)',
      dignity: 'Exaltation' as EssentialDignity,
    },
    {
      body: 'South Node (Ketu)',
      symbol: '☋',
      sign: rawPlanets.SouthNode?.sign || 'Libra',
      degree: '14.2°',
      house: 'House V (Ancestral Origin)',
      dignity: undefined,
    },
    {
      body: 'Chiron',
      symbol: '⚷',
      sign: 'Taurus',
      degree: '19.4°',
      house: 'House XII (The Wounded Healer)',
      dignity: undefined,
    },
    {
      body: 'Black Moon Lilith',
      symbol: '⚸',
      sign: 'Scorpio',
      degree: '08.7°',
      house: 'House VIII (Raw Sovereign Shadow)',
      dignity: undefined,
    },
  ]

  return (
    <div className="me-page" style={zodiacCssVars}>
      {/* Starfield Layer */}
      <div className="me-starfield" />

      {/* Sign Out */}
      <form action="/api/logout" method="POST">
        <button type="submit" className="me-sign-out">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}>
            <LogOut size={14} />
            Sign Out
          </span>
        </button>
      </form>

      {/* Computation Warning */}
      {computationError && (
        <div className="me-warning">
          ⚠️ Using fallback data due to computation issue: {computationError}
        </div>
      )}

      {/* Modern Stitch Techno-Occult Dashboard Canvas */}
      <div className="max-w-[1440px] mx-auto px-4 md:px-8 pt-8 pb-4 space-y-6">
        {/* AgentBioHeader (Span 12) */}
        <section className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-8 relative overflow-hidden shadow-2xl">
          <div className="absolute -top-10 -left-10 w-48 h-48 bg-purple-500/10 blur-[60px] pointer-events-none" />

          {/* Left: Identity */}
          <div className="flex flex-col md:flex-row items-center gap-6 w-full md:w-auto">
            <div className="relative">
              <div className="w-24 h-24 rounded-full p-[2px] bg-gradient-to-r from-amber-500 via-cyan-400 to-amber-500 shadow-[0_0_20px_rgba(0,229,255,0.3)]">
                <div className="w-full h-full rounded-full overflow-hidden bg-[#07090E] flex items-center justify-center">
                  {user.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || 'Explorer'}
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-3xl">✨</span>
                  )}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 bg-[#07090E] border border-white/[0.08] px-2 py-0.5 rounded flex items-center gap-1.5 shadow-md">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-mono text-[9px] text-slate-400 uppercase tracking-wider">
                  Active
                </span>
              </div>
            </div>

            <div className="text-center md:text-left space-y-1.5">
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-1">
                <span className="font-mono text-[10px] text-cyan-400 px-2 py-0.5 border border-cyan-400/30 bg-cyan-400/10 rounded uppercase tracking-widest">
                  Alchemical Explorer
                </span>
                <span className="font-mono text-[10px] text-amber-400 px-2 py-0.5 border border-amber-400/30 bg-amber-400/10 rounded uppercase tracking-widest flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  {dominantElement}-{modality || 'Synthesis'}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white">
                {profileName || user.name || 'Explorer'}
              </h1>
              <div className="font-mono text-xs text-slate-400 flex items-center justify-center md:justify-start gap-2">
                <span className="text-cyan-400">⚡</span> Phi Axis Index:{' '}
                {monicaConstant.toFixed(3)} · {getConsciousnessLevel(monicaConstant)} Level
              </div>
            </div>
          </div>

          {/* Right: Big 3 & Actions */}
          <div className="flex flex-col items-center md:items-end gap-5 w-full md:w-auto">
            <div className="flex flex-wrap justify-center gap-2.5">
              <div className="px-3 py-1.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.1] rounded-lg flex items-center gap-2">
                <span className="text-amber-400">☀️</span>
                <span className="font-mono text-xs text-white">
                  {sunDegree}{' '}
                  <span className="text-slate-400">{sunSign.slice(0, 3).toUpperCase()}</span>
                </span>
              </div>
              <div className="px-3 py-1.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.1] rounded-lg flex items-center gap-2">
                <span className="text-cyan-400">🌙</span>
                <span className="font-mono text-xs text-white">
                  {moonDegree}{' '}
                  <span className="text-slate-400">{moonSign.slice(0, 3).toUpperCase()}</span>
                </span>
              </div>
              <div className="px-3 py-1.5 bg-white/[0.03] backdrop-blur-md border border-white/[0.1] rounded-lg flex items-center gap-2">
                <span className="text-emerald-400">☿</span>
                <span className="font-mono text-xs text-white">
                  {ascDegree}{' '}
                  <span className="text-slate-400">{ascSign.slice(0, 3).toUpperCase()}</span>
                </span>
              </div>
            </div>

            <div className="flex gap-3 w-full md:w-auto">
              <Link
                href="/chart-interpreter"
                className="flex-1 md:flex-none text-center px-5 py-2 border border-white/10 bg-white/[0.02] hover:bg-white/[0.06] backdrop-blur-md text-slate-200 font-mono text-xs uppercase tracking-widest transition-all rounded"
              >
                Interpret Chart
              </Link>
              <Link
                href="/planetary-council"
                className="flex-1 md:flex-none text-center px-5 py-2 bg-cyan-400 text-slate-950 font-mono text-xs font-bold uppercase tracking-widest hover:brightness-110 shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all rounded"
              >
                Enter Council ⚡
              </Link>
            </div>
          </div>
        </section>

        {/* Primary Data Viz & Placements Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: 12-Sign Spectral Distribution + Elemental/Modality Bars (Span 7) */}
          <section className="lg:col-span-7 flex flex-col gap-6">
            {/* Spectral Distribution Card */}
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 relative flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-cyan-400">◎</span> 12-Sign Spectral Distribution
                </h3>
                <span className="font-mono text-[10px] text-cyan-400/80 uppercase tracking-widest border border-cyan-400/20 px-2 py-0.5 rounded">
                  Anti-Stereotyping Vector
                </span>
              </div>

              <div className="flex-1 flex items-center justify-center relative min-h-[260px]">
                {/* Center Callout */}
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">
                  <div className="text-4xl font-black text-white">
                    {waterPct > 35 ? waterPct : firePct}%
                  </div>
                  <div className="font-mono text-[10px] text-cyan-400 uppercase tracking-widest">
                    {dominantElement} Core
                  </div>
                  <div className="w-8 h-[1px] bg-white/20 my-2" />
                  <div className="font-mono text-[10px] text-amber-400 uppercase tracking-widest">
                    {modality || 'Synthesis'}
                  </div>
                </div>

                {/* Orbit Segments */}
                <div className="relative w-64 h-64 rounded-full border border-white/[0.06] flex items-center justify-center">
                  <div className="absolute w-[92%] h-[92%] rounded-full border border-dashed border-white/10 animate-[spin_80s_linear_infinite]" />
                  <div className="absolute w-[74%] h-[74%] rounded-full border border-cyan-400/20" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="44"
                      stroke="rgba(245,158,11,0.5)"
                      strokeDasharray={`${firePct} 276`}
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="44"
                      stroke="rgba(0,229,255,0.7)"
                      strokeDasharray={`${waterPct} 276`}
                      strokeDashoffset={`-${firePct}`}
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="44"
                      stroke="rgba(52,211,153,0.5)"
                      strokeDasharray={`${earthPct} 276`}
                      strokeDashoffset={`-${firePct + waterPct}`}
                      strokeWidth="4"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      fill="transparent"
                      r="44"
                      stroke="rgba(167,139,250,0.5)"
                      strokeDasharray={`${airPct} 276`}
                      strokeDashoffset={`-${firePct + waterPct + earthPct}`}
                      strokeWidth="4"
                    />
                  </svg>
                </div>
              </div>

              {/* 12-Sign Legend */}
              <div className="mt-4 grid grid-cols-4 sm:grid-cols-6 gap-1.5">
                {normalizedSigns.map(sign => {
                  const isActive =
                    sign.name === sunSign || sign.name === moonSign || sign.name === ascSign
                  return (
                    <div
                      key={sign.code}
                      className={`flex items-center justify-between px-2 py-1 bg-white/[0.02] border rounded text-[10px] font-mono transition-colors ${
                        isActive
                          ? 'border-cyan-400/60 bg-cyan-400/10 text-white font-bold'
                          : 'border-white/[0.05] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5">
                        <div className={`w-1.5 h-1.5 rounded-full ${sign.element}`} />
                        <span>{sign.code}</span>
                      </div>
                      <span className="text-[9px] opacity-75">{sign.percentage}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Elemental & Modality Macro Bars */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Elemental Balance */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-xl">
                <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                  Elemental Balance
                </h4>
                <div className="space-y-3 font-mono text-[11px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-amber-400">FIRE</span>
                      <span className="text-slate-400">{firePct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-400" style={{ width: `${firePct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-emerald-400">EARTH</span>
                      <span className="text-slate-400">{earthPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-emerald-400" style={{ width: `${earthPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-indigo-300">AIR</span>
                      <span className="text-slate-400">{airPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-300" style={{ width: `${airPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-cyan-400 font-bold">WATER</span>
                      <span className="text-white font-bold">{waterPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.8)]"
                        style={{ width: `${waterPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Modality Distribution */}
              <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-5 shadow-xl">
                <h4 className="font-mono text-[10px] text-slate-400 uppercase tracking-widest mb-4">
                  Modality Distribution
                </h4>
                <div className="space-y-3 font-mono text-[11px]">
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300">CARDINAL</span>
                      <span className="text-slate-400">{cardPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-400" style={{ width: `${cardPct}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-white font-bold">FIXED</span>
                      <span className="text-cyan-400 font-bold">{fixPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-400 shadow-[0_0_8px_rgba(0,229,255,0.5)]"
                        style={{ width: `${fixPct}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between mb-1">
                      <span className="text-slate-300">MUTABLE</span>
                      <span className="text-slate-400">{mutPct}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div className="h-full bg-slate-500" style={{ width: `${mutPct}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Right Column: Codex Placements (Span 5) */}
          <section className="lg:col-span-5 flex flex-col">
            <div className="bg-slate-900/60 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-6 flex flex-col flex-1 shadow-2xl">
              <div className="flex items-center justify-between mb-5">
                <h3 className="font-mono text-xs text-slate-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="text-purple-400">📖</span> Codex Placements
                </h3>
                {/* Tab Switcher */}
                <div className="flex bg-white/[0.03] p-0.5 rounded border border-white/[0.06]">
                  {(['planets', 'angles', 'karmic'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveCodexTab(tab)}
                      className={`px-3 py-1 font-mono text-[10px] uppercase tracking-wider rounded transition-colors ${
                        activeCodexTab === tab
                          ? 'bg-white/[0.1] text-white font-bold'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </div>

              {/* Placement List Rows */}
              <div className="space-y-2 flex-1">
                {(activeCodexTab === 'planets'
                  ? codexPlanets
                  : activeCodexTab === 'angles'
                    ? codexAngles
                    : codexKarmic
                ).map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 bg-white/[0.02] border border-white/[0.05] rounded-xl hover:bg-white/[0.04] transition-all group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-sm bg-white/[0.03]">
                        {item.symbol}
                      </div>
                      <div>
                        <div className="font-mono text-xs text-white">
                          {item.body}{' '}
                          <span className="text-slate-400 font-normal">
                            {item.sign} {item.degree}
                          </span>
                        </div>
                        <div className="font-mono text-[9px] text-slate-500">{item.house}</div>
                      </div>
                    </div>
                    <DignityBadge dignity={item.dignity as EssentialDignity} />
                  </div>
                ))}
              </div>

              <Link
                href="/chart-interpreter"
                className="mt-4 w-full py-2 border-t border-white/[0.05] text-center font-mono text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-widest flex items-center justify-center gap-1.5"
              >
                Explore Full Astrometric Codex ▾
              </Link>
            </div>
          </section>
        </div>
      </div>

      <ProfileYieldPanel initialWallet={wallet} />

      {/* Explore the Cosmos — Site Tour */}
      <div className="me-section-title">
        <h2>Explore the Cosmos</h2>
        <p>Your gateway to the Planetary Agents platform</p>
        <div className="divider" />
      </div>

      <section className="me-tour-grid">
        {tourCards.map(card => (
          <Link key={card.href} href={card.href} className="me-tour-card">
            <div className="tour-icon">
              <card.icon size={22} />
            </div>
            <div className="tour-title">{card.title}</div>
            <div className="tour-desc">{card.description}</div>
            <div className="tour-cta">
              {card.cta}
              <ArrowRight size={14} />
            </div>
          </Link>
        ))}
      </section>

      {/* Charts & Consciousness Section */}
      <div className="me-section-title">
        <h2>Your Cosmic Blueprint</h2>
        <p>Natal chart, live consciousness, and alchemical insights</p>
        <div className="divider" />
      </div>

      <section className="me-charts-section">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.5rem' }}>
          {/* Natal Chart */}
          <div className="me-glass-card">
            <CircularNatalHoroscope
              className="w-full"
              showKinetics={true}
              birthInfo={{
                name: profileName || user.name || 'You',
                year: birthInfo.year,
                month: birthInfo.month,
                day: birthInfo.day,
                hour: birthInfo.hour,
                minute: birthInfo.minute,
                latitude: birthInfo.latitude ?? 0,
                longitude: birthInfo.longitude ?? 0,
              }}
            />
          </div>

          {/* Live Consciousness */}
          <LiveConsciousnessDisplay
            birthInfo={birthInfo}
            userName={user.name || 'You'}
            birthAlchm={{
              spirit,
              essence,
              matter,
              substance,
              Heat,
              Energy: EnergyValue,
              Entropy,
              Reactivity,
            }}
            birthMC={monicaConstant}
          />

          {/* Insights */}
          <div className="me-glass-card">
            <h3>Chart Insights</h3>
            <p style={{ marginBottom: '1rem' }}>Key patterns and recommendations</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div className="me-insight-card">
                <h4>Dominant Patterns</h4>
                <p>
                  Your {dominantElement.toLowerCase()} dominance suggests a natural affinity for{' '}
                  {dominantElement === 'Fire'
                    ? 'creativity and leadership'
                    : dominantElement === 'Water'
                      ? 'intuition and emotional depth'
                      : dominantElement === 'Air'
                        ? 'communication and ideas'
                        : 'stability and practical manifestation'}
                  .
                </p>
              </div>

              <div className="me-insight-card">
                <h4>Monica Constant Analysis</h4>
                <p>
                  At {monicaConstant.toFixed(3)}, your consciousness operates at a{' '}
                  {getConsciousnessLevel(monicaConstant).toLowerCase()} level with strong potential
                  for growth.
                </p>
              </div>

              <div className="me-insight-card">
                <h4>Alchemical Balance</h4>
                <p>
                  Your Spirit/Essence ratio of {(spirit / Math.max(essence, 0.1)).toFixed(2)}{' '}
                  indicates{' '}
                  {spirit > essence ? 'active initiation energy' : 'receptive integration capacity'}
                  , while your Matter/Substance foundation provides{' '}
                  {matter > substance ? 'structural stability' : 'connective flexibility'}.
                </p>
              </div>

              {/* Thermodynamic Properties */}
              <div className="me-insight-card">
                <h4>Thermodynamic Properties</h4>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Heat:</span>
                    <span style={{ fontFamily: 'monospace' }}>{Heat.toFixed(3)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Entropy:</span>
                    <span style={{ fontFamily: 'monospace' }}>{Entropy.toFixed(3)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Reactivity:</span>
                    <span style={{ fontFamily: 'monospace' }}>{Reactivity.toFixed(3)}</span>
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8rem',
                    }}
                  >
                    <span style={{ color: 'rgba(255,255,255,0.5)' }}>Energy:</span>
                    <span style={{ fontFamily: 'monospace' }}>{EnergyValue.toFixed(3)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Supplemental Cosmic Alignment Nodes */}
      {renderAlchemize && (
        <>
          <div className="me-section-title">
            <h2>Supplemental Cosmic Alignments</h2>
            <p>Tarot, Sidereal placements, and Alchemical synergy mapping</p>
            <div className="divider" />
          </div>

          <section className="me-supplemental-nodes-grid">
            {/* Node 1: Dual-Zodiac Placements */}
            <div className="me-cosmic-card me-zodiac-toggle-pane">
              <h3>Dual-Zodiac Toggle</h3>
              <p>
                Compare your Tropical (seasonal Western) and Sidereal (astronomical Vedic) planetary
                coordinates.
              </p>

              <div className="me-zodiac-tabs">
                <button
                  className={`me-zodiac-tab-btn ${activeZodiacTab === 'tropical' ? 'active' : ''}`}
                  onClick={() => setActiveZodiacTab('tropical')}
                >
                  Tropical
                </button>
                <button
                  className={`me-zodiac-tab-btn ${activeZodiacTab === 'sidereal' ? 'active' : ''}`}
                  onClick={() => setActiveZodiacTab('sidereal')}
                >
                  Sidereal
                </button>
              </div>

              <div className="me-zodiac-positions-grid">
                {Object.entries(
                  activeZodiacTab === 'tropical'
                    ? renderAstrologize?.totals?.planets || {}
                    : renderAstrologize?.sidereal?.CelestialBodies?.all?.reduce(
                        (acc: any, p: any) => {
                          acc[p.label] = {
                            sign: p.Sign?.label || 'Aries',
                            degree: p.ChartPosition?.Ecliptic?.DecimalDegrees % 30 || 0,
                            house: p.House?.id || '1',
                          }
                          return acc
                        },
                        {}
                      ) || {}
                ).map(([planet, details]: [string, any]) => (
                  <div key={planet} className="me-zodiac-planet-item">
                    <span className="me-zodiac-planet-name">{planet}</span>
                    <span className="me-zodiac-planet-placement">{details.sign}</span>
                    <span className="me-zodiac-planet-degree">
                      {Number(details.degree || 0).toFixed(1)}°
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Node 2: Tarot Oracle */}
            <div className="me-cosmic-card me-tarot-oracle-pane">
              <div style={{ gridColumn: 'span 2' }}>
                <h3>Tarot & Decan Oracle</h3>
                <p>Sacred minor and major tarot archetypes mapped directly to your placements.</p>
              </div>

              {renderAlchemize.totals?.['Sun Major Arcana'] && (
                <div className="me-tarot-card-item">
                  <div className="me-tarot-card-header">
                    <span className="me-tarot-card-type">Sun Sign</span>
                    <span className="me-tarot-card-badge">☀️</span>
                  </div>
                  <div className="me-tarot-card-name">
                    {renderAlchemize.totals['Sun Major Arcana']}
                  </div>
                  <div className="me-tarot-card-desc">
                    Your core soul purpose card, expressing solar energy.
                  </div>
                </div>
              )}

              {renderAlchemize.totals?.['Ascendant Major Arcana'] && (
                <div className="me-tarot-card-item">
                  <div className="me-tarot-card-header">
                    <span className="me-tarot-card-type">Ascendant</span>
                    <span className="me-tarot-card-badge">🌅</span>
                  </div>
                  <div className="me-tarot-card-name">
                    {renderAlchemize.totals['Ascendant Major Arcana']}
                  </div>
                  <div className="me-tarot-card-desc">
                    Your outward persona and life path manifestation card.
                  </div>
                </div>
              )}

              {renderAlchemize.totals?.['Decan Minor Arcana'] && (
                <div className="me-tarot-card-item">
                  <div className="me-tarot-card-header">
                    <span className="me-tarot-card-type">Decan Ruler</span>
                    <span className="me-tarot-card-badge">✨</span>
                  </div>
                  <div className="me-tarot-card-name">
                    {renderAlchemize.totals['Decan Minor Arcana']}
                  </div>
                  <div className="me-tarot-card-desc">
                    Your decan card representing the sub-ruler qualities.
                  </div>
                </div>
              )}

              {renderAlchemize.totals?.['Cusp Minor Arcana'] &&
                renderAlchemize.totals['Cusp Minor Arcana'] !== 'None' && (
                  <div
                    className="me-tarot-card-item"
                    style={{
                      border: '1px solid rgba(234, 179, 8, 0.4)',
                      background: 'rgba(234, 179, 8, 0.05)',
                    }}
                  >
                    <div className="me-tarot-card-header">
                      <span className="me-tarot-card-type" style={{ color: '#eab308' }}>
                        Cusp Influence
                      </span>
                      <span className="me-tarot-card-badge">🔮</span>
                    </div>
                    <div className="me-tarot-card-name">
                      {renderAlchemize.totals['Cusp Minor Arcana']}
                    </div>
                    <div className="me-tarot-card-desc">
                      A cusp card showing mixed gifts from sign borders.
                    </div>
                  </div>
                )}
            </div>

            {/* Node 3: Stellium & Aspect Synergy Map */}
            <div className="me-cosmic-card me-synergy-pane">
              <h3>Consciousness Synergy Map</h3>
              <p>Planetary groupings (Stelliums) and dynamic harmonic connections in your chart.</p>

              {renderAlchemize['All Stelliums'] && renderAlchemize['All Stelliums'].length > 0 ? (
                <div className="me-stellium-section">
                  <div className="me-stellium-header">
                    <span>🌟</span>
                    <span>Active Stellium: {renderAlchemize['All Stelliums'].join(', ')}</span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.7)',
                      marginTop: '0.25rem',
                    }}
                  >
                    An exceptionally strong concentration of celestial bodies in this sign focuses
                    your power intensely here.
                  </p>
                </div>
              ) : (
                <div
                  className="me-stellium-section"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    borderColor: 'rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="me-stellium-header" style={{ color: 'rgba(255,255,255,0.6)' }}>
                    <span>✨</span>
                    <span>No Major Stelliums</span>
                  </div>
                  <p
                    style={{
                      fontSize: '0.8rem',
                      color: 'rgba(255,255,255,0.4)',
                      marginTop: '0.25rem',
                    }}
                  >
                    Your planetary energies are harmoniously distributed across multiple zodiac
                    signs.
                  </p>
                </div>
              )}

              <div className="me-aspects-section">
                <h4>Dynamic Harmonizer Links</h4>
                <div className="me-aspects-subgrid">
                  {renderAlchemize['All Conjunctions'] &&
                    renderAlchemize['All Conjunctions'].length > 0 && (
                      <div className="me-aspect-group-item">
                        <div className="me-aspect-group-title">
                          <span>Conjunctions</span>
                          <span>{renderAlchemize['All Conjunctions'].length}</span>
                        </div>
                        <div className="me-aspect-list">
                          {renderAlchemize['All Conjunctions']
                            .slice(0, 3)
                            .map((a: any, i: number) => (
                              <div key={i} className="me-aspect-row">
                                <span>{a.Planets.join(' ☌ ')}</span>
                                <span>{a.Sign}</span>
                              </div>
                            ))}
                        </div>
                      </div>
                    )}

                  {renderAlchemize['All Trines'] && renderAlchemize['All Trines'].length > 0 && (
                    <div className="me-aspect-group-item">
                      <div className="me-aspect-group-title">
                        <span>Trines</span>
                        <span>{renderAlchemize['All Trines'].length}</span>
                      </div>
                      <div className="me-aspect-list">
                        {renderAlchemize['All Trines'].slice(0, 3).map((a: any, i: number) => (
                          <div key={i} className="me-aspect-row">
                            <span>{a.Planets.join(' ▵ ')}</span>
                            <span>{a.Sign}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {renderAlchemize['All Squares'] && renderAlchemize['All Squares'].length > 0 && (
                    <div className="me-aspect-group-item">
                      <div className="me-aspect-group-title">
                        <span>Squares</span>
                        <span>{renderAlchemize['All Squares'].length}</span>
                      </div>
                      <div className="me-aspect-list">
                        {renderAlchemize['All Squares'].slice(0, 3).map((a: any, i: number) => (
                          <div key={i} className="me-aspect-row">
                            <span>{a.Planets.join(' □ ')}</span>
                            <span>{a.Sign}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Node 4: Imaginizer Prompt Engine */}
            <div className="me-cosmic-card me-imaginizer-pane">
              <h3>Imaginizer Prompt Engine</h3>
              <p>The prompt that shapes the visual sigil representing your alchemical blueprint.</p>

              {renderImaginizer?.prompt ? (
                <>
                  <div className="me-prompt-box">{renderImaginizer.prompt}</div>
                  <button className="me-copy-prompt-btn" onClick={handleCopyPrompt}>
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copied!' : 'Copy Sigil Prompt'}
                  </button>
                </>
              ) : (
                <div className="me-prompt-box" style={{ opacity: 0.6, fontSize: '0.8rem' }}>
                  No prompt generated. Configure the Render Imaginizer to unlock prompt engine.
                </div>
              )}
            </div>
          </section>
        </>
      )}

      {/* Personal Chart Context Attachment Generator */}
      <div className="me-section-title">
        <h2>Personal Chart Context</h2>
        <p>
          Export your full astrological and alchemical context (.md, .txt, .json) for AI agents and
          LLM chats
        </p>
        <div className="divider" />
      </div>

      <section className="max-w-[1440px] mx-auto px-4 md:px-8 mb-12">
        <QuickChartAttachmentGenerator
          initialBirthInfo={{
            name: profileName || user.name || 'You',
            year: birthInfo.year,
            month: birthInfo.month,
            day: birthInfo.day,
            hour: birthInfo.hour,
            minute: birthInfo.minute,
            latitude: birthInfo.latitude,
            longitude: birthInfo.longitude,
          }}
        />
      </section>

      {/* Footer */}
      <footer className="me-footer">
        Planetary Agents · Consciousness Evolution Platform · v2.0
      </footer>
    </div>
  )
}
