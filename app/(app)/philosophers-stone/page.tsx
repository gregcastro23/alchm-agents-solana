import ModernPhilosophersStone from './modern-page-v2'
import { resolveAuth } from '@/lib/auth'

export default async function PhilosophersStone() {
  const { session, identityUnavailable } = await resolveAuth()
  return (
    <ModernPhilosophersStone
      creatorId={session?.user.id}
      identityUnavailable={identityUnavailable}
    />
  )
}
