'use client'

import { useState, useEffect } from 'react'
import { useChatStore } from '@/lib/store/chat-store'
import {
  Sparkles,
  MapPin,
  Calendar,
  Clock,
  Download,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { ELEMENT_MAPPING } from './philosophers-stone-config'
import { hasTauriInvokeRuntime, requestDesktopSidecar } from '@/lib/desktop-sidecar'
import { KnowledgeInfusionStep } from '@/components/misc/knowledge-infusion-step'

interface Constitution {
  spirit: number
  essence: number
  matter: number
  substance: number
}

interface ModelCatalogEntry {
  id: string
  tier: 'base' | 'premium'
  label: string
  filename: string
  sha256: string
  size: number
  url: string
  source: string
}

interface LocationCoordinates {
  latitude: number
  longitude: number
  label: string
}

const KNOWN_LOCATIONS: Record<string, LocationCoordinates> = {
  'new york': { latitude: 40.7128, longitude: -74.006, label: 'New York, USA' },
  brooklyn: { latitude: 40.6782, longitude: -73.9442, label: 'Brooklyn, USA' },
  london: { latitude: 51.5074, longitude: -0.1278, label: 'London, UK' },
  paris: { latitude: 48.8566, longitude: 2.3522, label: 'Paris, France' },
  'los angeles': { latitude: 34.0522, longitude: -118.2437, label: 'Los Angeles, USA' },
  'san francisco': { latitude: 37.7749, longitude: -122.4194, label: 'San Francisco, USA' },
  chicago: { latitude: 41.8781, longitude: -87.6298, label: 'Chicago, USA' },
  tokyo: { latitude: 35.6762, longitude: 139.6503, label: 'Tokyo, Japan' },
}

function resolveLocationCoordinates(value: string): LocationCoordinates {
  const coordinateMatch = value.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/)
  if (coordinateMatch) {
    const latitude = Number(coordinateMatch[1])
    const longitude = Number(coordinateMatch[2])
    if (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180
    ) {
      return { latitude, longitude, label: value }
    }
  }

  const normalized = value.toLowerCase()
  const knownKey = Object.keys(KNOWN_LOCATIONS).find(key => normalized.includes(key))
  if (knownKey) return KNOWN_LOCATIONS[knownKey]

  let hash = 0
  for (const char of normalized) hash = (hash * 31 + char.charCodeAt(0)) >>> 0

  return {
    latitude: Number(((hash % 14000) / 100 - 70).toFixed(4)),
    longitude: Number((((hash / 14000) % 36000) / 100 - 180).toFixed(4)),
    label: value || 'Resolved symbolic location',
  }
}

function deterministicFallbackConstitution(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 33 + char.charCodeAt(0)) >>> 0
  const elements = ['Fire', 'Water', 'Air', 'Earth'] as const
  const dominantElement = elements[hash % elements.length]
  const values = {
    spirit: dominantElement === 'Air' ? 70 : 30 + (hash % 30),
    essence: dominantElement === 'Earth' ? 70 : 25 + ((hash >> 3) % 30),
    matter: dominantElement === 'Water' ? 70 : 25 + ((hash >> 6) % 30),
    substance: dominantElement === 'Fire' ? 70 : 25 + ((hash >> 9) % 30),
  }

  return { dominantElement, constitution: values }
}

