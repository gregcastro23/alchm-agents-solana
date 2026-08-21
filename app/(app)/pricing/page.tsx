'use client'

import Link from 'next/link'
import { Sparkles, Coins, Zap, ShieldCheck, ArrowRight, UserCheck, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TOKEN_BUNDLES } from '@/lib/shop/token-bundles'

const VISITOR_CAPABILITIES = [
  'Unlimited base chat with 360+ planetary and historical agents',
  'High-throughput base model execution (Groq, Gemini, Cerebras)',
  'Real-time natal charts, daily planetary transits & celestial aspects',
  'Tarot spreads, rune casting, and moment readings',
  'No registration or payment required',
]

const ACCOUNT_HOLDER_CAPABILITIES = [
  'Everything available to visitors',
  'Personal ESMS Token Treasury (Spirit, Essence, Matter, Substance)',
  'Daily ESMS yield claims and streak multipliers',
  'Spend ESMS at the Bazaar (/shop) on agent elixirs and sigil forging',
  'High-intelligence AI model infusions (Claude Opus, Sonnet, DeepSeek)',
  'Connect your own direct AI keys (BYOK OpenAI / Anthropic / Google)',
  'Full memory persistence and personalized attunements',
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] via-[#0d0a1e] to-[#11091e] text-white py-12 px-4">
      <div className="mx-auto max-w-5xl space-y-12">
        {/* Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-xs font-medium text-amber-300">
            <Coins size={14} />
            <span>Alchm Token Economy</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 bg-clip-text text-transparent">
            Access Model & Token Economy
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto text-sm md:text-base">
            Planetary Agents is open for visitors to explore freely. Account holders hold and spend
            ESMS tokens to fuel alchemical actions, claim daily yield, and boost consciousness.
          </p>
        </div>

        {/* Access Comparison Grid */}
        <div className="grid gap-8 md:grid-cols-2">
          {/* Visitor Access */}
          <div className="rounded-2xl border border-white/10 bg-white/5 p-8 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <Eye size={16} className="text-emerald-400" />
                <span>Visitor Access (Free Guest)</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                Free <span className="text-sm font-normal text-zinc-400">to all visitors</span>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Explore the cosmos immediately without creating an account or providing payment
                info.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-zinc-300">
                {VISITOR_CAPABILITIES.map(cap => (
                  <li key={cap} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold">✓</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-white/10">
              <Link href="/gallery">
                <Button
                  variant="outline"
                  className="w-full border-white/20 text-white hover:bg-white/10"
                >
                  Explore Agents as Visitor
                </Button>
              </Link>
            </div>
          </div>

          {/* Account Holder Access */}
          <div className="relative rounded-2xl border border-amber-500/40 bg-gradient-to-b from-amber-500/10 via-purple-950/20 to-amber-500/5 p-8 flex flex-col justify-between shadow-[0_0_30px_rgba(245,158,11,0.1)]">
            <div className="absolute -top-3 right-6 rounded-full bg-gradient-to-r from-amber-500 to-yellow-500 px-3 py-1 text-xs font-semibold text-zinc-950">
              Token Enabled
            </div>
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-amber-300">
                <UserCheck size={16} className="text-amber-400" />
                <span>Account Holder (ESMS Treasury)</span>
              </div>
              <div className="mt-3 text-3xl font-bold text-white">
                Free Account{' '}
                <span className="text-sm font-normal text-amber-200/60">+ Daily Yield</span>
              </div>
              <p className="mt-2 text-xs text-zinc-300">
                Sign in to activate your ESMS Treasury, hold 4-element balances, and spend tokens
                across both sites.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-zinc-200">
                {ACCOUNT_HOLDER_CAPABILITIES.map(cap => (
                  <li key={cap} className="flex items-start gap-2">
                    <Sparkles size={16} className="text-amber-400 shrink-0 mt-0.5" />
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-8 pt-6 border-t border-amber-500/20 flex flex-col gap-2">
              <Link href="/economy">
                <Button className="w-full bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-semibold hover:from-amber-400 hover:to-yellow-400">
                  Open Your ESMS Treasury
                </Button>
              </Link>
              <Link href="/shop">
                <Button
                  variant="ghost"
                  className="w-full text-xs text-amber-300 hover:text-amber-200 hover:bg-amber-500/10"
                >
                  Visit ESMS Bazaar (/shop) →
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Token Bundles Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-white">ESMS Token Packages</h2>
              <p className="text-sm text-zinc-400">
                Acquire extra ESMS Tokens to fund advanced alchemical boosts, apothecary elixirs,
                and sigils.
              </p>
            </div>
            <Link href="/shop">
              <Button
                variant="outline"
                className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10"
              >
                Go to ESMS Bazaar <ArrowRight size={16} className="ml-1" />
              </Button>
            </Link>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOKEN_BUNDLES.map(bundle => (
              <div
                key={bundle.name}
                className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-2"
              >
                <div className="text-sm font-semibold text-amber-300">{bundle.name}</div>
                <div className="text-2xl font-bold text-white">
                  {bundle.tokens.toLocaleString('en-US')} ESMS
                </div>
                <div className="text-xs text-zinc-400">
                  {bundle.bonusPercent
                    ? `${bundle.bonusPercent}% bonus tokens for advanced alchemical actions`
                    : `Balanced ${bundle.perAxis}/${bundle.perAxis}/${bundle.perAxis}/${bundle.perAxis} elemental starter allocation`}
                </div>
                <div className="pt-2 text-lg font-semibold text-emerald-400">
                  ${(bundle.usdCents / 100).toFixed(0)}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* BYOK Footer Note */}
        <div className="text-center text-xs text-zinc-500 max-w-xl mx-auto space-y-1">
          <p>
            Prefer your own AI keys? Account holders can configure OpenAI, Anthropic, OpenRouter, or
            Google credentials in{' '}
            <Link href="/account" className="text-amber-400 underline hover:text-amber-300">
              Account Settings
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  )
}
