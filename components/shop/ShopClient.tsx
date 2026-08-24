'use client'

import { useState, type KeyboardEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PrivyProvider, useWallets } from '@privy-io/react-auth'
import { base } from 'viem/chains'
import {
  Sparkles,
  Flame,
  Wallet,
  Loader2,
  Check,
  AlertTriangle,
  Coins,
  FlaskConical,
  Shield,
  CreditCard,
  Layers,
} from 'lucide-react'
import type { ShopItem, ShopItemKind, ElementKey } from '@/lib/shop/catalog'
import type { ShopPurchaseStatus } from '@/lib/shop/navigation'
import { useSolanaShop } from '@/lib/solana/useSolanaShop'
import {
  useSolanaWalletState,
  type EsmsBalanceMap,
} from '@/components/providers/SolanaWalletProvider'

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cmi9t84qs00acl80dam2j8195'

/** EIP-712 challenge the server hands back for a sponsored ESMS burn. */
interface RedeemChallenge {
  domain: {
    name: string
    version: string
    chainId: number | string
    verifyingContract: `0x${string}`
  }
  types: Record<string, { name: string; type: string }[]>
  primaryType: string
  message: {
    from: `0x${string}`
    orderId: `0x${string}`
    ids: string[]
    amounts: string[]
    deadline: string
  }
}

interface Balances {
  spirit: number
  essence: number
  matter: number
  substance: number
}

interface ShopClientProps {
  initialTab: ShopItemKind
  purchaseStatus: ShopPurchaseStatus | null
  tokensPurchased: string | null
  signedIn: boolean
  catalog: Record<ShopItemKind, ShopItem[]>
  owned: string[]
  walletAddress: string | null
  onchainBalances: Balances | null
  onchainConfigured: boolean
}

type PurchaseState =
  | { status: 'idle' }
  | { status: 'busy' }
  | { status: 'done'; txHash?: string | null; reconciled?: boolean }
  | { status: 'owned' }
  | { status: 'error'; message: string; shortfall?: Balances }

const TABS: { key: ShopItemKind; label: string; icon: typeof Sparkles }[] = [
  { key: 'tokens', label: 'Tokens & Bundles', icon: Coins },
  { key: 'apothecary', label: 'Apothecary & Boosts', icon: FlaskConical },
  { key: 'pentacles', label: 'Pentacles & Sigils', icon: Shield },
]

const AXES: ElementKey[] = ['spirit', 'essence', 'matter', 'substance']

const AXIS_DOT: Record<ElementKey, string> = {
  spirit: 'bg-alchemical-spirit',
  essence: 'bg-alchemical-essence',
  matter: 'bg-alchemical-matter',
  substance: 'bg-alchemical-substance',
}

const ACCENT_RING: Record<ElementKey, string> = {
  spirit: 'hover:border-alchemical-spirit/40',
  essence: 'hover:border-alchemical-essence/40',
  matter: 'hover:border-alchemical-matter/40',
  substance: 'hover:border-alchemical-substance/40',
}

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

function parseSolanaBalances(balances: EsmsBalanceMap | null): Balances | null {
  if (!balances) return null
  return {
    spirit: Number.parseFloat(balances.spirit || '0'),
    essence: Number.parseFloat(balances.essence || '0'),
    matter: Number.parseFloat(balances.matter || '0'),
    substance: Number.parseFloat(balances.substance || '0'),
  }
}

