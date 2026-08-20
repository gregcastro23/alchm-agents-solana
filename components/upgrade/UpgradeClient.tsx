'use client'

import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import dynamic from 'next/dynamic'
import {
  Sparkles,
  Crown,
  Zap,
  Gem,
  ArrowRight,
  Check,
  AlertCircle,
  Coins,
  ShieldCheck,
  TrendingUp,
  Wallet,
} from 'lucide-react'
import { DAILY_ESMS_YIELD, PREMIUM_MULTIPLIER } from '@/lib/economy-config'

// Privy's SDK is a ~1.4MB client chunk — load it only when this panel
// actually renders, never in the route's first-load bundle.
const PrivyConnect = dynamic(
  () => import('@/components/account/PrivyConnect').then(m => m.PrivyConnect),
  {
    ssr: false,
    loading: () => (
      <div className="text-sm text-muted-foreground animate-pulse">Loading identity panel…</div>
    ),
  }
)

type Props = {
  tier: 'free' | 'alchemist' | 'master'
  hasActiveSub: boolean
  premiumViaKitchen: boolean
  email: string | null
  name: string | null
}

const PREMIUM_FEATURES = [
  {
    title: 'Double Daily ESMS Yield',
    desc: `Receive double daily ESMS tokens (${DAILY_ESMS_YIELD * PREMIUM_MULTIPLIER}/day total instead of ${DAILY_ESMS_YIELD}) to fuel alchemical actions.`,
    icon: Zap,
  },
  {
    title: 'Premium AI Brains',
    desc: 'Access advanced model classes including Claude 3.5 Sonnet, Claude 3 Opus, and GPT-5.x.',
    icon: Sparkles,
  },
  {
    title: 'Priority Evolution',
    desc: 'Elevated priority and higher quality response windows for deep, complex agentic reasoning.',
    icon: TrendingUp,
  },
  {
    title: 'Unlimited Custom Agents',
    desc: 'Birth and train custom agents at the rune forge with specialized traits and infinite evolution.',
    icon: Crown,
  },
]

const TOKEN_PACKAGES = [
  {
    tier: '5' as const,
    name: 'Initiate Box',
    tokens: 100,
    price: '$5',
    bonus: null,
    icon: Sparkles,
    glow: 'border-yellow-500/20 shadow-[0_0_20px_rgba(250,204,21,0.05)] hover:border-yellow-400/40',
    badge: 'bg-yellow-500/10 text-yellow-300 border-yellow-500/20',
  },
  {
    tier: '10' as const,
    name: 'Adept Sphere',
    tokens: 240,
    price: '$10',
    bonus: '20% Bonus',
    icon: Zap,
    glow: 'border-blue-500/25 shadow-[0_0_20px_rgba(96,165,250,0.05)] hover:border-blue-400/40',
    badge: 'bg-blue-500/10 text-blue-300 border-blue-500/20',
  },
  {
    tier: '25' as const,
    name: 'Alchemist Chest',
    tokens: 700,
    price: '$25',
    bonus: '40% Bonus',
    icon: Crown,
    glow: 'border-purple-500/30 shadow-[0_0_25px_rgba(139,92,246,0.1)] hover:border-purple-400/50',
    badge: 'bg-purple-500/10 text-purple-300 border-purple-500/20',
  },
  {
    tier: '50' as const,
    name: 'Philosopher Vault',
    tokens: 1600,
    price: '$50',
    bonus: '60% Bonus',
    icon: Gem,
    glow: 'border-fuchsia-500/40 shadow-[0_0_30px_rgba(217,70,239,0.15)] hover:border-fuchsia-400/60',
    badge: 'bg-fuchsia-500/10 text-fuchsia-300 border-fuchsia-500/25',
  },
]

