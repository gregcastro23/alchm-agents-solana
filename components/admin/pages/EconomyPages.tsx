'use client'

import PlanetaryAgentsPanel, {
  type PlanetaryPayload,
} from '@/components/admin/panels/PlanetaryAgentsPanel'
import TokenEconomyPanel, { type EconomyPayload } from '@/components/admin/panels/TokenEconomyPanel'
import { AdminFrame } from './AdminFrame'
import { readAt, useAdminNavigate, useEnvelopePanel } from './hooks'

export function EconomyPage() {
  const navigate = useAdminNavigate()
  const p = useEnvelopePanel<EconomyPayload>('/api/admin/economy')
  return (
    <AdminFrame
      title="Token economy"
      description="ESMS supply and flow, faucet against sink, claim reconciliation, subscriptions and the Solana rail."
      updated={readAt(p.generatedAt)}
    >
      <TokenEconomyPanel {...p} onNavigate={navigate} />
    </AdminFrame>
  )
}

export function PlanetaryPage() {
  const navigate = useAdminNavigate()
  const p = useEnvelopePanel<PlanetaryPayload>('/api/admin/planetary')
  return (
    <AdminFrame
      title="Planetary layer"
      description="Measured ephemeris provenance, the sprite roster, transit jobs and the activation engine."
      updated={readAt(p.generatedAt)}
    >
      <PlanetaryAgentsPanel {...p} onNavigate={navigate} />
    </AdminFrame>
  )
}
