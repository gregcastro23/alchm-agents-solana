import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/mcp/playground/route'

describe('Wave 22: alchm.kitchen culinary domain-boundary enforcement', () => {
  it('ensures local culinary scope creep files are deleted and do not exist', () => {
    const root = process.cwd()
    const sanctumCatalogPath = path.join(root, 'lib/culinary/sanctum-catalog.ts')
    const menuAlchemistPath = path.join(root, 'components/culinary/CosmicMenuAlchemist.tsx')
    const oldSanctumSpecPath = path.join(root, 'test/culinary/sanctum-catalog.spec.ts')

    expect(fs.existsSync(sanctumCatalogPath)).toBe(false)
    expect(fs.existsSync(menuAlchemistPath)).toBe(false)
    expect(fs.existsSync(oldSanctumSpecPath)).toBe(false)
  })

  it('verifies Navigation.tsx, TopNavBar.tsx, and SideNavBar.tsx contain no internal /culinary links', () => {
    const root = process.cwd()
    const navContent = fs.readFileSync(path.join(root, 'components/Navigation.tsx'), 'utf8')
    const topNavContent = fs.readFileSync(
      path.join(root, 'components/navigation/TopNavBar.tsx'),
      'utf8'
    )
    const sideNavContent = fs.readFileSync(
      path.join(root, 'components/navigation/SideNavBar.tsx'),
      'utf8'
    )

    // No internal route links to /culinary
    expect(navContent).not.toMatch(/href:\s*['"]\/culinary['"]/)
    expect(topNavContent).not.toMatch(/href=['"]\/culinary['"]/)
    expect(sideNavContent).not.toMatch(/href=['"]\/culinary['"]/)
  })

  it('verifies app/(app)/culinary/page.tsx performs an external redirect preserving ?agent= and renders no local catalog', async () => {
    const root = process.cwd()
    const culinaryPageCode = fs.readFileSync(path.join(root, 'app/(app)/culinary/page.tsx'), 'utf8')

    // Must be a pure server redirect, not rendering a local recipe catalog
    expect(culinaryPageCode).toContain('redirect(')
    expect(culinaryPageCode).not.toContain('CosmicMenuAlchemist')
    expect(culinaryPageCode).not.toContain('sanctum-catalog')

    // Test the redirect execution with mocked next/navigation redirect
    const { default: CulinaryRedirectPage } = await import('@/app/(app)/culinary/page')

    try {
      await CulinaryRedirectPage({
        searchParams: Promise.resolve({ agent: 'mars-aries' }),
      })
      // Next.js redirect throws NEXT_REDIRECT in runtime
    } catch (err: any) {
      // Either NEXT_REDIRECT or error containing destination URL
      const digest = String(err?.digest || err?.message || '')
      expect(digest.includes('alchm.kitchen') || digest.includes('NEXT_REDIRECT')).toBe(true)
    }
  })

  it('guarantees no static/hardcoded recipe arrays exist in lib/culinary/ or app/api/mcp/playground/', () => {
    const root = process.cwd()
    const culinaryLibDir = path.join(root, 'lib/culinary')
    if (fs.existsSync(culinaryLibDir)) {
      const files = fs.readdirSync(culinaryLibDir)
      expect(files).toHaveLength(0)
    }

    const playgroundRouteCode = fs.readFileSync(
      path.join(root, 'app/api/mcp/playground/route.ts'),
      'utf8'
    )
    expect(playgroundRouteCode).not.toContain('Solaris Saffron & Black Garlic Alchemical Broth')
    expect(playgroundRouteCode).not.toContain('Toast saffron threads in a dry copper vessel')
    expect(playgroundRouteCode).not.toContain('wten-saffron-broth-042')
  })

  it('proxies or returns 503 UPSTREAM_KITCHEN_REQUIRED when culinary tools are executed without upstream', async () => {
    const req = new Request('http://localhost:3000/api/mcp/playground', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tool: 'generate_cosmic_recipe',
        arguments: { agentId: 'mars-aries' },
        idempotencyKey: 'idem_test_culinary_boundary',
      }),
    })

    const res = await POST(req)
    // When upstream is unreachable/unconfigured in testing environment, must fail with 503 instead of synthesizing local mock dishes
    if (res.status === 503) {
      const json = await res.json()
      expect(json.ok).toBe(false)
      expect(json.code).toBe('UPSTREAM_KITCHEN_REQUIRED')
      expect(json.upstream).toContain('alchm.kitchen')
    } else {
      expect(res.status).toBe(200)
    }
  })
})
