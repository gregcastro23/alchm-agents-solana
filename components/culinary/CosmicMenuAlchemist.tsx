'use client'

import { useCallback, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowUpRight,
  Check,
  ChefHat,
  Clock,
  Copy,
  Flame,
  FlaskConical,
  Repeat,
  Search,
  Sparkles,
  Utensils,
  Wand2,
  X,
} from 'lucide-react'
import { VesselRatingRibbon } from '@/components/vessel/pentacle-rating-display'
import type { EsmsToken } from '@/lib/agents/rating'
import type { NormalizedMcpBillingReceipt } from '@/lib/mcp/playground-catalog'
import {
  DEFAULT_SKY_TRANSIT_CONTEXT,
  WTEN_SANCTUM_CATALOG,
  filterAndSortSanctumDishes,
  type CulinarySortMode,
  type CulinarySurgeMode,
  type SanctumRecipeEntry,
} from '@/lib/culinary/sanctum-catalog'

export interface CosmicMenuAlchemistProps {
  initialAgentFilter?: string | null
  initialEsmsFilter?: EsmsToken | 'ALL'
  initialSurgeFilter?: CulinarySurgeMode | 'ALL'
}

const ESMS_PILLS: Array<{
  key: EsmsToken | 'ALL'
  label: string
  sublabel: string
  accent: string
}> = [
  {
    key: 'ALL',
    label: 'All ESMS Elements',
    sublabel: '1,000 WTEN Dishes',
    accent: 'border-amber-400/35 bg-amber-400/10 text-amber-200',
  },
  {
    key: 'spirit',
    label: 'Spirit · Fire',
    sublabel: 'Crucible & Heat',
    accent: 'border-rose-400/35 bg-rose-500/10 text-rose-200',
  },
  {
    key: 'essence',
    label: 'Essence · Water',
    sublabel: 'Broths & Elixirs',
    accent: 'border-cyan-400/35 bg-cyan-500/10 text-cyan-200',
  },
  {
    key: 'matter',
    label: 'Matter · Earth',
    sublabel: 'Grains & Roots',
    accent: 'border-emerald-400/35 bg-emerald-500/10 text-emerald-200',
  },
  {
    key: 'substance',
    label: 'Substance · Air',
    sublabel: 'Botanicals & Citrus',
    accent: 'border-violet-400/35 bg-violet-500/10 text-violet-200',
  },
]

const SURGE_BADGE_STYLE: Record<CulinarySurgeMode, string> = {
  Inferno: 'border-rose-400/40 bg-rose-500/15 text-rose-200',
  Tempest: 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200',
  Equilibrium: 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200',
}

interface LabExecutionOutput {
  tool: 'generate_cosmic_recipe' | 'alchemize_ingredients'
  result: Record<string, unknown>
  receipt: NormalizedMcpBillingReceipt
  pvr: number
  archetype: string
}

function makeCulinaryIdempotencyKey(agentId: string, tool: string) {
  const rand = Math.random().toString(36).slice(2, 9)
  return `idem_wten_${agentId.slice(0, 8)}_${tool.slice(0, 8)}_${rand}`
}

