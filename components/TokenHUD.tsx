'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { useSession } from 'next-auth/react'
import { DAILY_ESMS_YIELD, type TokenType } from '@/lib/economy-config'
import { usePathname } from 'next/navigation'
import { Sparkles, Zap, Box, Droplets } from 'lucide-react'
import type { TokenBalances } from '@/lib/services/economyService'

export function TokenHUD() {
  const { data: session, status } = useSession()
  const pathname = usePathname()
  const disabledForDesktopSurface =
    pathname?.startsWith('/desktop/ghost-feed') || pathname?.startsWith('/desktop/composer')
  const [balances, setBalances] = useState<
    (TokenBalances & { canClaimAgentsYield?: boolean }) | null
  >(null)
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState(false)
  const { toast } = useToast()

  const fetchBalances = async () => {
    if (status !== 'authenticated') {
      setLoading(false)
      return
    }

    try {
      const res = await fetch('/api/economy/balances')
      if (res.ok) {
        const data = await res.json()
        setBalances(data)
      } else if (res.status === 401) {
        // Silently handle 401 - might be session expiration
        setBalances(null)
      }
    } catch (error) {
      console.error('Failed to fetch balances:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (disabledForDesktopSurface) {
      setLoading(false)
      return
    }

    fetchBalances()
    // Refresh periodically if authenticated
    let interval: NodeJS.Timeout | null = null
    if (status === 'authenticated') {
      interval = setInterval(fetchBalances, 60000)
    }
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [status, disabledForDesktopSurface])

  if (disabledForDesktopSurface) return null

  const handleClaimYield = async () => {
    setClaiming(true)
    try {
      const res = await fetch('/api/economy/yield', { method: 'POST' })
      const data = await res.json()

      if (!res.ok) {
        toast({
          title: 'Daily ESMS Yield Not Ready',
          description:
            data.error || 'Daily ESMS yield already harvested. Available again tomorrow.',
          variant: 'destructive',
        })
        return
      }

      setBalances({ ...data.balances, canClaimAgentsYield: false })
      const distribution = (data.distribution || {}) as Partial<
        Record<TokenType | Lowercase<TokenType>, number>
      >
      const basePerAxis = DAILY_ESMS_YIELD / 4
      const lowercaseToken: Record<TokenType, Lowercase<TokenType>> = {
        Spirit: 'spirit',
        Essence: 'essence',
        Matter: 'matter',
        Substance: 'substance',
      }
      const amount = (token: TokenType) =>
        distribution[token] ?? distribution[lowercaseToken[token]] ?? basePerAxis
      toast({
        title: 'Yield Harvested',
        description: `Received ${amount('Spirit')} Spirit, ${amount('Essence')} Essence, ${amount('Matter')} Matter, ${amount('Substance')} Substance.${data.isPremium ? ' A 2.0× yield multiplier was applied.' : ''}`,
      })
    } catch (error) {
      toast({
        title: 'Daily ESMS Yield Error',
        description: 'Failed to claim Daily ESMS Yield.',
        variant: 'destructive',
      })
    } finally {
      setClaiming(false)
    }
  }

  if (loading) return null

  // Navigation already exposes sign-in. A second fixed panel covered content on
  // every public route without offering an action, especially on small screens.
  if (!balances || status !== 'authenticated') return null

  return (
    <Card
      className="fixed bottom-4 right-4 z-50 p-3 shadow-lg bg-black/80 backdrop-blur-md border border-zinc-800 text-white rounded-xl"
      role="region"
      aria-label="ESMS Treasury"
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-1">
          <Link
            href="/economy"
            className="text-sm font-semibold tracking-wider text-zinc-300 hover:text-white"
            title="Open the ESMS Treasury"
          >
            ESMS TREASURY
          </Link>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/40 border border-indigo-500/30"
            onClick={handleClaimYield}
            disabled={claiming || balances.canClaimAgentsYield === false}
          >
            {claiming
              ? 'Claiming…'
              : balances.canClaimAgentsYield === false
                ? 'Yield Harvested'
                : 'Claim Daily Yield'}
          </Button>
        </div>
        <div className="flex gap-4 px-2" role="group" aria-label="ESMS Token balances">
          <div
            className="flex flex-col items-center group"
            title={`Spirit (Sp) ESMS Token balance: ${balances.spirit}`}
            aria-label={`Spirit (Sp) ESMS Token balance: ${balances.spirit}`}
          >
            <div className="flex items-center gap-1.5 text-yellow-400 mb-1">
              <Sparkles size={14} className="group-hover:animate-pulse" aria-hidden="true" />
              <span className="text-xs uppercase font-medium">Spirit (Sp)</span>
            </div>
            <span className="font-mono text-sm">{balances.spirit}</span>
          </div>
          <div
            className="flex flex-col items-center group"
            title={`Essence (Es) ESMS Token balance: ${balances.essence}`}
            aria-label={`Essence (Es) ESMS Token balance: ${balances.essence}`}
          >
            <div className="flex items-center gap-1.5 text-blue-400 mb-1">
              <Droplets size={14} className="group-hover:animate-bounce" aria-hidden="true" />
              <span className="text-xs uppercase font-medium">Essence (Es)</span>
            </div>
            <span className="font-mono text-sm">{balances.essence}</span>
          </div>
          <div
            className="flex flex-col items-center group"
            title={`Matter (Ma) ESMS Token balance: ${balances.matter}`}
            aria-label={`Matter (Ma) ESMS Token balance: ${balances.matter}`}
          >
            <div className="flex items-center gap-1.5 text-orange-400 mb-1">
              <Box
                size={14}
                className="group-hover:rotate-12 transition-transform"
                aria-hidden="true"
              />
              <span className="text-xs uppercase font-medium">Matter (Ma)</span>
            </div>
            <span className="font-mono text-sm">{balances.matter}</span>
          </div>
          <div
            className="flex flex-col items-center group"
            title={`Substance (Su) ESMS Token balance: ${balances.substance}`}
            aria-label={`Substance (Su) ESMS Token balance: ${balances.substance}`}
          >
            <div className="flex items-center gap-1.5 text-green-400 mb-1">
              <Zap
                size={14}
                className="group-hover:scale-110 transition-transform"
                aria-hidden="true"
              />
              <span className="text-xs uppercase font-medium">Substance (Su)</span>
            </div>
            <span className="font-mono text-sm">{balances.substance}</span>
          </div>
        </div>
        <Link
          href="/shop?tab=tokens"
          className="text-center text-[11px] font-medium text-indigo-300 hover:text-indigo-200"
          title="Acquire ESMS Bundles in the ESMS Bazaar"
        >
          Acquire ESMS Bundles
        </Link>
      </div>
    </Card>
  )
}
