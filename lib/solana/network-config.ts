import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'

export type SolanaNetwork = 'mainnet-beta' | 'devnet' | 'localnet'

export const SOLANA_MAINNET_GENESIS_HASH = '5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d'
export const SOLANA_DEVNET_GENESIS_HASH = 'EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG'

export type SolanaCommitment = 'processed' | 'confirmed' | 'finalized'

export interface SolanaNetworkConfig {
  network: SolanaNetwork
  isMainnet: boolean
  rpcUrls: readonly string[]
  expectedGenesisHash: string | null
  walletNetwork: WalletAdapterNetwork
  explorerClusterParam: string
  networkBadgeLabel: string
  commitment: SolanaCommitment
  buildExplorerTxUrl(signature: string): string
  assertGenesisHash(actualGenesisHash: string): void
}

/**
 * Resolves canonical SolanaNetworkConfig from process environment.
 *
 * Fail-Closed Rules:
 * 1. In production (`NODE_ENV === 'production'`), fallback to Devnet is strictly prohibited.
 * 2. If mainnet-beta is targeted, RPC endpoints must be explicitly configured and non-empty.
 * 3. `assertGenesisHash()` strictly asserts against the canonical Solana Mainnet-Beta genesis hash.
 */
export function getSolanaNetworkConfig(
  customEnv?: NodeJS.ProcessEnv | Record<string, string | undefined>
): SolanaNetworkConfig {
  const nodeEnv = customEnv
    ? (customEnv.NODE_ENV ?? 'development')
    : (process.env.NODE_ENV ?? 'development')
  const isProd = nodeEnv === 'production'

  // Resolve targeted network with explicit reads for Next.js compiler static inlining
  const configuredNetwork = (
    customEnv
      ? (customEnv.SOLANA_NETWORK ?? customEnv.NEXT_PUBLIC_SOLANA_NETWORK ?? '')
      : (process.env.SOLANA_NETWORK ?? process.env.NEXT_PUBLIC_SOLANA_NETWORK ?? '')
  )
    .toLowerCase()
    .trim()

  let network: SolanaNetwork
  if (configuredNetwork === 'mainnet' || configuredNetwork === 'mainnet-beta') {
    network = 'mainnet-beta'
  } else if (configuredNetwork === 'devnet') {
    network = 'devnet'
  } else if (configuredNetwork === 'localnet' || configuredNetwork === 'localhost') {
    network = 'localnet'
  } else if (isProd) {
    throw new Error(
      'SOLANA_NETWORK must be explicitly set to "mainnet-beta" in production. Devnet fallbacks are prohibited.'
    )
  } else {
    // Default to devnet in development / test only
    network = 'devnet'
  }

  // Prevent devnet in production
  const allowDevnetInProd = customEnv
    ? customEnv.SOLANA_ALLOW_DEVNET_IN_PROD
    : process.env.SOLANA_ALLOW_DEVNET_IN_PROD
  if (isProd && network === 'devnet' && allowDevnetInProd !== 'true') {
    throw new Error(
      'Devnet is prohibited in production. Configure SOLANA_NETWORK=mainnet-beta and private Mainnet RPCs.'
    )
  }

  // Resolve RPC URLs with explicit reads
  const rpcListRaw = customEnv
    ? (customEnv.SOLANA_RPC_URLS ??
      customEnv.SOLANA_RPC_URL ??
      customEnv.NEXT_PUBLIC_SOLANA_RPC_URL ??
      (network === 'mainnet-beta'
        ? ''
        : network === 'localnet'
          ? 'http://127.0.0.1:8899'
          : 'https://api.devnet.solana.com'))
    : (process.env.SOLANA_RPC_URLS ??
      process.env.SOLANA_RPC_URL ??
      process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
      (network === 'mainnet-beta'
        ? ''
        : network === 'localnet'
          ? 'http://127.0.0.1:8899'
          : 'https://api.devnet.solana.com'))

  const rpcUrls = rpcListRaw
    .split(',')
    .map(url => url.trim())
    .filter(Boolean)

  if (rpcUrls.length === 0) {
    if (network === 'mainnet-beta') {
      throw new Error(
        'Mainnet-Beta requires at least one configured RPC URL in SOLANA_RPC_URL or NEXT_PUBLIC_SOLANA_RPC_URL.'
      )
    }
    rpcUrls.push('https://api.devnet.solana.com')
  }

  const isMainnet = network === 'mainnet-beta'
  const expectedGenesisHash = isMainnet ? SOLANA_MAINNET_GENESIS_HASH : null
  const walletNetwork = isMainnet ? WalletAdapterNetwork.Mainnet : WalletAdapterNetwork.Devnet
  const explorerClusterParam = isMainnet ? '' : 'cluster=devnet'
  const networkBadgeLabel = isMainnet ? 'Base + Solana Mainnet' : 'Base + Solana Devnet'

  const rawCommitment = (customEnv ? customEnv.SOLANA_COMMITMENT : process.env.SOLANA_COMMITMENT)
    ?.trim()
    .toLowerCase()
  const commitment: SolanaCommitment =
    rawCommitment === 'finalized' || rawCommitment === 'confirmed' || rawCommitment === 'processed'
      ? (rawCommitment as SolanaCommitment)
      : isMainnet
        ? 'finalized'
        : 'confirmed'

  const buildExplorerTxUrl = (signature: string): string => {
    const encoded = encodeURIComponent(signature)
    return isMainnet
      ? `https://explorer.solana.com/tx/${encoded}`
      : `https://explorer.solana.com/tx/${encoded}?cluster=devnet`
  }

  const assertGenesisHash = (actualGenesisHash: string): void => {
    if (isMainnet && actualGenesisHash !== SOLANA_MAINNET_GENESIS_HASH) {
      throw new Error(
        `Solana cluster genesis mismatch! Expected Mainnet-Beta (${SOLANA_MAINNET_GENESIS_HASH}), but connected cluster reported ${actualGenesisHash}. Aborting to prevent cross-cluster execution.`
      )
    }
  }

  return {
    network,
    isMainnet,
    rpcUrls,
    expectedGenesisHash,
    walletNetwork,
    explorerClusterParam,
    networkBadgeLabel,
    commitment,
    buildExplorerTxUrl,
    assertGenesisHash,
  }
}