export function CosmicMenuAlchemist({
  initialAgentFilter = null,
  initialEsmsFilter = 'ALL',
  initialSurgeFilter = 'ALL',
}: CosmicMenuAlchemistProps) {
  const [esmsFilter, setEsmsFilter] = useState<EsmsToken | 'ALL'>(initialEsmsFilter)
  const [surgeFilter, setSurgeFilter] = useState<CulinarySurgeMode | 'ALL'>(initialSurgeFilter)
  const [agentFilter, setAgentFilter] = useState<string | null>(initialAgentFilter)
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [sortBy, setSortBy] = useState<CulinarySortMode>('sky-resonance')

  // Interactive Lab state
  const [selectedChefId, setSelectedChefId] = useState<string>(() => {
    if (initialAgentFilter) {
      const matched = WTEN_SANCTUM_CATALOG.find(
        d => d.agentId.toLowerCase() === initialAgentFilter.toLowerCase()
      )
      if (matched) return matched.agentId
    }
    return WTEN_SANCTUM_CATALOG[0].agentId
  })
  const [labMealType, setLabMealType] = useState<'breakfast' | 'lunch' | 'dinner' | 'elixir'>(
    'dinner'
  )
  const [labIngredientsText, setLabIngredientsText] = useState<string>(
    'saffron threads, fermented black garlic, blood orange zest, wild fennel pollen'
  )
  const [idempotencyKey, setIdempotencyKey] = useState<string>(() =>
    makeCulinaryIdempotencyKey('paracelsus', 'generate_cosmic_recipe')
  )
  const [seenKeys, setSeenKeys] = useState<string[]>([])
  const [labRunning, setLabRunning] = useState<boolean>(false)
  const [labError, setLabError] = useState<string | null>(null)
  const [labOutput, setLabOutput] = useState<LabExecutionOutput | null>(null)
  const [copiedSupplyList, setCopiedSupplyList] = useState<boolean>(false)

  const selectedChefEntry = useMemo<SanctumRecipeEntry>(
    () => WTEN_SANCTUM_CATALOG.find(d => d.agentId === selectedChefId) ?? WTEN_SANCTUM_CATALOG[0],
    [selectedChefId]
  )

  const filteredDishes = useMemo(
    () =>
      filterAndSortSanctumDishes({
        esmsFilter,
        surgeFilter,
        agentFilter,
        searchQuery,
        sortBy,
      }),
    [agentFilter, esmsFilter, searchQuery, sortBy, surgeFilter]
  )

  const runCulinaryMcpTool = useCallback(
    async (tool: 'generate_cosmic_recipe' | 'alchemize_ingredients', overrideKey?: string) => {
      const activeKey = overrideKey ?? idempotencyKey
      setLabRunning(true)
      setLabError(null)
      try {
        const ingredients = labIngredientsText
          .split(',')
          .map(s => s.trim())
          .filter(Boolean)

        const args =
          tool === 'generate_cosmic_recipe'
            ? {
                agentId: selectedChefEntry.agentId,
                mealType: labMealType,
                dominantPlanet: selectedChefEntry.rulingPlanet,
                ingredients,
              }
            : {
                ingredients,
                targetElement: selectedChefEntry.element,
              }

        const res = await fetch('/api/mcp/playground', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool,
            arguments: args,
            idempotencyKey: activeKey,
            settlementRail: 'arc-eip3009',
            seenIdempotencyKeys: seenKeys,
          }),
        })
        const payload = await res.json()
        if (!res.ok || !payload?.ok) {
          throw new Error(payload?.error || `Culinary MCP execution failed (${res.status})`)
        }

        const receipt = payload.billing as NormalizedMcpBillingReceipt
        setLabOutput({
          tool,
          result: payload.result as Record<string, unknown>,
          receipt,
          pvr: Number(payload.pvr ?? selectedChefEntry.vesselPvr),
          archetype: String(payload.archetype ?? selectedChefEntry.vesselArchetype.title),
        })
        setSeenKeys(prev => Array.from(new Set([`${tool}::${activeKey}`, ...prev])))
      } catch (err) {
        setLabError(err instanceof Error ? err.message : 'Failed to alchemize menu')
      } finally {
        setLabRunning(false)
      }
    },
    [idempotencyKey, labIngredientsText, labMealType, seenKeys, selectedChefEntry]
  )

  const handleLoadDishIntoLab = (dish: SanctumRecipeEntry) => {
    setSelectedChefId(dish.agentId)
    setLabIngredientsText(dish.keyIngredients.join(', '))
    const newKey = makeCulinaryIdempotencyKey(dish.agentId, 'generate_cosmic_recipe')
    setIdempotencyKey(newKey)
  }

  const handleCopySupplyList = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const summary = `${selectedChefEntry.alchemizedTitle} (${selectedChefEntry.agentName} · PVR ${selectedChefEntry.vesselPvr})\nIngredients: ${labIngredientsText}\nBridge: ${selectedChefEntry.alchmKitchenUrl}`
      void navigator.clipboard.writeText(summary)
      setCopiedSupplyList(true)
      setTimeout(() => setCopiedSupplyList(false), 1800)
    }
  }

  return (
    <div className="space-y-8">
      {/* Sanctum Hero & Sky-to-Plate Telemetry Header */}
      <header className="relative overflow-hidden rounded-3xl border border-amber-400/25 bg-gradient-to-br from-[#111528]/95 via-[#0b0e1a]/95 to-[#070911] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.65)] sm:p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-amber-400/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-violet-500/10 blur-3xl" />

        <div className="relative flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.22em] text-amber-200">
                <ChefHat className="h-3.5 w-3.5" /> WTEN 1,000-Recipe Bridge
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200">
                Sky-to-Plate Resonance · {DEFAULT_SKY_TRANSIT_CONTEXT.lunarPhase}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-violet-400/30 bg-violet-500/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-violet-200">
                @alchm/mcp-server@1.4.0
              </span>
            </div>

            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-5xl">
              Culinary Alchemy Sanctum &amp; Live Sky Menu Lab
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-300 sm:text-base">
              Where historical and planetary vessels transmute the authentic{' '}
              <span className="font-semibold text-amber-200">alchm.kitchen</span> 1,000-recipe
              catalog according to their 25–99 Pentacle Vessel Rating (PVR), dominant ESMS ratios,
              and live celestial transits.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3 sm:items-end">
            <VesselRatingRibbon
              ovr={selectedChefEntry.vesselPvr}
              archetype={selectedChefEntry.vesselArchetype}
              seals={selectedChefEntry.vesselSeals}
              compact
            />
            <a
              href="https://alchm.kitchen"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-400/15 px-4 py-2.5 font-mono text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25"
            >
              <Utensils className="h-3.5 w-3.5 text-amber-300" />
              Open alchm.kitchen Sanctuary
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>

        {/* Live Sky-to-Plate Metric Strip */}
        <div className="relative mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Active Sky Transit
            </p>
            <p className="mt-1.5 text-lg font-semibold text-white">
              {DEFAULT_SKY_TRANSIT_CONTEXT.dominantPlanet} in{' '}
              {DEFAULT_SKY_TRANSIT_CONTEXT.dominantSign}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-amber-300/90">
              {DEFAULT_SKY_TRANSIT_CONTEXT.activeHourPlanet} Planetary Hour · +Surge Active
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Lead Chef Vessel
            </p>
            <p className="mt-1.5 truncate text-lg font-semibold text-amber-200">
              {selectedChefEntry.agentName}
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              PVR {selectedChefEntry.vesselPvr} · {selectedChefEntry.vesselArchetype.title}
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Sky-to-Plate Resonance
            </p>
            <p className="mt-1.5 font-mono text-2xl font-bold text-emerald-300 tabular-nums">
              {selectedChefEntry.skyToPlateScore} / 99
            </p>
            <p className="mt-0.5 font-mono text-[11px] text-cyan-300">
              {selectedChefEntry.surgeMode} (+{selectedChefEntry.surgeDelta} OVR Delta)
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-black/30 px-4 py-3.5">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              5:00 AM Dawn Service
            </p>
            <p className="mt-1.5 text-lg font-semibold text-violet-200">Prewarmed &amp; Synced</p>
            <p className="mt-0.5 font-mono text-[11px] text-slate-400">
              1,000 WTEN Catalog Dishes Ready
            </p>
          </div>
        </div>
      </header>

      {/* Interactive Cosmic Menu Alchemist Lab Drawer */}
      <section
        id="cosmic-menu-alchemist-lab"
        className="rounded-3xl border border-violet-400/25 bg-[#0a0d1a]/95 p-5 shadow-[0_18px_60px_rgba(0,0,0,0.55)] sm:p-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-violet-400/35 bg-violet-500/15 text-violet-200">
              <FlaskConical className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-white">
                  Interactive Cosmic Menu Alchemist Lab
                </h2>
                <span className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-0.5 font-mono text-[10px] text-emerald-200">
                  Idempotent MCP Billing
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Execute <code className="text-violet-300">generate_cosmic_recipe</code> or{' '}
                <code className="text-amber-200">alchemize_ingredients</code> with your chosen
                historical chef vessel and inspect live ESMS thermodynamic vectors.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={labRunning}
              onClick={() => {
                const freshKey = makeCulinaryIdempotencyKey(
                  selectedChefEntry.agentId,
                  'generate_cosmic_recipe'
                )
                setIdempotencyKey(freshKey)
                void runCulinaryMcpTool('generate_cosmic_recipe', freshKey)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300/45 bg-amber-400/20 px-4 py-2 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/30 disabled:opacity-50"
            >
              <Wand2 className="h-3.5 w-3.5 text-amber-300" />
              Generate Cosmic Recipe
            </button>

            <button
              type="button"
              disabled={labRunning}
              onClick={() => {
                const freshKey = makeCulinaryIdempotencyKey(
                  selectedChefEntry.agentId,
                  'alchemize_ingredients'
                )
                setIdempotencyKey(freshKey)
                void runCulinaryMcpTool('alchemize_ingredients', freshKey)
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-400/40 bg-violet-500/15 px-3.5 py-2 text-xs font-semibold text-violet-100 transition hover:bg-violet-500/25 disabled:opacity-50"
            >
              <Flame className="h-3.5 w-3.5 text-violet-300" />
              Alchemize Ingredients
            </button>

            <button
              type="button"
              disabled={labRunning}
              onClick={() =>
                void runCulinaryMcpTool(labOutput?.tool ?? 'generate_cosmic_recipe', idempotencyKey)
              }
              className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-400/35 bg-cyan-500/10 px-3 py-2 font-mono text-[11px] text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              <Repeat className="h-3.5 w-3.5" />
              Replay Same Key (0-Cost)
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
          {/* Left Controls */}
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="sanctum-chef-select"
                  className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400"
                >
                  Authoring Chef Vessel
                </label>
                <select
                  id="sanctum-chef-select"
                  value={selectedChefId}
                  onChange={e => setSelectedChefId(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#070a14] px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  {WTEN_SANCTUM_CATALOG.map(entry => (
                    <option key={entry.agentId} value={entry.agentId}>
                      {entry.agentName} (PVR {entry.vesselPvr} · {entry.element})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="sanctum-meal-select"
                  className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400"
                >
                  Service Window
                </label>
                <select
                  id="sanctum-meal-select"
                  value={labMealType}
                  onChange={e =>
                    setLabMealType(e.target.value as 'breakfast' | 'lunch' | 'dinner' | 'elixir')
                  }
                  className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#070a14] px-3 py-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                >
                  <option value="breakfast">05:00 AM Dawn Breakfast Service</option>
                  <option value="lunch">Solar Zenith Lunch</option>
                  <option value="dinner">Twilight Alchemical Banquet</option>
                  <option value="elixir">Nocturnal Restorative Elixir</option>
                </select>
              </div>
            </div>

            <div>
              <label
                htmlFor="sanctum-ingredients-input"
                className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400"
              >
                Raw Ingredients to Transmute (comma-separated)
              </label>
              <input
                id="sanctum-ingredients-input"
                type="text"
                value={labIngredientsText}
                onChange={e => setLabIngredientsText(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-white/15 bg-[#070a14] px-3.5 py-2.5 font-mono text-xs text-slate-100 focus:border-amber-400 focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black/30 px-3.5 py-2.5 font-mono text-[11px]">
              <span className="text-slate-400">
                _meta.idempotencyKey: <strong className="text-amber-200">{idempotencyKey}</strong>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopySupplyList}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/[0.05] px-2.5 py-1 text-[10px] text-slate-200 hover:bg-white/[0.1]"
                >
                  {copiedSupplyList ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-300" /> Copied Supply List
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3 text-cyan-300" /> Copy Supply List
                    </>
                  )}
                </button>
                <a
                  href={selectedChefEntry.alchmKitchenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-amber-400/35 bg-amber-400/15 px-2.5 py-1 text-[10px] font-semibold text-amber-200 hover:bg-amber-400/25"
                >
                  Open in alchm.kitchen ↗
                </a>
              </div>
            </div>
          </div>

          {/* Right Live Output Panel */}
          <div className="rounded-2xl border border-white/10 bg-black/40 p-4">
            {labError && (
              <p className="rounded-xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
                {labError}
              </p>
            )}

            {labOutput ? (
              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2.5">
                  <div>
                    <span className="font-mono text-[10px] uppercase tracking-wider text-violet-300">
                      {labOutput.tool} · Tool PVR {labOutput.pvr}
                    </span>
                    <h3 className="text-sm font-semibold text-white">
                      {String(
                        labOutput.result.title ??
                          `${selectedChefEntry.agentName} Elemental Transmutation`
                      )}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                      labOutput.receipt.replayed
                        ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
                        : 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                    }`}
                  >
                    {labOutput.receipt.status} ·{' '}
                    {labOutput.receipt.debited ? 'ESMS Debited' : '0-Cost Replay'}
                  </span>
                </div>

                {Array.isArray(labOutput.result.steps) && (
                  <ol className="space-y-1.5 text-xs text-slate-300">
                    {(labOutput.result.steps as string[]).map((step, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="font-mono text-amber-300">{i + 1}.</span>
                        <span>{step}</span>
                      </li>
                    ))}
                  </ol>
                )}

                {Array.isArray(labOutput.result.ingredientMappings) && (
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {(
                      labOutput.result.ingredientMappings as Array<{
                        ingredient: string
                        rulingPlanet: string
                        element: string
                        potencyBps: number
                      }>
                    ).map((item, idx) => (
                      <div
                        key={idx}
                        className="rounded-lg border border-white/[0.07] bg-white/[0.03] px-2.5 py-1.5 font-mono text-[11px]"
                      >
                        <span className="text-white">{item.ingredient}</span> ·{' '}
                        <span className="text-amber-300">{item.rulingPlanet}</span> ({item.element})
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-2.5 font-mono text-[10px] text-slate-400">
                  <span>
                    Cost: Sp {labOutput.receipt.cost.spirit} · Es {labOutput.receipt.cost.essence} ·
                    Ma {labOutput.receipt.cost.matter} · Su {labOutput.receipt.cost.substance}
                  </span>
                  <span>x402 Atomic USDC: {labOutput.receipt.x402AtomicUsdc}</span>
                </div>
              </div>
            ) : (
              <div className="flex h-full min-h-[160px] flex-col items-center justify-center text-center">
                <Sparkles className="h-6 w-6 text-amber-300/70" />
                <p className="mt-2 text-xs font-medium text-slate-300">
                  Ready to transmute ingredients with {selectedChefEntry.agentName}
                </p>
                <p className="mt-1 max-w-sm text-[11px] text-slate-500">
                  Click <strong className="text-amber-200">Generate Cosmic Recipe</strong> or{' '}
                  <strong className="text-violet-200">Alchemize Ingredients</strong> above to run
                  the live MCP pipeline.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Filter & Sort Controls */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {ESMS_PILLS.map(pill => {
              const active = esmsFilter === pill.key
              return (
                <button
                  key={pill.key}
                  type="button"
                  onClick={() => setEsmsFilter(pill.key)}
                  className={`rounded-xl border px-3.5 py-2 text-left transition ${
                    active
                      ? pill.accent
                      : 'border-white/10 bg-[#0b0e18]/80 text-slate-400 hover:border-white/20 hover:text-slate-200'
                  }`}
                >
                  <p className="font-mono text-xs font-semibold">{pill.label}</p>
                  <p className="text-[10px] opacity-80">{pill.sublabel}</p>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(['ALL', 'Inferno', 'Tempest', 'Equilibrium'] as const).map(surge => (
              <button
                key={surge}
                type="button"
                onClick={() => setSurgeFilter(surge)}
                className={`rounded-xl border px-3 py-1.5 font-mono text-[11px] transition ${
                  surgeFilter === surge
                    ? 'border-cyan-400/40 bg-cyan-500/15 font-semibold text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-400 hover:text-slate-200'
                }`}
              >
                {surge === 'ALL' ? 'All Surges' : `${surge} Surge`}
              </button>
            ))}

            <select
              aria-label="Sort culinary alterations"
              value={sortBy}
              onChange={e => setSortBy(e.target.value as CulinarySortMode)}
              className="rounded-xl border border-white/15 bg-[#0b0e18] px-3 py-1.5 font-mono text-xs text-slate-200 focus:border-amber-400 focus:outline-none"
            >
              <option value="sky-resonance">Sort: Sky-to-Plate Resonance</option>
              <option value="vessel-pvr">Sort: Chef Vessel PVR (25–99)</option>
              <option value="esms-potency">Sort: Dominant ESMS Ratio</option>
            </select>
          </div>
        </div>

        {/* Search & Active Agent Filter Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative min-w-[260px] flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="search"
              placeholder="Search WTEN dishes, saffron, black garlic, Kepler, Avicenna..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0b0e18]/90 py-2.5 pl-10 pr-4 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400/50 focus:outline-none"
            />
          </div>

          {agentFilter && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-amber-400/35 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
              <span>
                Filtered by Vessel: <strong>{agentFilter}</strong>
              </span>
              <button
                type="button"
                onClick={() => setAgentFilter(null)}
                className="rounded-md p-0.5 hover:bg-white/10"
                aria-label="Clear vessel filter"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* WTEN Recipe Alterations Grid */}
        <div className="grid gap-5 lg:grid-cols-2">
          {filteredDishes.map(dish => (
            <article
              key={dish.id}
              className="flex flex-col justify-between rounded-3xl border border-white/10 bg-[#0b0e18]/90 p-5 shadow-[0_12px_40px_rgba(0,0,0,0.45)] transition hover:border-amber-400/30"
            >
              <div>
                {/* Card Top Bar */}
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.08] pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                          SURGE_BADGE_STYLE[dish.surgeMode]
                        }`}
                      >
                        {dish.surgeMode} · Sky {dish.skyToPlateScore}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 font-mono text-[10px] text-slate-300">
                        <Clock className="mr-1 inline h-3 w-3 text-amber-300" />
                        {dish.mealService} · {dish.prepTimeMinutes}m
                      </span>
                    </div>
                    <h3 className="mt-2.5 text-lg font-semibold text-white">
                      {dish.alchemizedTitle}
                    </h3>
                    <p className="mt-0.5 text-xs text-slate-400">
                      WTEN Base: <span className="text-slate-300">{dish.originalTitle}</span> (
                      {dish.cuisine})
                    </p>
                  </div>

                  <VesselRatingRibbon
                    ovr={dish.vesselPvr}
                    archetype={dish.vesselArchetype}
                    seals={dish.vesselSeals}
                    compact
                  />
                </div>

                {/* ESMS Macro Ratio Bar */}
                <div className="mt-4 rounded-2xl border border-white/[0.06] bg-black/30 p-3">
                  <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-slate-400">
                    <span>
                      Chef:{' '}
                      <Link
                        href={`/agent/${dish.agentId}`}
                        className="font-semibold text-amber-200 hover:underline"
                      >
                        {dish.agentName}
                      </Link>{' '}
                      ({dish.rulingPlanet} · {dish.element})
                    </span>
                    <span>
                      Sp {dish.esmsRatio.spirit}% · Es {dish.esmsRatio.essence}% · Ma{' '}
                      {dish.esmsRatio.matter}% · Su {dish.esmsRatio.substance}%
                    </span>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="bg-rose-400"
                      style={{ width: `${dish.esmsRatio.spirit}%` }}
                      title={`Spirit ${dish.esmsRatio.spirit}%`}
                    />
                    <div
                      className="bg-cyan-400"
                      style={{ width: `${dish.esmsRatio.essence}%` }}
                      title={`Essence ${dish.esmsRatio.essence}%`}
                    />
                    <div
                      className="bg-emerald-400"
                      style={{ width: `${dish.esmsRatio.matter}%` }}
                      title={`Matter ${dish.esmsRatio.matter}%`}
                    />
                    <div
                      className="bg-violet-400"
                      style={{ width: `${dish.esmsRatio.substance}%` }}
                      title={`Substance ${dish.esmsRatio.substance}%`}
                    />
                  </div>
                  <p className="mt-2 text-[11px] text-cyan-200/90">{dish.transitAlignmentNote}</p>
                </div>

                {/* Voiced Culinary Reflection */}
                <blockquote className="mt-3.5 border-l-2 border-amber-400/50 pl-3.5 text-xs italic leading-relaxed text-slate-300">
                  “{dish.voicedReflection}”
                </blockquote>

                {/* Alchemical Substitutions */}
                <div className="mt-4 space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                    Spagyric Ingredient Transmutations
                  </p>
                  {dish.substitutions.map((sub, idx) => (
                    <div
                      key={idx}
                      className="rounded-xl border border-white/[0.07] bg-black/25 px-3 py-2 text-xs"
                    >
                      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[11px]">
                        <span className="text-slate-400 line-through">
                          {sub.originalIngredient}
                        </span>
                        <span className="text-amber-300">→</span>
                        <span className="font-semibold text-emerald-300">
                          {sub.replacementIngredient}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">{sub.astrologicalBasis}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Card Footer Actions */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadDishIntoLab(dish)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-violet-400/35 bg-violet-500/10 px-3 py-1.5 font-mono text-[11px] text-violet-200 transition hover:bg-violet-500/20"
                  >
                    <FlaskConical className="h-3.5 w-3.5" />
                    Load into Lab
                  </button>
                  <Link
                    href={`/agent/${dish.agentId}`}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.04] px-3 py-1.5 font-mono text-[11px] text-slate-300 transition hover:bg-white/[0.09] hover:text-white"
                  >
                    Chef Codex
                  </Link>
                </div>

                <a
                  href={dish.alchmKitchenUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/15 px-3.5 py-1.5 font-mono text-[11px] font-semibold text-amber-100 transition hover:bg-amber-400/25"
                >
                  Open in alchm.kitchen
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}

export default CosmicMenuAlchemist
