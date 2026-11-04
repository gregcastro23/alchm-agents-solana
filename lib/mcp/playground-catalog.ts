import { rateStats, type CoreStats } from '@/lib/agents/rating'

export type McpV140ToolName =
  | 'get_live_sky_transits'
  | 'alchemize_ingredients'
  | 'generate_cosmic_recipe'
  | 'compute_synastry_overlay'
  | 'get_transit_natal_overlay'
  | 'compute_triplicate_synastry'
  | 'create_evidence_snapshot'
  | 'submit_recipe_reflection'

export type McpSettlementRail = 'arc-eip3009' | 'solana-amm' | 'base-x402'

export interface McpBillingAmounts {
  spirit: number
  essence: number
  matter: number
  substance: number
}

export interface NormalizedMcpBillingReceipt {
  status: 'charged' | 'replayed' | 'exempt'
  debited: boolean
  replayed: boolean
  amounts: McpBillingAmounts
  cost: McpBillingAmounts
  idempotencyKey: string
  rail: McpSettlementRail
  x402AtomicUsdc: string
  txReference: string
  settledAt: string
}

export interface McpToolDefinition {
  name: McpV140ToolName
  title: string
  category: 'ephemeris' | 'culinary' | 'synastry' | 'attestation'
  description: string
  mutating: boolean
  esmsCost: McpBillingAmounts
  x402AtomicUsdc: string
  defaultArgs: Record<string, unknown>
  stats: CoreStats
}

export const MCP_V140_TOOL_CATALOG: readonly McpToolDefinition[] = [
  {
    name: 'get_live_sky_transits',
    title: 'Live Sky Transits',
    category: 'ephemeris',
    description:
      'Fetch real-time planetary longitudes, dignity tiers, lunar phase archetype, and active harmonic aspects.',
    mutating: false,
    esmsCost: { spirit: 1, essence: 0, matter: 0, substance: 1 },
    x402AtomicUsdc: '5000',
    defaultArgs: {
      timestamp: '2026-11-04T18:00:00Z',
      includeMinorAspects: true,
      zodiacSystem: 'tropical',
    },
    stats: {
      power: 88,
      resonance: 92,
      wisdom: 96,
      charisma: 84,
      intuition: 95,
      adaptability: 91,
      vitality: 89,
    },
  },
  {
    name: 'alchemize_ingredients',
    title: 'Alchemize Ingredients',
    category: 'culinary',
    description:
      'Map raw culinary ingredients to Spirit, Essence, Matter, and Substance thermodynamic vectors and planetary rulers.',
    mutating: false,
    esmsCost: { spirit: 1, essence: 2, matter: 1, substance: 0 },
    x402AtomicUsdc: '8000',
    defaultArgs: {
      ingredients: ['saffron threads', 'black garlic', 'blood orange zest', 'wild fennel pollen'],
      targetElement: 'Fire',
    },
    stats: {
      power: 86,
      resonance: 91,
      wisdom: 90,
      charisma: 89,
      intuition: 92,
      adaptability: 94,
      vitality: 90,
    },
  },
  {
    name: 'generate_cosmic_recipe',
    title: 'Generate Cosmic Recipe',
    category: 'culinary',
    description:
      'Synthesize a transit-aligned WTEN culinary recipe with ESMS macro-balance, planetary timing, and substitution notes.',
    mutating: true,
    esmsCost: { spirit: 3, essence: 3, matter: 2, substance: 2 },
    x402AtomicUsdc: '15000',
    defaultArgs: {
      agentId: 'mars-aries',
      mealType: 'dinner',
      dietaryFocus: 'high-vitality',
      dominantPlanet: 'Mars',
    },
    stats: {
      power: 93,
      resonance: 94,
      wisdom: 91,
      charisma: 92,
      intuition: 90,
      adaptability: 93,
      vitality: 95,
    },
  },
  {
    name: 'compute_synastry_overlay',
    title: 'Dyadic Synastry Overlay',
    category: 'synastry',
    description:
      'Compute dyadic aspect reception, elemental resonance, and Pentacle Zone compatibility between two natal charts.',
    mutating: false,
    esmsCost: { spirit: 2, essence: 2, matter: 0, substance: 1 },
    x402AtomicUsdc: '10000',
    defaultArgs: {
      subjectA: { id: 'johannes-kepler', sunSign: 'Capricorn', moonSign: 'Gemini' },
      subjectB: { id: 'rumi', sunSign: 'Libra', moonSign: 'Pisces' },
    },
    stats: {
      power: 89,
      resonance: 96,
      wisdom: 93,
      charisma: 94,
      intuition: 95,
      adaptability: 90,
      vitality: 88,
    },
  },
  {
    name: 'get_transit_natal_overlay',
    title: 'Transit-to-Natal Bi-Wheel',
    category: 'ephemeris',
    description:
      'Project current sky transits onto an agent or user natal chart to compute live Resonance Surge (+12/+8/+4) and PVR delta.',
    mutating: false,
    esmsCost: { spirit: 2, essence: 1, matter: 0, substance: 2 },
    x402AtomicUsdc: '10000',
    defaultArgs: {
      agentId: 'johannes-kepler',
      natalDate: '1571-12-27T14:30:00Z',
      transitTimestamp: '2026-11-04T18:00:00Z',
    },
    stats: {
      power: 91,
      resonance: 94,
      wisdom: 95,
      charisma: 87,
      intuition: 96,
      adaptability: 92,
      vitality: 90,
    },
  },
  {
    name: 'compute_triplicate_synastry',
    title: 'Triplicate Council Synastry',
    category: 'synastry',
    description:
      'Evaluate 3-vessel triangular harmonic synthesis (User + 2 Agents) with composite Pentacle Zone coverage and Seal unlocks.',
    mutating: true,
    esmsCost: { spirit: 4, essence: 3, matter: 1, substance: 2 },
    x402AtomicUsdc: '20000',
    defaultArgs: {
      vessels: ['johannes-kepler', 'rumi', 'ibn-sina-avicenna'],
      intent: 'Alchemical Council Synthesis',
    },
    stats: {
      power: 95,
      resonance: 97,
      wisdom: 96,
      charisma: 94,
      intuition: 96,
      adaptability: 93,
      vitality: 92,
    },
  },
  {
    name: 'create_evidence_snapshot',
    title: 'Create Evidence Snapshot',
    category: 'attestation',
    description:
      'Commit a deterministic 64-dim JEPA persona & transit evidence hash to Walrus / Circle Arc with idempotency protection.',
    mutating: true,
    esmsCost: { spirit: 3, essence: 1, matter: 3, substance: 3 },
    x402AtomicUsdc: '15000',
    defaultArgs: {
      agentId: 'johannes-kepler',
      epochNumber: 144,
      personaDriftBps: 42,
      storageTarget: 'walrus-arc-dual',
    },
    stats: {
      power: 94,
      resonance: 90,
      wisdom: 97,
      charisma: 86,
      intuition: 93,
      adaptability: 91,
      vitality: 94,
    },
  },
  {
    name: 'submit_recipe_reflection',
    title: 'Submit Recipe Reflection',
    category: 'attestation',
    description:
      'Record an agent-verified culinary alteration or sensory reflection back to the shared WTEN 1,000-recipe ledger.',
    mutating: true,
    esmsCost: { spirit: 2, essence: 3, matter: 2, substance: 1 },
    x402AtomicUsdc: '12000',
    defaultArgs: {
      agentId: 'ibn-sina-avicenna',
      recipeId: 'wten-saffron-broth-042',
      reflection:
        'Increased cardamom infusion by 15% under waxing Moon in Pisces to elevate Essence.',
      rating: 96,
    },
    stats: {
      power: 88,
      resonance: 93,
      wisdom: 92,
      charisma: 91,
      intuition: 90,
      adaptability: 92,
      vitality: 93,
    },
  },
] as const

