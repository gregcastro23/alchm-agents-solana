import { ForgeWizard } from '@/components/alchemy/ForgeWizard'
import { resolveAuth } from '@/lib/auth'

/**
 * Cosmic Tools — The Forge (Stitch realization plan, Phase 4 + 5, Module 1).
 * The wizard is LIVE: it posts to /api/create-agent, which computes the
 * natal chart + Monica Constant server-side and writes the vessel into
 * historical_agents. The original static Stitch screens remain viewable
 * under /stitch (sandbox).
 */
export default async function ForgePage() {
  const { session, identityUnavailable } = await resolveAuth()
  return <ForgeWizard creatorId={session?.user.id} identityUnavailable={identityUnavailable} />
}
