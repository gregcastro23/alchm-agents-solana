import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const readSource = (relativePath: string) => readFileSync(join(process.cwd(), relativePath), 'utf8')

const targetFiles = [
  'components/TokenHUD.tsx',
  'components/Navigation.tsx',
  'components/navigation/SideNavBar.tsx',
  'app/(app)/economy/EconomyDashboard.tsx',
  'app/(app)/yield/YieldHub.tsx',
  'components/economy/LivePriceIndexTicker.tsx',
  'components/profile/ProfileYieldPanel.tsx',
  'components/staking/SwapEssenceModal.tsx',
  'components/misc/unified-multi-agent-chat.tsx',
  'components/alchemy/JingWordDuelClash.tsx',
  'app/(app)/gallery/chat/[id]/chat-client.tsx',
  'app/(app)/gallery/group/[id]/group-client.tsx',
  'app/page.tsx',
  'app/(app)/pricing/page.tsx',
  'desktop-shell/src/main.ts',
] as const

describe('ESMS user-facing copy contract', () => {
  it('keeps deprecated economy language out of the targeted surfaces', () => {
    const source = targetFiles.map(readSource).join('\n')

    expect(source).not.toMatch(
      /Cosmic Tokens|Cosmic Yield|Cosmic Energy|Alchm Coins|Spirit Fuel|Elemental Credits|Token Store|Upgrade Tier|Subscription Portal|Daily Cosmic Drops|Daily Streak Reward|Free Token Claim|Pay with Tokens|Consume Balance|Get Premium 2\.0x Multiplier/i
    )
  })

  it('provides direct treasury and bundle acquisition paths', () => {
    const tokenHud = readSource('components/TokenHUD.tsx')
    const navigation = readSource('components/Navigation.tsx')
    const pricing = readSource('app/(app)/pricing/page.tsx')

    expect(tokenHud).toContain('href="/economy"')
    expect(tokenHud).toContain('href="/shop?tab=tokens"')
    expect(navigation).toContain('ESMS Treasury')
    expect(navigation).toContain('Acquire ESMS Bundles')
    expect(pricing).toContain('Acquire ESMS Bundles')
    expect(pricing).toContain('/shop?tab=tokens')
  })

  it('uses the canonical daily yield states', () => {
    const economyDashboard = readSource('app/(app)/economy/EconomyDashboard.tsx')
    const yieldHub = readSource('app/(app)/yield/YieldHub.tsx')
    const profileYield = readSource('components/profile/ProfileYieldPanel.tsx')

    expect(economyDashboard).toContain('Claim Daily Yield')
    expect(economyDashboard).toContain('Yield Harvested Today')
    expect(economyDashboard).toContain('Alchm Agents Daily ESMS Yield')
    expect(economyDashboard).not.toContain('Harvest each site')
    expect(yieldHub).toContain('Alchm Agents Treasury')
    expect(yieldHub).toContain('Alchm Kitchen Reserves')
    expect(yieldHub).toContain('Active Sync')
    expect(profileYield).toContain('Shared ESMS Treasury')
    expect(profileYield).toContain('Claim Daily Yield')
  })

  it('labels ESMS reserves, swaps, pots, and networks precisely', () => {
    const navigation = readSource('components/Navigation.tsx')
    const ticker = readSource('components/economy/LivePriceIndexTicker.tsx')
    const swap = readSource('components/staking/SwapEssenceModal.tsx')
    const duel = readSource('components/alchemy/JingWordDuelClash.tsx')
    const landing = readSource('app/page.tsx')

    expect(navigation).toContain('ESMS Reserves (EVM / Solana Devnet)')
    expect(
      navigation.match(/ESMS Reserves \(EVM \/ Solana Devnet\)/g)?.length ?? 0
    ).toBeGreaterThanOrEqual(3)
    expect(ticker).toContain('Solana Devnet · Token-2022')
    expect(swap).toContain('Swap ESMS Tokens')
    expect(duel).toContain('ESMS Pot')
    expect(landing).toContain('ESMS Pot')
    expect(landing).not.toMatch(/\belemental yield\b/i)
    expect(swap).not.toContain('Arc testnet explorer')
  })

  it('uses ESMS reserve language for insufficient-balance prompts', () => {
    const unifiedChat = readSource('components/misc/unified-multi-agent-chat.tsx')
    const galleryChat = readSource('app/(app)/gallery/chat/[id]/chat-client.tsx')
    const groupChat = readSource('app/(app)/gallery/group/[id]/group-client.tsx')

    expect(unifiedChat).toContain('Insufficient ESMS Reserves')
    expect(galleryChat).toContain('Insufficient ESMS Reserves')
    expect(groupChat).toContain('Insufficient ESMS Reserves')
    expect(unifiedChat).toContain('Acquire ESMS Bundles')
    expect(galleryChat).toContain('Acquire ESMS Bundles')
    expect(groupChat).toContain('Acquire ESMS Bundles')
  })
})
