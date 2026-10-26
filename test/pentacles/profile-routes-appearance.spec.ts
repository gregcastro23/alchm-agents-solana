// @vitest-environment node
import { describe, it, expect } from 'vitest'
import type { NextRequest } from 'next/server'
import { GET as getBySlug } from '@/app/api/agents/[slug]/route'
import { GET as getByProfileId } from '@/app/api/agents/profile/[id]/route'
import { getHistoricalAgent } from '@/lib/agents/historical'
import { resolveAgentAppearance } from '@/lib/agents/vessel-appearance-manifest'

/**
 * `CraftedAgent.appearance` is the legacy `Appearance` (avatar, color, symbol, aura) carrying the
 * Pentacles likeness manifest's fields (#65). Both profile routes answer that superset, so the
 * UI keeps reading `.color` and `.avatar` while Pentacles reads `.era` and `.headSilhouette`.
 */
const req = {} as NextRequest

describe.each([
  ['/api/agents/[slug]', (id: string) => getBySlug(req, { params: Promise.resolve({ slug: id }) })],
  [
    '/api/agents/profile/[id]',
    (id: string) => getByProfileId(req, { params: Promise.resolve({ id }) }),
  ],
])('%s appearance', (_name, call) => {
  it.each(['isaac-newton', 'leonardo-da-vinci', 'emily-dickinson', 'plato'])(
    'keeps %s’s legacy fields and adds the manifest profile',
    async id => {
      const agent = getHistoricalAgent(id)!
      const res = await call(id)
      expect(res.status).toBe(200)
      const body = await res.json()
      const manifest = resolveAgentAppearance(agent.id)

      // Legacy fields the UI reads survive.
      expect(body.appearance.avatar).toBe(agent.appearance.avatar)
      expect(body.appearance.color).toBe(agent.appearance.color)
      expect(body.appearance.symbol).toBe(agent.appearance.symbol)
      expect(typeof body.appearance.color).toBe('string')

      // The manifest's fields are all present and equal the manifest's.
      expect(body.appearance.era).toBe(manifest.era)
      expect(body.appearance.headSilhouette).toEqual(manifest.headSilhouette)
      expect(body.appearance.garmentSilhouette).toEqual(manifest.garmentSilhouette)
      expect(body.appearance.signatureRelic).toBe(manifest.signatureRelic)
      expect(body.appearance.paletteOverrides).toEqual(manifest.paletteOverrides)
      expect(body.appearance.portraitSvgDataUri).toBe(manifest.portraitSvgDataUri)
    }
  )

  it('answers 404 for an unknown agent', async () => {
    const res = await call('no-such-agent-xyz')
    expect(res.status).toBe(404)
  })
})
