// @vitest-environment node

import { afterEach, describe, expect, it } from 'vitest'
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base'
import {
  getSolanaNetworkConfig,
  SOLANA_MAINNET_GENESIS_HASH,
  SOLANA_DEVNET_GENESIS_HASH,
} from '@/lib/solana/network-config'
import { clearGenesisHashCache } from '@/lib/solana/rpc-failover'

describe('SolanaNetworkConfig Architecture (Workstream 2)', () => {
  it('resolves default Devnet configuration in non-production environments', () => {
    const config = getSolanaNetworkConfig({
      NODE_ENV: 'development',
    })

    expect(config.network).toBe('devnet')
    expect(config.isMainnet).toBe(false)
    expect(config.walletNetwork).toBe(WalletAdapterNetwork.Devnet)
    expect(config.expectedGenesisHash).toBeNull()
    expect(config.explorerClusterParam).toBe('cluster=devnet')
    expect(config.networkBadgeLabel).toBe('Base + Solana Devnet')
    expect(config.rpcUrls).toEqual(['https://api.devnet.solana.com'])

    const txUrl = config.buildExplorerTxUrl('mockSig12345')
    expect(txUrl).toBe('https://explorer.solana.com/tx/mockSig12345?cluster=devnet')

    // assertGenesisHash should be non-throwing for devnet
    expect(() => config.assertGenesisHash(SOLANA_DEVNET_GENESIS_HASH)).not.toThrow()
    expect(() => config.assertGenesisHash('random-hash')).not.toThrow()
  })

  it('resolves Mainnet-Beta configuration with clean explorer URLs and strict genesis expectation', () => {
    const mainnetRpc = 'https://solana-mainnet.g.alchemy.com/v2/testkey'
    const config = getSolanaNetworkConfig({
      NODE_ENV: 'development',
      SOLANA_NETWORK: 'mainnet-beta',
      SOLANA_RPC_URL: mainnetRpc,
    })

    expect(config.network).toBe('mainnet-beta')
    expect(config.isMainnet).toBe(true)
    expect(config.walletNetwork).toBe(WalletAdapterNetwork.Mainnet)
    expect(config.expectedGenesisHash).toBe(SOLANA_MAINNET_GENESIS_HASH)
    expect(config.explorerClusterParam).toBe('')
    expect(config.networkBadgeLabel).toBe('Base + Solana Mainnet')
    expect(config.rpcUrls).toEqual([mainnetRpc])

    const txUrl = config.buildExplorerTxUrl('mockMainnetSig5678')
    expect(txUrl).toBe('https://explorer.solana.com/tx/mockMainnetSig5678')
    expect(txUrl).not.toContain('cluster=devnet')

    // Genesis verification
    expect(() => config.assertGenesisHash(SOLANA_MAINNET_GENESIS_HASH)).not.toThrow()
    expect(() => config.assertGenesisHash(SOLANA_DEVNET_GENESIS_HASH)).toThrow(
      /Solana cluster genesis mismatch/
    )
  })

  it('fails closed in production if SOLANA_NETWORK is omitted or set to devnet', () => {
    // 1. Omitted network in production
    expect(() =>
      getSolanaNetworkConfig({
        NODE_ENV: 'production',
      })
    ).toThrow(/SOLANA_NETWORK must be explicitly set to "mainnet-beta" in production/)

    // 2. Explicit devnet in production without override
    expect(() =>
      getSolanaNetworkConfig({
        NODE_ENV: 'production',
        SOLANA_NETWORK: 'devnet',
      })
    ).toThrow(/Devnet is prohibited in production/)

    // 3. Mainnet-beta in production requires at least one RPC URL
    expect(() =>
      getSolanaNetworkConfig({
        NODE_ENV: 'production',
        SOLANA_NETWORK: 'mainnet-beta',
        SOLANA_RPC_URL: '',
        NEXT_PUBLIC_SOLANA_RPC_URL: '',
      })
    ).toThrow(/Mainnet-Beta requires at least one configured RPC URL/)
  })

  it('permits devnet in production when SOLANA_ALLOW_DEVNET_IN_PROD is true', () => {
    // Both server-side and client-inlined flags permit devnet
    const configWithServerFlag = getSolanaNetworkConfig({
      NODE_ENV: 'production',
      SOLANA_ALLOW_DEVNET_IN_PROD: 'true',
    })
    expect(configWithServerFlag.network).toBe('devnet')
    expect(configWithServerFlag.isMainnet).toBe(false)
    expect(configWithServerFlag.rpcUrls).toEqual(['https://api.devnet.solana.com'])

    const configWithPublicFlag = getSolanaNetworkConfig({
      NODE_ENV: 'production',
      NEXT_PUBLIC_SOLANA_ALLOW_DEVNET_IN_PROD: 'true',
      SOLANA_NETWORK: 'devnet',
    })
    expect(configWithPublicFlag.network).toBe('devnet')
    expect(configWithPublicFlag.isMainnet).toBe(false)
  })

  it('supports comma-delimited RPC URLs for failover lists', () => {
    const config = getSolanaNetworkConfig({
      NODE_ENV: 'development',
      SOLANA_NETWORK: 'mainnet-beta',
      SOLANA_RPC_URLS: 'https://rpc1.solana.com, https://rpc2.solana.com ,https://rpc3.solana.com',
    })

    expect(config.rpcUrls).toEqual([
      'https://rpc1.solana.com',
      'https://rpc2.solana.com',
      'https://rpc3.solana.com',
    ])
  })

  it('supports localnet configuration for local testing', () => {
    const config = getSolanaNetworkConfig({
      NODE_ENV: 'development',
      SOLANA_NETWORK: 'localnet',
    })

    expect(config.network).toBe('localnet')
    expect(config.isMainnet).toBe(false)
    expect(config.rpcUrls).toEqual(['http://127.0.0.1:8899'])
  })

  describe('Step 0: Cluster Safety & Failover Genesis Assertions', () => {
    const originalEnv = { ...process.env }

    afterEach(() => {
      process.env = { ...originalEnv }
      clearGenesisHashCache()
    })

    it('resolveSolanaRpcUrls never appends devnet or testnet in Mainnet-Beta', async () => {
      const { resolveSolanaRpcUrls } = await import('@/lib/solana/rpc-failover')
      process.env.SOLANA_NETWORK = 'mainnet-beta'
      process.env.SOLANA_RPC_URL = 'https://mainnet.helius-rpc.com/?api-key=test'

      const urls = resolveSolanaRpcUrls()
      expect(urls).toContain('https://mainnet.helius-rpc.com/?api-key=test')
      expect(urls.some(u => u.includes('devnet') || u.includes('testnet'))).toBe(false)
    })

    it('resolveSolanaRpcUrls strictly throws if devnet URL is passed in Mainnet-Beta', async () => {
      const { resolveSolanaRpcUrls } = await import('@/lib/solana/rpc-failover')
      process.env.SOLANA_NETWORK = 'mainnet-beta'
      process.env.SOLANA_RPC_URL = 'https://api.devnet.solana.com'

      expect(() => resolveSolanaRpcUrls()).toThrow(/Forbidden non-mainnet RPC url in Mainnet-Beta/)
    })

    it('withSolanaRpcFailover skips endpoints that fail genesis hash assertion', async () => {
      const { withSolanaRpcFailover, clearGenesisHashCache } =
        await import('@/lib/solana/rpc-failover')
      clearGenesisHashCache()
      process.env.SOLANA_NETWORK = 'mainnet-beta'
      process.env.SOLANA_RPC_URL = 'https://mock.mainnet1.com'

      const callLog: string[] = []
      const mockFactory = (endpoint: string) => {
        return {
          getGenesisHash: async () => {
            if (endpoint.includes('bad')) return SOLANA_DEVNET_GENESIS_HASH
            return SOLANA_MAINNET_GENESIS_HASH
          },
        } as any
      }

      const result = await withSolanaRpcFailover({
        rpcUrls: ['https://mock.bad.com', 'https://mock.good.com'],
        connectionFactory: mockFactory,
        operation: async (conn, endpoint) => {
          callLog.push(endpoint)
          return `success-from-${endpoint}`
        },
      })

      expect(callLog).toEqual(['https://mock.good.com'])
      expect(result).toBe('success-from-https://mock.good.com')
    })

    it('withSolanaRpcFailover immediately aborts on deterministic program errors without trying further endpoints', async () => {
      const { withSolanaRpcFailover } = await import('@/lib/solana/rpc-failover')
      process.env.SOLANA_NETWORK = 'devnet'

      const attemptedEndpoints: string[] = []
      const deterministicError = new Error(
        'Transaction simulation failed: Error processing Instruction 0: custom program error: 0x1770'
      )

      await expect(
        withSolanaRpcFailover({
          rpcUrls: [
            'https://rpc1.example.com',
            'https://rpc2.example.com',
            'https://rpc3.example.com',
          ],
          connectionFactory: () => ({}) as any,
          operation: async (conn, endpoint) => {
            attemptedEndpoints.push(endpoint)
            throw deterministicError
          },
        })
      ).rejects.toThrow(/Transaction simulation failed/)

      // Must have aborted on the very first endpoint!
      expect(attemptedEndpoints).toEqual(['https://rpc1.example.com'])
    })
  })
})