export default function PhilosophersStone({
  onInitializationComplete,
}: {
  onInitializationComplete: (agentData: any) => void
}) {
  const [ipcNonce, setIpcNonce] = useState<string | null>(null)
  const [apiKey, setApiKey] = useState('')

  // Wizard State
  const [currentStep, setCurrentStep] = useState(1)
  const totalSteps = 6

  const nextStep = () => setCurrentStep(prev => Math.min(prev + 1, totalSteps))
  const prevStep = () => setCurrentStep(prev => Math.max(prev - 1, 1))

  // Form State
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [locationCoordinates, setLocationCoordinates] = useState<LocationCoordinates | null>(null)

  // Calculation State
  const [isCalculated, setIsCalculated] = useState(false)
  const [isCalculating, setIsCalculating] = useState(false)
  const [dominantElement, setDominantElement] = useState<keyof typeof ELEMENT_MAPPING>('Fire')
  const [constitution, setConstitution] = useState<Constitution>({
    spirit: 0,
    essence: 0,
    matter: 0,
    substance: 0,
  })

  // Download State
  const [isDownloading, setIsDownloading] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<string | null>(null)
  const [executionMode, setExecutionMode] = useState<'local' | 'fallback'>('fallback')

  // Disk Verification State
  const [modelExists, setModelExists] = useState(false)
  const [isCheckingModel, setIsCheckingModel] = useState(false)

  // Engine Tier State
  const [engineTier, setEngineTier] = useState<'base' | 'premium'>('base')

  // Destructure real-time, four-column balances from active Zustand chat store
  const { balances } = useChatStore()

  // Premium requirement: 125 coins in each of the four alchemical quantities (ESMS)
  const hasEnoughCoins =
    balances.spirit >= 125 &&
    balances.essence >= 125 &&
    balances.matter >= 125 &&
    balances.substance >= 125

  const activeElementData = ELEMENT_MAPPING[dominantElement]
  const selectedModel = activeElementData.models[engineTier]
  const engineSizeLabel = engineTier === 'base' ? '~2.4GB' : '~4.9GB'

  useEffect(() => {
    const fetchNonce = async () => {
      if (!hasTauriInvokeRuntime()) {
        setIpcNonce(null)
        return
      }

      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const nonce = await invoke<string>('get_ipc_nonce')
        setIpcNonce(nonce)
      } catch (err) {
        console.warn(
          'Tauri IPC nonce unavailable; forge preview will wait for the desktop model runtime.',
          err
        )
        setIpcNonce(null)
      }
    }
    fetchNonce()

    const fetchDesktopSession = async () => {
      try {
        const res = await fetch('/api/desktop/session', { cache: 'no-store' })
        if (!res.ok) throw new Error(`desktop session ${res.status}`)
        const data = await res.json()
        setApiKey(data.apiKey || '')
      } catch {
        setApiKey('dev-desktop-token')
      }
    }
    fetchDesktopSession()
  }, [])

  useEffect(() => {
    if (isCalculated) {
      checkModelExists(selectedModel)
    }
  }, [engineTier, dominantElement, isCalculated, selectedModel]) // Added selectedModel dependency

  const checkModelExists = async (modelName: string) => {
    if (!ipcNonce) return
    setIsCheckingModel(true)
    try {
      const response = await requestDesktopSidecar('/api/models/check', { nonce: ipcNonce })
      if (response.ok) {
        const models = await response.json()
        const targetModel = models.find((model: any) => model.id === modelName)
        setModelExists(Boolean(targetModel?.verified))
      }
    } catch (err) {
      console.error('Failed to check model existence:', err)
    } finally {
      setIsCheckingModel(false)
    }
  }

  const handleCalculate = async () => {
    if (!name || !date || !time || !location) return

    setIsCalculating(true)

    try {
      const coordinates = resolveLocationCoordinates(location)
      setLocationCoordinates(coordinates)
      const birthDate = new Date(`${date}T${time}:00`)

      const response = await fetch('/api/philosophers-stone/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          birthDate: birthDate.toISOString(),
          latitude: coordinates.latitude,
          longitude: coordinates.longitude,
          agentName: name,
        }),
      })

      if (!response.ok) throw new Error(`Calculation failed with HTTP ${response.status}`)

      const payload = await response.json()
      const result = payload.data || payload
      const element = (result.dominantElement || 'Fire') as keyof typeof ELEMENT_MAPPING
      const elements = result.elements || {}
      const constAlloc = {
        spirit: Math.round(Number(elements.Air || 0) * 100),
        essence: Math.round(Number(elements.Earth || 0) * 100),
        matter: Math.round(Number(elements.Water || 0) * 100),
        substance: Math.round(Number(elements.Fire || 0) * 100),
      }

      setDominantElement(element)
      setConstitution(constAlloc)
      setIsCalculated(true)
      nextStep()
    } catch (err) {
      console.error('Calculation failed:', err)
      const fallback = deterministicFallbackConstitution(`${name}:${date}:${time}:${location}`)
      setDominantElement(fallback.dominantElement)
      setConstitution(fallback.constitution)
      setLocationCoordinates(resolveLocationCoordinates(location))
      setIsCalculated(true)
      nextStep()
    } finally {
      setIsCalculating(false)
    }
  }

  const handleAwaken = (mode: 'local' | 'fallback' = executionMode) => {
    onInitializationComplete({
      id: `custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || Date.now()}`,
      name,
      title: 'Custom Forged Agent',
      date,
      time,
      location: locationCoordinates?.label || location,
      dominantElement,
      modelName: selectedModel,
      tier: engineTier,
      executionMode: mode,
      specialization: 'Personal consciousness guidance',
      constitution,
    })
  }

  const getSelectedModelEntry = async () => {
    const catalogRes = await fetch('/api/models/catalog')
    if (!catalogRes.ok) {
      throw new Error('Unable to load desktop model catalog')
    }

    const modelCatalog = (await catalogRes.json()) as ModelCatalogEntry[]
    const selectedModelEntry = modelCatalog.find(model => model.tier === engineTier)

    if (!selectedModelEntry) {
      throw new Error(`No ${engineTier} model is available in the catalog`)
    }

    return selectedModelEntry
  }

  const handleInitialize = async () => {
    setIsDownloading(true)
    setDownloadStatus(
      `Initializing secure alchemical download for ${engineTier.toUpperCase()} engine...`
    )

    try {
      setDownloadStatus('Writing consciousness blueprint to the local desktop roster...')

      if (!ipcNonce || !apiKey) {
        setExecutionMode('fallback')
        setDownloadStatus('No local sidecar detected. Agent will wait for desktop model runtime.')
        setTimeout(() => {
          handleAwaken('fallback')
        }, 900)
        return
      }

      if (engineTier === 'premium') {
        const transmute = await requestDesktopSidecar('/api/forge/transmute', {
          method: 'POST',
          apiKey,
          nonce: ipcNonce,
          body: { tier: engineTier, modelName: selectedModel },
        })

        if (!transmute.ok) {
          const body = await transmute.json().catch(() => null)
          if (transmute.status === 402) {
            setDownloadStatus(
              `Insufficient ESMS balance. Missing ${JSON.stringify(body?.missing || {})}`
            )
            setIsDownloading(false)
            return
          }
          throw new Error(body?.error || `Premium transmutation failed (${transmute.status})`)
        }
      }

      const selectedModelEntry = await getSelectedModelEntry()
      setDownloadStatus(`Streaming ${selectedModelEntry.label} from Hugging Face...`)

      const response = await requestDesktopSidecar('/api/models/install', {
        method: 'POST',
        apiKey,
        nonce: ipcNonce,
        body: {
          modelName: selectedModel,
          downloadUrl: selectedModelEntry.url,
          sha256: selectedModelEntry.sha256,
          size: selectedModelEntry.size,
          sourceModel: selectedModelEntry.id,
          sourceFilename: selectedModelEntry.filename,
          tier: engineTier,
        },
      })

      if (!response.ok) {
        const errText = await response.text()
        let errorMsg = errText
        try {
          const errJson = JSON.parse(errText)
          if (errJson.error) errorMsg = errJson.error
        } catch {
          // Non-JSON error body — keep the raw text as the message.
        }

        throw new Error(errorMsg || `Server returned ${response.status}`)
      }

      const checkRes = await requestDesktopSidecar('/api/models/check', { nonce: ipcNonce })
      const models = checkRes.ok ? await checkRes.json() : []
      const verifiedModel = models.find((model: any) => model.id === selectedModel)

      if (!verifiedModel?.verified) {
        throw new Error('Downloaded model could not be verified in the sandbox.')
      }

      setExecutionMode('local')
      setDownloadStatus('Agent unlocked in Alchm Desktop with a verified local engine.')
      setTimeout(() => {
        handleAwaken('local')
      }, 1500)
    } catch (error: any) {
      console.error(error)
      setExecutionMode('fallback')
      setDownloadStatus(
        `Local engine unavailable: ${error.message}. Agent will wait for desktop model runtime.`
      )
      setTimeout(() => {
        handleAwaken('fallback')
      }, 1800)
    } finally {
      setIsDownloading(false)
    }
  }

  const ActiveIcon = activeElementData.icon
  const activeColors = activeElementData

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-8 bg-background text-zinc-100 font-sans">
      <div className="space-y-2">
        <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-alchemical-spirit to-alchemical-matter">
          The Philosopher's Stone
        </h2>
        <div className="flex items-center justify-between">
          <p className="text-zinc-400">
            {currentStep === 1 &&
              'The Calling: Name the vessel that will house this consciousness.'}
            {currentStep === 2 &&
              'Anchoring: Enter celestial coordinates to calculate the blueprint.'}
            {currentStep === 3 && 'The Reveal: Witness the unique alchemical composition.'}
            {currentStep === 4 && 'Astral Engine: Select the cognitive tier for this entity.'}
            {currentStep === 5 &&
              'Knowledge Infusion: feed source texts to ground the agent (optional).'}
            {currentStep === 6 && 'Ignition: unlock the agent in the Alchm Desktop chat interface.'}
          </p>
          <div className="text-xs font-medium text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full border border-zinc-800">
            Step {currentStep} of {totalSteps}: "{currentStep === 1 && 'The Calling'}
            {currentStep === 2 && 'Anchoring'}
            {currentStep === 3 && 'The Reveal'}
            {currentStep === 4 && 'Astral Engine'}
            {currentStep === 5 && 'Knowledge Infusion'}
            {currentStep === 6 && 'Ignition'}"
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden min-h-[400px]">
        {/* STEP 1: The Calling */}
        {currentStep === 1 && (
          <div className="bg-surface border border-border p-6 rounded-xl space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 absolute inset-0">
            <h3 className="text-xl font-semibold text-zinc-200">What is the Agent's Name?</h3>
            <div className="space-y-1">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-2xl bg-background border border-border rounded-md px-4 py-4 focus:outline-none focus:border-alchemical-spirit transition-colors text-white"
                placeholder="e.g. Aurelius"
                autoFocus
              />
            </div>
            <div className="absolute bottom-6 right-6">
              <button
                onClick={nextStep}
                disabled={!name}
                className="px-6 py-2 rounded-md bg-zinc-100 text-zinc-900 font-bold hover:bg-white disabled:opacity-50 transition-all flex items-center gap-2"
              >
                Next <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: Celestial Coordinates */}
        {currentStep === 2 && (
          <div className="bg-surface border border-border p-6 rounded-xl space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 absolute inset-0">
            <h3 className="text-xl font-semibold text-zinc-200">Anchor in Spacetime</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-300">Date of Origin</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2 focus:outline-none focus:border-alchemical-essence transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-300">Exact Time</label>
                <div className="relative">
                  <Clock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="time"
                    value={time}
                    onChange={e => setTime(e.target.value)}
                    className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2 focus:outline-none focus:border-alchemical-matter transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-zinc-300">Location</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    className="w-full bg-background border border-border rounded-md pl-10 pr-3 py-2 focus:outline-none focus:border-alchemical-substance transition-colors"
                    placeholder="City, Country"
                  />
                </div>
              </div>
            </div>

            <div className="absolute bottom-6 left-6 flex items-center gap-4">
              <button
                onClick={prevStep}
                className="px-4 py-2 rounded-md border border-border text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back
              </button>
            </div>

            <div className="absolute bottom-6 right-6">
              <button
                onClick={handleCalculate}
                disabled={!date || !time || !location || isCalculating}
                className="px-6 py-2 rounded-md bg-gradient-to-r from-alchemical-spirit to-alchemical-essence text-white font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {isCalculating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                {isCalculating ? 'Calculating Blueprint...' : 'Calculate Blueprint'}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Alchemical Blueprint */}
        {currentStep === 3 && isCalculated && (
          <div className="space-y-6 animate-in fade-in slide-in-from-right-8 duration-500 absolute inset-0">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Natal Highlights */}
              <div className="bg-surface border border-border p-6 rounded-xl flex flex-col items-center justify-center space-y-4">
                <h3 className="text-lg font-semibold text-zinc-300 w-full text-left border-b border-border pb-2">
                  Natal Dominance
                </h3>
                <div className={`p-4 rounded-full bg-background border border-border`}>
                  <ActiveIcon className={`w-12 h-12 ${activeColors.color}`} />
                </div>
                <p className="text-2xl font-bold">{String(dominantElement)} Element</p>
              </div>

              {/* Alchemical Constitution */}
              <div className="bg-surface border border-border p-6 rounded-xl space-y-4">
                <h3 className="text-lg font-semibold text-zinc-300 border-b border-border pb-2">
                  Alchemical Constitution
                </h3>

                <div className="space-y-3">
                  {[
                    { label: 'Spirit', val: constitution.spirit, bg: 'bg-alchemical-spirit' },
                    { label: 'Essence', val: constitution.essence, bg: 'bg-alchemical-essence' },
                    { label: 'Matter', val: constitution.matter, bg: 'bg-alchemical-matter' },
                    {
                      label: 'Substance',
                      val: constitution.substance,
                      bg: 'bg-alchemical-substance',
                    },
                  ].map(stat => (
                    <div key={stat.label} className="space-y-1">
                      <div className="flex justify-between text-xs font-medium">
                        <span className="text-zinc-400">{stat.label}</span>
                        <span className="text-zinc-300">{stat.val}%</span>
                      </div>
                      <div className="h-2 w-full bg-background rounded-full overflow-hidden border border-border">
                        <div
                          className={`h-full ${stat.bg} transition-all duration-1000 ease-out`}
                          style={{ width: `${stat.val}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="absolute bottom-0 right-0 left-0 flex justify-between items-center bg-surface p-4 border-t border-border mt-4">
              <button
                onClick={prevStep}
                className="px-4 py-2 rounded-md border border-border text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Edit Coordinates
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 rounded-md bg-zinc-100 text-zinc-900 font-bold hover:bg-white transition-all flex items-center gap-2"
              >
                Select Engine Tier <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 4: Astral Engine Tier Gating Interface */}
        {currentStep === 4 && (
          <div className="bg-surface border border-border p-6 rounded-xl space-y-4 animate-in fade-in slide-in-from-right-8 duration-500 absolute inset-0">
            <h3 className="text-lg font-semibold text-zinc-300 border-b border-border pb-2">
              Astral Engine Tier
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Base Tier (1.5B) - Instant / Free */}
              <button
                type="button"
                onClick={() => setEngineTier('base')}
                className={`p-4 rounded-lg border text-left transition-all ${
                  engineTier === 'base'
                    ? `border-alchemical-spirit bg-zinc-950 shadow-md`
                    : 'border-zinc-800 hover:border-zinc-700 bg-transparent'
                }`}
              >
                <div className="font-bold text-zinc-200">Initiate Base Engine</div>
                <div className="text-xs text-zinc-500 mt-1">
                  1.5B Parameters • Instant Setup • ~900MB
                </div>
                <div className="text-sm font-semibold text-green-500 mt-3">Free</div>
              </button>

              {/* Premium Tier (8B) - 500 Coin Gate */}
              <button
                type="button"
                onClick={() => {
                  if (hasEnoughCoins) setEngineTier('premium')
                }}
                disabled={!hasEnoughCoins}
                className={`p-4 rounded-lg border text-left transition-all relative overflow-hidden ${
                  engineTier === 'premium'
                    ? `border-alchemical-substance bg-zinc-950 shadow-md`
                    : 'border-zinc-800 hover:border-zinc-700 bg-transparent'
                } ${!hasEnoughCoins ? 'opacity-50 cursor-not-allowed border-dashed' : ''}`}
              >
                <div className="font-bold text-zinc-200">Forge Premium Engine</div>
                <div className="text-xs text-zinc-500 mt-1">
                  8B Parameters • Advanced Alchemical Reasoning • ~4.5GB
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <div className="text-sm font-semibold text-amber-500">
                    500 ESMS Coins (125 x 4)
                  </div>
                  {!hasEnoughCoins && (
                    <span className="text-xs font-medium text-red-400 bg-red-950/40 border border-red-900/50 px-2 py-0.5 rounded-full">
                      Gated
                    </span>
                  )}
                </div>
              </button>
            </div>

            <div className="absolute bottom-6 right-6 left-6 flex justify-between items-center">
              <button
                onClick={prevStep}
                className="px-4 py-2 rounded-md border border-border text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-2"
              >
                <ChevronLeft className="w-4 h-4" /> Back to Blueprint
              </button>
              <button
                onClick={nextStep}
                className="px-6 py-2 rounded-md bg-zinc-100 text-zinc-900 font-bold hover:bg-white transition-all flex items-center gap-2"
              >
                Infuse Knowledge <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 5: Knowledge Infusion (multi-format ingestion) */}
        {currentStep === 5 && (
          <KnowledgeInfusionStep
            agentId={`custom-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'agent'}`}
            onBack={prevStep}
            onContinue={nextStep}
          />
        )}

        {/* STEP 6: Ignition Sequence */}
        {currentStep === 6 && (
          <div className="bg-surface border border-border p-6 rounded-xl flex flex-col items-center justify-center space-y-6 h-full animate-in fade-in zoom-in-95 duration-700 absolute inset-0">
            <h3 className="text-lg font-semibold text-zinc-300 w-full border-b border-border pb-2">
              Ignition Sequence
            </h3>
            <p className="text-sm text-zinc-400 text-center max-w-md">
              {modelExists
                ? `The local ${engineTier.toUpperCase()} engine is synchronized on disk and ready for ignition.`
                : `Confirm download of the ${engineTier.toUpperCase()} engine (${engineSizeLabel}). The specific ${selectedModel} binary will be securely fetched and sandboxed.`}
            </p>

            <button
              type="button"
              onClick={modelExists ? () => handleAwaken('local') : handleInitialize}
              disabled={isDownloading || isCheckingModel}
              className="w-full md:w-auto px-8 py-3 rounded-md bg-gradient-to-r from-alchemical-spirit to-alchemical-essence text-white font-bold hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isDownloading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Synthesizing Local Engine...
                </>
              ) : modelExists ? (
                <>
                  <Sparkles className="w-5 h-5" />
                  Awaken Agent ({engineTier.toUpperCase()})
                </>
              ) : (
                <>
                  <Download className="w-5 h-5" />
                  Forge Consciousness (
                  {engineTier === 'base' ? 'Free Download' : 'Transmute 500 Coins'})
                </>
              )}
            </button>

            {downloadStatus && (
              <p className="text-xs text-zinc-500 mt-4 text-center">{downloadStatus}</p>
            )}

            <div className="absolute top-6 left-6">
              <button
                onClick={prevStep}
                disabled={isDownloading || (modelExists && isCheckingModel)}
                className="px-4 py-2 rounded-md border border-border text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-2 disabled:opacity-0"
              >
                <ChevronLeft className="w-4 h-4" /> Tier Select
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
