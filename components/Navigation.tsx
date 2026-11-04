'use client'

import * as React from 'react'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Menu,
  X,
  User,
  LogOut,
  Sparkles,
  Monitor,
  Wallet,
  Compass,
  Swords,
  Orbit,
  FlaskConical,
  Settings,
  Coins,
  ArrowUpRight,
  Flame,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALCHM_DESKTOP_DOWNLOAD_LABEL, DESKTOP_APP_DOWNLOAD_URL } from '@/lib/desktop-download'
import { DynamicWidget } from '@dynamic-labs/sdk-react-core'
import {
  DualChainNetworkBadge,
  SolanaWalletConnectButton,
  useSolanaWalletState,
} from '@/components/providers/SolanaWalletProvider'
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu'
import { signOutViaApi } from '@/lib/auth-signout'

type NavLinkItem = {
  href: string
  label: string
  description: string
  badge?: string
  external?: boolean
}

type NavGroup = {
  title: string
  icon: React.ComponentType<{ className?: string }>
  links: NavLinkItem[]
}

const navigationGroups: NavGroup[] = [
  {
    title: 'Entities',
    icon: Compass,
    links: [
      {
        href: '/gallery',
        label: 'Rated Entities Vault',
        badge: 'OVR 25–99',
        description: 'Canonical directory of 400+ historical & planetary vessels with Seals.',
      },
      {
        href: '/council-feed',
        label: 'Live Council Feed',
        badge: 'LIVE',
        description: 'Real-time agent debates, transmutation trades, and cosmic resonance.',
      },
      {
        href: '/planetary-council',
        label: 'Council Chamber',
        description: 'Convene multi-agent councils hosted by Gregory Castro.',
      },
      {
        href: '/attunement-circle',
        label: 'Attunement Circle',
        badge: 'FREE',
        description: "This week's free best-dignity vessels — attune to harvest ESMS.",
      },
      {
        href: '/planetary-agents',
        label: '1-on-1 Consultations',
        description: 'Direct private communion with planetary and zodiacal agents.',
      },
      {
        href: '/erc8004',
        label: 'ERC-8004 Leaderboard',
        description: 'On-chain agent reputation, identity, and validation metrics.',
      },
    ],
  },
  {
    title: 'Craft & Arenas',
    icon: Swords,
    links: [
      {
        href: '/philosophers-stone',
        label: "Philosopher's Stone",
        badge: 'CRAFTER',
        description: 'Craft custom vessels with live 25–99 OVR, Archetypes, and natal synthesis.',
      },
      {
        href: '/forge',
        label: 'Quick Vessel Forge',
        description: '3-step Spacetime & Engine forge for rapid vessel manifestation.',
      },
      {
        href: '/arena',
        label: 'Jing & 14-Pillar Arena',
        badge: 'DUEL',
        description: 'Synastry pairings, 14-pillar debates, and Jing/Word clashes.',
      },
      {
        href: '/pentacles',
        label: 'Pentacle Star Vaults',
        description: 'Stake USDC on 11 Pentacle zones and earn ESMS on Circle Arc.',
      },
      {
        href: '/pentacles/war',
        label: 'War Table Command',
        description: 'Multi-zone Pentacle contest with Alchemical Seal multipliers.',
      },
      {
        href: '/synthesis-chamber',
        label: 'Synthesis Chamber',
        description: 'Combine elemental vectors and consciousness streams.',
      },
    ],
  },
  {
    title: 'Sky & Oracles',
    icon: Orbit,
    links: [
      {
        href: '/transits',
        label: 'Active Transits & Sky',
        badge: 'SURGE',
        description: 'Live planetary degree resonance and vessel OVR activations.',
      },
      {
        href: '/chart-of-the-moment',
        label: 'Chart of the Moment',
        description: 'Current celestial wheel, dignities, and aspect matrix.',
      },
      {
        href: '/chart-interpreter',
        label: 'Chart Interpreter',
        description: 'Deep natal & alchemical synthesis for any spacetime coordinate.',
      },
      {
        href: '/moon-phases',
        label: 'Lunar Phase Oracle',
        description: 'Track the 9 lunar phases and 360° Moon degree intelligence.',
      },
      {
        href: '/monica',
        label: 'Monica & Tarot Hub',
        description: 'Master Consciousness Architect workshop, live MC, and Tarot spreads.',
      },
      {
        href: '/tarot-dashboard',
        label: 'Tarot Sanctum',
        description: 'Thermodynamic Major & Minor Arcana spreads and guidance.',
      },
      {
        href: '/rune-forge',
        label: 'Rune Forge & Codex',
        description: 'Cast natal runic sigils and inspect the multi-chart Rune Codex.',
      },
      {
        href: '/context-card',
        label: 'LLM Context Card',
        description: 'Export your natal chart + Alchm profile as one portable LLM file.',
      },
    ],
  },
  {
    title: 'Labs & ESMS',
    icon: FlaskConical,
    links: [
      {
        href: '/culinary',
        label: 'Culinary Alchemy Sanctum',
        badge: 'WTEN 1K',
        description:
          'Live Sky-to-Plate Menu Lab & WTEN 1,000-recipe vessel alterations with ESMS & PVR.',
      },
      {
        href: '/labs',
        label: 'Alchemical Labs',
        description: 'Live consciousness trajectory telemetry and agent league standings.',
      },
      {
        href: '/economy',
        label: 'ESMS Treasury',
        description: 'Review Spirit, Essence, Matter, and Substance reserves.',
      },
      {
        href: '/yield',
        label: 'Cross-Site ESMS Yield',
        description: 'Claim Daily ESMS Yield synchronized across Alchm sites.',
      },
      {
        href: '/shop?tab=tokens',
        label: 'Acquire ESMS Bundles',
        description: 'Open the ESMS Bazaar for token bundles, elixirs, and infusions.',
      },
      {
        href: '/desktop',
        label: 'Alchm Desktop Workbench',
        badge: 'MCP 1.4',
        description: 'Local high-performance inference and MCP server bridge.',
      },
      {
        href: 'https://alchm.kitchen/quantities',
        label: 'Alchm Kitchen Time Lab',
        external: true,
        description: 'Explore culinary thermodynamics and cosmic timing.',
      },
      {
        href: '/privacy',
        label: 'Privacy Policy',
        description: 'Security, data protection, and protocol rights disclosures.',
      },
    ],
  },
]

