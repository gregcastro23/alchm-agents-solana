'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ByokPanel } from './ByokPanel'
import { EsmsOnchain } from './EsmsOnchain'
import dynamic from 'next/dynamic'

// Privy's SDK is a ~1.4MB client chunk — load it only when this panel
// actually renders, never in the route's first-load bundle.
const PrivyConnect = dynamic(() => import('./PrivyConnect').then(m => m.PrivyConnect), {
  ssr: false,
  loading: () => (
    <div className="text-sm text-muted-foreground animate-pulse">Loading identity panel…</div>
  ),
})

type Props = {
  tier: 'free' | 'alchemist' | 'master'
  hasActiveSub: boolean
  premiumViaKitchen: boolean
  email: string | null
  name: string | null
}

export function AccountClient({ tier, hasActiveSub, premiumViaKitchen, email, name }: Props) {
  const [busy, setBusy] = useState(false)
  const isPremium = tier !== 'free'

  async function startCheckout(interval: 'monthly' | 'yearly') {
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ interval }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  async function openPortal() {
    setBusy(true)
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setBusy(false)
    } catch {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0a0a1a] to-[#11091e] text-white">
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="mt-1 text-sm text-white/50">{name || email}</p>

        {/* Account & Token Economy */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-amber-300/70">
                Account Status
              </div>
              <div className="text-lg font-semibold text-white">
                {tier === 'master' ? 'Administrator (Full Access)' : 'Active Account Holder'}
              </div>
            </div>
            <span className="rounded-full bg-amber-500/20 border border-amber-500/30 px-3 py-1 text-xs text-amber-300">
              {tier === 'master' ? 'Admin' : 'Token Enabled'}
            </span>
          </div>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-white/70">
              Your account is active and connected to the ESMS Token Economy. You can hold balances
              across Spirit, Essence, Matter, and Substance, claim daily cosmic yield, and spend
              tokens at the Bazaar.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-2">
              <Link href="/economy">
                <Button className="bg-gradient-to-r from-amber-500 to-yellow-500 text-zinc-950 font-semibold hover:from-amber-400 hover:to-yellow-400 text-xs">
                  ESMS Treasury (/economy)
                </Button>
              </Link>
              <Link href="/shop">
                <Button
                  variant="outline"
                  className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs"
                >
                  ESMS Bazaar (/shop)
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* BYOK */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Connect your own AI keys</h2>
          <p className="mt-1 text-sm text-white/60">
            Bring your own OpenAI, Anthropic, or Google API keys to run custom models directly on
            your account, or power alchemical actions via your ESMS token balance.
          </p>
          <div className="mt-4">
            <ByokPanel />
          </div>
        </section>

        {/* Cross-site identity (Privy) */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Cross-site identity</h2>
          <p className="mt-1 text-sm text-white/60">
            Link a portable Alchm identity (via Privy) — the same identity on alchm.kitchen, so your
            account is unified across both sites. Email, Google, or wallet.
          </p>
          <div className="mt-4">
            <PrivyConnect />
          </div>
        </section>

        {/* On-chain ESMS (claim/mirror) */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">ESMS on-chain</h2>
          <p className="mt-1 text-sm text-white/60">
            Claim your Spirit · Essence · Matter · Substance to your Base wallet as soulbound
            tokens. Your off-chain balance stays authoritative — claiming mirrors it on-chain.
          </p>
          <div className="mt-4">
            <EsmsOnchain />
          </div>
        </section>

        {/* Cross-link to the kitchen */}
        <section className="mt-6 rounded-xl border border-white/10 bg-white/5 p-5">
          <h2 className="text-lg font-semibold">Across the Alchm ecosystem</h2>
          <p className="mt-1 text-sm text-white/60">
            Your token wallet and login are shared with alchm.kitchen — same account, culinary side.
          </p>
          <a
            href="https://alchm.kitchen/profile"
            className="mt-3 inline-block text-sm text-purple-300 underline"
          >
            Open your Kitchen profile →
          </a>
        </section>
      </div>
    </div>
  )
}
