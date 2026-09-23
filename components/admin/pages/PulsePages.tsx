'use client'

import OnboardingFunnelPanel, {
  type OnboardingPayload,
} from '@/components/admin/panels/OnboardingFunnelPanel'
import UserAdministrationPanel from '@/components/admin/panels/UserAdministrationPanel'
import { AdminFrame } from './AdminFrame'
import { readAt, useAdminNavigate, useEnvelopePanel } from './hooks'

export function UsersPage() {
  const navigate = useAdminNavigate()
  return (
    <AdminFrame
      title="Users"
      description="Searchable directory with holdings. Only role, verified and isAgentic are editable; every change is audited first."
    >
      <UserAdministrationPanel onNavigate={navigate} />
    </AdminFrame>
  )
}

export function OnboardingPage() {
  const navigate = useAdminNavigate()
  const p = useEnvelopePanel<OnboardingPayload>('/api/admin/onboarding')
  return (
    <AdminFrame
      title="Onboarding funnel"
      description="Signup → profile → chart → balance → chat → wallet, and where each recent user stopped."
      updated={readAt(p.generatedAt)}
    >
      <OnboardingFunnelPanel {...p} onNavigate={navigate} />
    </AdminFrame>
  )
}