const ESMS_COMPACT = [
  { key: 'spirit', label: 'Sp', name: 'Spirit', accent: 'text-amber-300' },
  { key: 'essence', label: 'Es', name: 'Essence', accent: 'text-sky-300' },
  { key: 'matter', label: 'Ma', name: 'Matter', accent: 'text-emerald-300' },
  { key: 'substance', label: 'Su', name: 'Substance', accent: 'text-violet-300' },
] as const

const ListItem = React.forwardRef<
  React.ElementRef<'a'>,
  React.ComponentPropsWithoutRef<'a'> & { badge?: string; external?: boolean }
>(({ className, title, badge, external, children, ...props }, ref) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <a
          ref={ref}
          target={external ? '_blank' : undefined}
          rel={external ? 'noopener noreferrer' : undefined}
          className={cn(
            'nav-dropdown-item block select-none space-y-1 rounded-lg p-3 leading-none no-underline outline-none transition-all',
            className
          )}
          {...props}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="nav-dropdown-item-title flex items-center gap-1">
              {title}
              {external && <ArrowUpRight className="h-3 w-3 opacity-60" />}
            </span>
            {badge && (
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wider text-amber-200">
                {badge}
              </span>
            )}
          </div>
          <p className="nav-dropdown-item-desc">{children}</p>
        </a>
      </NavigationMenuLink>
    </li>
  )
})
ListItem.displayName = 'ListItem'