function UpgradeClientContent({ tier, hasActiveSub, premiumViaKitchen, email, name }: Props) {
  const searchParams = useSearchParams()
  const purchaseStatus = searchParams.get('purchase')
  const tokensPurchased = searchParams.get('tokens')

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function buyTokens(tier: '5' | '10' | '25' | '50') {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      if (res.status === 401) {
        window.location.href = '/auth/signin?callbackUrl=/upgrade'
        return
      }
      if (!res.ok) {
        const errData = await res.json()
        throw new Error(errData.error || 'Failed to start token purchase checkout')
      }
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned from server')
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An error occurred during token checkout setup')
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen text-white relative py-12 px-4 md:px-8">
      {/* Background radial overlays */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-nebula opacity-70" />

      <div className="relative z-10 max-w-6xl mx-auto space-y-10">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-300">
            <Coins size={14} />
            <span>ESMS Token Store</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent">
            ESMS Token Store & Treasury
          </h1>
          <p className="text-indigo-200/60 max-w-2xl mx-auto text-sm md:text-base">
            Fuel your alchemical journey. Acquire Cosmic Tokens, claim daily ESMS yield, and spend
            tokens across Planetary Agents and the alchm.kitchen network.
          </p>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/20 bg-purple-500/5 text-xs text-purple-300">
            <ShieldCheck size={14} />
            <span>Authenticated Account: {name || email}</span>
          </div>
        </div>

        {/* Status Messages */}
        {purchaseStatus === 'success' && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-300 flex items-start gap-3 max-w-3xl mx-auto">
            <Check className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm md:text-base">Tokens Acquired!</h4>
              <p className="text-xs md:text-sm text-emerald-300/80 mt-0.5">
                Successfully acquired {tokensPurchased || 'your'} Cosmic ESMS tokens. Your off-chain
                balance has been updated and synchronized with your kitchen wallet.
              </p>
            </div>
          </div>
        )}

        {purchaseStatus === 'cancelled' && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-white/70 flex items-start gap-3 max-w-3xl mx-auto">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm md:text-base">Purchase Cancelled</h4>
              <p className="text-xs md:text-sm text-white/50 mt-0.5">
                Your token purchase checkout session was cancelled. No charges were made.
              </p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-red-400 flex items-start gap-3 max-w-3xl mx-auto">
            <AlertCircle className="h-5 w-5 mt-0.5 shrink-0" />
            <div>
              <h4 className="font-semibold text-sm md:text-base">System Alert</h4>
              <p className="text-xs md:text-sm text-red-400/80 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {/* Upgrade Dashboard Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Treasury & Yield Overview Card */}
          <div className="relative rounded-2xl border border-amber-400/30 bg-gradient-to-b from-amber-950/20 via-background to-background p-6 md:p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(245,158,11,0.1)] lg:col-span-1">
            <div className="absolute top-4 right-4 px-2.5 py-0.5 rounded-full bg-amber-500/90 text-zinc-950 text-[10px] uppercase font-bold tracking-wider">
              Treasury
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="text-2xl font-bold font-serif tracking-wide text-amber-200">
                  ESMS Treasury
                </h3>
                <p className="text-xs text-amber-300/50 mt-1">4-Element Token Account</p>
              </div>

              <div className="p-4 rounded-xl bg-black/40 border border-amber-500/20 space-y-2">
                <div className="text-xs text-zinc-400">Daily Cosmic Yield</div>
                <div className="text-2xl font-bold text-amber-300 flex items-center gap-2">
                  <Sparkles size={20} className="text-amber-400" />
                  <span>+{DAILY_ESMS_YIELD} ESMS / day</span>
                </div>
                <p className="text-[11px] text-zinc-400">
                  Claim every 24h on the Treasury Dashboard to build streak multipliers.
                </p>
              </div>

              <hr className="border-amber-500/20" />

              <ul className="space-y-4">
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Zap size={12} className="text-amber-300" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-100">Spend at the Bazaar</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Burn ESMS tokens to acquire agent elixirs, retrograde stabilizers, and
                      consciousness boosts.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Crown size={12} className="text-amber-300" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-100">Sigil & Vessel Forging</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Forge permanent cosmetics and unlock advanced synastry pairing slots for star
                      vessels.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <div className="w-5 h-5 rounded-full bg-amber-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <TrendingUp size={12} className="text-amber-300" />
                  </div>
                  <div>
                    <h5 className="text-xs font-semibold text-zinc-100">Enhanced AI Infusions</h5>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-relaxed">
                      Power deep reasoning models or connect your own direct BYOK provider keys in
                      settings.
                    </p>
                  </div>
                </li>
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-amber-500/15 space-y-3">
              <a href="/economy" className="block">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-zinc-950 font-bold text-xs h-10 shadow-md">
                  Open Treasury Dashboard <ArrowRight size={14} className="ml-1.5" />
                </Button>
              </a>
              <a href="/shop" className="block">
                <Button
                  variant="outline"
                  className="w-full bg-white/5 border-amber-500/20 text-amber-200 hover:bg-white/10 text-xs h-10"
                >
                  Visit ESMS Bazaar (/shop)
                </Button>
              </a>
            </div>
          </div>

          {/* Token Purchase Column */}
          <div className="lg:col-span-2 space-y-6 flex flex-col justify-between">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-300">
                  <Coins size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif text-amber-200">
                    Cosmic Token Packages
                  </h3>
                  <p className="text-xs text-zinc-400">
                    One-time direct acquisition · Splits equally across Spirit, Essence, Matter,
                    Substance
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {TOKEN_PACKAGES.map(pkg => {
                  const Icon = pkg.icon
                  return (
                    <div
                      key={pkg.name}
                      className={`relative rounded-xl border p-5 flex flex-col justify-between bg-black/20 hover:bg-white/[0.02] transition-all shadow-md group ${pkg.glow}`}
                    >
                      {pkg.bonus && (
                        <span
                          className={`absolute top-3 right-3 px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-wider ${pkg.badge}`}
                        >
                          {pkg.bonus}
                        </span>
                      )}

                      <div className="space-y-3">
                        <div className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                          <Icon size={14} className="text-amber-300" />
                        </div>

                        <div>
                          <h4 className="text-sm font-bold text-white font-serif">{pkg.name}</h4>
                          <div className="mt-1 flex items-baseline gap-1.5">
                            <span className="text-2xl font-extrabold text-amber-200">
                              {pkg.tokens}
                            </span>
                            <span className="text-xs text-amber-300/60 font-mono uppercase">
                              ESMS Tokens
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                            Grants {pkg.tokens / 4} each of Spirit, Essence, Matter, and Substance.
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between gap-4">
                        <span className="text-sm font-bold text-white/90">{pkg.price}</span>
                        <Button
                          size="sm"
                          className="bg-amber-600 hover:bg-amber-500 text-zinc-950 font-semibold text-[10px] h-8 shadow-sm"
                          disabled={busy}
                          onClick={() => buyTokens(pkg.tier)}
                        >
                          Acquire Tokens
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Privy Cross-Site Identity / EVM Wallet Area */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 md:p-8 space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-300">
                  <Wallet size={20} />
                </div>
                <div>
                  <h3 className="text-xl font-bold font-serif text-emerald-200">
                    Cross-Site Identity & Wallet
                  </h3>
                  <p className="text-xs text-zinc-400">
                    Link your Privy EVM wallet (Base) for unified cross-site tokens and fiat on-ramp
                    funding
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-white/5 bg-black/25 p-5">
                <p className="text-xs text-zinc-300 mb-4 leading-relaxed">
                  Link a portable Alchm identity (via Privy) to unify your credentials and token
                  wallets across both Planetary Agents and alchm.kitchen.
                </p>
                <PrivyConnect />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function UpgradeClient(props: Props) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#11091e] text-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <UpgradeClientContent {...props} />
    </Suspense>
  )
}