export function getMcpToolDefinition(name: string): McpToolDefinition | undefined {
  return MCP_V140_TOOL_CATALOG.find(t => t.name === name)
}

export function rateMcpToolReadiness(tool: McpToolDefinition) {
  return rateStats(tool.stats)
}

/**
 * Mirrors `backend/alchm_mcp.py::_prepare_arguments` so in-browser JSON-RPC
 * previews and API calls always attach `_meta.idempotencyKey`.
 */
export function prepareMcpArguments(
  rawArgs: Record<string, unknown> = {},
  idempotencyKey?: string
): Record<string, unknown> {
  const prepared: Record<string, unknown> = { ...rawArgs }
  const existingMeta =
    typeof prepared._meta === 'object' && prepared._meta !== null
      ? { ...(prepared._meta as Record<string, unknown>) }
      : {}

  if (idempotencyKey && idempotencyKey.trim().length > 0) {
    existingMeta.idempotencyKey = idempotencyKey.trim()
  }

  if (Object.keys(existingMeta).length > 0) {
    prepared._meta = existingMeta
  }

  return prepared
}

/**
 * Mirrors `backend/alchm_mcp.py::_normalize_billing` to ensure `debited`,
 * `replayed`, and `cost` are always populated from `status` and `amounts`.
 */
export function normalizeMcpBillingReceipt(input: {
  status: 'charged' | 'replayed' | 'exempt'
  amounts: McpBillingAmounts
  idempotencyKey: string
  rail: McpSettlementRail
  x402AtomicUsdc: string
  txReference: string
  settledAt?: string
}): NormalizedMcpBillingReceipt {
  const zeroAmounts: McpBillingAmounts = { spirit: 0, essence: 0, matter: 0, substance: 0 }
  const effectiveAmounts = input.status === 'charged' ? input.amounts : zeroAmounts
  return {
    status: input.status,
    debited: input.status === 'charged',
    replayed: input.status === 'replayed',
    amounts: effectiveAmounts,
    cost: effectiveAmounts,
    idempotencyKey: input.idempotencyKey,
    rail: input.rail,
    x402AtomicUsdc: input.status === 'charged' ? input.x402AtomicUsdc : '0',
    txReference: input.txReference,
    settledAt: input.settledAt ?? new Date().toISOString(),
  }
}

export function buildX402PaymentPreview(
  tool: McpToolDefinition,
  rail: McpSettlementRail,
  idempotencyKey: string
) {
  const networkMap: Record<
    McpSettlementRail,
    { caip2: string; asset: string; facilitator: string }
  > = {
    'arc-eip3009': {
      caip2: 'eip155:5042002',
      asset: '0x3600000000000000000000000000000000000000',
      facilitator: 'self-settled (Circle Arc EIP-3009)',
    },
    'solana-amm': {
      caip2: 'solana:mainnet-beta',
      asset: 'ESMSConstellationAMM11111111111111111111111',
      facilitator: 'Constellation AMM Pool Swap-to-Settle',
    },
    'base-x402': {
      caip2: 'eip155:84532',
      asset: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
      facilitator: 'https://x402.org/facilitator (Base Sepolia)',
    },
  }

  const net = networkMap[rail]
  return {
    scheme: 'exact',
    network: net.caip2,
    asset: net.asset,
    maxAmountRequired: tool.x402AtomicUsdc,
    resource: `mcp://alchm-agents/tools/${tool.name}`,
    idempotencyKey,
    facilitator: net.facilitator,
  }
}