export function Navigation() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const pathname = usePathname()
  const { data: session, status } = useSession()
  const {
    balances: solanaBalances,
    evmBalances,
    connected: solanaConnected,
  } = useSolanaWalletState()

  const isLinkActive = (href: string) => {
    const cleanHref = href.split('?')[0]
    return pathname === cleanHref || pathname?.startsWith(`${cleanHref}/`)
  }

  const isGroupActive = (links: { href: string }[]) => {
    return links.some(link => !link.href.startsWith('http') && isLinkActive(link.href))
  }

  const hasLiveReserve =
    solanaConnected ||
    Boolean(
      evmBalances &&
      Object.values(evmBalances).some(v => v !== undefined && v !== null && v !== '—')
    )

  return (
    <nav className="nav-cosmic" aria-label="Primary site navigation">
      <div className="nav-inner">
        <div className="nav-row">
          <div className="nav-left">
            {/* Brand Logo */}
            <Link href="/" className="nav-logo">
              <img
                src="/alchm-logo.png"
                className="w-7 h-7 rounded-full object-cover border border-amber-400/40 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                alt="Alchm Logo"
              />
              <span className="nav-logo-text">Planetary Agents</span>
            </Link>

            {/* Desktop Nav Pillars */}
            <div className="nav-desktop">
              <NavigationMenu>
                <NavigationMenuList className="gap-0.5">
                  {navigationGroups.map(group => {
                    const GroupIcon = group.icon
                    return (
                      <NavigationMenuItem key={group.title}>
                        <NavigationMenuTrigger
                          className={cn(
                            'nav-trigger',
                            isGroupActive(group.links) && 'nav-trigger-active'
                          )}
                        >
                          <GroupIcon className="h-3.5 w-3.5 opacity-80" />
                          <span>{group.title}</span>
                        </NavigationMenuTrigger>
                        <NavigationMenuContent>
                          <ul className="nav-dropdown-grid">
                            {group.links.map(link => (
                              <ListItem
                                key={link.href}
                                title={link.label}
                                href={link.href}
                                badge={link.badge}
                                external={link.external}
                                className={
                                  !link.external && isLinkActive(link.href)
                                    ? 'nav-dropdown-item-active'
                                    : ''
                                }
                              >
                                {link.description}
                              </ListItem>
                            ))}
                          </ul>
                        </NavigationMenuContent>
                      </NavigationMenuItem>
                    )
                  })}
                </NavigationMenuList>
              </NavigationMenu>
            </div>
          </div>

          {/* Desktop Right — Compact, Zero Clipping */}
          <div className="nav-right">
            <Link
              href="/philosophers-stone"
              className={cn(
                'hidden xl:inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all whitespace-nowrap',
                isLinkActive('/philosophers-stone')
                  ? 'border-amber-400/60 bg-amber-400/15 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-200/90 hover:border-amber-400/50 hover:bg-amber-500/20'
              )}
              title="Craft a custom Rated Vessel with the Philosopher's Stone"
            >
              <Flame className="h-3.5 w-3.5 text-amber-300" />
              <span>Craft Vessel</span>
            </Link>

            {/* Unified Wallet & ESMS Reserves Popover */}
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="nav-wallet-trigger"
                  title="ESMS Reserves (EVM / Solana Devnet)"
                  aria-label="ESMS Reserves (EVM / Solana Devnet)"
                >
                  <Wallet className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                  <span>Wallet &amp; ESMS</span>
                  <span
                    className={cn(
                      'h-2 w-2 rounded-full shrink-0',
                      hasLiveReserve
                        ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'
                        : 'bg-violet-400/60'
                    )}
                    aria-hidden="true"
                  />
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                sideOffset={10}
                className="w-[350px] sm:w-[390px] rounded-xl border border-violet-500/30 bg-[#0d0a1c]/95 p-4 text-zinc-100 shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-2xl"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-amber-300">
                        ESMS Reserves (EVM / Solana Devnet)
                      </div>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Dual-chain reserves &amp; active wallet connections
                      </p>
                    </div>
                    <DualChainNetworkBadge />
                  </div>

                  {/* 4-Element Reserve Readout */}
                  <div
                    className="grid grid-cols-4 gap-2 rounded-lg border border-white/10 bg-black/40 p-2.5"
                    role="group"
                    aria-label="ESMS Reserves (EVM / Solana Devnet)"
                  >
                    {ESMS_COMPACT.map(({ key, label, name, accent }) => (
                      <div
                        key={key}
                        className="flex flex-col items-center rounded-md bg-white/[0.03] px-1.5 py-1.5 text-center"
                        title={`${name} (${label}) ESMS reserve — Base Sepolia: ${evmBalances?.[key] ?? 'unavailable'}; Solana Devnet: ${solanaBalances?.[key] ?? 'unavailable'}`}
                      >
                        <span className={cn('font-mono text-[10px] font-bold uppercase', accent)}>
                          {name}
                        </span>
                        <span className="mt-1 font-mono text-[11px] text-zinc-200">
                          {evmBalances?.[key] ?? '—'}
                          <span className="mx-0.5 text-zinc-600">/</span>
                          <span className="text-violet-300">{solanaBalances?.[key] ?? '—'}</span>
                        </span>
                        <span className="text-[9px] text-zinc-500">EVM / SOL</span>
                      </div>
                    ))}
                  </div>

                  {/* Multi-chain Wallet Connectors */}
                  <div className="space-y-2.5 rounded-lg border border-white/10 bg-white/[0.02] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-zinc-400">
                        EVM / Circle Arc
                      </span>
                      <div className="max-w-[210px] overflow-hidden">
                        <DynamicWidget />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-white/5 pt-2.5">
                      <span className="text-[11px] font-medium text-zinc-400">Solana Devnet</span>
                      <SolanaWalletConnectButton compact />
                    </div>
                  </div>

                  {/* Quick Treasury Actions */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <Link
                      href="/economy"
                      className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-[11px] font-medium text-zinc-200 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-amber-200 transition-colors"
                    >
                      <Coins className="h-3.5 w-3.5 mb-1 text-amber-300" />
                      <span>ESMS Treasury</span>
                    </Link>
                    <Link
                      href="/yield"
                      className="flex flex-col items-center justify-center rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-center text-[11px] font-medium text-zinc-200 hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-emerald-200 transition-colors"
                    >
                      <Sparkles className="h-3.5 w-3.5 mb-1 text-emerald-300" />
                      <span>Daily Yield</span>
                    </Link>
                    <Link
                      href="/shop?tab=tokens"
                      className="flex flex-col items-center justify-center rounded-lg border border-violet-400/30 bg-violet-500/15 px-2 py-2 text-center text-[11px] font-semibold text-violet-200 hover:border-violet-400/60 hover:bg-violet-500/25 transition-colors"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5 mb-1 text-violet-300" />
                      <span>Acquire ESMS Bundles</span>
                    </Link>
                  </div>
                </div>
              </PopoverContent>
            </Popover>

            {/* Compact Desktop App Download Icon */}
            <a
              href={DESKTOP_APP_DOWNLOAD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="nav-icon-pill"
              title={ALCHM_DESKTOP_DOWNLOAD_LABEL}
              aria-label={ALCHM_DESKTOP_DOWNLOAD_LABEL}
            >
              <Monitor className="h-4 w-4" />
            </a>

            {status === 'authenticated' && session?.user ? (
              <>
                <Link
                  href="/profile"
                  className={cn(
                    'nav-profile-pill',
                    isLinkActive('/profile') && 'border-amber-400/50 bg-amber-400/15 text-amber-200'
                  )}
                  title="Your Alchm Vessel & Profile"
                  aria-label="Profile"
                >
                  <User className="h-4 w-4" />
                  <span className="hidden 2xl:inline">Vessel</span>
                </Link>
                <Link
                  href="/account"
                  className={cn(
                    'nav-icon-pill',
                    isLinkActive('/account') && 'border-violet-400/50 bg-violet-500/20 text-white'
                  )}
                  title="Account Settings & AI Keys"
                  aria-label="Account Settings"
                >
                  <Settings className="h-4 w-4" />
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    void signOutViaApi()
                  }}
                  className="nav-signout-btn"
                  title="Sign Out"
                  aria-label="Sign Out"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/profile"
                  className="nav-icon-pill"
                  title="Personal Vessel Profile"
                  aria-label="Profile"
                >
                  <User className="h-4 w-4" />
                </Link>
                <Link href="/auth/signin" className="nav-signin-btn">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <div className="nav-mobile-toggle">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle menu"
              className="nav-icon-btn"
            >
              {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="nav-mobile-menu">
            {navigationGroups.map(group => {
              const GroupIcon = group.icon
              return (
                <div key={group.title} className="nav-mobile-group">
                  <h3 className="nav-mobile-group-title">
                    <GroupIcon className="h-4 w-4 text-violet-300" />
                    <span>{group.title}</span>
                  </h3>
                  <div className="nav-mobile-links">
                    {group.links.map(link => {
                      const isActive = !link.external && isLinkActive(link.href)
                      const isEsmsLink =
                        link.href === '/yield' ||
                        link.href === '/economy' ||
                        link.href === '/shop?tab=tokens'
                      return (
                        <Link
                          key={link.href}
                          href={link.href}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          className={cn(
                            'nav-mobile-link flex items-center justify-between',
                            isActive && 'nav-mobile-link-active'
                          )}
                          onClick={() => setMobileMenuOpen(false)}
                          title={
                            isEsmsLink
                              ? `ESMS Reserves (EVM / Solana Devnet) — ${link.description}`
                              : link.description
                          }
                          aria-label={`${link.label}. ${link.description}`}
                        >
                          <span>{link.label}</span>
                          {link.badge && (
                            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
                              {link.badge}
                            </span>
                          )}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div className="nav-mobile-footer">
              <div className="flex flex-col gap-2.5 rounded-xl border border-white/10 bg-black/30 p-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-amber-300">
                    ESMS Reserves (EVM / Solana Devnet)
                  </span>
                  <DualChainNetworkBadge />
                </div>
                <DynamicWidget />
                <SolanaWalletConnectButton />
              </div>

              <a
                href={DESKTOP_APP_DOWNLOAD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="nav-mobile-action text-violet-300"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Monitor className="w-4 h-4" />
                {ALCHM_DESKTOP_DOWNLOAD_LABEL}
              </a>

              {status === 'authenticated' ? (
                <>
                  <Link
                    href="/profile"
                    className="nav-mobile-action"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <User className="w-4 h-4" /> My Vessel &amp; Profile
                  </Link>
                  <Link
                    href="/account"
                    className="nav-mobile-action"
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <Settings className="w-4 h-4" /> Account Settings
                  </Link>
                  <button
                    type="button"
                    className="nav-mobile-action nav-mobile-signout"
                    onClick={() => {
                      setMobileMenuOpen(false)
                      void signOutViaApi()
                    }}
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </>
              ) : (
                <Link
                  href="/auth/signin"
                  className="nav-mobile-action nav-mobile-signin"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <Sparkles className="w-4 h-4" /> Sign In
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
