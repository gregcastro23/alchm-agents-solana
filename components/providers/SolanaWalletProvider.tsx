'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import { useUserWallets } from '@dynamic-labs/sdk-react-core'
import {
  ConnectionProvider,
  useAnchorWallet,
  useConnection,
  useWallet,
  WalletProvider,
} from '@solana/wallet-adapter-react'
import { WalletModalProvider, WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter } from '@solana/wallet-adapter-phantom'
import { SolflareWalletAdapter } from '@solana/wallet-adapter-solflare'
import { PublicKey, type Transaction, type VersionedTransaction } from '@solana/web3.js'
import { createPublicClient, http } from 'viem'
import { baseSepolia } from 'viem/chains'

import {
  ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT,
  AAE_SOLANA_TRANSACTION_CONFIRMED_EVENT,
  AsolSolanaClient,
  AaeSolanaClient,
  type AsolSolanaTransaction,
  type AaeSolanaTransaction,
  type AsolSolanaWallet,
  type AaeSolanaWallet,
} from '@/lib/solana/asol-solana-client'
import {
  ASOL_BASE_SEPOLIA_ESMS_ADDRESS,
  AAE_BASE_SEPOLIA_ESMS_ADDRESS,
  BASE_SEPOLIA_ESMS_ABI,
  formatEvmEsmsAmount,
} from '@/lib/solana/base-sepolia-esms'
import { formatEsmsRawAmount } from '@/lib/solana/esms'
import { getSolanaNetworkConfig } from '@/lib/solana/network-config'
import { useToast } from '@/hooks/use-toast'

const ESMS_KEYS = ['spirit', 'essence', 'matter', 'substance'] as const

export type EsmsBalanceMap = Record<(typeof ESMS_KEYS)[number], string>

interface SolanaWalletContextValue {
  balances: EsmsBalanceMap | null
  evmBalances: EsmsBalanceMap | null
  connected: boolean
  publicKey: string | null
  refreshing: boolean
  wallet: AaeSolanaWallet | null
  refreshBalances(): Promise<void>
}

const SolanaWalletContext = createContext<SolanaWalletContextValue | null>(null)

function SolanaWalletState({ children }: { children: ReactNode }) {
  const { connection } = useConnection()
  const { connected: adapterConnected, publicKey: adapterPublicKey } = useWallet()
  const anchorWallet = useAnchorWallet()
  const dynamicWallets = useUserWallets()
  const dynamicEvmWallet = dynamicWallets.find(wallet => wallet.chain === 'EVM')
  const dynamicSolanaWallet = dynamicWallets.find(wallet => wallet.chain === 'SOL')
  const [dynamicSigner, setDynamicSigner] = useState<AaeSolanaWallet | null>(null)
  const [balances, setBalances] = useState<EsmsBalanceMap | null>(null)
  const [evmBalances, setEvmBalances] = useState<EsmsBalanceMap | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const wallet = anchorWallet ?? dynamicSigner
  const publicKey = adapterPublicKey ?? dynamicSigner?.publicKey ?? null
  const solanaAddress = publicKey?.toBase58() ?? null
  const evmAddress = dynamicEvmWallet?.address ?? null
  const solanaAddressRef = useRef(solanaAddress)
  const evmAddressRef = useRef(evmAddress)

  useEffect(() => {
    solanaAddressRef.current = solanaAddress
    setBalances(null)
  }, [solanaAddress])
  useEffect(() => {
    evmAddressRef.current = evmAddress
    setEvmBalances(null)
  }, [evmAddress])

  useEffect(() => {
    let cancelled = false
    if (!dynamicSolanaWallet) {
      setDynamicSigner(null)
      return
    }
    const connector = dynamicSolanaWallet.connector as unknown as {
      getSigner<T>(): Promise<T | undefined>
    }
    void connector
      .getSigner<{
        signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>
        signAllTransactions<T extends Transaction | VersionedTransaction>(
          transactions: T[]
        ): Promise<T[]>
      }>()
      .then(signer => {
        if (cancelled || !signer) return
        setDynamicSigner({
          publicKey: new PublicKey(dynamicSolanaWallet.address),
          signTransaction: transaction => signer.signTransaction(transaction),
          signAllTransactions: transactions => signer.signAllTransactions(transactions),
        })
      })
      .catch(() => {
        if (!cancelled) setDynamicSigner(null)
      })
    return () => {
      cancelled = true
    }
  }, [dynamicSolanaWallet])

  const refreshBalances = useCallback(async () => {
    await Promise.allSettled([
      (async () => {
        if (!publicKey || !wallet) {
          setBalances(null)
          return
        }
        const requestedAddress = publicKey.toBase58()
        const raw = await new AaeSolanaClient({ connection, wallet }).readEsmsBalances(publicKey)
        if (solanaAddressRef.current !== requestedAddress) return
        setBalances(
          Object.fromEntries(
            raw.map((amount, index) => [ESMS_KEYS[index], formatEsmsRawAmount(amount)])
          ) as EsmsBalanceMap
        )
      })(),
      (async () => {
        if (!dynamicEvmWallet || !/^0x[0-9a-fA-F]{40}$/.test(dynamicEvmWallet.address)) {
          setEvmBalances(null)
          return
        }
        const address = dynamicEvmWallet.address as `0x${string}`
        const requestedAddress = dynamicEvmWallet.address
        const raw = (await createPublicClient({
          chain: baseSepolia,
          transport: http(process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL),
        }).readContract({
          address: AAE_BASE_SEPOLIA_ESMS_ADDRESS,
          abi: BASE_SEPOLIA_ESMS_ABI,
          functionName: 'balanceOfBatch',
          args: [
            [address, address, address, address],
            [0n, 1n, 2n, 3n],
          ],
        })) as readonly bigint[]
        if (evmAddressRef.current !== requestedAddress) return
        setEvmBalances(
          Object.fromEntries(
            raw.map((amount, index) => [ESMS_KEYS[index], formatEvmEsmsAmount(amount)])
          ) as EsmsBalanceMap
        )
      })(),
    ])
  }, [connection, dynamicEvmWallet, publicKey, wallet])

  const refreshSafely = useCallback(async () => {
    setRefreshing(true)
    try {
      await refreshBalances()
    } catch {
      // Each balance surface degrades to its last known value during RPC outages.
    } finally {
      setRefreshing(false)
    }
  }, [refreshBalances])

  useEffect(() => {
    void refreshSafely()
    if (!publicKey && !dynamicEvmWallet) return
    const timer = setInterval(() => void refreshSafely(), 20_000)
    return () => clearInterval(timer)
  }, [dynamicEvmWallet, publicKey, refreshSafely])

  const value = useMemo(
    () => ({
      balances,
      evmBalances,
      connected: adapterConnected || Boolean(dynamicSigner),
      publicKey: publicKey?.toBase58() ?? null,
      refreshing,
      wallet,
      refreshBalances: refreshSafely,
    }),
    [
      adapterConnected,
      balances,
      dynamicSigner,
      evmBalances,
      publicKey,
      refreshSafely,
      refreshing,
      wallet,
    ]
  )
  return <SolanaWalletContext.Provider value={value}>{children}</SolanaWalletContext.Provider>
}

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  const networkConfig = useMemo(() => getSolanaNetworkConfig(), [])
  const rpcUrl = networkConfig.rpcUrls[0]
  // WalletProvider also auto-discovers Wallet Standard implementations, which
  // is how Backpack and Dynamic Global Wallet join these explicit adapters.
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter({ network: networkConfig.walletNetwork }),
    ],
    [networkConfig.walletNetwork]
  )
  return (
    <ConnectionProvider endpoint={rpcUrl} config={{ commitment: networkConfig.commitment }}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <SolanaWalletState>
            {children}
            <SolanaTransactionToastListener />
          </SolanaWalletState>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}