function ShopClientInner({
  initialTab,
  purchaseStatus,
  tokensPurchased,
  signedIn,
  catalog,
  owned,
  walletAddress,
  onchainBalances,
  onchainConfigured,
}: ShopClientProps) {
  const router = useRouter()
  const { wallets } = useWallets()
  const [tab, setTab] = useState<ShopItemKind>(initialTab)
  const [rail, setRail] = useState<'evm' | 'solana'>('evm')
  const [evmBalances, setEvmBalances] = useState<Balances | null>(onchainBalances)
  const [ownedSet, setOwnedSet] = useState<Set<string>>(new Set(owned))
  const [states, setStates] = useState<Record<string, PurchaseState>>({})

  const solanaWalletState = useSolanaWalletState()
  const { buyDigitalSolana } = useSolanaShop()

  const items = catalog[tab] ?? []
  const hasEvmWallet = Boolean(walletAddress)
  const hasSolanaWallet = Boolean(solanaWalletState.publicKey)
  const solanaBalances = parseSolanaBalances(solanaWalletState.balances)

  const setItemState = (id: string, s: PurchaseState) => setStates(prev => ({ ...prev, [id]: s }))

  const selectShopTab = (nextTab: ShopItemKind) => {
    setTab(nextTab)
    router.replace(`/shop?tab=${nextTab}`, { scroll: false })
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, currentTab: ShopItemKind) => {
    const currentIndex = TABS.findIndex(item => item.key === currentTab)
    let nextIndex: number

    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % TABS.length
        break
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length
        break
      case 'Home':
        nextIndex = 0
        break
      case 'End':
        nextIndex = TABS.length - 1
        break
      default:
        return
    }

    event.preventDefault()
    const nextTab = TABS[nextIndex]?.key
    if (!nextTab) return

    selectShopTab(nextTab)
    requestAnimationFrame(() => document.getElementById(`shop-tab-${nextTab}`)?.focus())
  }

  async function refresh() {
    try {
      const res = await fetch('/api/shop/catalog', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      if (data.onchainBalances) setEvmBalances(data.onchainBalances)
      if (Array.isArray(data.owned)) setOwnedSet(new Set<string>(data.owned))
    } catch {
      /* keep current view */
    }
  }

  /** Sign the server's RedeemAuthorization challenge with the buyer's Privy wallet (EVM). */
  async function signRedeemAuth(challenge: RedeemChallenge): Promise<`0x${string}`> {
    const embedded = wallets.find(w => w.walletClientType === 'privy') ?? wallets[0]
    if (!embedded) {
      throw new Error('Connect your EVM wallet on the Account page, then try again.')
    }
    const provider = await embedded.getEthereumProvider()
    const typedData = {
      domain: {
        name: challenge.domain.name,
        version: challenge.domain.version,
        chainId: Number(challenge.domain.chainId),
        verifyingContract: challenge.domain.verifyingContract,
      },
      types: {
        EIP712Domain: [
          { name: 'name', type: 'string' },
          { name: 'version', type: 'string' },
          { name: 'chainId', type: 'uint256' },
          { name: 'verifyingContract', type: 'address' },
        ],
        ...challenge.types,
      },
      primaryType: challenge.primaryType,
      message: challenge.message,
    }
    const sig = (await provider.request({
      method: 'eth_signTypedData_v4',
      params: [embedded.address, JSON.stringify(typedData)],
    })) as `0x${string}`
    return sig
  }

  async function handleBuyDigitalEvm(item: ShopItem) {
    setItemState(item.id, { status: 'busy' })
    try {
      const body: Record<string, unknown> = { itemId: item.id, payWith: 'esms', rail: 'evm' }
      if (item.repeatable) {
        body.nonce =
          typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : `${item.id}-${Math.floor(performance.now())}`
      }
      const post = () =>
        fetch('/api/shop/purchase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })

      let res = await post()
      let data = await res.json().catch(() => ({}))

      if (res.ok && data.mode === 'sign' && data.challenge) {
        setItemState(item.id, { status: 'busy' })
        const signature = await signRedeemAuth(data.challenge as RedeemChallenge)
        body.signature = signature
        body.deadline = data.deadline
        res = await post()
        data = await res.json().catch(() => ({}))
      }

      if (res.ok && data.alreadyOwned) {
        setOwnedSet(prev => new Set(prev).add(item.id))
        setItemState(item.id, { status: 'owned' })
        return
      }
      if (res.ok && data.ok) {
        if (!item.repeatable) setOwnedSet(prev => new Set(prev).add(item.id))
        setItemState(item.id, {
          status: 'done',
          txHash: data.txHash ?? null,
          reconciled: data.reconciled,
        })
        void refresh()
        return
      }
      if (res.status === 402 && data.code === 'insufficient_esms') {
        setItemState(item.id, {
          status: 'error',
          message: 'Not enough ESMS on Base Sepolia.',
          shortfall: data.shortfall,
        })
        return
      }
      setItemState(item.id, {
        status: 'error',
        message: data.error || 'Purchase failed. Try again.',
      })
    } catch (e) {
      setItemState(item.id, {
        status: 'error',
        message: e instanceof Error ? e.message : 'Network error. Try again.',
      })
    }
  }

  async function handleBuyDigitalSolana(item: ShopItem) {
    setItemState(item.id, { status: 'busy' })
    const result = await buyDigitalSolana(item)

    if (result.alreadyOwned) {
      setOwnedSet(prev => new Set(prev).add(item.id))
      setItemState(item.id, { status: 'owned' })
      return
    }

    if (result.ok) {
      if (!item.repeatable) setOwnedSet(prev => new Set(prev).add(item.id))
      setItemState(item.id, {
        status: 'done',
        txHash: result.txHash ?? null,
        reconciled: result.reconciled,
      })
      void refresh()
      return
    }

    setItemState(item.id, {
      status: 'error',
      message: result.error || 'Solana purchase failed. Try again.',
      shortfall: result.shortfall,
    })
  }

  async function buyTokenBundle(item: ShopItem) {
    if (!signedIn) {
      window.location.href = '/auth/signin?callbackUrl=/shop'
      return
    }
    setItemState(item.id, { status: 'busy' })
    try {
      const res = await fetch('/api/stripe/checkout-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier: item.stripeTier || '5' }),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.url) {
        window.location.href = data.url
        return
      }
      setItemState(item.id, {
        status: 'error',
        message: data.error || 'Could not initiate Stripe checkout.',
      })
    } catch {
      setItemState(item.id, { status: 'error', message: 'Network error. Try again.' })
    }
  }

  const activeBalances = rail === 'solana' ? solanaBalances : evmBalances
  const hasActiveWallet = rail === 'solana' ? hasSolanaWallet : hasEvmWallet

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* Dual-Rail Wallet / balance strip */}
      <WalletStrip
        signedIn={signedIn}
        rail={rail}
        setRail={setRail}
        hasEvmWallet={hasEvmWallet}
        hasSolanaWallet={hasSolanaWallet}
        evmAddress={walletAddress}
        solanaAddress={solanaWalletState.publicKey}
        evmBalances={evmBalances}
        solanaBalances={solanaBalances}
        onchainConfigured={onchainConfigured}
      />

      {purchaseStatus === 'success' && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200"
        >
          <Check className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold">ESMS tokens acquired</h2>
            <p className="mt-1 text-xs text-emerald-200/75">
              {tokensPurchased
                ? `${tokensPurchased} ESMS Tokens are being synchronized to your Treasury.`
                : 'Your ESMS Tokens are being synchronized to your Treasury.'}
            </p>
          </div>
        </div>
      )}

      {purchaseStatus === 'cancelled' && (
        <div
          role="status"
          className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 text-zinc-300"
        >
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <h2 className="text-sm font-semibold">Purchase cancelled</h2>
            <p className="mt-1 text-xs text-zinc-500">No charge was made.</p>
          </div>
        </div>
      )}

      {/* Pay-with legend */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 text-xs text-zinc-500">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-amber-500" /> ESMS — on-chain burn settlement for
            digital items &amp; boosts
          </span>
          <span className="text-zinc-700">·</span>
          <span>Stripe / Card / USDC — direct ESMS token bundle top-ups</span>
        </div>

        {/* Rail quick toggle */}
        <div className="inline-flex items-center rounded-lg border border-border/80 bg-background/80 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setRail('evm')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              rail === 'evm'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Base (EVM)</span>
          </button>
          <button
            type="button"
            onClick={() => setRail('solana')}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-all ${
              rail === 'solana'
                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <span>Solana Token-2022</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-2 border-b border-border"
        role="tablist"
        aria-label="Bazaar sections"
      >
        {TABS.map(({ key, label, icon: Icon }) => {
          const active = tab === key
          return (
            <button
              id={`shop-tab-${key}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="shop-items"
              tabIndex={active ? 0 : -1}
              key={key}
              onClick={() => selectShopTab(key)}
              onKeyDown={event => handleTabKeyDown(event, key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
                active
                  ? 'border-amber-500 text-amber-400'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className="text-xs text-zinc-600">{catalog[key]?.length ?? 0}</span>
            </button>
          )
        })}
      </div>

      {/* Grid */}
      <div
        id="shop-items"
        role="tabpanel"
        aria-labelledby={`shop-tab-${tab}`}
        className="grid grid-cols-1 sm:grid-cols-2 gap-4"
      >
        {items.map(item => (
          <ItemCard
            key={item.id}
            item={item}
            rail={rail}
            owned={ownedSet.has(item.id)}
            state={states[item.id] ?? { status: 'idle' }}
            signedIn={signedIn}
            hasWallet={hasActiveWallet}
            onchainConfigured={rail === 'solana' ? true : onchainConfigured}
            onBuy={() => {
              if (item.kind === 'tokens') {
                void buyTokenBundle(item)
              } else if (rail === 'solana') {
                void handleBuyDigitalSolana(item)
              } else {
                void handleBuyDigitalEvm(item)
              }
            }}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Scoped Privy provider for EVM signing alongside standard Solana wallet adapter context.
 */
export default function ShopClient(props: ShopClientProps) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ['email', 'google', 'wallet'],
        embeddedWallets: {
          ethereum: { createOnLogin: 'users-without-wallets' },
          solana: { createOnLogin: 'off' },
        },
        defaultChain: base,
        supportedChains: [base],
        appearance: { theme: 'dark', accentColor: '#7c5cf0' },
      }}
    >
      <ShopClientInner {...props} />
    </PrivyProvider>
  )
}

function WalletStrip({
  signedIn,
  rail,
  setRail,
  hasEvmWallet,
  hasSolanaWallet,
  evmAddress,
  solanaAddress,
  evmBalances,
  solanaBalances,
  onchainConfigured,
}: {
  signedIn: boolean
  rail: 'evm' | 'solana'
  setRail: (rail: 'evm' | 'solana') => void
  hasEvmWallet: boolean
  hasSolanaWallet: boolean
  evmAddress: string | null
  solanaAddress: string | null
  evmBalances: Balances | null
  solanaBalances: Balances | null
  onchainConfigured: boolean
}) {
  const isSolana = rail === 'solana'
  const activeBalances = isSolana ? solanaBalances : evmBalances
  const activeAddress = isSolana ? solanaAddress : evmAddress
  const hasWallet = isSolana ? hasSolanaWallet : hasEvmWallet

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" />
            On-chain ESMS Balances
          </h2>
          {/* Rail Selector Tabs */}
          <div className="inline-flex rounded-lg border border-border/70 bg-background/60 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setRail('evm')}
              className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] transition-colors ${
                !isSolana
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Base Sepolia
            </button>
            <button
              type="button"
              onClick={() => setRail('solana')}
              className={`px-2.5 py-0.5 rounded-md font-mono text-[11px] transition-colors ${
                isSolana
                  ? 'bg-amber-500/20 text-amber-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Solana Devnet
            </button>
          </div>
        </div>

        {!signedIn ? (
          <Link
            href="/auth/signin?callbackUrl=/shop"
            className="text-xs text-amber-400 hover:underline"
          >
            Sign in to spend
          </Link>
        ) : !hasWallet ? (
          <Link
            href={isSolana ? '/account' : '/economy'}
            className="text-xs text-amber-400 hover:underline"
          >
            {isSolana ? 'Connect Solana wallet →' : 'Claim ESMS to chain →'}
          </Link>
        ) : activeAddress ? (
          <span className="text-xs font-mono text-zinc-400 bg-background border border-border/60 px-2 py-0.5 rounded">
            {isSolana ? 'SOL: ' : 'EVM: '}
            {activeAddress.slice(0, 6)}…{activeAddress.slice(-4)}
          </span>
        ) : null}
      </div>

      <div className="grid grid-cols-4 gap-3">
        {AXES.map(axis => (
          <div
            key={axis}
            className="bg-background border border-border/60 rounded-lg p-3 flex flex-col items-center gap-1.5 relative overflow-hidden"
          >
            <span className={`absolute top-0 left-0 w-full h-1 ${AXIS_DOT[axis]} opacity-60`} />
            <span className="text-[11px] uppercase tracking-wide text-zinc-500 capitalize">
              {axis}
            </span>
            <span className="text-xl font-bold text-white tabular-nums">
              {activeBalances ? Math.floor(activeBalances[axis]) : '—'}
            </span>
          </div>
        ))}
      </div>

      {!isSolana && !onchainConfigured && (
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600/80" />
          Base Sepolia settlement activates when the ESMS contract is deployed.
        </p>
      )}

      {isSolana && signedIn && !hasSolanaWallet && (
        <p className="text-xs text-zinc-500 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500/80" />
          Link and verify a Solana wallet on your{' '}
          <Link href="/account" className="text-amber-400 hover:underline">
            Account page
          </Link>{' '}
          to enable Token-2022 burn checkout.
        </p>
      )}

      {signedIn && hasWallet && !activeBalances && (
        <p className="text-xs text-zinc-500">
          No claimed ESMS on this rail yet.{' '}
          <Link href="/economy" className="text-amber-400 hover:underline">
            Claim your balance →
          </Link>
        </p>
      )}
    </div>
  )
}

function EsmsChips({ item }: { item: ShopItem }) {
  const axes = AXES.filter(axis => item.esms[axis] > 0)
  if (axes.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {axes.map(axis => (
        <span
          key={axis}
          className="inline-flex items-center gap-1 text-xs text-zinc-300 bg-background border border-border/60 rounded-full px-2 py-0.5"
        >
          <span className={`w-2 h-2 rounded-full ${AXIS_DOT[axis]}`} />
          {item.esms[axis]} <span className="text-zinc-500 capitalize">{axis}</span>
        </span>
      ))}
    </div>
  )
}

function ItemCard({
  item,
  rail,
  owned,
  state,
  signedIn,
  hasWallet,
  onchainConfigured,
  onBuy,
}: {
  item: ShopItem
  rail: 'evm' | 'solana'
  owned: boolean
  state: PurchaseState
  signedIn: boolean
  hasWallet: boolean
  onchainConfigured: boolean
  onBuy: () => void
}) {
  const isToken = item.kind === 'tokens'
  const isSolana = rail === 'solana'
  const busy = state.status === 'busy'
  const total = item.esms.spirit + item.esms.essence + item.esms.matter + item.esms.substance

  const digitalBlocked =
    !isToken && (!signedIn || !hasWallet || !onchainConfigured || (owned && !item.repeatable))

  return (
    <div
      className={`bg-surface border border-border rounded-xl p-5 flex flex-col gap-4 transition-colors ${ACCENT_RING[item.accent]}`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`material-symbols-outlined shrink-0 w-11 h-11 rounded-lg bg-background border border-border/60 flex items-center justify-center text-[22px] text-amber-400`}
          aria-hidden
        >
          {item.icon}
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-zinc-100 leading-tight">{item.title}</h3>
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{item.blurb}</p>
        </div>
      </div>

      {/* Price */}
      <div className="flex items-center justify-between gap-2 mt-auto">
        {isToken ? (
          <div className="space-y-1">
            <span className="text-lg font-bold text-amber-400">{usd(item.usdCents)}</span>
            <p className="text-[11px] text-zinc-500">Includes {total} total ESMS tokens</p>
          </div>
        ) : (
          <div className="space-y-1.5">
            <EsmsChips item={item} />
            <span className="text-[11px] text-zinc-500">
              {total} ESMS · ≈ {usd(item.usdCents)}
            </span>
          </div>
        )}
      </div>

      {/* Action / status */}
      {owned && !item.repeatable ? (
        <button
          disabled
          className="w-full py-2.5 rounded-lg text-sm font-semibold bg-zinc-900 border border-zinc-800 text-emerald-400 flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" /> Owned
        </button>
      ) : (
        <button
          onClick={onBuy}
          disabled={busy || digitalBlocked}
          className="w-full py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-all bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {busy ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isToken ? (
            <>
              <CreditCard className="w-4 h-4" /> Acquire Token Bundle
            </>
          ) : (
            <>
              <Flame className="w-4 h-4" /> Burn {total} ESMS ({isSolana ? 'Solana' : 'Base'})
            </>
          )}
        </button>
      )}

      {/* Inline status messages */}
      {state.status === 'done' && (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5" />
          {item.repeatable ? 'Redeemed!' : 'Unlocked!'}
          {state.txHash
            ? ` Burn settled on-chain (${isSolana ? 'Solana' : 'Base'}).`
            : state.reconciled
              ? ' (already settled)'
              : ''}
        </p>
      )}
      {state.status === 'owned' && (
        <p className="text-xs text-emerald-400 flex items-center gap-1.5">
          <Check className="w-3.5 h-3.5" /> Already owned.
        </p>
      )}
      {state.status === 'error' && (
        <div className="text-xs text-red-400 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>
            {state.message}
            {state.shortfall && (
              <>
                {' '}
                <Link href="/economy" className="text-amber-400 hover:underline">
                  Claim more to chain →
                </Link>
              </>
            )}
          </span>
        </div>
      )}
      {digitalBlocked && state.status === 'idle' && (
        <p className="text-[11px] text-zinc-600">
          {!signedIn
            ? 'Sign in to spend ESMS.'
            : !hasWallet
              ? isSolana
                ? 'Link a Solana wallet in Account settings.'
                : 'Claim ESMS to chain first.'
              : !onchainConfigured
                ? 'On-chain settlement not live yet.'
                : ''}
        </p>
      )}
    </div>
  )
}