export function useSolanaWalletState(): SolanaWalletContextValue {
  const value = useContext(SolanaWalletContext)
  if (!value) throw new Error('useSolanaWalletState must be used inside SolanaWalletProvider')
  return value
}

export function SolanaWalletConnectButton({ compact = false }: { compact?: boolean }) {
  return (
    <WalletMultiButton
      className={
        compact
          ? 'asol-solana-wallet-button aae-solana-wallet-button asol-solana-wallet-button-compact aae-solana-wallet-button-compact'
          : 'asol-solana-wallet-button aae-solana-wallet-button'
      }
    />
  )
}

export function DualChainNetworkBadge() {
  const label = useMemo(() => getSolanaNetworkConfig().networkBadgeLabel, [])
  return (
    <span
      className="rounded-full border border-violet-400/30 bg-violet-950/40 px-2 py-1 font-mono text-[10px] uppercase tracking-wider text-violet-200 hover:bg-violet-900/50"
      aria-label={label}
    >
      {label}
    </span>
  )
}

/** Wallet-adapter or Dynamic-backed ASOL client; confirmed writes emit Explorer toasts. */
export function useAsolSolanaClient(): AsolSolanaClient | null {
  const { connection } = useConnection()
  const { wallet } = useSolanaWalletState()
  return useMemo(() => {
    if (!wallet) return null
    return new AsolSolanaClient({ connection, wallet })
  }, [connection, wallet])
}

export const useAaeSolanaClient = useAsolSolanaClient

/** Global notification bridge catches writes made by any browser ASOL client. */
function SolanaTransactionToastListener() {
  const { toast } = useToast()
  useEffect(() => {
    const onConfirmed = (event: Event) => {
      const transaction = (event as CustomEvent<AsolSolanaTransaction>).detail
      const label =
        transaction.type === 'persona'
          ? 'Persona commitment'
          : transaction.type === 'claim'
            ? 'ESMS claim'
            : 'ESMS redemption'
      toast({
        title: `${label} confirmed`,
        description: (
          <a
            href={transaction.explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2"
          >
            View transaction on Solana Explorer
          </a>
        ),
      })
    }
    window.addEventListener(ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT, onConfirmed)
    window.addEventListener(AAE_SOLANA_TRANSACTION_CONFIRMED_EVENT, onConfirmed)
    return () => {
      window.removeEventListener(ASOL_SOLANA_TRANSACTION_CONFIRMED_EVENT, onConfirmed)
      window.removeEventListener(AAE_SOLANA_TRANSACTION_CONFIRMED_EVENT, onConfirmed)
    }
  }, [toast])
  return null
}
